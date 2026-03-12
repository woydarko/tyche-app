import HeroSection from '@/components/landing/HeroSection'
import LiveStatsBar from '@/components/landing/LiveStatsBar'
import HowItWorks from '@/components/landing/HowItWorks'
import TopOraclesCarousel from '@/components/landing/TopOraclesCarousel'
import FooterSection from '@/components/landing/FooterSection'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <HeroSection />

      {/* Live stats */}
      <LiveStatsBar />

      {/* How it works */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* Top Oracles carousel */}
      <TopOraclesCarousel />

      {/* Footer */}
      <FooterSection />
    </div>
  )
}
