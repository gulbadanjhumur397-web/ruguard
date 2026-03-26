"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sentimentAction = void 0;
const path_1 = __importDefault(require("path"));
const SentimentAnalysisAgent = require(path_1.default.resolve(process.cwd(), "SentimentAnalysisAgent"));
const SharedCache_1 = require("./SharedCache");
exports.sentimentAction = {
    name: "FETCH_TOKEN_SENTIMENT",
    similes: ["CHECK_SENTIMENT", "GET_SOCIALS", "CHECK_LIQUIDITY", "FETCH_COMMUNITY_DATA", "GET_GITHUB"],
    description: "Fetches external community sentiment, DEX liquidity, CoinGecko financial fundamentals, and GitHub developer activity for a token.",
    validate: async (runtime, message) => true,
    handler: async (runtime, message, state, options, callback) => {
        const text = message.content?.text || "";
        const match = text.match(/0\.0\.\d+/);
        const tokenId = match ? match[0] : null;
        let symbolMatch = "UNKNOWN";
        if (tokenId && SharedCache_1.ToolDataCache[tokenId]?.scanner?.name) {
            symbolMatch = SharedCache_1.ToolDataCache[tokenId].scanner.name.toUpperCase();
        }
        else {
            const symMatch = text.match(/\b[A-Z]{3,10}\b/);
            if (symMatch)
                symbolMatch = symMatch[0];
        }
        try {
            if (callback)
                callback({ text: `*Aggregating Social, Volume, and Liquidity Sentiment for ${symbolMatch}...*` });
            const sentAgent = new SentimentAnalysisAgent();
            await Promise.all([
                sentAgent.fetchCoinGeckoData(symbolMatch),
                sentAgent.fetchDexData(symbolMatch),
                sentAgent.fetchGitHubData("https://github.com/hasgraph/hedera-services")
            ]);
            const scannerMock = (tokenId && SharedCache_1.ToolDataCache[tokenId]?.scanner) ? SharedCache_1.ToolDataCache[tokenId].scanner : { token_id: tokenId, name: symbolMatch, symbol: symbolMatch };
            const sentimentData = await sentAgent.analyzeSentiment(scannerMock);
            if (tokenId) {
                SharedCache_1.ToolDataCache[tokenId] = {
                    ...SharedCache_1.ToolDataCache[tokenId],
                    sentiment: sentimentData
                };
            }
            const response = `Sentiment & Fundamentals for ${symbolMatch}:
- Social Security Rating: ${sentimentData.sentiment_security_rating}
- DEX Liquidity: $${sentimentData.liquidity_usd}
- 24h Volume: $${sentimentData.volume_24h}
- Dev Activity Risk: ${sentimentData.developer_activity_risk}
- AI Summary: ${sentimentData.ai_sentiment_summary}`;
            if (callback)
                callback({ text: response });
            return true;
        }
        catch (err) {
            if (callback)
                callback({ text: `Sentiment engine failed: ${err.message}` });
            return false;
        }
    },
    examples: []
};
