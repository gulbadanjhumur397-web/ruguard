const RugPredictorAgent = require("./RugPredictorAgent");

/**
 * Professional Verification Test for RugPredictorAgent
 */
async function runTests() {
    console.log("Starting RugPredictorAgent Verification...");
    const agent = new RugPredictorAgent();

    // --- TEST CASE 1: HIGH RISK TOKEN ---
    console.log("\n[TEST 1] Testing High Risk Analysis...");
    const highRiskInput = {
        scanner: { token_id: "0.0.HIGH_RISK" },
        blockchain_risk: {
            mint_risk_score: 95,
            admin_control_score: 90,
            holder_concentration_score: 85,
            treasury_dump_score: 90,
            age_risk_score: 80,
            activity_risk_score: 70
        },
        sentiment: {
            community_intelligence_score: 15, // High risk
            dex_risk_level: "HIGH",
            developer_activity_risk: "HIGH RISK",
            external_risk_rating: "HIGH",
            liquidity_usd: 5000,
            volume_24h: 100,
            community_risk_index: 85
        },
        risk_score: {
            rug_risk_score: 92,
            confidence_score: 90
        }
    };

    const highResult = await agent.predictRisk(highRiskInput);
    console.log("Result Probability:", highResult.rug_probability);
    console.log("Level:", highResult.probability_level);
    console.log("Horizon:", highResult.time_horizon);
    console.log("Triggers:", highResult.key_triggers);
    
    if (highResult.rug_probability > 0.8 && highResult.probability_level === "HIGH") {
        console.log("✅ High Risk Test Passed");
    } else {
        console.error("❌ High Risk Test Failed");
    }

    // --- TEST CASE 2: LOW RISK TOKEN ---
    console.log("\n[TEST 2] Testing Low Risk Analysis...");
    const lowRiskInput = {
        scanner: { token_id: "0.0.HEALTHY" },
        blockchain_risk: {
            mint_risk_score: 10,
            admin_control_score: 5,
            holder_concentration_score: 20,
            treasury_dump_score: 15,
            age_risk_score: 5,
            activity_risk_score: 10
        },
        sentiment: {
            community_intelligence_score: 85,
            dex_risk_level: "LOW",
            developer_activity_risk: "LOW",
            external_risk_rating: "LOW",
            liquidity_usd: 500000,
            volume_24h: 50000,
            community_risk_index: 10
        },
        risk_score: {
            rug_risk_score: 12,
            confidence_score: 95
        }
    };

    const lowResult = await agent.predictRisk(lowRiskInput);
    console.log("Result Probability:", lowResult.rug_probability);
    console.log("Level:", lowResult.probability_level);
    
    if (lowResult.rug_probability < 0.2 && lowResult.probability_level === "LOW") {
        console.log("✅ Low Risk Test Passed");
    } else {
        console.error("❌ Low Risk Test Failed");
    }

    // --- TEST CASE 3: SCENARIO SIMULATION ---
    console.log("\n[TEST 3] Testing Scenario Simulation...");
    console.log("Scenarios:", JSON.stringify(lowResult.risk_simulation, null, 2));
    
    if (lowResult.risk_simulation && lowResult.risk_simulation.length === 3) {
        console.log("✅ Simulation Test Passed");
    } else {
        console.error("❌ Simulation Test Failed");
    }

    // --- TEST CASE 4: ERROR HANDLING ---
    console.log("\n[TEST 4] Testing Error Handling...");
    const invalidResult = await agent.predictRisk({});
    if (invalidResult.error) {
        console.log("✅ Error Handling Test Passed");
    } else {
        console.error("❌ Error Handling Test Failed");
    }

    console.log("\nRugPredictorAgent Verification Complete.");
}

runTests().catch(console.error);
