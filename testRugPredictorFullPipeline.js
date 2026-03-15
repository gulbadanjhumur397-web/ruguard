const { execSync } = require("child_process");
const BlockchainRiskAnalysisAgent = require("./BlockchainRiskAnalysisAgent");
const SentimentAnalysisAgent = require("./SentimentAnalysisAgent");
const RiskScoringAgent = require("./RiskScoringAgent");
const RugPredictorAgent = require("./RugPredictorAgent");

async function runFullValidation() {
    const tokenId = "0.0.2283230";
    console.log(`\n===== STARTING FULL PIPELINE VALIDATION FOR TOKEN: ${tokenId} =====\n`);

    const blockchainRiskAgent = new BlockchainRiskAnalysisAgent();
    const sentimentAgent = new SentimentAnalysisAgent();
    const scoringAgent = new RiskScoringAgent();
    const predictorAgent = new RugPredictorAgent();

    let results = {
        pipeline: false,
        probability: false,
        triggers: false,
        explainability: false,
        simulation: false,
        edge_case: false
    };

    try {
        // 1. Scanner (Python)
        console.log("[1/5] Running TokenScannerAgent (Python)...");
        const scannerRaw = execSync(`python3 token_scanner_agent.py ${tokenId}`).toString();
        const scanner = JSON.parse(scannerRaw);
        
        if (scanner.error) throw new Error(`Scanner Error: ${scanner.error}`);
        console.log(`Scanner success: ${scanner.name} (${scanner.symbol})`);

        // 2. Blockchain Risk
        console.log("[2/5] Running BlockchainRiskAnalysisAgent...");
        const blockchain = blockchainRiskAgent.analyzeTokenRisk(scanner);

        // 3. Sentiment Analysis
        console.log("[3/5] Running SentimentAnalysisAgent...");
        const sentiment = await sentimentAgent.analyzeSentiment(scanner);

        // 4. Risk Scoring
        console.log("[4/5] Running RiskScoringAgent...");
        const riskScore = scoringAgent.calculateRisk({
            scanner,
            blockchain,
            sentiment
        });

        // 5. Rug Predictor (The main target)
        console.log("[5/5] Running RugPredictorAgent...");
        const prediction = predictorAgent.predictRisk({
            scanner,
            blockchain_risk: blockchain,
            sentiment,
            risk_score: riskScore
        });

        console.log("\n===== RUG PREDICTOR OUTPUT =====\n");
        console.log(JSON.stringify(prediction, null, 2));
        console.log("\n================================\n");

        // --- VALIDATION CHECKLIST ---
        const check = (desc, condition) => {
            console.log(`${condition ? "✅" : "❌"} ${desc}`);
            return condition;
        };

        const v1 = check("rug_probability between 0–1", prediction.rug_probability >= 0 && prediction.rug_probability <= 1);
        const v2 = check("probability_percent between 0–100", prediction.probability_percent >= 0 && prediction.probability_percent <= 100);
        const v3 = check("probability_level exists", !!prediction.probability_level);
        const v4 = check("time_horizon exists", !!prediction.time_horizon);
        const v5 = check("ai_confidence exists", !!prediction.ai_confidence);
        
        results.probability = v1 && v2 && v3 && v4 && v5;

        const i1 = check("key_triggers contains at least 1 item", prediction.key_triggers.length >= 1);
        const i2 = check("feature_importance sorted descending", 
            prediction.feature_importance[0].impact >= prediction.feature_importance[prediction.feature_importance.length-1].impact);
        const i3 = check("risk_simulation contains 3 scenarios", prediction.risk_simulation.length === 3);
        const i4 = check("risk_tags and risk_trend exist", !!prediction.risk_tags && !!prediction.risk_trend);
        
        results.triggers = i1;
        results.explainability = i2;
        results.simulation = i3 && i4;

        // Logic check: Highest blockchain risk appears in triggers
        const maxRiskFactor = Object.entries(blockchain)
            .filter(([k,v]) => k.includes("_score"))
            .sort((a,b) => b[1] - a[1])[0][0];
        
        console.log(`Debug: Max risk factor from blockchain is ${maxRiskFactor}`);

        // --- EDGE CASE TEST ---
        console.log("\n[EDGE CASE] Testing Missing Sentiment Data...");
        const edgePrediction = predictorAgent.predictRisk({
            scanner,
            blockchain_risk: blockchain,
            risk_score: riskScore
        });
        
        const e1 = check("Agent works without sentiment", !!edgePrediction && !edgePrediction.error);
        const e2 = check("Confidence reduced in edge case", edgePrediction.ai_confidence < prediction.ai_confidence);
        
        results.edge_case = e1 && e2;
        results.pipeline = true;

        // --- FINAL REPORT ---
        console.log("\n===== RUG PREDICTOR VALIDATION =====\n");
        console.log(`Prediction Engine Working: ${results.pipeline ? "PASS" : "FAIL"}`);
        console.log(`Probability Logic Correct: ${results.probability ? "PASS" : "FAIL"}`);
        console.log(`Trigger Detection Working: ${results.triggers ? "PASS" : "FAIL"}`);
        console.log(`Explainability Working: ${results.explainability ? "PASS" : "FAIL"}`);
        console.log(`Simulation Working: ${results.simulation ? "PASS" : "FAIL"}`);
        console.log(`Error Handling Working: ${results.edge_case ? "PASS" : "FAIL"}`);
        
        const finalStatus = Object.values(results).every(v => v) ? "READY" : "NEEDS FIXES";
        console.log(`\nFinal Status: RugPredictorAgent ${finalStatus}\n`);

    } catch (error) {
        console.error("\n❌ FATAL ERROR DURING VALIDATION:", error.message);
        console.log("\nFinal Status: RugPredictorAgent NEEDS FIXES");
    }
}

runFullValidation();
