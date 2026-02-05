/**
 * Auto-generated TypeScript types for Margin Master SUI Move contracts
 * Generated from: packages/contracts/margin_master
 */

import { TransactionArgument } from '@mysten/sui/transactions';

// ============================================================================
// Events
// ============================================================================

export interface PositionOpenedEvent {
  position_id: string;
  user: string;
  trading_pair: string;
  position_type: 'LONG' | 'SHORT';
  entry_price: string; // u64 as string
  quantity: string; // u64 as string
  leverage: number; // u8
  margin: string; // u64 as string
  timestamp: string; // u64 as string
}

export interface PositionClosedEvent {
  position_id: string;
  user: string;
  close_price: string; // u64 as string
  pnl: string; // u64 as string
  is_profit: boolean;
  timestamp: string; // u64 as string
}

export interface CopyTradeExecutedEvent {
  follower: string;
  trader: string;
  original_position_id: string;
  copied_position_id: string;
  allocation_percentage: number; // u8
  timestamp: string; // u64 as string
}

// ============================================================================
// Position Struct
// ============================================================================

export interface Position {
  id: string;
  user: string;
  trading_pair: string;
  position_type: 'LONG' | 'SHORT';
  entry_price: string; // u64 in USDC (6 decimals)
  current_price: string; // u64 in USDC (6 decimals)
  quantity: string; // u64
  leverage: number; // u8
  margin: string; // u64 in USDC
  unrealized_pnl: string; // u64
  is_profit: boolean;
  stop_loss_price?: string; // Option<u64>
  take_profit_price?: string; // Option<u64>
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  opened_at: string; // u64 timestamp
  closed_at?: string; // Option<u64>
}

// ============================================================================
// Vault Struct
// ============================================================================

export interface Vault {
  id: string;
  total_deposits: string; // u64
  total_borrowed: string; // u64
  available_liquidity: string; // u64
  utilization_rate: number; // u64 as percentage (basis points)
}

// ============================================================================
// Copy Trade Relation
// ============================================================================

export interface CopyTradeRelation {
  id: string;
  follower: string;
  trader: string;
  allocation_percentage: number; // u8 (1-100)
  is_active: boolean;
  created_at: string; // u64 timestamp
}

// ============================================================================
// Transaction Arguments Types
// ============================================================================

export interface OpenPositionArgs {
  trading_pair: TransactionArgument;
  position_type: TransactionArgument; // 0 = LONG, 1 = SHORT
  entry_price: TransactionArgument; // u64
  quantity: TransactionArgument; // u64
  leverage: TransactionArgument; // u8 (1-100)
  margin: TransactionArgument; // Coin<USDC>
  stop_loss_price?: TransactionArgument; // Option<u64>
  take_profit_price?: TransactionArgument; // Option<u64>
}

export interface ClosePositionArgs {
  position_id: TransactionArgument; // ID
  close_price: TransactionArgument; // u64
}

export interface UpdatePositionArgs {
  position_id: TransactionArgument; // ID
  current_price: TransactionArgument; // u64
}

export interface EnableCopyTradeArgs {
  trader_address: TransactionArgument; // address
  allocation_percentage: TransactionArgument; // u8 (1-100)
}

export interface ExecuteCopyTradeArgs {
  original_position_id: TransactionArgument; // ID
  follower_margin: TransactionArgument; // Coin<USDC>
}

// ============================================================================
// Contract Addresses & Constants
// ============================================================================

export const CONTRACT_ADDRESSES = {
  PACKAGE_ID: '0xa769230f609d7e517af140150c409f98b74e2f090bf442e7877d6266b76e0696',
  COPY_RELATION_REGISTRY_ID: '0x30d22a285503bab9a612f680272bfe3140896763e3eab2ba3679487b0f40f39d',
  POSITION_MODULE: 'position',
  VAULT_MODULE: 'vault',
  COPY_EXECUTOR_MODULE: 'copy_executor',
  EVENTS_MODULE: 'events',
} as const;

export const POSITION_TYPE = {
  LONG: 0,
  SHORT: 1,
} as const;

export const POSITION_STATUS = {
  OPEN: 0,
  CLOSED: 1,
  LIQUIDATED: 2,
} as const;

// USDC decimals on SUI
export const USDC_DECIMALS = 6;

// Maximum leverage allowed
export const MAX_LEVERAGE = 100;

// Minimum margin required (in USDC base units)
export const MIN_MARGIN = 1_000_000; // 1 USDC

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert USDC base units (6 decimals) to display value
 */
export function usdcToDisplay(amount: string | number): number {
  return Number(amount) / Math.pow(10, USDC_DECIMALS);
}

/**
 * Convert display value to USDC base units (6 decimals)
 */
export function displayToUsdc(amount: number): string {
  return Math.floor(amount * Math.pow(10, USDC_DECIMALS)).toString();
}

/**
 * Calculate PnL for a position
 */
export function calculatePnL(
  positionType: 'LONG' | 'SHORT',
  entryPrice: string,
  currentPrice: string,
  quantity: string,
  leverage: number
): { pnl: string; isProfit: boolean } {
  const entry = Number(entryPrice);
  const current = Number(currentPrice);
  const qty = Number(quantity);

  let pnlAmount: number;
  if (positionType === 'LONG') {
    pnlAmount = (current - entry) * qty * leverage;
  } else {
    pnlAmount = (entry - current) * qty * leverage;
  }

  return {
    pnl: Math.abs(pnlAmount).toString(),
    isProfit: pnlAmount >= 0,
  };
}

/**
 * Calculate liquidation price for a position
 */
export function calculateLiquidationPrice(
  positionType: 'LONG' | 'SHORT',
  entryPrice: string,
  leverage: number
): string {
  const entry = Number(entryPrice);
  const liquidationThreshold = 0.8; // 80% of margin

  let liquidationPrice: number;
  if (positionType === 'LONG') {
    liquidationPrice = entry * (1 - liquidationThreshold / leverage);
  } else {
    liquidationPrice = entry * (1 + liquidationThreshold / leverage);
  }

  return Math.floor(liquidationPrice).toString();
}
