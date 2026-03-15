const SentimentAnalysisAgent = require('./SentimentAnalysisAgent');
const BlockchainRiskAnalysisAgent = require('./BlockchainRiskAnalysisAgent');
const RiskScoringAgent = require('./RiskScoringAgent');

function calculateFinalRisk(blockchain, sentiment, rug) {
    let score = 0;
    
    score += rug.rug_risk_score * 0.4;
    score += sentiment.community_risk_index * 0.3;
    score += blockchain.treasury_dump_score * 0.3;
    
    score = Math.round(score);
    
    let rating = "LOW RISK";
    
    if(score > 35) rating = "MODERATE RISK";
    if(score > 65) rating = "HIGH RISK";
    
    return {
        score: score,
        rating: rating
    };
}

async function runFullScan() {
    console.log("===== KARATE COMBAT TOKEN SECURITY SCAN =====");

    // Provide full mock scanner data so BlockchainRiskAnalysisAgent can function properly 
    // while still passing the core name/symbol into the SentimentIntelligenceAgent.
    const tokenData = {
        token_id: "0.0.2283230",
        name: "Karate Combat",
        symbol: "KARATE",
        
        // Mock required blockchain risk parameters
        total_supply: 40000000000, 
        treasury_balance: 10000000000, // 25% Treasury
        top_holder_percentage: 0.15,
        top_5_holder_percentage: 0.25,
        admin_key_exists: false,
        supply_key_exists: false,
        token_age_days: 120, // MEDIUM Age 
        transaction_count: 5000,
        recent_transaction_count: 100
    };

    const sentimentAgent = new SentimentAnalysisAgent();
    // Use actual instances and correctly named methods inside the pipeline
    const blockchainAgent = new BlockchainRiskAnalysisAgent();
    const scoringAgent = new RiskScoringAgent();

    console.log("Running blockchain risk analysis...");
    
    // Analyze blockchain factors synchronously 
    const blockchainRisk = blockchainAgent.analyzeTokenRisk(tokenData);

    console.log("Running sentiment intelligence...");
    
    // Analyze sentiment & external APIs asynchronously
    const sentimentData = await sentimentAgent.analyzeSentiment(tokenData);

    console.log("Calculating rug probability...");
    
    // Compound base rug scoring
    const rugScore = scoringAgent.calculateRiskScore(blockchainRisk);

    const finalScore = calculateFinalRisk(blockchainRisk, sentimentData, rugScore);

    const report = {
        token_id: tokenData.token_id,
        token_name: tokenData.name,
        symbol: tokenData.symbol,
        
        mint_risk_score: blockchainRisk.mint_risk_score,
        holder_concentration_score: blockchainRisk.holder_concentration_score,
        treasury_dump_score: blockchainRisk.treasury_dump_score,
        
        posts_analyzed: sentimentData.posts_analyzed,
        bullish_percentage: sentimentData.bullish_percentage,
        bearish_percentage: sentimentData.bearish_percentage,
        community_intelligence_score: sentimentData.community_intelligence_score,
        liquidity_usd: sentimentData.liquidity_usd,
        dex_risk_level: sentimentData.dex_risk_level,
        
        rug_risk_score: rugScore.rug_risk_score,
        risk_level: rugScore.risk_level,
        
        final_risk_score: finalScore.score,
        final_security_rating: finalScore.rating,
        scan_time: new Date().toISOString()
    };
    
    // Validation Checks
    let errors = [];
    if (!report.token_id) errors.push("token_id missing");
    if (report.posts_analyzed <= 0) errors.push("posts_analyzed invalid");
    if (report.liquidity_usd < 0) errors.push("liquidity_usd invalid");
    if (report.final_risk_score < 0 || report.final_risk_score > 100) errors.push("final_risk_score bounds breached");

    console.log("\n===== FULL INTELLIGENCE REPORT =====");
    console.log(JSON.stringify(report, null, 2));
    
    if(errors.length > 0) {
        console.error("\nTEST FAILED VALIDATION CHECKS:");
        console.error(errors);
    }
}

async function start() {
    console.time("Karate Scan");
    await runFullScan();
    console.timeEnd("Karate Scan");
}

start();
