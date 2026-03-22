const AlertAgent = require("./AlertAgent");

async function debugAI() {
    const baseInput = {
        risk_score: {
            token_id: "0.0.888888",
            final_risk_score: 72,
            rug_risk_score: 72,
            risk_level: "HIGH",
            primary_risk_factor: "Centralized mint authority",
            top_risk_factors: [
                "Active mint authority",
                "Admin control vulnerability",
                "Low liquidity depth"
            ],
            risk_velocity: "INCREASING",
            confidence_score: 78
        },
        prediction: {
            token_id: "0.0.888888",
            rug_probability: 0.68,
            key_triggers: [
                "Active mint authority",
                "Low liquidity depth",
                "Admin control vulnerability"
            ],
            ai_confidence: 78
        }
    };
    const agent = new AlertAgent();
    const result = await agent.generateAlert(JSON.parse(JSON.stringify(baseInput)));
    console.log("ai_alert_summary:", result.ai_alert_summary);
    console.log("recommendations:", result.recommendations);
    console.log("alert_generation_mode:", result.alert_generation_mode);
    console.log("openai available?", !!process.env.OPENAI_API_KEY);
}
debugAI()
