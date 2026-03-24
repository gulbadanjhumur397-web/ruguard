import { useState, useRef, useEffect } from 'react'
import Header from './components/Header'
import ChatMessage from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import SuggestionChips from './components/SuggestionChips'

const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE || 'https://ruguard-production-e5cd.up.railway.app')

function App() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('ruguard_chat')
    return saved ? JSON.parse(saved) : []
  })
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem('ruguard_session')
    if (saved) return saved
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem('ruguard_session', newId)
    return newId
  })
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('ruguard_chat', JSON.stringify(messages))
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Extract Hedera token IDs or EVM addresses from text
  const extractTokenId = (text) => {
    const standardMatch = text.match(/\b(0\.0\.\d+)\b/)
    if (standardMatch) return standardMatch[1]
    
    const evmMatch = text.match(/0x[a-fA-F0-9]{40}\b/)
    if (evmMatch) {
      const hexStr = evmMatch[0].replace('0x', '')
      return `0.0.${parseInt(hexStr, 16)}`
    }
    return null
  }

  // Format analysis report as markdown
  const formatReport = (data) => {
    const name = data.token_name || data.agent_data?.scanner?.name || 'Unknown'
    const symbol = data.agent_data?.scanner?.symbol || ''
    const risk = data.rug_risk_score ?? data.risk_score ?? 'N/A'
    const level = data.risk_level || 'N/A'
    const prob = data.predicted_probability ?? data.rug_probability ?? 'N/A'
    const alert = data.alert_level || 'N/A'
    const posture = data.security_posture || 'N/A'
    const confidence = data.confidence ?? 'N/A'
    const primaryRisk = data.primary_risk || 'None detected'
    const warning = data.primary_warning || 'No critical warnings'

    let md = `## 🛡️ RugGuard Analysis: **${name}** (${symbol})\n\n`
    md += `| Metric | Value |\n|---|---|\n`
    md += `| **Token ID** | \`${data.token_id}\` |\n`
    md += `| **Risk Score** | **${risk}/100** (${level}) |\n`
    md += `| **Rug Probability** | **${prob}%** |\n`
    md += `| **Alert Level** | ${alert} |\n`
    md += `| **Security Posture** | ${posture} |\n`
    md += `| **AI Confidence** | ${confidence}% |\n\n`
    md += `**Primary Risk:** ${primaryRisk}\n\n`
    md += `**⚠️ Warning:** ${warning}\n\n`

    // Recommendations
    const recs = data.recommendations || data.agent_data?.alert?.recommendations || []
    if (recs.length > 0) {
      md += `### 📋 Recommendations\n`
      recs.forEach(r => { md += `- ${r}\n` })
      md += '\n'
    }

    // Key triggers
    const triggers = data.key_triggers || data.agent_data?.prediction?.key_triggers || []
    if (triggers.length > 0) {
      md += `### 🚨 Key Risk Triggers\n`
      triggers.forEach(t => { md += `- ${t}\n` })
    }

    return md
  }

  const handleSend = async (text) => {
    if (!text.trim()) return

    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      // Try /chat first
      let response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId })
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.content || data.reply || "Sorry, I couldn't process that request."
        }])
        return
      }

      // Fallback: extract token ID and call /analyze
      const tokenId = extractTokenId(text)
      if (tokenId) {
        response = await fetch(`${API_BASE}/analyze/${tokenId}`)
        if (!response.ok) throw new Error(`Analysis failed (${response.status})`)
        const report = await response.json()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: formatReport(report)
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Please include a Hedera token ID (e.g. `0.0.731861`) in your message so I can analyze it. Example: **Analyze 0.0.731861**"
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ **Connection Error**: ${err.message}. Please check if the agent is online.`
      }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    if (confirm('Clear entire chat history?')) {
      setMessages([])
      localStorage.removeItem('ruguard_chat')
      localStorage.removeItem('ruguard_session')
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface overflow-hidden">
      <Header lastScan={messages.length > 0 ? "Agent Active" : "Waiting for input..."} />
      
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 pt-24 pb-6 overflow-hidden z-10">
        
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto chat-scrollbar rounded-2xl p-4 glass mb-4 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 fade-in">
              <div className="w-24 h-24 rounded-full bg-[#1A1A1A] flex items-center justify-center mb-6 shadow-lg border border-[#333] overflow-hidden group hover:scale-105 transition-transform duration-300">
                <img src="/logo.png" alt="RugGuard AI Logo" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-4xl text-black">🛡️</span>'; }} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">RugGuard AI</h2>
              <p className="text-slate-400 mb-8 max-w-sm">
                Hello! I'm your autonomous security agent on Hedera. Enter a token ID or ask anything.
              </p>
              <SuggestionChips onSelect={handleSend} />
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
              ))}
              
              {loading && (
                <div className="flex w-full mb-4 justify-start">
                  <div className="flex-shrink-0 mr-3 mt-1">
                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center border border-[#333] overflow-hidden animate-pulse">
                      <img src="/logo.png" alt="Loading" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-sm">🛡️</span>'; }} />
                    </div>
                  </div>
                  <div className="px-5 py-4 rounded-2xl bg-[#111111] border border-card-border rounded-tl-sm w-24">
                    <div className="flex space-x-1.5 justify-center items-center h-full">
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 relative">
          {messages.length > 0 && (
            <button 
              onClick={clearChat}
              className="absolute -top-8 right-2 text-xs text-slate-500 hover:text-white transition-colors"
            >
              Clear Chat
            </button>
          )}
          <ChatInput onSend={handleSend} loading={loading} />
          <p className="text-center text-[10px] text-slate-500 mt-2">
            RugGuard AI can make mistakes. Verify critical security decisions.
          </p>
        </div>
      </main>
    </div>
  )
}

export default App
