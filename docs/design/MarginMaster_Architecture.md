# MarginMaster - 系統架構設計

> **版本:** 2.0
> **日期:** 2026-02-02
> **狀態:** Ready for Implementation

---

## 📋 目錄

1. [架構概覽](#架構概覽)
2. [技術棧詳解](#技術棧詳解)
3. [數據流設計](#數據流設計)
4. [模組劃分](#模組劃分)
5. [基礎設施](#基礎設施)
6. [安全性設計](#安全性設計)
7. [性能優化](#性能優化)
8. [監控與日誌](#監控與日誌)

---

## 架構概覽

### 高層架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                        用戶界面層 (Web App)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │交易面板  │  │排行榜    │  │跟單管理  │  │風險儀表板│         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │個人檔案  │  │通知中心  │  │模擬模式  │  │設置頁面  │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS/WSS
┌─────────────────────────────────────────────────────────────────┐
│                  應用邏輯層 (React + TypeScript)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │全局狀態  │  │API客戶端 │  │錢包管理  │  │事件訂閱  │         │
│  │(Zustand) │  │(React    │  │(@mysten/ │  │(SuiClient│         │
│  │          │  │ Query)   │  │ dapp-kit)│  │ Events)  │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │風險引擎  │  │圖表組件  │  │本地快取  │  │錯誤處理  │         │
│  │(Client)  │  │(Recharts)│  │(IndexedDB│  │(Sentry)  │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↕ JSON-RPC / REST
┌─────────────────────────────────────────────────────────────────┐
│                      後端服務層 (Node.js)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │REST API  │  │事件索引器│  │排行榜    │  │通知服務  │         │
│  │Server    │  │(Sui      │  │計算器    │  │(Novu)    │         │
│  │(Express) │  │ Events)  │  │(Cron)    │  │          │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │跟單執行器│  │價格服務  │  │風險監控  │  │分析服務  │         │
│  │(BullMQ   │  │(Pyth +   │  │Keeper    │  │(Mixpanel)│         │
│  │ Worker)  │  │ DeepBook)│  │          │  │          │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↕ SQL / Redis
┌─────────────────────────────────────────────────────────────────┐
│                      數據存儲層                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐              │
│  │  PostgreSQL 16       │  │  Redis 7.2           │              │
│  │  ┌────────────────┐  │  │  ┌────────────────┐ │              │
│  │  │用戶表          │  │  │  │排行榜快取      │ │              │
│  │  │跟單關係表      │  │  │  │實時價格        │ │              │
│  │  │交易記錄表      │  │  │  │任務隊列        │ │              │
│  │  │績效統計表      │  │  │  │會話數據        │ │              │
│  │  └────────────────┘  │  │  └────────────────┘ │              │
│  └──────────────────────┘  └──────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Move Calls
┌─────────────────────────────────────────────────────────────────┐
│                   智能合約層 (Sui Move)                            │
│  ┌────────────────────────────────────────────────────┐          │
│  │  margin_master Package                              │          │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │          │
│  │  │copy_trade│  │trader_   │  │fee_      │         │          │
│  │  │          │  │profile   │  │manager   │         │          │
│  │  └──────────┘  └──────────┘  └──────────┘         │          │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │          │
│  │  │risk_     │  │emergency_│  │user_     │         │          │
│  │  │checker   │  │pause     │  │registry  │         │          │
│  │  └──────────┘  └──────────┘  └──────────┘         │          │
│  └────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Margin Calls
┌─────────────────────────────────────────────────────────────────┐
│                    DeepBook Margin Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │Margin    │  │Pool      │  │Order     │  │Liquidation│        │
│  │Manager   │  │Proxy     │  │Book      │  │Engine     │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                   數據索引層 (混合方案)                            │
│  ┌──────────────────────┐  ┌──────────────────────┐              │
│  │ Surflux Indexer      │  │ 自建事件索引器       │              │
│  │ ┌────────────────┐   │  │ ┌────────────────┐   │              │
│  │ │DeepBook 交易   │   │  │ │跟單事件        │   │              │
│  │ │價格行情        │   │  │ │風險事件        │   │              │
│  │ │流動性數據      │   │  │ │績效更新        │   │              │
│  │ └────────────────┘   │  │ └────────────────┘   │              │
│  └──────────────────────┘  └──────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      外部服務層                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │Pyth      │  │Sui RPC   │  │IPFS      │  │Novu      │         │
│  │Oracle    │  │Node      │  │(Pinata)  │  │Notification       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### 架構設計原則

#### 1. 分層架構 (Layered Architecture)

**目標**：職責分離，降低耦合

```
展示層 (Presentation)
    ↓ 只調用應用層
應用層 (Application)
    ↓ 只調用領域層
領域層 (Domain / Smart Contracts)
    ↓ 只調用基礎設施層
基礎設施層 (Infrastructure)
```

**優勢**：
- ✅ 每層可獨立測試
- ✅ 易於替換實現
- ✅ 清晰的依賴方向

#### 2. 事件驅動架構 (Event-Driven)

**核心理念**：通過事件解耦模組

```
事件發布者 → 事件總線 → 事件訂閱者
    ↓
不需要知道訂閱者的存在
```

**應用場景**：
- Leader 交易 → 跟單執行
- 風險變化 → 通知推送
- 績效更新 → 排行榜刷新

**優勢**：
- ✅ 高度解耦
- ✅ 易於擴展
- ✅ 異步處理

#### 3. 微服務化 (Microservices-Ready)

**當前狀態**：單體應用（Hackathon）

**未來演進**：
```
Phase 1 (現在)：
└─ Monolith (Express + Workers)

Phase 2 (3-6 個月)：
├─ API Gateway
├─ Trading Service
├─ Copy Trade Service
├─ Analytics Service
└─ Notification Service
```

---

## 技術棧詳解

### 前端技術棧

#### 核心框架

**React 18.2+ with TypeScript**

選擇理由：
- ✅ 成熟的生態系統
- ✅ 優秀的 TypeScript 支持
- ✅ 豐富的 Sui 錢包集成庫
- ✅ 團隊熟悉度高

替代方案考慮：
- ❌ Vue 3：Sui 生態集成較少
- ❌ Svelte：生態系統較小
- ⚠️ Next.js：考慮用於 SSR 優化（Phase 2）

#### 構建工具

**Vite 5.0+**

選擇理由：
- ✅ 極快的冷啟動速度
- ✅ 熱模塊替換 (HMR)
- ✅ 原生 TypeScript 支持
- ✅ 優化的生產構建

配置示例：
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(), // Sui SDK 需要
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    include: ['@mysten/sui.js'],
  },
});
```

#### 狀態管理

**1. 全局狀態：Zustand 4.4+**

選擇理由：
- ✅ 輕量級（~1KB）
- ✅ 無需 Provider 包裹
- ✅ TypeScript 友好
- ✅ DevTools 支持

架構設計：
```typescript
// store/index.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppState {
  // 用戶狀態
  user: User | null;
  setUser: (user: User | null) => void;

  // 錢包狀態
  walletAddress: string | null;
  isWalletConnected: boolean;

  // UI 狀態
  isDemoMode: boolean;
  toggleDemoMode: () => void;

  // 通知
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        setUser: (user) => set({ user }),

        walletAddress: null,
        isWalletConnected: false,

        isDemoMode: false,
        toggleDemoMode: () => set((state) => ({
          isDemoMode: !state.isDemoMode
        })),

        notifications: [],
        addNotification: (notification) => set((state) => ({
          notifications: [...state.notifications, notification]
        })),
      }),
      { name: 'margin-master-storage' }
    )
  )
);
```

**2. 服務端狀態：TanStack Query 5.0+**

選擇理由：
- ✅ 自動快取管理
- ✅ 後台重新驗證
- ✅ 樂觀更新
- ✅ 無限滾動支持

使用模式：
```typescript
// hooks/useLeaderboard.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useLeaderboard(params?: LeaderboardParams) {
  return useQuery({
    queryKey: ['leaderboard', params],
    queryFn: () => api.getLeaderboard(params),
    staleTime: 30_000, // 30 秒內認為數據新鮮
    refetchInterval: 60_000, // 每分鐘刷新
  });
}

export function useTraderProfile(address: string) {
  return useQuery({
    queryKey: ['trader', address],
    queryFn: () => api.getTraderProfile(address),
    enabled: !!address,
  });
}
```

**3. 表單狀態：React Hook Form 7.48+**

選擇理由：
- ✅ 性能優異（非受控組件）
- ✅ 與 Zod 完美集成
- ✅ 靈活的驗證規則

使用示例：
```typescript
// components/OrderForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const orderSchema = z.object({
  quantity: z.number().positive('數量必須大於 0'),
  price: z.number().positive().optional(),
  leverage: z.number().min(1).max(10),
  stopLoss: z.number().positive().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

export function OrderForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
  });

  const onSubmit = (data: OrderFormData) => {
    // 處理提交
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* 表單字段 */}
    </form>
  );
}
```

#### 錢包集成

**@mysten/dapp-kit 0.14+**

架構設計：
```typescript
// App.tsx
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const networks = {
  devnet: { url: getFullnodeUrl('devnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <Router />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

自定義 Hook：
```typescript
// hooks/useWallet.ts
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';

export function useWallet() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransactionBlock();

  const executeTransaction = async (tx: TransactionBlock) => {
    if (!account) {
      throw new Error('錢包未連接');
    }

    const result = await signAndExecute({
      transactionBlock: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    if (result.effects?.status?.status !== 'success') {
      throw new Error(`交易失敗: ${result.effects?.status?.error}`);
    }

    return result;
  };

  return {
    address: account?.address,
    isConnected: !!account,
    executeTransaction,
  };
}
```

---

### 後端技術棧

#### 運行時與框架

**Node.js 20 LTS + Express 4.18**

項目結構：
```
backend/
├── src/
│   ├── api/               # REST API 路由
│   │   ├── routes/
│   │   │   ├── leaderboard.ts
│   │   │   ├── traders.ts
│   │   │   ├── copy-trades.ts
│   │   │   └── risk.ts
│   │   └── middleware/
│   │       ├── auth.ts
│   │       ├── rateLimit.ts
│   │       └── errorHandler.ts
│   ├── services/          # 業務邏輯
│   │   ├── copyTrade/
│   │   │   ├── executor.ts
│   │   │   ├── validator.ts
│   │   │   └── calculator.ts
│   │   ├── leaderboard/
│   │   │   ├── calculator.ts
│   │   │   └── ranker.ts
│   │   ├── risk/
│   │   │   ├── monitor.ts
│   │   │   └── alerter.ts
│   │   └── notification/
│   │       └── sender.ts
│   ├── workers/           # 後台任務
│   │   ├── copyTradeWorker.ts
│   │   ├── riskMonitorWorker.ts
│   │   └── leaderboardWorker.ts
│   ├── indexers/          # 事件監聽
│   │   ├── suiEventListener.ts
│   │   └── deepbookIndexer.ts
│   ├── lib/               # 工具庫
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── suiClient.ts
│   │   └── logger.ts
│   ├── types/             # TypeScript 類型
│   └── config/            # 配置文件
├── prisma/
│   └── schema.prisma
├── tests/
└── package.json
```

Express 配置：
```typescript
// src/api/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';
import routes from './routes';

const app = express();

// 中間件
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(compression());
app.use(express.json());
app.use(rateLimit);

// 路由
app.use('/api', routes);

// 錯誤處理
app.use(errorHandler);

export default app;
```

#### 任務隊列

**BullMQ 5.0+ with Redis**

架構設計：
```typescript
// lib/queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from './redis';

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
      age: 3600, // 1 小時
    },
    removeOnFail: {
      count: 1000,
      age: 86400, // 24 小時
    },
  },
});

export const riskMonitorQueue = new Queue('risk-monitor', {
  connection: redis,
});

export const leaderboardQueue = new Queue('leaderboard-calculation', {
  connection: redis,
});
```

Worker 實現：
```typescript
// workers/copyTradeWorker.ts
import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { CopyTradeExecutor } from '@/services/copyTrade/executor';

const executor = new CopyTradeExecutor();

export const copyTradeWorker = new Worker(
  'copy-trade-execution',
  async (job: Job) => {
    const { leaderAddress, followerAddress, tradeSignal } = job.data;

    try {
      await executor.executeCopyTrade({
        leaderAddress,
        followerAddress,
        tradeSignal,
      });

      return { status: 'success' };
    } catch (error) {
      console.error('跟單執行失敗:', error);
      throw error; // 觸發重試
    }
  },
  {
    connection: redis,
    concurrency: 10, // 並行處理
  }
);

// 監聽事件
copyTradeWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

copyTradeWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});
```

#### 數據庫

**PostgreSQL 16 with Prisma 5.7**

Prisma Schema 示例：
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String   @id @default(uuid())
  suiAddress      String   @unique
  username        String?
  email           String?
  avatarUrl       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // 關聯
  traderProfile   TraderProfile?
  copyRelationsAsLeader   CopyRelation[] @relation("Leader")
  copyRelationsAsFollower CopyRelation[] @relation("Follower")
  trades          Trade[]
}

model TraderProfile {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])

  totalFollowers  Int      @default(0)
  totalPnl        Decimal  @default(0) @db.Decimal(20, 8)
  winRate         Decimal  @default(0) @db.Decimal(5, 4)
  maxDrawdown     Decimal  @default(0) @db.Decimal(5, 4)
  totalTrades     Int      @default(0)
  winningTrades   Int      @default(0)

  isVerified      Boolean  @default(false)
  tier            Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([totalPnl(sort: Desc)])
  @@index([winRate(sort: Desc)])
}

model CopyRelation {
  id                String   @id @default(uuid())

  leaderId          String
  leader            User     @relation("Leader", fields: [leaderId], references: [id])

  followerId        String
  follower          User     @relation("Follower", fields: [followerId], references: [id])

  copyRatio         Int      // Basis points (0-10000)
  maxPositionSize   Decimal  @db.Decimal(20, 8)
  feeRate           Int      // Basis points

  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // 關聯
  executions        CopyTradeExecution[]

  @@unique([leaderId, followerId])
  @@index([leaderId, isActive])
  @@index([followerId, isActive])
}

model CopyTradeExecution {
  id                String   @id @default(uuid())

  relationId        String
  relation          CopyRelation @relation(fields: [relationId], references: [id])

  leaderAddress     String
  followerAddress   String

  originalQuantity  Decimal  @db.Decimal(20, 8)
  copiedQuantity    Decimal  @db.Decimal(20, 8)
  copyRatio         Int
  feePaid           Decimal  @db.Decimal(20, 8)

  txDigest          String   @unique
  timestamp         DateTime @default(now())

  @@index([leaderAddress, timestamp(sort: Desc)])
  @@index([followerAddress, timestamp(sort: Desc)])
}

model Trade {
  id              String   @id @default(uuid())

  userId          String
  user            User     @relation(fields: [userId], references: [id])

  marginManagerId String
  poolId          String

  orderType       String   // MARKET | LIMIT
  side            String   // BUY | SELL
  price           Decimal? @db.Decimal(20, 8)
  quantity        Decimal  @db.Decimal(20, 8)
  filledQuantity  Decimal  @db.Decimal(20, 8)

  status          String   // OPEN | FILLED | CANCELLED
  pnl             Decimal? @db.Decimal(20, 8)
  fee             Decimal  @db.Decimal(20, 8)

  isCopyTrade     Boolean  @default(false)
  copiedFrom      String?

  txDigest        String   @unique
  createdAt       DateTime @default(now())
  filledAt        DateTime?

  @@index([userId, createdAt(sort: Desc)])
  @@index([poolId, createdAt(sort: Desc)])
}
```

#### 快取策略

**Redis 7.2**

使用場景：
```typescript
// lib/cache.ts
import { redis } from './redis';

export class CacheService {
  // 排行榜快取（30 秒 TTL）
  async getLeaderboard(key: string) {
    const cached = await redis.get(`leaderboard:${key}`);
    if (cached) return JSON.parse(cached);
    return null;
  }

  async setLeaderboard(key: string, data: any) {
    await redis.setex(
      `leaderboard:${key}`,
      30, // 30 秒
      JSON.stringify(data)
    );
  }

  // 實時價格快取（5 秒 TTL）
  async getPrice(poolId: string) {
    const cached = await redis.get(`price:${poolId}`);
    if (cached) return parseFloat(cached);
    return null;
  }

  async setPrice(poolId: string, price: number) {
    await redis.setex(`price:${poolId}`, 5, price.toString());
  }

  // 用戶會話（1 小時 TTL）
  async getSession(sessionId: string) {
    const cached = await redis.get(`session:${sessionId}`);
    if (cached) return JSON.parse(cached);
    return null;
  }

  async setSession(sessionId: string, data: any) {
    await redis.setex(
      `session:${sessionId}`,
      3600,
      JSON.stringify(data)
    );
  }
}
```

---

## 數據流設計

### 1. 用戶交易流程

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Sui Node
    participant D as DeepBook

    U->>F: 填寫交易表單
    F->>F: 本地驗證
    F->>B: GET /api/risk/estimate
    B->>S: 查詢 Margin Manager
    S-->>B: 返回當前狀態
    B->>B: 計算風險指標
    B-->>F: 返回預估風險
    F->>U: 顯示確認對話框

    U->>F: 確認交易
    F->>S: 簽署並提交 PTB
    S->>D: 執行保證金下單
    D-->>S: 返回執行結果
    S-->>F: 返回交易憑證

    F->>B: POST /api/trades
    B->>B: 記錄交易
    B-->>F: 確認
    F->>U: 顯示成功
```

### 2. 跟單執行流程（優化版）

```mermaid
sequenceDiagram
    participant L as Leader
    participant S as Sui Node
    participant E as Event Indexer
    participant Q as Task Queue
    participant W as Worker
    participant F1 as Follower1
    participant F2 as Follower2
    participant N as Notification

    L->>S: 執行交易
    S->>S: 發出 LeaderTradeSignal
    S->>E: WebSocket 推送事件

    E->>E: 查詢活躍 Followers
    E->>Q: 批量創建任務

    par 並行處理
        Q->>W: Follower1 任務
        W->>S: 查詢風險比率
        S-->>W: 風險 OK
        W->>S: 執行跟單交易
        S-->>W: 成功
        W->>N: 發送通知
        N->>F1: 推送成功消息
    and
        Q->>W: Follower2 任務
        W->>S: 查詢風險比率
        S-->>W: 風險過高
        W->>N: 發送通知
        N->>F2: 推送跳過消息
    end
```

### 3. 排行榜更新流程

```mermaid
sequenceDiagram
    participant C as Cron Job
    participant DB as Database
    participant R as Redis
    participant API as API Server
    participant U as User

    C->>C: 每 5 分鐘觸發
    C->>DB: 查詢所有交易者

    loop 每個交易者
        C->>DB: 計算績效指標
        C->>DB: 更新 TraderProfile
    end

    C->>DB: 按 PnL 排序
    C->>R: 更新排行榜快取

    U->>API: GET /api/leaderboard
    API->>R: 查詢快取
    R-->>API: 返回數據
    API-->>U: 返回排行榜
```

### 4. 風險監控流程

```mermaid
sequenceDiagram
    participant K as Keeper (每30秒)
    participant DB as Database
    participant S as Sui Node
    participant RE as Risk Engine
    participant N as Notification
    participant U as User

    loop 每 30 秒
        K->>DB: 獲取活躍倉位列表

        loop 每個倉位
            K->>S: 查詢 Margin Manager
            S-->>K: 返回狀態
            K->>RE: 計算風險評分

            alt 健康度 < 30
                K->>N: 觸發緊急警報
                N->>U: 推送通知
                K->>DB: 記錄風險事件
            else 健康度 30-50
                K->>N: 觸發警告
                N->>U: 推送提醒
            end
        end
    end
```

---

## 模組劃分

### 前端模組

```
src/
├── components/           # UI 組件
│   ├── trading/
│   │   ├── TradingPanel/
│   │   ├── OrderForm/
│   │   ├── PositionList/
│   │   └── MarketDepth/
│   ├── copyTrade/
│   │   ├── LeaderCard/
│   │   ├── CopyModal/
│   │   └── FollowerList/
│   ├── leaderboard/
│   │   ├── LeaderboardTable/
│   │   ├── TraderProfile/
│   │   └── PerformanceChart/
│   ├── risk/
│   │   ├── RiskDashboard/
│   │   ├── HealthScore/
│   │   └── AlertList/
│   └── common/
│       ├── Header/
│       ├── Sidebar/
│       └── Modal/
├── hooks/                # 自定義 Hooks
│   ├── useWallet.ts
│   ├── useTradingPanel.ts
│   ├── useLeaderboard.ts
│   └── useRiskMonitor.ts
├── services/             # API 服務
│   ├── api.ts
│   ├── suiClient.ts
│   └── riskEngine.ts
├── store/                # 全局狀態
│   ├── index.ts
│   ├── userSlice.ts
│   └── uiSlice.ts
├── types/                # TypeScript 類型
├── utils/                # 工具函數
└── pages/                # 頁面組件
    ├── Dashboard/
    ├── Leaderboard/
    ├── Profile/
    └── Settings/
```

### 後端模組

```
src/
├── api/                  # REST API
│   ├── routes/
│   │   ├── leaderboard.ts
│   │   ├── traders.ts
│   │   ├── copyTrades.ts
│   │   └── risk.ts
│   └── middleware/
│       ├── auth.ts
│       ├── rateLimit.ts
│       └── errorHandler.ts
├── services/             # 業務邏輯
│   ├── copyTrade/
│   │   ├── CopyTradeExecutor.ts
│   │   ├── CopyTradeValidator.ts
│   │   └── FeeCalculator.ts
│   ├── leaderboard/
│   │   ├── PerformanceCalculator.ts
│   │   └── Ranker.ts
│   ├── risk/
│   │   ├── RiskMonitor.ts
│   │   ├── AlertManager.ts
│   │   └── RiskEngine.ts
│   └── notification/
│       └── NotificationService.ts
├── workers/              # 後台任務
│   ├── copyTradeWorker.ts
│   ├── riskMonitorWorker.ts
│   └── leaderboardWorker.ts
├── indexers/             # 事件監聽
│   ├── SuiEventListener.ts
│   └── DeepBookIndexer.ts
└── lib/                  # 基礎庫
    ├── prisma.ts
    ├── redis.ts
    ├── suiClient.ts
    └── logger.ts
```

---

## 基礎設施

### 部署架構（Hackathon 階段）

```
┌─────────────────────────────────────────┐
│            Cloudflare CDN                │
│         (全球加速 + DDoS 防護)             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│           Vercel (Frontend)              │
│  - React App                             │
│  - 自動 HTTPS                            │
│  - Edge Functions                        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│          Railway (Backend)               │
│  - Express API Server                    │
│  - BullMQ Workers                        │
│  - Event Indexers                        │
└─────────────────────────────────────────┘
        ↓                    ↓
┌──────────────┐    ┌──────────────────┐
│  Supabase    │    │   Redis Cloud    │
│ (PostgreSQL) │    │  (Upstash)       │
└──────────────┘    └──────────────────┘
```

### 環境配置

**.env.example**
```bash
# Sui Network
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
MARGIN_MASTER_PACKAGE_ID=0x...
DEEPBOOK_PACKAGE_ID=0x...

# Database
DATABASE_URL=postgresql://user:password@host:5432/marginmaster
REDIS_URL=redis://default:password@host:6379

# External Services
PYTH_PRICE_FEED_ID=0x...
SURFLUX_API_KEY=xxx
NOVU_API_KEY=xxx

# Monitoring
SENTRY_DSN=https://...
MIXPANEL_TOKEN=xxx

# App Config
FRONTEND_URL=https://marginmaster.app
BACKEND_URL=https://api.marginmaster.app
```

---

## 安全性設計

### 1. 智能合約安全

**權限控制**：
```move
// 示例：只允許 follower 執行跟單
public entry fun execute_copy_trade(
    relation: &CopyTradeRelation,
    ctx: &mut TxContext
) {
    assert!(
        tx_context::sender(ctx) == relation.follower,
        E_UNAUTHORIZED
    );
    // ...
}
```

**緊急暫停**：
```move
struct EmergencyPause has key {
    id: UID,
    is_paused: bool,
    admin: address,
}

public entry fun pause_system(
    pause: &mut EmergencyPause,
    ctx: &mut TxContext
) {
    assert!(tx_context::sender(ctx) == pause.admin, E_UNAUTHORIZED);
    pause.is_paused = true;
}
```

### 2. API 安全

**速率限制**：
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 最多 100 個請求
  message: '請求過於頻繁，請稍後再試',
});

app.use('/api/', limiter);
```

**輸入驗證**：
```typescript
import { z } from 'zod';

const copyTradeSchema = z.object({
  leaderAddress: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  copyRatio: z.number().min(1).max(10000),
  maxPositionSize: z.number().positive(),
});
```

### 3. 前端安全

**XSS 防護**：
- 使用 React 自動轉義
- DOMPurify 清理用戶輸入

**CSRF 防護**：
- SameSite Cookie
- CORS 白名單

---

## 性能優化

### 1. 前端優化

**代碼分割**：
```typescript
// 路由懶加載
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
```

**虛擬列表**：
```typescript
import { FixedSizeList } from 'react-window';

function LeaderboardTable({ items }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={60}
    >
      {({ index, style }) => (
        <div style={style}>{items[index]}</div>
      )}
    </FixedSizeList>
  );
}
```

### 2. 後端優化

**數據庫索引**：
```prisma
model Trade {
  // ...
  @@index([userId, createdAt(sort: Desc)])
  @@index([poolId, createdAt(sort: Desc)])
}
```

**Redis 快取**：
- 排行榜：30 秒 TTL
- 價格數據：5 秒 TTL
- 用戶會話：1 小時 TTL

---

## 監控與日誌

### 應用監控

**Sentry**：
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

**日誌**：
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});
```

---

**下一步閱讀**：
- [智能合約設計](./MarginMaster_Smart_Contracts.md)
- [開發計劃](./MarginMaster_Development_Plan.md)
