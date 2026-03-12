'use client'

import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { injected, metaMask } from 'wagmi/connectors'
import { somnia } from '@/lib/chains'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

const wagmiConfig = createConfig({
  chains: [somnia],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [somnia.id]: http('https://dream-rpc.somnia.network'),
  },
})

const rainbowTheme = darkTheme({
  accentColor: '#a855f7',
  accentColorForeground: 'white',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'small',
})

interface Web3ProviderProps {
  children: ReactNode
}

export default function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={rainbowTheme}
          initialChain={somnia}
          appInfo={{
            appName: 'Tyche',
            learnMoreUrl: 'https://somnia.network',
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
