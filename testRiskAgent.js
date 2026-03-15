/**
 * Test Script for BlockchainRiskAnalysisAgent
 * 
 * This script imports the BlockchainRiskAnalysisAgent, instantiates it,
 * provides sample token scanner data, and prints the generated risk analysis.
 * 
 * To run this test:
 * node testRiskAgent.js
 */

// 1. Import the BlockchainRiskAnalysisAgent class
const BlockchainRiskAnalysisAgent = require('./BlockchainRiskAnalysisAgent');

// 2. Instantiate the agent
const riskAgent = new BlockchainRiskAnalysisAgent();

// 3. Provide a sample scanner output JSON as input
const sampleScannerData = {
    "token_id": "0.0.8279134",
    "name": "BONZO",
    "symbol": "BONZO",
    "total_supply": 40000000000000000,
    "decimals": 8,
    "treasury_account": "0.0.8279084",
    "treasury_balance": 18584735109471886,
    "admin_key_exists": false,
    "supply_key_exists": false,
    "freeze_key_exists": false,
    "wipe_key_exists": false,
    "mint_risk": "LOW",
    "top_holder_percentage": 0.19,
    "top_5_holder_percentage": 0.24,
    "holder_count": 100,
    "transaction_count": 50,
    "recent_transaction_count": 4,
    "token_age_days": 388,
    "age_risk_level": "LOW",
    "scanner_health_score": 85
};

console.log("Starting BlockchainRiskAnalysisAgent test...");
console.log("Analyzing sample token data for BONZO...");

try {
    // 4. Call the function: analyzeTokenRisk(scannerData)
    const riskAnalysisResult = riskAgent.analyzeTokenRisk(sampleScannerData);

    // 5. Print the result to the console
    console.log("\n--- RISK ANALYSIS RESULT ---");
    console.log(JSON.stringify(riskAnalysisResult, null, 2));

} catch (error) {
    console.error("An error occurred during risk analysis:", error.message);
}
