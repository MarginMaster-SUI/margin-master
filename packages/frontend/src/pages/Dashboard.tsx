import { MarketOverview } from '@/components/MarketOverview'
import { TradingPanel } from '@/components/TradingPanel'
import { PositionsList } from '@/components/PositionsList'

export function Dashboard() {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <MarketOverview />
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
