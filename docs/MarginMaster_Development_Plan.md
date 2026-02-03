# MarginMaster - 7 天開發計劃

> **版本:** 2.0
> **日期:** 2026-02-02
> **狀態:** Ready for Execution
> **目標:** Hackathon MVP

---

## 📋 目錄

1. [總體規劃](#總體規劃)
2. [Day 1-2: 基礎設施](#day-1-2-基礎設施)
3. [Day 3-4: 核心功能](#day-3-4-核心功能)
4. [Day 5-6: 社交與數據](#day-5-6-社交與數據)
5. [Day 7: 優化與演示](#day-7-優化與演示)
6. [測試策略](#測試策略)
7. [部署方案](#部署方案)
8. [風險管理](#風險管理)

---

## 總體規劃

### Hackathon 目標

**必須完成（MVP）**：
- ✅ 完整的保證金交易界面
- ✅ 可運作的一鍵跟單系統
- ✅ Top 10 交易者排行榜
- ✅ 實時風險儀表板
- ✅ 完整的 Demo 影片（3-5 分鐘）

**可選功能（加分項）**：
- 🎯 模擬交易模式
- 🎯 交易者認證系統
- 🎯 通知推送系統
- 🎯 移動端響應式設計

### 團隊分工建議

| 角色 | 主要職責 | Day 1-2 | Day 3-4 | Day 5-6 | Day 7 |
|------|---------|---------|---------|---------|-------|
| **全棧開發者** | 前後端整合 | 項目搭建 | 交易界面 | 排行榜 | 優化 |
| **智能合約開發** | Move 合約 | 合約開發 | 測試部署 | 集成 | 審計 |
| **UI/UX 設計師** | 界面設計 | 設計稿 | 組件實現 | 優化 | Demo |
| **產品經理** | 需求與測試 | 需求確認 | 功能測試 | 用戶測試 | Pitch |

**單人團隊建議**：專注於核心功能，使用現有 UI 庫，減少設計時間。

### 開發里程碑

```
Day 0 ──────► Day 2 ──────► Day 4 ──────► Day 6 ──────► Day 7
   │             │             │             │             │
啟動會議      基礎完成      核心功能      功能完整      Demo 就緒
   │             │             │             │             │
   └─ 環境配置   └─ 錢包連接   └─ 跟單可用   └─ 排行榜上線 └─ 影片錄製
```

---

## Day 1-2: 基礎設施

### Day 1 上午 (9:00 - 12:00)

#### 任務 1.1: 項目初始化 ⏱️ 1h

**前端初始化**：
```bash
# 創建 React 項目
npm create vite@latest marginmaster-frontend -- --template react-ts
cd marginmaster-frontend

# 安裝依賴
npm install @mysten/sui.js @mysten/dapp-kit
npm install @tanstack/react-query zustand
npm install react-router-dom react-hook-form zod
npm install recharts lightweight-charts
npm install bignumber.js date-fns
npm install react-hot-toast

# 開發工具
npm install -D @types/node
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**後端初始化**：
```bash
# 創建 Node.js 項目
mkdir marginmaster-backend
cd marginmaster-backend
npm init -y

# 安裝依賴
npm install express cors helmet compression
npm install @mysten/sui.js
npm install @prisma/client prisma
npm install bullmq ioredis
npm install @novu/node
npm install pino pino-pretty
npm install dotenv zod

# 開發工具
npm install -D typescript @types/node @types/express
npm install -D tsx nodemon
npx tsc --init
```

**智能合約初始化**：
```bash
# 創建 Move 項目
sui move new margin_master
cd margin_master

# 創建模組文件
touch sources/copy_trade.move
touch sources/trader_profile.move
touch sources/fee_manager.move
touch sources/risk_checker.move
touch sources/emergency_pause.move
```

**檢查點 ✓**：
- [ ] 三個項目都能成功啟動
- [ ] 依賴安裝無錯誤
- [ ] Git 倉庫初始化完成

---

#### 任務 1.2: 環境配置 ⏱️ 1h

**配置文件創建**：

```bash
# Frontend .env
VITE_SUI_NETWORK=testnet
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
VITE_DEEPBOOK_PACKAGE_ID=0xdee9...
VITE_MARGIN_MASTER_PACKAGE_ID=
VITE_BACKEND_URL=http://localhost:3001

# Backend .env
NODE_ENV=development
PORT=3001

# Sui Network
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
MARGIN_MASTER_PACKAGE_ID=

# Database
DATABASE_URL=postgresql://localhost:5432/marginmaster
REDIS_URL=redis://localhost:6379

# External Services
PYTH_PRICE_FEED_ID=
NOVU_API_KEY=

# Frontend
FRONTEND_URL=http://localhost:5173
```

**數據庫設置**：
```bash
# 使用 Docker 快速啟動
docker-compose up -d

# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: marginmaster
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7.2
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

**檢查點 ✓**：
- [ ] 環境變數配置完成
- [ ] 數據庫連接成功
- [ ] Redis 連接成功

---

### Day 1 下午 (13:00 - 18:00)

#### 任務 1.3: 錢包集成 ⏱️ 2h

**實現 SuiClientProvider**：

```typescript
// frontend/src/App.tsx
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css';

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

export default App;
```

**實現錢包連接組件**：

```typescript
// frontend/src/components/ConnectWallet.tsx
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

export function ConnectWallet() {
  const account = useCurrentAccount();

  return (
    <div className="wallet-section">
      {account ? (
        <div className="wallet-info">
          <span className="address">
            {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </span>
          <ConnectButton />
        </div>
      ) : (
        <ConnectButton />
      )}
    </div>
  );
}
```

**檢查點 ✓**：
- [ ] 錢包可以成功連接
- [ ] 顯示錢包地址
- [ ] 可以斷開連接

---

#### 任務 1.4: 智能合約骨架 ⏱️ 3h

**實現核心模組**（從設計文檔複製並調整）：

```bash
# 將 MarginMaster_Smart_Contracts.md 中的代碼複製到對應文件
# 重點實現：
# 1. copy_trade.move - 核心跟單邏輯
# 2. trader_profile.move - 交易者檔案
# 3. emergency_pause.move - 緊急暫停

# 編譯測試
sui move build
sui move test
```

**檢查點 ✓**：
- [ ] 合約編譯成功
- [ ] 基本測試通過
- [ ] 無 Warning

---

### Day 2 上午 (9:00 - 12:00)

#### 任務 2.1: 合約部署 ⏱️ 1h

```bash
# 切換到測試網
sui client switch --env testnet

# 檢查 gas
sui client gas

# 部署合約
sui client publish --gas-budget 500000000

# 記錄關鍵對象 ID
# PackageID: 0x...
# CopyTradeRegistry: 0x...
# FeeConfig: 0x...
# EmergencyPause: 0x...
# AdminCap: 0x...
```

**更新環境變數**：
```bash
# 將部署的 ID 更新到 .env
VITE_MARGIN_MASTER_PACKAGE_ID=0x...
COPY_TRADE_REGISTRY_ID=0x...
FEE_CONFIG_ID=0x...
EMERGENCY_PAUSE_ID=0x...
```

**檢查點 ✓**：
- [ ] 合約部署成功
- [ ] 所有對象 ID 已記錄
- [ ] 環境變數已更新

---

#### 任務 2.2: 數據庫 Schema ⏱️ 2h

**Prisma Schema**：

```prisma
// backend/prisma/schema.prisma
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
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

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
  totalTrades     Int      @default(0)

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

  copyRatio         Int
  maxPositionSize   Decimal  @db.Decimal(20, 8)
  feeRate           Int

  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  executions        CopyTradeExecution[]

  @@unique([leaderId, followerId])
  @@index([leaderId, isActive])
}

model CopyTradeExecution {
  id                String   @id @default(uuid())

  relationId        String
  relation          CopyRelation @relation(fields: [relationId], references: [id])

  leaderAddress     String
  followerAddress   String

  originalQuantity  Decimal  @db.Decimal(20, 8)
  copiedQuantity    Decimal  @db.Decimal(20, 8)
  feePaid           Decimal  @db.Decimal(20, 8)

  txDigest          String   @unique
  timestamp         DateTime @default(now())

  @@index([leaderAddress, timestamp(sort: Desc)])
}

model Trade {
  id              String   @id @default(uuid())

  userId          String
  user            User     @relation(fields: [userId], references: [id])

  poolId          String
  side            String
  quantity        Decimal  @db.Decimal(20, 8)
  price           Decimal? @db.Decimal(20, 8)

  pnl             Decimal? @db.Decimal(20, 8)
  txDigest        String   @unique
  createdAt       DateTime @default(now())

  @@index([userId, createdAt(sort: Desc)])
}
```

**執行遷移**：
```bash
npx prisma migrate dev --name init
npx prisma generate
```

**檢查點 ✓**：
- [ ] Schema 創建成功
- [ ] Prisma Client 生成
- [ ] 可以查詢數據庫

---

#### 任務 2.3: 基礎 API 服務器 ⏱️ 1h

```typescript
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './lib/logger';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/leaderboard', require('./api/routes/leaderboard'));
app.use('/api/traders', require('./api/routes/traders'));
app.use('/api/copy-trades', require('./api/routes/copyTrades'));

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});
```

**檢查點 ✓**：
- [ ] API 服務器啟動成功
- [ ] Health check 端點可訪問
- [ ] CORS 配置正確

---

### Day 2 下午 (13:00 - 18:00)

#### 任務 2.4: 事件監聽器基礎 ⏱️ 3h

```typescript
// backend/src/indexers/suiEventListener.ts
import { SuiClient, SuiEvent } from '@mysten/sui.js/client';
import { config } from '../config';
import { logger } from '../lib/logger';

export class SuiEventListener {
  private suiClient: SuiClient;

  constructor() {
    this.suiClient = new SuiClient({ url: config.suiRpcUrl });
  }

  async startListening() {
    // 監聽 LeaderTradeSignal 事件
    const unsubscribe = await this.suiClient.subscribeEvent({
      filter: {
        MoveEventType: `${config.packageId}::copy_trade::LeaderTradeSignal`
      },
      onMessage: (event: SuiEvent) => {
        this.handleLeaderTradeSignal(event);
      }
    });

    logger.info('Event listener started');
    return unsubscribe;
  }

  private async handleLeaderTradeSignal(event: SuiEvent) {
    logger.info('Received LeaderTradeSignal', event.parsedJson);

    // TODO: Day 3-4 實現跟單邏輯
  }
}
```

**檢查點 ✓**：
- [ ] 事件監聽器啟動成功
- [ ] 可以接收測試事件
- [ ] 日誌記錄正常

---

#### 任務 2.5: 前端基礎組件 ⏱️ 2h

**實現基礎布局**：

```typescript
// frontend/src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="app-layout">
      <Header />
      <div className="main-content">
        <Sidebar />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**路由配置**：

```typescript
// frontend/src/router.tsx
import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'leaderboard', element: <Leaderboard /> },
      { path: 'profile/:address', element: <Profile /> },
    ],
  },
]);
```

**檢查點 ✓**：
- [ ] 基礎布局顯示正常
- [ ] 路由導航工作
- [ ] 錢包按鈕集成完成

---

### Day 2 總結 & 檢查點

**完成標誌**：
- ✅ 前端項目可運行，錢包可連接
- ✅ 後端 API 服務器運行，數據庫連接成功
- ✅ 智能合約已部署到測試網
- ✅ 事件監聽器基礎框架完成
- ✅ Git 提交代碼，Tag: `v0.1-infrastructure`

**關鍵文件結構**：
```
marginmaster/
├── frontend/               ✅
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── package.json
├── backend/                ✅
│   ├── src/
│   │   ├── api/
│   │   ├── indexers/
│   │   └── index.ts
│   ├── prisma/
│   └── package.json
├── margin_master/          ✅
│   ├── sources/
│   │   ├── copy_trade.move
│   │   └── trader_profile.move
│   └── Move.toml
└── docker-compose.yml      ✅
```

---

## Day 3-4: 核心功能

### Day 3 上午 (9:00 - 12:00)

#### 任務 3.1: 保證金交易界面 ⏱️ 3h

**實現交易面板組件**：

```typescript
// frontend/src/components/trading/TradingPanel.tsx
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { OrderForm } from './OrderForm';
import { RiskMetrics } from './RiskMetrics';

export function TradingPanel() {
  const { address, executeTransaction } = useWallet();
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');

  return (
    <div className="trading-panel">
      <div className="panel-header">
        <h2>保證金交易</h2>
        <div className="price-ticker">
          {/* 實時價格顯示 */}
        </div>
      </div>

      <div className="panel-body">
        <OrderForm
          orderType={orderType}
          side={side}
          onOrderTypeChange={setOrderType}
          onSideChange={setSide}
        />
        <RiskMetrics />
      </div>
    </div>
  );
}
```

**實現訂單表單**：

```typescript
// frontend/src/components/trading/OrderForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const orderSchema = z.object({
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  leverage: z.number().min(1).max(10),
});

type OrderFormData = z.infer<typeof orderSchema>;

export function OrderForm({ orderType, side, ... }) {
  const { register, handleSubmit, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
  });

  const onSubmit = async (data: OrderFormData) => {
    // 構建交易
    const tx = new TransactionBlock();

    // 調用 DeepBook Margin
    tx.moveCall({
      target: `${DEEPBOOK_PKG}::pool_proxy::place_market_order`,
      arguments: [
        tx.object(marginManagerId),
        tx.object(poolId),
        tx.pure(data.quantity),
        tx.pure(side === 'BUY'),
      ],
    });

    // 發出跟單信號
    tx.moveCall({
      target: `${PACKAGE_ID}::copy_trade::emit_leader_trade_signal`,
      arguments: [
        tx.object(profileId),
        tx.pure(poolId),
        tx.pure(side === 'BUY'),
        tx.pure(0), // MARKET
        tx.pure(null, 'Option'),
        tx.pure(data.quantity),
        tx.pure(data.leverage),
        tx.pure([]), // tx_digest will be filled later
      ],
    });

    await executeTransaction(tx);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* 表單字段 */}
    </form>
  );
}
```

**檢查點 ✓**：
- [ ] 交易表單可以提交
- [ ] 與 DeepBook 集成成功
- [ ] 發出跟單信號事件

---

### Day 3 下午 (13:00 - 18:00)

#### 任務 3.2: 跟單執行邏輯 ⏱️ 4h

**實現跟單執行器**：

```typescript
// backend/src/services/copyTrade/executor.ts
import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { prisma } from '@/lib/prisma';

export class CopyTradeExecutor {
  constructor(private suiClient: SuiClient) {}

  async executeCopyTrade(params: {
    leaderAddress: string;
    followerAddress: string;
    tradeSignal: TradeSignal;
  }) {
    // 1. 獲取跟單關係
    const relation = await prisma.copyRelation.findUnique({
      where: {
        leaderId_followerId: {
          leaderId: params.leaderAddress,
          followerId: params.followerAddress,
        },
      },
    });

    if (!relation || !relation.isActive) {
      return;
    }

    // 2. 檢查風險比率
    const riskRatio = await this.checkRiskRatio(followerManagerId);
    if (riskRatio < 1.2) {
      logger.warn('Risk too high, skipping copy trade');
      return;
    }

    // 3. 計算跟單規模
    const copiedQuantity = this.calculateCopySize(
      BigInt(params.tradeSignal.quantity),
      relation.copyRatio,
      BigInt(relation.maxPositionSize)
    );

    // 4. 執行鏈上交易
    const tx = new TransactionBlock();

    // ... 構建交易

    const result = await this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      // ... 使用 follower 的私鑰（實際需要授權機制）
    });

    // 5. 記錄執行結果
    await prisma.copyTradeExecution.create({
      data: {
        relationId: relation.id,
        leaderAddress: params.leaderAddress,
        followerAddress: params.followerAddress,
        originalQuantity: params.tradeSignal.quantity,
        copiedQuantity: copiedQuantity.toString(),
        feePaid: '0', // TODO: 計算費用
        txDigest: result.digest,
      },
    });
  }

  private calculateCopySize(
    originalQty: bigint,
    copyRatio: number,
    maxPosition: bigint
  ): bigint {
    const calculated = (originalQty * BigInt(copyRatio)) / 10000n;
    return calculated > maxPosition ? maxPosition : calculated;
  }
}
```

**整合到事件監聽器**：

```typescript
// backend/src/indexers/suiEventListener.ts (更新)
private async handleLeaderTradeSignal(event: SuiEvent) {
  const signal = event.parsedJson;

  // 查詢 followers
  const followers = await prisma.copyRelation.findMany({
    where: {
      leaderId: signal.leader,
      isActive: true,
    },
  });

  // 執行跟單
  for (const relation of followers) {
    try {
      await this.executor.executeCopyTrade({
        leaderAddress: signal.leader,
        followerAddress: relation.followerId,
        tradeSignal: signal,
      });
    } catch (error) {
      logger.error('Copy trade failed', error);
    }
  }
}
```

**檢查點 ✓**：
- [ ] 可以接收 Leader 交易信號
- [ ] 自動查詢 Followers
- [ ] 執行跟單交易成功

---

### Day 4 上午 (9:00 - 12:00)

#### 任務 4.1: 跟單管理界面 ⏱️ 3h

**實現跟單創建彈窗**：

```typescript
// frontend/src/components/copyTrade/CopyModal.tsx
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';

export function CopyModal({ leader, onClose }) {
  const { executeTransaction } = useWallet();
  const [copyRatio, setCopyRatio] = useState(50);
  const [maxPosition, setMaxPosition] = useState(1000);
  const [feeRate, setFeeRate] = useState(leader.suggestedFeeRate || 5);

  const handleCreateRelation = async () => {
    const tx = new TransactionBlock();

    tx.moveCall({
      target: `${PACKAGE_ID}::copy_trade::create_copy_relation`,
      arguments: [
        tx.object(REGISTRY_ID),
        tx.object(PAUSE_ID),
        tx.pure(leader.address),
        tx.pure(copyRatio * 100), // 轉為 basis points
        tx.pure(maxPosition),
        tx.pure(feeRate * 100),
      ],
    });

    await executeTransaction(tx);
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>跟單設置</h2>

        <div className="form-group">
          <label>跟單比例: {copyRatio}%</label>
          <input
            type="range"
            min="1"
            max="100"
            value={copyRatio}
            onChange={(e) => setCopyRatio(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>最大單筆倉位</label>
          <input
            type="number"
            value={maxPosition}
            onChange={(e) => setMaxPosition(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>費率: {feeRate}%</label>
          <span className="fee-info">
            預估月費用: ${estimatedMonthlyFee}
          </span>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button onClick={handleCreateRelation}>確認跟單</button>
        </div>
      </div>
    </div>
  );
}
```

**檢查點 ✓**：
- [ ] 可以創建跟單關係
- [ ] 參數驗證正確
- [ ] 交易成功執行

---

### Day 4 下午 (13:00 - 18:00)

#### 任務 4.2: 風險監控系統 ⏱️ 3h

**實現風險引擎**：

```typescript
// frontend/src/services/riskEngine.ts
export interface RiskMetrics {
  currentRiskRatio: number;
  liquidationPrice: number;
  marginUsed: number;
  marginAvailable: number;
  healthScore: number;
}

export class RiskEngine {
  async calculateRiskMetrics(marginManagerId: string): Promise<RiskMetrics> {
    // 查詢 Margin Manager 狀態
    const managerState = await suiClient.getObject({
      id: marginManagerId,
      options: { showContent: true },
    });

    const fields = (managerState.data?.content as any).fields;

    const baseBalance = BigInt(fields.base_balance);
    const quoteBalance = BigInt(fields.quote_balance);
    const borrowedBase = BigInt(fields.borrowed_base);
    const borrowedQuote = BigInt(fields.borrowed_quote);

    // 獲取當前價格
    const currentPrice = await this.getCurrentPrice(fields.pool_id);

    // 計算風險指標
    const totalAssets = Number(baseBalance) * currentPrice + Number(quoteBalance);
    const totalDebt = Number(borrowedBase) * currentPrice + Number(borrowedQuote);
    const riskRatio = totalDebt === 0 ? Infinity : totalAssets / totalDebt;

    const liquidationPrice = this.calculateLiquidationPrice(
      Number(baseBalance),
      Number(quoteBalance),
      Number(borrowedBase),
      Number(borrowedQuote)
    );

    const healthScore = this.calculateHealthScore(riskRatio);

    return {
      currentRiskRatio: riskRatio,
      liquidationPrice,
      marginUsed: totalDebt,
      marginAvailable: totalAssets - totalDebt,
      healthScore,
    };
  }

  private calculateHealthScore(riskRatio: number): number {
    if (riskRatio >= 2.0) return 100;
    if (riskRatio >= 1.5) return 80;
    if (riskRatio >= 1.3) return 60;
    if (riskRatio >= 1.15) return 30;
    return 10;
  }

  private calculateLiquidationPrice(
    baseBalance: number,
    quoteBalance: number,
    borrowedBase: number,
    borrowedQuote: number
  ): number {
    const threshold = 1.1;
    const numerator = threshold * borrowedQuote - quoteBalance;
    const denominator = baseBalance - threshold * borrowedBase;

    if (denominator === 0) return Infinity;
    return numerator / denominator;
  }
}
```

**實現風險儀表板**：

```typescript
// frontend/src/components/risk/RiskDashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { riskEngine } from '@/services/riskEngine';

export function RiskDashboard({ marginManagerId }) {
  const { data: metrics } = useQuery({
    queryKey: ['risk', marginManagerId],
    queryFn: () => riskEngine.calculateRiskMetrics(marginManagerId),
    refetchInterval: 30_000, // 每 30 秒更新
  });

  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="risk-dashboard">
      <div className="health-score">
        <h3>健康度</h3>
        <div className={`score score-${getScoreClass(metrics.healthScore)}`}>
          {metrics.healthScore}
        </div>
      </div>

      <div className="risk-metrics">
        <div className="metric">
          <label>風險比率</label>
          <span>{metrics.currentRiskRatio.toFixed(2)}x</span>
        </div>

        <div className="metric">
          <label>清算價格</label>
          <span>${metrics.liquidationPrice.toFixed(2)}</span>
        </div>

        <div className="metric">
          <label>可用保證金</label>
          <span>${metrics.marginAvailable.toFixed(2)}</span>
        </div>
      </div>

      {metrics.healthScore < 30 && (
        <div className="alert alert-danger">
          ⚠️ 您的倉位接近清算！建議立即減倉或增加保證金。
        </div>
      )}
    </div>
  );
}

function getScoreClass(score: number): string {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'danger';
}
```

**檢查點 ✓**：
- [ ] 風險指標計算正確
- [ ] 儀表板實時更新
- [ ] 警報正常觸發

---

#### 任務 4.3: 持倉管理 ⏱️ 2h

**實現持倉列表**：

```typescript
// frontend/src/components/trading/PositionList.tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export function PositionList({ marginManagerId }) {
  const { data: positions } = useQuery({
    queryKey: ['positions', marginManagerId],
    queryFn: () => api.getPositions(marginManagerId),
    refetchInterval: 10_000,
  });

  return (
    <div className="position-list">
      <h3>當前持倉</h3>

      <table>
        <thead>
          <tr>
            <th>資產</th>
            <th>方向</th>
            <th>數量</th>
            <th>入場價</th>
            <th>當前價</th>
            <th>未實現盈虧</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {positions?.map((position) => (
            <tr key={position.id}>
              <td>{position.asset}</td>
              <td className={position.side}>{position.side}</td>
              <td>{position.quantity}</td>
              <td>${position.entryPrice}</td>
              <td>${position.currentPrice}</td>
              <td className={position.pnl > 0 ? 'profit' : 'loss'}>
                ${position.pnl.toFixed(2)}
              </td>
              <td>
                <button onClick={() => handleClose(position)}>
                  平倉
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**檢查點 ✓**：
- [ ] 持倉列表顯示正確
- [ ] 實時更新盈虧
- [ ] 可以執行平倉

---

### Day 4 總結 & 檢查點

**完成標誌**：
- ✅ 完整的交易界面可用
- ✅ 跟單系統可以正常工作
- ✅ 風險監控實時更新
- ✅ Git Tag: `v0.2-core-features`

---

## Day 5-6: 社交與數據

### Day 5 上午 (9:00 - 12:00)

#### 任務 5.1: 績效計算服務 ⏱️ 3h

**實現績效計算器**：

```typescript
// backend/src/services/leaderboard/calculator.ts
import { prisma } from '@/lib/prisma';

export class PerformanceCalculator {
  async calculateTraderStats(userAddress: string) {
    // 獲取所有交易
    const trades = await prisma.trade.findMany({
      where: { userId: userAddress },
      orderBy: { createdAt: 'asc' },
    });

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl && Number(t.pnl) > 0);
    const losingTrades = trades.filter(t => t.pnl && Number(t.pnl) < 0);

    const totalPnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? winningTrades.length / totalTrades : 0;

    const avgProfit = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + Number(t.pnl!), 0) / winningTrades.length
      : 0;

    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + Number(t.pnl!), 0) / losingTrades.length)
      : 0;

    const maxDrawdown = this.calculateMaxDrawdown(trades);
    const sharpeRatio = this.calculateSharpeRatio(trades);

    // 更新數據庫
    await prisma.traderProfile.upsert({
      where: { userId: userAddress },
      update: {
        totalPnl,
        winRate,
        totalTrades,
        updatedAt: new Date(),
      },
      create: {
        userId: userAddress,
        totalPnl,
        winRate,
        totalTrades,
      },
    });

    return {
      totalPnl,
      winRate,
      totalTrades,
      avgProfit,
      avgLoss,
      maxDrawdown,
      sharpeRatio,
    };
  }

  private calculateMaxDrawdown(trades: any[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const trade of trades) {
      cumulative += Number(trade.pnl || 0);
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak === 0 ? 0 : (peak - cumulative) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  private calculateSharpeRatio(trades: any[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => Number(t.pnl || 0));
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : mean / stdDev;
  }
}
```

**設置定時任務**：

```typescript
// backend/src/workers/leaderboardWorker.ts
import { CronJob } from 'cron';
import { PerformanceCalculator } from '../services/leaderboard/calculator';

const calculator = new PerformanceCalculator();

// 每 5 分鐘更新一次排行榜
export const leaderboardJob = new CronJob('*/5 * * * *', async () => {
  console.log('Updating leaderboard...');

  const traders = await prisma.user.findMany({
    where: {
      traderProfile: { isNot: null },
    },
  });

  for (const trader of traders) {
    await calculator.calculateTraderStats(trader.suiAddress);
  }

  console.log('Leaderboard updated');
});

leaderboardJob.start();
```

**檢查點 ✓**：
- [ ] 績效計算正確
- [ ] 定時任務運行
- [ ] 數據庫更新成功

---

### Day 5 下午 (13:00 - 18:00)

#### 任務 5.2: 排行榜 API 與界面 ⏱️ 4h

**實現排行榜 API**：

```typescript
// backend/src/api/routes/leaderboard.ts
import { Router } from 'express';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

const router = Router();

router.get('/', async (req, res) => {
  const { sortBy = 'totalPnl', order = 'desc', limit = 50 } = req.query;

  // 檢查快取
  const cacheKey = `leaderboard:${sortBy}:${order}:${limit}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // 查詢數據庫
  const traders = await prisma.traderProfile.findMany({
    include: {
      user: {
        select: {
          suiAddress: true,
          username: true,
        },
      },
    },
    orderBy: {
      [sortBy as string]: order,
    },
    take: Number(limit),
  });

  const result = traders.map((trader, index) => ({
    rank: index + 1,
    address: trader.user.suiAddress,
    username: trader.user.username,
    totalPnl: Number(trader.totalPnl),
    winRate: Number(trader.winRate) * 100,
    totalTrades: trader.totalTrades,
    totalFollowers: trader.totalFollowers,
    tier: trader.tier,
    isVerified: trader.isVerified,
  }));

  // 快取 30 秒
  await redis.setex(cacheKey, 30, JSON.stringify(result));

  res.json(result);
});

export default router;
```

**實現排行榜界面**：

```typescript
// frontend/src/pages/Leaderboard.tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { CopyModal } from '@/components/copyTrade/CopyModal';
import { useState } from 'react';

export function Leaderboard() {
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [sortBy, setSortBy] = useState('totalPnl');

  const { data: leaders, isLoading } = useQuery({
    queryKey: ['leaderboard', sortBy],
    queryFn: () => api.getLeaderboard({ sortBy }),
    refetchInterval: 60_000, // 每分鐘刷新
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="leaderboard-page">
      <h1>交易者排行榜</h1>

      <div className="sort-controls">
        <button onClick={() => setSortBy('totalPnl')}>按盈虧排序</button>
        <button onClick={() => setSortBy('winRate')}>按勝率排序</button>
        <button onClick={() => setSortBy('totalFollowers')}>按跟隨者排序</button>
      </div>

      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>交易者</th>
            <th>30天盈虧</th>
            <th>勝率</th>
            <th>總交易</th>
            <th>跟隨者</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {leaders?.map((leader) => (
            <tr key={leader.address}>
              <td className="rank">#{leader.rank}</td>
              <td>
                <div className="trader-info">
                  {leader.isVerified && <span className="badge-verified">✓</span>}
                  <span className="address">
                    {leader.username || `${leader.address.slice(0, 6)}...`}
                  </span>
                  {leader.tier > 0 && (
                    <span className={`tier tier-${leader.tier}`}>
                      {getTierName(leader.tier)}
                    </span>
                  )}
                </div>
              </td>
              <td className={leader.totalPnl > 0 ? 'profit' : 'loss'}>
                ${leader.totalPnl.toFixed(2)}
              </td>
              <td>{leader.winRate.toFixed(1)}%</td>
              <td>{leader.totalTrades}</td>
              <td>{leader.totalFollowers}</td>
              <td>
                <button onClick={() => setSelectedLeader(leader)}>
                  跟單
                </button>
                <button onClick={() => navigate(`/profile/${leader.address}`)}>
                  查看
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedLeader && (
        <CopyModal
          leader={selectedLeader}
          onClose={() => setSelectedLeader(null)}
        />
      )}
    </div>
  );
}

function getTierName(tier: number): string {
  const tiers = ['', 'Bronze', 'Silver', 'Gold', 'Platinum'];
  return tiers[tier] || '';
}
```

**檢查點 ✓**：
- [ ] 排行榜 API 返回正確
- [ ] 排行榜界面顯示正常
- [ ] 排序功能工作
- [ ] 快取生效

---

### Day 6 上午 (9:00 - 12:00)

#### 任務 6.1: 交易者檔案頁 ⏱️ 3h

**實現檔案頁 API**：

```typescript
// backend/src/api/routes/traders.ts
router.get('/:address/stats', async (req, res) => {
  const { address } = req.params;

  const profile = await prisma.traderProfile.findFirst({
    where: {
      user: { suiAddress: address },
    },
    include: {
      user: true,
    },
  });

  if (!profile) {
    return res.status(404).json({ error: 'Trader not found' });
  }

  // 獲取最近交易
  const recentTrades = await prisma.trade.findMany({
    where: { userId: profile.userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // 獲取 Followers
  const followers = await prisma.copyRelation.findMany({
    where: {
      leaderId: profile.userId,
      isActive: true,
    },
    include: {
      follower: {
        select: {
          suiAddress: true,
          username: true,
        },
      },
    },
  });

  res.json({
    address: profile.user.suiAddress,
    username: profile.user.username,
    totalPnl: Number(profile.totalPnl),
    winRate: Number(profile.winRate) * 100,
    totalTrades: profile.totalTrades,
    totalFollowers: profile.totalFollowers,
    isVerified: profile.isVerified,
    tier: profile.tier,
    recentTrades,
    followers,
  });
});
```

**實現檔案頁界面**：

```typescript
// frontend/src/pages/Profile.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { PerformanceChart } from '@/components/leaderboard/PerformanceChart';

export function Profile() {
  const { address } = useParams();

  const { data: stats } = useQuery({
    queryKey: ['trader-stats', address],
    queryFn: () => api.getTraderStats(address!),
  });

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>{stats.username || `Trader ${address?.slice(0, 8)}`}</h1>
        {stats.isVerified && <span className="badge-verified">驗證交易者</span>}
        {stats.tier > 0 && <span className="tier-badge">{getTierName(stats.tier)}</span>}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <label>總盈虧</label>
          <span className={stats.totalPnl > 0 ? 'profit' : 'loss'}>
            ${stats.totalPnl.toFixed(2)}
          </span>
        </div>

        <div className="stat-card">
          <label>勝率</label>
          <span>{stats.winRate.toFixed(1)}%</span>
        </div>

        <div className="stat-card">
          <label>總交易</label>
          <span>{stats.totalTrades}</span>
        </div>

        <div className="stat-card">
          <label>跟隨者</label>
          <span>{stats.totalFollowers}</span>
        </div>
      </div>

      <PerformanceChart trades={stats.recentTrades} />

      <div className="recent-trades">
        <h2>最近交易</h2>
        <table>
          {/* 交易列表 */}
        </table>
      </div>

      <div className="followers-list">
        <h2>跟隨者</h2>
        {/* Followers 列表 */}
      </div>
    </div>
  );
}
```

**檢查點 ✓**：
- [ ] 檔案頁顯示完整信息
- [ ] 績效圖表渲染正確
- [ ] 交易歷史顯示

---

### Day 6 下午 (13:00 - 18:00)

#### 任務 6.2: 通知系統 ⏱️ 2h

**實現通知服務**：

```typescript
// backend/src/services/notification/sender.ts
import { Novu } from '@novu/node';

const novu = new Novu(process.env.NOVU_API_KEY!);

export class NotificationService {
  async sendCopyTradeNotification(params: {
    followerAddress: string;
    type: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    details: any;
  }) {
    await novu.trigger('copy-trade-notification', {
      to: {
        subscriberId: params.followerAddress,
      },
      payload: {
        type: params.type,
        ...params.details,
      },
    });
  }

  async sendRiskAlert(params: {
    userAddress: string;
    healthScore: number;
    riskRatio: number;
  }) {
    await novu.trigger('risk-alert', {
      to: {
        subscriberId: params.userAddress,
      },
      payload: {
        healthScore: params.healthScore,
        riskRatio: params.riskRatio,
        severity: params.healthScore < 30 ? 'CRITICAL' : 'WARNING',
      },
    });
  }
}
```

**檢查點 ✓**：
- [ ] 通知可以發送
- [ ] 前端可以接收通知

---

#### 任務 6.3: 數據可視化 ⏱️ 3h

**實現績效圖表**：

```typescript
// frontend/src/components/leaderboard/PerformanceChart.tsx
import { Line } from 'recharts';
import { LineChart, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function PerformanceChart({ trades }) {
  const chartData = trades.reduce((acc, trade, index) => {
    const prevPnl = index > 0 ? acc[index - 1].cumulativePnl : 0;
    const cumulativePnl = prevPnl + Number(trade.pnl || 0);

    return [...acc, {
      date: new Date(trade.createdAt).toLocaleDateString(),
      cumulativePnl,
      pnl: Number(trade.pnl || 0),
    }];
  }, [] as any[]);

  return (
    <div className="performance-chart">
      <h3>績效走勢</h3>
      <LineChart width={800} height={400} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="cumulativePnl"
          stroke="#8884d8"
          strokeWidth={2}
        />
      </LineChart>
    </div>
  );
}
```

**檢查點 ✓**：
- [ ] 圖表渲染正確
- [ ] 數據更新實時

---

### Day 6 總結 & 檢查點

**完成標誌**：
- ✅ 排行榜系統完整
- ✅ 交易者檔案頁完成
- ✅ 通知系統可用
- ✅ 數據可視化完成
- ✅ Git Tag: `v0.3-social-features`

---

## Day 7: 優化與演示

### Day 7 上午 (9:00 - 12:00)

#### 任務 7.1: Bug 修復與優化 ⏱️ 3h

**優先級列表**：
1. ✅ 修復所有阻塞性 Bug
2. ✅ 優化加載速度
3. ✅ 完善錯誤處理
4. ✅ UI/UX 調整

**檢查清單**：
```
□ 錢包連接穩定
□ 交易執行成功率 > 95%
□ 跟單延遲 < 5 秒
□ 頁面加載 < 3 秒
□ 移動端適配基本可用
□ 所有表單驗證工作
□ 錯誤消息友好
□ Loading 狀態完整
```

---

### Day 7 下午 (13:00 - 18:00)

#### 任務 7.2: Demo 影片錄製 ⏱️ 2h

**影片腳本**（3-5 分鐘）：

**第 1 部分：問題陳述 (30s)**
- DeFi 保證金交易門檻高
- 新手容易爆倉
- 缺乏學習途徑

**第 2 部分：解決方案 (60s)**
- MarginMaster 介紹
- 核心功能展示
  - 社交跟單
  - AI 風險管理
  - 透明排行榜

**第 3 部分：實際演示 (120s)**
1. 連接錢包
2. 瀏覽排行榜
3. 查看交易者檔案
4. 創建跟單關係
5. Leader 執行交易
6. Follower 自動跟單（展示通知）
7. 風險儀表板更新

**第 4 部分：技術亮點 (30s)**
- Sui 低 gas 費
- 亞秒級確認
- 完全透明
- 智能風險管理

**第 5 部分：未來規劃 (30s)**
- 策略市場
- 移動 App
- AI 交易助手

**檢查點 ✓**：
- [ ] 影片錄製完成
- [ ] 畫質清晰
- [ ] 音頻清楚
- [ ] 時長 3-5 分鐘

---

#### 任務 7.3: Pitch Deck 準備 ⏱️ 2h

**幻燈片結構**（10-12 頁）：

1. **封面** - MarginMaster Logo + Tagline
2. **問題** - DeFi 保證金交易的 3 大痛點
3. **解決方案** - 社交跟單 + AI 風險管理
4. **產品演示** - 核心功能截圖
5. **市場機會** - TAM/SAM/SOM
6. **競爭優勢** - vs eToro, vs dYdX
7. **技術架構** - 架構圖
8. **商業模式** - 收入來源
9. **Traction** - Demo 數據（模擬）
10. **路線圖** - Phase 1/2/3
11. **團隊** - 團隊介紹
12. **Call to Action** - 聯繫方式

**檢查點 ✓**：
- [ ] Pitch Deck 完成
- [ ] 設計統一
- [ ] 邏輯清晰

---

#### 任務 7.4: 最終部署 ⏱️ 1h

```bash
# Frontend 部署到 Vercel
cd frontend
vercel --prod

# Backend 部署到 Railway
cd backend
railway up

# 測試生產環境
curl https://api.marginmaster.app/health
curl https://marginmaster.app
```

**檢查點 ✓**：
- [ ] 前端部署成功
- [ ] 後端部署成功
- [ ] 數據庫連接正常
- [ ] 所有功能可用

---

## 測試策略

### 單元測試

**智能合約測試**：
```bash
sui move test
```

**前端測試**：
```bash
npm run test
```

**後端測試**：
```bash
npm run test
```

### 集成測試

**端到端流程**：
1. 用戶註冊 → 創建 Trader Profile
2. 創建跟單關係
3. Leader 執行交易
4. Follower 自動跟單
5. 排行榜更新

### 壓力測試（可選）

- 100 個並發跟單請求
- 1000 條交易記錄查詢
- 排行榜快取命中率

---

## 部署方案

### 環境準備

**開發環境**：
- Sui Devnet
- 本地 PostgreSQL
- 本地 Redis

**測試環境**：
- Sui Testnet
- Supabase
- Upstash Redis

**生產環境**（Phase 2）：
- Sui Mainnet
- Supabase Pro
- Upstash Redis Pro

### 部署檢查清單

```
□ 環境變數配置完成
□ 數據庫遷移執行
□ 智能合約部署到 Testnet
□ 前端部署到 Vercel
□ 後端部署到 Railway
□ DNS 配置完成
□ HTTPS 證書配置
□ 監控配置（Sentry）
□ 分析配置（Mixpanel）
```

---

## 風險管理

### 技術風險

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| DeepBook API 變更 | 低 | 高 | 使用官方 SDK，定期檢查更新 |
| 智能合約 Bug | 中 | 高 | 充分測試，代碼審計 |
| Gas 費用過高 | 低 | 中 | Sui gas 費本身很低 |
| 性能瓶頸 | 中 | 中 | 快取策略，數據庫索引 |

### 時間風險

| 風險 | 緩解措施 |
|------|---------|
| 功能開發超時 | 砍掉非核心功能（模擬模式、通知） |
| Bug 修復耗時 | 預留 Day 7 整天處理 |
| 部署問題 | 提前測試部署流程 |

### 應急計劃

**如果進度落後**：
- Day 3：砍掉模擬交易模式
- Day 5：使用假數據填充排行榜
- Day 6：簡化通知系統
- Day 7：使用現成 UI 模板

---

## 總結

### 7 天成果

✅ **完整的 MVP 產品**：
- 保證金交易界面
- 一鍵跟單系統
- 交易者排行榜
- 風險監控系統

✅ **可演示的 Demo**：
- 3-5 分鐘影片
- Pitch Deck
- 線上可訪問

✅ **技術積累**：
- Sui Move 智能合約
- React + Node.js 全棧
- DeepBook 集成經驗

### 後續工作

**Week 2-4**：
- 策略市場開發
- 移動 App
- 安全審計

**Month 2-3**：
- 主網部署
- 市場推廣
- 用戶增長

---

**下一步閱讀**：
- [數據庫與 API 設計](./MarginMaster_Database_API.md)
- [後端架構](./MarginMaster_Backend.md)
- [AGI 開發指南](./MarginMaster_AGI_Guide.md)
