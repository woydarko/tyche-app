const steps = [
  {
    number: '01',
    title: 'Connect & Predict',
    description:
      'Connect your wallet to any Somnia prediction market. Every prediction you make is recorded on-chain with full transparency.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Earn Your Score',
    description:
      'Tyche automatically computes your Accuracy, Alpha, Calibration, Consistency, and Composite scores as markets resolve. All on-chain, no manual claims needed.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Build Your Identity',
    description:
      'Climb from Bronze to Oracle tier. Earn soulbound badges for your achievements. Your reputation follows your wallet forever — verifiable by anyone.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
]

export default function HowItWorks() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            How Tyche Works
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            A fully on-chain reputation system for prediction markets — transparent, composable, and permissionless.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, idx) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[calc(50%+3rem)] right-0 h-px bg-gradient-to-r from-purple-500/50 to-transparent" />
              )}

              <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 h-full">
                {/* Step number + icon */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-purple-950 border border-purple-500/30 text-purple-400">
                    {step.icon}
                  </div>
                  <span className="text-4xl font-black text-gray-800 mt-0.5">{step.number}</span>
                </div>

                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Score dimensions */}
        <div className="mt-16 rounded-xl border border-gray-800 bg-gray-900/50 p-8">
          <h3 className="text-center text-lg font-semibold text-white mb-8">5 Score Dimensions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { name: 'Accuracy', desc: 'Win rate & prediction correctness', color: 'text-blue-400' },
              { name: 'Alpha', desc: 'Edge vs market consensus', color: 'text-green-400' },
              { name: 'Calibration', desc: 'Confidence vs outcome alignment', color: 'text-yellow-400' },
              { name: 'Consistency', desc: 'Sustained performance over time', color: 'text-orange-400' },
              { name: 'Composite', desc: 'Overall Tyche reputation score', color: 'text-purple-400' },
            ].map((dim) => (
              <div key={dim.name} className="text-center p-4 rounded-lg bg-gray-800/50">
                <div className={`text-lg font-bold ${dim.color} mb-1`}>{dim.name}</div>
                <div className="text-xs text-gray-500 leading-snug">{dim.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
