const { Runtime } = require("./eliza-runtime"); // Wait, it's a class
// I'll just write a script that instantiates TokenScanner and SentimentAgent directly exactly like eliza-runtime.ts does.
const TokenScanner = require("./TokenScannerAgent");
const SentimentAgent = require("./SentimentAnalysisAgent");
async function run() {
  const scanner = new TokenScanner();
  const scannerData = await scanner.scan("0.0.3716059");
  console.log("Scanner Data:", scannerData.name, scannerData.symbol);
  
  const sentAgent = new SentimentAgent();
  const sentimentData = await sentAgent.analyzeSentiment(scannerData);
  console.log("Sentiment Dex Liquidity:", sentimentData.dex_liquidity);
}
run();
