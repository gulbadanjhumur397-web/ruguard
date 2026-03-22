const RiskScoringAgent = require('./RiskScoringAgent');

const mock = require("mock-require");

async function testValidation() {

    const scanner = { token_id: "0.0.555555" };
    const blockchain = {
        mint_risk_score: 85,
        admin_control_score: 78,
        holder_concentration_score: 60,
        treasury_dump_score: 40,
        activity_risk_score: 55,
        age_risk_score: 20
    };
    const sentiment = {
        community_risk_index: 72,
        sentiment_security_rating: "WARNING",
        dex_risk_level: "HIGH",
        developer_activity_risk: "UNKNOWN",
        ai_market_confidence: "LOW",
        dex_listed: true
    };

    const results = {
        core_scoring: "FAIL",
        new_fields: "FAIL",
        ai_fusion: "FAIL",
        fallback_safety: "FAIL",
        structure: "FAIL",
        pipeline_compatibility: "FAIL"
    };

    let riskOutput;
    
    // Replace askLLM temporarily to avoid timeout during tests
    mock("./llmClient", async () => {
        return JSON.stringify({
           ai_risk_summary: "Test summary.",
           ai_confidence_reasoning: "Test reasoning.",
           ai_recommendations: ["Rec 1", "Rec 2"]
        });
    });
    
    // Clear require cache for RiskScoringAgent
    delete require.cache[require.resolve('./RiskScoringAgent')];
    const RiskScoringAgentMocked = require('./RiskScoringAgent');
    const agentMocked = new RiskScoringAgentMocked();

    // Normal Run
    try {
        riskOutput = await agentMocked.calculateRisk({ scanner, blockchain, sentiment });
        
        // 1 & 8 CORE SCORING AND PIPELINE
        if (
            typeof riskOutput.final_risk_score === 'number' && 
            riskOutput.final_risk_score >= 0 && 
            riskOutput.final_risk_score <= 100 &&
            riskOutput.risk_level &&
            riskOutput.rug_risk_score === riskOutput.final_risk_score &&
            Array.isArray(riskOutput.risk_flags) &&
            Array.isArray(riskOutput.recommendations)
        ) {
            results.core_scoring = "PASS";
            results.pipeline_compatibility = "PASS";
        }

        // 2 & 3 NEW FIELDS & DISTRIBUTION
        if (
            riskOutput.scoring_version === "2.1" &&
            riskOutput.risk_distribution &&
            typeof riskOutput.risk_distribution.blockchain === 'number' &&
            typeof riskOutput.risk_distribution.sentiment === 'number' &&
            riskOutput.risk_distribution.blockchain >= 0 &&
            riskOutput.risk_distribution.sentiment >= 0 &&
            (riskOutput.risk_distribution.blockchain + riskOutput.risk_distribution.sentiment) === 100 &&
            ["INCREASING", "STABLE", "DECREASING"].includes(riskOutput.risk_velocity)
        ) {
            results.new_fields = "PASS";
        }

        // 4 & 5 AI FUSION AND CONFIDENCE
        if (
            typeof riskOutput.confidence_score === 'number' &&
            riskOutput.confidence_score >= 0 &&
            riskOutput.confidence_score <= 100 &&
            ["HIGH", "MEDIUM", "LOW"].includes(riskOutput.confidence_tier) &&
            riskOutput.analysis_mode === "HYBRID_AI" &&
            riskOutput.ai_risk_summary &&
            riskOutput.ai_confidence_reasoning &&
            Array.isArray(riskOutput.ai_recommendations) &&
            riskOutput.ai_recommendations.length <= 3
        ) {
            results.ai_fusion = "PASS";
        }
        
        // 7 STRUCTURE VALIDATION
        const requiredKeys = [
            'scoring_version', 'final_risk_score', 'risk_level', 'primary_risk_factor',
            'top_risk_factors', 'risk_breakdown', 'risk_distribution', 'risk_velocity',
            'confidence_score', 'confidence_tier', 'analysis_mode', 'ai_risk_summary',
            'ai_confidence_reasoning', 'ai_recommendations'
        ];
        
        const hasAllKeys = requiredKeys.every(k => k in riskOutput);
        if (hasAllKeys) {
            results.structure = "PASS";
        }

    } catch (e) {
        console.error("Test execution failed:", e);
    }

    // 6 FALLBACK SAFETY
    try {
        const originalApiKey = process.env.OPENAI_API_KEY;
        process.env.OPENAI_API_KEY = "invalid_key_for_testing";
        
        // Use a clean clear module hack if necessary to force llm failure, but simply modifying key in memory might not be enough if llmClient caches `openai`.
        // Alternatively, the prompt itself can cause failure if timeout/auth fails.
        // For accurate fallback simulation, if askLLM rejects, agent should catch it.
        const fallbackAgent = new RiskScoringAgent();
        const fbOutput = await fallbackAgent.calculateRisk({ scanner, blockchain, sentiment });
        
        if (
            fbOutput.analysis_mode === "DETERMINISTIC_ONLY" &&
            fbOutput.ai_risk_summary === "AI analysis unavailable – deterministic risk fusion applied." &&
            fbOutput.ai_recommendations.length > 0
        ) {
            results.fallback_safety = "PASS";
        }
        process.env.OPENAI_API_KEY = originalApiKey;
        
    } catch (e) {
        console.error("Fallback test failed:", e);
    }
    
    // 9 EDGE CASE
    try {
        const edgeOutput = await agentMocked.calculateRisk({ 
            scanner, 
            blockchain, 
            sentiment: { developer_activity_risk: "UNKNOWN" } 
        });
        if (edgeOutput.final_risk_score >= 0) {
            // Edge case passes if it finishes without throw
        } else {
            console.error("Edge case failed to return score");
        }
    } catch(e) {
        console.error("Edge case crashed:", e);
    }

    console.log(`VALIDATION REPORT:

CORE SCORING: ${results.core_scoring}
NEW FIELDS: ${results.new_fields}
AI FUSION: ${results.ai_fusion}
FALLBACK SAFETY: ${results.fallback_safety}
STRUCTURE: ${results.structure}
PIPELINE COMPATIBILITY: ${results.pipeline_compatibility}

FINAL STATUS:
`);

    const allPassed = Object.values(results).every(r => r === "PASS");
    if (allPassed) {
        console.log("RISKSCORING AGENT READY");
    } else {
        console.log("FIXES REQUIRED");
    }
}

testValidation();
