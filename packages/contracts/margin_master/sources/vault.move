/// MarginMaster - Vault Module
///
/// Manages user fund custody for margin trading.
/// Each user has their own Vault that holds USDC collateral.
/// Includes flash loan support for capital-efficient liquidations.

module margin_master::vault;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

/// Error codes
const EInsufficientBalance: u64 = 0;
const EUnauthorized: u64 = 1;
const EInsufficientLiquidity: u64 = 2;
const EVaultInsolvent: u64 = 3;
const EFlashLoanRepayInsufficient: u64 = 4;

/// Vault holds user's USDC deposits for margin trading
/// Enhanced with solvency tracking
public struct Vault<phantom T> has key, store {
    id: UID,
    owner: address,
    balance: Balance<T>,
    committed_margin: u64, // Funds locked in open positions
    available_liquidity: u64, // Funds available for new positions
}

/// Hot potato receipt for flash loans - must be repaid in same tx
public struct FlashLoanReceipt<phantom T> {
    vault_id: ID,
    borrow_amount: u64,
}

/// Create a new vault for a user
public fun create<T>(ctx: &mut TxContext): Vault<T> {
    Vault {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        balance: balance::zero(),
        committed_margin: 0,
        available_liquidity: 0,
    }
}

/// Deposit coins into vault
public fun deposit<T>(vault: &mut Vault<T>, coin: Coin<T>) {
    let deposit_amount = coin::value(&coin);
    let deposit_balance = coin::into_balance(coin);
    balance::join(&mut vault.balance, deposit_balance);

    // Increase available liquidity
    vault.available_liquidity = vault.available_liquidity + deposit_amount;
}

/// Withdraw coins from vault (only owner)
public fun withdraw<T>(vault: &mut Vault<T>, amount: u64, ctx: &mut TxContext): Coin<T> {
    assert!(tx_context::sender(ctx) == vault.owner, EUnauthorized);
    assert!(vault.available_liquidity >= amount, EInsufficientLiquidity);
    assert!(balance::value(&vault.balance) >= amount, EInsufficientBalance);

    let withdrawn_balance = balance::split(&mut vault.balance, amount);
    vault.available_liquidity = vault.available_liquidity - amount;

    coin::from_balance(withdrawn_balance, ctx)
}

/// Deduct margin from vault (used when opening position)
public fun deduct_margin<T>(vault: &mut Vault<T>, amount: u64, ctx: &TxContext): Balance<T> {
    assert!(tx_context::sender(ctx) == vault.owner, EUnauthorized);
    assert!(vault.available_liquidity >= amount, EInsufficientLiquidity);
    assert!(balance::value(&vault.balance) >= amount, EInsufficientBalance);

    // Update tracking
    vault.committed_margin = vault.committed_margin + amount;
    vault.available_liquidity = vault.available_liquidity - amount;

    balance::split(&mut vault.balance, amount)
}

/// Deduct margin from vault (delegated version for copy trading)
/// Allows trusted packages (like copy_executor) to deduct margin without owner signature
public(package) fun deduct_margin_delegated<T>(vault: &mut Vault<T>, amount: u64): Balance<T> {
    assert!(vault.available_liquidity >= amount, EInsufficientLiquidity);
    assert!(balance::value(&vault.balance) >= amount, EInsufficientBalance);

    // Update tracking
    vault.committed_margin = vault.committed_margin + amount;
    vault.available_liquidity = vault.available_liquidity - amount;

    balance::split(&mut vault.balance, amount)
}

/// Return funds to vault (used when closing position)
public fun return_funds<T>(vault: &mut Vault<T>, funds: Balance<T>) {
    let amount = balance::value(&funds);
    balance::join(&mut vault.balance, funds);

    // Update tracking
    vault.committed_margin = vault.committed_margin - amount;
    vault.available_liquidity = vault.available_liquidity + amount;
}

/// Settle profit when closing a position
/// Margin + profit is sent to user, profit is withdrawn from vault's available liquidity
public fun settle_profit<T>(
    vault: &mut Vault<T>,
    mut margin: Balance<T>,
    profit: u64,
    owner: address,
    ctx: &mut TxContext,
) {
    let margin_value = balance::value(&margin);

    // Check vault has sufficient liquidity to pay profit
    assert!(vault.available_liquidity >= profit, EVaultInsolvent);

    // Withdraw profit from vault
    let profit_balance = balance::split(&mut vault.balance, profit);

    // Combine margin + profit
    balance::join(&mut margin, profit_balance);

    // Update tracking
    vault.committed_margin = vault.committed_margin - margin_value;
    vault.available_liquidity = vault.available_liquidity - profit;

    // Transfer total to user
    let total_coin = coin::from_balance(margin, ctx);
    transfer::public_transfer(total_coin, owner);
}

/// Settle loss when closing a position
/// Only remaining margin (after loss) is sent to user, loss stays in vault
public fun settle_loss<T>(
    vault: &mut Vault<T>,
    mut margin: Balance<T>,
    loss: u64,
    owner: address,
    ctx: &mut TxContext,
) {
    let margin_value = balance::value(&margin);

    // Calculate remaining after loss
    if (loss >= margin_value) {
        // Total loss - liquidation scenario
        // All margin goes to vault
        balance::join(&mut vault.balance, margin);
        vault.available_liquidity = vault.available_liquidity + margin_value;
        vault.committed_margin = vault.committed_margin - margin_value;
        // User gets nothing
    } else {
        // Partial loss
        let loss_balance = balance::split(&mut margin, loss);

        // Loss goes to vault
        balance::join(&mut vault.balance, loss_balance);
        vault.available_liquidity = vault.available_liquidity + loss;

        // Update tracking
        vault.committed_margin = vault.committed_margin - margin_value;

        // Transfer remaining to user
        let remaining_coin = coin::from_balance(margin, ctx);
        transfer::public_transfer(remaining_coin, owner);
    }
}

// === Flash Loan Functions ===

/// Borrow from vault without upfront capital (flash loan)
/// Returns borrowed balance + receipt that MUST be repaid in same tx
public fun flash_borrow<T>(vault: &mut Vault<T>, amount: u64): (Balance<T>, FlashLoanReceipt<T>) {
    assert!(balance::value(&vault.balance) >= amount, EInsufficientBalance);

    let vault_id = object::uid_to_inner(&vault.id);
    let borrowed = balance::split(&mut vault.balance, amount);
    let receipt = FlashLoanReceipt<T> {
        vault_id,
        borrow_amount: amount,
    };

    (borrowed, receipt)
}

/// Repay flash loan - must return at least borrowed amount
public fun flash_repay<T>(
    vault: &mut Vault<T>,
    repayment: Balance<T>,
    receipt: FlashLoanReceipt<T>,
) {
    let FlashLoanReceipt { vault_id: _, borrow_amount } = receipt;
    assert!(balance::value(&repayment) >= borrow_amount, EFlashLoanRepayInsufficient);
    balance::join(&mut vault.balance, repayment);
}

/// Get the borrow amount from a flash loan receipt
public fun flash_loan_borrow_amount<T>(receipt: &FlashLoanReceipt<T>): u64 {
    receipt.borrow_amount
}

// === Package-internal helpers for liquidation ===

/// Mutable access to vault balance (for liquidation margin handling)
public(package) fun borrow_balance_mut<T>(vault: &mut Vault<T>): &mut Balance<T> {
    &mut vault.balance
}

/// Decrease committed margin tracking
public(package) fun decrease_committed_margin<T>(vault: &mut Vault<T>, amount: u64) {
    if (amount <= vault.committed_margin) {
        vault.committed_margin = vault.committed_margin - amount;
    } else {
        vault.committed_margin = 0;
    };
}

/// Increase available liquidity tracking
public(package) fun increase_available_liquidity<T>(vault: &mut Vault<T>, amount: u64) {
    vault.available_liquidity = vault.available_liquidity + amount;
}

// === Getter functions ===

/// Get vault balance
public fun balance<T>(vault: &Vault<T>): u64 {
    balance::value(&vault.balance)
}

/// Get vault owner
public fun owner<T>(vault: &Vault<T>): address {
    vault.owner
}

/// Get available liquidity
public fun available_liquidity<T>(vault: &Vault<T>): u64 {
    vault.available_liquidity
}

/// Get committed margin
public fun committed_margin<T>(vault: &Vault<T>): u64 {
    vault.committed_margin
}

/// Get vault ID
public fun vault_id<T>(vault: &Vault<T>): ID {
    object::uid_to_inner(&vault.id)
}

/// Transfer vault ownership
public entry fun transfer_vault<T>(vault: Vault<T>, recipient: address) {
    transfer::transfer(vault, recipient);
}

/// Create and transfer vault to sender (entry function for frontend)
public entry fun create_vault<T>(ctx: &mut TxContext) {
    let vault = create<T>(ctx);
    transfer::transfer(vault, tx_context::sender(ctx));
}

/// Deposit entry function for frontend
public entry fun deposit_entry<T>(vault: &mut Vault<T>, coin: Coin<T>) {
    deposit(vault, coin);
}

/// Withdraw entry function for frontend
public entry fun withdraw_entry<T>(vault: &mut Vault<T>, amount: u64, ctx: &mut TxContext) {
    let withdrawn_coin = withdraw(vault, amount, ctx);
    transfer::public_transfer(withdrawn_coin, tx_context::sender(ctx));
}
