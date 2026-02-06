import { useEffect, useCallback, useRef } from 'react'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { useAppStore } from '@/store/app-store'
import { CONTRACT_ADDRESSES, USDC_TYPE, Position } from '@/types/sui-contracts'

const POSITION_TYPE = `${CONTRACT_ADDRESSES.PACKAGE_ID}::position::Position<${USDC_TYPE}>`
const POLL_INTERVAL = 15_000

function parseFields(fields: Record<string, any>): Partial<Position> {
  return {
    user: fields.owner ?? '',
    trading_pair: fields.trading_pair ? new TextDecoder().decode(new Uint8Array(fields.trading_pair)) : '',
    position_type: Number(fields.position_type) === 0 ? 'LONG' : 'SHORT',
    entry_price: String(fields.entry_price ?? '0'),
    current_price: String(fields.current_price ?? '0'),
    quantity: String(fields.quantity ?? '0'),
    leverage: Number(fields.leverage ?? 1),
    margin: String(fields.margin?.fields?.value ?? fields.margin_amount ?? '0'),
    unrealized_pnl: '0',
    is_profit: true,
    status: fields.is_closed ? 'CLOSED' : 'OPEN',
    opened_at: String(fields.opened_at ?? '0'),
  }
}

export function usePositions() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const setPositions = useAppStore((s) => s.setPositions)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const fetchPositions = useCallback(async () => {
    if (!account?.address) {
      setPositions([])
      return
    }

    try {
      const res = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: POSITION_TYPE },
        options: { showContent: true },
      })

      const positions: Position[] = res.data
        .filter((o) => o.data?.content?.dataType === 'moveObject')
        .map((o) => {
          const content = o.data!.content as any
          const fields = content.fields ?? {}
          return {
            id: o.data!.objectId,
            ...parseFields(fields),
          } as Position
        })

      setPositions(positions)
    } catch (err) {
      console.error('Failed to fetch positions:', err)
    }
  }, [account?.address, suiClient, setPositions])

  useEffect(() => {
    fetchPositions()
    timerRef.current = setInterval(fetchPositions, POLL_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [fetchPositions])

  return { refetch: fetchPositions }
}
