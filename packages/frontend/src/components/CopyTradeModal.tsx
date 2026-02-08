import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTradingContract } from '@/hooks/useTradingContract'
import { useTradingBot } from '@/hooks/useTradingBot'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
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
  const { addCopyRelation } = useTradingContract()
  const { createTradingBot, depositToBot, activateBot, findBots } = useTradingBot()
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const navigate = useNavigate()
  const [copyRatio, setCopyRatio] = useState(50)
  const [maxPositionSize, setMaxPositionSize] = useState('1000')
  const [initialDeposit, setInitialDeposit] = useState('100')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [minHoldDuration, setMinHoldDuration] = useState('60') // seconds
  const [dailyLossLimit, setDailyLossLimit] = useState('100') // USDC
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState('')
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!account) {
      toast({ title: 'Wallet not connected', type: 'error' })
      return
    }

    setIsLoading(true)
    let botId: string | null = null

    try {
      // Step 1: Create copy relation
      setCurrentStep('Creating copy relation...')
      await addCopyRelation(traderAddress, copyRatio, parseFloat(maxPositionSize))

      // Step 2: Register in DB
      setCurrentStep('Registering in database...')
      await api.registerCopyTrade({
        traderAddress,
        followerAddress,
        copyRatio,
        maxPositionSize: parseFloat(maxPositionSize) || undefined,
      })

      // Step 3: Create trading bot
      setCurrentStep('Creating trading bot...')
      const createResult = await createTradingBot({
        followedTrader: traderAddress,
        copyRatio,
        maxPositionSize: parseFloat(maxPositionSize),
        minHoldDuration: parseInt(minHoldDuration),
        dailyLossLimit: parseFloat(dailyLossLimit),
      })

      // Step 4: Wait for indexer (similar to vault creation logic)
      setCurrentStep('Waiting for bot to be indexed...')
      let retries = 15
      while (retries > 0 && !botId) {
        await new Promise((r) => setTimeout(r, 2000))
        const bots = await findBots(account.address)
        botId = bots.find((b) => b.data.followed_trader === traderAddress)?.id ?? null
        retries--
      }

      if (!botId) {
        // Verify TX status
        const txBlock = await suiClient.getTransactionBlock({ digest: createResult.digest! })
        if (txBlock.effects?.status?.status === 'success') {
          throw new Error(
            'Bot created but not indexed yet. Check Copy Trading tab in 1 minute.'
          )
        } else {
          throw new Error(
            `Bot creation failed: ${txBlock.effects?.status?.error || 'Unknown error'}`
          )
        }
      }

      // Step 5: Deposit (if initialDeposit > 0)
      if (parseFloat(initialDeposit) > 0) {
        setCurrentStep('Depositing funds...')
        await depositToBot(botId, parseFloat(initialDeposit))
      }

      // Step 6: Activate bot
      setCurrentStep('Activating bot...')
      await activateBot(botId)

      toast({ title: 'Copy trading started successfully!', type: 'success' })
      onClose()
      navigate('/?tab=copy-trading')
    } catch (error: any) {
      console.error('Failed to start copy trading:', error)

      // Handle partial success
      if (botId) {
        toast({
          title: 'Partial success',
          description: 'Bot created but setup incomplete. Check Copy Trading tab.',
          type: 'warning',
        })
      } else if (error.message?.includes('User rejected')) {
        toast({
          title: 'Transaction cancelled',
          description: 'You rejected the transaction.',
          type: 'error',
        })
      } else {
        toast({
          title: 'Failed to start copy trading',
          description: error.message || 'Please try again.',
          type: 'error',
        })
      }
    } finally {
      setIsLoading(false)
      setCurrentStep('')
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

          {/* Initial Deposit */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Initial Deposit (USDC)
            </label>
            <input
              type="number"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value)}
              placeholder="100"
              className="input w-full"
              min="0"
              step="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Funds to deposit into the bot. Set to 0 to skip.
            </p>
          </div>

          {/* Advanced Settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              {showAdvanced ? '▼' : '▶'} Advanced Settings
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 p-4 bg-gray-800 rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Min Hold Duration: {minHoldDuration}s
                  </label>
                  <input
                    type="range"
                    value={minHoldDuration}
                    onChange={(e) => setMinHoldDuration(e.target.value)}
                    min="0"
                    max="300"
                    step="10"
                    className="w-full accent-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum time to hold copied positions before closing.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Daily Loss Limit (USDC)
                  </label>
                  <input
                    type="number"
                    value={dailyLossLimit}
                    onChange={(e) => setDailyLossLimit(e.target.value)}
                    placeholder="100"
                    className="input w-full"
                    min="1"
                    step="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Bot pauses after losing this amount in one day.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Progress */}
        {isLoading && currentStep && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-400">{currentStep}</p>
          </div>
        )}

        {/* Warning about multiple transactions */}
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-xs text-yellow-400">
            This will create an automated bot that copies {traderUsername}'s positions.
            Requires 4-5 transactions (gas fees apply).
          </p>
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
