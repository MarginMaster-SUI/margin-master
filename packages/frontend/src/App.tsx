import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { Header } from '@/components/Header'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/Toast'
import { PageSkeleton } from '@/components/Skeleton'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAppStore } from '@/store/app-store'

const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Leaderboard = lazy(() => import('@/pages/Leaderboard').then((m) => ({ default: m.Leaderboard })))

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
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
