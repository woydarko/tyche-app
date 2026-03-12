import Link from 'next/link'

export default function FooterSection() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white font-bold text-sm">
                T
              </div>
              <span className="text-xl font-bold text-white">Tyche</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Your on-chain prediction identity. Score your market calls, build a reputation,
              and earn soulbound credentials — all on Somnia.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Protocol</h3>
            <ul className="space-y-2">
              {[
                { label: 'Leaderboard', href: '/leaderboard' },
                { label: 'How It Works', href: '/#how-it-works' },
                {
                  label: 'Explorer',
                  href: 'https://shannon-explorer.somnia.network',
                  external: true,
                },
                {
                  label: 'Score Registry',
                  href: `https://shannon-explorer.somnia.network/address/0x90ab2482E83BE7A1Ae550b8C789bc6701267adA0`,
                  external: true,
                },
              ].map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      {link.label}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Network */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Network</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-gray-400">Somnia Testnet — Chain ID 50312</span>
              </div>
              <div className="text-sm text-gray-500 font-mono text-xs">
                RPC: dream-rpc.somnia.network
              </div>
              <a
                href="https://somnia.network"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                somnia.network
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002 2h4a2 2 0 002-2V4a2 2 0 00-2-2h-4z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            Built on{' '}
            <a
              href="https://somnia.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Somnia Reactivity
            </a>{' '}
            — Fully On-Chain, Zero Backend
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Somnia Reactivity Mini Hackathon 2026</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
