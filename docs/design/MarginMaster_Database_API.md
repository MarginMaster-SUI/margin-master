# MarginMaster - 數據庫與 API 設計

> **版本:** 2.0
> **日期:** 2026-02-02
> **狀態:** Ready for Implementation

---

## 📋 目錄

1. [數據庫設計](#數據庫設計)
2. [Prisma Schema](#prisma-schema)
3. [API 設計](#api-設計)
4. [WebSocket 實時通信](#websocket-實時通信)
5. [快取策略](#快取策略)
6. [數據遷移](#數據遷移)

---

## 數據庫設計

### ER 圖

```
┌─────────────┐
│    User     │
├─────────────┤
│ id          │◄────┐
│ suiAddress  │     │
│ username    │     │
│ email       │     │
│ createdAt   │     │
└─────────────┘     │
       │            │
       │ 1:1        │
       ▼            │
┌─────────────────┐ │
│ TraderProfile   │ │
├─────────────────┤ │
│ id              │ │
│ userId          │─┘
│ totalFollowers  │
│ totalPnl        │
│ winRate         │
│ totalTrades     │
│ isVerified      │
│ tier            │
└─────────────────┘
       │
       │ 1:N
       ▼
┌─────────────────┐
│ CopyRelation    │
├─────────────────┤
│ id              │
│ leaderId        │───┐
│ followerId      │   │ N:1
│ copyRatio       │   │
│ maxPositionSize │   │
│ feeRate         │   │
│ isActive        │   │
└─────────────────┘   │
       │              │
       │ 1:N          │
       ▼              │
┌──────────────────┐  │
│CopyTradeExecution│  │
├──────────────────┤  │
│ id               │  │
│ relationId       │──┘
│ leaderAddress    │
│ followerAddress  │
│ copiedQuantity   │
│ feePaid          │
│ txDigest         │
└──────────────────┘

       User
         │
         │ 1:N
         ▼
    ┌────────┐
    │ Trade  │
    ├────────┤
    │ id     │
    │ userId │
    │ poolId │
    │ side   │
    │ pnl    │
    └────────┘
```

### 表設計原則

1. **正規化**：遵循第三範式（3NF），減少數據冗餘
2. **索引優化**：為高頻查詢字段添加索引
3. **軟刪除**：使用 `deletedAt` 而非物理刪除
4. **時間戳**：所有表包含 `createdAt` 和 `updatedAt`
5. **精度**：金額使用 `Decimal` 類型，避免浮點誤差

---

## Prisma Schema

### 完整 Schema 定義

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== 用戶相關 ====================

/// 用戶基礎信息
model User {
  id              String    @id @default(uuid())
  suiAddress      String    @unique
  username        String?   @db.VarChar(50)
  email           String?   @unique
  avatarUrl       String?
  bio             String?   @db.Text

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  // 關聯
  traderProfile             TraderProfile?
  copyRelationsAsLeader     CopyRelation[]         @relation("Leader")
  copyRelationsAsFollower   CopyRelation[]         @relation("Follower")
  trades                    Trade[]
  marginManagers            MarginManager[]
  notifications             Notification[]

  @@index([suiAddress])
  @@index([username])
  @@map("users")
}

/// 交易者檔案
model TraderProfile {
  id                String    @id @default(uuid())
  userId            String    @unique
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // 統計數據
  totalFollowers    Int       @default(0)
  totalPnl          Decimal   @default(0) @db.Decimal(20, 8)
  winRate           Decimal   @default(0) @db.Decimal(5, 4)  // 0.0000 - 1.0000
  maxDrawdown       Decimal   @default(0) @db.Decimal(5, 4)
  sharpeRatio       Decimal   @default(0) @db.Decimal(10, 6)

  totalTrades       Int       @default(0)
  winningTrades     Int       @default(0)
  losingTrades      Int       @default(0)
  activePositions   Int       @default(0)

  totalVolume       Decimal   @default(0) @db.Decimal(20, 8)
  totalFeesEarned   Decimal   @default(0) @db.Decimal(20, 8)

  // 30 天滾動數據
  last30DaysPnl     Decimal   @default(0) @db.Decimal(20, 8)
  last30DaysTrades  Int       @default(0)

  // 認證與等級
  isVerified        Boolean   @default(false)
  tier              Int       @default(0)  // 0=None, 1=Bronze, 2=Silver, 3=Gold, 4=Platinum
  verifiedAt        DateTime?

  // 策略描述
  description       String?   @db.Text
  tradingStyle      String?   @db.VarChar(50)  // aggressive, moderate, conservative
  preferredAssets   String[]  @default([])

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([totalPnl(sort: Desc)])
  @@index([winRate(sort: Desc)])
  @@index([last30DaysPnl(sort: Desc)])
  @@index([totalFollowers(sort: Desc)])
  @@map("trader_profiles")
}

// ==================== 跟單相關 ====================

/// 跟單關係
model CopyRelation {
  id                  String    @id @default(uuid())

  leaderId            String
  leader              User      @relation("Leader", fields: [leaderId], references: [id], onDelete: Cascade)

  followerId          String
  follower            User      @relation("Follower", fields: [followerId], references: [id], onDelete: Cascade)

  // 跟單參數
  copyRatio           Int                        // Basis points (0-10000)
  maxPositionSize     Decimal   @db.Decimal(20, 8)
  feeRate             Int                        // Basis points

  // 狀態
  isActive            Boolean   @default(true)

  // 統計
  totalCopiedTrades   Int       @default(0)
  totalFeesPaid       Decimal   @default(0) @db.Decimal(20, 8)
  totalPnl            Decimal   @default(0) @db.Decimal(20, 8)

  // 時間戳
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  lastCopyAt          DateTime?
  stoppedAt           DateTime?

  // 關聯
  executions          CopyTradeExecution[]

  @@unique([leaderId, followerId])
  @@index([leaderId, isActive])
  @@index([followerId, isActive])
  @@index([createdAt(sort: Desc)])
  @@map("copy_relations")
}

/// 跟單執行記錄
model CopyTradeExecution {
  id                  String    @id @default(uuid())

  relationId          String
  relation            CopyRelation @relation(fields: [relationId], references: [id], onDelete: Cascade)

  leaderAddress       String
  followerAddress     String

  // 交易詳情
  poolId              String
  side                String    @db.VarChar(10)  // BUY | SELL
  orderType           String    @db.VarChar(10)  // MARKET | LIMIT

  originalQuantity    Decimal   @db.Decimal(20, 8)
  copiedQuantity      Decimal   @db.Decimal(20, 8)
  price               Decimal?  @db.Decimal(20, 8)
  copyRatio           Int

  // 費用
  feePaid             Decimal   @db.Decimal(20, 8)
  protocolFee         Decimal   @db.Decimal(20, 8)
  leaderFee           Decimal   @db.Decimal(20, 8)

  // 結果
  success             Boolean   @default(true)
  failureReason       String?   @db.VarChar(255)

  // 區塊鏈數據
  txDigest            String    @unique
  blockNumber         BigInt?
  gasUsed             BigInt?

  timestamp           DateTime  @default(now())

  @@index([leaderAddress, timestamp(sort: Desc)])
  @@index([followerAddress, timestamp(sort: Desc)])
  @@index([relationId, timestamp(sort: Desc)])
  @@index([success])
  @@map("copy_trade_executions")
}

// ==================== 交易相關 ====================

/// Margin Manager（保證金管理器）
model MarginManager {
  id                  String    @id
  userId              String
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  poolId              String

  // 餘額（快照）
  baseBalance         Decimal   @default(0) @db.Decimal(20, 8)
  quoteBalance        Decimal   @default(0) @db.Decimal(20, 8)
  borrowedBase        Decimal   @default(0) @db.Decimal(20, 8)
  borrowedQuote       Decimal   @default(0) @db.Decimal(20, 8)

  // 風險指標（快照）
  riskRatio           Decimal?  @db.Decimal(10, 6)
  healthScore         Int?      // 0-100
  liquidationPrice    Decimal?  @db.Decimal(20, 8)

  isActive            Boolean   @default(true)

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  lastSyncAt          DateTime?

  @@index([userId])
  @@index([isActive])
  @@map("margin_managers")
}

/// 交易記錄
model Trade {
  id                  String    @id @default(uuid())

  userId              String
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  marginManagerId     String
  poolId              String

  // 訂單信息
  orderType           String    @db.VarChar(10)  // MARKET | LIMIT
  side                String    @db.VarChar(10)  // BUY | SELL
  price               Decimal?  @db.Decimal(20, 8)
  quantity            Decimal   @db.Decimal(20, 8)
  filledQuantity      Decimal   @db.Decimal(20, 8)
  leverage            Int

  // 狀態
  status              String    @db.VarChar(20)  // OPEN | FILLED | CANCELLED | LIQUIDATED

  // 財務
  pnl                 Decimal?  @db.Decimal(20, 8)
  fee                 Decimal   @db.Decimal(20, 8)
  realizedPnl         Decimal?  @db.Decimal(20, 8)

  // 跟單相關
  isCopyTrade         Boolean   @default(false)
  copiedFrom          String?

  // 區塊鏈數據
  txDigest            String    @unique
  blockNumber         BigInt?

  // 時間戳
  createdAt           DateTime  @default(now())
  filledAt            DateTime?
  closedAt            DateTime?

  @@index([userId, createdAt(sort: Desc)])
  @@index([poolId, createdAt(sort: Desc)])
  @@index([status])
  @@index([isCopyTrade])
  @@map("trades")
}

// ==================== 通知相關 ====================

/// 通知
model Notification {
  id                  String    @id @default(uuid())

  userId              String
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  type                String    @db.VarChar(50)  // COPY_TRADE | RISK_ALERT | SYSTEM
  title               String    @db.VarChar(255)
  message             String    @db.Text

  // 元數據
  metadata            Json?

  // 狀態
  isRead              Boolean   @default(false)
  readAt              DateTime?

  createdAt           DateTime  @default(now())

  @@index([userId, isRead, createdAt(sort: Desc)])
  @@index([type])
  @@map("notifications")
}

// ==================== 系統相關 ====================

/// 排行榜快照（定期生成）
model LeaderboardSnapshot {
  id                  String    @id @default(uuid())

  period              String    @db.VarChar(20)  // daily | weekly | monthly
  startDate           DateTime
  endDate             DateTime

  data                Json      // 排行榜數據

  createdAt           DateTime  @default(now())

  @@unique([period, startDate])
  @@index([period, createdAt(sort: Desc)])
  @@map("leaderboard_snapshots")
}

/// 系統事件日誌
model SystemEvent {
  id                  String    @id @default(uuid())

  eventType           String    @db.VarChar(50)
  eventName           String    @db.VarChar(100)

  // 事件數據
  data                Json?

  // 元信息
  source              String?   @db.VarChar(50)  // frontend | backend | worker
  severity            String    @db.VarChar(20)  // info | warning | error | critical

  createdAt           DateTime  @default(now())

  @@index([eventType, createdAt(sort: Desc)])
  @@index([severity, createdAt(sort: Desc)])
  @@map("system_events")
}
```

### 關鍵設計決策

#### 1. 使用 Decimal 而非 Float

```prisma
// ✅ 正確：使用 Decimal
totalPnl  Decimal  @db.Decimal(20, 8)

// ❌ 錯誤：使用 Float 會有精度問題
totalPnl  Float
```

**原因**：金融應用必須避免浮點數精度誤差。

#### 2. 軟刪除模式

```prisma
model User {
  // ...
  deletedAt  DateTime?
}
```

**查詢時過濾**：
```typescript
const activeUsers = await prisma.user.findMany({
  where: { deletedAt: null }
});
```

#### 3. 複合索引優化

```prisma
@@index([leaderId, isActive])
@@index([userId, createdAt(sort: Desc)])
```

**優化查詢**：
```sql
-- 利用複合索引
SELECT * FROM copy_relations
WHERE leaderId = ? AND isActive = true;

-- 利用排序索引
SELECT * FROM trades
WHERE userId = ?
ORDER BY createdAt DESC
LIMIT 20;
```

---

## API 設計

### RESTful API 規範

#### 基礎 URL

```
開發環境: http://localhost:3001/api
測試環境: https://api-test.marginmaster.app/api
生產環境: https://api.marginmaster.app/api
```

#### 通用響應格式

**成功響應**：
```typescript
{
  "success": true,
  "data": { /* 實際數據 */ },
  "timestamp": "2026-02-02T10:00:00Z"
}
```

**錯誤響應**：
```typescript
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Copy ratio must be between 1 and 10000",
    "details": { /* 錯誤詳情 */ }
  },
  "timestamp": "2026-02-02T10:00:00Z"
}
```

#### 分頁格式

**請求參數**：
```
?page=1&limit=20
```

**響應格式**：
```typescript
{
  "success": true,
  "data": {
    "items": [ /* 數據列表 */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### API 端點列表

#### 1. 用戶 API

```typescript
// ==================== /api/users ====================

/**
 * 獲取用戶信息
 */
GET /api/users/:address
Response: {
  id: string;
  suiAddress: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

/**
 * 更新用戶信息
 */
PATCH /api/users/:address
Request: {
  username?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}
Response: User

/**
 * 獲取用戶統計
 */
GET /api/users/:address/stats
Response: {
  totalTrades: number;
  totalPnl: string;
  totalFollowers: number;
  totalFollowing: number;
  activePositions: number;
}
```

#### 2. 排行榜 API

```typescript
// ==================== /api/leaderboard ====================

/**
 * 獲取排行榜
 */
GET /api/leaderboard
Query: {
  sortBy?: 'totalPnl' | 'winRate' | 'totalFollowers' | 'sharpeRatio';
  order?: 'asc' | 'desc';
  period?: 'all' | '30d' | '7d';
  page?: number;
  limit?: number;
}
Response: {
  items: Array<{
    rank: number;
    address: string;
    username: string | null;
    totalPnl: string;
    winRate: number;
    totalTrades: number;
    totalFollowers: number;
    tier: number;
    isVerified: boolean;
  }>;
  pagination: Pagination;
}

/**
 * 獲取排行榜快照（歷史數據）
 */
GET /api/leaderboard/snapshots
Query: {
  period: 'daily' | 'weekly' | 'monthly';
  date?: string;  // ISO date
}
Response: {
  period: string;
  startDate: string;
  endDate: string;
  data: LeaderboardData[];
}
```

#### 3. 交易者檔案 API

```typescript
// ==================== /api/traders ====================

/**
 * 獲取交易者檔案
 */
GET /api/traders/:address
Response: {
  address: string;
  username: string | null;
  bio: string | null;

  // 統計數據
  totalFollowers: number;
  totalPnl: string;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  totalVolume: string;

  // 認證信息
  isVerified: boolean;
  tier: number;

  // 策略信息
  tradingStyle: string | null;
  preferredAssets: string[];
  description: string | null;

  createdAt: string;
}

/**
 * 獲取交易者交易歷史
 */
GET /api/traders/:address/trades
Query: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}
Response: {
  items: Trade[];
  pagination: Pagination;
}

/**
 * 獲取交易者績效圖表數據
 */
GET /api/traders/:address/performance
Query: {
  period: '7d' | '30d' | '90d' | '1y' | 'all';
  interval: 'hour' | 'day' | 'week';
}
Response: {
  data: Array<{
    date: string;
    cumulativePnl: string;
    dailyPnl: string;
    trades: number;
  }>;
}

/**
 * 獲取交易者的 Followers
 */
GET /api/traders/:address/followers
Query: {
  page?: number;
  limit?: number;
  activeOnly?: boolean;
}
Response: {
  items: Array<{
    address: string;
    username: string | null;
    copyRatio: number;
    totalCopiedTrades: number;
    totalFeesPaid: string;
    createdAt: string;
  }>;
  pagination: Pagination;
}
```

#### 4. 跟單關係 API

```typescript
// ==================== /api/copy-trades ====================

/**
 * 獲取用戶的跟單關係列表
 */
GET /api/copy-trades
Query: {
  type: 'following' | 'followers';  // 作為 follower 或 leader
  activeOnly?: boolean;
  page?: number;
  limit?: number;
}
Response: {
  items: Array<{
    id: string;
    leader: { address: string; username: string | null; };
    follower: { address: string; username: string | null; };
    copyRatio: number;
    maxPositionSize: string;
    feeRate: number;
    isActive: boolean;
    totalCopiedTrades: number;
    totalFeesPaid: string;
    createdAt: string;
  }>;
  pagination: Pagination;
}

/**
 * 獲取特定跟單關係詳情
 */
GET /api/copy-trades/:relationId
Response: CopyRelation

/**
 * 創建跟單關係（需要鏈上交易）
 * 注意：實際創建由智能合約完成，此端點僅用於記錄
 */
POST /api/copy-trades
Request: {
  leaderAddress: string;
  copyRatio: number;
  maxPositionSize: string;
  feeRate: number;
  txDigest: string;  // 鏈上交易憑證
}
Response: CopyRelation

/**
 * 更新跟單關係（需要鏈上交易）
 */
PATCH /api/copy-trades/:relationId
Request: {
  copyRatio?: number;
  maxPositionSize?: string;
  feeRate?: number;
  txDigest: string;
}
Response: CopyRelation

/**
 * 停止跟單關係（需要鏈上交易）
 */
DELETE /api/copy-trades/:relationId
Request: {
  txDigest: string;
}
Response: { success: true }

/**
 * 獲取跟單執行歷史
 */
GET /api/copy-trades/:relationId/executions
Query: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}
Response: {
  items: CopyTradeExecution[];
  pagination: Pagination;
}
```

#### 5. 風險管理 API

```typescript
// ==================== /api/risk ====================

/**
 * 獲取 Margin Manager 風險指標
 */
GET /api/risk/margin-manager/:managerId
Response: {
  marginManagerId: string;
  currentRiskRatio: number;
  liquidationPrice: string;
  marginUsed: string;
  marginAvailable: string;
  healthScore: number;
  alerts: Array<{
    level: 'info' | 'warning' | 'danger';
    message: string;
    action: string;
  }>;
  updatedAt: string;
}

/**
 * 估算訂單風險
 */
POST /api/risk/estimate
Request: {
  marginManagerId: string;
  orderType: 'MARKET' | 'LIMIT';
  side: 'BUY' | 'SELL';
  quantity: string;
  price?: string;
  leverage: number;
}
Response: {
  estimatedMarginRequired: string;
  estimatedLiquidationPrice: string;
  estimatedRiskRatio: number;
  estimatedHealthScore: number;
  warnings: string[];
  errors: string[];
  isValid: boolean;
}
```

#### 6. 交易 API

```typescript
// ==================== /api/trades ====================

/**
 * 獲取交易列表
 */
GET /api/trades
Query: {
  userId?: string;
  poolId?: string;
  status?: 'OPEN' | 'FILLED' | 'CANCELLED';
  isCopyTrade?: boolean;
  page?: number;
  limit?: number;
}
Response: {
  items: Trade[];
  pagination: Pagination;
}

/**
 * 獲取交易詳情
 */
GET /api/trades/:tradeId
Response: Trade

/**
 * 記錄交易（由事件索引器調用）
 */
POST /api/trades
Request: {
  userId: string;
  marginManagerId: string;
  poolId: string;
  orderType: string;
  side: string;
  quantity: string;
  price?: string;
  leverage: number;
  txDigest: string;
}
Response: Trade
```

#### 7. 通知 API

```typescript
// ==================== /api/notifications ====================

/**
 * 獲取通知列表
 */
GET /api/notifications
Query: {
  isRead?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}
Response: {
  items: Notification[];
  unreadCount: number;
  pagination: Pagination;
}

/**
 * 標記為已讀
 */
PATCH /api/notifications/:notificationId/read
Response: { success: true }

/**
 * 批量標記為已讀
 */
POST /api/notifications/mark-all-read
Response: { success: true; count: number }
```

#### 8. 系統 API

```typescript
// ==================== /api/system ====================

/**
 * 健康檢查
 */
GET /api/health
Response: {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    blockchain: 'up' | 'down';
  };
}

/**
 * 獲取系統統計
 */
GET /api/system/stats
Response: {
  totalUsers: number;
  totalTraders: number;
  totalCopyRelations: number;
  totalTrades: number;
  total24hVolume: string;
  activeCopyRelations: number;
}
```

---

## WebSocket 實時通信

### 連接與認證

```typescript
// 前端連接
import { io } from 'socket.io-client';

const socket = io('wss://api.marginmaster.app', {
  auth: {
    address: userAddress,
    signature: signedMessage,  // 錢包簽名認證
  }
});
```

### 事件訂閱

```typescript
// ==================== 客戶端訂閱 ====================

// 訂閱跟單執行通知
socket.on('copy-trade-executed', (data: {
  relationId: string;
  leader: string;
  copiedQuantity: string;
  fee: string;
  txDigest: string;
}) => {
  // 更新 UI
});

// 訂閱風險警報
socket.on('risk-alert', (data: {
  marginManagerId: string;
  healthScore: number;
  level: 'warning' | 'danger';
  message: string;
}) => {
  // 顯示警報
});

// 訂閱價格更新
socket.on('price-update', (data: {
  poolId: string;
  price: string;
  timestamp: number;
}) => {
  // 更新價格顯示
});

// 訂閱排行榜更新
socket.on('leaderboard-updated', () => {
  // 重新獲取排行榜
});
```

### 服務端實現

```typescript
// backend/src/websocket/index.ts
import { Server } from 'socket.io';
import { verifySignature } from '@/lib/auth';

export function setupWebSocket(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    }
  });

  // 認證中間件
  io.use(async (socket, next) => {
    const { address, signature } = socket.handshake.auth;

    const isValid = await verifySignature(address, signature);
    if (!isValid) {
      return next(new Error('Invalid signature'));
    }

    socket.data.address = address;
    next();
  });

  io.on('connection', (socket) => {
    const userAddress = socket.data.address;

    // 加入用戶專屬房間
    socket.join(`user:${userAddress}`);

    console.log(`User ${userAddress} connected`);

    socket.on('disconnect', () => {
      console.log(`User ${userAddress} disconnected`);
    });
  });

  return io;
}

// 發送通知
export function emitCopyTradeNotification(io: Server, data: any) {
  io.to(`user:${data.followerAddress}`).emit('copy-trade-executed', data);
}

export function emitRiskAlert(io: Server, userAddress: string, data: any) {
  io.to(`user:${userAddress}`).emit('risk-alert', data);
}
```

---

## 快取策略

### Redis 快取層次

```typescript
// lib/cache.ts
import { redis } from './redis';

export class CacheService {
  // ==================== 排行榜快取 ====================

  /**
   * 快取時間：30 秒
   * 更新頻率：定時任務每 5 分鐘更新一次
   */
  async getLeaderboard(key: string) {
    const cached = await redis.get(`leaderboard:${key}`);
    if (cached) return JSON.parse(cached);
    return null;
  }

  async setLeaderboard(key: string, data: any, ttl = 30) {
    await redis.setex(
      `leaderboard:${key}`,
      ttl,
      JSON.stringify(data)
    );
  }

  // ==================== 實時價格快取 ====================

  /**
   * 快取時間：5 秒
   * 更新頻率：價格服務實時推送
   */
  async getPrice(poolId: string) {
    const cached = await redis.get(`price:${poolId}`);
    if (cached) return parseFloat(cached);
    return null;
  }

  async setPrice(poolId: string, price: number, ttl = 5) {
    await redis.setex(`price:${poolId}`, ttl, price.toString());
  }

  // ==================== 用戶會話快取 ====================

  /**
   * 快取時間：1 小時
   */
  async getSession(sessionId: string) {
    const cached = await redis.get(`session:${sessionId}`);
    if (cached) return JSON.parse(cached);
    return null;
  }

  async setSession(sessionId: string, data: any, ttl = 3600) {
    await redis.setex(
      `session:${sessionId}`,
      ttl,
      JSON.stringify(data)
    );
  }

  // ==================== 交易者統計快取 ====================

  /**
   * 快取時間：60 秒
   */
  async getTraderStats(address: string) {
    const cached = await redis.get(`trader:stats:${address}`);
    if (cached) return JSON.parse(cached);
    return null;
  }

  async setTraderStats(address: string, data: any, ttl = 60) {
    await redis.setex(
      `trader:stats:${address}`,
      ttl,
      JSON.stringify(data)
    );
  }

  // ==================== 風險指標快取 ====================

  /**
   * 快取時間：10 秒
   */
  async getRiskMetrics(managerId: string) {
    const cached = await redis.get(`risk:${managerId}`);
    if (cached) return JSON.parse(cached);
    return null;
  }

  async setRiskMetrics(managerId: string, data: any, ttl = 10) {
    await redis.setex(
      `risk:${managerId}`,
      ttl,
      JSON.stringify(data)
    );
  }

  // ==================== 通用方法 ====================

  async invalidate(pattern: string) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async invalidateMultiple(patterns: string[]) {
    for (const pattern of patterns) {
      await this.invalidate(pattern);
    }
  }
}
```

### 快取失效策略

```typescript
// 當交易執行後，失效相關快取
async function onTradeExecuted(trade: Trade) {
  const cache = new CacheService();

  await cache.invalidateMultiple([
    `trader:stats:${trade.userId}`,
    `leaderboard:*`,
    `user:${trade.userId}:trades`,
  ]);
}

// 當跟單關係變更後，失效相關快取
async function onCopyRelationChanged(relation: CopyRelation) {
  const cache = new CacheService();

  await cache.invalidateMultiple([
    `trader:stats:${relation.leaderId}`,
    `trader:followers:${relation.leaderId}`,
    `user:${relation.followerId}:following`,
  ]);
}
```

---

## 數據遷移

### Prisma 遷移流程

```bash
# 創建新遷移
npx prisma migrate dev --name add_trader_description

# 應用遷移（生產環境）
npx prisma migrate deploy

# 重置數據庫（僅開發環境）
npx prisma migrate reset

# 生成 Prisma Client
npx prisma generate
```

### 種子數據

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  // 創建測試用戶
  for (let i = 0; i < 10; i++) {
    const user = await prisma.user.create({
      data: {
        suiAddress: `0x${faker.string.hexadecimal({ length: 64 }).toLowerCase()}`,
        username: faker.internet.userName(),
        email: faker.internet.email(),
        avatarUrl: faker.image.avatar(),
      },
    });

    // 創建交易者檔案
    await prisma.traderProfile.create({
      data: {
        userId: user.id,
        totalPnl: faker.number.float({ min: -10000, max: 50000, precision: 0.01 }),
        winRate: faker.number.float({ min: 0.3, max: 0.8, precision: 0.01 }),
        totalTrades: faker.number.int({ min: 10, max: 500 }),
        isVerified: faker.datatype.boolean(),
        tier: faker.number.int({ min: 0, max: 4 }),
      },
    });
  }

  console.log('Seed data created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

```bash
# 執行種子腳本
npx prisma db seed
```

---

## 總結

這份數據庫與 API 設計文檔提供了：

✅ **完整的 Prisma Schema** - 可直接使用的數據庫模型
✅ **RESTful API 規範** - 所有端點的詳細定義
✅ **WebSocket 實時通信** - 雙向通信機制
✅ **Redis 快取策略** - 性能優化方案
✅ **數據遷移指南** - Prisma 遷移流程

**下一步閱讀**：
- [後端架構](./MarginMaster_Backend.md) - 後端服務詳細實現
- [前端架構](./MarginMaster_Frontend.md) - 前端組件設計
