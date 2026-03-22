const askLLM = require("./llmClient");

class RiskScoringAgent {
    /**
     * Fuses data from multiple agents into a professional security report.
     * 
     * @param {Object} input - Object containing { scanner, blockchain, sentiment }
     * @returns {Object} Professional security analysis JSON
     */
    async calculateRisk({ scanner, blockchain, sentiment }) {
        if (!scanner || !blockchain || !sentiment) {
            throw new Error("Missing required input agents data: scanner, blockchain, and sentiment are required.");
        }

        const deterministic = this._calculateDeterministic(scanner, blockchain, sentiment);

        let analysis_mode = "HYBRID_AI";
        let ai_risk_summary = "";
        let ai_confidence_reasoning = "";
        let ai_recommendations = [];

        try {
            const prompt = `You are a blockchain security risk analyst.
Explain why this token has this risk score.
Use only provided data. Do not invent information.
Limit to 2-3 sentences.

Data:
Score: ${deterministic.final_risk_score}
Level: ${deterministic.risk_level}
Primary Risk: ${deterministic.primary_risk_factor}
Top Risks: ${deterministic.top_risk_factors.join(", ")}
Blockchain Weight: ${deterministic.risk_breakdown.blockchain_weight}%
Sentiment Weight: ${deterministic.risk_breakdown.sentiment_weight}%
Confidence: ${deterministic.confidence_tier}

Return strictly JSON with:
{
  "ai_risk_summary": "Professional security explanation. Why it has this score, what drives it, structural or sentiment driven. 2-3 sentences.",
  "ai_confidence_reasoning": "Reasoning why confidence is high or low.",
  "ai_recommendations": ["Rec 1", "Rec 2", "Rec 3"]
}`;

            let rawResponse = await askLLM(prompt);
            rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            const aiData = JSON.parse(rawResponse);

            ai_risk_summary = aiData.ai_risk_summary;
            ai_confidence_reasoning = aiData.ai_confidence_reasoning;
            ai_recommendations = Array.isArray(aiData.ai_recommendations) 
                ? aiData.ai_recommendations.slice(0, 3) 
                : ["Monitor token activity"];
                
        } catch (error) {
            analysis_mode = "DETERMINISTIC_ONLY";
            ai_risk_summary = "AI analysis unavailable – deterministic risk fusion applied.";
            ai_confidence_reasoning = "Confidence derived from deterministic scoring.";
            ai_recommendations = ["Monitor token activity"];
        }

        return {
            scoring_version: deterministic.scoring_version,
            final_risk_score: deterministic.final_risk_score,
            risk_level: deterministic.risk_level,
            primary_risk_factor: deterministic.primary_risk_factor,
            top_risk_factors: deterministic.top_risk_factors,
            risk_breakdown: deterministic.risk_breakdown,
            risk_distribution: deterministic.risk_distribution,
            risk_velocity: deterministic.risk_velocity,
            confidence_score: deterministic.confidence_score,
            confidence_tier: deterministic.confidence_tier,
            analysis_mode,
            ai_risk_summary,
            ai_confidence_reasoning,
            ai_recommendations,
            // Backward compatibility
            rug_risk_score: deterministic.final_risk_score,
            risk_flags: deterministic.top_risk_factors,
            recommendations: ai_recommendations
        };
    }

    _calculateDeterministic(scanner, blockchain, sentiment) {
        // 1. Core Risk Scoring
        const {
            mint_risk_score = 0,
            admin_control_score = 0,
            holder_concentration_score = 0,
            treasury_dump_score = 0,
            age_risk_score = 0,
            activity_risk_score = 0
        } = blockchain;

        const sentimentScore = sentiment.community_risk_index || 0;
        const finalScoreRaw =
            (mint_risk_score * 0.25) +
            (admin_control_score * 0.20) +
            (holder_concentration_score * 0.20) +
            (treasury_dump_score * 0.15) +
            (age_risk_score * 0.10) +
            (activity_risk_score * 0.10);

        let finalScore = Math.max(0, Math.min(100, Math.round(finalScoreRaw)));

        // 2. Professional Risk Level Mapping
        let riskLevel = "VERY_LOW";
        if (finalScore >= 81) riskLevel = "VERY_HIGH";
        else if (finalScore >= 66) riskLevel = "HIGH";
        else if (finalScore >= 46) riskLevel = "MEDIUM";
        else if (finalScore >= 26) riskLevel = "LOW";

        // 3. Risk Weight Intelligence
        let blockchain_weight = 70;
        let sentiment_weight = 30;
        
        const isBlockchainHigh = finalScore > 65;
        const isSentimentUnstable = sentimentScore > 50 && sentimentScore <= 70;
        const isSentimentDominant = sentimentScore > 70;

        if (isBlockchainHigh) {
            blockchain_weight = 60;
            sentiment_weight = 40;
        } else if (isSentimentDominant) {
            blockchain_weight = 40;
            sentiment_weight = 60;
        } else if (isSentimentUnstable) {
            blockchain_weight = 50;
            sentiment_weight = 50;
        }

        // 4 & 5. Primary Risk Factor & Top Contributors
        const liqRiskScore = sentiment.dex_risk_level === "HIGH" ? 90 : (sentiment.dex_risk_level === "MEDIUM" ? 50 : 10);
        const devRiskScore = sentiment.developer_activity_risk === "HIGH" ? 80 : (sentiment.developer_activity_risk === "MEDIUM" ? 40 : 10);

        const factors = [
            { label: "Centralized mint authority", score: mint_risk_score },
            { label: "Admin control risk", score: admin_control_score },
            { label: "Holder concentration risk", score: holder_concentration_score },
            { label: "Treasury dump risk", score: treasury_dump_score },
            { label: "Low liquidity depth", score: liqRiskScore },
            { label: "Negative community sentiment", score: sentimentScore },
            { label: "Developer activity risk", score: devRiskScore }
        ];

        factors.sort((a, b) => b.score - a.score);

        const primary_risk_factor = factors[0].score > 20 ? factors[0].label : "Minimal structural risk";
        const top_risk_factors = factors.slice(0, 3).map(f => f.label);

        // 6. Confidence Score Engine
        let confidence = 50;
        if (scanner && scanner.token_id) confidence += 10;
        if (sentiment && sentiment.community_risk_index !== undefined) confidence += 10;
        if (sentiment && sentiment.dex_listed) confidence += 10;
        if (sentiment && sentiment.developer_activity_risk && sentiment.developer_activity_risk !== "UNKNOWN") confidence += 10;
        
        const confidence_score = Math.max(0, Math.min(100, confidence));

        // 7. Confidence Tier
        let confidence_tier = "LOW";
        if (confidence_score >= 80) confidence_tier = "HIGH";
        else if (confidence_score >= 60) confidence_tier = "MEDIUM";

        // NEW: scoring version tracking
        const scoring_version = "2.1";

        // NEW: risk distribution exposure
        const risk_distribution = {
            blockchain: blockchain_weight,
            sentiment: sentiment_weight
        };

        // NEW: risk velocity indicator
        let risk_velocity = "STABLE";
        if (sentimentScore > 70 && sentiment.dex_risk_level === "HIGH" && sentiment.developer_activity_risk === "UNKNOWN") {
            risk_velocity = "INCREASING";
        } else if (sentimentScore < 40 && sentiment.dex_risk_level !== "HIGH") {
            risk_velocity = "DECREASING";
        }

        return {
            scoring_version,
            final_risk_score: finalScore,
            risk_level: riskLevel,
            primary_risk_factor,
            top_risk_factors,
            risk_breakdown: {
                blockchain_weight,
                sentiment_weight
            },
            risk_distribution,
            risk_velocity,
            confidence_score,
            confidence_tier
        };
    }
}

module.exports = RiskScoringAgent;
