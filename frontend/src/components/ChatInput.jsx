import { useState, useRef, useEffect } from 'react'

export default function ChatInput({ onSend, loading }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const handleSend = () => {
    if (!text.trim() || loading) return
    onSend(text.trim())
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [text])

  return (
    <div className="relative flex items-end w-full glass rounded-2xl p-2 shadow-2xl">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Analyze a token (e.g. 0.0.731861) or ask a question..."
        className="w-full max-h-[150px] bg-transparent text-slate-200 text-sm px-4 py-3 outline-none resize-none chat-scrollbar"
        rows={1}
        disabled={loading}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || loading}
        className={`flex-shrink-0 ml-2 mb-1 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          text.trim() && !loading 
            ? 'bg-white text-black hover:bg-gray-200 shadow-sm' 
            : 'bg-[#111111] text-slate-600 border border-[#333333] cursor-not-allowed'
        }`}
      >
        <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  )
}
