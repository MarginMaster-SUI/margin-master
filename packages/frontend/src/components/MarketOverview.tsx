import { useAppStore } from '@/store/app-store'
import { MarketCardSkeleton } from '@/components/Skeleton'

const PAIR_ICONS: Record<string, string> = {
  'SUI/USDC': 'S',
  'BTC/USDC': 'B',
  'ETH/USDC': 'E',
}

export function MarketOverview() {
  const { marketData, selectedPair, setSelectedPair } = useAppStore()

  const pairs = Object.values(marketData)
  const isEmpty = pairs.length === 0

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Market Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isEmpty ? (
          <>
            <MarketCardSkeleton />
            <MarketCardSkeleton />
            <MarketCardSkeleton />
          </>
        ) : (
          pairs.map((market) => (
            <button
              key={market.pair}
              onClick={() => setSelectedPair(market.pair)}
              className={`group p-4 rounded-lg border transition-all duration-200 text-left ${
                selectedPair === market.pair
                  ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/5'
                  : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/80 bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedPair === market.pair
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'bg-gray-700 text-gray-300 group-hover:bg-gray-600'
                  }`}>
                    {PAIR_ICONS[market.pair] || market.pair[0]}
                  </div>
                  <span className="font-semibold text-white">{market.pair}</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    market.change24h >= 0
                      ? 'bg-success-500/20 text-success-500'
                      : 'bg-danger-500/20 text-danger-500'
                  }`}
                >
                  {market.change24h >= 0 ? '+' : ''}
                  {market.change24h.toFixed(2)}%
                </span>
              </div>

              <div>
                <div className="text-2xl font-bold text-white">
                  ${market.price.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400 mt-0.5">
                  Vol: ${(market.volume24h / 1_000_000).toFixed(2)}M
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
