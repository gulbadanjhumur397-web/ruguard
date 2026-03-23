import RiskOverview from './RiskOverview'
import SentimentCard from './SentimentCard'
import MarketCard from './MarketCard'
import Recommendations from './Recommendations'

export default function ResultsDashboard({ data }) {
  return (
    <div className="mt-8 space-y-6 animate-[fadeIn_0.5s_ease-out]">
      {/* Token header */}
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-white">
          {data.token_name || 'Unknown Token'}
          <span className="text-sm text-slate-400 ml-2 font-normal">({data.token_id})</span>
        </h2>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <RiskOverview data={data} />
        <SentimentCard data={data} />
        <MarketCard data={data} />
      </div>

      {/* Recommendations */}
      <Recommendations data={data} />
    </div>
  )
}
