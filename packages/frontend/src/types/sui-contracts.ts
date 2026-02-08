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

export interface LiquidationEvent {
  position_id: string;
  owner: string;
  liquidation_price: string; // u64 as string
  loss: string; // u64 as string
  timestamp: string; // u64 as string
}

export interface BatchCopyTradeExecutedEvent {
  original_position_id: string;
  trader: string;
  follower_count: string; // u64 as string
  timestamp: string; // u64 as string
}

export interface FlashLiquidationEvent {
  position_id: string;
  liquidator: string;
  borrowed_amount: string; // u64 as string
  liquidator_reward: string; // u64 as string
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

export interface AddCopyRelationArgs {
  registry: TransactionArgument; // CopyRelationRegistry object
  trader_address: TransactionArgument; // address
  follower_address: TransactionArgument; // address
  copy_ratio: TransactionArgument; // u64 (1-100)
  max_position_size: TransactionArgument; // u64 in USDC base units
}

export interface ExecuteCopyTradeArgs {
  original_position_id: TransactionArgument; // ID
  follower_margin: TransactionArgument; // Coin<USDC>
}

export interface LiquidatePositionArgs {
  position_id: TransactionArgument; // Position object
  current_price: TransactionArgument; // u64
  vault_id: TransactionArgument; // Vault object
}

export interface UpdateCopyRelationArgs {
  trader_address: TransactionArgument; // address
  new_copy_ratio: TransactionArgument; // u64 (basis points 1-10000)
  new_max_position_size: TransactionArgument; // u64
}

export interface DeactivateCopyRelationArgs {
  trader_address: TransactionArgument; // address
}

// ============================================================================
// Contract Addresses & Constants
// ============================================================================

export const USDC_TYPE = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC' as const;

export const CONTRACT_ADDRESSES = {
  PACKAGE_ID: '0xd3eef0b924f1699e54ef550515e44668269d0b102f20577067db1a2d2ad6c4f5',
  COPY_RELATION_REGISTRY_ID: '0x452e7b7822f255e40f5df3d075d18b292a72cd315502a744598d45fb6f580672',
  TRADING_BOT_REGISTRY_ID: '0x8e6259b5b745e2458d7ea67e78db20e07cc0c3d49ad662692b5e325a9b50ec51',
  POSITION_MODULE: 'position',
  VAULT_MODULE: 'vault',
  COPY_EXECUTOR_MODULE: 'copy_executor',
  TRADING_BOT_MODULE: 'trading_bot',
  EVENTS_MODULE: 'events',
  FLASH_LIQUIDATOR_MODULE: 'flash_liquidator',
  SUI_CLOCK_OBJECT_ID: '0x6',
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
export const MAX_LEVERAGE = 20;

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
