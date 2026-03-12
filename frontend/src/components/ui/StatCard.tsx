import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  highlight?: boolean
  className?: string
}

export default function StatCard({
  label,
  value,
  subValue,
  icon,
  trend,
  highlight = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col gap-2',
        highlight && 'border-purple-500/30 bg-purple-950/20',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400 font-medium">{label}</span>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className={cn('text-2xl font-bold', highlight ? 'text-purple-400' : 'text-white')}>
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              'text-sm font-medium mb-0.5',
              trend === 'up' && 'text-green-400',
              trend === 'down' && 'text-red-400',
              trend === 'neutral' && 'text-gray-400'
            )}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      {subValue && <span className="text-xs text-gray-500">{subValue}</span>}
    </div>
  )
}
