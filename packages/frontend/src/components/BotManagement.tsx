import { useState, useEffect } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useTradingBot } from '@/hooks/useTradingBot'
import { useToast } from '@/components/Toast'
import { usdcToDisplay } from '@/types/sui-contracts'
import { api, CopyRelation } from '@/services/api'

interface TradingBotData {
  id: string
  owner: string
  followed_trader: string
  is_active: boolean
  copy_ratio: number
  max_position_size: string
  min_hold_duration: string
  daily_loss_limit: string
  total_loss_today: string
  last_reset_day: string
  balance: string
}

export function BotManagement() {
  const account = useCurrentAccount()
  const {
    findBots,
    createTradingBot,
    depositToBot,
    withdrawFromBot,
    activateBot,
    deactivateBot,
    destroyBot,
  } = useTradingBot()
  const { toast } = useToast()

  const [bots, setBots] = useState<TradingBotData[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [followedTraders, setFollowedTraders] = useState<CopyRelation[]>([])

  // Form states
  const [selectedBot, setSelectedBot] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  // Create bot form
  const [useCustomAddress, setUseCustomAddress] = useState(false)
  const [selectedTrader, setSelectedTrader] = useState('')
  const [traderAddress, setTraderAddress] = useState('')
  const [copyRatio, setCopyRatio] = useState(50)
  const [maxPositionSize, setMaxPositionSize] = useState('1000')
  const [minHoldDuration, setMinHoldDuration] = useState('3600') // 1 hour
  const [dailyLossLimit, setDailyLossLimit] = useState('100')

  const loadFollowedTraders = async () => {
    if (!account?.address) return
    try {
      const relations = await api.getCopyRelations(account.address)
      setFollowedTraders(Array.isArray(relations) ? relations.filter((r) => r.isActive) : [])
    } catch (e) {
      console.error('Failed to load followed traders:', e)
    }
  }

  const loadBots = async () => {
    if (!account?.address) return
    setLoading(true)
    try {
      const data = await findBots(account.address)
      setBots(
        data.map((b) => ({
          id: b.id,
          owner: b.data.owner ?? '',
          followed_trader: b.data.followed_trader ?? '',
          is_active: b.data.is_active ?? false,
          copy_ratio: Number(b.data.copy_ratio ?? 0),
          max_position_size: String(b.data.max_position_size ?? '0'),
          min_hold_duration: String(b.data.min_hold_duration ?? '0'),
          daily_loss_limit: String(b.data.daily_loss_limit ?? '0'),
          total_loss_today: String(b.data.total_loss_today ?? '0'),
          last_reset_day: String(b.data.last_reset_day ?? '0'),
          balance: String(b.data.vault?.fields?.balance?.fields?.value ?? '0'),
        }))
      )
    } catch (err) {
      console.error('Failed to load bots:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBots()
    loadFollowedTraders()
  }, [account?.address])

  // Helper to refresh bots with retry for indexer lag
  const refreshBotsWithRetry = async () => {
    await loadBots()
    setTimeout(() => loadBots(), 3000)
  }

  const handleCreateBot = async () => {
    const finalTrader = useCustomAddress ? traderAddress : selectedTrader
    if (!finalTrader) {
      toast({ title: 'Please select or enter a trader address', type: 'error' })
      return
    }

    setLoading(true)
    try {
      await createTradingBot({
        followedTrader: finalTrader,
        copyRatio,
        maxPositionSize: parseFloat(maxPositionSize),
        minHoldDuration: parseInt(minHoldDuration),
        dailyLossLimit: parseFloat(dailyLossLimit),
      })

      // Refresh bots with retry for indexer lag
      await refreshBotsWithRetry()

      toast({ title: 'Bot created successfully!', type: 'success' })
      setShowCreateModal(false)
      // Reset form
      setSelectedTrader('')
      setTraderAddress('')
      setUseCustomAddress(false)
    } catch (err: any) {
      toast({ title: 'Failed to create bot', description: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async (botId: string) => {
    if (!depositAmount) return
    setLoading(true)
    try {
      await depositToBot(botId, parseFloat(depositAmount))
      toast({ title: 'Deposit successful!', type: 'success' })
      setDepositAmount('')
      setSelectedBot(null)
      await refreshBotsWithRetry()
    } catch (err: any) {
      toast({ title: 'Deposit failed', description: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleWithdraw = async (botId: string) => {
    if (!withdrawAmount) return
    setLoading(true)
    try {
      await withdrawFromBot(botId, parseFloat(withdrawAmount))
      toast({ title: 'Withdrawal successful!', type: 'success' })
      setWithdrawAmount('')
      setSelectedBot(null)
      await refreshBotsWithRetry()
    } catch (err: any) {
      toast({ title: 'Withdrawal failed', description: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async (botId: string) => {
    setLoading(true)
    try {
      await activateBot(botId)
      toast({ title: 'Bot activated!', type: 'success' })
      await refreshBotsWithRetry()
    } catch (err: any) {
      toast({ title: 'Activation failed', description: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async (botId: string) => {
    setLoading(true)
    try {
      await deactivateBot(botId)
      toast({ title: 'Bot deactivated!', type: 'success' })
      await refreshBotsWithRetry()
    } catch (err: any) {
      toast({ title: 'Deactivation failed', description: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDestroy = async (botId: string) => {
    if (!confirm('Are you sure? This will permanently destroy the bot (must have zero balance).'))
      return
    setLoading(true)
    try {
      await destroyBot(botId)
      toast({ title: 'Bot destroyed!', type: 'success' })
      await refreshBotsWithRetry()
    } catch (err: any) {
      toast({ title: 'Destroy failed', description: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (!account) {
    return (
      <div className="text-center py-12 text-gray-400">
        Please connect your wallet to manage trading bots
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Trading Bots</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={loading}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          + Create Bot
        </button>
      </div>

      {/* Bots List */}
      {loading && bots.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : bots.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No bots yet. Create one to start!</div>
      ) : (
        <div className="grid gap-4">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm text-gray-400">Following</div>
                  <div className="text-white font-mono text-sm">
                    {bot.followed_trader.slice(0, 10)}...{bot.followed_trader.slice(-6)}
                  </div>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    bot.is_active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-600/20 text-gray-400'
                  }`}
                >
                  {bot.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <div className="text-gray-400">Balance</div>
                  <div className="text-white font-medium">
                    ${usdcToDisplay(bot.balance).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Copy Ratio</div>
                  <div className="text-white font-medium">{bot.copy_ratio}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Max Position</div>
                  <div className="text-white font-medium">
                    ${usdcToDisplay(bot.max_position_size).toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Daily Loss Limit</div>
                  <div className="text-white font-medium">
                    ${usdcToDisplay(bot.daily_loss_limit).toFixed(0)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {selectedBot === bot.id ? (
                  <div className="w-full space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                      />
                      <button
                        onClick={() => handleDeposit(bot.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        Deposit
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                      />
                      <button
                        onClick={() => handleWithdraw(bot.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        Withdraw
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedBot(null)}
                      className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setSelectedBot(bot.id)}
                      disabled={loading}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      Manage Funds
                    </button>
                    {bot.is_active ? (
                      <button
                        onClick={() => handleDeactivate(bot.id)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(bot.id)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => handleDestroy(bot.id)}
                      disabled={loading || bot.is_active}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      Destroy
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Bot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Create Trading Bot</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white transition-colors text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Trader Address
                </label>
                {followedTraders.length > 0 && !useCustomAddress ? (
                  <div className="space-y-2">
                    <select
                      value={selectedTrader}
                      onChange={(e) => setSelectedTrader(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    >
                      <option value="">Select a trader you follow...</option>
                      {followedTraders.map((trader) => (
                        <option key={trader.traderAddress} value={trader.traderAddress}>
                          {trader.traderUsername || `${trader.traderAddress.slice(0, 10)}...`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setUseCustomAddress(true)}
                      className="text-sm text-primary-400 hover:underline"
                    >
                      Or enter custom address
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={traderAddress}
                      onChange={(e) => setTraderAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    />
                    {followedTraders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setUseCustomAddress(false)}
                        className="text-sm text-primary-400 hover:underline"
                      >
                        Or select from followed traders
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Copy Ratio: {copyRatio}%
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={copyRatio}
                  onChange={(e) => setCopyRatio(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Position Size (USDC)
                </label>
                <input
                  type="number"
                  value={maxPositionSize}
                  onChange={(e) => setMaxPositionSize(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Min Hold Duration (seconds)
                </label>
                <input
                  type="number"
                  value={minHoldDuration}
                  onChange={(e) => setMinHoldDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Daily Loss Limit (USDC)
                </label>
                <input
                  type="number"
                  value={dailyLossLimit}
                  onChange={(e) => setDailyLossLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBot}
                  disabled={loading || (!traderAddress && !selectedTrader)}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Bot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
