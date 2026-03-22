const SentimentAgent = require("./SentimentAnalysisAgent");
async function test() {
  const agent = new SentimentAgent();
  const dexData = await agent.fetchDexData("DOVU");
  console.log("fetchDexData Returns:", dexData);
  const saucerData = await agent.fetchSaucerSwapData("0.0.3716059");
  console.log("fetchSaucerSwapData Returns:", saucerData);
}
test();
