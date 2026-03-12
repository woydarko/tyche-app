import { type Prediction } from '@/lib/api'
import { formatPnL, formatTimestamp } from '@/lib/utils'

interface PredictionsTableProps {
  predictions: Prediction[]
}

const STATUS_STYLES = {
  won: 'bg-green-950/50 text-green-400 border-green-500/20',
  lost: 'bg-red-950/50 text-red-400 border-red-500/20',
  pending: 'bg-gray-800 text-gray-400 border-gray-700',
  resolved: 'bg-blue-950/50 text-blue-400 border-blue-500/20',
}

export default function PredictionsTable({ predictions }: PredictionsTableProps) {
  if (predictions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-base font-semibold text-white mb-4">Recent Predictions</h3>
        <div className="text-center py-8 text-gray-500 text-sm">
          No predictions yet
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="p-6 pb-3">
        <h3 className="text-base font-semibold text-white">Recent Predictions</h3>
        <p className="text-sm text-gray-400 mt-0.5">Last {predictions.length} predictions</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-y border-gray-800 bg-gray-900/50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Market</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Category</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Stake</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">PnL</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Date</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((pred) => (
              <tr key={pred.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="text-sm font-medium text-white line-clamp-1">{pred.marketTitle}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Predicted: <span className="text-gray-300">{pred.prediction}</span>
                    {pred.outcome && (
                      <> → Outcome: <span className="text-gray-300">{pred.outcome}</span></>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 hidden md:table-cell">
                  {pred.category && (
                    <span className="text-xs text-gray-400 bg-gray-800 rounded-full px-2 py-0.5">
                      {pred.category}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[pred.status]
                    }`}
                  >
                    {pred.status.charAt(0).toUpperCase() + pred.status.slice(1)}
                  </span>
                </td>
                <td className="px-5 py-3 text-right hidden sm:table-cell">
                  <span className="text-sm text-gray-400">{pred.stake.toFixed(2)} STT</span>
                </td>
                <td className="px-5 py-3 text-right">
                  {pred.pnl !== undefined ? (
                    <span className={`text-sm font-medium ${pred.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPnL(pred.pnl)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right hidden lg:table-cell">
                  <span className="text-xs text-gray-500">{formatTimestamp(pred.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
