import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { api, LeaderboardEntry } from '@/services/api'
import { CopyTradeModal } from '@/components/CopyTradeModal'
import { LeaderboardSkeleton } from '@/components/Skeleton'

type SortField = 'totalPnL' | 'winRate' | 'totalTrades' | 'followerCount'

export function Leaderboard() {
  const account = useCurrentAccount()
  const [sortBy, setSortBy] = useState<SortField>('totalPnL')
  const [selectedTrader, setSelectedTrader] = useState<LeaderboardEntry | null>(null)

  const { data: leaders, isLoading } = useQuery({
    queryKey: ['leaderboard', sortBy],
    queryFn: () => api.getLeaderboard(sortBy),
    refetchInterval: 60_000,
  })

  const sortButtons: { field: SortField; label: string }[] = [
    { field: 'totalPnL', label: 'PnL' },
    { field: 'winRate', label: 'Win Rate' },
    { field: 'totalTrades', label: 'Trades' },
    { field: 'followerCount', label: 'Followers' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Top Traders</h1>
        <div className="flex gap-1.5 overflow-x-auto">
          {sortButtons.map(({ field, label }) => (
            <button
              key={field}
              onClick={() => setSortBy(field)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                sortBy === field
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <LeaderboardSkeleton />
        ) : !leaders || leaders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-2">No traders yet</p>
            <p className="text-gray-500 text-sm">
              Start trading to appear on the leaderboard
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="pb-3 text-sm font-medium text-gray-400">#</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Trader</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Total PnL</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Win Rate</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Trades</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Followers</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((trader) => (
                  <tr key={trader.address} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="py-4 text-white font-semibold">
                      {trader.rank <= 3 ? (
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${
                          trader.rank === 1
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : trader.rank === 2
                            ? 'bg-gray-400/20 text-gray-400'
                            : 'bg-orange-500/20 text-orange-500'
                        }`}>
                          {trader.rank}
                        </span>
                      ) : (
                        <span className="text-gray-400 pl-2">{trader.rank}</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {(trader.username || trader.address)?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {trader.username || (trader.address ? `${trader.address.slice(0, 6)}...${trader.address.slice(-4)}` : 'Unknown')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {trader.address ? `${trader.address.slice(0, 6)}...${trader.address.slice(-4)}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`font-semibold ${trader.totalPnL >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                        {trader.totalPnL >= 0 ? '+' : ''}${trader.totalPnL.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 text-gray-300">
                      {(trader.winRate * 100).toFixed(1)}%
                    </td>
                    <td className="py-4 text-gray-300">{trader.totalTrades}</td>
                    <td className="py-4 text-gray-300">{trader.followerCount}</td>
                    <td className="py-4">
                      {account && account.address !== trader.address && (
                        <button
                          onClick={() => setSelectedTrader(trader)}
                          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-all active:scale-95"
                        >
                          Copy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTrader && account && (
        <CopyTradeModal
          traderAddress={selectedTrader.address}
          traderUsername={selectedTrader.username}
          followerAddress={account.address}
          onClose={() => setSelectedTrader(null)}
        />
      )}
    </div>
  )
}
