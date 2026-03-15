/**
 * AlertAgent for RugGuard Multi-Agent Security Pipeline
 * 
 * Action Layer — converts AI risk predictions into security alerts,
 * human-readable warnings, and actionable recommendations.
 * 
 * Consumes output from:
 *   - RiskScoringAgent  → { rug_risk_score, risk_level, risk_flags, ... }
 *   - RugPredictorAgent → { rug_probability, probability_level, key_triggers, ... }
 * 
 * Agent: RugGuard AlertAgent v1
 */
class AlertAgent {

    /**
     * Generate a complete security alert from upstream pipeline data.
     * @param {Object} input - { risk_score: {RiskScoringAgent output}, prediction: {RugPredictorAgent output} }
     * @returns {Object} Structured security alert or error object
     */
    generateAlert(input) {
        try {
            // ── Input Validation ───────────────────────────────────────
            if (!input || !input.risk_score || !input.prediction) {
                console.error("[AlertAgent] Missing required pipeline data");
                return { error: "Missing prediction data", agent: "RugGuard AlertAgent v1" };
            }

            const rs = input.risk_score;   // RiskScoringAgent output
            const pr = input.prediction;   // RugPredictorAgent output

            console.log(`[AlertAgent] Processing alert for token: ${rs.token_id || pr.token_id || "Unknown"}`);

            // ── Feature Extraction ─────────────────────────────────────
            const token_id          = rs.token_id          || pr.token_id          || "Unknown";
            const rug_risk_score    = rs.rug_risk_score    ?? 0;
            const final_risk_level  = rs.risk_level        || "LOW";
            const rug_probability   = pr.rug_probability   ?? 0;
            const probability_level = pr.probability_level || "LOW";
            const ai_confidence     = pr.ai_confidence     ?? 0;
            const key_triggers      = pr.key_triggers      || [];
            const risk_tags         = pr.risk_tags         || [];
            const risk_trend        = pr.risk_trend        || "STABLE";

            // ── Alert Level Logic ──────────────────────────────────────
            const alert_level = this._resolveAlertLevel(rug_probability);

            // ── Alert Trigger Rules ────────────────────────────────────
            const alert_triggered = this._evaluateTrigger(rug_probability, final_risk_level, key_triggers);

            // ── Alert Type Classification ──────────────────────────────
            const alert_type = this._classifyAlertType(alert_level);

            // ── Human-Readable Warnings ────────────────────────────────
            const primary_warning = this._buildPrimaryWarning(key_triggers, final_risk_level, rug_probability);
            const risk_summary    = this._buildRiskSummary(rug_risk_score, final_risk_level, key_triggers);

            // ── Security Recommendations ───────────────────────────────
            const recommendations = this._generateRecommendations(key_triggers, risk_tags, rs.risk_flags || []);

            // ── Monitoring & Posture ───────────────────────────────────
            const monitoring_status = rug_probability > 0.40 ? "ACTIVE_MONITORING" : "PASSIVE_MONITORING";
            const security_posture  = this._resolveSecurityPosture(rug_probability);

            // ── Alert Score ────────────────────────────────────────────
            const probability_percent = pr.probability_percent ?? Math.round(rug_probability * 100);
            const alert_score = Math.round((rug_risk_score + probability_percent) / 2);

            // ── Final Output ───────────────────────────────────────────
            return {
                token_id,
                alert_triggered,
                alert_level,
                alert_type,
                primary_warning,
                risk_summary,
                recommendations,
                monitoring_status,
                security_posture,
                alert_score,
                ai_confidence,
                agent: "RugGuard AlertAgent v1"
            };

        } catch (error) {
            console.error("[AlertAgent] Alert generation failure:", error.message);
            return { error: "Alert generation failed", details: error.message, agent: "RugGuard AlertAgent v1" };
        }
    }

    // ── Private Helpers ────────────────────────────────────────────────

    /**
     * Map rug probability to alert severity level.
     */
    _resolveAlertLevel(prob) {
        if (prob > 0.75) return "CRITICAL";
        if (prob > 0.50) return "HIGH";
        if (prob > 0.30) return "MEDIUM";
        return "LOW";
    }

    /**
     * Determine whether an alert should fire based on multiple criteria.
     */
    _evaluateTrigger(prob, riskLevel, triggers) {
        if (prob > 0.40) return true;
        if (riskLevel === "MEDIUM" || riskLevel === "HIGH" || riskLevel === "CRITICAL") return true;

        const criticalTriggers = ["Active mint authority", "Admin control vulnerability", "Treasury concentration"];
        if (triggers.some(t => criticalTriggers.includes(t))) return true;

        return false;
    }

    /**
     * Classify the alert into operational alert categories.
     */
    _classifyAlertType(level) {
        if (level === "CRITICAL") return "CRITICAL_THREAT";
        if (level === "HIGH")     return "SECURITY_WARNING";
        return "RISK_MONITOR";
    }

    /**
     * Build a professional, human-readable primary warning string.
     */
    _buildPrimaryWarning(triggers, riskLevel, prob) {
        // Map common triggers to plain-language warnings
        const warningMap = {
            "Active mint authority":        "Token has active mint authority creating supply inflation risk.",
            "Treasury concentration":       "Large treasury concentration detected — potential dump vector.",
            "Admin control vulnerability":  "Admin key present allowing unilateral contract changes.",
            "Low liquidity depth":          "Insufficient liquidity depth increases exit slippage risk.",
            "Holder concentration":         "Whale-dominated holder distribution creates price manipulation risk.",
            "Developer inactivity":         "No recent developer activity signals possible project abandonment.",
            "Negative sentiment trend":     "Community sentiment is declining — potential loss of confidence."
        };

        // Use the top trigger for the primary warning
        if (triggers.length > 0 && warningMap[triggers[0]]) {
            return warningMap[triggers[0]];
        }

        // Fallback: generate from risk level
        if (riskLevel === "CRITICAL" || prob > 0.75) {
            return "Token exhibits critical security indicators — immediate review recommended.";
        }
        if (riskLevel === "HIGH" || prob > 0.50) {
            return "Elevated risk signals detected across multiple security vectors.";
        }
        if (riskLevel === "MEDIUM" || prob > 0.30) {
            return "Moderate risk indicators present — continued monitoring advised.";
        }
        return "Token security profile within acceptable parameters.";
    }

    /**
     * Generate a concise risk summary sentence.
     */
    _buildRiskSummary(score, riskLevel, triggers) {
        const triggerStr = triggers.length > 0 ? triggers.join(", ").toLowerCase() : "general risk factors";

        if (riskLevel === "CRITICAL" || score > 80) {
            return `Critical rug risk (score: ${score}) driven by ${triggerStr}. Immediate action required.`;
        }
        if (riskLevel === "HIGH" || score > 60) {
            return `High rug risk (score: ${score}) due to ${triggerStr}. Enhanced monitoring active.`;
        }
        if (riskLevel === "MEDIUM" || score > 30) {
            return `Moderate rug risk (score: ${score}) due to ${triggerStr}. Standard monitoring in place.`;
        }
        return `Low rug risk (score: ${score}). No significant threats identified at this time.`;
    }

    /**
     * Generate up to 3 actionable security recommendations based on triggers and flags.
     */
    _generateRecommendations(triggers, tags, riskFlags) {
        const pool = [];

        // Trigger-based recommendations
        const triggerRecs = {
            "Active mint authority":        "Monitor token supply changes and mint transaction history for unexpected inflation.",
            "Treasury concentration":       "Track treasury wallet transactions for large outgoing transfers.",
            "Low liquidity depth":          "Monitor liquidity pool depth and watch for sudden withdrawals.",
            "Admin control vulnerability":  "Verify governance controls and audit admin key permissions.",
            "Holder concentration":         "Monitor whale wallets for coordinated sell-offs or transfer patterns.",
            "Developer inactivity":         "Investigate developer engagement and verify project roadmap commitments.",
            "Negative sentiment trend":     "Assess community channels for emerging FUD and manipulated narratives."
        };

        triggers.forEach(t => { if (triggerRecs[t]) pool.push(triggerRecs[t]); });

        // Tag-based recommendations (fill remaining slots)
        const tagRecs = {
            "CENTRALIZATION_RISK":  "Evaluate decentralization roadmap and multi-sig implementation.",
            "LOW_ACTIVITY":         "Review on-chain activity trends for signs of wash trading or abandonment.",
            "LOW_LIQUIDITY":        "Set liquidity threshold alerts to detect pool drain events.",
            "ADMIN_CONTROL":        "Request disclosure of admin key holder identities and timelock status."
        };

        tags.forEach(t => { if (tagRecs[t] && !pool.includes(tagRecs[t])) pool.push(tagRecs[t]); });

        // Risk-flag-based recommendations (fill remaining slots)
        const flagRecs = {
            "MINT_AUTHORITY_EXISTS":          "Verify mint history and supply ceiling constraints.",
            "ADMIN_KEY_PRESENT":              "Monitor admin wallet activity for privilege escalation.",
            "HIGH_HOLDER_CONCENTRATION":      "Set position-size alerts on top holder wallets.",
            "LARGE_TREASURY_RESERVE":         "Watch treasury account for large outgoing transfers.",
            "NEW_TOKEN_LISTING":              "Exercise caution — newly listed tokens carry elevated risk.",
            "NEGATIVE_COMMUNITY_SENTIMENT":   "Investigate sources of community negativity.",
            "LOW_LIQUIDITY_WARNING":          "Monitor liquidity pool changes and DEX pair health."
        };

        riskFlags.forEach(f => { if (flagRecs[f] && !pool.includes(flagRecs[f])) pool.push(flagRecs[f]); });

        // Guarantee at least one recommendation
        if (pool.length === 0) {
            pool.push("Continue standard security monitoring — no critical triggers detected.");
        }

        // Return the top 3 most relevant recommendations
        return pool.slice(0, 3);
    }

    /**
     * Map rug probability to a security posture designation.
     */
    _resolveSecurityPosture(prob) {
        if (prob > 0.75) return "HIGH_RISK";
        if (prob > 0.50) return "AT_RISK";
        if (prob > 0.30) return "CAUTION";
        return "SAFE";
    }
}

module.exports = AlertAgent;
