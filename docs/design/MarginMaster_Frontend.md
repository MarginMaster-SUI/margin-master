# MarginMaster - 前端架構設計

> **版本:** 2.0
> **日期:** 2026-02-02
> **狀態:** Ready for Implementation

---

## 📋 目錄

1. [前端概覽](#前端概覽)
2. [組件架構](#組件架構)
3. [核心組件實現](#核心組件實現)
4. [自定義 Hooks](#自定義-hooks)
5. [狀態管理](#狀態管理)
6. [路由設計](#路由設計)
7. [UI/UX 設計](#uiux-設計)
8. [性能優化](#性能優化)

---

## 前端概覽

### 技術棧

```
核心框架: React 18.2+ with TypeScript 5.3+
構建工具: Vite 5.0+
狀態管理: Zustand 4.4+ (全局) + React Query 5.0+ (服務端)
錢包集成: @mysten/dapp-kit 0.14+
UI 組件: Headless UI + Tailwind CSS 3.4+
圖表庫: Recharts 2.10+ / Lightweight Charts 4.1+
表單處理: React Hook Form 7.48+ + Zod 3.22+
```

### 項目結構

```
frontend/
├── src/
│   ├── components/          # UI 組件
│   │   ├── trading/         # 交易相關組件
│   │   │   ├── TradingPanel/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── OrderForm.tsx
│   │   │   │   ├── RiskMetrics.tsx
│   │   │   │   └── PositionList.tsx
│   │   │   ├── MarketDepth/
│   │   │   ├── PriceChart/
│   │   │   └── OrderBook/
│   │   │
│   │   ├── copyTrade/       # 跟單相關組件
│   │   │   ├── LeaderCard/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── Stats.tsx
│   │   │   │   └── Actions.tsx
│   │   │   ├── CopyModal/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── ParamsForm.tsx
│   │   │   │   └── FeeEstimate.tsx
│   │   │   ├── FollowerList/
│   │   │   └── RelationManager/
│   │   │
│   │   ├── leaderboard/     # 排行榜組件
│   │   │   ├── LeaderboardTable/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── Row.tsx
│   │   │   │   └── Filters.tsx
│   │   │   ├── TraderProfile/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── StatsCards.tsx
│   │   │   │   └── PerformanceChart.tsx
│   │   │   └── SearchBar/
│   │   │
│   │   ├── risk/            # 風險監控組件
│   │   │   ├── RiskDashboard/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── HealthScore.tsx
│   │   │   │   ├── Metrics.tsx
│   │   │   │   └── AlertList.tsx
│   │   │   ├── RiskGauge/
│   │   │   └── LiquidationPriceIndicator/
│   │   │
│   │   ├── common/          # 共用組件
│   │   │   ├── Layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Footer.tsx
│   │   │   ├── Modal/
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Select/
│   │   │   ├── Table/
│   │   │   ├── Card/
│   │   │   ├── Badge/
│   │   │   ├── Tooltip/
│   │   │   └── Loading/
│   │   │
│   │   └── wallet/          # 錢包組件
│   │       ├── ConnectButton.tsx
│   │       ├── WalletInfo.tsx
│   │       └── NetworkSwitch.tsx
│   │
│   ├── hooks/               # 自定義 Hooks
│   │   ├── useWallet.ts
│   │   ├── useTradingPanel.ts
│   │   ├── useLeaderboard.ts
│   │   ├── useRiskMonitor.ts
│   │   ├── useCopyTrade.ts
│   │   ├── useTraderProfile.ts
│   │   ├── useWebSocket.ts
│   │   └── useNotifications.ts
│   │
│   ├── services/            # API 服務
│   │   ├── api.ts
│   │   ├── suiClient.ts
│   │   ├── riskEngine.ts
│   │   └── priceService.ts
│   │
│   ├── store/               # 全局狀態
│   │   ├── index.ts
│   │   ├── slices/
│   │   │   ├── userSlice.ts
│   │   │   ├── uiSlice.ts
│   │   │   ├── tradingSlice.ts
│   │   │   └── notificationSlice.ts
│   │   └── types.ts
│   │
│   ├── types/               # TypeScript 類型
│   │   ├── api.ts
│   │   ├── sui.ts
│   │   ├── trading.ts
│   │   └── leaderboard.ts
│   │
│   ├── utils/               # 工具函數
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── calculations.ts
│   │   └── constants.ts
│   │
│   ├── pages/               # 頁面組件
│   │   ├── Dashboard/
│   │   ├── Leaderboard/
│   │   ├── Profile/
│   │   ├── CopyTrade/
│   │   └── Settings/
│   │
│   ├── styles/              # 樣式文件
│   │   ├── globals.css
│   │   ├── variables.css
│   │   └── animations.css
│   │
│   ├── App.tsx              # 根組件
│   ├── main.tsx             # 入口文件
│   └── vite-env.d.ts
│
├── public/
│   ├── assets/
│   └── favicon.ico
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── .env.example
```

---

## 組件架構

### 組件層次圖

```
App
├── Layout
│   ├── Header
│   │   ├── Logo
│   │   ├── Navigation
│   │   └── ConnectButton
│   ├── Sidebar
│   │   ├── NavLinks
│   │   └── UserInfo
│   └── Main
│       └── Router
│           ├── Dashboard
│           │   ├── TradingPanel
│           │   ├── RiskDashboard
│           │   └── PositionList
│           ├── Leaderboard
│           │   ├── LeaderboardTable
│           │   └── SearchBar
│           ├── Profile
│           │   ├── TraderProfile
│           │   ├── PerformanceChart
│           │   └── FollowerList
│           └── CopyTrade
│               ├── MyLeaders
│               ├── MyFollowers
│               └── CopyModal
```

### 組件設計原則

#### 1. 單一職責原則

每個組件只負責一個明確的功能：

```typescript
// ✅ 好的設計：單一職責
function OrderForm() {
  // 只處理訂單表單邏輯
}

function RiskMetrics() {
  // 只顯示風險指標
}

// ❌ 壞的設計：職責混雜
function TradingPanelEverything() {
  // 處理訂單、風險、持倉、圖表...太多責任
}
```

#### 2. 組合優於繼承

```typescript
// ✅ 使用組合
function TradingPanel() {
  return (
    <div>
      <OrderForm />
      <RiskMetrics />
      <PositionList />
    </div>
  );
}

// ❌ 避免複雜的繼承鏈
class BaseTradingPanel extends Component {}
class ExtendedTradingPanel extends BaseTradingPanel {}
```

#### 3. Presentational vs Container

```typescript
// Presentational 組件：只負責 UI 渲染
function LeaderCard({ trader, onCopy }) {
  return (
    <div className="leader-card">
      <h3>{trader.name}</h3>
      <button onClick={() => onCopy(trader)}>跟單</button>
    </div>
  );
}

// Container 組件：處理數據和邏輯
function LeaderCardContainer({ traderId }) {
  const { data: trader } = useTraderProfile(traderId);
  const handleCopy = useCopyTrade();

  return <LeaderCard trader={trader} onCopy={handleCopy} />;
}
```

---

## 核心組件實現

### 1. TradingPanel (交易面板)

```typescript
// src/components/trading/TradingPanel/index.tsx

import { useState } from 'react';
import { Card } from '@/components/common/Card';
import { OrderForm } from './OrderForm';
import { RiskMetrics } from './RiskMetrics';
import { PositionList } from './PositionList';
import { PriceChart } from '../PriceChart';
import { useTradingPanel } from '@/hooks/useTradingPanel';

export function TradingPanel() {
  const [selectedTab, setSelectedTab] = useState<'order' | 'positions'>('order');
  const { currentPrice, priceHistory, loading } = useTradingPanel();

  return (
    <div className="trading-panel grid grid-cols-12 gap-4">
      {/* 價格圖表 - 佔 8 列 */}
      <Card className="col-span-8">
        <PriceChart
          data={priceHistory}
          currentPrice={currentPrice}
          loading={loading}
        />
      </Card>

      {/* 訂單表單與風險指標 - 佔 4 列 */}
      <div className="col-span-4 space-y-4">
        <Card>
          <RiskMetrics />
        </Card>

        <Card>
          <div className="tabs">
            <button
              onClick={() => setSelectedTab('order')}
              className={selectedTab === 'order' ? 'active' : ''}
            >
              下單
            </button>
            <button
              onClick={() => setSelectedTab('positions')}
              className={selectedTab === 'positions' ? 'active' : ''}
            >
              持倉
            </button>
          </div>

          {selectedTab === 'order' ? (
            <OrderForm />
          ) : (
            <PositionList />
          )}
        </Card>
      </div>
    </div>
  );
}
```

#### OrderForm 組件

```typescript
// src/components/trading/TradingPanel/OrderForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { toast } from 'react-hot-toast';

const orderSchema = z.object({
  orderType: z.enum(['MARKET', 'LIMIT']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive('數量必須大於 0'),
  price: z.number().positive().optional(),
  leverage: z.number().min(1, '槓桿最小為 1').max(10, '槓桿最大為 10'),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

export function OrderForm() {
  const { address, executeTransaction } = useWallet();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      orderType: 'MARKET',
      side: 'BUY',
      leverage: 1,
    },
  });

  const orderType = watch('orderType');
  const side = watch('side');
  const quantity = watch('quantity');
  const leverage = watch('leverage');

  const onSubmit = async (data: OrderFormData) => {
    if (!address) {
      toast.error('請先連接錢包');
      return;
    }

    try {
      const tx = new TransactionBlock();

      // 構建交易
      if (data.orderType === 'MARKET') {
        tx.moveCall({
          target: `${import.meta.env.VITE_DEEPBOOK_PACKAGE_ID}::pool_proxy::place_market_order`,
          arguments: [
            tx.object(import.meta.env.VITE_MARGIN_MANAGER_ID),
            tx.object(import.meta.env.VITE_POOL_ID),
            tx.pure(data.quantity),
            tx.pure(data.side === 'BUY'),
          ],
        });
      } else {
        if (!data.price) {
          toast.error('限價單需要指定價格');
          return;
        }

        tx.moveCall({
          target: `${import.meta.env.VITE_DEEPBOOK_PACKAGE_ID}::pool_proxy::place_limit_order`,
          arguments: [
            tx.object(import.meta.env.VITE_MARGIN_MANAGER_ID),
            tx.object(import.meta.env.VITE_POOL_ID),
            tx.pure(data.price),
            tx.pure(data.quantity),
            tx.pure(data.side === 'BUY'),
          ],
        });
      }

      // 發出跟單信號
      tx.moveCall({
        target: `${import.meta.env.VITE_MARGIN_MASTER_PACKAGE_ID}::copy_trade::emit_leader_trade_signal`,
        arguments: [
          tx.object(import.meta.env.VITE_TRADER_PROFILE_ID),
          tx.pure(import.meta.env.VITE_POOL_ID),
          tx.pure(data.side === 'BUY'),
          tx.pure(data.orderType === 'MARKET' ? 0 : 1),
          tx.pure(data.price ? [data.price] : [], 'vector<u64>'),
          tx.pure(data.quantity),
          tx.pure(data.leverage),
          tx.pure([]), // tx_digest 稍後填入
        ],
      });

      const result = await executeTransaction(tx);

      toast.success(`訂單已提交！交易哈希: ${result.digest.slice(0, 8)}...`);
    } catch (error: any) {
      toast.error(`交易失敗: ${error.message}`);
      console.error('Order submission failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* 訂單類型 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setValue('orderType', 'MARKET')}
          className={`flex-1 py-2 rounded ${
            orderType === 'MARKET' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          市價單
        </button>
        <button
          type="button"
          onClick={() => setValue('orderType', 'LIMIT')}
          className={`flex-1 py-2 rounded ${
            orderType === 'LIMIT' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          限價單
        </button>
      </div>

      {/* 買賣方向 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setValue('side', 'BUY')}
          className={`flex-1 py-2 rounded ${
            side === 'BUY' ? 'bg-green-500 text-white' : 'bg-gray-200'
          }`}
        >
          做多
        </button>
        <button
          type="button"
          onClick={() => setValue('side', 'SELL')}
          className={`flex-1 py-2 rounded ${
            side === 'SELL' ? 'bg-red-500 text-white' : 'bg-gray-200'
          }`}
        >
          做空
        </button>
      </div>

      {/* 價格（限價單） */}
      {orderType === 'LIMIT' && (
        <Input
          label="價格"
          type="number"
          step="0.01"
          placeholder="輸入價格"
          {...register('price', { valueAsNumber: true })}
          error={errors.price?.message}
        />
      )}

      {/* 數量 */}
      <Input
        label="數量"
        type="number"
        step="0.01"
        placeholder="輸入數量"
        {...register('quantity', { valueAsNumber: true })}
        error={errors.quantity?.message}
      />

      {/* 槓桿 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          槓桿: {leverage}x
        </label>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          {...register('leverage', { valueAsNumber: true })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1x</span>
          <span>5x</span>
          <span>10x</span>
        </div>
      </div>

      {/* 止損（可選） */}
      <Input
        label="止損價格（可選）"
        type="number"
        step="0.01"
        placeholder="輸入止損價格"
        {...register('stopLoss', { valueAsNumber: true })}
        error={errors.stopLoss?.message}
      />

      {/* 止盈（可選） */}
      <Input
        label="止盈價格（可選）"
        type="number"
        step="0.01"
        placeholder="輸入止盈價格"
        {...register('takeProfit', { valueAsNumber: true })}
        error={errors.takeProfit?.message}
      />

      {/* 提交按鈕 */}
      <Button
        type="submit"
        variant={side === 'BUY' ? 'success' : 'danger'}
        className="w-full"
        loading={isSubmitting}
        disabled={!address}
      >
        {!address
          ? '請連接錢包'
          : side === 'BUY'
          ? '做多開倉'
          : '做空開倉'}
      </Button>
    </form>
  );
}
```

#### RiskMetrics 組件

```typescript
// src/components/trading/TradingPanel/RiskMetrics.tsx

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/common/Card';
import { useRiskMonitor } from '@/hooks/useRiskMonitor';

export function RiskMetrics() {
  const { data: metrics, isLoading } = useRiskMonitor();

  if (isLoading) {
    return <div className="animate-pulse">加載中...</div>;
  }

  if (!metrics) {
    return <div className="text-gray-500">無風險數據</div>;
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthScoreLabel = (score: number) => {
    if (score >= 80) return '健康';
    if (score >= 50) return '警告';
    return '危險';
  };

  return (
    <div className="risk-metrics space-y-3">
      <h3 className="text-lg font-semibold">風險監控</h3>

      {/* 健康度評分 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">健康度</span>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${getHealthScoreColor(metrics.healthScore)}`}>
            {metrics.healthScore}
          </span>
          <span className={`text-xs ${getHealthScoreColor(metrics.healthScore)}`}>
            {getHealthScoreLabel(metrics.healthScore)}
          </span>
        </div>
      </div>

      {/* 風險比率 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">風險比率</span>
        <span className="text-lg font-medium">
          {metrics.currentRiskRatio.toFixed(2)}x
        </span>
      </div>

      {/* 清算價格 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">清算價格</span>
        <span className="text-lg font-medium text-red-500">
          ${metrics.liquidationPrice.toFixed(2)}
        </span>
      </div>

      {/* 可用保證金 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">可用保證金</span>
        <span className="text-lg font-medium">
          ${metrics.marginAvailable.toFixed(2)}
        </span>
      </div>

      {/* 已用保證金 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">已用保證金</span>
        <span className="text-lg font-medium">
          ${metrics.marginUsed.toFixed(2)}
        </span>
      </div>

      {/* 警報 */}
      {metrics.healthScore < 30 && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
          ⚠️ 您的倉位接近清算！請立即減倉或增加保證金。
        </div>
      )}

      {metrics.healthScore >= 30 && metrics.healthScore < 50 && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded text-sm">
          ⚡ 保證金使用率較高，請注意風險。
        </div>
      )}
    </div>
  );
}
```

---

### 2. LeaderboardTable (排行榜表格)

```typescript
// src/components/leaderboard/LeaderboardTable/index.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Table } from '@/components/common/Table';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { CopyModal } from '@/components/copyTrade/CopyModal';

type SortBy = 'totalPnl' | 'winRate' | 'totalFollowers' | 'sharpeRatio';

export function LeaderboardTable() {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortBy>('totalPnl');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedLeader, setSelectedLeader] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', sortBy, order],
    queryFn: () => api.getLeaderboard({ sortBy, order, limit: 50 }),
    refetchInterval: 60_000, // 每分鐘刷新
  });

  const handleSort = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setOrder('desc');
    }
  };

  const getTierBadge = (tier: number) => {
    const tiers = [
      { name: '', color: 'gray' },
      { name: '銅牌', color: 'orange' },
      { name: '銀牌', color: 'gray' },
      { name: '金牌', color: 'yellow' },
      { name: '白金', color: 'blue' },
    ];
    const tierInfo = tiers[tier] || tiers[0];
    return <Badge color={tierInfo.color}>{tierInfo.name}</Badge>;
  };

  if (isLoading) {
    return <div className="text-center py-10">加載中...</div>;
  }

  return (
    <div className="leaderboard-table">
      {/* 排序控制 */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={sortBy === 'totalPnl' ? 'primary' : 'outline'}
          onClick={() => handleSort('totalPnl')}
        >
          按盈虧排序
        </Button>
        <Button
          variant={sortBy === 'winRate' ? 'primary' : 'outline'}
          onClick={() => handleSort('winRate')}
        >
          按勝率排序
        </Button>
        <Button
          variant={sortBy === 'totalFollowers' ? 'primary' : 'outline'}
          onClick={() => handleSort('totalFollowers')}
        >
          按跟隨者排序
        </Button>
        <Button
          variant={sortBy === 'sharpeRatio' ? 'primary' : 'outline'}
          onClick={() => handleSort('sharpeRatio')}
        >
          按夏普比率排序
        </Button>
      </div>

      {/* 表格 */}
      <Table>
        <thead>
          <tr>
            <th className="w-16">排名</th>
            <th>交易者</th>
            <th className="text-right">30天盈虧</th>
            <th className="text-right">勝率</th>
            <th className="text-right">總交易</th>
            <th className="text-right">跟隨者</th>
            <th className="text-right">夏普比率</th>
            <th className="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((leader) => (
            <tr key={leader.address} className="hover:bg-gray-50">
              {/* 排名 */}
              <td className="font-bold text-gray-600">#{leader.rank}</td>

              {/* 交易者信息 */}
              <td>
                <div className="flex items-center gap-2">
                  {leader.isVerified && (
                    <span className="text-blue-500">✓</span>
                  )}
                  <span className="font-medium">
                    {leader.username || `${leader.address.slice(0, 6)}...`}
                  </span>
                  {leader.tier > 0 && getTierBadge(leader.tier)}
                </div>
              </td>

              {/* 30天盈虧 */}
              <td className="text-right">
                <span className={leader.totalPnl > 0 ? 'text-green-500' : 'text-red-500'}>
                  ${leader.totalPnl.toFixed(2)}
                </span>
              </td>

              {/* 勝率 */}
              <td className="text-right">{leader.winRate.toFixed(1)}%</td>

              {/* 總交易 */}
              <td className="text-right">{leader.totalTrades}</td>

              {/* 跟隨者 */}
              <td className="text-right">{leader.totalFollowers}</td>

              {/* 夏普比率 */}
              <td className="text-right">{leader.sharpeRatio?.toFixed(2) || 'N/A'}</td>

              {/* 操作 */}
              <td className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setSelectedLeader(leader)}
                  >
                    跟單
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/profile/${leader.address}`)}
                  >
                    查看
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* 跟單彈窗 */}
      {selectedLeader && (
        <CopyModal
          leader={selectedLeader}
          onClose={() => setSelectedLeader(null)}
        />
      )}
    </div>
  );
}
```

---

### 3. CopyModal (跟單設置彈窗)

```typescript
// src/components/copyTrade/CopyModal/index.tsx

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useWallet } from '@/hooks/useWallet';
import { toast } from 'react-hot-toast';

const copySchema = z.object({
  copyRatio: z.number().min(1, '跟單比例最小為 1%').max(100, '跟單比例最大為 100%'),
  maxPositionSize: z.number().positive('最大倉位必須大於 0'),
  feeRate: z.number().min(0, '費率不能為負').max(10, '費率最大為 10%'),
});

type CopyFormData = z.infer<typeof copySchema>;

interface CopyModalProps {
  leader: any;
  onClose: () => void;
}

export function CopyModal({ leader, onClose }: CopyModalProps) {
  const { address, executeTransaction } = useWallet();
  const [estimatedFee, setEstimatedFee] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CopyFormData>({
    resolver: zodResolver(copySchema),
    defaultValues: {
      copyRatio: 50,
      maxPositionSize: 1000,
      feeRate: leader.suggestedFeeRate || 5,
    },
  });

  const copyRatio = watch('copyRatio');
  const maxPositionSize = watch('maxPositionSize');
  const feeRate = watch('feeRate');

  // 估算月費用
  const estimateMonthlyFee = () => {
    // 假設每月 20 筆交易，每筆 500 USDC
    const avgTradesPerMonth = 20;
    const avgPositionValue = 500;
    const totalVolume = avgTradesPerMonth * avgPositionValue * (copyRatio / 100);
    return (totalVolume * feeRate) / 100;
  };

  const onSubmit = async (data: CopyFormData) => {
    if (!address) {
      toast.error('請先連接錢包');
      return;
    }

    try {
      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${import.meta.env.VITE_MARGIN_MASTER_PACKAGE_ID}::copy_trade::create_copy_relation`,
        arguments: [
          tx.object(import.meta.env.VITE_REGISTRY_ID),
          tx.object(import.meta.env.VITE_PAUSE_ID),
          tx.pure(leader.address),
          tx.pure(data.copyRatio * 100), // 轉為 basis points
          tx.pure(data.maxPositionSize),
          tx.pure(data.feeRate * 100), // 轉為 basis points
        ],
      });

      const result = await executeTransaction(tx);

      toast.success(`跟單關係已創建！交易哈希: ${result.digest.slice(0, 8)}...`);
      onClose();
    } catch (error: any) {
      toast.error(`創建失敗: ${error.message}`);
      console.error('Copy relation creation failed:', error);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="跟單設置"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Leader 信息 */}
        <div className="bg-gray-100 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">
              {leader.username || `${leader.address.slice(0, 8)}...`}
            </span>
            {leader.isVerified && (
              <span className="text-blue-500">✓ 驗證交易者</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-gray-600">30天盈虧</div>
              <div className={leader.totalPnl > 0 ? 'text-green-500' : 'text-red-500'}>
                ${leader.totalPnl.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-gray-600">勝率</div>
              <div>{leader.winRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-gray-600">跟隨者</div>
              <div>{leader.totalFollowers}</div>
            </div>
          </div>
        </div>

        {/* 跟單比例 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            跟單比例: {copyRatio}%
          </label>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            {...register('copyRatio', { valueAsNumber: true })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            如果 Leader 開 1000 USDC 倉位，您將開 {(1000 * copyRatio / 100).toFixed(0)} USDC 倉位
          </p>
        </div>

        {/* 最大單筆倉位 */}
        <Input
          label="最大單筆倉位 (USDC)"
          type="number"
          step="100"
          placeholder="輸入最大倉位"
          {...register('maxPositionSize', { valueAsNumber: true })}
          error={errors.maxPositionSize?.message}
          helperText="超過此限制的跟單將被限制在此金額"
        />

        {/* 費率 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            費率: {feeRate}%
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            {...register('feeRate', { valueAsNumber: true })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>5%</span>
            <span>10%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            預估月費用: ${estimateMonthlyFee().toFixed(2)}
          </p>
        </div>

        {/* 費用說明 */}
        <div className="bg-blue-50 p-3 rounded text-sm">
          <div className="font-medium mb-1">費用說明</div>
          <div className="text-gray-600 space-y-1">
            <div>• 跟單費用按倉位價值的 {feeRate}% 計算</div>
            <div>• 費用將在每次跟單執行時收取</div>
            <div>• 其中 {((feeRate * 0.05) / 100 * 100).toFixed(1)}% 歸 Protocol，{((feeRate * 0.95) / 100 * 100).toFixed(1)}% 歸 Leader</div>
          </div>
        </div>

        {/* 提交按鈕 */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            loading={isSubmitting}
            disabled={!address}
          >
            {!address ? '請連接錢包' : '確認跟單'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

---

## 自定義 Hooks

### 1. useWallet

```typescript
// src/hooks/useWallet.ts

import { useCurrentAccount, useSignAndExecuteTransactionBlock } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { toast } from 'react-hot-toast';

export function useWallet() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransactionBlock();

  const executeTransaction = async (tx: TransactionBlock) => {
    if (!account) {
      throw new Error('錢包未連接');
    }

    try {
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
    } catch (error: any) {
      console.error('Transaction execution failed:', error);
      throw error;
    }
  };

  return {
    address: account?.address,
    isConnected: !!account,
    executeTransaction,
  };
}
```

### 2. useRiskMonitor

```typescript
// src/hooks/useRiskMonitor.ts

import { useQuery } from '@tanstack/react-query';
import { useWallet } from './useWallet';
import { riskEngine } from '@/services/riskEngine';

export function useRiskMonitor() {
  const { address } = useWallet();

  return useQuery({
    queryKey: ['risk-metrics', address],
    queryFn: async () => {
      if (!address) return null;

      // TODO: 獲取用戶的 Margin Manager ID
      const marginManagerId = 'TODO';

      return await riskEngine.calculateRiskMetrics(marginManagerId);
    },
    enabled: !!address,
    refetchInterval: 30_000, // 每 30 秒更新
  });
}
```

### 3. useLeaderboard

```typescript
// src/hooks/useLeaderboard.ts

import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface LeaderboardParams {
  sortBy?: 'totalPnl' | 'winRate' | 'totalFollowers' | 'sharpeRatio';
  order?: 'asc' | 'desc';
  period?: 'all' | '30d' | '7d';
  page?: number;
  limit?: number;
}

export function useLeaderboard(params?: LeaderboardParams) {
  return useQuery({
    queryKey: ['leaderboard', params],
    queryFn: () => api.getLeaderboard(params),
    staleTime: 30_000, // 30 秒內認為數據新鮮
    refetchInterval: 60_000, // 每分鐘刷新
  });
}
```

### 4. useWebSocket

```typescript
// src/hooks/useWebSocket.ts

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWallet } from './useWallet';

export function useWebSocket() {
  const { address } = useWallet();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!address) return;

    const newSocket = io(import.meta.env.VITE_BACKEND_URL, {
      auth: {
        address,
        // TODO: 添加簽名驗證
      },
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [address]);

  const subscribe = <T,>(event: string, callback: (data: T) => void) => {
    if (!socket) return;
    socket.on(event, callback);
  };

  const unsubscribe = (event: string) => {
    if (!socket) return;
    socket.off(event);
  };

  return {
    socket,
    isConnected,
    subscribe,
    unsubscribe,
  };
}
```

---

## 狀態管理

### Zustand Store 架構

```typescript
// src/store/index.ts

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { userSlice, UserSlice } from './slices/userSlice';
import { uiSlice, UISlice } from './slices/uiSlice';
import { tradingSlice, TradingSlice } from './slices/tradingSlice';
import { notificationSlice, NotificationSlice } from './slices/notificationSlice';

export type AppState = UserSlice & UISlice & TradingSlice & NotificationSlice;

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (...a) => ({
        ...userSlice(...a),
        ...uiSlice(...a),
        ...tradingSlice(...a),
        ...notificationSlice(...a),
      }),
      {
        name: 'margin-master-storage',
        partialize: (state) => ({
          // 只持久化部分狀態
          user: state.user,
          isDemoMode: state.isDemoMode,
          theme: state.theme,
        }),
      }
    )
  )
);
```

### User Slice

```typescript
// src/store/slices/userSlice.ts

import { StateCreator } from 'zustand';

export interface User {
  id: string;
  suiAddress: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  traderProfile: any | null;
}

export interface UserSlice {
  user: User | null;
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  clearUser: () => void;
}

export const userSlice: StateCreator<UserSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
  clearUser: () => set({ user: null }),
});
```

### UI Slice

```typescript
// src/store/slices/uiSlice.ts

import { StateCreator } from 'zustand';

export interface UISlice {
  isDemoMode: boolean;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  toggleDemoMode: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
}

export const uiSlice: StateCreator<UISlice> = (set) => ({
  isDemoMode: false,
  theme: 'light',
  sidebarCollapsed: false,
  toggleDemoMode: () =>
    set((state) => ({ isDemoMode: !state.isDemoMode })),
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
});
```

---

## 路由設計

```typescript
// src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { Dashboard } from './pages/Dashboard';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';
import { CopyTrade } from './pages/CopyTrade';
import { Settings } from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="profile/:address" element={<Profile />} />
          <Route path="copy-trade" element={<CopyTrade />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

---

## UI/UX 設計

### 設計系統

#### 顏色系統

```css
/* src/styles/variables.css */

:root {
  /* 主色調 */
  --color-primary: #3B82F6;
  --color-primary-dark: #2563EB;
  --color-primary-light: #60A5FA;

  /* 成功/做多 */
  --color-success: #10B981;
  --color-success-dark: #059669;
  --color-success-light: #34D399;

  /* 危險/做空 */
  --color-danger: #EF4444;
  --color-danger-dark: #DC2626;
  --color-danger-light: #F87171;

  /* 警告 */
  --color-warning: #F59E0B;
  --color-warning-dark: #D97706;
  --color-warning-light: #FBBF24;

  /* 中性色 */
  --color-gray-50: #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;

  /* 背景 */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9FAFB;
  --bg-tertiary: #F3F4F6;

  /* 文字 */
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-tertiary: #9CA3AF;

  /* 邊框 */
  --border-color: #E5E7EB;
  --border-radius: 8px;

  /* 陰影 */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

#### 字體系統

```css
/* src/styles/globals.css */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-primary);
  background-color: var(--bg-secondary);
}

h1 {
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1.2;
}

h2 {
  font-size: 1.875rem;
  font-weight: 600;
  line-height: 1.3;
}

h3 {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.4;
}

h4 {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
}

.text-mono {
  font-family: 'Roboto Mono', monospace;
}
```

### 響應式設計

```css
/* Tailwind 斷點 */
/* sm: 640px */
/* md: 768px */
/* lg: 1024px */
/* xl: 1280px */
/* 2xl: 1536px */

/* 移動端優先 */
.trading-panel {
  @apply grid grid-cols-1 gap-4;
}

@media (min-width: 1024px) {
  .trading-panel {
    @apply grid-cols-12;
  }
}
```

---

## 性能優化

### 1. 代碼分割

```typescript
// 路由懶加載
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </Suspense>
  );
}
```

### 2. 虛擬化長列表

```typescript
import { FixedSizeList } from 'react-window';

function VirtualizedLeaderboard({ items }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={60}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <LeaderRow trader={items[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

### 3. 圖片優化

```typescript
// 使用 WebP 格式
<img
  src="/assets/trader-avatar.webp"
  alt="Trader"
  loading="lazy"
  width={48}
  height={48}
/>

// 響應式圖片
<img
  srcSet="
    /assets/chart-sm.webp 640w,
    /assets/chart-md.webp 1024w,
    /assets/chart-lg.webp 1536w
  "
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  src="/assets/chart-lg.webp"
  alt="Performance Chart"
/>
```

### 4. React Query 優化

```typescript
// 預加載數據
const queryClient = useQueryClient();

const prefetchLeaderboard = () => {
  queryClient.prefetchQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.getLeaderboard(),
  });
};

// 樂觀更新
const mutation = useMutation({
  mutationFn: api.createCopyRelation,
  onMutate: async (newRelation) => {
    // 取消現有查詢
    await queryClient.cancelQueries({ queryKey: ['copy-relations'] });

    // 快照舊數據
    const previous = queryClient.getQueryData(['copy-relations']);

    // 樂觀更新
    queryClient.setQueryData(['copy-relations'], (old: any) => [...old, newRelation]);

    return { previous };
  },
  onError: (err, newRelation, context) => {
    // 回滾
    queryClient.setQueryData(['copy-relations'], context?.previous);
  },
  onSettled: () => {
    // 重新驗證
    queryClient.invalidateQueries({ queryKey: ['copy-relations'] });
  },
});
```

---

**下一步閱讀**：
- [AGI 開發指南](./MarginMaster_AGI_Guide.md) - 最後一個文檔
- [後端架構](./MarginMaster_Backend.md) - 後端實現細節
