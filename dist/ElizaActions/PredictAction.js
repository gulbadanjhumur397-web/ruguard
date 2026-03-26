"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictRugPullAction = void 0;
const path_1 = __importDefault(require("path"));
const RiskScoringAgent = require(path_1.default.resolve(process.cwd(), "RiskScoringAgent"));
const RugPredictorAgent = require(path_1.default.resolve(process.cwd(), "RugPredictorAgent"));
const AlertAgent = require(path_1.default.resolve(process.cwd(), "AlertAgent"));
const openconvai_client_1 = require("../openconvai-client");
const SharedCache_1 = require("./SharedCache");
exports.predictRugPullAction = {
    name: "PREDICT_RUG_PULL",
    similes: ["GENERATE_RISK_REPORT", "CALCULATE_RUG_RISK", "IS_IT_A_SCAM", "SHOULD_I_BUY"],
    description: "Calculates the final 0-100 Rug Risk Score, generates hypothetical scenarios, and issues a final security alert. REQUIRES On-chain scanner data and Sentiment data in cache first.",
    validate: async (runtime, message) => true,
    handler: async (runtime, message, state, options, callback) => {
        const text = message.content?.text || "";
        const match = text.match(/0\.0\.\d+/);
        if (!match) {
            if (callback)
                callback({ text: "Please specify a token ID to predict risk for." });
            return false;
        }
        const tokenId = match[0];
        const cached = SharedCache_1.ToolDataCache[tokenId];
        if (!cached || !cached.scanner || !cached.blockchain) {
            if (callback)
                callback({ text: "I need to run the On-Chain Scanner first to get the blueprint. Call SCAN_TOKEN_ONCHAIN before predicting rug risks." });
            return false; /* Force Eliza to realize it needs the scanner tool! */
        }
        try {
            if (callback)
                callback({ text: `*Fusing data streams for ${tokenId}. Forecasting rug probability...*` });
            const riskAgent = new RiskScoringAgent();
            const riskScore = await riskAgent.calculateRisk({
                scanner: cached.scanner,
                blockchain: cached.blockchain,
                sentiment: cached.sentiment || {}
            });
            const predAgent = new RugPredictorAgent();
            const prediction = await predAgent.predictRisk({
                scanner: cached.scanner,
                blockchain_risk: cached.blockchain,
                sentiment: cached.sentiment || {},
                risk_score: riskScore
            });
            const alertAgent = new AlertAgent();
            const alert = await alertAgent.generateAlert({
                risk_score: riskScore,
                prediction: prediction
            });
            if (prediction.rug_probability > 75) {
                const criticalIssue = cached.blockchain.mint_risk_level === "CRITICAL" ? "Centralized Minting Authority Detected" : alert.security_posture;
                if (openconvai_client_1.OpenConvAIClient.instance) {
                    await openconvai_client_1.OpenConvAIClient.instance.broadcastGlobalAlert(tokenId, prediction.rug_probability, criticalIssue);
                }
            }
            const response = `🚨 FINAL SECURITY POSTURE: ${cached.scanner.name} 🚨
- Rug Risk Score: ${riskScore.rug_risk_score}/100
- Prediction: ${prediction.rug_probability}% (${prediction.prediction_strength})
- AI Assessment: ${riskScore.ai_risk_summary}
- Simulation: ${prediction.ai_risk_scenario}
- Recommendation: ${alert.recommendations[0]}`;
            if (callback)
                callback({ text: response });
            return true;
        }
        catch (err) {
            if (callback)
                callback({ text: `Prediction core failed: ${err.message}` });
            return false;
        }
    },
    examples: []
};
