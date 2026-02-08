#[test_only]
module margin_master::trading_bot_tests;

use margin_master::trading_bot::{Self, TradingBot, TradingBotRegistry};
use margin_master::position;
use margin_master::vault;
use sui::test_scenario::{Self as test, Scenario, next_tx, ctx};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::{Self, Clock};

// Test constants
const ADMIN: address = @0xAD;
const TRADER: address = @0xA;
const FOLLOWER: address = @0xB;
const BACKEND: address = @0xC;

const INITIAL_BALANCE: u64 = 100_000_000_000; // 100,000 SUI (9 decimals)

/// Helper: create clock for testing
fun create_clock(scenario: &mut Scenario): Clock {
    next_tx(scenario, ADMIN);
    clock::create_for_testing(ctx(scenario))
}

#[test]
fun test_create_and_activate_bot() {
    let mut scenario = test::begin(ADMIN);

    // Setup: create registry
    next_tx(&mut scenario, ADMIN);
    {
        trading_bot::test_init(ctx(&mut scenario));
    };

    let clock = create_clock(&mut scenario);

    // Follower creates bot
    next_tx(&mut scenario, FOLLOWER);
    {
        let mut registry = test::take_shared<TradingBotRegistry>(&scenario);

        trading_bot::create_trading_bot<SUI>(
            &mut registry,
            TRADER,
            5000, // 50% copy ratio
            10_000_000_000, // max position size
            5_000_000_000, // daily loss limit
            30000, // min hold duration: 30 seconds
            &clock,
            ctx(&mut scenario),
        );

        test::return_shared(registry);
    };

    // Check bot was created and is shared
    next_tx(&mut scenario, FOLLOWER);
    {
        assert!(test::has_most_recent_shared<TradingBot<SUI>>(), 0);
    };

    clock::destroy_for_testing(clock);
    test::end(scenario);
}

#[test]
fun test_deposit_and_activate() {
    let mut scenario = test::begin(ADMIN);

    // Setup
    next_tx(&mut scenario, ADMIN);
    {
        trading_bot::test_init(ctx(&mut scenario));
    };

    let clock = create_clock(&mut scenario);

    // Create bot
    next_tx(&mut scenario, FOLLOWER);
    {
        let mut registry = test::take_shared<TradingBotRegistry>(&scenario);

        trading_bot::create_trading_bot<SUI>(
            &mut registry,
            TRADER,
            5000,
            10_000_000_000,
            5_000_000_000,
            30000,
            &clock,
            ctx(&mut scenario),
        );

        test::return_shared(registry);
    };

    // Deposit funds
    next_tx(&mut scenario, FOLLOWER);
    {
        let mut bot = test::take_shared<TradingBot<SUI>>(&scenario);
        let deposit_coin = coin::mint_for_testing<SUI>(10_000_000_000, ctx(&mut scenario));

        trading_bot::deposit(&mut bot, deposit_coin, ctx(&mut scenario));

        assert!(trading_bot::vault_balance(&bot) == 10_000_000_000, 0);
        assert!(!trading_bot::is_active(&bot), 1);

        test::return_shared(bot);
    };

    // Activate bot
    next_tx(&mut scenario, FOLLOWER);
    {
        let mut bot = test::take_shared<TradingBot<SUI>>(&scenario);
        let mut registry = test::take_shared<TradingBotRegistry>(&scenario);

        trading_bot::activate_bot(&mut bot, &mut registry, ctx(&mut scenario));

        assert!(trading_bot::is_active(&bot), 2);

        test::return_shared(bot);
        test::return_shared(registry);
    };

    clock::destroy_for_testing(clock);
    test::end(scenario);
}

#[test]
#[expected_failure(abort_code = trading_bot::EInsufficientFunds)]
fun test_activate_without_funds_fails() {
    let mut scenario = test::begin(ADMIN);

    next_tx(&mut scenario, ADMIN);
    {
        trading_bot::test_init(ctx(&mut scenario));
    };

    let clock = create_clock(&mut scenario);

    next_tx(&mut scenario, FOLLOWER);
    {
        let mut registry = test::take_shared<TradingBotRegistry>(&scenario);

        trading_bot::create_trading_bot<SUI>(
            &mut registry,
            TRADER,
            5000,
            10_000_000_000,
            5_000_000_000,
            30000,
            &clock,
            ctx(&mut scenario),
        );

        test::return_shared(registry);
    };

    // Try to activate without depositing
    next_tx(&mut scenario, FOLLOWER);
    {
        let mut bot = test::take_shared<TradingBot<SUI>>(&scenario);
        let mut registry = test::take_shared<TradingBotRegistry>(&scenario);

        trading_bot::activate_bot(&mut bot, &mut registry, ctx(&mut scenario)); // Should fail

        test::return_shared(bot);
        test::return_shared(registry);
    };

    clock::destroy_for_testing(clock);
    test::end(scenario);
}

#[test]
fun test_withdraw_and_destroy() {
    let mut scenario = test::begin(ADMIN);

    next_tx(&mut scenario, ADMIN);
    {
        trading_bot::test_init(ctx(&mut scenario));
    };

    let clock = create_clock(&mut scenario);

    // Create and fund bot
    next_tx(&mut scenario, FOLLOWER);
    {
        let mut registry = test::take_shared<TradingBotRegistry>(&scenario);

        trading_bot::create_trading_bot<SUI>(
            &mut registry,
            TRADER,
            5000,
            10_000_000_000,
            5_000_000_000,
            30000,
            &clock,
            ctx(&mut scenario),
        );

        test::return_shared(registry);
    };

    next_tx(&mut scenario, FOLLOWER);
    {
        let mut bot = test::take_shared<TradingBot<SUI>>(&scenario);
        let deposit_coin = coin::mint_for_testing<SUI>(10_000_000_000, ctx(&mut scenario));

        trading_bot::deposit(&mut bot, deposit_coin, ctx(&mut scenario));

        test::return_shared(bot);
    };

    // Activate then deactivate
    next_tx(&mut scenario, FOLLOWER);
    {
        let mut bot = test::take_shared<TradingBot<SUI>>(&scenario);
        let mut registry = test::take_shared<TradingBotRegistry>(&scenario);

        trading_bot::activate_bot(&mut bot, &mut registry, ctx(&mut scenario));
        trading_bot::deactivate_bot(&mut bot, &mut registry, ctx(&mut scenario));

        assert!(!trading_bot::is_active(&bot), 0);

        test::return_shared(bot);
        test::return_shared(registry);
    };

    // Withdraw funds
    next_tx(&mut scenario, FOLLOWER);
    {
        let mut bot = test::take_shared<TradingBot<SUI>>(&scenario);

        trading_bot::withdraw(&mut bot, 10_000_000_000, ctx(&mut scenario));

        assert!(trading_bot::vault_balance(&bot) == 0, 1);

        test::return_shared(bot);
    };

    // Destroy bot
    next_tx(&mut scenario, FOLLOWER);
    {
        let bot = test::take_shared<TradingBot<SUI>>(&scenario);
        let mut registry = test::take_shared<TradingBotRegistry>(&scenario);

        trading_bot::destroy_bot(bot, &mut registry, ctx(&mut scenario));

        test::return_shared(registry);
    };

    clock::destroy_for_testing(clock);
    test::end(scenario);
}

#[test]
#[expected_failure(abort_code = trading_bot::EUnauthorized)]
fun test_only_owner_can_withdraw() {
    let mut scenario = test::begin(ADMIN);

    next_tx(&mut scenario, ADMIN);
    {
        trading_bot::test_init(ctx(&mut scenario));
    };

    let clock = create_clock(&mut scenario);

    next_tx(&mut scenario, FOLLOWER);
    {
        let mut registry = test::take_shared<TradingBotRegistry>(&scenario);

        trading_bot::create_trading_bot<SUI>(
            &mut registry,
            TRADER,
            5000,
            10_000_000_000,
            5_000_000_000,
            30000,
            &clock,
            ctx(&mut scenario),
        );

        test::return_shared(registry);
    };

    next_tx(&mut scenario, FOLLOWER);
    {
        let mut bot = test::take_shared<TradingBot<SUI>>(&scenario);
        let deposit_coin = coin::mint_for_testing<SUI>(10_000_000_000, ctx(&mut scenario));
        trading_bot::deposit(&mut bot, deposit_coin, ctx(&mut scenario));
        test::return_shared(bot);
    };

    // Attacker tries to withdraw
    next_tx(&mut scenario, BACKEND);
    {
        let mut bot = test::take_shared<TradingBot<SUI>>(&scenario);

        trading_bot::withdraw(&mut bot, 1_000_000_000, ctx(&mut scenario)); // Should fail

        test::return_shared(bot);
    };

    clock::destroy_for_testing(clock);
    test::end(scenario);
}
