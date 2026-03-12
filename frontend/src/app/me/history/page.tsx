'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useProfile } from '@/hooks/useProfile'
import { type Prediction } from '@/lib/api'
import { formatAddress, formatPnL, formatTimestamp } from '@/lib/utils'
import { cn } from '@/lib/utils'

const CATEGORIES = ['All', 'Crypto', 'Sports', 'Politics', 'Tech', 'Science']
const RESULTS = ['All', 'WIN', 'LOSS', 'PENDING']
const PAGE_SIZE = 20

function ResultBadge({ status }: { status: Prediction['status'] }) {
  const map: Record<Prediction['status'], { label: string; cls: string }> = {
    won: { label: 'WIN', cls: 'bg-green-900/40 text-green-400 border-green-800/50' },
    lost: { label: 'LOSS', cls: 'bg-red-900/40 text-red-400 border-red-800/50' },
    pending: { label: 'PENDING', cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50' },
    resolved: { label: 'DONE', cls: 'bg-gray-800 text-gray-400 border-gray-700' },
  }
  const { label, cls } = map[status] ?? map.resolved
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function downloadCsv(data: Prediction[], filename = 'tyche-predictions.csv') {
  const headers = ['Market', 'Category', 'Position', 'Stake', 'Result', 'PnL', 'Date']
  const rows = data.map((p) => [
    `"${p.marketTitle.replace(/"/g, '""')}"`,
    p.category ?? '',
    p.prediction,
    p.stake,
    p.status,
    p.pnl ?? '',
    formatTimestamp(p.createdAt),
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function HistoryPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { predictions, loading } = useProfile(address)

  const [tab, setTab] = useState<'all' | 'pending'>('all')
  const [category, setCategory] = useState('All')
  const [result, setResult] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!isConnected) router.replace('/')
  }, [isConnected, router])

  const filtered = useMemo(() => {
    let data = predictions

    if (tab === 'pending') {
      return data.filter((p) => p.status === 'pending')
    }

    if (category !== 'All') {
      data = data.filter((p) => (p.category ?? '').toLowerCase() === category.toLowerCase())
    }

    if (result !== 'All') {
      const statusMap: Record<string, Prediction['status']> = {
        WIN: 'won',
        LOSS: 'lost',
        PENDING: 'pending',
      }
      data = data.filter((p) => p.status === statusMap[result])
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime() / 1000
      data = data.filter((p) => p.createdAt >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() / 1000
      data = data.filter((p) => p.createdAt <= to)
    }

    return data
  }, [predictions, tab, category, result, dateFrom, dateTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = useMemo(() => {
    const resolved = predictions.filter((p) => p.status === 'won' || p.status === 'lost')
    const wins = predictions.filter((p) => p.status === 'won').length
    const totalPnl = predictions.reduce((acc, p) => acc + (p.pnl ?? 0), 0)
    const winRate = resolved.length > 0 ? (wins / resolved.length) * 100 : 0
    return {
      total: predictions.length,
      winRate,
      totalPnl,
    }
  }, [predictions])

  if (!isConnected) return null

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Prediction History</h1>
            <p className="mt-1 text-gray-400">{formatAddress(address ?? '')} · {predictions.length} total</p>
          </div>
          <button
            onClick={() => downloadCsv(predictions)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Aggregate stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-1">Total Predictions</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{stats.winRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">Win Rate</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
            <p className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPnL(stats.totalPnl)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total PnL</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-gray-900 p-1 w-fit border border-gray-800">
          {(['all', 'pending'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1) }}
              className={cn(
                'px-5 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
                tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              {t === 'pending'
                ? `Pending (${predictions.filter((p) => p.status === 'pending').length})`
                : 'All Predictions'}
            </button>
          ))}
        </div>

        {/* Filters */}
        {tab === 'all' && (
          <div className="flex flex-wrap gap-3">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>

            <select
              value={result}
              onChange={(e) => { setResult(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {RESULTS.map((r) => <option key={r}>{r}</option>)}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="From"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="To"
            />
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              No predictions match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Market</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Position</th>
                    <th className="px-4 py-3 text-right">Stake</th>
                    <th className="px-4 py-3 text-center">Result</th>
                    <th className="px-4 py-3 text-right">PnL</th>
                    <th className="px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {paginated.map((p: Prediction) => (
                    <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="text-white line-clamp-1 block" title={p.marketTitle}>
                          {p.marketTitle}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{p.category ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'font-semibold',
                          p.prediction === 'YES' ? 'text-green-400' : 'text-red-400'
                        )}>
                          {p.prediction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono">{p.stake}</td>
                      <td className="px-4 py-3 text-center">
                        <ResultBadge status={p.status} />
                      </td>
                      <td className={cn(
                        'px-4 py-3 text-right font-mono font-semibold',
                        (p.pnl ?? 0) > 0 ? 'text-green-400' : (p.pnl ?? 0) < 0 ? 'text-red-400' : 'text-gray-500'
                      )}>
                        {p.pnl != null ? formatPnL(p.pnl) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatTimestamp(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
