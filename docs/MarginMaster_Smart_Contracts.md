# MarginMaster - 智能合約設計

> **版本:** 2.0
> **日期:** 2026-02-02
> **狀態:** Ready for Implementation
> **語言:** Sui Move

---

## 📋 目錄

1. [合約概覽](#合約概覽)
2. [模組架構](#模組架構)
3. [核心模組實現](#核心模組實現)
4. [安全性設計](#安全性設計)
5. [Gas 優化](#gas-優化)
6. [測試策略](#測試策略)
7. [部署指南](#部署指南)

---

## 合約概覽

### Package 結構

```
margin_master/
├── Move.toml
├── sources/
│   ├── copy_trade.move          # 跟單管理模組
│   ├── trader_profile.move      # 交易者檔案模組
│   ├── fee_manager.move         # 費用分配模組
│   ├── risk_checker.move        # 風險檢查模組
│   ├── emergency_pause.move     # 緊急暫停模組
│   ├── user_registry.move       # 用戶註冊模組
│   └── auto_trigger.move        # 自動觸發器模組 (Phase 2)
└── tests/
    ├── copy_trade_tests.move
    ├── trader_profile_tests.move
    └── integration_tests.move
```

### Move.toml 配置

```toml
[package]
name = "margin_master"
version = "1.0.0"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }
DeepBook = { git = "https://github.com/DeepBook/deepbook.git", subdir = "packages/deepbook", rev = "main" }

[addresses]
margin_master = "0x0"
sui = "0x2"
deepbook = "0xdee9"
```

---

## 模組架構

### 模組依賴關係

```
                  ┌─────────────────┐
                  │  copy_trade     │
                  │  (核心模組)      │
                  └─────────────────┘
                          ↓
         ┌────────────────┼────────────────┐
         ↓                ↓                ↓
┌────────────────┐ ┌────────────┐ ┌────────────┐
│trader_profile  │ │fee_manager │ │risk_checker│
└────────────────┘ └────────────┘ └────────────┘
         ↓                ↓                ↓
         └────────────────┼────────────────┘
                          ↓
                  ┌────────────┐
                  │user_registry│
                  └────────────┘
                          ↓
                  ┌────────────────┐
                  │emergency_pause │
                  └────────────────┘
```

### 數據結構關係

```
User (user_registry)
    ↓
TraderProfile (trader_profile)
    ↓
CopyTradeRelation (copy_trade)
    ↓
CopyTradeExecution (記錄)
```

---

## 核心模組實現

### 1. copy_trade.move (跟單管理模組)

```move
// sources/copy_trade.move

module margin_master::copy_trade {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use std::option::{Self, Option};

    use margin_master::trader_profile::{Self, TraderProfile};
    use margin_master::fee_manager;
    use margin_master::risk_checker;
    use margin_master::emergency_pause::{Self, EmergencyPause};

    // ==================== 錯誤碼 ====================

    const E_UNAUTHORIZED: u64 = 1;
    const E_INVALID_COPY_RATIO: u64 = 2;
    const E_INVALID_FEE_RATE: u64 = 3;
    const E_RELATION_ALREADY_EXISTS: u64 = 4;
    const E_RELATION_NOT_FOUND: u64 = 5;
    const E_RISK_TOO_HIGH: u64 = 6;
    const E_INSUFFICIENT_BALANCE: u64 = 7;
    const E_SYSTEM_PAUSED: u64 = 8;
    const E_INVALID_QUANTITY: u64 = 9;
    const E_LEADER_SAME_AS_FOLLOWER: u64 = 10;

    // ==================== 常數 ====================

    const MIN_RISK_RATIO_BPS: u64 = 12000;     // 1.2x (120%)
    const MAX_COPY_RATIO_BPS: u64 = 10000;     // 100%
    const MAX_FEE_RATE_BPS: u64 = 1000;        // 10%
    const BPS_DENOMINATOR: u64 = 10000;
    const MIN_COPY_QUANTITY: u64 = 1000;       // 最小跟單數量

    // ==================== 數據結構 ====================

    /// 跟單關係
    struct CopyTradeRelation has key, store {
        id: UID,
        leader: address,
        follower: address,
        copy_ratio: u64,            // Basis points (0-10000)
        max_position_size: u64,     // 單筆最大倉位
        fee_rate: u64,              // Basis points
        is_active: bool,
        created_at: u64,
        total_copied_trades: u64,
        total_fees_paid: u64,
        last_copy_at: u64,
    }

    /// 跟單關係註冊表（全局共享對象）
    struct CopyTradeRegistry has key {
        id: UID,
        // leader => vector<follower addresses>
        leader_to_followers: Table<address, vector<address>>,
        // follower => vector<leader addresses>
        follower_to_leaders: Table<address, vector<address>>,
        total_relations: u64,
        total_active_relations: u64,
    }

    /// 費用配置（全局共享對象）
    struct FeeConfig has key {
        id: UID,
        protocol_fee_rate: u64,      // Protocol 抽成 (basis points)
        treasury: address,           // Protocol treasury 地址
        total_fees_collected: u64,   // 累計收取的費用
    }

    // ==================== 事件 ====================

    /// Leader 交易信號事件
    struct LeaderTradeSignal has copy, drop {
        leader: address,
        pool_id: ID,
        side: bool,                  // true = BUY, false = SELL
        order_type: u8,              // 0 = MARKET, 1 = LIMIT
        price: Option<u64>,
        quantity: u64,
        leverage: u8,
        timestamp: u64,
        tx_digest: vector<u8>,       // 交易哈希
    }

    /// 跟單執行事件
    struct CopyTradeExecuted has copy, drop {
        leader: address,
        follower: address,
        original_quantity: u64,
        copied_quantity: u64,
        copy_ratio: u64,
        fee_paid: u64,
        success: bool,
        timestamp: u64,
    }

    /// 跟單失敗事件
    struct CopyTradeFailed has copy, drop {
        leader: address,
        follower: address,
        reason: u8,                  // 1=RiskTooHigh, 2=InsufficientBalance, 3=Other
        timestamp: u64,
    }

    /// 跟單關係創建事件
    struct CopyRelationCreated has copy, drop {
        leader: address,
        follower: address,
        copy_ratio: u64,
        max_position_size: u64,
        fee_rate: u64,
        timestamp: u64,
    }

    /// 跟單關係更新事件
    struct CopyRelationUpdated has copy, drop {
        leader: address,
        follower: address,
        new_copy_ratio: u64,
        new_max_position_size: u64,
        new_fee_rate: u64,
        timestamp: u64,
    }

    /// 跟單關係停止事件
    struct CopyRelationStopped has copy, drop {
        leader: address,
        follower: address,
        total_trades_copied: u64,
        total_fees_paid: u64,
        timestamp: u64,
    }

    // ==================== 初始化 ====================

    /// 模組初始化函數（僅在部署時調用一次）
    fun init(ctx: &mut TxContext) {
        // 創建全局註冊表
        let registry = CopyTradeRegistry {
            id: object::new(ctx),
            leader_to_followers: table::new(ctx),
            follower_to_leaders: table::new(ctx),
            total_relations: 0,
            total_active_relations: 0,
        };
        transfer::share_object(registry);

        // 創建費用配置
        let fee_config = FeeConfig {
            id: object::new(ctx),
            protocol_fee_rate: 500,     // 5%
            treasury: tx_context::sender(ctx),
            total_fees_collected: 0,
        };
        transfer::share_object(fee_config);
    }

    // ==================== 核心功能 ====================

    /// 創建跟單關係
    public entry fun create_copy_relation(
        registry: &mut CopyTradeRegistry,
        pause: &EmergencyPause,
        leader: address,
        copy_ratio: u64,
        max_position_size: u64,
        fee_rate: u64,
        ctx: &mut TxContext
    ) {
        // 檢查系統是否暫停
        emergency_pause::assert_not_paused(pause);

        let follower = tx_context::sender(ctx);

        // 參數驗證
        assert!(copy_ratio > 0 && copy_ratio <= MAX_COPY_RATIO_BPS, E_INVALID_COPY_RATIO);
        assert!(fee_rate <= MAX_FEE_RATE_BPS, E_INVALID_FEE_RATE);
        assert!(leader != follower, E_LEADER_SAME_AS_FOLLOWER);
        assert!(max_position_size > 0, E_INVALID_QUANTITY);

        // 檢查是否已存在關係
        if (table::contains(&registry.leader_to_followers, leader)) {
            let followers = table::borrow(&registry.leader_to_followers, leader);
            assert!(!vector::contains(followers, &follower), E_RELATION_ALREADY_EXISTS);
        };

        // 創建關係對象
        let relation = CopyTradeRelation {
            id: object::new(ctx),
            leader,
            follower,
            copy_ratio,
            max_position_size,
            fee_rate,
            is_active: true,
            created_at: tx_context::epoch(ctx),
            total_copied_trades: 0,
            total_fees_paid: 0,
            last_copy_at: 0,
        };

        // 更新註冊表
        update_registry_on_create(registry, leader, follower);

        // 發出事件
        event::emit(CopyRelationCreated {
            leader,
            follower,
            copy_ratio,
            max_position_size,
            fee_rate,
            timestamp: tx_context::epoch(ctx),
        });

        // 轉移關係對象給 follower
        transfer::transfer(relation, follower);
    }

    /// 更新跟單關係參數
    public entry fun update_copy_relation(
        relation: &mut CopyTradeRelation,
        new_copy_ratio: u64,
        new_max_position_size: u64,
        new_fee_rate: u64,
        ctx: &mut TxContext
    ) {
        // 權限檢查
        assert!(relation.follower == tx_context::sender(ctx), E_UNAUTHORIZED);
        assert!(relation.is_active, E_RELATION_NOT_FOUND);

        // 參數驗證
        assert!(new_copy_ratio > 0 && new_copy_ratio <= MAX_COPY_RATIO_BPS, E_INVALID_COPY_RATIO);
        assert!(new_fee_rate <= MAX_FEE_RATE_BPS, E_INVALID_FEE_RATE);
        assert!(new_max_position_size > 0, E_INVALID_QUANTITY);

        // 更新參數
        relation.copy_ratio = new_copy_ratio;
        relation.max_position_size = new_max_position_size;
        relation.fee_rate = new_fee_rate;

        // 發出事件
        event::emit(CopyRelationUpdated {
            leader: relation.leader,
            follower: relation.follower,
            new_copy_ratio,
            new_max_position_size,
            new_fee_rate,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// 停止跟單關係
    public entry fun stop_copy_relation(
        registry: &mut CopyTradeRegistry,
        relation: CopyTradeRelation,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // 權限檢查（follower 或 leader 都可以停止）
        assert!(
            relation.follower == sender || relation.leader == sender,
            E_UNAUTHORIZED
        );

        // 更新註冊表
        update_registry_on_stop(registry, relation.leader, relation.follower);

        // 發出事件
        event::emit(CopyRelationStopped {
            leader: relation.leader,
            follower: relation.follower,
            total_trades_copied: relation.total_copied_trades,
            total_fees_paid: relation.total_fees_paid,
            timestamp: tx_context::epoch(ctx),
        });

        // 銷毀關係對象
        let CopyTradeRelation {
            id,
            leader: _,
            follower: _,
            copy_ratio: _,
            max_position_size: _,
            fee_rate: _,
            is_active: _,
            created_at: _,
            total_copied_trades: _,
            total_fees_paid: _,
            last_copy_at: _,
        } = relation;
        object::delete(id);
    }

    /// Leader 發出交易信號（由前端/後端調用）
    public entry fun emit_leader_trade_signal(
        profile: &mut TraderProfile,
        pool_id: ID,
        side: bool,
        order_type: u8,
        price: Option<u64>,
        quantity: u64,
        leverage: u8,
        tx_digest: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // 權限檢查
        assert!(trader_profile::get_trader(profile) == sender, E_UNAUTHORIZED);

        // 參數驗證
        assert!(quantity > 0, E_INVALID_QUANTITY);
        assert!(leverage >= 1 && leverage <= 10, E_INVALID_COPY_RATIO);

        // 更新交易者統計
        trader_profile::increment_total_trades(profile);

        // 發出事件（後端監聽此事件以執行跟單）
        event::emit(LeaderTradeSignal {
            leader: sender,
            pool_id,
            side,
            order_type,
            price,
            quantity,
            leverage,
            timestamp: tx_context::epoch(ctx),
            tx_digest,
        });
    }

    /// 記錄跟單執行（由後端服務調用）
    /// 注意：實際的 DeepBook 交易在此函數外部執行
    public entry fun record_copy_trade_execution(
        relation: &mut CopyTradeRelation,
        leader_profile: &mut TraderProfile,
        fee_config: &mut FeeConfig,
        fee_payment: Coin<SUI>,
        original_quantity: u64,
        copied_quantity: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // 權限檢查
        assert!(relation.follower == sender, E_UNAUTHORIZED);
        assert!(relation.is_active, E_RELATION_NOT_FOUND);

        // 計算費用分配
        let total_fee = coin::value(&fee_payment);
        let (protocol_fee, leader_fee) = fee_manager::calculate_fee_split(
            total_fee,
            fee_config.protocol_fee_rate
        );

        // 分配費用
        let protocol_coin = coin::split(&mut fee_payment, protocol_fee, ctx);
        transfer::public_transfer(protocol_coin, fee_config.treasury);
        transfer::public_transfer(fee_payment, relation.leader);

        // 更新統計
        relation.total_copied_trades = relation.total_copied_trades + 1;
        relation.total_fees_paid = relation.total_fees_paid + total_fee;
        relation.last_copy_at = tx_context::epoch(ctx);

        trader_profile::add_fees_earned(leader_profile, leader_fee);
        fee_config.total_fees_collected = fee_config.total_fees_collected + protocol_fee;

        // 發出事件
        event::emit(CopyTradeExecuted {
            leader: relation.leader,
            follower: relation.follower,
            original_quantity,
            copied_quantity,
            copy_ratio: relation.copy_ratio,
            fee_paid: total_fee,
            success: true,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// 記錄跟單失敗
    public entry fun record_copy_trade_failed(
        leader: address,
        follower: address,
        reason: u8,
        ctx: &mut TxContext
    ) {
        // 發出失敗事件（供後端分析）
        event::emit(CopyTradeFailed {
            leader,
            follower,
            reason,
            timestamp: tx_context::epoch(ctx),
        });
    }

    // ==================== 輔助函數 ====================

    /// 計算跟單規模
    public fun calculate_copy_size(
        leader_quantity: u64,
        copy_ratio: u64,
        max_position_size: u64
    ): u64 {
        let calculated_size = (leader_quantity * copy_ratio) / BPS_DENOMINATOR;

        // 應用最大倉位限制
        if (calculated_size > max_position_size) {
            max_position_size
        } else if (calculated_size < MIN_COPY_QUANTITY) {
            0  // 太小則不跟單
        } else {
            calculated_size
        }
    }

    /// 檢查風險是否可接受
    public fun is_risk_acceptable(risk_ratio_bps: u64): bool {
        risk_ratio_bps >= MIN_RISK_RATIO_BPS
    }

    /// 計算跟單費用
    public fun calculate_copy_fee(
        position_value: u64,
        fee_rate: u64
    ): u64 {
        (position_value * fee_rate) / BPS_DENOMINATOR
    }

    // ==================== 內部函數 ====================

    /// 創建關係時更新註冊表
    fun update_registry_on_create(
        registry: &mut CopyTradeRegistry,
        leader: address,
        follower: address
    ) {
        // 更新 leader_to_followers
        if (!table::contains(&registry.leader_to_followers, leader)) {
            table::add(&mut registry.leader_to_followers, leader, vector::empty<address>());
        };
        let followers = table::borrow_mut(&mut registry.leader_to_followers, leader);
        vector::push_back(followers, follower);

        // 更新 follower_to_leaders
        if (!table::contains(&registry.follower_to_leaders, follower)) {
            table::add(&mut registry.follower_to_leaders, follower, vector::empty<address>());
        };
        let leaders = table::borrow_mut(&mut registry.follower_to_leaders, follower);
        vector::push_back(leaders, leader);

        // 更新計數
        registry.total_relations = registry.total_relations + 1;
        registry.total_active_relations = registry.total_active_relations + 1;
    }

    /// 停止關係時更新註冊表
    fun update_registry_on_stop(
        registry: &mut CopyTradeRegistry,
        leader: address,
        follower: address
    ) {
        // 從 leader_to_followers 移除
        if (table::contains(&registry.leader_to_followers, leader)) {
            let followers = table::borrow_mut(&mut registry.leader_to_followers, leader);
            let (found, index) = vector::index_of(followers, &follower);
            if (found) {
                vector::remove(followers, index);
            };
        };

        // 從 follower_to_leaders 移除
        if (table::contains(&registry.follower_to_leaders, follower)) {
            let leaders = table::borrow_mut(&mut registry.follower_to_leaders, follower);
            let (found, index) = vector::index_of(leaders, &leader);
            if (found) {
                vector::remove(leaders, index);
            };
        };

        // 更新計數
        registry.total_active_relations = registry.total_active_relations - 1;
    }

    // ==================== 查詢函數（View Functions）====================

    /// 獲取 Leader 的 Followers 列表
    public fun get_followers(
        registry: &CopyTradeRegistry,
        leader: address
    ): vector<address> {
        if (table::contains(&registry.leader_to_followers, leader)) {
            *table::borrow(&registry.leader_to_followers, leader)
        } else {
            vector::empty<address>()
        }
    }

    /// 獲取 Follower 跟隨的 Leaders 列表
    public fun get_leaders(
        registry: &CopyTradeRegistry,
        follower: address
    ): vector<address> {
        if (table::contains(&registry.follower_to_leaders, follower)) {
            *table::borrow(&registry.follower_to_leaders, follower)
        } else {
            vector::empty<address>()
        }
    }

    /// 檢查跟單關係是否活躍
    public fun is_relation_active(relation: &CopyTradeRelation): bool {
        relation.is_active
    }

    /// 獲取關係詳情
    public fun get_relation_info(relation: &CopyTradeRelation): (
        address,  // leader
        address,  // follower
        u64,      // copy_ratio
        u64,      // max_position_size
        u64,      // fee_rate
        bool,     // is_active
        u64,      // total_copied_trades
        u64       // total_fees_paid
    ) {
        (
            relation.leader,
            relation.follower,
            relation.copy_ratio,
            relation.max_position_size,
            relation.fee_rate,
            relation.is_active,
            relation.total_copied_trades,
            relation.total_fees_paid
        )
    }

    // ==================== 管理員功能 ====================

    /// 更新協議費率（僅管理員）
    public entry fun update_protocol_fee_rate(
        fee_config: &mut FeeConfig,
        new_rate: u64,
        ctx: &mut TxContext
    ) {
        // 實際需添加管理員權限檢查（使用 Capability 模式）
        assert!(new_rate <= MAX_FEE_RATE_BPS, E_INVALID_FEE_RATE);
        fee_config.protocol_fee_rate = new_rate;
    }

    /// 更新 Treasury 地址（僅管理員）
    public entry fun update_treasury(
        fee_config: &mut FeeConfig,
        new_treasury: address,
        ctx: &mut TxContext
    ) {
        // 實際需添加管理員權限檢查
        fee_config.treasury = new_treasury;
    }

    // ==================== 測試輔助函數 ====================

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun get_min_risk_ratio(): u64 {
        MIN_RISK_RATIO_BPS
    }
}
```

### 2. trader_profile.move (交易者檔案模組)

```move
// sources/trader_profile.move

module margin_master::trader_profile {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    // ==================== 錯誤碼 ====================

    const E_UNAUTHORIZED: u64 = 1;
    const E_PROFILE_ALREADY_EXISTS: u64 = 2;
    const E_INVALID_TIER: u64 = 3;

    // ==================== 常數 ====================

    const TIER_NONE: u8 = 0;
    const TIER_BRONZE: u8 = 1;
    const TIER_SILVER: u8 = 2;
    const TIER_GOLD: u8 = 3;
    const TIER_PLATINUM: u8 = 4;

    // ==================== 數據結構 ====================

    /// 交易者檔案
    struct TraderProfile has key {
        id: UID,
        trader: address,

        // 統計數據
        total_followers: u64,
        total_pnl: i64,              // 總盈虧（可為負）
        win_rate: u64,               // 勝率 (basis points)
        max_drawdown: u64,           // 最大回撤 (basis points)
        total_trades: u64,
        winning_trades: u64,
        losing_trades: u64,
        active_positions: u64,
        total_fees_earned: u64,

        // 認證與等級
        is_verified: bool,
        tier: u8,                    // 0=None, 1=Bronze, 2=Silver, 3=Gold, 4=Platinum

        // 時間戳
        created_at: u64,
        last_trade_at: u64,
    }

    // ==================== 事件 ====================

    struct ProfileCreated has copy, drop {
        trader: address,
        timestamp: u64,
    }

    struct ProfileVerified has copy, drop {
        trader: address,
        tier: u8,
        timestamp: u64,
    }

    struct StatsUpdated has copy, drop {
        trader: address,
        total_trades: u64,
        win_rate: u64,
        total_pnl: i64,
        timestamp: u64,
    }

    // ==================== 核心功能 ====================

    /// 創建交易者檔案
    public entry fun create_profile(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);

        let profile = TraderProfile {
            id: object::new(ctx),
            trader: sender,
            total_followers: 0,
            total_pnl: 0,
            win_rate: 0,
            max_drawdown: 0,
            total_trades: 0,
            winning_trades: 0,
            losing_trades: 0,
            active_positions: 0,
            total_fees_earned: 0,
            is_verified: false,
            tier: TIER_NONE,
            created_at: tx_context::epoch(ctx),
            last_trade_at: 0,
        };

        event::emit(ProfileCreated {
            trader: sender,
            timestamp: tx_context::epoch(ctx),
        });

        transfer::transfer(profile, sender);
    }

    /// 更新統計數據（由後端或合約調用）
    public fun update_stats(
        profile: &mut TraderProfile,
        pnl: i64,
        is_winning_trade: bool,
        ctx: &mut TxContext
    ) {
        // 更新盈虧
        profile.total_pnl = profile.total_pnl + pnl;

        // 更新勝敗統計
        if (is_winning_trade) {
            profile.winning_trades = profile.winning_trades + 1;
        } else {
            profile.losing_trades = profile.losing_trades + 1;
        };

        // 更新勝率
        if (profile.total_trades > 0) {
            profile.win_rate = (profile.winning_trades * 10000) / profile.total_trades;
        };

        profile.last_trade_at = tx_context::epoch(ctx);

        event::emit(StatsUpdated {
            trader: profile.trader,
            total_trades: profile.total_trades,
            win_rate: profile.win_rate,
            total_pnl: profile.total_pnl,
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// 增加交易計數
    public fun increment_total_trades(profile: &mut TraderProfile) {
        profile.total_trades = profile.total_trades + 1;
    }

    /// 增加活躍倉位
    public fun increment_active_positions(profile: &mut TraderProfile) {
        profile.active_positions = profile.active_positions + 1;
    }

    /// 減少活躍倉位
    public fun decrement_active_positions(profile: &mut TraderProfile) {
        if (profile.active_positions > 0) {
            profile.active_positions = profile.active_positions - 1;
        };
    }

    /// 增加跟隨者數量
    public fun increment_followers(profile: &mut TraderProfile) {
        profile.total_followers = profile.total_followers + 1;
    }

    /// 減少跟隨者數量
    public fun decrement_followers(profile: &mut TraderProfile) {
        if (profile.total_followers > 0) {
            profile.total_followers = profile.total_followers - 1;
        };
    }

    /// 增加費用收入
    public fun add_fees_earned(profile: &mut TraderProfile, amount: u64) {
        profile.total_fees_earned = profile.total_fees_earned + amount;
    }

    // ==================== 管理員功能 ====================

    /// 驗證交易者並設置等級（僅管理員）
    public entry fun verify_trader(
        profile: &mut TraderProfile,
        tier: u8,
        ctx: &mut TxContext
    ) {
        // 實際需添加管理員權限檢查
        assert!(tier <= TIER_PLATINUM, E_INVALID_TIER);

        profile.is_verified = true;
        profile.tier = tier;

        event::emit(ProfileVerified {
            trader: profile.trader,
            tier,
            timestamp: tx_context::epoch(ctx),
        });
    }

    // ==================== 查詢函數 ====================

    public fun get_trader(profile: &TraderProfile): address {
        profile.trader
    }

    public fun get_total_followers(profile: &TraderProfile): u64 {
        profile.total_followers
    }

    public fun get_total_pnl(profile: &TraderProfile): i64 {
        profile.total_pnl
    }

    public fun get_win_rate(profile: &TraderProfile): u64 {
        profile.win_rate
    }

    public fun get_total_trades(profile: &TraderProfile): u64 {
        profile.total_trades
    }

    public fun is_verified(profile: &TraderProfile): bool {
        profile.is_verified
    }

    public fun get_tier(profile: &TraderProfile): u8 {
        profile.tier
    }

    // ==================== 測試輔助函數 ====================

    #[test_only]
    public fun create_profile_for_testing(ctx: &mut TxContext): TraderProfile {
        TraderProfile {
            id: object::new(ctx),
            trader: tx_context::sender(ctx),
            total_followers: 0,
            total_pnl: 0,
            win_rate: 0,
            max_drawdown: 0,
            total_trades: 0,
            winning_trades: 0,
            losing_trades: 0,
            active_positions: 0,
            total_fees_earned: 0,
            is_verified: false,
            tier: TIER_NONE,
            created_at: tx_context::epoch(ctx),
            last_trade_at: 0,
        }
    }
}
```

### 3. fee_manager.move (費用分配模組)

```move
// sources/fee_manager.move

module margin_master::fee_manager {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::tx_context::TxContext;

    // ==================== 常數 ====================

    const BPS_DENOMINATOR: u64 = 10000;

    // ==================== 核心功能 ====================

    /// 計算費用分配
    /// 返回：(protocol_fee, leader_fee)
    public fun calculate_fee_split(
        total_fee: u64,
        protocol_fee_rate: u64
    ): (u64, u64) {
        let protocol_fee = (total_fee * protocol_fee_rate) / BPS_DENOMINATOR;
        let leader_fee = total_fee - protocol_fee;
        (protocol_fee, leader_fee)
    }

    /// 計算跟單費用
    public fun calculate_copy_fee(
        position_value: u64,
        fee_rate: u64
    ): u64 {
        (position_value * fee_rate) / BPS_DENOMINATOR
    }

    /// 分配費用到多個接收者
    public fun split_and_transfer(
        coin: &mut Coin<SUI>,
        amounts: vector<u64>,
        recipients: vector<address>,
        ctx: &mut TxContext
    ) {
        let len = vector::length(&amounts);
        assert!(len == vector::length(&recipients), 0);

        let i = 0;
        while (i < len) {
            let amount = *vector::borrow(&amounts, i);
            let recipient = *vector::borrow(&recipients, i);

            let split_coin = coin::split(coin, amount, ctx);
            transfer::public_transfer(split_coin, recipient);

            i = i + 1;
        };
    }
}
```

### 4. risk_checker.move (風險檢查模組)

```move
// sources/risk_checker.move

module margin_master::risk_checker {
    // ==================== 常數 ====================

    const MIN_RISK_RATIO_BPS: u64 = 12000;  // 1.2x
    const BPS_DENOMINATOR: u64 = 10000;

    // ==================== 核心功能 ====================

    /// 檢查風險比率是否可接受
    public fun is_risk_acceptable(risk_ratio_bps: u64): bool {
        risk_ratio_bps >= MIN_RISK_RATIO_BPS
    }

    /// 計算健康度評分 (0-100)
    public fun calculate_health_score(risk_ratio_bps: u64): u8 {
        if (risk_ratio_bps >= 20000) {        // >= 2.0
            100
        } else if (risk_ratio_bps >= 15000) { // >= 1.5
            80
        } else if (risk_ratio_bps >= 13000) { // >= 1.3
            60
        } else if (risk_ratio_bps >= 11500) { // >= 1.15
            30
        } else {
            10
        }
    }

    /// 計算清算價格（簡化版）
    public fun calculate_liquidation_price(
        base_balance: u64,
        quote_balance: u64,
        borrowed_base: u64,
        borrowed_quote: u64,
        liquidation_threshold_bps: u64
    ): u64 {
        // 清算閾值，例如 1.1 (11000 bps)
        let numerator = (borrowed_quote * liquidation_threshold_bps / BPS_DENOMINATOR) - quote_balance;
        let denominator = base_balance - (borrowed_base * liquidation_threshold_bps / BPS_DENOMINATOR);

        if (denominator == 0) {
            return 0  // 無效計算
        };

        numerator / denominator
    }
}
```

### 5. emergency_pause.move (緊急暫停模組)

```move
// sources/emergency_pause.move

module margin_master::emergency_pause {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    // ==================== 錯誤碼 ====================

    const E_SYSTEM_PAUSED: u64 = 1;
    const E_UNAUTHORIZED: u64 = 2;

    // ==================== 數據結構 ====================

    /// 緊急暫停控制
    struct EmergencyPause has key {
        id: UID,
        is_paused: bool,
        admin: address,
        paused_at: u64,
    }

    /// 管理員能力證明
    struct AdminCap has key, store {
        id: UID,
    }

    // ==================== 事件 ====================

    struct SystemPaused has copy, drop {
        admin: address,
        timestamp: u64,
    }

    struct SystemResumed has copy, drop {
        admin: address,
        timestamp: u64,
    }

    // ==================== 初始化 ====================

    fun init(ctx: &mut TxContext) {
        let pause = EmergencyPause {
            id: object::new(ctx),
            is_paused: false,
            admin: tx_context::sender(ctx),
            paused_at: 0,
        };
        transfer::share_object(pause);

        // 創建管理員能力並轉移給部署者
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ==================== 核心功能 ====================

    /// 暫停系統
    public entry fun pause(
        pause: &mut EmergencyPause,
        _admin_cap: &AdminCap,
        ctx: &mut TxContext
    ) {
        pause.is_paused = true;
        pause.paused_at = tx_context::epoch(ctx);

        event::emit(SystemPaused {
            admin: tx_context::sender(ctx),
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// 恢復系統
    public entry fun resume(
        pause: &mut EmergencyPause,
        _admin_cap: &AdminCap,
        ctx: &mut TxContext
    ) {
        pause.is_paused = false;

        event::emit(SystemResumed {
            admin: tx_context::sender(ctx),
            timestamp: tx_context::epoch(ctx),
        });
    }

    /// 斷言系統未暫停
    public fun assert_not_paused(pause: &EmergencyPause) {
        assert!(!pause.is_paused, E_SYSTEM_PAUSED);
    }

    /// 檢查是否暫停
    public fun is_paused(pause: &EmergencyPause): bool {
        pause.is_paused
    }

    // ==================== 測試輔助函數 ====================

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
```

---

## 安全性設計

### 1. 權限控制模式

**Capability Pattern（能力模式）**

```move
// 使用 Capability 而非地址檢查
struct AdminCap has key, store {
    id: UID,
}

public entry fun admin_function(
    _admin_cap: &AdminCap,  // 必須持有此能力
    // ...
) {
    // 執行管理員操作
}
```

**優勢**：
- ✅ 能力可轉移
- ✅ 能力可銷毀
- ✅ 更符合 Move 語言特性

### 2. 重入攻擊防護

**Move 語言特性**：
- ✅ 無法在函數執行過程中再次調用同一對象
- ✅ 對象所有權明確，無法被多個調用持有
- ✅ 無需額外的 Reentrancy Guard

### 3. 整數溢出防護

**使用 checked 算術**：
```move
// Move 默認檢查整數溢出
let result = a + b;  // 自動檢查溢出

// 如需顯式檢查
use std::u64;
let (result, overflow) = u64::overflowing_add(a, b);
assert!(!overflow, E_OVERFLOW);
```

### 4. 輸入驗證清單

```move
// ✅ 檢查數值範圍
assert!(copy_ratio > 0 && copy_ratio <= MAX_COPY_RATIO_BPS, E_INVALID_COPY_RATIO);

// ✅ 檢查地址有效性
assert!(leader != follower, E_LEADER_SAME_AS_FOLLOWER);

// ✅ 檢查對象狀態
assert!(relation.is_active, E_RELATION_NOT_FOUND);

// ✅ 檢查權限
assert!(relation.follower == tx_context::sender(ctx), E_UNAUTHORIZED);
```

---

## Gas 優化

### 1. 批量操作優化

**避免**：
```move
// ❌ 在單一交易中遍歷大量 followers
public entry fun broadcast_to_all_followers(
    followers: &vector<address>,
    // ...
) {
    let i = 0;
    while (i < vector::length(followers)) {
        // 處理每個 follower（高 gas）
        i = i + 1;
    };
}
```

**改進**：
```move
// ✅ 使用事件驅動，後端批次處理
public entry fun emit_trade_signal(
    // ...
) {
    event::emit(LeaderTradeSignal { ... });
}
```

### 2. 存儲優化

**使用緊湊的數據類型**：
```move
// ✅ 使用 u8 而非 u64
tier: u8,              // 0-4，只需 1 字節
order_type: u8,        // 0-1，只需 1 字節

// ✅ 使用 basis points 而非浮點數
copy_ratio: u64,       // 5000 表示 50%
```

### 3. Table vs Vector

**選擇原則**：
```move
// ✅ 固定大小或頻繁迭代 → Vector
active_positions: vector<Position>,

// ✅ 動態大小且隨機訪問 → Table
leader_to_followers: Table<address, vector<address>>,
```

---

## 測試策略

### 單元測試示例

```move
// tests/copy_trade_tests.move

#[test_only]
module margin_master::copy_trade_tests {
    use sui::test_scenario;
    use margin_master::copy_trade::{Self, CopyTradeRegistry};
    use margin_master::trader_profile::{Self, TraderProfile};
    use margin_master::emergency_pause::{Self, EmergencyPause};

    #[test]
    fun test_create_copy_relation() {
        let leader = @0xA;
        let follower = @0xB;

        let scenario_val = test_scenario::begin(follower);
        let scenario = &mut scenario_val;

        // 初始化模組
        {
            copy_trade::init_for_testing(test_scenario::ctx(scenario));
            emergency_pause::init_for_testing(test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, leader);
        {
            trader_profile::create_profile(test_scenario::ctx(scenario));
        };

        test_scenario::next_tx(scenario, follower);
        {
            let registry = test_scenario::take_shared<CopyTradeRegistry>(scenario);
            let pause = test_scenario::take_shared<EmergencyPause>(scenario);

            copy_trade::create_copy_relation(
                &mut registry,
                &pause,
                leader,
                5000,  // 50% copy ratio
                100000,
                500,   // 5% fee
                test_scenario::ctx(scenario)
            );

            test_scenario::return_shared(registry);
            test_scenario::return_shared(pause);
        };

        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_calculate_copy_size() {
        let leader_quantity = 10000;
        let copy_ratio = 5000;  // 50%
        let max_position = 3000;

        let result = copy_trade::calculate_copy_size(
            leader_quantity,
            copy_ratio,
            max_position
        );

        // 期望：10000 * 50% = 5000，但被 max_position 限制為 3000
        assert!(result == 3000, 0);
    }

    #[test]
    #[expected_failure(abort_code = copy_trade::E_UNAUTHORIZED)]
    fun test_unauthorized_stop_relation() {
        let leader = @0xA;
        let follower = @0xB;
        let unauthorized = @0xC;

        let scenario_val = test_scenario::begin(follower);
        let scenario = &mut scenario_val;

        // ... 創建關係 ...

        // 嘗試用未授權地址停止關係
        test_scenario::next_tx(scenario, unauthorized);
        {
            let registry = test_scenario::take_shared<CopyTradeRegistry>(scenario);
            let relation = test_scenario::take_from_sender<CopyTradeRelation>(scenario);

            copy_trade::stop_copy_relation(
                &mut registry,
                relation,
                test_scenario::ctx(scenario)
            );  // 應該失敗

            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario_val);
    }
}
```

---

## 部署指南

### 1. 本地測試網部署

```bash
# 1. 編譯合約
cd margin_master
sui move build

# 2. 測試合約
sui move test

# 3. 切換到測試網
sui client switch --env testnet

# 4. 發布合約
sui client publish --gas-budget 500000000

# 5. 記錄 Package ID
# 輸出：Published Objects:
#   PackageID: 0xabcd1234...
```

### 2. 環境變數配置

```bash
# .env
MARGIN_MASTER_PACKAGE_ID=0xabcd1234...
COPY_TRADE_REGISTRY_ID=0x...
FEE_CONFIG_ID=0x...
EMERGENCY_PAUSE_ID=0x...
ADMIN_CAP_ID=0x...
```

### 3. 升級策略

**不可變部署（Hackathon）**：
```bash
sui client publish --gas-budget 500000000
```

**可升級部署（生產環境）**：
```move
// 使用 UpgradeCap
struct UpgradeCap has key, store {
    id: UID,
    package_id: ID,
}
```

---

## 完整調用流程示例

### 創建並啟用跟單

```typescript
// Frontend/Backend 調用示例

import { TransactionBlock } from '@mysten/sui.js/transactions';

// 1. Leader 創建 TraderProfile
const tx1 = new TransactionBlock();
tx1.moveCall({
  target: `${PACKAGE_ID}::trader_profile::create_profile`,
});
await signAndExecute(tx1);

// 2. Follower 創建跟單關係
const tx2 = new TransactionBlock();
tx2.moveCall({
  target: `${PACKAGE_ID}::copy_trade::create_copy_relation`,
  arguments: [
    tx2.object(REGISTRY_ID),
    tx2.object(PAUSE_ID),
    tx2.pure(leaderAddress),
    tx2.pure(5000),      // 50% copy ratio
    tx2.pure(100000),    // max position
    tx2.pure(500),       // 5% fee
  ],
});
await signAndExecute(tx2);

// 3. Leader 執行交易並發出信號
const tx3 = new TransactionBlock();

// 3a. 執行 DeepBook Margin 交易
tx3.moveCall({
  target: `${DEEPBOOK_PKG}::pool_proxy::place_market_order`,
  arguments: [
    tx3.object(marginManagerId),
    tx3.object(poolId),
    tx3.pure(quantity),
    tx3.pure(true), // BUY
  ],
});

// 3b. 發出跟單信號
tx3.moveCall({
  target: `${PACKAGE_ID}::copy_trade::emit_leader_trade_signal`,
  arguments: [
    tx3.object(leaderProfileId),
    tx3.pure(poolId),
    tx3.pure(true),           // BUY
    tx3.pure(0),              // MARKET
    tx3.pure(null, 'Option'),
    tx3.pure(quantity),
    tx3.pure(5),              // 5x leverage
    tx3.pure(txDigest),
  ],
});

await signAndExecute(tx3);
```

---

**下一步閱讀**：
- [開發計劃](./MarginMaster_Development_Plan.md) - 7天實施時間表
- [數據庫與 API 設計](./MarginMaster_Database_API.md) - 後端實現
