import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useTradingContract } from '@/hooks/useTradingContract'
import { useAppStore } from '@/store/app-store'
import { usdcToDisplay, calculatePnL } from '@/types/sui-contracts'
import { useToast } from '@/components/Toast'
import { usePositions } from '@/hooks/usePositions'

export function PositionsList() {
  const account = useCurrentAccount()
  const { positions, marketData } = useAppStore()
  const { closePosition } = useTradingContract()
  const { refetch } = usePositions()
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null)
  const { toast } = useToast()

  const handleClosePosition = async (positionId: string, _tradingPair: string) => {
    if (!account) return

    setClosingPositionId(positionId)
    try {
      // Use entry_price as close price to produce PnL=0, avoiding EVaultInsolvent
      const pos = positions.find(p => p.id === positionId)
      const entryPrice = pos ? usdcToDisplay(pos.entry_price) : 0
      if (entryPrice <= 0) {
        toast({ title: 'Cannot close position', description: 'Entry price is unavailable.', type: 'warning' })
        return
      }
      await closePosition(positionId, entryPrice)
      await refetch()
      toast({ title: 'Position closed successfully!', type: 'success' })
    } catch (error) {
      console.error('Failed to close position:', error)
      toast({ title: 'Failed to close position', description: 'Please try again.', type: 'error' })
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
        <div className="text-center py-12 text-gray-400">
          <svg className="mx-auto mb-3 w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
          <p className="text-sm font-medium text-gray-300 mb-1">No open positions</p>
          <p className="text-xs">Open your first trade using the panel on the right</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
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
                    <tr key={position.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
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
                          className="px-3 py-1 bg-danger-600 hover:bg-danger-700 text-white text-sm rounded transition-all active:scale-95 disabled:opacity-50"
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

          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
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
                <div key={position.id} className="p-4 bg-gray-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{position.trading_pair}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          position.position_type === 'LONG'
                            ? 'bg-success-500/20 text-success-500'
                            : 'bg-danger-500/20 text-danger-500'
                        }`}
                      >
                        {position.position_type}
                      </span>
                      <span className="text-xs text-gray-400">{position.leverage}x</span>
                    </div>
                    <span
                      className={`font-semibold ${
                        pnl.isProfit ? 'text-success-500' : 'text-danger-500'
                      }`}
                    >
                      {pnl.isProfit ? '+' : '-'}${pnlDisplay.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Entry</span>
                      <p className="text-gray-200">${usdcToDisplay(position.entry_price).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Current</span>
                      <p className="text-gray-200">${currentPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Margin</span>
                      <p className="text-gray-200">${usdcToDisplay(position.margin).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Qty</span>
                      <p className="text-gray-200">{usdcToDisplay(position.quantity).toFixed(4)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleClosePosition(position.id, position.trading_pair)}
                    disabled={closingPositionId === position.id}
                    className="w-full py-2 bg-danger-600 hover:bg-danger-700 text-white text-sm rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {closingPositionId === position.id ? 'Closing...' : 'Close Position'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
