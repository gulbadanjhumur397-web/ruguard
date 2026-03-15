/**
 * BlockchainRiskAnalysisAgent
 * Framework: Eliza
 * Language: JavaScript (Node.js)
 *
 * Purpose: Analyzes token data from a TokenScannerAgent and detects
 * rug-pull risk signals based on predefined rules. 
 * Expected to be used as a standalone module or integrated into Eliza framework.
 */

class BlockchainRiskAnalysisAgent {
    constructor() {
        this.name = "BlockchainRiskAnalysisAgent";
        this.description = "Agent responsible for analyzing structured token data to detect rug-pull risks.";

        // Defined risk scores mapping
        this.SCORES = {
            VERY_HIGH: 95,
            HIGH: 80,
            MEDIUM: 50,
            LOW: 20,
            VERY_LOW: 10
        };
    }

    /**
     * Determines the risk profile of a token based on scanner data.
     * @param {Object} scannerData - The structured JSON token data
     * @returns {Object} Final security risk analysis JSON output
     */
    analyzeTokenRisk(scannerData) {
        if (!scannerData || typeof scannerData !== 'object') {
            throw new Error("Invalid or missing scanner data.");
        }

        // 9️⃣ Add Logging
        console.log(`Running risk analysis for token: ${scannerData.token_id || "UNKNOWN"}`);

        // 8️⃣ Input Validation
        if (typeof scannerData.total_supply !== 'number') {
            throw new Error("Validation Error: total_supply must be a number.");
        }
        if (typeof scannerData.treasury_balance !== 'number') {
            throw new Error("Validation Error: treasury_balance must be a number.");
        }
        if (scannerData.top_holder_percentage === undefined || scannerData.top_holder_percentage === null) {
            throw new Error("Validation Error: top_holder_percentage is missing or invalid.");
        }

        // 6️⃣ Mint Control Risk
        // If supply_key_exists == true -> HIGH, Else -> LOW
        const mint_risk_level = scannerData.supply_key_exists === true ? "HIGH" : "LOW";
        const mint_risk_score = this.SCORES[mint_risk_level];

        // 7️⃣ Admin Control Risk
        // If admin_key_exists == true -> HIGH, Else -> LOW
        const admin_control_risk = scannerData.admin_key_exists === true ? "HIGH" : "LOW";
        const admin_control_score = this.SCORES[admin_control_risk];

        // 2️⃣ Improved Holder Concentration Analysis
        let holder_concentration_risk = "LOW";

        // Convert to percentage if it's a decimal (e.g. 0.19 -> 19)
        const topHolderPct = scannerData.top_holder_percentage <= 1 ? scannerData.top_holder_percentage * 100 : scannerData.top_holder_percentage;
        const top5HolderPct = scannerData.top_5_holder_percentage
            ? (scannerData.top_5_holder_percentage <= 1 ? scannerData.top_5_holder_percentage * 100 : scannerData.top_5_holder_percentage)
            : 0;

        // Rules: > 50% top holder or > 70% top 5 -> HIGH
        // 20-50% top holder or 40-70% top 5 -> MEDIUM
        if (topHolderPct > 50 || top5HolderPct > 70) {
            holder_concentration_risk = "HIGH";
        } else if ((topHolderPct >= 20 && topHolderPct <= 50) || (top5HolderPct >= 40 && top5HolderPct <= 70)) {
            holder_concentration_risk = "MEDIUM";
        }
        const holder_concentration_score = this.SCORES[holder_concentration_risk];

        // 3️⃣ Improved Treasury Dump Risk
        let treasury_dump_risk = "LOW";
        let treasury_percentage = 0;

        if (scannerData.total_supply > 0) {
            treasury_percentage = (scannerData.treasury_balance / scannerData.total_supply) * 100;
        }

        // 9️⃣ Add Logging
        console.log(`Treasury percentage: ${treasury_percentage.toFixed(2)}%`);

        if (treasury_percentage > 50) {
            treasury_dump_risk = "HIGH";
        } else if (treasury_percentage >= 20 && treasury_percentage <= 50) {
            treasury_dump_risk = "MEDIUM";
        }
        const treasury_dump_score = this.SCORES[treasury_dump_risk];

        // 4️⃣ Improved Token Age Risk
        let age_risk_level = "LOW";
        if (scannerData.token_age_days < 1) {
            age_risk_level = "VERY_HIGH";
        } else if (scannerData.token_age_days < 7) {
            age_risk_level = "HIGH";
        } else if (scannerData.token_age_days < 30) {
            age_risk_level = "MEDIUM";
        } else if (scannerData.token_age_days < 180) {
            age_risk_level = "LOW";
        } else if (scannerData.token_age_days >= 180) {
            age_risk_level = "VERY_LOW";
        }
        const age_risk_score = this.SCORES[age_risk_level];

        // 5️⃣ Improved Activity Risk
        let activity_risk_level = "LOW";
        let isLastTxOld = false;

        if (scannerData.last_transaction_timestamp) {
            const lastTxDate = new Date(scannerData.last_transaction_timestamp);
            const now = new Date();
            const daysSinceLastTx = (now - lastTxDate) / (1000 * 60 * 60 * 24);
            if (daysSinceLastTx > 30) {
                isLastTxOld = true;
            }
        }

        if (scannerData.transaction_count === 0) {
            activity_risk_level = "HIGH";
        } else if (isLastTxOld && scannerData.recent_transaction_count < 3) {
            activity_risk_level = "HIGH";
        } else if (scannerData.recent_transaction_count < 3) {
            activity_risk_level = "MEDIUM";
        }
        const activity_risk_score = this.SCORES[activity_risk_level];

        // 🔟 Improved Summary
        const analysis_summary = this._generateSummary({
            mint_risk_level,
            admin_control_risk,
            holder_concentration_risk,
            treasury_dump_risk,
            age_risk_level,
            activity_risk_level
        });

        // 🎯 Final Output Format
        return {
            "token_id": scannerData.token_id,
            "mint_risk_level": mint_risk_level,
            "mint_risk_score": mint_risk_score,
            "admin_control_risk": admin_control_risk,
            "admin_control_score": admin_control_score,
            "holder_concentration_risk": holder_concentration_risk,
            "holder_concentration_score": holder_concentration_score,
            "treasury_dump_risk": treasury_dump_risk,
            "treasury_dump_score": treasury_dump_score,
            "age_risk_level": age_risk_level,
            "age_risk_score": age_risk_score,
            "activity_risk_level": activity_risk_level,
            "activity_risk_score": activity_risk_score,
            "analysis_summary": analysis_summary
        };
    }

    /**
     * Helper mapping risk categories to descriptive texts for dynamic explanations.
     * @private
     */
    _generateSummary(risks) {
        let highRisks = [];
        let mediumRisks = [];
        let lowRisks = [];

        // Distribute risks into severity buckets
        if (risks.mint_risk_level === "HIGH" || risks.mint_risk_level === "VERY_HIGH") highRisks.push("mint control");
        else if (risks.mint_risk_level === "MEDIUM") mediumRisks.push("mint control");
        else lowRisks.push("mint control");

        if (risks.admin_control_risk === "HIGH" || risks.admin_control_risk === "VERY_HIGH") highRisks.push("admin control");
        else if (risks.admin_control_risk === "MEDIUM") mediumRisks.push("admin control");
        else lowRisks.push("admin control");

        if (risks.holder_concentration_risk === "HIGH" || risks.holder_concentration_risk === "VERY_HIGH") highRisks.push("holder concentration");
        else if (risks.holder_concentration_risk === "MEDIUM") mediumRisks.push("holder concentration");
        else lowRisks.push("holder concentration");

        if (risks.treasury_dump_risk === "HIGH" || risks.treasury_dump_risk === "VERY_HIGH") highRisks.push("treasury concentration");
        else if (risks.treasury_dump_risk === "MEDIUM") mediumRisks.push("treasury concentration");
        else lowRisks.push("treasury concentration");

        if (risks.age_risk_level === "VERY_HIGH" || risks.age_risk_level === "HIGH") highRisks.push("token age");
        else if (risks.age_risk_level === "MEDIUM") mediumRisks.push("token age");
        else lowRisks.push("token age");

        if (risks.activity_risk_level === "HIGH" || risks.activity_risk_level === "VERY_HIGH") highRisks.push("activity level");
        else if (risks.activity_risk_level === "MEDIUM") mediumRisks.push("activity level");
        else lowRisks.push("activity level");

        let summaryStr = "Token shows ";

        if (mediumRisks.length > 0) {
            summaryStr += `medium ${mediumRisks.join(" and ")} risk but `;
        }

        if (lowRisks.length > 0) {
            // Picking a couple to demonstrate low risk
            const lowSample = lowRisks.slice(0, 2).join(" and ");
            summaryStr += `low ${lowSample} risk. `;
        } else {
            summaryStr += "no distinctly low risk areas. ";
        }

        if (highRisks.length > 0) {
            summaryStr += `However, it exhibits HIGH risk in ${highRisks.join(", ")}. Overall project appears DANGEROUS and should be avoided or approached with extreme caution.`;
        } else if (mediumRisks.length > 0) {
            summaryStr += `Overall project appears moderately safe but flagged areas (${mediumRisks.join(", ")}) should be monitored.`;
        } else {
            summaryStr += `Overall project appears safe with no immediate red flags detected.`;
        }

        return summaryStr;
    }
}

// Export for Eliza framework / module inclusion
module.exports = BlockchainRiskAnalysisAgent;
