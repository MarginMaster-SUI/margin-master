/**
 * MarginMaster - Blockchain Event Indexer
 *
 * Subscribes to SUI blockchain events and synchronizes them to PostgreSQL database.
 * Handles: PositionOpened, PositionClosed, CopyTradeExecuted, Liquidation events
 */

import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { prisma } from '../lib/prisma.js';
import pino from 'pino';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const logger = pino({ name: 'blockchain-indexer' });

// Event type from GraphQL response
interface SuiEvent {
  id: { txDigest: string };
  parsedJson: Record<string, unknown>;
}

// Configuration
const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';
const MARGIN_MASTER_PACKAGE_ID = process.env.MARGIN_MASTER_PACKAGE_ID || '0x0';
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

// Cursor persistence file path
const CURSOR_FILE = join(dirname(fileURLToPath(import.meta.url)), '../../.indexer-cursors.json');

function loadCursors(): Record<string, string> {
  try {
    if (existsSync(CURSOR_FILE)) {
      return JSON.parse(readFileSync(CURSOR_FILE, 'utf-8'));
    }
  } catch (e) {
    logger.warn({ error: e }, 'Failed to load cursors, starting fresh');
  }
  return {};
}

function saveCursor(eventType: string, cursor: string) {
  try {
    const cursors = loadCursors();
    cursors[eventType] = cursor;
    writeFileSync(CURSOR_FILE, JSON.stringify(cursors, null, 2));
  } catch (e) {
    logger.warn({ error: e }, 'Failed to persist cursor');
  }
}

// SUI Client instance
let suiClient: SuiGraphQLClient;

/**
 * Initialize SUI GraphQL client connection
 */
export function initializeSuiClient(): SuiGraphQLClient {
  const networkUrl = getSuiGraphQLUrl(SUI_NETWORK);
  suiClient = new SuiGraphQLClient({ url: networkUrl, network: SUI_NETWORK });
  logger.info({ network: SUI_NETWORK, url: networkUrl }, 'SUI GraphQL client initialized');
  return suiClient;
}

/**
 * Get SUI network URL based on environment
 */
function getSuiGraphQLUrl(network: string): string {
  switch (network) {
    case 'mainnet':
      return 'https://sui-mainnet.mystenlabs.com/graphql';
    case 'testnet':
      return 'https://sui-testnet.mystenlabs.com/graphql';
    case 'devnet':
      return 'https://sui-devnet.mystenlabs.com/graphql';
    default:
      return 'https://sui-testnet.mystenlabs.com/graphql';
  }
}

/**
 * Event type definitions matching Move structs
 */
interface PositionOpenedEvent {
  position_id: string;
  owner: string;
  trading_pair: number[]; // bytes
  position_type: number;
  entry_price: string;
  quantity: string;
  leverage: number;
  margin: string;
  timestamp: string;
}

interface PositionClosedEvent {
  position_id: string;
  owner: string;
  close_price: string;
  pnl: string;
  is_profit: boolean;
  timestamp: string;
}

interface CopyTradeExecutedEvent {
  original_position_id: string;
  follower_position_id: string;
  trader: string;
  follower: string;
  copy_ratio: string;
  timestamp: string;
}

interface LiquidationEvent {
  position_id: string;
  owner: string;
  liquidation_price: string;
  loss: string;
  timestamp: string;
}

interface BatchCopyTradeExecutedEvent {
  original_position_id: string;
  trader: string;
  follower_count: string;
  timestamp: string;
}

interface FlashLiquidationEvent {
  position_id: string;
  liquidator: string;
  borrowed_amount: string;
  liquidator_reward: string;
  timestamp: string;
}

/**
 * Handle PositionOpened event
 */
async function handlePositionOpened(event: SuiEvent) {
  try {
    const data = event.parsedJson as unknown as PositionOpenedEvent;

    logger.info({ positionId: data.position_id, owner: data.owner }, 'Processing PositionOpened event');

    // Convert bytes to string for trading pair (with validation)
    const tradingPairBytes = data.trading_pair;
    if (!Array.isArray(tradingPairBytes) || tradingPairBytes.length === 0 || tradingPairBytes.some(b => typeof b !== 'number' || b < 0 || b > 127)) {
      logger.warn({ tradingPairBytes }, 'Invalid trading pair bytes, skipping event');
      return;
    }
    const tradingPairStr = String.fromCharCode(...tradingPairBytes);

    // Find or create user by SUI address
    const user = await prisma.user.upsert({
      where: { suiAddress: data.owner },
      create: {
        suiAddress: data.owner,
        username: `trader_${data.owner.slice(0, 8)}`,
        email: `${data.owner.slice(0, 8)}@generated.com`,
      },
      update: {},
    });

    // Find or create trading pair
    const tradingPair = await prisma.tradingPair.upsert({
      where: { symbol: tradingPairStr },
      create: {
        symbol: tradingPairStr,
        baseAsset: tradingPairStr.split('/')[0] || 'BTC',
        quoteAsset: tradingPairStr.split('/')[1] || 'USDC',
        isActive: true,
        minQuantity: 0.001, // Minimum 0.001 units (e.g., 0.001 BTC)
        maxLeverage: 100, // Maximum 100x leverage
      },
      update: {},
    });

    // Create position in database
    await prisma.position.create({
      data: {
        userId: user.id,
        tradingPairId: tradingPair.id,
        positionType: data.position_type === 0 ? 'LONG' : 'SHORT',
        entryPrice: parseFloat(data.entry_price) / 1000000, // Convert from 6 decimals
        quantity: parseFloat(data.quantity) / 1000000,
        leverage: data.leverage,
        margin: parseFloat(data.margin) / 1000000,
        status: 'OPEN',
        isCopyTrade: false,
        onChainPositionId: data.position_id,
        txHash: event.id.txDigest,
      },
    });

    // Check for copy relations and execute copy trades
    const followers = await prisma.copyRelation.findMany({
      where: {
        trader: { suiAddress: data.owner },
        isActive: true,
      },
      include: {
        follower: true,
      },
    });

    logger.info({ followerCount: followers.length }, 'Found active copy relations');

    // Note: Copy trade execution is handled by the CopyTradeExecuted event
    // This just logs the potential copies

    logger.info({ positionId: data.position_id }, 'PositionOpened event processed successfully');
  } catch (error) {
    logger.error({ error, event }, 'Error handling PositionOpened event');
    throw error;
  }
}

/**
 * Handle PositionClosed event
 */
async function handlePositionClosed(event: SuiEvent) {
  try {
    const data = event.parsedJson as unknown as PositionClosedEvent;

    logger.info({ positionId: data.position_id }, 'Processing PositionClosed event');

    // Update position status
    const position = await prisma.position.findFirst({
      where: { onChainPositionId: data.position_id },
    });

    if (!position) {
      logger.warn({ positionId: data.position_id }, 'Position not found in database');
      return;
    }

    await prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'CLOSED',
        currentPrice: parseFloat(data.close_price) / 1000000,
        realizedPnL: data.is_profit
          ? parseFloat(data.pnl) / 1000000
          : -parseFloat(data.pnl) / 1000000,
        closedAt: new Date(parseInt(data.timestamp)),
      },
    });

    // Create trade record
    await prisma.trade.create({
      data: {
        userId: position.userId,
        positionId: position.id,
        tradingPairId: position.tradingPairId,
        tradeType: 'CLOSE',
        side: position.positionType,
        price: parseFloat(data.close_price) / 1000000,
        quantity: position.quantity,
        value: position.quantity * (parseFloat(data.close_price) / 1000000),
        fee: 0, // No fee for closing positions
        pnl: data.is_profit
          ? parseFloat(data.pnl) / 1000000
          : -parseFloat(data.pnl) / 1000000,
        txHash: event.id.txDigest,
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: position.userId,
        type: 'POSITION_CLOSED',
        title: 'Position Closed',
        message: `Your ${position.positionType} position closed with ${data.is_profit ? 'profit' : 'loss'}: $${(parseFloat(data.pnl) / 1000000).toFixed(2)}`,
        isRead: false,
      },
    });

    logger.info({ positionId: data.position_id, pnl: data.pnl, isProfit: data.is_profit }, 'PositionClosed event processed successfully');
  } catch (error) {
    logger.error({ error, event }, 'Error handling PositionClosed event');
    throw error;
  }
}

/**
 * Handle CopyTradeExecuted event
 */
async function handleCopyTradeExecuted(event: SuiEvent) {
  try {
    const data = event.parsedJson as unknown as CopyTradeExecutedEvent;

    logger.info({
      originalPositionId: data.original_position_id,
      followerPositionId: data.follower_position_id
    }, 'Processing CopyTradeExecuted event');

    // Find original position
    const originalPosition = await prisma.position.findFirst({
      where: { onChainPositionId: data.original_position_id },
      include: { tradingPair: true },
    });

    if (!originalPosition) {
      logger.warn({ positionId: data.original_position_id }, 'Original position not found');
      return;
    }

    // Find follower user
    const follower = await prisma.user.findFirst({
      where: { suiAddress: data.follower },
    });

    if (!follower) {
      logger.warn({ followerAddress: data.follower }, 'Follower user not found');
      return;
    }

    // Calculate copy trade size based on ratio
    const copyRatio = parseFloat(data.copy_ratio) / 10000; // Convert from basis points
    const followerQuantity = originalPosition.quantity * copyRatio;
    const followerMargin = originalPosition.margin * copyRatio;

    // Create follower position
    await prisma.position.create({
      data: {
        userId: follower.id,
        tradingPairId: originalPosition.tradingPairId,
        positionType: originalPosition.positionType,
        entryPrice: originalPosition.entryPrice,
        quantity: followerQuantity,
        leverage: originalPosition.leverage,
        margin: followerMargin,
        status: 'OPEN',
        isCopyTrade: true,
        originalPositionId: originalPosition.id,
        onChainPositionId: data.follower_position_id,
        txHash: event.id.txDigest,
      },
    });

    // Create notification for follower
    await prisma.notification.create({
      data: {
        userId: follower.id,
        type: 'COPY_TRADE_EXECUTED',
        title: 'Copy Trade Executed',
        message: `Copied ${originalPosition.positionType} position on ${originalPosition.tradingPair.symbol} with ${(copyRatio * 100).toFixed(0)}% ratio`,
        isRead: false,
      },
    });

    logger.info({
      followerPositionId: data.follower_position_id,
      copyRatio: copyRatio * 100
    }, 'CopyTradeExecuted event processed successfully');
  } catch (error) {
    logger.error({ error, event }, 'Error handling CopyTradeExecuted event');
    throw error;
  }
}

/**
 * Handle Liquidation event
 */
async function handleLiquidation(event: SuiEvent) {
  try {
    const data = event.parsedJson as unknown as LiquidationEvent;

    logger.info({ positionId: data.position_id }, 'Processing Liquidation event');

    // Find position
    const position = await prisma.position.findFirst({
      where: { onChainPositionId: data.position_id },
    });

    if (!position) {
      logger.warn({ positionId: data.position_id }, 'Position not found for liquidation');
      return;
    }

    // Update position status
    await prisma.position.update({
      where: { id: position.id },
      data: {
        status: 'LIQUIDATED',
        currentPrice: parseFloat(data.liquidation_price) / 1000000,
        realizedPnL: -parseFloat(data.loss) / 1000000,
        closedAt: new Date(parseInt(data.timestamp)),
      },
    });

    // Create trade record
    await prisma.trade.create({
      data: {
        userId: position.userId,
        positionId: position.id,
        tradingPairId: position.tradingPairId,
        tradeType: 'LIQUIDATION',
        side: position.positionType,
        price: parseFloat(data.liquidation_price) / 1000000,
        quantity: position.quantity,
        value: position.quantity * (parseFloat(data.liquidation_price) / 1000000),
        fee: 0, // No fee for liquidations
        pnl: -parseFloat(data.loss) / 1000000,
        txHash: event.id.txDigest,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: position.userId,
        type: 'POSITION_LIQUIDATED',
        title: 'Position Liquidated',
        message: `Your ${position.positionType} position was liquidated at $${(parseFloat(data.liquidation_price) / 1000000).toFixed(2)}. Loss: $${(parseFloat(data.loss) / 1000000).toFixed(2)}`,
        isRead: false,
      },
    });

    logger.info({ positionId: data.position_id, loss: data.loss }, 'Liquidation event processed successfully');
  } catch (error) {
    logger.error({ error, event }, 'Error handling Liquidation event');
    throw error;
  }
}

/**
 * Handle BatchCopyTradeExecuted event
 */
async function handleBatchCopyTradeExecuted(event: SuiEvent) {
  try {
    const data = event.parsedJson as unknown as BatchCopyTradeExecutedEvent;

    logger.info({
      originalPositionId: data.original_position_id,
      trader: data.trader,
      followerCount: data.follower_count,
    }, 'Processing BatchCopyTradeExecuted event');

    // Find trader user
    const trader = await prisma.user.findFirst({
      where: { suiAddress: data.trader },
    });

    if (!trader) {
      logger.warn({ traderAddress: data.trader }, 'Trader user not found for batch event');
      return;
    }

    // Create notification for trader
    await prisma.notification.create({
      data: {
        userId: trader.id,
        type: 'COPY_TRADE_EXECUTED',
        title: 'Batch Copy Trades Executed',
        message: `${data.follower_count} followers copied your trade`,
        isRead: false,
      },
    });

    logger.info({
      originalPositionId: data.original_position_id,
      followerCount: data.follower_count,
    }, 'BatchCopyTradeExecuted event processed successfully');
  } catch (error) {
    logger.error({ error, event }, 'Error handling BatchCopyTradeExecuted event');
    throw error;
  }
}

/**
 * Handle FlashLiquidation event
 */
async function handleFlashLiquidation(event: SuiEvent) {
  try {
    const data = event.parsedJson as unknown as FlashLiquidationEvent;

    logger.info({
      positionId: data.position_id,
      liquidator: data.liquidator,
    }, 'Processing FlashLiquidation event');

    // Find position
    const position = await prisma.position.findFirst({
      where: { onChainPositionId: data.position_id },
    });

    if (!position) {
      logger.warn({ positionId: data.position_id }, 'Position not found for flash liquidation');
      return;
    }

    // Update position status (may already be LIQUIDATED from Liquidation event)
    if (position.status !== 'LIQUIDATED') {
      await prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'LIQUIDATED',
          closedAt: new Date(parseInt(data.timestamp)),
        },
      });
    }

    // Create trade record for flash liquidation
    await prisma.trade.create({
      data: {
        userId: position.userId,
        positionId: position.id,
        tradingPairId: position.tradingPairId,
        tradeType: 'LIQUIDATION',
        side: position.positionType,
        price: position.entryPrice, // flash liquidation doesn't have a separate price field
        quantity: position.quantity,
        value: position.quantity * position.entryPrice,
        fee: parseFloat(data.liquidator_reward) / 1000000,
        pnl: -position.margin, // full margin loss on flash liquidation
        txHash: event.id.txDigest,
      },
    });

    // Create notification for position owner
    await prisma.notification.create({
      data: {
        userId: position.userId,
        type: 'POSITION_LIQUIDATED',
        title: 'Position Flash Liquidated',
        message: `Your ${position.positionType} position was flash liquidated. Liquidator reward: $${(parseFloat(data.liquidator_reward) / 1000000).toFixed(2)}`,
        isRead: false,
      },
    });

    logger.info({
      positionId: data.position_id,
      borrowedAmount: data.borrowed_amount,
      liquidatorReward: data.liquidator_reward,
    }, 'FlashLiquidation event processed successfully');
  } catch (error) {
    logger.error({ error, event }, 'Error handling FlashLiquidation event');
    throw error;
  }
}

/**
 * Query events from blockchain using GraphQL
 */
async function queryEvents(eventType: string, cursor?: string) {
  const eventTypeFilter = `${MARGIN_MASTER_PACKAGE_ID}::events::${eventType}`;

  try {
    const query = `
      query QueryEvents($eventType: String!, $after: String, $limit: Int) {
        events(
          filter: { eventType: $eventType }
          after: $after
          first: $limit
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            sendingModule { name }
            type { repr }
            json
            timestamp
            bcs
          }
        }
      }
    `;

    const result = await suiClient.query({
      query,
      variables: {
        eventType: eventTypeFilter,
        after: cursor || null,
        limit: 50,
      },
    });

    const events = (result.data as any)?.events;

    return {
      data: (events?.nodes || []).map((node: any) => ({
        id: { txDigest: node.timestamp || '' },
        parsedJson: node.json ? JSON.parse(node.json) : {},
      })),
      hasNextPage: events?.pageInfo?.hasNextPage || false,
      nextCursor: events?.pageInfo?.endCursor || undefined,
    };
  } catch (error) {
    logger.error({ error, eventType }, 'Error querying events');
    throw error;
  }
}

/**
 * Process events of a specific type
 */
async function processEvents(eventType: string, handler: (event: SuiEvent) => Promise<void>) {
  const cursors = loadCursors();
  let cursor: string | undefined = cursors[eventType];
  let hasMore = true;

  while (hasMore) {
    try {
      const result = await queryEvents(eventType, cursor);

      for (const event of result.data) {
        await handler(event);
      }

      hasMore = result.hasNextPage;
      cursor = result.nextCursor;

      // Persist cursor after each batch to survive restarts
      if (cursor) {
        saveCursor(eventType, cursor);
      }

      if (result.data.length > 0) {
        logger.info({
          eventType,
          processedCount: result.data.length,
          hasMore,
        }, 'Processed event batch');
      }
    } catch (error) {
      logger.error({ error, eventType }, 'Error processing events');
      break;
    }
  }
}

/**
 * Main indexer loop
 */
export async function startIndexer() {
  logger.info('Starting blockchain event indexer...');

  if (!suiClient) {
    initializeSuiClient();
  }

  // Event type to handler mapping
  const eventHandlers = {
    'PositionOpened': handlePositionOpened,
    'PositionClosed': handlePositionClosed,
    'CopyTradeExecuted': handleCopyTradeExecuted,
    'Liquidation': handleLiquidation,
    'BatchCopyTradeExecuted': handleBatchCopyTradeExecuted,
    'FlashLiquidation': handleFlashLiquidation,
  };

  // Main polling loop
  while (true) {
    try {
      logger.info('Polling for new events...');

      // Process each event type
      for (const [eventType, handler] of Object.entries(eventHandlers)) {
        await processEvents(eventType, handler);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (error) {
      logger.error({ error }, 'Error in indexer main loop');
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS * 2)); // Wait longer on error
    }
  }
}

/**
 * Graceful shutdown
 */
export async function stopIndexer() {
  logger.info('Stopping blockchain event indexer...');
  await prisma.$disconnect();
  logger.info('Indexer stopped');
}

// Handle process termination
process.on('SIGINT', async () => {
  await stopIndexer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopIndexer();
  process.exit(0);
});
