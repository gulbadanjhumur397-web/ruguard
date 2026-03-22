const SentimentAgent = require("./SentimentAnalysisAgent");
async function test() {
  const agent = new SentimentAgent();
  const data = await agent.analyzeSentiment({ token_id: "0.0.3716059", name: "Dovu", symbol: "DOVU" });
  console.log("Returned dex_liquidity:", data.dex_liquidity);
}
test();
