import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useTradingContract } from '@/hooks/useTradingContract'
import { useAppStore } from '@/store/app-store'

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

  const currentPrice = marketData[selectedPair]?.price || 0
  const positionSize = margin && leverage ? parseFloat(margin) * parseFloat(leverage) : 0

  const handleOpenPosition = async () => {
    if (!account || !margin || !leverage) {
      alert('Please fill in all required fields')
      return
    }

    if (currentPrice <= 0) {
      alert('Invalid market price. Please wait for price data.')
      return
    }

    setIsLoading(true)
    try {
      await openPosition({
        tradingPair: selectedPair,
        positionType,
        entryPrice: currentPrice,
        quantity: positionSize / currentPrice,
        leverage: parseInt(leverage),
        margin: parseFloat(margin),
        stopLossPrice: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfitPrice: takeProfit ? parseFloat(takeProfit) : undefined,
      })

      alert('Position opened successfully!')

      // Reset form
      setMargin('')
      setStopLoss('')
      setTakeProfit('')
    } catch (error) {
      console.error('Failed to open position:', error)
      alert('Failed to open position. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

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
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  positionType === 'LONG'
                    ? 'bg-success-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Long
              </button>
              <button
                onClick={() => setPositionType('SHORT')}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  positionType === 'SHORT'
                    ? 'bg-danger-600 text-white'
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
              placeholder="Enter margin amount"
              className="input w-full"
              min="1"
              step="0.01"
            />
          </div>

          {/* Leverage */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Leverage: {leverage}x
            </label>
            <input
              type="range"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              min="1"
              max="100"
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1x</span>
              <span>50x</span>
              <span>100x</span>
            </div>
          </div>

          {/* Stop Loss */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stop Loss (Optional)
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="Enter stop loss price"
              className="input w-full"
              step="0.01"
            />
          </div>

          {/* Take Profit */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Take Profit (Optional)
            </label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="Enter take profit price"
              className="input w-full"
              step="0.01"
            />
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
          </div>

          {/* Submit Button */}
          <button
            onClick={handleOpenPosition}
            disabled={isLoading || !margin || !leverage}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
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
