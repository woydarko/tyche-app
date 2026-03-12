'use client'

import { TIER_NAMES, TIER_COLORS } from '@/lib/constants'

interface SBTVisualProps {
  tier: number
  size?: number
  className?: string
}

export default function SBTVisual({ tier, size = 200, className = '' }: SBTVisualProps) {
  const color = TIER_COLORS[Math.min(tier, 4)] ?? TIER_COLORS[0]
  const name = TIER_NAMES[Math.min(tier, 4)] ?? TIER_NAMES[0]
  const animId = `sbt-anim-${tier}`

  // Diamond points scaled to size
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38

  // Main diamond polygon points: top, right, bottom-right, bottom, bottom-left, left
  const points = [
    `${cx},${cy - r}`,           // top
    `${cx + r * 0.6},${cy - r * 0.2}`,  // top-right
    `${cx + r * 0.6},${cy + r * 0.2}`,  // bottom-right
    `${cx},${cy + r}`,           // bottom
    `${cx - r * 0.6},${cy + r * 0.2}`,  // bottom-left
    `${cx - r * 0.6},${cy - r * 0.2}`,  // top-left
  ].join(' ')

  // Inner facet points for the crystal cut look
  const innerR = r * 0.55
  const innerPoints = [
    `${cx},${cy - innerR}`,
    `${cx + innerR * 0.6},${cy - innerR * 0.2}`,
    `${cx + innerR * 0.6},${cy + innerR * 0.2}`,
    `${cx},${cy + innerR}`,
    `${cx - innerR * 0.6},${cy + innerR * 0.2}`,
    `${cx - innerR * 0.6},${cy - innerR * 0.2}`,
  ].join(' ')

  const glowId = `glow-${tier}-${size}`
  const gradId = `grad-${tier}-${size}`
  const shimId = `shim-${tier}-${size}`

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <style>{`
        @keyframes sbt-pulse-${tier} {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes sbt-shimmer-${tier} {
          0% { transform: translateX(-100%) rotate(30deg); }
          100% { transform: translateX(200%) rotate(30deg); }
        }
        @keyframes sbt-aura-${tier} {
          0%, 100% { r: ${r * 1.15}; opacity: 0.3; }
          50% { r: ${r * 1.35}; opacity: 0.15; }
        }
        @keyframes sbt-particle-${tier} {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
        }
        @keyframes sbt-rotate-${tier} {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sbt-glyph-${tier} {
          ${tier === 0 ? '' : `animation: sbt-pulse-${tier} ${tier === 4 ? '1.5s' : '2.5s'} ease-in-out infinite;`}
          transform-origin: ${cx}px ${cy}px;
        }
        .sbt-aura-${tier} {
          ${tier >= 3 ? `animation: sbt-aura-${tier} 2s ease-in-out infinite;` : ''}
          transform-origin: ${cx}px ${cy}px;
        }
        .sbt-orbit-${tier} {
          ${tier === 4 ? `animation: sbt-rotate-${tier} 4s linear infinite;` : ''}
          transform-origin: ${cx}px ${cy}px;
        }
      `}</style>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Glow filter */}
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={tier === 0 ? '2' : tier === 4 ? '8' : '5'} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient fill */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {tier === 0 && (
              <>
                <stop offset="0%" stopColor="#8B6542" />
                <stop offset="50%" stopColor={color} />
                <stop offset="100%" stopColor="#5a3a1a" />
              </>
            )}
            {tier === 1 && (
              <>
                <stop offset="0%" stopColor="#e8e8e8" />
                <stop offset="50%" stopColor={color} />
                <stop offset="100%" stopColor="#888" />
              </>
            )}
            {tier === 2 && (
              <>
                <stop offset="0%" stopColor="#ffe066" />
                <stop offset="50%" stopColor={color} />
                <stop offset="100%" stopColor="#b8860b" />
              </>
            )}
            {tier === 3 && (
              <>
                <stop offset="0%" stopColor="#f0f0f0" />
                <stop offset="40%" stopColor={color} />
                <stop offset="100%" stopColor="#b0aeb0" />
              </>
            )}
            {tier === 4 && (
              <>
                <stop offset="0%" stopColor="#e879f9" />
                <stop offset="40%" stopColor={color} />
                <stop offset="100%" stopColor="#7c3aed" />
              </>
            )}
          </linearGradient>

          {/* Shimmer gradient for Gold+ */}
          {tier >= 2 && (
            <linearGradient id={shimId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="40%" stopColor="rgba(255,255,255,0.35)" />
              <stop offset="60%" stopColor="rgba(255,255,255,0.45)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          )}
        </defs>

        {/* Outer aura for Platinum and Oracle */}
        {tier >= 3 && (
          <circle
            className={`sbt-aura-${tier}`}
            cx={cx}
            cy={cy}
            r={r * 1.2}
            fill="none"
            stroke={color}
            strokeWidth={tier === 4 ? 2 : 1.5}
            opacity={0.25}
          />
        )}

        {/* Second aura ring for Oracle */}
        {tier === 4 && (
          <circle
            cx={cx}
            cy={cy}
            r={r * 1.45}
            fill="none"
            stroke={color}
            strokeWidth={1}
            opacity={0.15}
            strokeDasharray="4 6"
          />
        )}

        {/* Orbiting dots for Oracle */}
        {tier === 4 && (
          <g className={`sbt-orbit-${tier}`}>
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180
              const orbitR = r * 1.3
              const px = cx + orbitR * Math.cos(rad)
              const py = cy + orbitR * Math.sin(rad)
              return (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={3}
                  fill={color}
                  opacity={0.8}
                />
              )
            })}
          </g>
        )}

        {/* Main diamond glyph */}
        <g className={`sbt-glyph-${tier}`} filter={tier > 0 ? `url(#${glowId})` : undefined}>
          {/* Outer shell */}
          <polygon
            points={points}
            fill={`url(#${gradId})`}
            stroke={color}
            strokeWidth={tier === 0 ? 1.5 : 2}
            opacity={0.95}
          />

          {/* Inner facet lines */}
          <line
            x1={cx} y1={cy - r}
            x2={cx} y2={cy - innerR}
            stroke={color} strokeWidth={0.8} opacity={0.5}
          />
          <line
            x1={cx + r * 0.6} y1={cy - r * 0.2}
            x2={cx + innerR * 0.6} y2={cy - innerR * 0.2}
            stroke={color} strokeWidth={0.8} opacity={0.5}
          />
          <line
            x1={cx + r * 0.6} y1={cy + r * 0.2}
            x2={cx + innerR * 0.6} y2={cy + innerR * 0.2}
            stroke={color} strokeWidth={0.8} opacity={0.5}
          />
          <line
            x1={cx} y1={cy + r}
            x2={cx} y2={cy + innerR}
            stroke={color} strokeWidth={0.8} opacity={0.5}
          />
          <line
            x1={cx - r * 0.6} y1={cy + r * 0.2}
            x2={cx - innerR * 0.6} y2={cy + innerR * 0.2}
            stroke={color} strokeWidth={0.8} opacity={0.5}
          />
          <line
            x1={cx - r * 0.6} y1={cy - r * 0.2}
            x2={cx - innerR * 0.6} y2={cy - innerR * 0.2}
            stroke={color} strokeWidth={0.8} opacity={0.5}
          />

          {/* Inner polygon */}
          <polygon
            points={innerPoints}
            fill="none"
            stroke={color}
            strokeWidth={1}
            opacity={0.4}
          />

          {/* Center dot */}
          <circle
            cx={cx}
            cy={cy}
            r={tier === 4 ? 6 : 4}
            fill={color}
            opacity={tier === 0 ? 0.5 : 0.9}
          />

          {/* Shimmer overlay for Gold+ */}
          {tier >= 2 && (
            <polygon
              points={points}
              fill={`url(#${shimId})`}
              opacity={0.6}
            >
              {tier >= 2 && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`${-size} 0; ${size * 2} 0`}
                  dur={tier === 4 ? '1.8s' : '2.5s'}
                  repeatCount="indefinite"
                />
              )}
            </polygon>
          )}
        </g>

        {/* Tier label inside */}
        <text
          x={cx}
          y={cy + r + size * 0.12}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.07}
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
          opacity={0.85}
          letterSpacing="0.08em"
        >
          {name.toUpperCase()}
        </text>
      </svg>
    </div>
  )
}
