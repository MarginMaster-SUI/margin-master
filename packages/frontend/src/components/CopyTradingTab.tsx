import { useEffect, useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { api, CopyRelation } from '@/services/api'
import { useTradingContract } from '@/hooks/useTradingContract'
import { PositionsList } from '@/components/PositionsList'
import { useToast } from '@/components/Toast'

export function CopyTradingTab() {
  const account = useCurrentAccount()
  const { deactivateCopyRelation } = useTradingContract()
  const { toast } = useToast()
  const [relations, setRelations] = useState<CopyRelation[]>([])
  const [loading, setLoading] = useState(true)
  const [unfollowing, setUnfollowing] = useState<string | null>(null)

  const fetchRelations = async () => {
    if (!account?.address) return
    try {
      const data = await api.getCopyRelations(account.address)
      setRelations(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to fetch copy relations:', e)
      setRelations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRelations()
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
      {/* Followed Traders */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Following</h2>
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
          <div className="space-y-3">
            {activeRelations.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {(r.traderUsername || r.traderAddress)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-white font-medium">{r.traderUsername || `${r.traderAddress.slice(0, 8)}...`}</div>
                    <div className="text-xs text-gray-500">
                      Ratio: {r.copyRatio}% | Max: {r.maxPositionSize ? `${r.maxPositionSize} USDC` : 'No limit'}
                    </div>
                    <div className="text-xs text-gray-600">
                      Since {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleUnfollow(r)}
                  disabled={unfollowing === r.id}
                  className="px-4 py-2 text-sm rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
                >
                  {unfollowing === r.id ? 'Unfollowing...' : 'Unfollow'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Positions */}
      <PositionsList />
    </div>
  )
}
