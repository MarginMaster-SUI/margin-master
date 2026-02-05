# MarginMaster - AGI 開發協作指南

> **版本:** 2.0
> **日期:** 2026-02-02
> **狀態:** Ready for Implementation
> **適用範圍:** Cursor AI, Claude, GPT-4 等 AI 編程助手

---

## 📋 目錄

1. [AGI 協作策略](#agi-協作策略)
2. [項目初始化 Prompts](#項目初始化-prompts)
3. [功能模組 Prompts](#功能模組-prompts)
4. [測試相關 Prompts](#測試相關-prompts)
5. [整合與部署 Prompts](#整合與部署-prompts)
6. [安全性審查](#安全性審查)
7. [常見錯誤與修正](#常見錯誤與修正)
8. [最佳實踐](#最佳實踐)

---

## AGI 協作策略

### 開發流程

```
需求拆解 → 生成代碼 → 審查修正 → 整合測試 → 迭代優化
    ↓         ↓         ↓         ↓         ↓
  1-2天     3-4天     持續進行    Day 6     Day 7
```

### 核心原則

#### 1. 明確的上下文

**每次與 AGI 對話都應包含：**

```markdown
# Project Context
- Project: MarginMaster
- Goal: [具體目標，如：實現保證金交易界面]
- Tech Stack: React 18 + TypeScript, Sui Move, Node.js, PostgreSQL

# Current State
- Completed: [已完成模組列表]
- Current Files: [相關文件結構]

# Task
[具體要求]

# Constraints
- 使用 TypeScript（不使用 any）
- 所有金額使用 BigNumber 處理
- 包含錯誤處理和邊界檢查
```

#### 2. 增量開發

**原則**：一次處理一個模組，避免單次要求過大

```
✅ 好的做法：
"請實現 TradingPanel 組件，包含訂單表單和風險指標顯示"

❌ 壞的做法：
"請實現整個交易系統，包括前端、後端、智能合約、測試、文檔"
```

#### 3. 測試驅動

**每次生成代碼時都要求同步生成測試：**

```markdown
請在生成功能代碼的同時，生成對應的單元測試，測試需覆蓋：
1. 正常情況（happy path）
2. 邊界條件（edge cases）
3. 錯誤處理（error handling）
4. 外部依賴使用 mock 處理
```

#### 4. 代碼審查

**人類必須審查的關鍵邏輯：**

```markdown
⚠️ 必須人工審查：

1. 智能合約：
   - 權限檢查（sender/owner）
   - 資金轉移（transfer、coin::split）
   - 風險計算邏輯
   - 費用計算與分配
   - 任何涉及 Loop + 大量操作的地方（Gas 風險）

2. 前端：
   - 下單與簽名邏輯
   - 風險提示與限制
   - 用戶輸入驗證

3. 後端：
   - SQL 查詢（防注入）
   - 外部輸入處理
   - 權限驗證
```

#### 5. 文檔同步

**要求 AGI 為關鍵代碼添加註釋：**

```typescript
/**
 * 計算跟單規模
 * @param originalQty - Leader 的原始訂單數量
 * @param copyRatio - 跟單比例（basis points，5000 = 50%）
 * @param maxPosition - 最大單筆倉位限制
 * @returns 實際跟單數量（已應用最大倉位限制）
 */
public fun calculate_copy_size(
    originalQty: bigint,
    copyRatio: number,
    maxPosition: bigint
): bigint {
    const calculated = (originalQty * BigInt(copyRatio)) / 10000n;
    return calculated > maxPosition ? maxPosition : calculated;
}
```

---

## 項目初始化 Prompts

### Prompt 1：項目腳手架

```markdown
# Context
我正在開發 MarginMaster，一個基於 Sui 區塊鏈和 DeepBook Margin 的社交化保證金交易平台。

# Tech Stack
- Frontend: React 18 + TypeScript + Vite
- Wallet: @mysten/dapp-kit
- State: Zustand + React Query
- Smart Contract: Sui Move
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL
- Cache: Redis
- Blockchain: Sui Testnet

# Task
請幫我生成完整的項目初始化結構：

## 1. 前端項目（marginmaster-frontend）

使用 Vite 創建 React + TypeScript 項目：
```bash
npm create vite@latest marginmaster-frontend -- --template react-ts
cd marginmaster-frontend
```

安裝依賴並配置：
- @mysten/sui.js @mysten/dapp-kit
- zustand @tanstack/react-query
- react-router-dom react-hook-form zod
- recharts bignumber.js date-fns
- tailwindcss

創建文件夾結構：
```
src/
├── components/
│   ├── trading/
│   ├── copyTrade/
│   ├── leaderboard/
│   ├── risk/
│   └── common/
├── pages/
├── hooks/
├── services/
├── store/
├── types/
└── utils/
```

## 2. Sui Move 項目（margin_master）

創建智能合約項目：
```bash
sui move new margin_master
```

創建模組結構：
```
sources/
├── copy_trade.move
├── trader_profile.move
├── fee_manager.move
├── risk_checker.move
└── emergency_pause.move
```

配置 Move.toml：
- 添加 Sui Framework 依賴
- 添加 DeepBook 依賴

## 3. 後端項目（marginmaster-backend）

創建 Node.js 項目並安裝：
- express cors helmet compression
- @mysten/sui.js
- @prisma/client prisma
- bullmq ioredis
- pino
- typescript tsx

創建文件夾結構：
```
src/
├── api/
│   ├── routes/
│   └── middleware/
├── services/
├── workers/
├── indexers/
├── lib/
└── types/
```

## 4. 環境配置

創建 .env.example 文件，包含：
- SUI_NETWORK=testnet
- SUI_RPC_URL=https://fullnode.testnet.sui.io:443
- DATABASE_URL=postgresql://...
- REDIS_URL=redis://...

請提供完整的配置文件內容和安裝命令，不只是片段。
```

---

### Prompt 2：錢包連接設置

```markdown
# Context
MarginMaster 需要整合 Sui 錢包連接功能，使用 @mysten/dapp-kit。

# Requirements
1. 支持主流 Sui 錢包（Sui Wallet, Suiet, Ethos）
2. 連接後顯示用戶地址和 SUI 餘額
3. 斷開連接功能
4. 網絡切換（Testnet/Mainnet）
5. 簡潔的 UI，支持自定義樣式

# Task
請生成以下代碼：

## 1. src/App.tsx
設置 SuiClientProvider 和 WalletProvider：
- 配置 Testnet RPC
- 支持多個網絡（devnet/testnet/mainnet）
- 整合 React Query

## 2. src/components/wallet/ConnectButton.tsx
錢包連接按鈕組件：
- 未連接時顯示「連接錢包」按鈕
- 已連接時顯示截斷地址（0x1234...5678）
- 點擊地址顯示下拉菜單（查看餘額、斷開連接）
- 顯示 SUI 餘額

## 3. src/hooks/useWallet.ts
封裝常用錢包操作：
- address: string | undefined
- isConnected: boolean
- executeTransaction: (tx: TransactionBlock) => Promise<SuiTransactionBlockResponse>
- 包含錯誤處理

## 4. src/types/wallet.ts
錢包相關 TypeScript 類型定義

要求：
- 使用 TypeScript（不使用 any）
- 包含基本錯誤處理與 loading 狀態
- 添加必要的 JSDoc 註釋
```

---

## 功能模組 Prompts

### Prompt 3：保證金交易界面

```markdown
# Context
構建 MarginMaster 的核心交易界面，讓用戶在 DeepBook Margin 上進行保證金交易。

# Technical Details
- 使用 DeepBook Margin MarginManager 和 Pool Proxy
- 支持市價單與限價單
- 支持做多/做空
- 槓桿倍數選擇（1x-10x）
- 實時顯示風險指標

# Task
請生成以下文件：

## 1. src/components/trading/TradingPanel/index.tsx
主交易面板組件：
- Props: poolId, marginManagerId
- 包含 OrderForm 和 RiskMetrics 子組件
- 使用 Card 布局

## 2. src/components/trading/TradingPanel/OrderForm.tsx
訂單表單組件：
- 使用 react-hook-form + zod 驗證
- UI 元素：
  - 訂單類型切換（市價/限價）
  - 買/賣按鈕（綠色做多/紅色做空）
  - 價格輸入（限價單）
  - 數量輸入
  - 槓桿滑桿（1x-10x）
  - 止損/止盈（可選）
  - 提交按鈕
- 顯示預估數據：
  - 開倉價值
  - 所需保證金
  - 預估清算價格

## 3. src/components/trading/TradingPanel/RiskMetrics.tsx
風險指標顯示組件：
- 健康度評分（0-100，帶顏色）
- 風險比率
- 清算價格（紅色高亮）
- 已用/可用保證金
- 風險警報（健康度 < 30 時顯示）

## 4. src/services/deepbook.ts
DeepBook 交易服務：
```typescript
export async function placeMarketOrder(params: {
  marginManagerId: string;
  poolId: string;
  quantity: number;
  isBuy: boolean;
  leverage: number;
}): Promise<SuiTransactionBlockResponse>;

export async function placeLimitOrder(params: {
  marginManagerId: string;
  poolId: string;
  price: number;
  quantity: number;
  isBuy: boolean;
  leverage: number;
}): Promise<SuiTransactionBlockResponse>;

export async function getRiskMetrics(
  marginManagerId: string
): Promise<RiskMetrics>;
```

## 5. src/hooks/useTradingPanel.ts
交易面板邏輯 Hook：
- 管理表單狀態
- 下單前風險檢查
- 若風險過高則禁止下單並顯示警告

要求：
- 完整 TypeScript 類型
- 每個公開函數添加 JSDoc
- 環境變數讀取 PACKAGE_ID（不硬編碼）
- 包含錯誤處理和 loading 狀態
```

---

### Prompt 4：跟單智能合約

```markdown
# Context
用 Sui Move 編寫跟單智能合約，允許 Follower 自動跟隨 Leader 的交易。

# Technical Requirements
- 整合 DeepBook Margin 的 MarginManager
- 自定義跟單比例（1%-100%）
- 費用分配機制（Protocol 5%，Leader 95%）
- 風險檢查（Follower 風險比率 > 1.2 才允許跟單）
- 支持最大倉位限制

# Data Structures

## CopyTradeRelation
```move
struct CopyTradeRelation has key, store {
    id: UID,
    leader: address,
    follower: address,
    copy_ratio: u64,           // basis points (5000 = 50%)
    max_position_size: u64,
    fee_rate: u64,             // basis points
    is_active: bool,
    total_copied_trades: u64,
    total_fees_paid: u64,
}
```

## TraderProfile
```move
struct TraderProfile has key {
    id: UID,
    trader: address,
    total_followers: u64,
    total_pnl: i64,
    total_trades: u64,
    win_rate: u64,             // basis points
}
```

# Task
請生成以下 Move 模組：

## 1. sources/copy_trade.move

完整實現以下函數：

```move
module margin_master::copy_trade {
    use sui::tx_context::TxContext;
    use sui::object::{Self, UID};
    use sui::event;

    // 錯誤碼
    const E_UNAUTHORIZED: u64 = 1;
    const E_INVALID_COPY_RATIO: u64 = 2;
    const E_RISK_TOO_HIGH: u64 = 3;

    // 常數
    const MIN_RISK_RATIO_BPS: u64 = 12000;  // 1.2x
    const BPS_DENOMINATOR: u64 = 10000;

    /// 創建跟單關係
    public entry fun create_copy_relation(
        leader: address,
        copy_ratio: u64,
        max_position_size: u64,
        fee_rate: u64,
        ctx: &mut TxContext
    ) {
        // 實現邏輯
    }

    /// 停止跟單關係
    public entry fun stop_copy_relation(
        relation: CopyTradeRelation,
        ctx: &mut TxContext
    ) {
        // 實現邏輯
    }

    /// 計算跟單規模
    public fun calculate_copy_size(
        leader_quantity: u64,
        copy_ratio: u64,
        max_position_size: u64
    ): u64 {
        // 實現邏輯
    }

    /// 檢查風險是否可接受
    public fun is_risk_acceptable(
        risk_ratio_bps: u64
    ): bool {
        risk_ratio_bps >= MIN_RISK_RATIO_BPS
    }

    /// 發出交易信號事件
    public entry fun emit_leader_trade_signal(
        pool_id: ID,
        side: bool,
        quantity: u64,
        ctx: &mut TxContext
    ) {
        // 實現邏輯
    }
}
```

## 2. sources/fee_manager.move

費用計算與分配：
```move
/// 計算費用分配
/// 返回：(protocol_fee, leader_fee)
public fun calculate_fee_split(
    total_fee: u64,
    protocol_fee_rate: u64
): (u64, u64);
```

要求：
- 使用清楚的錯誤碼（const E_XXX）
- 每個 entry fun 檢查 sender 權限
- 為核心函數添加註釋
- 包含事件定義（LeaderTradeSignal, CopyTradeExecuted）
```

---

### Prompt 5：排行榜系統

```markdown
# Context
MarginMaster 需要排行榜系統，展示表現最佳的交易者並計算績效指標。

# Architecture
- Frontend: 顯示排行榜與交易者詳細頁
- Backend: Node.js API（索引鏈上事件並計算統計）
- Database: PostgreSQL

# Metrics
1. 30 天盈虧（PnL）
2. 勝率（winning trades / total trades）
3. 平均盈利 / 平均虧損
4. 最大回撤（max drawdown）
5. 夏普比率（Sharpe ratio）
6. 跟隨者數量
7. 總交易次數

# Task - Backend

## 1. backend/src/indexers/SuiEventListener.ts
監聽 Sui 鏈上事件：
```typescript
export class SuiEventListener {
  private suiClient: SuiClient;

  async startListening(): Promise<void> {
    // 監聽 LeaderTradeSignal 事件
    // 監聽 CopyTradeExecuted 事件
  }

  private async handleTradeEvent(event: SuiEvent): Promise<void> {
    // 解析事件並存入 trades 表
  }
}
```

## 2. backend/src/services/leaderboard/PerformanceCalculator.ts
績效計算服務：
```typescript
export class PerformanceCalculator {
  async calculateTraderStats(userAddress: string): Promise<TraderStats>;

  private calculateMaxDrawdown(trades: Trade[]): number;
  private calculateSharpeRatio(trades: Trade[]): number;
  private calculateWinRate(trades: Trade[]): number;
}
```

## 3. backend/src/api/routes/leaderboard.ts
API 端點：
- GET /api/leaderboard?sortBy=totalPnl&order=desc&page=1&limit=50
- GET /api/traders/:address/stats
- GET /api/traders/:address/trades

# Task - Frontend

## 4. src/components/leaderboard/LeaderboardTable/index.tsx
排行榜表格組件：
- 顯示前 N 名交易者
- 欄位：排名、交易者、30天盈虧、勝率、交易次數、跟隨者數
- 支持分頁
- 排序功能（按不同指標排序）

## 5. src/pages/Profile/index.tsx
交易者詳細頁：
- 顯示交易者統計數據
- 盈虧折線圖（使用 Recharts）
- 最近交易列表
- 跟隨者列表
- 跟單按鈕

要求：
- 所有 API 返回類型明確定義
- 排行榜支持分頁與排序
- 包含錯誤處理
- 使用 React Query 管理服務端狀態
```

---

### Prompt 6：風險管理引擎

```markdown
# Context
MarginMaster 需要實時風險管理引擎，計算風險指標並提供警告。

# Risk Metrics
1. 風險比率 = 總資產 / 總負債
2. 清算價格 = 使資產/負債 = 1.1 的價格
3. 健康度（0-100）：
   - ≥ 2.0 → 100
   - 1.5 → 80
   - 1.3 → 60
   - 1.15 → 30
   - < 1.15 → 10
4. 保證金使用率 = 已用保證金 / 總保證金

# Task

## 1. src/services/riskEngine.ts

完整實現：
```typescript
export interface RiskMetrics {
  currentRiskRatio: number;
  liquidationPrice: number;
  marginUsed: number;
  marginAvailable: number;
  positionSize: number;
  unrealizedPnL: number;
  healthScore: number;
}

export interface RiskAlert {
  level: 'info' | 'warning' | 'danger';
  message: string;
  action: string;
}

/**
 * 計算風險指標
 * @param marginManagerId - Margin Manager 對象 ID
 * @returns 完整的風險指標
 */
export async function calculateRiskMetrics(
  marginManagerId: string
): Promise<RiskMetrics>;

/**
 * 生成風險警報
 * @param metrics - 當前風險指標
 * @param currentPrice - 當前市場價格
 * @returns 警報列表
 */
export function generateRiskAlerts(
  metrics: RiskMetrics,
  currentPrice: number
): RiskAlert[];

/**
 * 計算清算價格
 */
export function calculateLiquidationPrice(
  baseBalance: number,
  quoteBalance: number,
  borrowedBase: number,
  borrowedQuote: number
): number;

/**
 * 建議止損價格
 */
export function suggestStopLoss(
  entryPrice: number,
  currentPrice: number,
  positionType: 'long' | 'short',
  riskTolerance: number
): number;
```

## 2. src/components/risk/RiskDashboard.tsx
風險儀表板組件：
- 接收 RiskMetrics 和 RiskAlert[]
- 顯示健康度評分（帶顏色）
- 顯示所有風險指標
- 顯示警報列表

## 3. src/hooks/useRiskMonitor.ts
風險監控 Hook：
- 使用 React Query
- 每 30 秒拉取一次風險指標
- 健康度 < 30 時觸發瀏覽器通知

要求：
- 使用 BigNumber 或 Decimal.js 處理金額
- 添加單元測試示例
- 完整的 TypeScript 類型
```

---

## 測試相關 Prompts

### Prompt 7：智能合約測試

```markdown
# Context
為 MarginMaster 的 Sui Move 智能合約編寫測試，確保跟單邏輯正確。

# Test Requirements
- 跟單比例計算
- 最大倉位限制
- 風險檢查拒絕
- 權限檢查

# Task
請為 sources/copy_trade.move 生成完整測試：

## tests/copy_trade_tests.move

```move
#[test_only]
module margin_master::copy_trade_tests {
    use margin_master::copy_trade;
    use sui::test_scenario;

    #[test]
    fun test_create_copy_relation() {
        // 測試創建跟單關係
        // 驗證所有字段正確設置
    }

    #[test]
    fun test_copy_size_calculation() {
        // leader_order_size = 1000
        // copy_ratio = 5000 (50%)
        // max_position_size = 300
        // 期望結果: 300（被 max_position_size 限制）
    }

    #[test]
    fun test_copy_size_within_limit() {
        // leader_order_size = 1000
        // copy_ratio = 2000 (20%)
        // max_position_size = 500
        // 期望結果: 200（未觸及限制）
    }

    #[test]
    #[expected_failure(abort_code = copy_trade::E_UNAUTHORIZED)]
    fun test_unauthorized_stop_relation() {
        // 非 follower 或 leader 嘗試停止關係
        // 應該失敗
    }

    #[test]
    fun test_is_risk_acceptable() {
        // 風險比率 = 1.5 (15000 bps) → true
        // 風險比率 = 1.1 (11000 bps) → false
    }

    #[test]
    fun test_calculate_fee_split() {
        // total_fee = 100
        // protocol_rate = 500 (5%)
        // 期望: protocol_fee = 5, leader_fee = 95
    }
}
```

要求：
- 補上具體測試邏輯
- 確保可以通過 `sui move test` 編譯
- 使用 test_scenario 正確管理測試上下文
```

---

### Prompt 8：前端單元測試

```markdown
# Context
MarginMaster 前端需要單元測試保障交易與風險邏輯的正確性。

# Tech Stack
- Testing: Vitest
- React Testing Library
- Mock: vi.mock()

# Task
請生成以下測試文件：

## 1. tests/services/riskEngine.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateRiskMetrics,
  calculateLiquidationPrice,
  generateRiskAlerts,
} from '@/services/riskEngine';

describe('Risk Engine', () => {
  describe('calculateLiquidationPrice', () => {
    it('應該正確計算清算價格', () => {
      // 測試用例
    });

    it('baseBalance 為 0 時應返回 0', () => {
      // 邊界條件
    });
  });

  describe('generateRiskAlerts', () => {
    it('健康度 < 30 時應生成 danger 警報', () => {
      // 測試用例
    });

    it('健康度 30-50 時應生成 warning 警報', () => {
      // 測試用例
    });

    it('健康度 > 50 時不應生成警報', () => {
      // 測試用例
    });
  });
});
```

## 2. tests/components/TradingPanel.test.tsx

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TradingPanel } from '@/components/trading/TradingPanel';

describe('TradingPanel', () => {
  it('應該渲染訂單表單', () => {
    // 測試渲染
  });

  it('輸入負數時應顯示錯誤', () => {
    // 表單驗證測試
  });

  it('風險過高時應禁用提交按鈕', () => {
    // Mock 風險數據
    // 驗證按鈕狀態
  });

  it('點擊提交應調用下單函數', async () => {
    // Mock executeTransaction
    // 驗證函數被調用
  });
});
```

## 3. tests/hooks/useTradingPanel.test.ts

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTradingPanel } from '@/hooks/useTradingPanel';

describe('useTradingPanel', () => {
  it('應該返回初始狀態', () => {
    const { result } = renderHook(() => useTradingPanel());
    expect(result.current.orderType).toBe('MARKET');
  });

  it('更新槓桿應更新派生值', () => {
    // 測試狀態更新
  });

  it('下單成功應更新狀態', async () => {
    // 測試異步操作
  });
});
```

要求：
- 使用 TypeScript
- 使用 describe/it 結構
- 包含斷言和期望值
- Mock 外部依賴
```

---

## 整合與部署 Prompts

### Prompt 9：CI/CD 配置

```markdown
# Context
MarginMaster 需要基本的 CI/CD 流程。

# Requirements
- Frontend: GitHub Actions + Vercel
- Contracts: GitHub Actions + Sui Testnet 部署
- Backend: GitHub Actions + Railway

# Task

## 1. .github/workflows/frontend.yml

```yaml
name: Frontend CI/CD

on:
  pull_request:
    paths:
      - 'frontend/**'
  push:
    branches:
      - main
    paths:
      - 'frontend/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run tests
        run: cd frontend && npm test
      - name: Run lint
        run: cd frontend && npm run lint

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        # TODO: 配置 Vercel 部署
```

## 2. .github/workflows/contracts.yml

```yaml
name: Smart Contracts CI/CD

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Sui CLI
        run: |
          # TODO: 安裝 Sui CLI
      - name: Build contracts
        run: cd margin_master && sui move build
      - name: Deploy to Testnet
        run: |
          # TODO: 配置私鑰和部署命令
          # sui client publish --gas-budget 500000000
```

## 3. scripts/deploy-contracts.sh

```bash
#!/bin/bash
set -e

NETWORK=${1:-testnet}
GAS_BUDGET=${2:-500000000}

echo "Deploying to $NETWORK..."

# 切換網絡
sui client switch --env $NETWORK

# 檢查 gas
sui client gas

# 編譯
sui move build

# 部署
RESULT=$(sui client publish --gas-budget $GAS_BUDGET --json)

# 提取 Package ID
PACKAGE_ID=$(echo $RESULT | jq -r '.objectChanges[] | select(.type=="published") | .packageId')

echo "✅ Deployment successful!"
echo "Package ID: $PACKAGE_ID"
echo ""
echo "請將以下內容添加到 .env:"
echo "VITE_MARGIN_MASTER_PACKAGE_ID=$PACKAGE_ID"
```

## 4. vercel.json

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_SUI_NETWORK": "testnet",
    "VITE_SUI_RPC_URL": "https://fullnode.testnet.sui.io:443",
    "VITE_MARGIN_MASTER_PACKAGE_ID": "@margin_master_package_id"
  }
}
```

要求：
- 在關鍵地方加註 TODO
- 提供清晰的部署步驟說明
```

---

### Prompt 10：文檔生成

```markdown
# Context
為 MarginMaster 生成開發者文檔，方便團隊理解與參與。

# Task

## 1. README.md

```markdown
# MarginMaster

一個基於 Sui 區塊鏈和 DeepBook Margin 的社交化保證金交易平台。

## 🚀 核心特性

- 🔄 **社交跟單**：一鍵複製頂尖交易者的策略
- 📊 **實時排行榜**：多維度績效評估（PnL、勝率、夏普比率）
- ⚡ **DeepBook Margin**：高效的鏈上保證金交易
- 🛡️ **AI 風險管理**：實時監控，自動警報

## 📦 項目結構

```
marginmaster/
├── frontend/          # React + TypeScript 前端
├── backend/           # Node.js + Express 後端
├── margin_master/     # Sui Move 智能合約
└── docs/              # 設計文檔
```

## 🏃 快速開始

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 後端

```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

### 智能合約

```bash
cd margin_master
sui move build
sui move test
sui client publish --gas-budget 500000000
```

## 📚 文檔

- [架構設計](./docs/MarginMaster_Architecture.md)
- [智能合約](./docs/MarginMaster_Smart_Contracts.md)
- [API 文檔](./docs/MarginMaster_Database_API.md)
- [開發計劃](./docs/MarginMaster_Development_Plan.md)
```

## 2. docs/API_Reference.md

列出所有後端 API endpoints：
- 端點路徑
- 請求參數
- 響應格式
- 錯誤碼
- 使用示例

## 3. docs/Contract_Guide.md

智能合約使用指南：
- 主要模組說明
- Entry 函數用途
- 重要 Struct 和 Event
- 前端調用示例

要求：
- 使用清晰的 Markdown 標題
- 代碼塊使用語法高亮
- 包含實際可運行的示例
```

---

## 安全性審查

### 必須人工檢查的代碼類型

#### 1. 智能合約安全

```markdown
⚠️ 關鍵檢查點：

1. 權限檢查
   ✅ 正確：
   ```move
   assert!(tx_context::sender(ctx) == relation.follower, E_UNAUTHORIZED);
   ```

   ❌ 錯誤：
   ```move
   // 沒有檢查 sender，任何人都能調用
   public entry fun stop_relation(relation: CopyTradeRelation) { }
   ```

2. 資金轉移
   ✅ 正確：
   ```move
   let protocol_coin = coin::split(&mut fee_payment, protocol_fee, ctx);
   transfer::public_transfer(protocol_coin, treasury);
   transfer::public_transfer(fee_payment, leader);
   ```

   ❌ 錯誤：
   ```move
   // 沒有驗證金額，可能轉移錯誤
   transfer::public_transfer(coin, some_address);
   ```

3. 數值計算
   ✅ 正確：
   ```move
   let calculated = (quantity * copy_ratio) / BPS_DENOMINATOR;
   assert!(calculated <= max_position, E_EXCEEDS_MAX);
   ```

   ❌ 錯誤：
   ```move
   // 可能溢出，沒有邊界檢查
   let result = a * b / c;
   ```

4. Loop 操作（Gas 風險）
   ⚠️ 謹慎使用：
   ```move
   // 避免大量循環，使用事件驅動
   while (i < followers.length()) {  // 如果 followers 很多會耗盡 Gas
       // ...
   }
   ```
```

#### 2. 前端安全

```markdown
1. 用戶輸入驗證
   ✅ 正確：
   ```typescript
   const schema = z.object({
     quantity: z.number().positive().max(1000000),
     leverage: z.number().min(1).max(10),
   });
   ```

   ❌ 錯誤：
   ```typescript
   // 直接使用未驗證的輸入
   placeOrder({ quantity: userInput });
   ```

2. 交易簽名
   ✅ 正確：
   ```typescript
   const result = await executeTransaction(tx);
   if (result.effects?.status?.status !== 'success') {
     throw new Error('Transaction failed');
   }
   ```

   ❌ 錯誤：
   ```typescript
   // 沒有檢查交易結果
   await executeTransaction(tx);
   // 假設成功...
   ```
```

#### 3. 後端安全

```markdown
1. SQL 注入防護
   ✅ 正確（使用 Prisma）：
   ```typescript
   const trades = await prisma.trade.findMany({
     where: { userId: userAddress },
   });
   ```

   ❌ 錯誤（原始 SQL）：
   ```typescript
   const trades = await db.query(
     `SELECT * FROM trades WHERE user_id = '${userAddress}'`
   );
   ```

2. Rate Limiting
   ✅ 正確：
   ```typescript
   import rateLimit from 'express-rate-limit';

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100,
   });

   app.use('/api/', limiter);
   ```
```

---

## 常見錯誤與修正

### AGI 常見錯誤模式

```markdown
❌ 錯誤 1：忘記處理 async/await 錯誤

錯誤代碼：
```typescript
async function placeOrder() {
  const result = await executeTransaction(tx);
  return result;
}
```

✅ 修正 Prompt：
「請為所有 async 函數添加 try-catch 錯誤處理，並提供有意義的錯誤消息」

修正代碼：
```typescript
async function placeOrder() {
  try {
    const result = await executeTransaction(tx);
    return result;
  } catch (error) {
    console.error('Order placement failed:', error);
    throw new Error(`Failed to place order: ${error.message}`);
  }
}
```

---

❌ 錯誤 2：硬編碼常數

錯誤代碼：
```typescript
const PACKAGE_ID = '0xabcd1234...';
tx.moveCall({
  target: `${PACKAGE_ID}::copy_trade::create_relation`,
});
```

✅ 修正 Prompt：
「請移除所有硬編碼的地址和 ID，改為從環境變數讀取」

修正代碼：
```typescript
const PACKAGE_ID = import.meta.env.VITE_MARGIN_MASTER_PACKAGE_ID;
if (!PACKAGE_ID) {
  throw new Error('VITE_MARGIN_MASTER_PACKAGE_ID not configured');
}
```

---

❌ 錯誤 3：使用 any 類型

錯誤代碼：
```typescript
function processTradeData(data: any) {
  return data.quantity * data.price;
}
```

✅ 修正 Prompt：
「請移除所有 any 類型，改用具體的 TypeScript 接口定義」

修正代碼：
```typescript
interface TradeData {
  quantity: number;
  price: number;
  side: 'BUY' | 'SELL';
}

function processTradeData(data: TradeData): number {
  return data.quantity * data.price;
}
```

---

❌ 錯誤 4：缺少邊界檢查

錯誤代碼：
```typescript
function calculateFee(amount: number, rate: number) {
  return amount * rate / 10000;
}
```

✅ 修正 Prompt：
「請為所有用戶輸入添加邊界檢查與錯誤提示」

修正代碼：
```typescript
function calculateFee(amount: number, rate: number): number {
  if (amount < 0) {
    throw new Error('Amount must be positive');
  }
  if (rate < 0 || rate > 10000) {
    throw new Error('Rate must be between 0 and 10000 basis points');
  }
  return amount * rate / 10000;
}
```

---

❌ 錯誤 5：前端檢查但合約未檢查

錯誤情況：
```typescript
// 前端有檢查
if (riskRatio < 1.2) {
  alert('Risk too high!');
  return;
}
```

但智能合約沒有相應檢查，攻擊者可以直接調用合約繞過。

✅ 修正 Prompt：
「請在智能合約層重複驗證所有關鍵約束，不要只依賴前端檢查」

修正代碼：
```move
public entry fun execute_copy_trade(
    risk_ratio_bps: u64,
    ctx: &mut TxContext
) {
    assert!(risk_ratio_bps >= MIN_RISK_RATIO_BPS, E_RISK_TOO_HIGH);
    // ...
}
```
```

---

## 最佳實踐

### 代碼審查清單

```markdown
提交代碼前檢查：

□ TypeScript 類型完整（無 any）
□ 所有 async 函數包含錯誤處理
□ 外部輸入已驗證
□ 金額計算使用 BigNumber/Decimal
□ 智能合約包含權限檢查
□ 關鍵邏輯有單元測試
□ 公開函數有 JSDoc 註釋
□ 環境變數正確配置（無硬編碼）
□ Git commit 前自測通過
```

### 增量開發時間表

```markdown
Day 1:
  ✅ Prompt 1: 項目初始化
  ✅ Prompt 2: 錢包連接
  → 審查 + commit

Day 2:
  ✅ Prompt 3: 交易界面
  → 審查 + commit

Day 3:
  ✅ Prompt 4: 跟單智能合約
  ✅ Prompt 7: 合約測試
  → 審查 + 修正

Day 4:
  ✅ Prompt 5: 排行榜系統
  → 審查 + commit

Day 5:
  ✅ Prompt 6: 風險管理
  ✅ Prompt 8: 前端測試
  → 審查 + 修正

Day 6:
  → 整合、Bug 修復、體驗優化

Day 7:
  ✅ Prompt 9: CI/CD
  ✅ Prompt 10: 文檔
  → Demo 準備
```

### 上下文管理技巧

```markdown
每次與 AGI 開新對話時提供：

# Project Context
- Project: MarginMaster
- Goal: [具體目標]
- Tech Stack: React + TS, Sui Move, Node.js, PostgreSQL

# Current State
- Completed: [已完成模組]
- Current Files: [相關文件結構]

# Task
[具體要求]

# Constraints
- TypeScript（無 any）
- 所有金額使用 BigNumber
- 包含錯誤處理和測試
```

### Debugging Prompt 模板

```markdown
# Debugging Request

我在 MarginMaster 項目中遇到以下錯誤：

**錯誤訊息：**
```
[完整錯誤日誌]
```

**相關代碼：**
```typescript
[貼上代碼段]
```

**已嘗試的方案：**
1. [方案 1]
2. [方案 2]

**期望行為：**
[描述期望的運行結果]

請幫我：
1. 解釋錯誤發生的根本原因
2. 提供修正後的完整代碼
3. 解釋修正的邏輯
4. 給出如何避免類似錯誤的建議
```

---

## 🎯 快速參考

### 常用 Prompt 開頭模板

```markdown
1. 「請幫我生成...」        → 用於新功能/模組
2. 「請重構以下代碼...」     → 用於優化既有代碼
3. 「請為以下代碼添加測試...」 → 測試覆蓋
4. 「請審計以下代碼的安全性...」→ 安全檢查
5. 「請解釋以下錯誤...」     → Debug
6. 「請優化以下代碼的性能...」 → 性能優化
7. 「請為以下代碼寫文檔...」  → 補文檔和註釋
```

### Do's & Don'ts

#### ✅ Do's

- 明確告訴 AGI 項目背景與技術棧
- 一次只處理一個清晰的子問題
- 要求同時生成測試與註釋
- 在資金相關邏輯上進行人工審查
- 逐步整合與測試，避免大改

#### ❌ Don'ts

- 不要盲目相信 AGI 的合約邏輯
- 不要允許 any 類型泛濫
- 不要跳過錯誤處理與邊界測試
- 不要在 Prompt 中給模糊要求
- 不要一次性要求太多功能

---

**下一步閱讀**：
- [開發計劃](./MarginMaster_Development_Plan.md) - 7 天實施時間表
- [智能合約設計](./MarginMaster_Smart_Contracts.md) - 完整合約代碼
- [後端架構](./MarginMaster_Backend.md) - 後端實現細節
