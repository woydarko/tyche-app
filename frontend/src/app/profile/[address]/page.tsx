'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'
import ProfileHeader from '@/components/profile/ProfileHeader'
import ScoreRadar from '@/components/profile/ScoreRadar'
import StatsRow from '@/components/profile/StatsRow'
import CategoryCards from '@/components/profile/CategoryCards'
import PredictionsTable from '@/components/profile/PredictionsTable'
import SeasonChart from '@/components/profile/SeasonChart'
import BadgesShelf from '@/components/profile/BadgesShelf'

function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 h-36" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-900 border border-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-xl bg-gray-900 border border-gray-800" />
        <div className="h-72 rounded-xl bg-gray-900 border border-gray-800" />
      </div>
    </div>
  )
}

function EmptyProfile({ address }: { address: string }) {
  return (
    <div className="text-center py-24">
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white mx-auto mb-6"
        style={{ background: `hsl(${parseInt(address.slice(2, 8), 16) % 360}, 65%, 40%)` }}>
        {address.slice(2, 4).toUpperCase()}
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">
        {address.slice(0, 6)}...{address.slice(-4)}
      </h2>
      <p className="text-gray-400 max-w-md mx-auto mb-8">
        This address doesn't have a Tyche score yet. They need to participate in prediction markets on Somnia to build their reputation.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/leaderboard"
          className="rounded-xl bg-purple-600 hover:bg-purple-500 px-6 py-3 text-sm font-semibold text-white transition-colors"
        >
          View Leaderboard
        </Link>
        <a
          href={`https://shannon-explorer.somnia.network/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-gray-700 bg-gray-900 hover:bg-gray-800 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors"
        >
          View on Explorer
        </a>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const params = useParams()
  const address = params.address as string

  const { profile, predictions, loading, error } = useProfile(address)

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <ProfileSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-red-950/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Failed to load profile</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            Return home
          </Link>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <EmptyProfile address={address} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/leaderboard" className="hover:text-gray-300 transition-colors">Leaderboard</Link>
        <span>/</span>
        <span className="text-gray-400 font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>

      {/* Header with avatar, score ring, tier, action buttons */}
      <ProfileHeader profile={profile} address={address} />

      {/* Stats row */}
      <StatsRow profile={profile} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar chart - 5 score dimensions */}
        <ScoreRadar profile={profile} />

        {/* Season performance line chart */}
        <SeasonChart profile={profile} />
      </div>

      {/* Category performance cards */}
      <CategoryCards profile={profile} />

      {/* Recent predictions table */}
      <PredictionsTable predictions={predictions} />

      {/* Badges shelf */}
      <BadgesShelf profile={profile} />
    </div>
  )
}
