import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppStore } from '@/store/app-store'

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null)
  const setMarketData = useAppStore((state) => state.setMarketData)
  const updatePosition = useAppStore((state) => state.updatePosition)

  useEffect(() => {
    // Connect to backend WebSocket
    const wsUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
    socketRef.current = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('WebSocket connected')
      socket.emit('subscribe-prices')
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })

    // Listen for price updates
    socket.on('price-update', (data: { pair: string; price: number; change24h?: number; volume24h?: number }) => {
      setMarketData(data.pair, {
        pair: data.pair,
        price: data.price,
        change24h: data.change24h ?? 0,
        volume24h: data.volume24h ?? 0,
      })
    })

    // Listen for position updates
    socket.on('position-updated', (data: { positionId: string; currentPrice: number; unrealizedPnL: number }) => {
      updatePosition(data.positionId, {
        current_price: data.currentPrice.toString(),
        unrealized_pnl: data.unrealizedPnL.toString(),
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [setMarketData, updatePosition])

  return socketRef.current
}
