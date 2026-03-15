const SentimentAnalysisAgent = require('./SentimentAnalysisAgent');

async function runTest() {
    console.log("===== RUNNING SENTIMENT RETEST =====");
    
    const agent = new SentimentAnalysisAgent();
    
    const tokenData = {
        token_id: "0.0.786931",
        name: "HSUITE",
        symbol: "HSUITE"
    };
    
    const result = await agent.analyzeSentiment(tokenData);
    
    console.log("===== SENTIMENT RETEST RESULT =====");
    
    // As per requirement, print specific outputs:
    // token_id, posts_analyzed, bullish_percentage, bearish_percentage, community_intelligence_score, dex_listed, liquidity_usd, summary
    const outputResult = {
        token_id: result.token_id,
        posts_analyzed: result.posts_analyzed,
        bullish_percentage: result.bullish_percentage,
        bearish_percentage: result.bearish_percentage,
        community_intelligence_score: result.community_intelligence_score,
        dex_listed: result.dex_listed,
        liquidity_usd: result.liquidity_usd,
        confidence_score: result.confidence_score,
        data_quality: result.data_quality,
        summary: result.summary
    };

    console.log(JSON.stringify(outputResult, null, 2));
    
    console.log("===== VALIDATION CHECKS =====");
    let hasError = false;
    
    if (result.posts_analyzed <= 0) {
        console.log("ERROR: No posts analyzed");
        hasError = true;
    }
        
    if (result.bullish_percentage + result.bearish_percentage > 100) {
        console.log("ERROR: Invalid sentiment math");
        hasError = true;
    }
        
    if (result.community_intelligence_score > 100) {
        console.log("ERROR: Score overflow");
        hasError = true;
    }
    
    if (!hasError) {
        console.log("SUCCESS: Sentiment agent working\n");
    }
}

async function startMultipleTests() {
    console.time("Sentiment Test");
    for (let i = 0; i < 3; i++) {
        console.log(`\nTEST RUN: ${i + 1}`);
        await runTest();
    }
    console.timeEnd("Sentiment Test");
}

startMultipleTests();
