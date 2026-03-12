'use client'

import { useState } from 'react'
import { formatAddress } from '@/lib/utils'

interface AddressDisplayProps {
  address: string
  chars?: number
  className?: string
  showCopy?: boolean
  explorerUrl?: boolean
}

export default function AddressDisplay({
  address,
  chars = 4,
  className = '',
  showCopy = false,
  explorerUrl = false,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const display = formatAddress(address, chars)
  const explorerLink = `https://shannon-explorer.somnia.network/address/${address}`

  return (
    <span className={`inline-flex items-center gap-1 font-mono ${className}`}>
      {explorerUrl ? (
        <a
          href={explorerLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300 transition-colors"
          title={address}
        >
          {display}
        </a>
      ) : (
        <span title={address}>{display}</span>
      )}
      {showCopy && (
        <button
          onClick={handleCopy}
          className="text-gray-500 hover:text-gray-300 transition-colors ml-1"
          title="Copy address"
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      )}
    </span>
  )
}
