export default function Header({ lastScan }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-card-border bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center mr-3 shadow-md overflow-hidden border border-[#333]">
              <img src="/logo.png" alt="RugGuard AI" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-lg">🛡️</span>'; }} />
            </div>
          <span className="text-xl font-bold text-white tracking-tight">
            RugGuard <span className="text-slate-500 font-medium">AI</span>
          </span>
        </div>

        {/* Subtitle */}
        <p className="hidden md:block text-sm text-slate-500 tracking-wide font-medium">
          Autonomous Web3 Intelligence
        </p>

        {/* Status */}
        <div className="flex items-center gap-2">
          {lastScan && (
            <span className="hidden sm:inline text-xs text-slate-500 font-medium mr-1">
              {lastScan !== "Agent Active" ? lastScan : ""}
            </span>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111111] border border-[#333333]">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-semibold text-slate-200">
              {lastScan === "Agent Active" ? "Agent Active" : "Online"}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
