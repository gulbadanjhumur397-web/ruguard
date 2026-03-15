/**
 * RugPredictorAgent for RugGuard Multi-Agent Architecture
 * 
 * This agent acts as the predictive AI layer, transforming multi-agent risk signals
 * into a single unified rug probability with explainability and simulation.
 * 
 * Prediction Engine: RugGuard Predictor
 * Model Type: Explainable Risk Fusion AI
 * Version: RugGuard AI v2
 */
class RugPredictorAgent {
    constructor() {
        this.modelName = "RugGuard Predictor";
        this.modelVersion = "RugGuard AI v2";
        this.modelType = "Explainable Risk Fusion AI";
        
        // Configuration: Weights matching the specification
        this.weights = {
            mint_risk: 0.15,
            admin_risk: 0.15,
            treasury_risk: 0.15,
            holder_concentration: 0.10,
            activity_risk: 0.10,
            age_risk: 0.05,
            community_sentiment: 0.10,
            liquidity_strength: 0.10,
            developer_activity: 0.05,
            external_intelligence: 0.05
        };
    }

    /**
     * Transforms fused agent data into a predictive rug probability.
     * @param {Object} input - Fused object { scanner, blockchain_risk, sentiment, risk_score }
     * @returns {Object} AI Prediction Report
     */
    predictRisk(input) {
        try {
            // 1. Validation & Error Handling
            if (!input || !input.blockchain_risk || !input.risk_score) {
                console.error("[RugPredictorAgent] Missing critical upstream pipeline data");
                return { error: "Incomplete risk pipeline data" };
            }

            if (!input.sentiment) {
                console.warn("[RugPredictorAgent] WARNING: Missing sentiment data. Proceeding with degraded confidence.");
            }

            console.log(`[RugPredictorAgent] Processing prediction for token: ${input.scanner?.token_id || "Unknown"}`);

            // 2. Feature Extraction & Normalization
            const features = this._extractFeatures(input);
            
            // 3. Risk Fusion Logic (Main Prediction)
            const prediction = this._calculateProbability(features);
            
            // 4. Time Horizon & Level Mapping
            const { level, horizon } = this._mapMetrics(prediction.probability);
            
            // 5. Trigger Detection & Feature Importance
            const triggers = this._detectTriggers(features);
            const importance = this._calculateImportance(features);
            
            // 6. Risk Trend Detection
            const trend = this._detectTrend(input);
            
            // 7. Scenario Simulation
            const simulation = this._simulateScenarios(features, input);
            
            // 8. AI Confidence Engine
            const confidence = this._calculateConfidence(input);

            // 9. Intelligence Tags
            const tags = this._generateTags(features, input);

            // 10. Assemble Final Output
            return {
                token_id: input.scanner?.token_id || "Unknown",
                rug_probability: parseFloat(prediction.probability.toFixed(2)),
                probability_percent: Math.round(prediction.probability * 100),
                probability_level: level,
                time_horizon: horizon,
                ai_confidence: confidence,
                risk_trend: trend,
                status: !input.sentiment ? "DEGRADED_SENTIMENT" : "FULL_DATA",
                key_triggers: triggers,
                feature_importance: importance,
                risk_simulation: simulation,
                risk_tags: tags,
                model_type: this.modelType,
                prediction_engine: this.modelName,
                model_version: this.modelVersion
            };

        } catch (error) {
            console.error("[RugPredictorAgent] Prediction Engine Failure:", error);
            return { error: "Internal Prediction Engine Error", details: error.message };
        }
    }

    _extractFeatures(input) {
        const br = input.blockchain_risk;
        const s = input.sentiment || {}; // Graceful handling
        const sc = input.risk_score;

        // Clamp values to 0-100 professionally
        const clamp = (val) => Math.max(0, Math.min(100, val || 0));

        return {
            mint_risk: clamp(br.mint_risk_score),
            admin_risk: clamp(br.admin_control_score),
            holder_concentration: clamp(br.holder_concentration_score),
            treasury_risk: clamp(br.treasury_dump_score),
            age_risk: clamp(br.age_risk_score),
            activity_risk: clamp(br.activity_risk_score),
            community_sentiment: clamp(100 - (s.community_intelligence_score || 50)), // Neutral fallback
            liquidity_strength: clamp(s.dex_risk_level === "HIGH" ? 90 : (s.dex_risk_level === "MEDIUM" ? 40 : (s.dex_risk_level === "LOW" ? 10 : 50))),
            developer_activity: clamp(s.developer_activity_risk === "HIGH RISK" ? 90 : (s.developer_activity_risk === "MEDIUM" ? 50 : (s.developer_activity_risk === "LOW" ? 10 : 50))),
            external_intelligence: clamp(s.external_risk_rating === "HIGH" ? 85 : (s.external_risk_rating === "LOW" ? 20 : 50))
        };
    }


    _calculateProbability(features) {
        let weightedSum = 0;
        
        weightedSum += features.mint_risk * this.weights.mint_risk;
        weightedSum += features.admin_risk * this.weights.admin_risk;
        weightedSum += features.treasury_risk * this.weights.treasury_risk;
        weightedSum += features.holder_concentration * this.weights.holder_concentration;
        weightedSum += features.activity_risk * this.weights.activity_risk;
        weightedSum += features.age_risk * this.weights.age_risk;
        weightedSum += features.community_sentiment * this.weights.community_sentiment;
        weightedSum += features.liquidity_strength * this.weights.liquidity_strength;
        weightedSum += features.developer_activity * this.weights.developer_activity;
        weightedSum += features.external_intelligence * this.weights.external_intelligence;

        const probability = weightedSum / 100; // max_possible_score is 100
        return { probability: Math.max(0, Math.min(1, probability)) };
    }

    _mapMetrics(prob) {
        let level = "LOW";
        if (prob > 0.75) level = "HIGH";
        else if (prob > 0.50) level = "ELEVATED";
        else if (prob > 0.25) level = "GUARDED";

        let horizon = "Low immediate risk (30+ days)";
        if (prob > 0.70) horizon = "3-7 days";
        else if (prob >= 0.40) horizon = "7-30 days";

        return { level, horizon };
    }

    _detectTriggers(features) {
        const items = [
            { id: "Active mint authority", val: features.mint_risk },
            { id: "Treasury concentration", val: features.treasury_risk },
            { id: "Low liquidity depth", val: features.liquidity_strength },
            { id: "Developer inactivity", val: features.developer_activity },
            { id: "Negative sentiment trend", val: features.community_sentiment },
            { id: "Admin control vulnerability", val: features.admin_risk },
            { id: "Holder concentration", val: features.holder_concentration }
        ];

        return items
            .sort((a, b) => b.val - a.val)
            .slice(0, 3)
            .filter(i => i.val > 40) // Only return significant triggers
            .map(i => i.id);
    }

    _calculateImportance(features) {
        const importance = [];
        const labels = {
            mint_risk: "Mint Risk",
            admin_risk: "Admin Control",
            treasury_risk: "Treasury Risk",
            holder_concentration: "Holder Concentration",
            activity_risk: "Activity Risk",
            age_risk: "Age Risk",
            community_sentiment: "Community Sentiment",
            liquidity_strength: "Liquidity Strength",
            developer_activity: "Developer Activity",
            external_intelligence: "External Intelligence"
        };

        for (const [key, weight] of Object.entries(this.weights)) {
            const impact = Math.round((features[key] * weight));
            importance.push({ factor: labels[key], impact });
        }

        return importance.sort((a, b) => b.impact - a.impact).slice(0, 5);
    }

    _detectTrend(input) {
        const s = input.sentiment || {};
        const br = input.blockchain_risk;
        
        // Logic: High liquidity + low sentiment vol -> STABLE
        if (s.liquidity_usd && s.liquidity_usd > 200000 && s.community_risk_index < 30) return "STABLE";
        
        // Logic: High admin risk + low activity -> DETERIORATING
        if (br.admin_control_score > 70 && br.activity_risk_score > 60) return "DETERIORATING";
        
        return "STABLE"; // Default
    }

    _simulateScenarios(features, input) {
        const scenarios = [];
        
        // 1. Liquidity drops 20%
        const s1Features = { ...features, liquidity_strength: Math.min(100, features.liquidity_strength * 1.25) };
        scenarios.push({
            scenario: "Liquidity drops 20%",
            new_probability: parseFloat(this._calculateProbability(s1Features).probability.toFixed(2))
        });

        // 2. Admin key removed
        const s2Features = { ...features, admin_risk: 0, mint_risk: features.mint_risk * 0.5 };
        scenarios.push({
            scenario: "Admin key removed",
            new_probability: parseFloat(this._calculateProbability(s2Features).probability.toFixed(2))
        });

        // 3. Transaction activity increases
        const s3Features = { ...features, activity_risk: Math.max(0, features.activity_risk * 0.5) };
        scenarios.push({
            scenario: "Transaction activity increases",
            new_probability: parseFloat(this._calculateProbability(s3Features).probability.toFixed(2))
        });

        return scenarios;
    }

    _calculateConfidence(input) {
        const sc = input.risk_score;
        const s = input.sentiment || {};
        
        let baseConfidence = sc.confidence_score || 80;
        
        // Missing dev data reduces confidence
        if (!input.sentiment) {
            baseConfidence -= 25; // Significant penalty for missing sentiment pipeline
        } else {
            if (s.developer_activity_risk === "UNKNOWN") baseConfidence -= 15;
            if (!s.dex_listed) baseConfidence -= 10;
        }
        
        return Math.max(10, Math.min(100, baseConfidence));
    }


    _generateTags(features, input) {
        const tags = [];
        if (features.mint_risk > 60 || features.admin_risk > 60) tags.push("CENTRALIZATION_RISK");
        if (features.activity_risk > 70) tags.push("LOW_ACTIVITY");
        if (features.liquidity_strength > 70) tags.push("LOW_LIQUIDITY");
        if (features.admin_risk > 50) tags.push("ADMIN_CONTROL");
        if (features.community_sentiment < 30) tags.push("HEALTHY_SENTIMENT");
        if (features.age_risk < 30) tags.push("MATURE_TOKEN");
        
        return tags;
    }
}

module.exports = RugPredictorAgent;
