/// Simplified Extreme Scenario Tests for Margin Master
/// Demonstrates all critical vulnerability fixes

#[test_only]
module margin_master::security_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use sui::sui::SUI;
    use sui::clock;
    use margin_master::position;
    use margin_master::vault;

    const ADMIN: address = @0xAD;
    const USER1: address = @0x1;
    const USDC_DECIMALS: u64 = 1_000_000;

    // ========================================================================
    // TEST 1: Integer Overflow Protection - FIXED ✅
    // ========================================================================

    #[test]
    fun test_no_overflow_with_u128() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            // Create vault
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(100_000_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // EXTREME: Large position with max leverage (would overflow in old code)
            let position = position::open_position(
                &mut vault,
                b"BTC/USDC",
                0, // LONG
                50000 * USDC_DECIMALS,    // Entry: $50,000
                10000 * USDC_DECIMALS,    // Quantity: 10,000 BTC
                20,                        // Max leverage: 20x
                10_000_000 * USDC_DECIMALS, // Margin: 10M USDC
                &clock,
                ts::ctx(&mut scenario)
            );

            // Price increase: $50,000 -> $55,000 (10% up)
            let current_price = 55000 * USDC_DECIMALS;

            // Calculate PnL - uses u128 internally, should NOT overflow
            let (pnl, is_profit) = position::calculate_pnl(&position, current_price);

            // Expected: (5000 * 10000 * 20) = 1,000,000,000 USDC profit
            assert!(is_profit, 0);
            assert!(pnl == 1_000_000_000 * USDC_DECIMALS, 1);

            // Cleanup
            sui::test_utils::destroy(position);
            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 2: Vault Solvency Tracking - FIXED ✅
    // ========================================================================

    #[test]
    fun test_vault_liquidity_tracking() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // Initial state
            assert!(vault::balance(&vault) == 10_000 * USDC_DECIMALS, 0);
            assert!(vault::available_liquidity(&vault) == 10_000 * USDC_DECIMALS, 1);
            assert!(vault::committed_margin(&vault) == 0, 2);

            // Open position - should track committed margin
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

            // Verify tracking after open
            assert!(vault::committed_margin(&vault) == 300 * USDC_DECIMALS, 3);
            assert!(vault::available_liquidity(&vault) == 9_700 * USDC_DECIMALS, 4);
            assert!(vault::balance(&vault) == 9_700 * USDC_DECIMALS, 5);

            // Open second position
            let pos2 = position::open_position(
                &mut vault,
                b"BTC/USDC",
                1,
                50_000 * USDC_DECIMALS,
                10 * USDC_DECIMALS,
                10,
                5_000 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Verify tracking with multiple positions
            assert!(vault::committed_margin(&vault) == 5_300 * USDC_DECIMALS, 6);
            assert!(vault::available_liquidity(&vault) == 4_700 * USDC_DECIMALS, 7);

            // Cleanup
            sui::test_utils::destroy(pos1);
            sui::test_utils::destroy(pos2);
            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 3: Input Validation - FIXED ✅
    // ========================================================================

    #[test]
    #[expected_failure(abort_code = margin_master::position::EInvalidPrice)]
    fun test_zero_price_rejected() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // Try zero price - should ABORT with EInvalidPrice
            let _pos = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0,
                0, // ❌ Zero price - should fail
                100 * USDC_DECIMALS,
                5,
                100 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::EInvalidQuantity)]
    fun test_zero_quantity_rejected() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // Try zero quantity - should ABORT
            let _pos = position::open_position(
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

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::EInsufficientMargin)]
    fun test_zero_margin_rejected() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // Try zero margin - should ABORT
            let _pos = position::open_position(
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

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::EInvalidTradingPair)]
    fun test_empty_trading_pair_rejected() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // Try empty trading pair - should ABORT
            let _pos = position::open_position(
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

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 4: SHORT Position Calculations - Verifies u128 fix works for both types
    // ========================================================================

    #[test]
    fun test_short_position_profit_calculation() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // Open SHORT position
            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                1, // SHORT
                5 * USDC_DECIMALS,      // Entry: $5.00
                1000 * USDC_DECIMALS,   // Quantity: 1000 SUI
                10,                     // Leverage: 10x
                500 * USDC_DECIMALS,    // Margin: $500
                &clock,
                ts::ctx(&mut scenario)
            );

            // Price drops to $4.00 (SHORT profits when price falls)
            let current_price = 4 * USDC_DECIMALS;

            // Calculate PnL using u128 (no overflow)
            let (pnl, is_profit) = position::calculate_pnl(&position, current_price);

            // Expected: (5 - 4) * 1000 * 10 = 10,000 USDC profit
            assert!(is_profit, 0);
            assert!(pnl == 10_000 * USDC_DECIMALS, 1);

            // Cleanup
            sui::test_utils::destroy(position);
            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_short_position_loss_calculation() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // Open SHORT position
            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                1, // SHORT
                5 * USDC_DECIMALS,
                1000 * USDC_DECIMALS,
                5,
                250 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Price increases to $6.00 (SHORT loses when price rises)
            let current_price = 6 * USDC_DECIMALS;

            let (pnl, is_profit) = position::calculate_pnl(&position, current_price);

            // Expected: (6 - 5) * 1000 * 5 = 5,000 USDC loss
            assert!(!is_profit, 0);
            assert!(pnl == 5_000 * USDC_DECIMALS, 1);

            // Cleanup
            sui::test_utils::destroy(position);
            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
