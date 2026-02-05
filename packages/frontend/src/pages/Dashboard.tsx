import { MarketOverview } from '@/components/MarketOverview'
import { TradingPanel } from '@/components/TradingPanel'
import { PositionsList } from '@/components/PositionsList'
import { PriceChart } from '@/components/PriceChart'

export function Dashboard() {
  return (
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
  )
}
