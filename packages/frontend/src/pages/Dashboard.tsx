import { useCurrentAccount } from '@mysten/dapp-kit'
import { useSearchParams } from 'react-router-dom'
import { MarketOverview } from '@/components/MarketOverview'
import { TradingPanel } from '@/components/TradingPanel'
import { PositionsList } from '@/components/PositionsList'
import { PriceChart } from '@/components/PriceChart'
import { CopyTradingTab } from '@/components/CopyTradingTab'
import { usePositions } from '@/hooks/usePositions'

const TABS = [
  { key: 'trading', label: 'Trading' },
  { key: 'copy-trading', label: 'Copy Trading' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function Dashboard() {
  const account = useCurrentAccount()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabKey) || 'trading'
  usePositions()

  const setTab = (tab: TabKey) => {
    if (tab === 'trading') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', tab)
    }
    setSearchParams(searchParams, { replace: true })
  }

  return (
    <>
      {!account && (
        <div className="text-center py-12 mb-6">
          <h1 className="text-4xl font-bold text-white mb-3">MarginMaster</h1>
          <p className="text-lg text-gray-400 mb-6">Copy trade the best on SUI</p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="px-4 py-1.5 rounded-full bg-primary-500/10 text-primary-400 text-sm font-medium border border-primary-500/20">Leverage Trading</span>
            <span className="px-4 py-1.5 rounded-full bg-success-500/10 text-success-400 text-sm font-medium border border-success-500/20">Copy Trading</span>
            <span className="px-4 py-1.5 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium border border-purple-500/20">Real-time Leaderboard</span>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      {account && (
        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl w-fit border border-gray-800">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'trading' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 space-y-6">
              <MarketOverview />
              <PriceChart />
            </div>
            <div>
              <TradingPanel />
            </div>
          </div>
          <div className="mb-6">
            <PositionsList />
          </div>
        </>
      ) : (
        <CopyTradingTab />
      )}
    </>
  )
}
