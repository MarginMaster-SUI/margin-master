/// Extreme Scenario Tests for Margin Master
/// Tests all critical vulnerability fixes and edge cases

#[test_only]
module margin_master::extreme_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::test_utils;
    use margin_master::position::{Self, Position};
    use margin_master::vault::{Self, Vault};

    // Test constants
    const ADMIN: address = @0xAD;
    const USER1: address = @0x1;
    const USER2: address = @0x2;

    const USDC_DECIMALS: u64 = 1_000_000; // 6 decimals
    const MAX_U64: u128 = 18446744073709551615;

    // Helper: Create vault with initial balance
    fun setup_vault(scenario: &mut Scenario, user: address, initial_balance: u64) {
        ts::next_tx(scenario, user);
        {
            let vault = vault::create<SUI>(ts::ctx(scenario));
            let deposit_coin = coin::mint_for_testing<SUI>(initial_balance, ts::ctx(scenario));
            vault::deposit(&mut vault, deposit_coin);
            ts::transfer(vault, user);
        };
    }

    // Helper: Create clock
    fun create_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, ADMIN);
        clock::create_for_testing(ts::ctx(scenario))
    }

    // ========================================================================
    // TEST 1: Integer Overflow Protection with u128
    // ========================================================================

    #[test]
    fun test_extreme_position_no_overflow() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        // Setup: Vault with massive balance
        setup_vault(&mut scenario, USER1, 10_000_000 * USDC_DECIMALS); // 10M USDC

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // EXTREME TEST: Very large position with max leverage
            // This would have caused overflow in the old code
            let position = position::open_position(
                &mut vault,
                b"BTC/USDC",
                0, // LONG
                50000 * USDC_DECIMALS,      // Entry price: $50,000
                1000 * USDC_DECIMALS,        // Quantity: 1000 BTC
                20,                          // Max leverage: 20x
                2_500_000 * USDC_DECIMALS,  // Margin: 2.5M USDC
                &clock,
                ts::ctx(&mut scenario)
            );

            // Simulate 10% price increase
            let current_price = 55000 * USDC_DECIMALS; // $55,000

            // Calculate PnL - should NOT overflow
            let (pnl, is_profit) = position::calculate_pnl(&position, current_price);

            // Verify calculation is correct
            // Price diff: 55000 - 50000 = 5000
            // PnL = (5000 * 1000 * 20) / 1 = 100,000,000 USDC
            assert!(is_profit, 0);
            assert!(pnl == 100_000_000 * USDC_DECIMALS, 1);

            ts::return_shared(vault);
            ts::transfer(position, USER1);
        };

        ts::next_tx(&mut scenario, USER1);
        {
            let position = ts::take_owned<Position<SUI>>(&scenario);
            ts::return_owned(position);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::EPnLOverflow)]
    fun test_pnl_overflow_detection() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        // Setup vault with massive balance
        setup_vault(&mut scenario, USER1, 100_000_000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Create position that will overflow when calculating PnL
            let position = position::open_position(
                &mut vault,
                b"EXTREME/USDC",
                0, // LONG
                1 * USDC_DECIMALS,                    // Entry: $1
                (MAX_U64 / 100) as u64,               // Huge quantity
                20,                                    // Max leverage
                50_000_000 * USDC_DECIMALS,           // Margin
                &clock,
                ts::ctx(&mut scenario)
            );

            // Massive price increase that causes overflow
            let current_price = 1000 * USDC_DECIMALS; // $1000 (1000x increase)

            // This should abort with EPnLOverflow
            let (_pnl, _is_profit) = position::calculate_pnl(&position, current_price);

            ts::return_shared(vault);
            ts::transfer(position, USER1);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 2: PnL Settlement Logic
    // ========================================================================

    #[test]
    fun test_profit_settlement() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        // Setup: Vault with sufficient balance
        setup_vault(&mut scenario, USER1, 10_000_000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        let position_id;
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let initial_balance = vault::balance(&vault);

            // Open position
            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0, // LONG
                3 * USDC_DECIMALS,      // Entry: $3.00
                1000 * USDC_DECIMALS,   // Quantity: 1000 SUI
                10,                     // Leverage: 10x
                300 * USDC_DECIMALS,    // Margin: $300
                &clock,
                ts::ctx(&mut scenario)
            );

            position_id = sui::object::id(&position);

            // Verify vault state
            let after_open = vault::balance(&vault);
            let committed = vault::committed_margin(&vault);
            let available = vault::available_liquidity(&vault);

            assert!(after_open == initial_balance - 300 * USDC_DECIMALS, 0);
            assert!(committed == 300 * USDC_DECIMALS, 1);
            assert!(available == initial_balance - 300 * USDC_DECIMALS, 2);

            ts::return_shared(vault);
            ts::transfer(position, USER1);
        };

        // Close position with profit
        ts::next_tx(&mut scenario, USER1);
        {
            let position = ts::take_owned<Position<SUI>>(&scenario);
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let balance_before_close = vault::balance(&vault);

            // Price increased to $3.50 (16.67% increase)
            let current_price = 350 * USDC_DECIMALS / 100; // $3.50

            // Expected PnL calculation:
            // Price diff = 3.50 - 3.00 = 0.50
            // PnL = (0.50 * 1000 * 10) = 5000 USDC
            // But with 6 decimals: (500000 * 1000000000 * 10) / 1000000 = 5000 * 1000000

            position::close_position(
                position,
                current_price,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Verify vault state after close
            let balance_after_close = vault::balance(&vault);
            let committed = vault::committed_margin(&vault);
            let available = vault::available_liquidity(&vault);

            // Vault should have: initial - margin - profit paid out
            // User should receive: margin (300) + profit (5000) = 5300 USDC
            // Vault decreases by: profit (5000)
            assert!(committed == 0, 3);
            assert!(balance_after_close < balance_before_close, 4);

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_loss_settlement() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        setup_vault(&mut scenario, USER1, 1_000_000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Open position
            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0, // LONG
                3 * USDC_DECIMALS,      // Entry: $3.00
                100 * USDC_DECIMALS,    // Quantity: 100 SUI
                5,                      // Leverage: 5x
                60 * USDC_DECIMALS,     // Margin: $60
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
            ts::transfer(position, USER1);
        };

        // Close with loss
        ts::next_tx(&mut scenario, USER1);
        {
            let position = ts::take_owned<Position<SUI>>(&scenario);
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let balance_before = vault::balance(&vault);

            // Price decreased to $2.50 (16.67% decrease)
            let current_price = 250 * USDC_DECIMALS / 100; // $2.50

            // Expected PnL calculation:
            // Price diff = 3.00 - 2.50 = 0.50
            // Loss = (0.50 * 100 * 5) = 250 USDC

            position::close_position(
                position,
                current_price,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Verify: Loss stays in vault, user gets margin - loss
            // User receives: 60 - 25 = 35 USDC
            // Vault increases by: loss (25 USDC)
            let balance_after = vault::balance(&vault);
            assert!(balance_after > balance_before, 0);

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_total_loss_liquidation() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        setup_vault(&mut scenario, USER1, 1_000_000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Open position
            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0, // LONG
                10 * USDC_DECIMALS,     // Entry: $10.00
                100 * USDC_DECIMALS,    // Quantity: 100 SUI
                10,                     // Leverage: 10x
                100 * USDC_DECIMALS,    // Margin: $100
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
            ts::transfer(position, USER1);
        };

        // Close with total loss (price drops to $9)
        ts::next_tx(&mut scenario, USER1);
        {
            let position = ts::take_owned<Position<SUI>>(&scenario);
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let balance_before = vault::balance(&vault);

            // Massive price drop: $10 -> $9 (10% drop)
            // With 10x leverage, loss = (1 * 100 * 10) = 1000 USDC
            // Loss > Margin (100), so total liquidation
            let current_price = 9 * USDC_DECIMALS;

            position::close_position(
                position,
                current_price,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Verify: All margin goes to vault, user gets nothing
            let balance_after = vault::balance(&vault);
            assert!(balance_after == balance_before + 100 * USDC_DECIMALS, 0);

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 3: Vault Solvency Protection
    // ========================================================================

    #[test]
    #[expected_failure(abort_code = margin_master::vault::EVaultInsolvent)]
    fun test_vault_insolvency_protection() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        // Setup vault with limited balance
        setup_vault(&mut scenario, USER1, 1000 * USDC_DECIMALS); // Only 1000 USDC

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Open position that uses most of the vault
            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0, // LONG
                1 * USDC_DECIMALS,
                100 * USDC_DECIMALS,
                5,
                100 * USDC_DECIMALS,    // Margin: 100 USDC
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
            ts::transfer(position, USER1);
        };

        // Try to close with massive profit that exceeds vault liquidity
        ts::next_tx(&mut scenario, USER1);
        {
            let position = ts::take_owned<Position<SUI>>(&scenario);
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Massive price increase: $1 -> $100 (100x)
            // Profit = (99 * 100 * 5) = 49,500 USDC
            // But vault only has ~900 available!
            let current_price = 100 * USDC_DECIMALS;

            // This should abort with EVaultInsolvent
            position::close_position(
                position,
                current_price,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_vault_liquidity_tracking() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        setup_vault(&mut scenario, USER1, 10_000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);
            let initial_balance = vault::balance(&vault);
            let initial_available = vault::available_liquidity(&vault);

            assert!(initial_balance == 10_000 * USDC_DECIMALS, 0);
            assert!(initial_available == 10_000 * USDC_DECIMALS, 1);
            assert!(vault::committed_margin(&vault) == 0, 2);

            // Open position 1
            let pos1 = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0,
                3 * USDC_DECIMALS,
                100 * USDC_DECIMALS,
                5,
                300 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Verify tracking after position 1
            assert!(vault::committed_margin(&vault) == 300 * USDC_DECIMALS, 3);
            assert!(vault::available_liquidity(&vault) == 9_700 * USDC_DECIMALS, 4);
            assert!(vault::balance(&vault) == 9_700 * USDC_DECIMALS, 5);

            // Open position 2
            let pos2 = position::open_position(
                &mut vault,
                b"BTC/USDC",
                1, // SHORT
                50_000 * USDC_DECIMALS,
                10 * USDC_DECIMALS,
                10,
                5_000 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Verify tracking after position 2
            assert!(vault::committed_margin(&vault) == 5_300 * USDC_DECIMALS, 6);
            assert!(vault::available_liquidity(&vault) == 4_700 * USDC_DECIMALS, 7);

            ts::return_shared(vault);
            ts::transfer(pos1, USER1);
            ts::transfer(pos2, USER1);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 4: Input Validation
    // ========================================================================

    #[test]
    #[expected_failure(abort_code = margin_master::position::EInvalidPrice)]
    fun test_zero_entry_price_rejected() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        setup_vault(&mut scenario, USER1, 1000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Try to create position with zero price - should fail
            let _position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0,
                0, // ❌ Zero price
                100 * USDC_DECIMALS,
                5,
                100 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::EInvalidQuantity)]
    fun test_zero_quantity_rejected() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        setup_vault(&mut scenario, USER1, 1000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Try to create position with zero quantity - should fail
            let _position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0,
                3 * USDC_DECIMALS,
                0, // ❌ Zero quantity
                5,
                100 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::EInsufficientMargin)]
    fun test_zero_margin_rejected() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        setup_vault(&mut scenario, USER1, 1000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Try to create position with zero margin - should fail
            let _position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0,
                3 * USDC_DECIMALS,
                100 * USDC_DECIMALS,
                5,
                0, // ❌ Zero margin
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::EInvalidTradingPair)]
    fun test_empty_trading_pair_rejected() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        setup_vault(&mut scenario, USER1, 1000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Try to create position with empty trading pair - should fail
            let _position = position::open_position(
                &mut vault,
                b"", // ❌ Empty trading pair
                0,
                3 * USDC_DECIMALS,
                100 * USDC_DECIMALS,
                5,
                100 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 5: SHORT Position Tests
    // ========================================================================

    #[test]
    fun test_short_position_profit() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        setup_vault(&mut scenario, USER1, 10_000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Open SHORT position
            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                1, // SHORT
                5 * USDC_DECIMALS,      // Entry: $5.00
                100 * USDC_DECIMALS,    // Quantity: 100 SUI
                10,                     // Leverage: 10x
                500 * USDC_DECIMALS,    // Margin: $500
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
            ts::transfer(position, USER1);
        };

        // Close SHORT with profit (price went down)
        ts::next_tx(&mut scenario, USER1);
        {
            let position = ts::take_owned<Position<SUI>>(&scenario);
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Price decreased to $4.00 (20% drop)
            // SHORT profits when price drops
            // PnL = (5 - 4) * 100 * 10 = 1000 USDC profit
            let current_price = 4 * USDC_DECIMALS;

            let (pnl, is_profit) = position::calculate_pnl(&position, current_price);
            assert!(is_profit, 0);
            assert!(pnl == 1000 * USDC_DECIMALS, 1);

            position::close_position(
                position,
                current_price,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_short_position_loss() {
        let mut scenario = ts::begin(ADMIN);
        let clock = create_clock(&mut scenario);

        setup_vault(&mut scenario, USER1, 10_000 * USDC_DECIMALS);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Open SHORT position
            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                1, // SHORT
                5 * USDC_DECIMALS,
                100 * USDC_DECIMALS,
                5,
                250 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
            ts::transfer(position, USER1);
        };

        // Close SHORT with loss (price went up)
        ts::next_tx(&mut scenario, USER1);
        {
            let position = ts::take_owned<Position<SUI>>(&scenario);
            let mut vault = ts::take_shared<Vault<SUI>>(&scenario);

            // Price increased to $6.00 (20% increase)
            // SHORT loses when price increases
            // Loss = (6 - 5) * 100 * 5 = 500 USDC loss
            let current_price = 6 * USDC_DECIMALS;

            let (pnl, is_profit) = position::calculate_pnl(&position, current_price);
            assert!(!is_profit, 0);
            assert!(pnl == 500 * USDC_DECIMALS, 1);

            position::close_position(
                position,
                current_price,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
