import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'

type ToastType = 'success' | 'error' | 'warning'

interface ToastItem {
  id: string
  title: string
  description?: string
  type: ToastType
}

interface ToastContextValue {
  toast: (options: { title: string; description?: string; type?: ToastType }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

const typeStyles: Record<ToastType, { border: string; icon: string; iconColor: string }> = {
  success: {
    border: 'border-success-500/30',
    icon: '\u2713',
    iconColor: 'text-success-500 bg-success-500/20',
  },
  error: {
    border: 'border-danger-500/30',
    icon: '\u2717',
    iconColor: 'text-danger-500 bg-danger-500/20',
  },
  warning: {
    border: 'border-yellow-500/30',
    icon: '!',
    iconColor: 'text-yellow-500 bg-yellow-500/20',
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback(
    ({ title, description, type = 'success' }: { title: string; description?: string; type?: ToastType }) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 5)
      setToasts((prev) => [...prev, { id, title, description, type }])
    },
    [],
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        {toasts.map((t) => {
          const style = typeStyles[t.type]
          return (
            <ToastPrimitive.Root
              key={t.id}
              onOpenChange={(open) => {
                if (!open) removeToast(t.id)
              }}
              className={`bg-gray-900 border ${style.border} rounded-xl p-4 shadow-2xl flex items-start gap-3
                data-[state=open]:animate-slideIn data-[state=closed]:animate-fadeOut
                data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
                data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform
                data-[swipe=end]:animate-swipeOut`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${style.iconColor}`}>
                {style.icon}
              </div>
              <div className="flex-1 min-w-0">
                <ToastPrimitive.Title className="text-sm font-semibold text-white">
                  {t.title}
                </ToastPrimitive.Title>
                {t.description && (
                  <ToastPrimitive.Description className="text-xs text-gray-400 mt-0.5">
                    {t.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
                <span className="text-lg leading-none">&times;</span>
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          )
        })}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 flex flex-col gap-2 p-6 w-[380px] max-w-[100vw] z-[9999] outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
