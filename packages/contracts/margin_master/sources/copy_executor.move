/// MarginMaster - Copy Executor Module
///
/// Executes copy trades when a trader opens a position.
/// Manages copy ratios and creates follower positions.

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
        copy_ratio: u64,        // Basis points (0-10000), e.g., 5000 = 50%
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

        if (table::contains(&registry.relations, trader)) {
            let relations = table::borrow_mut(&mut registry.relations, trader);
            let len = vector::length(relations);
            let mut i = 0;

            while (i < len) {
                let relation = vector::borrow_mut(relations, i);
                if (relation.follower == follower) {
                    relation.is_active = false;
                    break
                };
                i = i + 1;
            }
        }
    }

    /// Execute copy trade for a follower
    /// This is called by the backend indexer after detecting a PositionOpened event
    public fun execute_copy_trade<T>(
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
        // Calculate follower position size
        let follower_quantity = (trader_quantity * copy_ratio) / 10000;
        let follower_margin = (follower_quantity * entry_price) / (leverage as u64);

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
        let follower_address = tx_context::sender(ctx);
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

    /// Entry function for executing copy trade
    public entry fun execute_copy_trade_entry<T>(
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
}
