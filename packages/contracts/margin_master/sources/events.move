/// MarginMaster - Events Module
///
/// Defines all events emitted by the MarginMaster protocol.
/// These events are consumed by the backend indexer for database synchronization.
/// All emit functions are public(package) to prevent external fake event injection.

module margin_master::events {
    use sui::event;

    /// Emitted when a new trading position is opened
    public struct PositionOpened has copy, drop {
        position_id: ID,
        owner: address,
        trading_pair: vector<u8>,
        position_type: u8,      // 0 = LONG, 1 = SHORT
        entry_price: u64,
        quantity: u64,
        leverage: u8,
        margin: u64,
        timestamp: u64,
    }

    /// Emitted when a position is closed
    public struct PositionClosed has copy, drop {
        position_id: ID,
        owner: address,
        close_price: u64,
        pnl: u64,
        is_profit: bool,
        timestamp: u64,
    }

    /// Emitted when a copy trade is executed
    public struct CopyTradeExecuted has copy, drop {
        original_position_id: ID,
        follower_position_id: ID,
        trader: address,
        follower: address,
        copy_ratio: u64,
        timestamp: u64,
    }

    /// Emitted when a position is liquidated
    public struct Liquidation has copy, drop {
        position_id: ID,
        owner: address,
        liquidation_price: u64,
        loss: u64,
        timestamp: u64,
    }

    /// Emitted when a batch copy trade is executed
    public struct BatchCopyTradeExecuted has copy, drop {
        original_position_id: ID,
        trader: address,
        follower_count: u64,
        timestamp: u64,
    }

    /// Emitted when a flash loan is initiated for liquidation
    public struct FlashLiquidation has copy, drop {
        position_id: ID,
        liquidator: address,
        borrowed_amount: u64,
        liquidator_reward: u64,
        timestamp: u64,
    }

    // Event emission functions - package-only to prevent fake events
    public(package) fun emit_position_opened(
        position_id: ID,
        owner: address,
        trading_pair: vector<u8>,
        position_type: u8,
        entry_price: u64,
        quantity: u64,
        leverage: u8,
        margin: u64,
        timestamp: u64,
    ) {
        event::emit(PositionOpened {
            position_id,
            owner,
            trading_pair,
            position_type,
            entry_price,
            quantity,
            leverage,
            margin,
            timestamp,
        });
    }

    public(package) fun emit_position_closed(
        position_id: ID,
        owner: address,
        close_price: u64,
        pnl: u64,
        is_profit: bool,
        timestamp: u64,
    ) {
        event::emit(PositionClosed {
            position_id,
            owner,
            close_price,
            pnl,
            is_profit,
            timestamp,
        });
    }

    public(package) fun emit_copy_trade_executed(
        original_position_id: ID,
        follower_position_id: ID,
        trader: address,
        follower: address,
        copy_ratio: u64,
        timestamp: u64,
    ) {
        event::emit(CopyTradeExecuted {
            original_position_id,
            follower_position_id,
            trader,
            follower,
            copy_ratio,
            timestamp,
        });
    }

    public(package) fun emit_liquidation(
        position_id: ID,
        owner: address,
        liquidation_price: u64,
        loss: u64,
        timestamp: u64,
    ) {
        event::emit(Liquidation {
            position_id,
            owner,
            liquidation_price,
            loss,
            timestamp,
        });
    }

    public(package) fun emit_batch_copy_trade_executed(
        original_position_id: ID,
        trader: address,
        follower_count: u64,
        timestamp: u64,
    ) {
        event::emit(BatchCopyTradeExecuted {
            original_position_id,
            trader,
            follower_count,
            timestamp,
        });
    }

    public(package) fun emit_flash_liquidation(
        position_id: ID,
        liquidator: address,
        borrowed_amount: u64,
        liquidator_reward: u64,
        timestamp: u64,
    ) {
        event::emit(FlashLiquidation {
            position_id,
            liquidator,
            borrowed_amount,
            liquidator_reward,
            timestamp,
        });
    }
}
