import { useState, useMemo } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useTradingContract } from '@/hooks/useTradingContract'
import { useAppStore } from '@/store/app-store'
import { useToast } from '@/components/Toast'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-danger-500 mt-1">{message}</p>
}

function LeverageIndicator({ value }: { value: number }) {
  const level = value <= 10 ? 'low' : value <= 50 ? 'medium' : 'high'
  const labels = { low: 'Low Risk', medium: 'Medium', high: 'High Risk' }
  const colors = {
    low: 'text-success-500',
    medium: 'text-yellow-500',
    high: 'text-danger-500',
  }
  const barColors = {
    low: 'bg-success-500',
    medium: 'bg-yellow-500',
    high: 'bg-danger-500',
  }
  const pct = (value / 100) * 100

  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between items-center">
        <div className="flex gap-1.5 text-xs text-gray-500">
          <span>1x</span>
          <span className="mx-auto">50x</span>
          <span>100x</span>
        </div>
        <span className={`text-xs font-medium ${colors[level]}`}>{labels[level]}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${barColors[level]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function TradingPanel() {
  const account = useCurrentAccount()
  const { selectedPair, marketData } = useAppStore()
  const { openPosition } = useTradingContract()

  const [positionType, setPositionType] = useState<'LONG' | 'SHORT'>('LONG')
  const [margin, setMargin] = useState('')
  const [leverage, setLeverage] = useState('10')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  const currentPrice = marketData[selectedPair]?.price || 0
  const leverageNum = parseInt(leverage) || 0
  const marginNum = parseFloat(margin) || 0
  const positionSize = marginNum * leverageNum

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    if (margin && marginNum < 1) e.margin = 'Minimum margin is $1'
    if (margin && marginNum > 100_000) e.margin = 'Maximum margin is $100,000'
    if (stopLoss) {
      const sl = parseFloat(stopLoss)
      if (sl <= 0) {
        e.stopLoss = 'Must be greater than 0'
      } else if (currentPrice > 0) {
        if (positionType === 'LONG' && sl >= currentPrice)
          e.stopLoss = `Must be below entry ($${currentPrice.toLocaleString()})`
        if (positionType === 'SHORT' && sl <= currentPrice)
          e.stopLoss = `Must be above entry ($${currentPrice.toLocaleString()})`
      }
    }
    if (takeProfit) {
      const tp = parseFloat(takeProfit)
      if (tp <= 0) {
        e.takeProfit = 'Must be greater than 0'
      } else if (currentPrice > 0) {
        if (positionType === 'LONG' && tp <= currentPrice)
          e.takeProfit = `Must be above entry ($${currentPrice.toLocaleString()})`
        if (positionType === 'SHORT' && tp >= currentPrice)
          e.takeProfit = `Must be below entry ($${currentPrice.toLocaleString()})`
      }
    }
    return e
  }, [margin, marginNum, stopLoss, takeProfit, currentPrice, positionType])

  const hasErrors = Object.keys(errors).length > 0
  const canSubmit = !!margin && marginNum >= 1 && leverageNum >= 1 && !hasErrors && !isLoading

  const inputClass = (field: string) =>
    `input w-full transition-colors ${touched[field] && errors[field] ? 'border-danger-500 focus:ring-danger-500' : ''}`

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }))

  const handleOpenPosition = async () => {
    if (!account || !canSubmit) {
      toast({ title: 'Please fix the form errors', type: 'warning' })
      return
    }
    if (currentPrice <= 0) {
      toast({ title: 'Invalid market price', description: 'Please wait for price data.', type: 'warning' })
      return
    }

    setIsLoading(true)
    try {
      await openPosition({
        tradingPair: selectedPair,
        positionType,
        entryPrice: currentPrice,
        quantity: positionSize / currentPrice,
        leverage: leverageNum,
        margin: marginNum,
        stopLossPrice: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfitPrice: takeProfit ? parseFloat(takeProfit) : undefined,
      })

      toast({ title: 'Position opened successfully!', type: 'success' })
      setMargin('')
      setStopLoss('')
      setTakeProfit('')
      setTouched({})
    } catch (error) {
      console.error('Failed to open position:', error)
      toast({ title: 'Failed to open position', description: 'Please try again.', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const liquidationPrice = useMemo(() => {
    if (!marginNum || !leverageNum || currentPrice <= 0) return null
    if (positionType === 'LONG') return currentPrice * (1 - 1 / leverageNum)
    return currentPrice * (1 + 1 / leverageNum)
  }, [marginNum, leverageNum, currentPrice, positionType])

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Open Position</h2>

      {!account ? (
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">Connect your wallet to start trading</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Position Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Position Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPositionType('LONG')}
                className={`py-2 px-4 rounded-lg font-medium transition-all ${
                  positionType === 'LONG'
                    ? 'bg-success-600 text-white shadow-lg shadow-success-600/20'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Long
              </button>
              <button
                onClick={() => setPositionType('SHORT')}
                className={`py-2 px-4 rounded-lg font-medium transition-all ${
                  positionType === 'SHORT'
                    ? 'bg-danger-600 text-white shadow-lg shadow-danger-600/20'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Short
              </button>
            </div>
          </div>

          {/* Margin */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Margin (USDC)
            </label>
            <input
              type="number"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              onBlur={() => markTouched('margin')}
              placeholder="Min $1.00"
              className={inputClass('margin')}
              min="1"
              step="0.01"
            />
            {touched.margin && <FieldError message={errors.margin} />}
          </div>

          {/* Leverage */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Leverage: <span className="text-white font-semibold">{leverage}x</span>
            </label>
            <input
              type="range"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              min="1"
              max="100"
              className="w-full accent-primary-500"
            />
            <LeverageIndicator value={leverageNum} />
          </div>

          {/* Stop Loss */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stop Loss <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              onBlur={() => markTouched('stopLoss')}
              placeholder={positionType === 'LONG' ? `Below $${currentPrice.toLocaleString()}` : `Above $${currentPrice.toLocaleString()}`}
              className={inputClass('stopLoss')}
              step="0.01"
            />
            {touched.stopLoss && <FieldError message={errors.stopLoss} />}
          </div>

          {/* Take Profit */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Take Profit <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              onBlur={() => markTouched('takeProfit')}
              placeholder={positionType === 'LONG' ? `Above $${currentPrice.toLocaleString()}` : `Below $${currentPrice.toLocaleString()}`}
              className={inputClass('takeProfit')}
              step="0.01"
            />
            {touched.takeProfit && <FieldError message={errors.takeProfit} />}
          </div>

          {/* Position Summary */}
          <div className="p-4 bg-gray-800 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Entry Price:</span>
              <span className="text-white font-medium">
                ${currentPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Position Size:</span>
              <span className="text-white font-medium">
                ${positionSize.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Quantity:</span>
              <span className="text-white font-medium">
                {currentPrice > 0 ? (positionSize / currentPrice).toFixed(4) : '0.0000'} {selectedPair.split('/')[0]}
              </span>
            </div>
            {liquidationPrice !== null && (
              <div className="flex justify-between text-sm pt-1 border-t border-gray-700">
                <span className="text-gray-400">Est. Liquidation:</span>
                <span className="text-danger-500 font-medium">
                  ${liquidationPrice.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleOpenPosition}
            disabled={!canSubmit}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              positionType === 'LONG'
                ? 'btn-success'
                : 'btn-danger'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? 'Opening Position...' : `Open ${positionType} Position`}
          </button>
        </div>
      )}
    </div>
  )
}
