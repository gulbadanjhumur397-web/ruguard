/**
 * ═══════════════════════════════════════════════════════════════════
 *  RUGGUARD — CONVERSATIONAL AGENT TEST SUITE
 *  Validates the OpenConvAI + GPT-4 conversational layer
 * ═══════════════════════════════════════════════════════════════════
 */

require("dotenv").config();

const ConversationalAgent = require("./ConversationalAgent");
const ConversationManager = require("./ConversationManager");

// ── Test Helpers ──────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${label}`);
        failed++;
    }
}

// ── Mock Pipeline Report ──────────────────────────────────────────
const MOCK_REPORT = {
    token_id: "0.0.2283230",
    token_name: "SAUCE",
    rug_risk_score: 46,
    predicted_probability: 44,
    alert_level: "MEDIUM",
    security_posture: "CAUTION",
    primary_risk: "Developer activity risk",
    primary_warning: "Moderate risk indicators present — continued monitoring advised.",
    confidence: 70,
    recommendations: [
        "Monitor mint transactions",
        "Track liquidity withdrawals",
        "Watch governance wallet"
    ],
    pipeline_status: "LIVE",
    risk_level: "MEDIUM",
    probability_level: "MODERATE",
    alert_triggered: true,
    monitoring_status: "ACTIVE_MONITORING",
    risk_trend: "STABLE",
    time_horizon: "30-90 days",
    key_triggers: ["Token supply can be increased by admin", "Significant developer inactivity"],
    risk_tags: ["mint_authority", "dev_inactive"],
    execution_time_ms: 4500,
};

// ═══════════════════════════════════════════════════════════════════
//  TEST 1: ConversationManager — Session Management
// ═══════════════════════════════════════════════════════════════════
function testConversationManager() {
    console.log("\n═══ TEST 1: ConversationManager — Session Management ═══\n");

    const mgr = new ConversationManager();

    // Session creation
    const session = mgr.getOrCreateSession("test-session-001");
    assert(session.sessionId === "test-session-001", "Session created with correct ID");
    assert(Array.isArray(session.conversationHistory), "History is an array");
    assert(session.conversationHistory.length === 0, "History starts empty");
    assert(session.lastPipelineReport === null, "No pipeline report initially");

    // Message appending
    mgr.addMessage("test-session-001", "user", "Hello");
    mgr.addMessage("test-session-001", "assistant", "Hi there!");
    const history = mgr.getHistory("test-session-001");
    assert(history.length === 2, "History has 2 messages after adding 2");
    assert(history[0].role === "user", "First message is from user");
    assert(history[1].role === "assistant", "Second message is from assistant");

    // Report caching
    mgr.setReport("test-session-001", MOCK_REPORT, "0.0.2283230", "SAUCE");
    const cached = mgr.getLastReport("test-session-001");
    assert(cached.report !== null, "Report cached successfully");
    assert(cached.tokenId === "0.0.2283230", "Token ID cached correctly");
    assert(cached.tokenName === "SAUCE", "Token name cached correctly");

    // Session reuse
    const session2 = mgr.getOrCreateSession("test-session-001");
    assert(session2.conversationHistory.length === 2, "Existing session reused (not recreated)");

    // Different session
    const session3 = mgr.getOrCreateSession("test-session-002");
    assert(session3.conversationHistory.length === 0, "New session starts fresh");

    mgr.destroy();
    console.log("");
}

// ═══════════════════════════════════════════════════════════════════
//  TEST 2: ConversationalAgent — Token ID Extraction
// ═══════════════════════════════════════════════════════════════════
function testTokenExtraction() {
    console.log("═══ TEST 2: ConversationalAgent — Token Extraction ═══\n");

    const agent = new ConversationalAgent();

    // Positive matches
    assert(agent.extractTokenId("What's the risk of 0.0.2283230?") === "0.0.2283230", "Extracts token ID from question");
    assert(agent.extractTokenId("Analyze token 0.0.786931 please") === "0.0.786931", "Extracts token ID from command");
    assert(agent.extractTokenId("0.0.12345") === "0.0.12345", "Extracts bare token ID");

    // Negative matches
    assert(agent.extractTokenId("What is the risk level?") === null, "Returns null when no token ID");
    assert(agent.extractTokenId("Hello there") === null, "Returns null for greeting");

    // isTokenQuery detection
    assert(agent.isTokenQuery("What's the risk score?") === true, "Detects risk query");
    assert(agent.isTokenQuery("Is this token safe?") === true, "Detects safety query");
    assert(agent.isTokenQuery("What is the rug pull probability?") === true, "Detects rug pull query");
    assert(agent.isTokenQuery("Hello how are you?") === false, "Rejects non-token query");

    console.log("");
}

// ═══════════════════════════════════════════════════════════════════
//  TEST 3: ConversationalAgent — Pipeline Context Formatting
// ═══════════════════════════════════════════════════════════════════
function testContextFormatting() {
    console.log("═══ TEST 3: ConversationalAgent — Context Formatting ═══\n");

    const agent = new ConversationalAgent();

    const context = agent.formatPipelineContext(MOCK_REPORT);
    assert(context.includes("SAUCE"), "Context includes token name");
    assert(context.includes("0.0.2283230"), "Context includes token ID");
    assert(context.includes("46"), "Context includes risk score");
    assert(context.includes("MEDIUM"), "Context includes risk level");
    assert(context.includes("44"), "Context includes rug probability");

    const emptyContext = agent.formatPipelineContext(null);
    assert(emptyContext.includes("No pipeline data"), "Empty context handled gracefully");

    console.log("");
}

// ═══════════════════════════════════════════════════════════════════
//  TEST 4: ConversationalAgent — Fallback Response
// ═══════════════════════════════════════════════════════════════════
function testFallbackResponse() {
    console.log("═══ TEST 4: ConversationalAgent — Fallback Response ═══\n");

    const agent = new ConversationalAgent();

    // Fallback with report data
    const fallback = agent._fallbackResponse("What's the risk?", MOCK_REPORT);
    assert(typeof fallback.message === "string", "Fallback has message string");
    assert(fallback.ai_confidence === 60, "Fallback confidence is 60");
    assert(fallback.alert_generation_mode === "DETERMINISTIC_ONLY", "Fallback mode is DETERMINISTIC_ONLY");
    assert(fallback.message.includes("SAUCE"), "Fallback includes token name");
    assert(fallback.message.includes("46"), "Fallback includes risk score");

    // Fallback without report
    const fallbackNoData = agent._fallbackResponse("Hello");
    assert(fallbackNoData.message.includes("token ID"), "No-data fallback asks for token ID");
    assert(fallbackNoData.ai_confidence === 60, "No-data fallback confidence is 60");

    console.log("");
}

// ═══════════════════════════════════════════════════════════════════
//  TEST 5: ConversationalAgent — GPT-4 Chat (LIVE)
// ═══════════════════════════════════════════════════════════════════
async function testLiveChat() {
    console.log("═══ TEST 5: ConversationalAgent — GPT-4 Chat (LIVE) ═══\n");

    const agent = new ConversationalAgent();

    if (!process.env.OPENAI_API_KEY) {
        console.log("  ⚠️  SKIPPED: OPENAI_API_KEY not set. Set it in .env to run live tests.\n");
        return;
    }

    try {
        // First question about risk
        const result = await agent.chat(
            "What is the risk level for SAUCE token?",
            [],
            MOCK_REPORT
        );

        assert(typeof result.message === "string", "Chat returns a message string");
        assert(result.message.length > 20, "Chat message is substantive (>20 chars)");
        assert(typeof result.ai_confidence === "number", "Chat returns ai_confidence as number");
        assert(result.ai_confidence >= 0 && result.ai_confidence <= 100, "ai_confidence in 0-100 range");
        assert(
            ["HYBRID_AI", "DETERMINISTIC_ONLY"].includes(result.alert_generation_mode),
            "alert_generation_mode is valid"
        );

        console.log(`\n  📝 GPT-4 Response:\n  "${result.message.substring(0, 200)}..."\n`);
        console.log(`  🎯 AI Confidence: ${result.ai_confidence}%`);
        console.log(`  ⚙️  Mode: ${result.alert_generation_mode}\n`);
    } catch (err) {
        console.log(`  ⚠️  Live chat test error: ${err.message}\n`);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  TEST 6: Multi-Turn Conversation (LIVE)
// ═══════════════════════════════════════════════════════════════════
async function testMultiTurnConversation() {
    console.log("═══ TEST 6: Multi-Turn Conversation (LIVE) ═══\n");

    if (!process.env.OPENAI_API_KEY) {
        console.log("  ⚠️  SKIPPED: OPENAI_API_KEY not set.\n");
        return;
    }

    const agent = new ConversationalAgent();
    const mgr = new ConversationManager();
    const sid = "multi-turn-test";

    try {
        // Turn 1: Ask about risk score
        mgr.addMessage(sid, "user", "What's the risk of SAUCE token?");
        const history1 = mgr.getHistory(sid);
        const r1 = await agent.chat("What's the risk of SAUCE token?", history1, MOCK_REPORT);
        mgr.addMessage(sid, "assistant", r1.message);
        assert(r1.message.length > 10, "Turn 1: Got substantive response");

        // Turn 2: Follow-up about rug pull probability
        mgr.addMessage(sid, "user", "What is the rug pull probability?");
        const history2 = mgr.getHistory(sid);
        const r2 = await agent.chat("What is the rug pull probability?", history2, MOCK_REPORT);
        mgr.addMessage(sid, "assistant", r2.message);
        assert(r2.message.length > 10, "Turn 2: Got follow-up response");

        // Turn 3: Ask for recommendations
        mgr.addMessage(sid, "user", "What should I do with SAUCE token?");
        const history3 = mgr.getHistory(sid);
        const r3 = await agent.chat("What should I do with SAUCE token?", history3, MOCK_REPORT);
        mgr.addMessage(sid, "assistant", r3.message);
        assert(r3.message.length > 10, "Turn 3: Got recommendations response");

        // Verify context was maintained
        const finalHistory = mgr.getHistory(sid);
        assert(finalHistory.length === 6, "History has 6 messages (3 turns × 2)");

        console.log(`\n  📝 Turn 1: "${r1.message.substring(0, 100)}..."`);
        console.log(`  📝 Turn 2: "${r2.message.substring(0, 100)}..."`);
        console.log(`  📝 Turn 3: "${r3.message.substring(0, 100)}..."\n`);
    } catch (err) {
        console.log(`  ⚠️  Multi-turn test error: ${err.message}\n`);
    }

    mgr.destroy();
}

// ═══════════════════════════════════════════════════════════════════
//  TEST 7: Confidence Calculation
// ═══════════════════════════════════════════════════════════════════
function testConfidenceCalculation() {
    console.log("═══ TEST 7: Confidence Calculation ═══\n");

    const agent = new ConversationalAgent();

    const conf1 = agent._calculateConfidence(MOCK_REPORT);
    assert(conf1 >= 70 && conf1 <= 100, `Confidence with full report: ${conf1} (expected 70-100)`);

    const conf2 = agent._calculateConfidence(null);
    assert(conf2 === 60, `Confidence with null report: ${conf2} (expected 60)`);

    const conf3 = agent._calculateConfidence({ pipeline_status: "LIVE" });
    assert(conf3 >= 70, `Confidence with minimal report: ${conf3} (expected ≥70)`);

    console.log("");
}

// ═══════════════════════════════════════════════════════════════════
//  RUN ALL TESTS
// ═══════════════════════════════════════════════════════════════════
async function runAllTests() {
    console.log("\n╔═══════════════════════════════════════════════════════╗");
    console.log("║  RugGuard Conversational Agent — Test Suite          ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    // Synchronous tests
    testConversationManager();
    testTokenExtraction();
    testContextFormatting();
    testFallbackResponse();
    testConfidenceCalculation();

    // Async tests (require OpenAI API key)
    await testLiveChat();
    await testMultiTurnConversation();

    // Summary
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log("═══════════════════════════════════════════════════════\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runAllTests().catch(console.error);
