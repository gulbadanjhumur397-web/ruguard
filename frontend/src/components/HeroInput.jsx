import { useState } from 'react'

export default function HeroInput({ onAnalyze, loading }) {
  const [tokenId, setTokenId] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = tokenId.trim()
    if (trimmed && /^0\.0\.\d+$/.test(trimmed)) {
      onAnalyze(trimmed)
    }
  }

  const quickTokens = [
    { name: 'SAUCE', id: '0.0.731861' },
    { name: 'KARATE', id: '0.0.2283230' },
    { name: 'DOVU', id: '0.0.3716059' },
    { name: 'PACK', id: '0.0.786931' },
  ]

  return (
    <section className="text-center mb-12">
      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">
        <span className="text-white tracking-tight">
          Token Security Scanner
        </span>
      </h1>
      <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
        AI-powered autonomous rug detection using 5 intelligence agents on Hedera
      </p>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Enter Hedera Token ID (e.g. 0.0.731861)"
            disabled={loading}
            className="w-full px-5 py-3.5 rounded-xl bg-surface-light border border-card-border text-white placeholder-slate-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/30 transition-all text-base disabled:opacity-50"
          />
          {tokenId && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(tokenId)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors text-sm"
              title="Copy token ID"
            >
              📋
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !tokenId.trim()}
          className="px-8 py-3.5 rounded-xl font-semibold text-black bg-white hover:bg-gray-200 shadow-lg shadow-white/10 hover:shadow-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 whitespace-nowrap"
        >
          {loading ? '⏳ Analyzing...' : '🔍 Analyze Token'}
        </button>
      </form>

      {/* Quick tokens */}
      <div className="flex flex-wrap justify-center gap-2">
        <span className="text-xs text-slate-500 mt-1">Quick scan:</span>
        {quickTokens.map(t => (
          <button
            key={t.id}
            onClick={() => { setTokenId(t.id); onAnalyze(t.id) }}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-full border border-card-border text-slate-400 hover:text-white hover:border-white/40 transition-all disabled:opacity-40"
          >
            {t.name} ({t.id})
          </button>
        ))}
      </div>
    </section>
  )
}
