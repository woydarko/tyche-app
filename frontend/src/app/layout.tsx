import type { Metadata } from 'next'
import './globals.css'
import Web3Provider from '@/components/providers/Web3Provider'
import Nav from '@/components/layout/Nav'
import NetworkGuard from '@/components/wallet/NetworkGuard'
import NotificationToast from '@/components/ui/NotificationToast'

export const metadata: Metadata = {
  title: 'Tyche — Your On-Chain Prediction Identity',
  description:
    'Score your prediction accuracy, alpha generation, and market calibration on Somnia blockchain. Build your on-chain reputation, climb the leaderboard, earn soulbound badges.',
  keywords: ['prediction market', 'reputation', 'on-chain', 'Somnia', 'DeFi', 'Web3'],
  openGraph: {
    title: 'Tyche — Your On-Chain Prediction Identity',
    description: 'Build your on-chain prediction reputation on Somnia blockchain.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        <Web3Provider>
          <Nav />
          <NetworkGuard />
          <main>{children}</main>
          <NotificationToast />
        </Web3Provider>
      </body>
    </html>
  )
}
