import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useTradingContract } from '@/hooks/useTradingContract'
import { useAppStore } from '@/store/app-store'
import { usdcToDisplay, calculatePnL } from '@/types/sui-contracts'

export function PositionsList() {
  const account = useCurrentAccount()
  const { positions, marketData } = useAppStore()
  const { closePosition } = useTradingContract()
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null)

  const handleClosePosition = async (positionId: string, tradingPair: string) => {
    if (!account) return

    setClosingPositionId(positionId)
    try {
      const currentPrice = marketData[tradingPair]?.price || 0
      if (currentPrice <= 0) {
        alert('Cannot close position: current price is unavailable.')
        return
      }
      await closePosition(positionId, currentPrice)
      alert('Position closed successfully!')
    } catch (error) {
      console.error('Failed to close position:', error)
      alert('Failed to close position. Please try again.')
    } finally {
      setClosingPositionId(null)
    }
  }

  if (!account) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Your Positions</h2>
        <div className="text-center py-8 text-gray-400">
          Connect your wallet to view positions
        </div>
      </div>
    )
  }

  const openPositions = (positions || []).filter((p) => p.status === 'OPEN')

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your Positions</h2>
        <span className="text-sm text-gray-400">
          {openPositions.length} Open Position{openPositions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {openPositions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No open positions. Start trading to see your positions here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="pb-3 text-sm font-medium text-gray-400">Pair</th>
                <th className="pb-3 text-sm font-medium text-gray-400">Type</th>
                <th className="pb-3 text-sm font-medium text-gray-400">Entry Price</th>
                <th className="pb-3 text-sm font-medium text-gray-400">Current Price</th>
                <th className="pb-3 text-sm font-medium text-gray-400">Quantity</th>
                <th className="pb-3 text-sm font-medium text-gray-400">Leverage</th>
                <th className="pb-3 text-sm font-medium text-gray-400">Margin</th>
                <th className="pb-3 text-sm font-medium text-gray-400">PnL</th>
                <th className="pb-3 text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {openPositions.map((position) => {
                const currentPrice = marketData[position.trading_pair]?.price || 0
                const pnl = calculatePnL(
                  position.position_type,
                  position.entry_price,
                  (currentPrice * 1_000_000).toString(),
                  position.quantity,
                  position.leverage
                )
                const pnlDisplay = usdcToDisplay(pnl.pnl)

                return (
                  <tr key={position.id} className="border-b border-gray-800">
                    <td className="py-4 text-white font-medium">
                      {position.trading_pair}
                    </td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          position.position_type === 'LONG'
                            ? 'bg-success-500/20 text-success-500'
                            : 'bg-danger-500/20 text-danger-500'
                        }`}
                      >
                        {position.position_type}
                      </span>
                    </td>
                    <td className="py-4 text-gray-300">
                      ${usdcToDisplay(position.entry_price).toFixed(2)}
                    </td>
                    <td className="py-4 text-gray-300">
                      ${currentPrice.toFixed(2)}
                    </td>
                    <td className="py-4 text-gray-300">
                      {usdcToDisplay(position.quantity).toFixed(4)}
                    </td>
                    <td className="py-4 text-gray-300">{position.leverage}x</td>
                    <td className="py-4 text-gray-300">
                      ${usdcToDisplay(position.margin).toFixed(2)}
                    </td>
                    <td className="py-4">
                      <span
                        className={`font-semibold ${
                          pnl.isProfit ? 'text-success-500' : 'text-danger-500'
                        }`}
                      >
                        {pnl.isProfit ? '+' : '-'}${pnlDisplay.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => handleClosePosition(position.id, position.trading_pair)}
                        disabled={closingPositionId === position.id}
                        className="px-3 py-1 bg-danger-600 hover:bg-danger-700 text-white text-sm rounded transition-colors disabled:opacity-50"
                      >
                        {closingPositionId === position.id ? 'Closing...' : 'Close'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
