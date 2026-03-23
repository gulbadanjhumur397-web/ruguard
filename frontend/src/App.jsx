import { useState } from 'react'
import Header from './components/Header'
import HeroInput from './components/HeroInput'
import ResultsDashboard from './components/ResultsDashboard'
import Footer from './components/Footer'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://ruguard-production.up.railway.app'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [lastScan, setLastScan] = useState(null)

  const analyzeToken = async (tokenId) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_BASE}/analyze/${tokenId}`)
      if (!response.ok) throw new Error(`Server returned ${response.status}`)
      const data = await response.json()
      setResult(data)
      setLastScan(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err.message || 'Failed to analyze token. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header lastScan={lastScan} />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <HeroInput onAnalyze={analyzeToken} loading={loading} />
        
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {result && !loading && <ResultsDashboard data={result} />}
      </main>

      <Footer />
    </div>
  )
}

function LoadingState() {
  return (
    <div className="mt-12 flex flex-col items-center gap-4 animate-pulse">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-white/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-white animate-spin" />
        <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-gray-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>
      <p className="text-white text-lg font-medium">Analyzing token...</p>
      <p className="text-slate-400 text-sm">Running full security scan across 5 intelligence sources</p>
      <div className="flex gap-2 mt-2">
        {['Scanner', 'Sentiment', 'Risk', 'Predictor', 'Alert'].map((agent, i) => (
          <span key={agent} className="text-xs px-3 py-1 rounded-full glass text-slate-300 shimmer" style={{ animationDelay: `${i * 0.2}s` }}>
            {agent}
          </span>
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="mt-12 max-w-lg mx-auto p-6 rounded-2xl border border-white/30 bg-[#111111]">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">⚠️</span>
        <h3 className="text-white font-semibold text-lg">Analysis Failed</h3>
      </div>
      <p className="text-slate-300 text-sm">{message}</p>
      <p className="text-slate-500 text-xs mt-3">Check the token ID format (e.g. 0.0.731861) and try again.</p>
    </div>
  )
}

export default App
