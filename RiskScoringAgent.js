class RiskScoringAgent {
    /**
     * Fuses data from multiple agents into a professional security report.
     * 
     * @param {Object} input - Object containing { scanner, blockchain, sentiment }
     * @returns {Object} Professional security analysis JSON
     */
    calculateRisk({ scanner, blockchain, sentiment }) {
        if (!scanner || !blockchain || !sentiment) {
            throw new Error("Missing required input agents data: scanner, blockchain, and sentiment are required.");
        }

        const tokenId = scanner.token_id || "Unknown";
        console.log("Generating professional security audit for token:", tokenId);

        // 1. Core Risk Scoring
        const {
            mint_risk_score,
            admin_control_score,
            holder_concentration_score,
            treasury_dump_score,
            age_risk_score,
            activity_risk_score
        } = blockchain;

        const finalScoreRaw =
            (mint_risk_score * 0.25) +
            (admin_control_score * 0.20) +
            (holder_concentration_score * 0.20) +
            (treasury_dump_score * 0.15) +
            (age_risk_score * 0.10) +
            (activity_risk_score * 0.10);

        let finalScore = Math.max(0, Math.min(100, Math.round(finalScoreRaw)));

        // 2. Risk Level Classification
        let riskLevel = "LOW";
        if (finalScore >= 81) riskLevel = "CRITICAL";
        else if (finalScore >= 61) riskLevel = "HIGH";
        else if (finalScore >= 31) riskLevel = "MEDIUM";

        // 3. Primary Risk Factor & Details
        const factors = [
            { label: "Mint control risk", score: mint_risk_score, category: "MINT" },
            { label: "Admin control risk", score: admin_control_score, category: "ADMIN" },
            { label: "Holder concentration risk", score: holder_concentration_score, category: "HOLDER" },
            { label: "Treasury concentration risk", score: treasury_dump_score, category: "TREASURY" },
            { label: "Token age risk", score: age_risk_score, category: "AGE" },
            { label: "Activity risk", score: activity_risk_score, category: "ACTIVITY" },
            { label: "Community sentiment risk", score: sentiment.community_risk_index, category: "SENTIMENT" }
        ];
        const primaryFactorObj = factors.reduce((prev, curr) => (curr.score > prev.score) ? curr : prev);
        const primaryRiskFactor = primaryFactorObj.label;
        
        const risk_details_map = {
            "MINT": ["Supply key active", "Token minting possible", "Centralized control risk", "Check mint transaction history"],
            "ADMIN": ["Admin key present", "Contract potentially mutable", "Owner privilege escalation risk", "Monitor admin wallet"],
            "HOLDER": ["High whale concentration", "Price manipulation vulnerability", "Liquidity exit risk", "Check holder distribution"],
            "TREASURY": ["Large treasury reserves", "Potential for massive dumping", "Centralized supply control", "Monitor treasury movements"],
            "AGE": ["New token listing", "Unproven track record", "High early-stage risk", "Verification pending"],
            "ACTIVITY": ["Low transaction volume", "Stagnant activity levels", "Possible wash trading", "Inconsistent engagement"],
            "SENTIMENT": ["Negative community signals", "High FUD levels detected", "Manipulation indicators present", "Social health declining"]
        };
        const risk_details = risk_details_map[primaryFactorObj.category] || ["General security caution recommended"];

        // 4. Risk Flags & Recommendations
        const risk_flags = [];
        const recommendations = [];

        if (scanner.admin_key_exists) {
            risk_flags.push("ADMIN_KEY_PRESENT");
            recommendations.push("Monitor admin wallet transactions");
        }
        if (scanner.supply_key_exists) {
            risk_flags.push("MINT_AUTHORITY_EXISTS");
            recommendations.push("Verify mint history and supply ceiling");
        }
        if (scanner.top_holder_percentage > 40) {
            risk_flags.push("HIGH_HOLDER_CONCENTRATION");
            recommendations.push("Monitor whale wallets for sudden exits");
        }
        if (blockchain.treasury_dump_risk === "HIGH") {
            risk_flags.push("LARGE_TREASURY_RESERVE");
            recommendations.push("Watch treasury account for large outgoing transfers");
        }
        if (scanner.token_age_days < 7) {
            risk_flags.push("NEW_TOKEN_LISTING");
            recommendations.push("Exercise extreme caution with unaged projects");
        }
        if (sentiment.community_risk_index > 60) {
            risk_flags.push("NEGATIVE_COMMUNITY_SENTIMENT");
            recommendations.push("Investigate source of community FUD");
        }
        if (sentiment.dex_risk_level === "HIGH") {
            risk_flags.push("LOW_LIQUIDITY_WARNING");
            recommendations.push("Watch liquidity movements and pool depth");
        }

        if (recommendations.length === 0) {
            recommendations.push("Standard monitoring of contract activity");
        }

        // 5. Confidence Engine (New Weights)
        let confidence_score = 0;
        const data_sources_used = [];

        if (scanner) { confidence_score += 25; data_sources_used.push("scanner"); }
        if (blockchain) { confidence_score += 20; data_sources_used.push("blockchain"); }
        if (sentiment) { confidence_score += 15; data_sources_used.push("sentiment"); }
        if (sentiment.dex_listed) { confidence_score += 15; data_sources_used.push("dexscreener"); }
        if (sentiment.coingecko_data_available) { confidence_score += 10; data_sources_used.push("coingecko"); }
        if (scanner.transaction_count > 0) { confidence_score += 10; data_sources_used.push("transaction history"); }
        if (sentiment.github_stars > 0 || sentiment.developer_activity_risk !== "UNKNOWN") { 
            confidence_score += 5; 
            data_sources_used.push("external signals"); 
        }

        // 6. Trend Signal
        let trend = "STABLE";
        const txCount = scanner.transaction_count || 0;
        const recentTxCount = scanner.recent_transaction_count || 0;
        const liqRisk = sentiment.dex_risk_level;
        
        if (txCount > 0) {
            const activityRatio = recentTxCount / (txCount / (scanner.token_age_days || 1));
            if (activityRatio < 0.5 || liqRisk === "HIGH") trend = "DETERIORATING";
            else if (activityRatio > 1.5) trend = "IMPROVING";
        }

        // 7. Security Product Style Summary
        let summary = `Token shows ${riskLevel.toLowerCase()} security risk with a score of ${finalScore}. `;
        if (finalScore > 60) {
            summary += `The project exhibits significant ${primaryRiskFactor.toLowerCase()} due to centralized controls. `;
        } else if (finalScore > 30) {
            summary += `The project has moderate ${primaryRiskFactor.toLowerCase()} but liquidity remains ${liqRisk.toLowerCase()}. `;
        } else {
            summary += "The project appears healthy with stable metrics across all monitored vectors. ";
        }
        summary += recommendations.length > 0 ? "Monitoring is recommended for flagged areas." : "No immediate rug indicators detected.";

        // 8. Legacy Support & Verification
        const verification_sources = ["Hedera Mirror Node", "CoinGecko", "Dexscreener"];
        const ai_verification = "Blockchain data verified through Hedera Mirror Node APIs.";

        return {
            token_id: tokenId,
            rug_risk_score: finalScore,
            risk_level: riskLevel,
            confidence_score: confidence_score,
            primary_risk_factor: primaryRiskFactor,
            risk_details: risk_details,
            risk_flags: risk_flags,
            recommendations: recommendations,
            trend: trend,
            verification_sources: verification_sources,
            ai_verification: ai_verification,
            data_sources_used: data_sources_used,
            summary: summary
        };
    }
}

module.exports = RiskScoringAgent;
