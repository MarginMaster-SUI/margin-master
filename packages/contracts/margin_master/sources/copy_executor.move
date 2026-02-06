/// MarginMaster - Copy Executor Module
///
/// Executes copy trades when a trader opens a position.
/// Manages copy ratios and creates follower positions.
/// Supports batch execution for gas optimization.

module margin_master::copy_executor {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::clock::{Clock};
    use margin_master::vault::{Self, Vault};
    use margin_master::position::{Self, Position};
    use margin_master::events;

    /// Error codes
    const EInvalidCopyRatio: u64 = 0;
    const ECopyRelationNotFound: u64 = 1;
    const EInactiveCopyRelation: u64 = 2;
    const ESelfCopy: u64 = 3;
    const EZeroCopyRatio: u64 = 4;
    const ENoActiveRelations: u64 = 5;

    /// Copy relation registry (shared object)
    public struct CopyRelationRegistry has key {
        id: UID,
        // trader_address -> vector of follower relations
        relations: Table<address, vector<CopyRelation>>,
    }

    /// On-chain copy relationship
    public struct CopyRelation has store, copy, drop {
        trader: address,
        follower: address,
        copy_ratio: u64,        // Basis points (1-10000), e.g., 5000 = 50%
        max_position_size: u64,
        is_active: bool,
    }

    /// Initialize the copy relation registry (called once during deployment)
    fun init(ctx: &mut TxContext) {
        let registry = CopyRelationRegistry {
            id: object::new(ctx),
            relations: table::new(ctx),
        };
        transfer::share_object(registry);
    }

    /// Add a copy relation (trader -> follower)
    public entry fun add_copy_relation(
        registry: &mut CopyRelationRegistry,
        trader: address,
        follower: address,
        copy_ratio: u64,
        max_position_size: u64,
        ctx: &TxContext
    ) {
        // Validate inputs
        assert!(copy_ratio > 0, EZeroCopyRatio);
        assert!(copy_ratio <= 10000, EInvalidCopyRatio);
        assert!(trader != follower, ESelfCopy);
        assert!(tx_context::sender(ctx) == follower, 1); // Only follower can add relation

        let relation = CopyRelation {
            trader,
            follower,
            copy_ratio,
            max_position_size,
            is_active: true,
        };

        if (table::contains(&registry.relations, trader)) {
            let relations = table::borrow_mut(&mut registry.relations, trader);
            vector::push_back(relations, relation);
        } else {
            let mut relations = vector::empty<CopyRelation>();
            vector::push_back(&mut relations, relation);
            table::add(&mut registry.relations, trader, relations);
        }
    }

    /// Deactivate a copy relation
    public entry fun deactivate_copy_relation(
        registry: &mut CopyRelationRegistry,
        trader: address,
        ctx: &TxContext
    ) {
        let follower = tx_context::sender(ctx);
        assert!(table::contains(&registry.relations, trader), ECopyRelationNotFound);

        let relations = table::borrow_mut(&mut registry.relations, trader);
        let len = vector::length(relations);
        let mut i = 0;
        let mut found = false;

        while (i < len) {
            let relation = vector::borrow_mut(relations, i);
            if (relation.follower == follower && relation.is_active) {
                relation.is_active = false;
                found = true;
                break
            };
            i = i + 1;
        };

        assert!(found, ECopyRelationNotFound);
    }

    /// Update copy ratio for an existing relation
    public entry fun update_copy_relation(
        registry: &mut CopyRelationRegistry,
        trader: address,
        new_copy_ratio: u64,
        new_max_position_size: u64,
        ctx: &TxContext
    ) {
        let follower = tx_context::sender(ctx);
        assert!(new_copy_ratio > 0, EZeroCopyRatio);
        assert!(new_copy_ratio <= 10000, EInvalidCopyRatio);
        assert!(table::contains(&registry.relations, trader), ECopyRelationNotFound);

        let relations = table::borrow_mut(&mut registry.relations, trader);
        let len = vector::length(relations);
        let mut i = 0;
        let mut found = false;

        while (i < len) {
            let relation = vector::borrow_mut(relations, i);
            if (relation.follower == follower && relation.is_active) {
                relation.copy_ratio = new_copy_ratio;
                relation.max_position_size = new_max_position_size;
                found = true;
                break
            };
            i = i + 1;
        };

        assert!(found, ECopyRelationNotFound);
    }

    /// Execute copy trade for a single follower
    /// Called by backend indexer after detecting PositionOpened event
    public fun execute_copy_trade<T>(
        registry: &CopyRelationRegistry,
        original_position_id: ID,
        trader: address,
        follower_vault: &mut Vault<T>,
        trading_pair: vector<u8>,
        position_type: u8,
        entry_price: u64,
        trader_quantity: u64,
        leverage: u8,
        copy_ratio: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Position<T> {
        // Verify copy relation exists in registry
        assert!(table::contains(&registry.relations, trader), ECopyRelationNotFound);

        let relations = table::borrow(&registry.relations, trader);
        let follower_address = tx_context::sender(ctx);
        let mut relation_valid = false;
        let len = vector::length(relations);
        let mut i = 0;

        while (i < len) {
            let relation = vector::borrow(relations, i);
            if (relation.follower == follower_address && relation.is_active) {
                relation_valid = true;
                break
            };
            i = i + 1;
        };

        assert!(relation_valid, EInactiveCopyRelation);

        // Calculate follower position size
        let follower_quantity = (trader_quantity * copy_ratio) / 10000;
        let follower_margin = (follower_quantity * entry_price) / ((leverage as u64) * 1000000);
        // Ensure minimum margin
        let follower_margin = if (follower_margin < 1000000) { 1000000 } else { follower_margin };

        // Open position for follower
        let mut follower_position = position::open_position(
            follower_vault,
            trading_pair,
            position_type,
            entry_price,
            follower_quantity,
            leverage,
            follower_margin,
            clock,
            ctx
        );

        // Mark as copy trade
        position::mark_as_copy_trade(&mut follower_position, original_position_id);

        let follower_position_id = object::id(&follower_position);
        let timestamp = sui::clock::timestamp_ms(clock);

        // Emit copy trade event
        events::emit_copy_trade_executed(
            original_position_id,
            follower_position_id,
            trader,
            follower_address,
            copy_ratio,
            timestamp,
        );

        follower_position
    }

    /// Entry function for executing copy trade (single)
    public entry fun execute_copy_trade_entry<T>(
        registry: &CopyRelationRegistry,
        original_position_id: ID,
        trader: address,
        follower_vault: &mut Vault<T>,
        trading_pair: vector<u8>,
        position_type: u8,
        entry_price: u64,
        trader_quantity: u64,
        leverage: u8,
        copy_ratio: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let position = execute_copy_trade(
            registry,
            original_position_id,
            trader,
            follower_vault,
            trading_pair,
            position_type,
            entry_price,
            trader_quantity,
            leverage,
            copy_ratio,
            clock,
            ctx
        );
        transfer::public_transfer(position, tx_context::sender(ctx));
    }

    /// Batch execute copy trades for ALL active followers of a trader
    /// Gas optimization: single PTB processes multiple followers
    /// Returns the count of successful copy trades
    public fun batch_execute_copy_trades<T>(
        registry: &CopyRelationRegistry,
        original_position_id: ID,
        trader: address,
        follower_vaults: &mut vector<Vault<T>>,
        trading_pair: vector<u8>,
        position_type: u8,
        entry_price: u64,
        trader_quantity: u64,
        leverage: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ): vector<Position<T>> {
        assert!(table::contains(&registry.relations, trader), ECopyRelationNotFound);

        let relations = table::borrow(&registry.relations, trader);
        let relations_len = vector::length(relations);
        let vaults_len = vector::length(follower_vaults);
        let mut positions = vector::empty<Position<T>>();
        let mut executed_count: u64 = 0;

        let mut i = 0;
        let mut vault_idx = 0;

        while (i < relations_len && vault_idx < vaults_len) {
            let relation = vector::borrow(relations, i);

            if (relation.is_active) {
                let vault = vector::borrow_mut(follower_vaults, vault_idx);

                // Calculate follower position size based on copy ratio
                let follower_quantity = (trader_quantity * relation.copy_ratio) / 10000;

                // Cap at max_position_size if set
                let follower_quantity = if (relation.max_position_size > 0 && follower_quantity > relation.max_position_size) {
                    relation.max_position_size
                } else {
                    follower_quantity
                };

                if (follower_quantity > 0) {
                    let follower_margin = (follower_quantity * entry_price) / ((leverage as u64) * 1000000);
                    let follower_margin = if (follower_margin < 1000000) { 1000000 } else { follower_margin };

                    // Check vault has sufficient liquidity before attempting
                    if (vault::available_liquidity(vault) >= follower_margin) {
                        let mut follower_position = position::open_position(
                            vault,
                            trading_pair,
                            position_type,
                            entry_price,
                            follower_quantity,
                            leverage,
                            follower_margin,
                            clock,
                            ctx
                        );

                        position::mark_as_copy_trade(&mut follower_position, original_position_id);

                        let follower_position_id = object::id(&follower_position);
                        let timestamp = sui::clock::timestamp_ms(clock);

                        events::emit_copy_trade_executed(
                            original_position_id,
                            follower_position_id,
                            trader,
                            relation.follower,
                            relation.copy_ratio,
                            timestamp,
                        );

                        vector::push_back(&mut positions, follower_position);
                        executed_count = executed_count + 1;
                    };
                };

                vault_idx = vault_idx + 1;
            };

            i = i + 1;
        };

        // Emit batch summary event
        if (executed_count > 0) {
            let timestamp = sui::clock::timestamp_ms(clock);
            events::emit_batch_copy_trade_executed(
                original_position_id,
                trader,
                executed_count,
                timestamp,
            );
        };

        positions
    }

    /// Get active copy relations for a trader
    public fun get_copy_relations(
        registry: &CopyRelationRegistry,
        trader: address
    ): vector<CopyRelation> {
        if (table::contains(&registry.relations, trader)) {
            let relations = table::borrow(&registry.relations, trader);
            let mut active_relations = vector::empty<CopyRelation>();
            let len = vector::length(relations);
            let mut i = 0;

            while (i < len) {
                let relation = vector::borrow(relations, i);
                if (relation.is_active) {
                    vector::push_back(&mut active_relations, *relation);
                };
                i = i + 1;
            };

            active_relations
        } else {
            vector::empty<CopyRelation>()
        }
    }

    /// Get follower count for a trader
    public fun get_active_follower_count(
        registry: &CopyRelationRegistry,
        trader: address
    ): u64 {
        if (!table::contains(&registry.relations, trader)) return 0;

        let relations = table::borrow(&registry.relations, trader);
        let len = vector::length(relations);
        let mut count: u64 = 0;
        let mut i = 0;

        while (i < len) {
            let relation = vector::borrow(relations, i);
            if (relation.is_active) {
                count = count + 1;
            };
            i = i + 1;
        };

        count
    }

    // Getter functions for CopyRelation
    public fun relation_trader(relation: &CopyRelation): address { relation.trader }
    public fun relation_follower(relation: &CopyRelation): address { relation.follower }
    public fun relation_copy_ratio(relation: &CopyRelation): u64 { relation.copy_ratio }
    public fun relation_max_position_size(relation: &CopyRelation): u64 { relation.max_position_size }
    public fun relation_is_active(relation: &CopyRelation): bool { relation.is_active }
}
