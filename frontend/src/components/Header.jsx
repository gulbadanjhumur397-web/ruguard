export default function Header({ lastScan }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-card-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-lg">
            🛡️
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            RugGuard
          </span>
        </div>

        {/* Subtitle */}
        <p className="hidden md:block text-sm text-slate-400 tracking-wide">
          Autonomous Rug Detection Agent on Hedera
        </p>

        {/* Status */}
        <div className="flex items-center gap-2">
          {lastScan && (
            <span className="hidden sm:inline text-xs text-slate-500">
              Last scan: {lastScan}
            </span>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-medium text-white">Agent Online</span>
          </div>
        </div>
      </div>
    </header>
  )
}
