import { create } from 'zustand'
import { Position } from '@/types/sui-contracts'

interface MarketData {
  pair: string
  price: number
  change24h: number
  volume24h: number
}

interface AppState {
  // Market data
  marketData: Record<string, MarketData>
  setMarketData: (pair: string, data: MarketData) => void

  // User positions
  positions: Position[]
  setPositions: (positions: Position[]) => void
  addPosition: (position: Position) => void
  updatePosition: (id: string, updates: Partial<Position>) => void
  removePosition: (id: string) => void

  // UI state
  selectedPair: string
  setSelectedPair: (pair: string) => void

  isConnected: boolean
  setIsConnected: (connected: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Market data
  marketData: {
    'SUI/USDC': { pair: 'SUI/USDC', price: 3.45, change24h: 5.2, volume24h: 1250000 },
    'BTC/USDC': { pair: 'BTC/USDC', price: 98500, change24h: 2.1, volume24h: 8500000 },
    'ETH/USDC': { pair: 'ETH/USDC', price: 3420, change24h: -1.3, volume24h: 4200000 },
  },
  setMarketData: (pair, data) =>
    set((state) => ({
      marketData: { ...state.marketData, [pair]: data },
    })),

  // User positions
  positions: [],
  setPositions: (positions) => set({ positions }),
  addPosition: (position) =>
    set((state) => ({ positions: [...state.positions, position] })),
  updatePosition: (id, updates) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  removePosition: (id) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    })),

  // UI state
  selectedPair: 'SUI/USDC',
  setSelectedPair: (pair) => set({ selectedPair: pair }),

  isConnected: false,
  setIsConnected: (connected) => set({ isConnected: connected }),
}))
