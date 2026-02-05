import { useState } from 'react'
import { useTradingContract } from '@/hooks/useTradingContract'
import { api } from '@/services/api'
import { useToast } from '@/components/Toast'

interface CopyTradeModalProps {
  traderAddress: string
  traderUsername: string
  followerAddress: string
  onClose: () => void
}

export function CopyTradeModal({
  traderAddress,
  traderUsername,
  followerAddress,
  onClose,
}: CopyTradeModalProps) {
  const { enableCopyTrade } = useTradingContract()
  const [copyRatio, setCopyRatio] = useState(50)
  const [maxPositionSize, setMaxPositionSize] = useState('1000')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      // 1. On-chain: enable copy trade relation
      await enableCopyTrade(traderAddress, copyRatio)

      // 2. Off-chain: register in database
      await api.registerCopyTrade({
        traderAddress,
        followerAddress,
        copyRatio,
        maxPositionSize: parseFloat(maxPositionSize) || undefined,
      })

      toast({ title: 'Copy trade enabled successfully!', type: 'success' })
      onClose()
    } catch (error) {
      console.error('Failed to enable copy trade:', error)
      toast({ title: 'Failed to enable copy trade', description: 'Please try again.', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Copy Trader</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl"
          >
            x
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-800 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold">
            {(traderUsername || traderAddress)[0].toUpperCase()}
          </div>
          <div>
            <div className="text-white font-medium">{traderUsername}</div>
            <div className="text-xs text-gray-500">
              {traderAddress.slice(0, 10)}...{traderAddress.slice(-6)}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* Copy Ratio */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Copy Ratio: {copyRatio}%
            </label>
            <input
              type="range"
              value={copyRatio}
              onChange={(e) => setCopyRatio(Number(e.target.value))}
              min="1"
              max="100"
              className="w-full accent-primary-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Copy {copyRatio}% of each trade the leader makes.
            </p>
          </div>

          {/* Max Position Size */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Position Size (USDC)
            </label>
            <input
              type="number"
              value={maxPositionSize}
              onChange={(e) => setMaxPositionSize(e.target.value)}
              placeholder="1000"
              className="input w-full"
              min="1"
              step="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum amount per copied trade.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Enabling...' : 'Start Copying'}
          </button>
        </div>
      </div>
    </div>
  )
}
