/// Extreme Scenario Tests for Margin Master
/// Tests all critical vulnerability fixes and edge cases

#[test_only]
module margin_master::extreme_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use sui::sui::SUI;
    use sui::clock;
    use margin_master::position;
    use margin_master::vault;

    const ADMIN: address = @0xAD;
    const USER1: address = @0x1;
    const USDC_DECIMALS: u64 = 1_000_000;
    const MAX_U64: u128 = 18446744073709551615;

    // ========================================================================
    // TEST 1: Integer Overflow Protection with u128
    // ========================================================================

    #[test]
    fun test_extreme_position_no_overflow() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault,
                b"BTC/USDC",
                0,
                50000 * USDC_DECIMALS,
                1000 * USDC_DECIMALS,
                20,
                2_500_000 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            let current_price = 55000 * USDC_DECIMALS;
            let (pnl, is_profit) = position::calculate_pnl(&position, current_price);

            assert!(is_profit, 0);
            assert!(pnl == 100_000_000 * USDC_DECIMALS, 1);

            sui::test_utils::destroy(position);
            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::EPnLOverflow)]
    fun test_pnl_overflow_detection() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(100_000_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault,
                b"EXTREME/USDC",
                0,
                1 * USDC_DECIMALS,
                (MAX_U64 / 100) as u64,
                20,
                50_000_000 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            let current_price = 1000 * USDC_DECIMALS;
            let (_pnl, _is_profit) = position::calculate_pnl(&position, current_price);

            sui::test_utils::destroy(position);
            sui::test_utils::destroy(vault);
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
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0,
                3 * USDC_DECIMALS,
                1000 * USDC_DECIMALS,
                10,
                300 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            assert!(vault::committed_margin(&vault) == 300 * USDC_DECIMALS, 1);

            let balance_before_close = vault::balance(&vault);

            let current_price = 350 * USDC_DECIMALS / 100; // $3.50

            position::close_position(
                position,
                current_price,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            let balance_after_close = vault::balance(&vault);
            assert!(vault::committed_margin(&vault) == 0, 3);
            assert!(balance_after_close < balance_before_close, 4);

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_loss_settlement() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1_000_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0,
                3 * USDC_DECIMALS,
                100 * USDC_DECIMALS,
                5,
                60 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            let balance_before = vault::balance(&vault);
            let current_price = 250 * USDC_DECIMALS / 100; // $2.50

            position::close_position(
                position,
                current_price,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            let balance_after = vault::balance(&vault);
            assert!(balance_after > balance_before, 0);

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_total_loss_liquidation() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1_000_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0,
                10 * USDC_DECIMALS,
                100 * USDC_DECIMALS,
                10,
                100 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            let balance_before = vault::balance(&vault);

            // $10 -> $9 with 10x leverage = 1000 USDC loss > 100 margin = total liquidation
            position::close_position(
                position,
                9 * USDC_DECIMALS,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            let balance_after = vault::balance(&vault);
            assert!(balance_after == balance_before + 100 * USDC_DECIMALS, 0);

            sui::test_utils::destroy(vault);
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
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault,
                b"SUI/USDC",
                0,
                1 * USDC_DECIMALS,
                100 * USDC_DECIMALS,
                5,
                100 * USDC_DECIMALS,
                &clock,
                ts::ctx(&mut scenario)
            );

            // $1 -> $100 with 5x leverage = massive profit, vault can't pay
            position::close_position(
                position,
                100 * USDC_DECIMALS,
                &mut vault,
                &clock,
                ts::ctx(&mut scenario)
            );

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_vault_liquidity_tracking() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            assert!(vault::balance(&vault) == 10_000 * USDC_DECIMALS, 0);
            assert!(vault::available_liquidity(&vault) == 10_000 * USDC_DECIMALS, 1);
            assert!(vault::committed_margin(&vault) == 0, 2);

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

            assert!(vault::committed_margin(&vault) == 300 * USDC_DECIMALS, 3);
            assert!(vault::available_liquidity(&vault) == 9_700 * USDC_DECIMALS, 4);

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

            assert!(vault::committed_margin(&vault) == 5_300 * USDC_DECIMALS, 6);
            assert!(vault::available_liquidity(&vault) == 4_700 * USDC_DECIMALS, 7);

            sui::test_utils::destroy(pos1);
            sui::test_utils::destroy(pos2);
            sui::test_utils::destroy(vault);
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
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let _pos = position::open_position(
                &mut vault, b"SUI/USDC", 0, 0, 100 * USDC_DECIMALS, 5, 100 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            sui::test_utils::destroy(_pos);
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

            let _pos = position::open_position(
                &mut vault, b"SUI/USDC", 0, 3 * USDC_DECIMALS, 0, 5, 100 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            sui::test_utils::destroy(_pos);
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

            let _pos = position::open_position(
                &mut vault, b"SUI/USDC", 0, 3 * USDC_DECIMALS, 100 * USDC_DECIMALS, 5, 0,
                &clock, ts::ctx(&mut scenario)
            );

            sui::test_utils::destroy(_pos);
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

            let _pos = position::open_position(
                &mut vault, b"", 0, 3 * USDC_DECIMALS, 100 * USDC_DECIMALS, 5, 100 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            sui::test_utils::destroy(_pos);
            sui::test_utils::destroy(vault);
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
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault, b"SUI/USDC", 1, 5 * USDC_DECIMALS, 100 * USDC_DECIMALS, 10, 500 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            let (pnl, is_profit) = position::calculate_pnl(&position, 4 * USDC_DECIMALS);
            assert!(is_profit, 0);
            assert!(pnl == 1000 * USDC_DECIMALS, 1);

            position::close_position(position, 4 * USDC_DECIMALS, &mut vault, &clock, ts::ctx(&mut scenario));

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_short_position_loss() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault, b"SUI/USDC", 1, 5 * USDC_DECIMALS, 100 * USDC_DECIMALS, 5, 250 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            let (pnl, is_profit) = position::calculate_pnl(&position, 6 * USDC_DECIMALS);
            assert!(!is_profit, 0);
            assert!(pnl == 500 * USDC_DECIMALS, 1);

            position::close_position(position, 6 * USDC_DECIMALS, &mut vault, &clock, ts::ctx(&mut scenario));

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 6: Liquidation mechanism
    // ========================================================================

    #[test]
    fun test_liquidation_by_owner() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // Entry: $10, Qty: 100, Lev: 10x, Margin: $100
            let position = position::open_position(
                &mut vault, b"SUI/USDC", 0, 10 * USDC_DECIMALS, 100 * USDC_DECIMALS, 10, 100 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            // Verify is_liquidatable at various prices
            assert!(!position::is_liquidatable(&position, 9_950_000), 0); // Small drop - not liquidatable
            assert!(!position::is_liquidatable(&position, 9_930_000), 1); // Still not enough
            assert!(position::is_liquidatable(&position, 9_910_000), 2);  // 80%+ margin consumed

            let vault_balance_before = vault::balance(&vault);

            // Liquidate at $9.91
            position::liquidate_position(
                position, 9_910_000, &mut vault, &clock, ts::ctx(&mut scenario)
            );

            // Vault should have received most of the margin (minus 5% reward)
            let vault_balance_after = vault::balance(&vault);
            assert!(vault_balance_after > vault_balance_before, 3);

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::ENotLiquidatable)]
    fun test_cannot_liquidate_healthy_position() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault, b"SUI/USDC", 0, 10 * USDC_DECIMALS, 100 * USDC_DECIMALS, 10, 100 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            // Price only dropped slightly - should fail
            position::liquidate_position(
                position, 9_950_000, &mut vault, &clock, ts::ctx(&mut scenario)
            );

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = margin_master::position::ENotLiquidatable)]
    fun test_cannot_liquidate_profitable_position() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let position = position::open_position(
                &mut vault, b"SUI/USDC", 0, 10 * USDC_DECIMALS, 100 * USDC_DECIMALS, 10, 100 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            // Price went UP - position is profitable, cannot liquidate
            position::liquidate_position(
                position, 11 * USDC_DECIMALS, &mut vault, &clock, ts::ctx(&mut scenario)
            );

            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 7: Liquidation price calculation
    // ========================================================================

    #[test]
    fun test_liquidation_price_calculation() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(10_000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // LONG: Entry $10, Qty 100, Lev 10x, Margin $100
            let long_pos = position::open_position(
                &mut vault, b"SUI/USDC", 0, 10 * USDC_DECIMALS, 100 * USDC_DECIMALS, 10, 100 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            let liq_price = position::get_liquidation_price(&long_pos);
            assert!(liq_price < 10 * USDC_DECIMALS, 0); // LONG liquidation below entry
            assert!(liq_price > 0, 1);

            // SHORT: Entry $10, Qty 100, Lev 10x, Margin $100
            let short_pos = position::open_position(
                &mut vault, b"SUI/USDC", 1, 10 * USDC_DECIMALS, 100 * USDC_DECIMALS, 10, 100 * USDC_DECIMALS,
                &clock, ts::ctx(&mut scenario)
            );

            let liq_price_short = position::get_liquidation_price(&short_pos);
            assert!(liq_price_short > 10 * USDC_DECIMALS, 2); // SHORT liquidation above entry

            sui::test_utils::destroy(long_pos);
            sui::test_utils::destroy(short_pos);
            sui::test_utils::destroy(vault);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========================================================================
    // TEST 8: Flash Loan
    // ========================================================================

    #[test]
    fun test_flash_loan_borrow_repay() {
        let mut scenario = ts::begin(ADMIN);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            let initial = vault::balance(&vault);

            // Flash borrow
            let (borrowed, receipt) = vault::flash_borrow(&mut vault, 500 * USDC_DECIMALS);
            assert!(sui::balance::value(&borrowed) == 500 * USDC_DECIMALS, 0);
            assert!(vault::balance(&vault) == 500 * USDC_DECIMALS, 1);

            // Flash repay
            vault::flash_repay(&mut vault, borrowed, receipt);
            assert!(vault::balance(&vault) == initial, 2);

            sui::test_utils::destroy(vault);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_flash_loan_overpay() {
        let mut scenario = ts::begin(ADMIN);

        ts::next_tx(&mut scenario, USER1);
        {
            let mut vault = vault::create<SUI>(ts::ctx(&mut scenario));
            let deposit = coin::mint_for_testing<SUI>(1000 * USDC_DECIMALS, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, deposit);

            // Flash borrow 500
            let (mut borrowed, receipt) = vault::flash_borrow(&mut vault, 500 * USDC_DECIMALS);

            // Add extra to repay MORE than borrowed (tip)
            let extra = coin::mint_for_testing<SUI>(100 * USDC_DECIMALS, ts::ctx(&mut scenario));
            sui::balance::join(&mut borrowed, sui::coin::into_balance(extra));

            vault::flash_repay(&mut vault, borrowed, receipt);

            // Vault now has more than initial
            assert!(vault::balance(&vault) == 1100 * USDC_DECIMALS, 0);

            sui::test_utils::destroy(vault);
        };

        ts::end(scenario);
    }
}
