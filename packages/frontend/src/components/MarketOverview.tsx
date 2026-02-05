import { useAppStore } from '@/store/app-store'

export function MarketOverview() {
  const { marketData, selectedPair, setSelectedPair } = useAppStore()

  const pairs = Object.values(marketData)

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Market Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pairs.map((market) => (
          <button
            key={market.pair}
            onClick={() => setSelectedPair(market.pair)}
            className={`p-4 rounded-lg border transition-all ${
              selectedPair === market.pair
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-gray-700 hover:border-gray-600 bg-gray-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white">{market.pair}</span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  market.change24h >= 0
                    ? 'bg-success-500/20 text-success-500'
                    : 'bg-danger-500/20 text-danger-500'
                }`}
              >
                {market.change24h >= 0 ? '+' : ''}
                {market.change24h.toFixed(2)}%
              </span>
            </div>

            <div className="text-left">
              <div className="text-2xl font-bold text-white">
                ${market.price.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">
                Vol: ${(market.volume24h / 1_000_000).toFixed(2)}M
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          Selected: {selectedPair}
        </h3>
        <div className="text-3xl font-bold text-white">
          ${marketData[selectedPair]?.price.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
