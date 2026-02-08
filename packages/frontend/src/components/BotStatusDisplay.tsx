import { useState } from 'react'
import { useTradingBot } from '@/hooks/useTradingBot'
import { useToast } from '@/components/Toast'

interface TradingBotData {
  id: string
  followed_trader: string
  is_active: boolean
  balance: string
  copy_ratio: number
  max_position_size: string
  daily_loss_limit: string
}

interface Props {
  bot: TradingBotData
  onRefresh: () => Promise<void>
}

export function BotStatusDisplay({ bot, onRefresh }: Props) {
  const { depositToBot, activateBot, deactivateBot } = useTradingBot()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')

  const usdcToDisplay = (microUnits: string) => parseInt(microUnits) / 1_000_000

  const handleDeposit = async () => {
    if (!depositAmount) return
    setLoading(true)
    try {
      await depositToBot(bot.id, parseFloat(depositAmount))
      toast({ title: 'Deposit successful!', type: 'success' })
      setDepositAmount('')
      setShowDepositModal(false)
      await onRefresh()
    } catch (e: any) {
      toast({ title: 'Deposit failed', description: e.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async () => {
    setLoading(true)
    try {
      if (bot.is_active) {
        await deactivateBot(bot.id)
        toast({ title: 'Bot paused', type: 'success' })
      } else {
        await activateBot(bot.id)
        toast({ title: 'Bot resumed', type: 'success' })
      }
      await onRefresh()
    } catch (e: any) {
      toast({ title: 'Failed to toggle bot', description: e.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 p-4 bg-gray-800 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Bot Status</h3>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            bot.is_active
              ? 'bg-green-500/20 text-green-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}
        >
          {bot.is_active ? 'Active' : 'Paused'}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-gray-400">Balance</div>
          <div className="text-white font-semibold">${usdcToDisplay(bot.balance).toFixed(2)}</div>
        </div>
        <div>
          <div className="text-gray-400">Daily Loss Limit</div>
          <div className="text-white font-semibold">${usdcToDisplay(bot.daily_loss_limit).toFixed(0)}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowDepositModal(true)}
          disabled={loading}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
        >
          Deposit
        </button>
        <button
          onClick={handleToggleActive}
          disabled={loading}
          className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
        >
          {bot.is_active ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-white mb-4">Deposit to Bot</h3>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount (USDC)"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDepositModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={loading || !depositAmount}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg disabled:opacity-50 transition-colors"
              >
                {loading ? 'Depositing...' : 'Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
