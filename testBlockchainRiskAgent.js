/**
 * Test Script for Upgraded BlockchainRiskAnalysisAgent
 * 
 * This script runs the Risk Analysis Agent using actual scanner data 
 * to ensure all risk signals, numeric scores, and the generated 
 * summary are produced correctly.
 * 
 * To run this test:
 * node testBlockchainRiskAgent.js
 */

// STEP 1: Import the agent
const BlockchainRiskAnalysisAgent = require("./BlockchainRiskAnalysisAgent");

// STEP 2: Instantiate the agent
const agent = new BlockchainRiskAnalysisAgent();

// STEP 3: Use this REAL scanner output as test input
const scannerData = {
    token_id: "0.0.8279134",
    name: "BONZO",
    symbol: "BONZO",
    total_supply: 40000000000000000,
    decimals: 8,
    treasury_account: "0.0.8279084",
    treasury_balance: 18584735109471886,
    admin_key_exists: false,
    supply_key_exists: false,
    freeze_key_exists: false,
    wipe_key_exists: false,
    top_holder_percentage: 0.19,
    top_5_holder_percentage: 0.24,
    holder_count: 100,
    transaction_count: 50,
    recent_transaction_count: 4,
    last_transaction_timestamp: null,
    token_age_days: 388,
    scanner_health_score: 85
};

console.log("Starting full test on upgraded BlockchainRiskAnalysisAgent...\n");

try {
    // STEP 4: Run the risk analysis
    const result = agent.analyzeTokenRisk(scannerData);

    // STEP 5: Print the result clearly
    console.log("===== BLOCKCHAIN RISK ANALYSIS RESULT =====");
    console.log(JSON.stringify(result, null, 2));

    // Optional: Basic runtime verification check (STEP 6 validation logic)
    const requiredKeys = [
        "mint_risk_level", "mint_risk_score",
        "admin_control_risk", "admin_control_score",
        "holder_concentration_risk", "holder_concentration_score",
        "treasury_dump_risk", "treasury_dump_score",
        "age_risk_level", "age_risk_score",
        "activity_risk_level", "activity_risk_score",
        "analysis_summary"
    ];

    let missingKeys = [];
    requiredKeys.forEach(k => {
        if (result[k] === undefined) {
            missingKeys.push(k);
        }
    });

    if (missingKeys.length > 0) {
        console.warn(`\n[WARNING] Output is missing expected fields: ${missingKeys.join(', ')}`);
    } else {
        console.log("\n[SUCCESS] Output includes all expected risk levels, numeric scores, and the summary!");
    }

} catch (error) {
    console.error("Test failed abruptly:", error.message);
}
