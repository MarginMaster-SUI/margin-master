import { useEffect, useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { api, CopyRelation } from '@/services/api'
import { useTradingContract } from '@/hooks/useTradingContract'
import { useTradingBot } from '@/hooks/useTradingBot'
import { PositionsList } from '@/components/PositionsList'
import { useToast } from '@/components/Toast'
import { BotStatusDisplay } from '@/components/BotStatusDisplay'

interface TradingBotData {
  id: string
  followed_trader: string
  is_active: boolean
  balance: string
  copy_ratio: number
  max_position_size: string
  daily_loss_limit: string
}

export function CopyTradingTab() {
  const account = useCurrentAccount()
  const { deactivateCopyRelation } = useTradingContract()
  const { findBots } = useTradingBot()
  const { toast } = useToast()
  const [relations, setRelations] = useState<CopyRelation[]>([])
  const [bots, setBots] = useState<TradingBotData[]>([])
  const [loading, setLoading] = useState(true)
  const [unfollowing, setUnfollowing] = useState<string | null>(null)

  const fetchData = async () => {
    if (!account?.address) return
    setLoading(true)
    try {
      // Fetch copy relations
      const relationsData = await api.getCopyRelations(account.address)
      setRelations(Array.isArray(relationsData) ? relationsData : [])

      // Fetch trading bots
      const botsData = await findBots(account.address)
      setBots(
        botsData.map((b) => ({
          id: b.id,
          followed_trader: b.data.followed_trader,
          is_active: b.data.is_active,
          balance: b.data.vault?.fields?.balance?.fields?.value ?? '0',
          copy_ratio: b.data.copy_ratio,
          max_position_size: b.data.max_position_size,
          daily_loss_limit: b.data.daily_loss_limit,
        }))
      )
    } catch (e) {
      console.error('Failed to fetch data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [account?.address])

  const handleUnfollow = async (relation: CopyRelation) => {
    setUnfollowing(relation.id)
    try {
      // On-chain deactivation
      await deactivateCopyRelation(relation.traderAddress)
      // Off-chain deactivation
      await api.deactivateCopyRelation(relation.id)
      toast({ title: `Unfollowed ${relation.traderUsername || relation.traderAddress.slice(0, 10)}`, type: 'success' })
      setRelations((prev) => prev.filter((r) => r.id !== relation.id))
    } catch (e) {
      console.error('Failed to unfollow:', e)
      toast({ title: 'Failed to unfollow', type: 'error' })
    } finally {
      setUnfollowing(null)
    }
  }

  if (!account) {
    return (
      <div className="text-center py-12 text-gray-400">
        Connect your wallet to view copy trades.
      </div>
    )
  }

  const activeRelations = relations.filter((r) => r.isActive)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Following Traders</h2>

      {/* Followed Traders */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Active Copy Trades</h3>
        {loading ? (
          <div className="text-gray-400 text-sm py-4">Loading...</div>
        ) : activeRelations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-2">No copy trades yet.</p>
            <p className="text-sm text-gray-500">
              Visit the <a href="/leaderboard" className="text-primary-400 hover:underline">Leaderboard</a> to follow traders.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeRelations.map((relation) => {
              const bot = bots.find((b) => b.followed_trader === relation.traderAddress)

              return (
                <div key={relation.id} className="bg-gray-800 rounded-xl p-5">
                  {/* Trader Info */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold">
                        {(relation.traderUsername || relation.traderAddress)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-semibold">
                          {relation.traderUsername || `${relation.traderAddress.slice(0, 10)}...`}
                        </div>
                        <div className="text-sm text-gray-400">
                          Ratio: {(relation.copyRatio * 100).toFixed(0)}% | Max: {relation.maxPositionSize} USDC
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnfollow(relation)}
                      disabled={unfollowing === relation.id}
                      className="px-4 py-2 text-sm rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {unfollowing === relation.id ? 'Unfollowing...' : 'Unfollow'}
                    </button>
                  </div>

                  {/* Bot Status */}
                  {bot && <BotStatusDisplay bot={bot} onRefresh={fetchData} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Positions */}
      <PositionsList />
    </div>
  )
}
