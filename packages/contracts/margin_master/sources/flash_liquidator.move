/// MarginMaster - Flash Liquidator Module
///
/// Enables capital-efficient liquidation using flash loans.
/// Liquidators can liquidate underwater positions without upfront capital:
///   1. Seize margin from underwater position
///   2. Keep 5% as reward
///   3. Return rest to vault
///
/// Also supports flash-borrow pattern for advanced liquidation strategies.

module margin_master::flash_liquidator {
    use sui::object;
    use sui::tx_context::{Self, TxContext};
    use sui::balance;
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use margin_master::vault::{Self, Vault};
    use margin_master::position::{Self, Position};
    use margin_master::events;

    /// Error codes
    const ENotLiquidatable: u64 = 0;

    /// Liquidator reward: 5% of seized margin
    const LIQUIDATOR_REWARD_BPS: u64 = 500;
    /// Basis points denominator
    const BPS_DENOMINATOR: u64 = 10000;

    /// Execute a flash liquidation - no upfront capital needed
    /// Seizes margin from underwater position, pays liquidator reward, returns rest to vault
    public entry fun flash_liquidate<T>(
        position: Position<T>,
        current_price: u64,
        vault: &mut Vault<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(current_price > 0, ENotLiquidatable);
        assert!(position::is_liquidatable(&position, current_price), ENotLiquidatable);

        let position_id = object::id(&position);
        let position_owner = position::owner(&position);
        let margin_val = position::margin_value(&position);
        let liquidator = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        // Calculate reward (5% of margin)
        let reward_amount = (margin_val * LIQUIDATOR_REWARD_BPS) / BPS_DENOMINATOR;

        // Destroy position and extract margin balance
        let (id, mut seized, _owner) = position::extract_margin(position);

        // Pay liquidator reward from seized margin
        if (reward_amount > 0 && reward_amount < balance::value(&seized)) {
            let reward_balance = balance::split(&mut seized, reward_amount);
            let reward_coin = sui::coin::from_balance(reward_balance, ctx);
            transfer::public_transfer(reward_coin, liquidator);
        };

        // Return remaining seized margin to vault
        let remaining = balance::value(&seized);
        if (remaining > 0) {
            balance::join(vault::borrow_balance_mut(vault), seized);
            vault::decrease_committed_margin(vault, margin_val);
            vault::increase_available_liquidity(vault, remaining);
        } else {
            balance::destroy_zero(seized);
            vault::decrease_committed_margin(vault, margin_val);
        };

        // Emit events
        events::emit_flash_liquidation(
            position_id,
            liquidator,
            0,
            reward_amount,
            timestamp,
        );

        events::emit_liquidation(
            position_id,
            position_owner,
            current_price,
            margin_val,
            timestamp,
        );

        object::delete(id);
    }

    /// Flash-borrow liquidation for advanced strategies
    /// Borrows from vault → liquidates → repays from seized margin → keeps profit
    /// Uses hot potato receipt to guarantee atomic repayment
    public entry fun flash_borrow_liquidate<T>(
        position: Position<T>,
        current_price: u64,
        vault: &mut Vault<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(current_price > 0, ENotLiquidatable);
        assert!(position::is_liquidatable(&position, current_price), ENotLiquidatable);

        let position_id = object::id(&position);
        let position_owner = position::owner(&position);
        let margin_val = position::margin_value(&position);
        let liquidator = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);
        let reward_amount = (margin_val * LIQUIDATOR_REWARD_BPS) / BPS_DENOMINATOR;

        // Flash borrow a small amount from vault for gas/operation
        // The seized margin will be used to repay
        let borrow_amount = 1; // Minimal borrow to demonstrate flash loan pattern
        let (borrowed, receipt) = vault::flash_borrow(vault, borrow_amount);

        // Extract margin from underwater position
        let (id, mut seized, _owner) = position::extract_margin(position);

        // Merge borrowed amount back into seized for repayment
        balance::join(&mut seized, borrowed);

        // Split reward for liquidator
        if (reward_amount > 0 && reward_amount < balance::value(&seized)) {
            let reward_balance = balance::split(&mut seized, reward_amount);
            let reward_coin = sui::coin::from_balance(reward_balance, ctx);
            transfer::public_transfer(reward_coin, liquidator);
        };

        // Repay flash loan (must repay at least borrow_amount)
        let repay_balance = balance::split(&mut seized, borrow_amount);
        vault::flash_repay(vault, repay_balance, receipt);

        // Return remaining to vault as protocol revenue
        let remaining = balance::value(&seized);
        if (remaining > 0) {
            balance::join(vault::borrow_balance_mut(vault), seized);
            vault::decrease_committed_margin(vault, margin_val);
            vault::increase_available_liquidity(vault, remaining);
        } else {
            balance::destroy_zero(seized);
            vault::decrease_committed_margin(vault, margin_val);
        };

        // Emit events
        events::emit_flash_liquidation(
            position_id,
            liquidator,
            borrow_amount,
            reward_amount,
            timestamp,
        );

        events::emit_liquidation(
            position_id,
            position_owner,
            current_price,
            margin_val,
            timestamp,
        );

        object::delete(id);
    }
}
