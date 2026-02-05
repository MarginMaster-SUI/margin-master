import { useState, useMemo, useEffect, useRef } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAppStore } from '@/store/app-store'

type TimeRange = '1H' | '4H' | '1D' | '1W'

const RANGE_CONFIG: Record<TimeRange, { points: number; intervalMs: number; label: string }> = {
  '1H': { points: 60, intervalMs: 60_000, label: '1 Hour' },
  '4H': { points: 48, intervalMs: 5 * 60_000, label: '4 Hours' },
  '1D': { points: 48, intervalMs: 30 * 60_000, label: '1 Day' },
  '1W': { points: 56, intervalMs: 3 * 60 * 60_000, label: '1 Week' },
}

function generateHistory(currentPrice: number, points: number, volatility: number, change24h: number): number[] {
  const prices: number[] = []
  const trend = change24h / 100
  let price = currentPrice * (1 - trend * 0.7)

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1)
    const drift = trend * progress * currentPrice * 0.7
    const noise = (Math.sin(i * 1.7) * 0.3 + Math.sin(i * 0.5) * 0.5 + (Math.random() - 0.5) * 0.4) * volatility * currentPrice
    price = price + drift / points + noise / points
    prices.push(Math.max(price, currentPrice * 0.8))
  }

  // Ensure last point matches current price
  prices[prices.length - 1] = currentPrice
  return prices
}

function formatTime(date: Date, range: TimeRange): string {
  if (range === '1H' || range === '4H') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (range === '1D') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatPrice(price: number): string {
  if (price >= 10_000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  if (price >= 100) return `$${price.toFixed(2)}`
  return `$${price.toFixed(4)}`
}

interface TooltipPayloadEntry {
  value: number
  payload: { time: string; price: number }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400">{data.payload.time}</p>
      <p className="text-sm font-semibold text-white">{formatPrice(data.value)}</p>
    </div>
  )
}

export function PriceChart() {
  const { selectedPair, marketData } = useAppStore()
  const [range, setRange] = useState<TimeRange>('1D')
  const seedRef = useRef(0)

  const market = marketData[selectedPair]
  const currentPrice = market?.price || 0
  const change24h = market?.change24h || 0

  // Regenerate seed when pair changes to get consistent but different data per pair
  useEffect(() => {
    seedRef.current = selectedPair.charCodeAt(0) + selectedPair.length
  }, [selectedPair])

  const chartData = useMemo(() => {
    if (currentPrice <= 0) return []
    const config = RANGE_CONFIG[range]
    const volatility = currentPrice > 1000 ? 0.015 : 0.03
    const prices = generateHistory(currentPrice, config.points, volatility, change24h)

    const now = Date.now()
    return prices.map((price, i) => ({
      time: formatTime(new Date(now - (config.points - 1 - i) * config.intervalMs), range),
      price: parseFloat(price.toFixed(currentPrice >= 100 ? 2 : 4)),
    }))
  }, [currentPrice, change24h, range, selectedPair])

  const priceRange = useMemo(() => {
    if (!chartData.length) return { min: 0, max: 0 }
    const prices = chartData.map((d) => d.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const padding = (max - min) * 0.1 || max * 0.01
    return { min: min - padding, max: max + padding }
  }, [chartData])

  const isPositive = change24h >= 0
  const chartColor = isPositive ? '#10b981' : '#ef4444'

  const ranges: TimeRange[] = ['1H', '4H', '1D', '1W']

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{selectedPair}</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{formatPrice(currentPrice)}</span>
            <span className={`text-sm font-medium ${isPositive ? 'text-success-500' : 'text-danger-500'}`}>
              {isPositive ? '+' : ''}{change24h.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[240px] -mx-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                domain={[priceRange.min, priceRange.max]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(v: number) => formatPrice(v)}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#priceGradient)"
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Waiting for price data...
          </div>
        )}
      </div>
    </div>
  )
}
