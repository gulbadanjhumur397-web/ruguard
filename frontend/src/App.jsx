import { useState, useRef, useEffect } from 'react'
import Header from './components/Header'
import ChatMessage from './components/ChatMessage'
import ChatInput from './components/ChatInput'
import SuggestionChips from './components/SuggestionChips'

const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE || 'https://ruguard-production.up.railway.app')

function App() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('ruguard_chat')
    return saved ? JSON.parse(saved) : []
  })
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('ruguard_chat', JSON.stringify(messages))
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text) => {
    if (!text.trim()) return

    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })

      if (!response.ok) throw new Error(`Server returned ${response.status}`)
      
      const data = await response.json()
      
      setMessages(prev => [...prev, {
        role: data.role || 'assistant',
        content: data.content || data.reply || "Sorry, I couldn't process that request."
      }])
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
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-card-border">
                <span className="text-4xl text-black drop-shadow-sm">🛡️</span>
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
                    <div className="w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center border border-[#333333] animate-pulse">
                      <span className="text-sm">🛡️</span>
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
