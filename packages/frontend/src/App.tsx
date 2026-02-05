import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { Header } from '@/components/Header'
import { Dashboard } from '@/pages/Dashboard'
import { Leaderboard } from '@/pages/Leaderboard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAppStore } from '@/store/app-store'

function AppContent() {
  const account = useCurrentAccount()
  const setIsConnected = useAppStore((state) => state.setIsConnected)

  useWebSocket()

  useEffect(() => {
    setIsConnected(!!account)
  }, [account, setIsConnected])

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
