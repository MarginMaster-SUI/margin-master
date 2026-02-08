module margin_master::trading_bot;

use margin_master::vault::{Self, Vault};
use margin_master::position::{Self, Position};
use margin_master::events;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::object::{Self, UID, ID};
use sui::table::{Self, Table};
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use sui::event;
use std::vector;

/// Error codes
const EUnauthorized: u64 = 0;
const EBotInactive: u64 = 1;
const ETraderPositionClosed: u64 = 2;
const EPositionTooRecent: u64 = 3;
const EDailyLossLimitExceeded: u64 = 4;
const EInsufficientFunds: u64 = 5;
const EBotAlreadyActive: u64 = 6;
const EInvalidCopyRatio: u64 = 7;
const ECannotFollowSelf: u64 = 8;
const EVaultNotEmpty: u64 = 9;
const EBotStillActive: u64 = 10;

/// Trading bot for automated copy trading
/// Each follower has their own bot with isolated funds
public struct TradingBot<phantom T> has key {
    id: UID,
    owner: address,                    // Follower address (only owner can withdraw/destroy)
    vault: Vault<T>,                   // Embedded vault holding follower's funds
    followed_trader: address,          // Trader to copy

    // Copy parameters
    copy_ratio: u64,                   // Basis points (1-10000)
    max_position_size: u64,            // Maximum position size in base units

    // Security parameters
    daily_loss_limit: u64,             // Maximum loss per day (USDC base units)
    today_losses: u64,                 // Accumulated losses today
    last_reset_day: u64,               // Last day counter reset (epoch days)

    min_trader_hold_duration_ms: u64,  // Trader must hold position for X ms before copying
    require_trader_position_open: bool, // Only copy if trader position still OPEN

    // State
    is_active: bool,                   // Whether bot is actively copying
    created_at: u64,
    total_trades_copied: u64,
}

/// Bot registry (shared object) - tracks all active bots
public struct TradingBotRegistry has key {
    id: UID,
    // trader_address -> vector of follower bot IDs
    trader_to_bots: Table<address, vector<ID>>,
    total_bots: u64,
    total_active_bots: u64,
}

// Note: init() removed due to testnet upgrade compatibility
// Use create_registry() entry function instead

/// Internal: create registry
fun create_registry_internal(ctx: &mut TxContext) {
    let registry = TradingBotRegistry {
        id: object::new(ctx),
        trader_to_bots: table::new(ctx),
        total_bots: 0,
        total_active_bots: 0,
    };
    transfer::share_object(registry);
}

/// Public function to create registry (for upgrade scenarios)
public entry fun create_registry(ctx: &mut TxContext) {
    create_registry_internal(ctx);
}

/// Create a new trading bot for a follower
/// Bot starts inactive, must be activated after depositing funds
public entry fun create_trading_bot<T>(
    registry: &mut TradingBotRegistry,
    followed_trader: address,
    copy_ratio: u64,
    max_position_size: u64,
    daily_loss_limit: u64,
    min_trader_hold_duration_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let owner = tx_context::sender(ctx);

    // Validate parameters
    assert!(copy_ratio > 0 && copy_ratio <= 10000, EInvalidCopyRatio);
    assert!(owner != followed_trader, ECannotFollowSelf);

    // Create embedded vault
    let vault = vault::create<T>(ctx);

    let bot = TradingBot<T> {
        id: object::new(ctx),
        owner,
        vault,
        followed_trader,
        copy_ratio,
        max_position_size,
        daily_loss_limit,
        today_losses: 0,
        last_reset_day: get_day_number(clock),
        min_trader_hold_duration_ms,
        require_trader_position_open: true,  // Default: safe mode
        is_active: false,  // Must deposit and activate
        created_at: sui::clock::timestamp_ms(clock),
        total_trades_copied: 0,
    };

    let bot_id = object::id(&bot);

    // Register in registry
    if (!table::contains(&registry.trader_to_bots, followed_trader)) {
        table::add(&mut registry.trader_to_bots, followed_trader, vector::empty<ID>());
    };
    let bot_ids = table::borrow_mut(&mut registry.trader_to_bots, followed_trader);
    vector::push_back(bot_ids, bot_id);

    registry.total_bots = registry.total_bots + 1;

    // Share the bot (allows backend to call it)
    transfer::share_object(bot);
}

/// Deposit funds into bot (only owner)
public entry fun deposit<T>(bot: &mut TradingBot<T>, coin: Coin<T>, ctx: &TxContext) {
    assert!(bot.owner == tx_context::sender(ctx), EUnauthorized);
    vault::deposit(&mut bot.vault, coin);
}

/// Withdraw funds from bot (only owner)
public entry fun withdraw<T>(
    bot: &mut TradingBot<T>,
    amount: u64,
    ctx: &mut TxContext,
) {
    assert!(bot.owner == tx_context::sender(ctx), EUnauthorized);
    let withdrawn_coin = vault::withdraw(&mut bot.vault, amount, ctx);
    transfer::public_transfer(withdrawn_coin, bot.owner);
}

/// Activate bot to start copying (only owner)
public entry fun activate_bot<T>(
    bot: &mut TradingBot<T>,
    registry: &mut TradingBotRegistry,
    ctx: &TxContext,
) {
    assert!(bot.owner == tx_context::sender(ctx), EUnauthorized);
    assert!(!bot.is_active, EBotAlreadyActive);
    assert!(vault::available_liquidity(&bot.vault) > 0, EInsufficientFunds);

    bot.is_active = true;
    registry.total_active_bots = registry.total_active_bots + 1;
}

/// Deactivate bot to stop copying (only owner)
public entry fun deactivate_bot<T>(
    bot: &mut TradingBot<T>,
    registry: &mut TradingBotRegistry,
    ctx: &TxContext,
) {
    assert!(bot.owner == tx_context::sender(ctx), EUnauthorized);

    if (bot.is_active) {
        bot.is_active = false;
        registry.total_active_bots = registry.total_active_bots - 1;
    };
}

/// Destroy bot and return all funds (only owner)
/// Bot must be inactive first
public entry fun destroy_bot<T>(
    bot: TradingBot<T>,
    registry: &mut TradingBotRegistry,
    ctx: &mut TxContext,
) {
    assert!(bot.owner == tx_context::sender(ctx), EUnauthorized);
    assert!(!bot.is_active, EBotStillActive);

    let TradingBot {
        id,
        owner,
        mut vault,
        followed_trader,
        copy_ratio: _,
        max_position_size: _,
        daily_loss_limit: _,
        today_losses: _,
        last_reset_day: _,
        min_trader_hold_duration_ms: _,
        require_trader_position_open: _,
        is_active: _,
        created_at: _,
        total_trades_copied: _,
    } = bot;

    // Withdraw all remaining funds
    let remaining_balance = vault::balance(&vault);
    if (remaining_balance > 0) {
        let final_withdrawal = vault::withdraw(&mut vault, remaining_balance, ctx);
        transfer::public_transfer(final_withdrawal, owner);
    };

    // Destroy vault and bot
    vault::destroy_empty(vault);

    // Remove from registry
    let bot_id = object::uid_to_inner(&id);
    if (table::contains(&registry.trader_to_bots, followed_trader)) {
        let bot_ids = table::borrow_mut(&mut registry.trader_to_bots, followed_trader);
        let (found, index) = vector::index_of(bot_ids, &bot_id);
        if (found) {
            vector::remove(bot_ids, index);
        };
    };

    registry.total_bots = registry.total_bots - 1;
    object::delete(id);
}

/// Update bot parameters (only owner)
public entry fun update_bot_params<T>(
    bot: &mut TradingBot<T>,
    new_copy_ratio: u64,
    new_max_position_size: u64,
    new_daily_loss_limit: u64,
    ctx: &TxContext,
) {
    assert!(bot.owner == tx_context::sender(ctx), EUnauthorized);
    assert!(new_copy_ratio > 0 && new_copy_ratio <= 10000, EInvalidCopyRatio);

    bot.copy_ratio = new_copy_ratio;
    bot.max_position_size = new_max_position_size;
    bot.daily_loss_limit = new_daily_loss_limit;
}

/// Execute copy trade with comprehensive security checks
/// Called by backend service after detecting PositionOpened event
public entry fun execute_copy_trade<T>(
    bot: &mut TradingBot<T>,
    trader_position: &Position<T>,  // Must provide trader's actual position
    trading_pair: vector<u8>,
    position_type: u8,
    entry_price: u64,
    trader_quantity: u64,
    leverage: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // === Security Check 1: Bot must be active ===
    assert!(bot.is_active, EBotInactive);

    // === Security Check 2: Verify trader position is OPEN ===
    if (bot.require_trader_position_open) {
        assert!(position::is_open(trader_position), ETraderPositionClosed);
    };

    // === Security Check 3: Verify trader identity ===
    let trader = position::owner(trader_position);
    assert!(trader == bot.followed_trader, EUnauthorized);

    // === Security Check 4: Verify minimum hold duration (防 pump & dump) ===
    let position_age = sui::clock::timestamp_ms(clock) - position::opened_at(trader_position);
    assert!(position_age >= bot.min_trader_hold_duration_ms, EPositionTooRecent);

    // === Security Check 5: Check daily loss limit ===
    reset_daily_losses_if_needed(bot, clock);
    assert!(bot.today_losses < bot.daily_loss_limit, EDailyLossLimitExceeded);

    // === Calculate follower position size ===
    let mut follower_quantity = (trader_quantity * bot.copy_ratio) / 10000;

    // Cap at max_position_size
    if (bot.max_position_size > 0 && follower_quantity > bot.max_position_size) {
        follower_quantity = bot.max_position_size;
    };

    let follower_margin = (follower_quantity * entry_price) / ((leverage as u64) * 1000000);
    let follower_margin = if (follower_margin < 1000000) { 1000000 } else { follower_margin };

    // Check vault has sufficient liquidity
    assert!(vault::available_liquidity(&bot.vault) >= follower_margin, EInsufficientFunds);

    // === Open position for follower ===
    let mut follower_position = position::open_position_delegated(
        &mut bot.vault,
        trading_pair,
        position_type,
        entry_price,
        follower_quantity,
        leverage,
        follower_margin,
        clock,
        ctx,
    );

    // Mark as copy trade
    let trader_position_id = object::id(trader_position);
    position::mark_as_copy_trade(&mut follower_position, trader_position_id);

    bot.total_trades_copied = bot.total_trades_copied + 1;

    // Transfer position to bot owner (not sender, which is backend)
    transfer::public_transfer(follower_position, bot.owner);

    // Emit event
    events::emit_bot_copy_trade_executed(
        object::id(bot),
        trader_position_id,
        bot.owner,
        bot.followed_trader,
        follower_quantity,
        follower_margin,
        sui::clock::timestamp_ms(clock),
    );
}

/// Close position and track loss
public entry fun close_position_and_track_loss<T>(
    bot: &mut TradingBot<T>,
    position: Position<T>,
    close_price: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(bot.owner == tx_context::sender(ctx), EUnauthorized);

    // Calculate PnL
    let (pnl_amount, is_profit) = position::calculate_pnl(&position, close_price);

    // If loss, track it
    if (!is_profit) {
        reset_daily_losses_if_needed(bot, clock);
        bot.today_losses = bot.today_losses + pnl_amount;
    };

    // Close position (signature: position, current_price, vault, clock, ctx)
    position::close_position_entry(
        position,
        close_price,
        &mut bot.vault,
        clock,
        ctx,
    );
}

// === Helper functions ===

fun reset_daily_losses_if_needed<T>(bot: &mut TradingBot<T>, clock: &Clock) {
    let current_day = get_day_number(clock);
    if (current_day > bot.last_reset_day) {
        bot.today_losses = 0;
        bot.last_reset_day = current_day;
    };
}

fun get_day_number(clock: &Clock): u64 {
    let ms = sui::clock::timestamp_ms(clock);
    ms / (24 * 60 * 60 * 1000)  // Convert to days
}

// === Getter functions ===

public fun owner<T>(bot: &TradingBot<T>): address { bot.owner }
public fun followed_trader<T>(bot: &TradingBot<T>): address { bot.followed_trader }
public fun is_active<T>(bot: &TradingBot<T>): bool { bot.is_active }
public fun copy_ratio<T>(bot: &TradingBot<T>): u64 { bot.copy_ratio }
public fun total_trades_copied<T>(bot: &TradingBot<T>): u64 { bot.total_trades_copied }
public fun vault_balance<T>(bot: &TradingBot<T>): u64 { vault::balance(&bot.vault) }
public fun available_liquidity<T>(bot: &TradingBot<T>): u64 { vault::available_liquidity(&bot.vault) }
public fun today_losses<T>(bot: &TradingBot<T>): u64 { bot.today_losses }
public fun daily_loss_limit<T>(bot: &TradingBot<T>): u64 { bot.daily_loss_limit }

// === Test-only functions ===

#[test_only]
public fun test_init(ctx: &mut TxContext) {
    init(ctx);
}
