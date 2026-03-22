const AlertAgent = require("./AlertAgent");

const agent = new AlertAgent();
const input = {
    risk_score: {
        token_id: "0.0.123456",
        rug_risk_score: 75,
        final_risk_score: 75,
        risk_level: "HIGH",
        primary_risk_factor: "Mint Authority",
        top_risk_factors: ["Active mint authority"],
        risk_velocity: 10
    },
    prediction: {
        token_id: "0.0.123456",
        rug_probability: 0.65,
        ai_confidence: 85,
        key_triggers: ["Active mint authority", "Low liquidity depth"]
    }
};

agent.generateAlert(input).then(res => {
    console.log(JSON.stringify(res, null, 2));
}).catch(console.error);
