const RiskScoringAgent = require("./RiskScoringAgent");

// Instantiate the agent
const agent = new RiskScoringAgent();

// Input data from the BlockchainRiskAnalysisAgent
const riskAnalysisData = {
    token_id: "0.0.8279134",
    mint_risk_level: "LOW",
    mint_risk_score: 20,
    admin_control_risk: "LOW",
    admin_control_score: 20,
    holder_concentration_risk: "LOW",
    holder_concentration_score: 20,
    treasury_dump_risk: "MEDIUM",
    treasury_dump_score: 50,
    age_risk_level: "LOW",
    age_risk_score: 20,
    activity_risk_level: "LOW",
    activity_risk_score: 20
};

// Run the scoring function
const result = agent.calculateRiskScore(riskAnalysisData);

// Print the output clearly
console.log("===== RUG RISK SCORE RESULT =====");
console.log(JSON.stringify(result, null, 2));

// Instructions to run the test:
// node testRiskScoringAgent.js
