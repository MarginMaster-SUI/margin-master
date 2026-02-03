# MarginMaster - 後端架構設計

> **版本:** 2.0
> **日期:** 2026-02-02
> **狀態:** Ready for Implementation

---

## 📋 目錄

1. [服務概覽](#服務概覽)
2. [核心服務實現](#核心服務實現)
3. [事件處理系統](#事件處理系統)
4. [任務隊列與 Workers](#任務隊列與-workers)
5. [定時任務](#定時任務)
6. [錯誤處理](#錯誤處理)
7. [日誌與監控](#日誌與監控)

---

## 服務概覽

### 後端服務架構

```
┌─────────────────────────────────────────────┐
│          Express API Server (Port 3001)      │
│  ┌────────────┐  ┌────────────┐            │
│  │  REST API  │  │ WebSocket  │            │
│  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────┘
              ↓                ↓
┌─────────────────┐  ┌─────────────────┐
│  Event Indexer  │  │  Task Queue     │
│  (Sui Events)   │  │  (BullMQ)       │
└─────────────────┘  └─────────────────┘
              ↓                ↓
┌─────────────────────────────────────────────┐
│              Background Workers              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ Copy Trade   │  │ Risk Monitor │        │
│  │ Worker       │  │ Keeper       │        │
│  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ Leaderboard  │  │ Notification │        │
│  │ Calculator   │  │ Sender       │        │
│  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────┘
```

### 項目結構

```
backend/
├── src/
│   ├── api/                      # REST API
│   │   ├── routes/
│   │   │   ├── users.ts
│   │   │   ├── leaderboard.ts
│   │   │   ├── traders.ts
│   │   │   ├── copyTrades.ts
│   │   │   ├── trades.ts
│   │   │   ├── risk.ts
│   │   │   └── notifications.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rateLimit.ts
│   │   │   ├── validator.ts
│   │   │   └── errorHandler.ts
│   │   └── index.ts
│   │
│   ├── services/                 # 業務邏輯
│   │   ├── copyTrade/
│   │   │   ├── CopyTradeExecutor.ts
│   │   │   ├── CopyTradeValidator.ts
│   │   │   └── FeeCalculator.ts
│   │   ├── leaderboard/
│   │   │   ├── PerformanceCalculator.ts
│   │   │   └── Ranker.ts
│   │   ├── risk/
│   │   │   ├── RiskMonitor.ts
│   │   │   ├── AlertManager.ts
│   │   │   └── RiskEngine.ts
│   │   ├── notification/
│   │   │   └── NotificationService.ts
│   │   └── price/
│   │       └── PriceService.ts
│   │
│   ├── workers/                  # 後台任務
│   │   ├── copyTradeWorker.ts
│   │   ├── riskMonitorWorker.ts
│   │   ├── leaderboardWorker.ts
│   │   └── notificationWorker.ts
│   │
│   ├── indexers/                 # 事件監聽
│   │   ├── SuiEventListener.ts
│   │   └── EventProcessor.ts
│   │
│   ├── jobs/                     # 定時任務
│   │   ├── leaderboardJob.ts
│   │   ├── riskMonitorJob.ts
│   │   └── snapshotJob.ts
│   │
│   ├── lib/                      # 工具庫
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── suiClient.ts
│   │   ├── logger.ts
│   │   ├── cache.ts
│   │   └── queue.ts
│   │
│   ├── types/                    # TypeScript 類型
│   │   ├── api.ts
│   │   ├── events.ts
│   │   └── workers.ts
│   │
│   ├── config/                   # 配置
│   │   └── index.ts
│   │
│   ├── websocket/                # WebSocket
│   │   └── index.ts
│   │
│   └── index.ts                  # 入口文件
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 核心服務實現

### 1. 跟單執行服務

```typescript
// src/services/copyTrade/CopyTradeExecutor.ts

import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { NotificationService } from '../notification/NotificationService';
import { RiskEngine } from '../risk/RiskEngine';

export interface TradeSignal {
  leader: string;
  poolId: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  price?: string;
  quantity: string;
  leverage: number;
  timestamp: number;
}

export class CopyTradeExecutor {
  private suiClient: SuiClient;
  private notificationService: NotificationService;
  private riskEngine: RiskEngine;

  constructor() {
    this.suiClient = new SuiClient({ url: process.env.SUI_RPC_URL! });
    this.notificationService = new NotificationService();
    this.riskEngine = new RiskEngine(this.suiClient);
  }

  /**
   * 執行跟單
   */
  async executeCopyTrade(params: {
    leaderAddress: string;
    followerAddress: string;
    tradeSignal: TradeSignal;
  }): Promise<void> {
    const { leaderAddress, followerAddress, tradeSignal } = params;

    logger.info('Starting copy trade execution', {
      leader: leaderAddress,
      follower: followerAddress,
    });

    try {
      // 1. 獲取跟單關係
      const relation = await this.getCopyRelation(leaderAddress, followerAddress);
      if (!relation) {
        logger.warn('Copy relation not found or inactive', params);
        return;
      }

      // 2. 獲取 Follower 的 Margin Manager
      const followerManager = await this.getFollowerMarginManager(followerAddress);
      if (!followerManager) {
        throw new Error(`Follower ${followerAddress} has no Margin Manager`);
      }

      // 3. 檢查風險比率
      const riskMetrics = await this.riskEngine.calculateRiskMetrics(followerManager.id);
      if (riskMetrics.healthScore < 30) {
        logger.warn('Risk too high, skipping copy trade', {
          follower: followerAddress,
          healthScore: riskMetrics.healthScore,
        });

        await this.notificationService.sendCopyTradeSkipped({
          followerAddress,
          reason: 'RISK_TOO_HIGH',
          riskMetrics,
        });

        return;
      }

      // 4. 計算跟單規模
      const originalQuantity = BigInt(tradeSignal.quantity);
      const copiedQuantity = this.calculateCopySize(
        originalQuantity,
        relation.copyRatio,
        BigInt(relation.maxPositionSize)
      );

      if (copiedQuantity === 0n) {
        logger.info('Calculated copy size is 0, skipping');
        return;
      }

      // 5. 計算費用
      const positionValue = copiedQuantity * BigInt(tradeSignal.price || 0);
      const totalFee = (positionValue * BigInt(relation.feeRate)) / 10000n;

      // 6. 執行鏈上交易
      const txDigest = await this.executeOnChain({
        followerManager: followerManager.id,
        poolId: tradeSignal.poolId,
        side: tradeSignal.side,
        orderType: tradeSignal.orderType,
        price: tradeSignal.price,
        quantity: copiedQuantity.toString(),
        leverage: tradeSignal.leverage,
        fee: totalFee.toString(),
        relationId: relation.id,
      });

      logger.info('Copy trade executed successfully', { txDigest });

      // 7. 記錄到數據庫
      await this.recordExecution({
        relationId: relation.id,
        leaderAddress,
        followerAddress,
        poolId: tradeSignal.poolId,
        side: tradeSignal.side,
        orderType: tradeSignal.orderType,
        originalQuantity: originalQuantity.toString(),
        copiedQuantity: copiedQuantity.toString(),
        copyRatio: relation.copyRatio,
        feePaid: totalFee.toString(),
        txDigest,
        success: true,
      });

      // 8. 發送成功通知
      await this.notificationService.sendCopyTradeSuccess({
        followerAddress,
        leaderAddress,
        quantity: copiedQuantity.toString(),
        fee: totalFee.toString(),
        txDigest,
      });

    } catch (error: any) {
      logger.error('Copy trade execution failed', {
        error: error.message,
        stack: error.stack,
        params,
      });

      // 記錄失敗
      await this.recordFailure({
        leaderAddress,
        followerAddress,
        reason: error.message,
      });

      // 發送失敗通知
      await this.notificationService.sendCopyTradeFailed({
        followerAddress,
        reason: error.message,
      });

      throw error;
    }
  }

  /**
   * 執行鏈上交易
   */
  private async executeOnChain(params: {
    followerManager: string;
    poolId: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    price?: string;
    quantity: string;
    leverage: number;
    fee: string;
    relationId: string;
  }): Promise<string> {
    const tx = new TransactionBlock();

    // 準備費用支付
    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure(params.fee)]);

    // 執行 DeepBook Margin 交易
    if (params.orderType === 'MARKET') {
      tx.moveCall({
        target: `${process.env.DEEPBOOK_PACKAGE_ID}::pool_proxy::place_market_order`,
        arguments: [
          tx.object(params.followerManager),
          tx.object(params.poolId),
          tx.pure(params.quantity),
          tx.pure(params.side === 'BUY'),
        ],
      });
    } else {
      if (!params.price) throw new Error('Limit order requires price');

      tx.moveCall({
        target: `${process.env.DEEPBOOK_PACKAGE_ID}::pool_proxy::place_limit_order`,
        arguments: [
          tx.object(params.followerManager),
          tx.object(params.poolId),
          tx.pure(params.price),
          tx.pure(params.quantity),
          tx.pure(params.side === 'BUY'),
        ],
      });
    }

    // 記錄跟單執行
    tx.moveCall({
      target: `${process.env.MARGIN_MASTER_PACKAGE_ID}::copy_trade::record_copy_trade_execution`,
      arguments: [
        tx.object(params.relationId),
        tx.object('LEADER_PROFILE_ID'), // TODO: 需要查詢
        tx.object('FEE_CONFIG_ID'),
        feeCoin,
        tx.pure(params.quantity),
        tx.pure(params.quantity),
      ],
    });

    // 注意：實際需要 follower 的私鑰簽署
    // 在生產環境中應使用更安全的授權機制
    const result = await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      // TODO: 實現安全的簽署機制
      options: {
        showEffects: true,
      },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`Transaction failed: ${result.effects?.status?.error}`);
    }

    return result.digest;
  }

  /**
   * 計算跟單規模
   */
  private calculateCopySize(
    originalQty: bigint,
    copyRatio: number,
    maxPosition: bigint
  ): bigint {
    const calculated = (originalQty * BigInt(copyRatio)) / 10000n;
    return calculated > maxPosition ? maxPosition : calculated;
  }

  /**
   * 獲取跟單關係
   */
  private async getCopyRelation(leader: string, follower: string) {
    return await prisma.copyRelation.findFirst({
      where: {
        leader: { suiAddress: leader },
        follower: { suiAddress: follower },
        isActive: true,
      },
    });
  }

  /**
   * 獲取 Follower 的 Margin Manager
   */
  private async getFollowerMarginManager(address: string) {
    return await prisma.marginManager.findFirst({
      where: {
        user: { suiAddress: address },
        isActive: true,
      },
    });
  }

  /**
   * 記錄執行結果
   */
  private async recordExecution(data: any) {
    await prisma.copyTradeExecution.create({
      data: {
        relationId: data.relationId,
        leaderAddress: data.leaderAddress,
        followerAddress: data.followerAddress,
        poolId: data.poolId,
        side: data.side,
        orderType: data.orderType,
        originalQuantity: data.originalQuantity,
        copiedQuantity: data.copiedQuantity,
        copyRatio: data.copyRatio,
        feePaid: data.feePaid,
        protocolFee: '0', // TODO
        leaderFee: '0',   // TODO
        success: data.success,
        txDigest: data.txDigest,
      },
    });
  }

  /**
   * 記錄失敗
   */
  private async recordFailure(data: {
    leaderAddress: string;
    followerAddress: string;
    reason: string;
  }) {
    // TODO: 實現失敗記錄
  }
}
```

### 2. 風險監控服務

```typescript
// src/services/risk/RiskMonitor.ts

import { SuiClient } from '@mysten/sui.js/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { RiskEngine } from './RiskEngine';
import { AlertManager } from './AlertManager';

export class RiskMonitor {
  private suiClient: SuiClient;
  private riskEngine: RiskEngine;
  private alertManager: AlertManager;

  constructor() {
    this.suiClient = new SuiClient({ url: process.env.SUI_RPC_URL! });
    this.riskEngine = new RiskEngine(this.suiClient);
    this.alertManager = new AlertManager();
  }

  /**
   * 監控所有活躍倉位的風險
   */
  async monitorAllPositions(): Promise<void> {
    logger.info('Starting risk monitoring cycle');

    try {
      // 獲取所有活躍的 Margin Managers
      const managers = await prisma.marginManager.findMany({
        where: { isActive: true },
        include: { user: true },
      });

      logger.info(`Monitoring ${managers.length} margin managers`);

      // 並行檢查風險
      const results = await Promise.allSettled(
        managers.map(manager => this.checkManagerRisk(manager))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info('Risk monitoring cycle completed', {
        total: managers.length,
        successful,
        failed,
      });

    } catch (error: any) {
      logger.error('Risk monitoring cycle failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 檢查單個 Margin Manager 的風險
   */
  private async checkManagerRisk(manager: any): Promise<void> {
    try {
      // 計算風險指標
      const metrics = await this.riskEngine.calculateRiskMetrics(manager.id);

      // 更新數據庫
      await prisma.marginManager.update({
        where: { id: manager.id },
        data: {
          riskRatio: metrics.currentRiskRatio,
          healthScore: metrics.healthScore,
          liquidationPrice: metrics.liquidationPrice.toString(),
          lastSyncAt: new Date(),
        },
      });

      // 檢查是否需要發送警報
      if (metrics.healthScore < 30) {
        await this.alertManager.sendCriticalAlert({
          userAddress: manager.user.suiAddress,
          marginManagerId: manager.id,
          healthScore: metrics.healthScore,
          riskRatio: metrics.currentRiskRatio,
          liquidationPrice: metrics.liquidationPrice,
          message: '您的倉位接近清算！請立即減倉或增加保證金。',
        });
      } else if (metrics.healthScore < 50) {
        await this.alertManager.sendWarningAlert({
          userAddress: manager.user.suiAddress,
          marginManagerId: manager.id,
          healthScore: metrics.healthScore,
          message: '保證金使用率較高，請注意風險。',
        });
      }

    } catch (error: any) {
      logger.error('Failed to check manager risk', {
        managerId: manager.id,
        error: error.message,
      });
      throw error;
    }
  }
}
```

### 3. 績效計算服務

```typescript
// src/services/leaderboard/PerformanceCalculator.ts

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import Decimal from 'decimal.js';

export class PerformanceCalculator {
  /**
   * 計算交易者績效統計
   */
  async calculateTraderStats(userAddress: string): Promise<void> {
    logger.info('Calculating trader stats', { userAddress });

    try {
      // 獲取用戶
      const user = await prisma.user.findUnique({
        where: { suiAddress: userAddress },
      });

      if (!user) {
        throw new Error(`User ${userAddress} not found`);
      }

      // 獲取所有交易
      const trades = await prisma.trade.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });

      if (trades.length === 0) {
        logger.info('No trades found for user', { userAddress });
        return;
      }

      // 計算指標
      const stats = this.computeStats(trades);

      // 計算跟隨者數量
      const followerCount = await prisma.copyRelation.count({
        where: {
          leader: { suiAddress: userAddress },
          isActive: true,
        },
      });

      // 更新或創建 TraderProfile
      await prisma.traderProfile.upsert({
        where: { userId: user.id },
        update: {
          totalPnl: stats.totalPnl.toString(),
          winRate: stats.winRate.toString(),
          sharpeRatio: stats.sharpeRatio.toString(),
          maxDrawdown: stats.maxDrawdown.toString(),
          totalTrades: stats.totalTrades,
          winningTrades: stats.winningTrades,
          losingTrades: stats.losingTrades,
          last30DaysPnl: stats.last30DaysPnl.toString(),
          last30DaysTrades: stats.last30DaysTrades,
          totalFollowers: followerCount,
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          totalPnl: stats.totalPnl.toString(),
          winRate: stats.winRate.toString(),
          sharpeRatio: stats.sharpeRatio.toString(),
          maxDrawdown: stats.maxDrawdown.toString(),
          totalTrades: stats.totalTrades,
          winningTrades: stats.winningTrades,
          losingTrades: stats.losingTrades,
          last30DaysPnl: stats.last30DaysPnl.toString(),
          last30DaysTrades: stats.last30DaysTrades,
          totalFollowers: followerCount,
        },
      });

      logger.info('Trader stats updated', { userAddress, stats });

    } catch (error: any) {
      logger.error('Failed to calculate trader stats', {
        userAddress,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 計算統計指標
   */
  private computeStats(trades: any[]) {
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl && new Decimal(t.pnl).greaterThan(0));
    const losingTrades = trades.filter(t => t.pnl && new Decimal(t.pnl).lessThan(0));

    const totalPnl = trades.reduce(
      (sum, t) => sum.plus(new Decimal(t.pnl || 0)),
      new Decimal(0)
    );

    const winRate = totalTrades > 0
      ? new Decimal(winningTrades.length).div(totalTrades)
      : new Decimal(0);

    const maxDrawdown = this.calculateMaxDrawdown(trades);
    const sharpeRatio = this.calculateSharpeRatio(trades);

    // 最近 30 天
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTrades = trades.filter(t => new Date(t.createdAt) >= thirtyDaysAgo);
    const last30DaysPnl = recentTrades.reduce(
      (sum, t) => sum.plus(new Decimal(t.pnl || 0)),
      new Decimal(0)
    );

    return {
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      totalPnl,
      winRate,
      maxDrawdown,
      sharpeRatio,
      last30DaysPnl,
      last30DaysTrades: recentTrades.length,
    };
  }

  /**
   * 計算最大回撤
   */
  private calculateMaxDrawdown(trades: any[]): Decimal {
    let peak = new Decimal(0);
    let maxDrawdown = new Decimal(0);
    let cumulative = new Decimal(0);

    for (const trade of trades) {
      cumulative = cumulative.plus(new Decimal(trade.pnl || 0));

      if (cumulative.greaterThan(peak)) {
        peak = cumulative;
      }

      if (peak.greaterThan(0)) {
        const drawdown = peak.minus(cumulative).div(peak);
        if (drawdown.greaterThan(maxDrawdown)) {
          maxDrawdown = drawdown;
        }
      }
    }

    return maxDrawdown;
  }

  /**
   * 計算夏普比率（簡化版）
   */
  private calculateSharpeRatio(trades: any[]): Decimal {
    if (trades.length < 2) return new Decimal(0);

    const returns = trades.map(t => new Decimal(t.pnl || 0));
    const mean = returns.reduce((sum, r) => sum.plus(r), new Decimal(0))
      .div(returns.length);

    const variance = returns
      .reduce((sum, r) => sum.plus(r.minus(mean).pow(2)), new Decimal(0))
      .div(returns.length);

    const stdDev = variance.sqrt();

    if (stdDev.isZero()) return new Decimal(0);

    return mean.div(stdDev);
  }
}
```

---

## 事件處理系統

### Sui 事件監聽器

```typescript
// src/indexers/SuiEventListener.ts

import { SuiClient, SuiEvent } from '@mysten/sui.js/client';
import { logger } from '@/lib/logger';
import { EventProcessor } from './EventProcessor';

export class SuiEventListener {
  private suiClient: SuiClient;
  private eventProcessor: EventProcessor;
  private unsubscribe?: () => void;

  constructor() {
    this.suiClient = new SuiClient({ url: process.env.SUI_RPC_URL! });
    this.eventProcessor = new EventProcessor();
  }

  /**
   * 啟動事件監聽
   */
  async start(): Promise<void> {
    logger.info('Starting Sui event listener');

    try {
      // 監聽 LeaderTradeSignal 事件
      this.unsubscribe = await this.suiClient.subscribeEvent({
        filter: {
          MoveEventType: `${process.env.MARGIN_MASTER_PACKAGE_ID}::copy_trade::LeaderTradeSignal`
        },
        onMessage: (event: SuiEvent) => {
          this.handleLeaderTradeSignal(event);
        },
      });

      logger.info('Sui event listener started successfully');

    } catch (error: any) {
      logger.error('Failed to start event listener', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 停止事件監聽
   */
  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      logger.info('Sui event listener stopped');
    }
  }

  /**
   * 處理 Leader 交易信號
   */
  private async handleLeaderTradeSignal(event: SuiEvent): Promise<void> {
    try {
      const signal = event.parsedJson as any;

      logger.info('Received LeaderTradeSignal', {
        leader: signal.leader,
        quantity: signal.quantity,
      });

      // 交給事件處理器處理
      await this.eventProcessor.processLeaderTradeSignal(signal);

    } catch (error: any) {
      logger.error('Failed to handle LeaderTradeSignal', {
        error: error.message,
        event,
      });
    }
  }
}
```

### 事件處理器

```typescript
// src/indexers/EventProcessor.ts

import { prisma } from '@/lib/prisma';
import { copyTradeQueue } from '@/lib/queue';
import { logger } from '@/lib/logger';

export class EventProcessor {
  /**
   * 處理 Leader 交易信號
   */
  async processLeaderTradeSignal(signal: any): Promise<void> {
    logger.info('Processing LeaderTradeSignal', { leader: signal.leader });

    try {
      // 查詢該 Leader 的活躍 Followers
      const followers = await prisma.copyRelation.findMany({
        where: {
          leader: { suiAddress: signal.leader },
          isActive: true,
        },
        include: {
          follower: true,
        },
      });

      logger.info(`Found ${followers.length} active followers`);

      // 為每個 Follower 創建跟單任務
      const jobs = followers.map(relation => ({
        name: `copy-${signal.leader}-${relation.follower.suiAddress}`,
        data: {
          leaderAddress: signal.leader,
          followerAddress: relation.follower.suiAddress,
          relationId: relation.id,
          copyRatio: relation.copyRatio,
          maxPositionSize: relation.maxPositionSize.toString(),
          feeRate: relation.feeRate,
          tradeSignal: {
            poolId: signal.pool_id,
            side: signal.side ? 'BUY' : 'SELL',
            orderType: signal.order_type === 0 ? 'MARKET' : 'LIMIT',
            price: signal.price,
            quantity: signal.quantity.toString(),
            leverage: signal.leverage,
            timestamp: signal.timestamp,
          },
        },
      }));

      // 批量添加到隊列
      if (jobs.length > 0) {
        await copyTradeQueue.addBulk(jobs);
        logger.info(`Added ${jobs.length} copy trade jobs to queue`);
      }

    } catch (error: any) {
      logger.error('Failed to process LeaderTradeSignal', {
        error: error.message,
        signal,
      });
      throw error;
    }
  }
}
```

---

## 任務隊列與 Workers

### 隊列配置

```typescript
// src/lib/queue.ts

import { Queue } from 'bullmq';
import { redis } from './redis';

// 跟單執行隊列
export const copyTradeQueue = new Queue('copy-trade-execution', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 3600,
    },
    removeOnFail: {
      count: 1000,
      age: 86400,
    },
  },
});

// 風險監控隊列
export const riskMonitorQueue = new Queue('risk-monitor', {
  connection: redis,
});

// 排行榜計算隊列
export const leaderboardQueue = new Queue('leaderboard-calculation', {
  connection: redis,
});

// 通知隊列
export const notificationQueue = new Queue('notification', {
  connection: redis,
});
```

### 跟單 Worker

```typescript
// src/workers/copyTradeWorker.ts

import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { CopyTradeExecutor } from '@/services/copyTrade/CopyTradeExecutor';
import { logger } from '@/lib/logger';

const executor = new CopyTradeExecutor();

export const copyTradeWorker = new Worker(
  'copy-trade-execution',
  async (job: Job) => {
    const { leaderAddress, followerAddress, tradeSignal } = job.data;

    logger.info(`Processing copy trade job ${job.id}`, {
      leader: leaderAddress,
      follower: followerAddress,
    });

    try {
      await executor.executeCopyTrade({
        leaderAddress,
        followerAddress,
        tradeSignal,
      });

      return { status: 'success' };

    } catch (error: any) {
      logger.error(`Copy trade job ${job.id} failed`, {
        error: error.message,
      });
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 10,  // 並行處理 10 個任務
  }
);

// 監聽事件
copyTradeWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

copyTradeWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed`, {
    error: err.message,
  });
});

copyTradeWorker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});
```

---

## 定時任務

### 排行榜更新任務

```typescript
// src/jobs/leaderboardJob.ts

import { CronJob } from 'cron';
import { PerformanceCalculator } from '@/services/leaderboard/PerformanceCalculator';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

const calculator = new PerformanceCalculator();

/**
 * 每 5 分鐘更新一次排行榜
 */
export const leaderboardJob = new CronJob(
  '*/5 * * * *',
  async () => {
    logger.info('Starting leaderboard update');

    try {
      // 獲取所有交易者
      const traders = await prisma.user.findMany({
        where: {
          traderProfile: { isNot: null },
        },
      });

      logger.info(`Updating stats for ${traders.length} traders`);

      // 並行計算
      await Promise.allSettled(
        traders.map(trader => calculator.calculateTraderStats(trader.suiAddress))
      );

      // 清除排行榜快取
      const keys = await redis.keys('leaderboard:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      logger.info('Leaderboard update completed');

    } catch (error: any) {
      logger.error('Leaderboard update failed', {
        error: error.message,
      });
    }
  },
  null,
  true,  // start immediately
  'UTC'
);
```

### 風險監控任務

```typescript
// src/jobs/riskMonitorJob.ts

import { CronJob } from 'cron';
import { RiskMonitor } from '@/services/risk/RiskMonitor';
import { logger } from '@/lib/logger';

const monitor = new RiskMonitor();

/**
 * 每 30 秒檢查一次風險
 */
export const riskMonitorJob = new CronJob(
  '*/30 * * * * *',
  async () => {
    try {
      await monitor.monitorAllPositions();
    } catch (error: any) {
      logger.error('Risk monitor job failed', {
        error: error.message,
      });
    }
  },
  null,
  true,
  'UTC'
);
```

---

## 錯誤處理

### 全局錯誤處理器

```typescript
// src/api/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/lib/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // 未預期的錯誤
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    timestamp: new Date().toISOString(),
  });
}
```

---

## 日誌與監控

### 結構化日誌

```typescript
// src/lib/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
```

### Sentry 集成

```typescript
// src/lib/sentry.ts

import * as Sentry from '@sentry/node';

export function initSentry() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }
}
```

---

## 入口文件

```typescript
// src/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';

import { logger } from './lib/logger';
import { initSentry } from './lib/sentry';
import { errorHandler } from './api/middleware/errorHandler';
import routes from './api/routes';
import { setupWebSocket } from './websocket';

// Workers
import './workers/copyTradeWorker';

// Jobs
import { leaderboardJob } from './jobs/leaderboardJob';
import { riskMonitorJob } from './jobs/riskMonitorJob';

// Event Listener
import { SuiEventListener } from './indexers/SuiEventListener';

// 初始化 Sentry
initSentry();

const app = express();
const httpServer = createServer(app);

// 中間件
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// 路由
app.use('/api', routes);

// 錯誤處理
app.use(errorHandler);

// WebSocket
const io = setupWebSocket(httpServer);

// 啟動事件監聽器
const eventListener = new SuiEventListener();
eventListener.start();

// 啟動服務器
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('Workers started');
  logger.info('Event listener started');
  logger.info('Cron jobs started');
});

// 優雅關閉
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await eventListener.stop();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
```

---

**下一步閱讀**：
- [前端架構](./MarginMaster_Frontend.md)
- [AGI 開發指南](./MarginMaster_AGI_Guide.md)
