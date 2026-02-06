/// MarginMaster - Position Module
///
/// Core module for managing margin trading positions (LONG/SHORT).
/// Handles position lifecycle: open -> update -> close/liquidate.

module margin_master::position {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::balance::{Self, Balance};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::option::{Self, Option};
    use margin_master::vault::{Self, Vault};
    use margin_master::events;

    /// Error codes
    const EInvalidLeverage: u64 = 0;
    const EInvalidPositionType: u64 = 1;
    const EInsufficientMargin: u64 = 2;
    const EUnauthorized: u64 = 3;
    const EPositionAlreadyClosed: u64 = 4;
    const EInvalidPrice: u64 = 5;
    const EInvalidQuantity: u64 = 6;
    const EInvalidTradingPair: u64 = 7;
    const ENotLiquidatable: u64 = 8;
    const EPnLOverflow: u64 = 9;
    const EMarginBelowMinimum: u64 = 10;

    /// Position types
    const POSITION_LONG: u8 = 0;
    const POSITION_SHORT: u8 = 1;

    /// Liquidation threshold: 80% of margin consumed by loss (8000 basis points)
    const LIQUIDATION_THRESHOLD_BPS: u64 = 8000;
    /// Liquidator reward: 5% of margin (500 basis points)
    const LIQUIDATOR_REWARD_BPS: u64 = 500;
    /// Basis points denominator
    const BPS_DENOMINATOR: u64 = 10000;
    /// Minimum margin: 1 unit (prevents dust positions)
    const MIN_MARGIN: u64 = 1000000; // 1 USDC (6 decimals)

    /// Position object representing a margin trading position
    public struct Position<phantom T> has key, store {
        id: UID,
        owner: address,
        trading_pair: vector<u8>,
        position_type: u8,          // 0 = LONG, 1 = SHORT
        entry_price: u64,
        quantity: u64,
        leverage: u8,
        margin: Balance<T>,
        stop_loss_price: Option<u64>,
        take_profit_price: Option<u64>,
        is_copy_trade: bool,
        original_position_id: Option<ID>,
        opened_at: u64,
        is_closed: bool,
    }

    /// Open a new LONG or SHORT position
    public fun open_position<T>(
        vault: &mut Vault<T>,
        trading_pair: vector<u8>,
        position_type: u8,
        entry_price: u64,
        quantity: u64,
        leverage: u8,
        margin_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Position<T> {
        // Validate inputs
        assert!(leverage >= 1 && leverage <= 20, EInvalidLeverage);
        assert!(position_type == POSITION_LONG || position_type == POSITION_SHORT, EInvalidPositionType);
        assert!(entry_price > 0, EInvalidPrice);
        assert!(quantity > 0, EInvalidQuantity);
        assert!(margin_amount > 0, EInsufficientMargin);
        assert!(margin_amount >= MIN_MARGIN, EMarginBelowMinimum);
        assert!(std::vector::length(&trading_pair) > 0, EInvalidTradingPair);

        // Deduct margin from vault
        let margin = vault::deduct_margin(vault, margin_amount, ctx);

        // Create position
        let position_uid = object::new(ctx);
        let position_id = object::uid_to_inner(&position_uid);
        let owner = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        // Emit event for backend indexer
        events::emit_position_opened(
            position_id,
            owner,
            trading_pair,
            position_type,
            entry_price,
            quantity,
            leverage,
            margin_amount,
            timestamp,
        );

        Position {
            id: position_uid,
            owner,
            trading_pair,
            position_type,
            entry_price,
            quantity,
            leverage,
            margin,
            stop_loss_price: option::none(),
            take_profit_price: option::none(),
            is_copy_trade: false,
            original_position_id: option::none(),
            opened_at: timestamp,
            is_closed: false,
        }
    }

    /// Close a position and return funds to vault
    public fun close_position<T>(
        position: Position<T>,
        current_price: u64,
        vault: &mut Vault<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Authorization check
        assert!(tx_context::sender(ctx) == position.owner, EUnauthorized);
        assert!(!position.is_closed, EPositionAlreadyClosed);
        assert!(current_price > 0, EInvalidPrice);

        // Calculate PnL
        let (pnl, is_profit) = calculate_pnl(&position, current_price);

        let position_id = object::uid_to_inner(&position.id);
        let timestamp = clock::timestamp_ms(clock);

        // Emit event before destroying position
        events::emit_position_closed(
            position_id,
            position.owner,
            current_price,
            pnl,
            is_profit,
            timestamp,
        );

        // Settle and destroy
        settle_and_destroy(position, pnl, is_profit, vault, ctx);
    }

    /// Liquidate an underwater position - callable by anyone (keeper/bot)
    /// Position is liquidatable when unrealized loss >= 80% of margin
    /// Liquidator receives 5% of margin as reward
    public fun liquidate_position<T>(
        position: Position<T>,
        current_price: u64,
        vault: &mut Vault<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(!position.is_closed, EPositionAlreadyClosed);
        assert!(current_price > 0, EInvalidPrice);

        let (pnl, is_profit) = calculate_pnl(&position, current_price);

        // Can only liquidate losing positions
        assert!(!is_profit, ENotLiquidatable);

        let margin_value = balance::value(&position.margin);
        let threshold = (margin_value * LIQUIDATION_THRESHOLD_BPS) / BPS_DENOMINATOR;

        // Loss must exceed liquidation threshold (80% of margin)
        assert!(pnl >= threshold, ENotLiquidatable);

        let position_id = object::uid_to_inner(&position.id);
        let position_owner = position.owner;
        let timestamp = clock::timestamp_ms(clock);
        let liquidator = tx_context::sender(ctx);

        // Calculate liquidator reward (5% of margin)
        let reward_amount = (margin_value * LIQUIDATOR_REWARD_BPS) / BPS_DENOMINATOR;

        // Emit liquidation event
        events::emit_liquidation(
            position_id,
            position_owner,
            current_price,
            pnl,
            timestamp,
        );

        // Destroy position and extract margin
        let Position {
            id,
            owner: _,
            trading_pair: _,
            position_type: _,
            entry_price: _,
            quantity: _,
            leverage: _,
            mut margin,
            stop_loss_price: _,
            take_profit_price: _,
            is_copy_trade: _,
            original_position_id: _,
            opened_at: _,
            is_closed: _,
        } = position;

        // Pay liquidator reward from seized margin
        if (reward_amount > 0 && reward_amount < balance::value(&margin)) {
            let reward_balance = balance::split(&mut margin, reward_amount);
            let reward_coin = sui::coin::from_balance(reward_balance, ctx);
            transfer::public_transfer(reward_coin, liquidator);
        };

        // Remaining margin goes back to vault (protocol keeps it)
        let remaining = balance::value(&margin);
        if (remaining > 0) {
            balance::join(vault::borrow_balance_mut(vault), margin);
            vault::decrease_committed_margin(vault, remaining + reward_amount);
            vault::increase_available_liquidity(vault, remaining);
        } else {
            balance::destroy_zero(margin);
            vault::decrease_committed_margin(vault, reward_amount);
        };

        object::delete(id);
    }

    /// Entry function for liquidation
    public entry fun liquidate_position_entry<T>(
        position: Position<T>,
        current_price: u64,
        vault: &mut Vault<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        liquidate_position(position, current_price, vault, clock, ctx);
    }

    /// Calculate PnL for a position (uses u128 to prevent overflow)
    public fun calculate_pnl<T>(
        position: &Position<T>,
        current_price: u64
    ): (u64, bool) {
        let entry_price = position.entry_price;

        // Determine price direction based on position type
        let (price_diff, is_profit) = if (position.position_type == POSITION_LONG) {
            // LONG: profit if current_price > entry_price
            if (current_price > entry_price) {
                (current_price - entry_price, true)
            } else {
                (entry_price - current_price, false)
            }
        } else {
            // SHORT: profit if current_price < entry_price
            if (current_price < entry_price) {
                (entry_price - current_price, true)
            } else {
                (current_price - entry_price, false)
            }
        };

        // Single u128 calculation path (DRY)
        let pnl = compute_pnl_u128(price_diff, position.quantity, position.leverage);
        (pnl, is_profit)
    }

    /// Internal helper: compute PnL using u128 to prevent overflow
    fun compute_pnl_u128(price_diff: u64, quantity: u64, leverage: u8): u64 {
        let diff_128 = (price_diff as u128);
        let qty_128 = (quantity as u128);
        let lev_128 = (leverage as u128);

        let pnl_128 = (diff_128 * lev_128 * qty_128) / 1000000;

        // Check if result fits in u64
        assert!(pnl_128 <= 18446744073709551615, EPnLOverflow);
        (pnl_128 as u64)
    }

    /// Check if a position is liquidatable at a given price
    public fun is_liquidatable<T>(position: &Position<T>, current_price: u64): bool {
        if (position.is_closed || current_price == 0) return false;

        let (pnl, is_profit) = calculate_pnl(position, current_price);
        if (is_profit) return false;

        let margin_value = balance::value(&position.margin);
        let threshold = (margin_value * LIQUIDATION_THRESHOLD_BPS) / BPS_DENOMINATOR;
        pnl >= threshold
    }

    /// Get liquidation price for a position
    public fun get_liquidation_price<T>(position: &Position<T>): u64 {
        let margin_value = balance::value(&position.margin);
        let threshold = (margin_value * LIQUIDATION_THRESHOLD_BPS) / BPS_DENOMINATOR;

        // threshold = (price_diff * leverage * quantity) / 1000000
        // price_diff = (threshold * 1000000) / (leverage * quantity)
        let leverage = (position.leverage as u128);
        let quantity = (position.quantity as u128);
        let threshold_128 = (threshold as u128);

        if (leverage == 0 || quantity == 0) return 0;

        let price_diff_128 = (threshold_128 * 1000000) / (leverage * quantity);
        let price_diff = (price_diff_128 as u64);

        if (position.position_type == POSITION_LONG) {
            // LONG liquidation: entry_price - price_diff
            if (price_diff >= position.entry_price) 0
            else position.entry_price - price_diff
        } else {
            // SHORT liquidation: entry_price + price_diff
            position.entry_price + price_diff
        }
    }

    /// Internal: settle PnL and destroy position
    fun settle_and_destroy<T>(
        position: Position<T>,
        pnl: u64,
        is_profit: bool,
        vault: &mut Vault<T>,
        ctx: &mut TxContext
    ) {
        let Position {
            id,
            owner,
            trading_pair: _,
            position_type: _,
            entry_price: _,
            quantity: _,
            leverage: _,
            margin,
            stop_loss_price: _,
            take_profit_price: _,
            is_copy_trade: _,
            original_position_id: _,
            opened_at: _,
            is_closed: _,
        } = position;

        if (is_profit) {
            vault::settle_profit(vault, margin, pnl, owner, ctx);
        } else {
            vault::settle_loss(vault, margin, pnl, owner, ctx);
        };

        object::delete(id);
    }

    /// Set stop-loss price
    public fun set_stop_loss<T>(
        position: &mut Position<T>,
        stop_loss_price: u64,
        ctx: &TxContext
    ) {
        assert!(tx_context::sender(ctx) == position.owner, EUnauthorized);
        position.stop_loss_price = option::some(stop_loss_price);
    }

    /// Set take-profit price
    public fun set_take_profit<T>(
        position: &mut Position<T>,
        take_profit_price: u64,
        ctx: &TxContext
    ) {
        assert!(tx_context::sender(ctx) == position.owner, EUnauthorized);
        position.take_profit_price = option::some(take_profit_price);
    }

    /// Mark position as copy trade (called by copy executor)
    public(package) fun mark_as_copy_trade<T>(
        position: &mut Position<T>,
        original_position_id: ID
    ) {
        position.is_copy_trade = true;
        position.original_position_id = option::some(original_position_id);
    }

    /// Package-internal: get mutable margin balance for flash liquidator
    public(package) fun extract_margin<T>(position: Position<T>): (UID, Balance<T>, address) {
        let Position {
            id,
            owner,
            trading_pair: _,
            position_type: _,
            entry_price: _,
            quantity: _,
            leverage: _,
            margin,
            stop_loss_price: _,
            take_profit_price: _,
            is_copy_trade: _,
            original_position_id: _,
            opened_at: _,
            is_closed: _,
        } = position;
        (id, margin, owner)
    }

    /// Transfer position ownership
    public entry fun transfer_position<T>(position: Position<T>, recipient: address) {
        transfer::transfer(position, recipient);
    }

    /// Entry function to open position from frontend
    public entry fun open_position_entry<T>(
        vault: &mut Vault<T>,
        trading_pair: vector<u8>,
        position_type: u8,
        entry_price: u64,
        quantity: u64,
        leverage: u8,
        margin_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let position = open_position(
            vault,
            trading_pair,
            position_type,
            entry_price,
            quantity,
            leverage,
            margin_amount,
            clock,
            ctx
        );
        transfer::transfer(position, tx_context::sender(ctx));
    }

    /// Entry function to close position from frontend
    public entry fun close_position_entry<T>(
        position: Position<T>,
        current_price: u64,
        vault: &mut Vault<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        close_position(position, current_price, vault, clock, ctx);
    }

    // Getter functions
    public fun owner<T>(position: &Position<T>): address {
        position.owner
    }

    public fun entry_price<T>(position: &Position<T>): u64 {
        position.entry_price
    }

    public fun quantity<T>(position: &Position<T>): u64 {
        position.quantity
    }

    public fun leverage<T>(position: &Position<T>): u8 {
        position.leverage
    }

    public fun margin_value<T>(position: &Position<T>): u64 {
        balance::value(&position.margin)
    }

    public fun is_long<T>(position: &Position<T>): bool {
        position.position_type == POSITION_LONG
    }

    public fun is_short<T>(position: &Position<T>): bool {
        position.position_type == POSITION_SHORT
    }

    public fun is_copy_trade<T>(position: &Position<T>): bool {
        position.is_copy_trade
    }

    public fun is_closed<T>(position: &Position<T>): bool {
        position.is_closed
    }

    public fun position_type<T>(position: &Position<T>): u8 {
        position.position_type
    }
}
