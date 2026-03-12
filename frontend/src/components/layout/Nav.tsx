'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/seasons', label: 'Seasons' },
  { href: '/explore', label: 'Explore' },
  { href: '/feed', label: 'Feed' },
]

const authedLinks = [
  { href: '/me', label: 'My Profile' },
  { href: '/me/score', label: 'Score' },
  { href: '/me/history', label: 'History' },
]

export default function Nav() {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const allLinks = [
    ...navLinks,
    ...(isConnected && address ? authedLinks : []),
  ]

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white font-bold text-sm group-hover:bg-purple-500 transition-colors">
              T
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Tyche</span>
            <span className="hidden sm:block text-xs text-gray-500 font-medium mt-0.5 ml-1">
              on-chain identity
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'text-white bg-gray-800'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                )}
              >
                {link.label}
              </Link>
            ))}
            {isConnected && address && authedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === link.href || (link.href === '/me' && pathname.startsWith('/profile/'))
                    ? 'text-white bg-gray-800'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side: Connect + Hamburger */}
          <div className="flex items-center gap-3">
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
            />

            {/* Hamburger button — mobile only */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden flex flex-col items-center justify-center w-9 h-9 rounded-lg border border-gray-700 hover:border-gray-600 hover:bg-gray-800/50 transition-colors gap-1.5"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <span
                className={cn(
                  'block w-5 h-0.5 bg-gray-300 transition-all duration-200',
                  menuOpen ? 'translate-y-2 rotate-45' : ''
                )}
              />
              <span
                className={cn(
                  'block w-5 h-0.5 bg-gray-300 transition-all duration-200',
                  menuOpen ? 'opacity-0' : ''
                )}
              />
              <span
                className={cn(
                  'block w-5 h-0.5 bg-gray-300 transition-all duration-200',
                  menuOpen ? '-translate-y-2 -rotate-45' : ''
                )}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer */}
          <div
            className="fixed top-16 left-0 right-0 z-40 bg-gray-950 border-b border-gray-800 md:hidden"
            style={{ animation: 'mobileMenuSlide 0.2s ease-out' }}
          >
            <nav className="flex flex-col py-3 px-4">
              {allLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    pathname === link.href
                      ? 'text-white bg-gray-800'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}

      <style>{`
        @keyframes mobileMenuSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
