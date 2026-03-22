const askLLM = require("./llmClient");

/**
 * ExpertConsensusAgent — Deep Search & Expert Opinion Mode
 * 
 * This agent acts as a "Board of Experts" that deliberate on all pipeline findings
 * to reach a unified security consensus.
 */
class ExpertConsensusAgent {
    constructor() {
        this.name = "ExpertConsensusAgent";
    }

    async generateConsensus(pipelineReport) {
        if (!pipelineReport || !pipelineReport.agent_data) {
            throw new Error("Missing pipeline data for consensus analysis.");
        }

        const ad = pipelineReport.agent_data;
        const tokenId = pipelineReport.token_id;
        const tokenName = pipelineReport.token_name;

        // Extract individual expert perspectives
        const sentimentExpert = ad.sentiment?.ai_sentiment_summary || "No sentiment analysis available.";
        const riskExpert = ad.risk_score?.ai_risk_summary || "No risk assessment available.";
        const predictorExpert = ad.prediction?.ai_prediction_summary || "No predictive modeling available.";
        const alertExpert = ad.alert?.ai_alert_summary || "No alert processing available.";

        const primaryRisk = pipelineReport.primary_risk || "Unknown";
        const riskScore = pipelineReport.rug_risk_score || 0;
        const probability = pipelineReport.predicted_probability || 0;

        const prompt = `
🚨 DEEP SEARCH: EXPERT SECURITY CONSENSUS 🚨
Token: ${tokenName} (${tokenId})
Primary Risk Factor: ${primaryRisk}
Composite Risk Score: ${riskScore}/100
Rug Pull Probability: ${probability}%

BOARD OF EXPERTS PERSPECTIVES:

1. MARKET SENTIMENT EXPERT:
"${sentimentExpert}"

2. STRUCTURAL RISK EXPERT:
"${riskExpert}"

3. PREDICTIVE RISK MODELER:
"${predictorExpert}"

4. SECURITY ALERT ENGINE:
"${alertExpert}"

TASK:
You are the Moderator for this expert board. Deliberate on these findings.
1. Identify any CONFLICTS (e.g., high hype vs. high mint risk).
2. Resolve those conflicts based on investor safety.
3. Reach a UNIFIED expert verdict.

RETURN JSON:
{
  "consensus_verdict": "CRITICAL | DANGEROUS | CAUTION | STABLE",
  "conflict_analysis": "Specifically address contradictions between sentiment, scoring, and prediction.",
  "expert_deliberation": "A professional summary of the joint expert opinion (3-4 sentences).",
  "final_recommendation": "One specific, multi-step action plan for holders.",
  "confidence_rating": 0-100
}

RULES:
- Be extremely objective.
- If structural risk is high, sentiment hype should be considered a "trap."
- If data is missing (placeholder descriptions), penalize the confidence rating.
`;

        try {
            let response = await askLLM(prompt);
            response = response.replace(/```json/g, "").replace(/```/g, "").trim();
            const consensusData = JSON.parse(response);

            return {
                ...consensusData,
                status: "CONSENSUS_REACHED",
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error("[ExpertConsensus] Failed to reach consensus:", error.message);
            return {
                consensus_verdict: "UNKNOWN",
                conflict_analysis: "Consensus deliberation failed due to system error.",
                expert_deliberation: "The expert board was unable to reach a unified conclusion.",
                final_recommendation: "Hold for fresh manual review.",
                confidence_rating: 0,
                status: "CONSENSUS_ERROR"
            };
        }
    }
}

module.exports = ExpertConsensusAgent;
