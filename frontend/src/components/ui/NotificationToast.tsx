'use client'

import { useEffect } from 'react'
import { useNotifications, type Notification, type NotificationType } from '@/hooks/useNotifications'

const TOAST_DURATION = 5000 // 5 seconds

interface ToastConfig {
  icon: string
  bgClass: string
  borderClass: string
  textClass: string
}

const TOAST_STYLES: Record<NotificationType, ToastConfig> = {
  tier_changed: {
    icon: '⬆️',
    bgClass: 'bg-purple-900/90',
    borderClass: 'border-purple-700',
    textClass: 'text-purple-100',
  },
  sbt_evolved: {
    icon: '🔷',
    bgClass: 'bg-blue-900/90',
    borderClass: 'border-blue-700',
    textClass: 'text-blue-100',
  },
  season_warning: {
    icon: '⏰',
    bgClass: 'bg-yellow-900/90',
    borderClass: 'border-yellow-700',
    textClass: 'text-yellow-100',
  },
}

function Toast({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  const config = TOAST_STYLES[notification.type]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notification.id), TOAST_DURATION)
    return () => clearTimeout(timer)
  }, [notification.id, onDismiss])

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border backdrop-blur-sm px-4 py-3 shadow-xl max-w-sm w-full pointer-events-auto
        ${config.bgClass} ${config.borderClass}`}
      role="alert"
      style={{ animation: 'toastSlideIn 0.25s ease-out' }}
    >
      <span className="text-xl flex-shrink-0 mt-0.5">{config.icon}</span>
      <p className={`flex-1 text-sm font-medium ${config.textClass}`}>{notification.message}</p>
      <button
        onClick={() => onDismiss(notification.id)}
        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors ml-1"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function NotificationToast() {
  const { notifications, dismissNotification } = useNotifications()

  if (notifications.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {notifications.map((n) => (
          <Toast key={n.id} notification={n} onDismiss={dismissNotification} />
        ))}
      </div>
    </>
  )
}
