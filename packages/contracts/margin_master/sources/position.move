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

    /// Position types
    const POSITION_LONG: u8 = 0;
    const POSITION_SHORT: u8 = 1;

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
        let (pnl, is_profit) = calculate_pnl(
            &position,
            current_price
        );

        let position_id = object::uid_to_inner(&position.id);
        let timestamp = clock::timestamp_ms(clock);
        let margin_value = balance::value(&position.margin);

        // Emit event before destroying position
        events::emit_position_closed(
            position_id,
            position.owner,
            current_price,
            pnl,
            is_profit,
            timestamp,
        );

        // Destroy position
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

        // Settle PnL and return funds
        if (is_profit) {
            // User made profit: withdraw from vault and add to margin
            vault::settle_profit(vault, margin, pnl, owner, ctx);
        } else {
            // User made loss: deduct from margin and return to vault
            vault::settle_loss(vault, margin, pnl, owner, ctx);
        };

        object::delete(id);
    }

    /// Calculate PnL for a position (FIXED: uses u128 to prevent overflow)
    public fun calculate_pnl<T>(
        position: &Position<T>,
        current_price: u64
    ): (u64, bool) {
        let entry_price = position.entry_price;
        let quantity = position.quantity;
        let leverage = (position.leverage as u128);

        if (position.position_type == POSITION_LONG) {
            // LONG: profit if current_price > entry_price
            if (current_price > entry_price) {
                let price_diff = ((current_price - entry_price) as u128);
                let quantity_128 = (quantity as u128);

                // Use u128 to prevent overflow: (price_diff * leverage * quantity) / 1000000
                let pnl_128 = (price_diff * leverage * quantity_128) / 1000000;

                // Check if result fits in u64
                assert!(pnl_128 <= 18446744073709551615, EPnLOverflow);

                ((pnl_128 as u64), true) // Profit
            } else {
                let price_diff = ((entry_price - current_price) as u128);
                let quantity_128 = (quantity as u128);
                let pnl_128 = (price_diff * leverage * quantity_128) / 1000000;
                assert!(pnl_128 <= 18446744073709551615, EPnLOverflow);
                ((pnl_128 as u64), false) // Loss
            }
        } else {
            // SHORT: profit if current_price < entry_price
            if (current_price < entry_price) {
                let price_diff = ((entry_price - current_price) as u128);
                let quantity_128 = (quantity as u128);
                let pnl_128 = (price_diff * leverage * quantity_128) / 1000000;
                assert!(pnl_128 <= 18446744073709551615, EPnLOverflow);
                ((pnl_128 as u64), true) // Profit
            } else {
                let price_diff = ((current_price - entry_price) as u128);
                let quantity_128 = (quantity as u128);
                let pnl_128 = (price_diff * leverage * quantity_128) / 1000000;
                assert!(pnl_128 <= 18446744073709551615, EPnLOverflow);
                ((pnl_128 as u64), false) // Loss
            }
        }
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

    public fun is_long<T>(position: &Position<T>): bool {
        position.position_type == POSITION_LONG
    }

    public fun is_short<T>(position: &Position<T>): bool {
        position.position_type == POSITION_SHORT
    }

    public fun is_copy_trade<T>(position: &Position<T>): bool {
        position.is_copy_trade
    }
}
