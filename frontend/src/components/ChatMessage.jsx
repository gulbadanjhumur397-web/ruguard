import ReactMarkdown from 'react-markdown'
import { useState } from 'react'

export default function ChatMessage({ role, content }) {
  const isAgent = role === 'assistant'
  const [copied, setCopied] = useState(false)

  const copyText = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex w-full mb-6 ${isAgent ? 'justify-start' : 'justify-end'}`}>
      {isAgent && (
        <div className="flex-shrink-0 mr-3 mt-1">
          <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0 border border-[#333] shadow-sm overflow-hidden">
            <img src="/logo.png" alt="Agent" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-sm">🛡️</span>'; }} />
          </div>
        </div>
      )}

      <div className={`relative max-w-[85%] sm:max-w-[75%] px-5 py-4 rounded-2xl ${
        isAgent 
          ? 'bg-[#111111] border border-[#333333] text-slate-200 rounded-tl-sm shadow-sm' 
          : 'bg-white text-black rounded-tr-sm shadow-sm'
      }`}>
        {isAgent ? (
          <div className="markdown-body text-sm">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        )}

        {isAgent && (
          <button 
            onClick={copyText}
            className="absolute -right-8 top-2 p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 md:opacity-100"
            title="Copy message"
          >
            {copied ? (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
