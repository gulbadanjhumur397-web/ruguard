/**
 * ═══════════════════════════════════════════════════════════════════
 *  RUGGUARD — API SERVER
 *  Express.js deployment server for Railway
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Endpoints:
 *    GET  /                  → Health check
 *    GET  /analyze/:tokenId  → Run full pipeline for a token
 *    POST /analyze           → Run full pipeline (JSON body)
 *
 *  Pipeline:
 *    1. TokenScannerAgent        (Python → child_process spawn)
 *    2. BlockchainRiskAnalysisAgent
 *    3. SentimentAnalysisAgent
 *    4. RiskScoringAgent
 *    5. RugPredictorAgent
 *    6. AlertAgent
 * ═══════════════════════════════════════════════════════════════════
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

// ── Agent Imports (no logic changes) ──────────────────────────────
const BlockchainRiskAnalysisAgent = require("./BlockchainRiskAnalysisAgent");
const SentimentAnalysisAgent = require("./SentimentAnalysisAgent");
const RiskScoringAgent = require("./RiskScoringAgent");
const RugPredictorAgent = require("./RugPredictorAgent");
const AlertAgent = require("./AlertAgent");
const ConversationalAgent = require("./ConversationalAgent");
const ConversationManager = require("./ConversationManager");
const ExpertConsensusAgent = require("./ExpertConsensusAgent");

// ── Conversational Layer (OpenConvAI + GPT-4) ────────────────────
const conversationalAgent = new ConversationalAgent();
const conversationManager = new ConversationManager();

// ── ElizaOS Autonomous Runtime (Agentic Brain) ───────────────────
let globalElizaRuntime = null;
(async () => {
    try {
        const { RugGuardElizaRuntime } = await import("./dist/eliza-runtime.mjs");
        globalElizaRuntime = new RugGuardElizaRuntime();
        console.log("🟢 ElizaOS Autonomous Runtime ACTIVE — Proactive Monitor Started!");
    } catch (e) {
        console.warn("🟡 ElizaOS Runtime not compiled yet. Falling back to legacy pipeline.", e.message);
    }
})();

// ── Config ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const PYTHON_CMD = process.env.PYTHON_CMD || "python3";
const SCANNER_TIMEOUT_MS = parseInt(process.env.SCANNER_TIMEOUT_MS, 10) || 30000;
const PIPELINE_TIMEOUT_MS = parseInt(process.env.PIPELINE_TIMEOUT_MS, 10) || 60000;

const app = express();

// ── Middleware ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Serve Frontend ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── Helper: Validate Hedera Token ID ──────────────────────────────
function isValidTokenId(tokenId) {
    return /^0\.0\.\d+$/.test(tokenId);
}

// ── Helper: Run Python Scanner via spawn ──────────────────────────
function runTokenScanner(tokenId) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "token_scanner_agent.py");
        const proc = spawn(PYTHON_CMD, [scriptPath, tokenId], {
            cwd: __dirname,
            timeout: SCANNER_TIMEOUT_MS,
        });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        proc.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        proc.on("close", (code) => {
            if (code !== 0) {
                return reject(
                    new Error(
                        `Python scanner exited with code ${code}. stderr: ${stderr.trim()}`
                    )
                );
            }

            try {
                const result = JSON.parse(stdout.trim());
                if (result.error) {
                    return reject(new Error(`Scanner error: ${result.error}`));
                }
                resolve(result);
            } catch (parseErr) {
                reject(
                    new Error(
                        `Failed to parse scanner output: ${parseErr.message}. Raw: ${stdout.substring(0, 200)}`
                    )
                );
            }
        });

        proc.on("error", (err) => {
            reject(new Error(`Failed to start Python scanner: ${err.message}`));
        });

        // Hard timeout safety net
        setTimeout(() => {
            try {
                proc.kill("SIGTERM");
            } catch (_) {}
            reject(new Error("Python scanner timed out"));
        }, SCANNER_TIMEOUT_MS + 2000);
    });
}

// ── Helper: Build fallback sentiment ──────────────────────────────
function buildFallbackSentiment(tokenId) {
    return {
        token_id: tokenId,
        sentiment_security_rating: "UNKNOWN",
        community_risk_index: 50,
        bullish_percentage: 0,
        bearish_percentage: 0,
        liquidity_usd: 0,
        dex_risk_level: "UNKNOWN",
        data_sources_used: [],
        community_intelligence_score: 50,
        developer_activity_risk: "UNKNOWN",
        dex_listed: false,
        confidence_score: 0,
        data_quality: "LOW",
    };
}

// ── Core: Run Full Pipeline ───────────────────────────────────────
async function runPipeline(tokenId, onStep = null) {
    const startTime = Date.now();
    const pipelineLog = [];
    const TOTAL_STEPS = 6;

    const log = (step, status) => {
        pipelineLog.push({ step, status, elapsed_ms: Date.now() - startTime });
    };

    const emit = (event, data) => {
        if (onStep) {
            try { onStep({ event, ...data, elapsed_ms: Date.now() - startTime }); }
            catch (_) { /* ignore callback errors */ }
        }
    };

    // 1. Token Scanner (Python)
    let scanner;
    try {
        emit("step_start", { step: "TokenScannerAgent", index: 1, total: TOTAL_STEPS, detail: "Fetching token metadata from Hedera Mirror Node..." });
        scanner = await runTokenScanner(tokenId);
        log("TokenScannerAgent", "OK");
        emit("step_complete", { step: "TokenScannerAgent", index: 1, total: TOTAL_STEPS, status: "OK", preview: `Found: ${scanner.name || "Unknown"} (${scanner.symbol || "?"})` });
    } catch (err) {
        log("TokenScannerAgent", `FAILED: ${err.message}`);
        emit("step_error", { step: "TokenScannerAgent", index: 1, total: TOTAL_STEPS, status: "FAILED", error: err.message });
        throw new Error(`TokenScannerAgent failed: ${err.message}`);
    }

    // 2. Blockchain Risk Analysis
    let blockchainRisk;
    try {
        emit("step_start", { step: "BlockchainRiskAnalysisAgent", index: 2, total: TOTAL_STEPS, detail: "Analyzing blockchain risk signals..." });
        const agent = new BlockchainRiskAnalysisAgent();
        blockchainRisk = agent.analyzeTokenRisk(scanner);
        log("BlockchainRiskAnalysisAgent", "OK");
        emit("step_complete", { step: "BlockchainRiskAnalysisAgent", index: 2, total: TOTAL_STEPS, status: "OK", preview: `Admin Risk: ${blockchainRisk.admin_control_risk}, Mint Risk: ${blockchainRisk.mint_risk_level}` });
    } catch (err) {
        log("BlockchainRiskAnalysisAgent", `FAILED: ${err.message}`);
        emit("step_error", { step: "BlockchainRiskAnalysisAgent", index: 2, total: TOTAL_STEPS, status: "FAILED", error: err.message });
        throw new Error(`BlockchainRiskAnalysisAgent failed: ${err.message}`);
    }

    // 3. Sentiment Analysis (async, with fallback)
    let sentiment;
    try {
        emit("step_start", { step: "SentimentAnalysisAgent", index: 3, total: TOTAL_STEPS, detail: "Analyzing market sentiment, DEX data, developer activity..." });
        const sentimentAgent = new SentimentAnalysisAgent();
        sentiment = await sentimentAgent.analyzeSentiment({
            token_id: tokenId,
            name: scanner.name || "Unknown Token",
            symbol: scanner.symbol || "UNKNOWN",
        });
        log("SentimentAnalysisAgent", "OK");
        emit("step_complete", { step: "SentimentAnalysisAgent", index: 3, total: TOTAL_STEPS, status: "OK", preview: `Rating: ${sentiment.sentiment_security_rating || "N/A"}, Community Risk: ${sentiment.community_risk_index ?? "N/A"}` });
    } catch (err) {
        console.warn(`[Pipeline] SentimentAgent failed, using fallback: ${err.message}`);
        sentiment = buildFallbackSentiment(tokenId);
        log("SentimentAnalysisAgent", `FALLBACK: ${err.message}`);
        emit("step_complete", { step: "SentimentAnalysisAgent", index: 3, total: TOTAL_STEPS, status: "FALLBACK", preview: "Using fallback sentiment data" });
    }

    // 4. Risk Scoring
    let riskScore;
    try {
        emit("step_start", { step: "RiskScoringAgent", index: 4, total: TOTAL_STEPS, detail: "Calculating composite risk score with AI reasoning..." });
        const scoringAgent = new RiskScoringAgent();
        riskScore = await scoringAgent.calculateRisk({
            scanner,
            blockchain: blockchainRisk,
            sentiment,
        });
        log("RiskScoringAgent", "OK");
        emit("step_complete", { step: "RiskScoringAgent", index: 4, total: TOTAL_STEPS, status: "OK", preview: `Risk: ${riskScore.rug_risk_score ?? "N/A"}/100 (${riskScore.risk_level || "N/A"})` });
    } catch (err) {
        log("RiskScoringAgent", `FAILED: ${err.message}`);
        emit("step_error", { step: "RiskScoringAgent", index: 4, total: TOTAL_STEPS, status: "FAILED", error: err.message });
        throw new Error(`RiskScoringAgent failed: ${err.message}`);
    }

    // 5. Rug Predictor
    let prediction;
    try {
        emit("step_start", { step: "RugPredictorAgent", index: 5, total: TOTAL_STEPS, detail: "Running rug pull probability prediction with AI..." });
        const predictorAgent = new RugPredictorAgent();
        prediction = await predictorAgent.predictRisk({
            scanner,
            blockchain_risk: blockchainRisk,
            sentiment,
            risk_score: riskScore,
        });
        log("RugPredictorAgent", "OK");
        emit("step_complete", { step: "RugPredictorAgent", index: 5, total: TOTAL_STEPS, status: "OK", preview: `Probability: ${prediction.rug_probability ?? "N/A"}% (${prediction.prediction_strength || "N/A"})` });
    } catch (err) {
        log("RugPredictorAgent", `FAILED: ${err.message}`);
        emit("step_error", { step: "RugPredictorAgent", index: 5, total: TOTAL_STEPS, status: "FAILED", error: err.message });
        throw new Error(`RugPredictorAgent failed: ${err.message}`);
    }

    // 6. Alert Agent
    let alert;
    try {
        emit("step_start", { step: "AlertAgent", index: 6, total: TOTAL_STEPS, detail: "Generating security alerts and recommendations..." });
        const alertAgent = new AlertAgent();
        alert = await alertAgent.generateAlert({
            risk_score: riskScore,
            prediction,
        });
        log("AlertAgent", "OK");
        emit("step_complete", { step: "AlertAgent", index: 6, total: TOTAL_STEPS, status: "OK", preview: `Alert: ${alert.alert_level || "N/A"}, Posture: ${alert.security_posture || "N/A"}` });
    } catch (err) {
        log("AlertAgent", `FAILED: ${err.message}`);
        emit("step_error", { step: "AlertAgent", index: 6, total: TOTAL_STEPS, status: "FAILED", error: err.message });
        throw new Error(`AlertAgent failed: ${err.message}`);
    }

    // ── Build Final Report ────────────────────────────────────────
    const finalReport = {
        token_id: tokenId,
        token_name: scanner.name || "Unknown",
        rug_risk_score: riskScore.rug_risk_score,
        predicted_probability: prediction.rug_probability,
        alert_level: alert.alert_level,
        security_posture: alert.security_posture,
        primary_risk: riskScore.primary_risk_factor,
        primary_warning: alert.primary_warning,
        confidence: prediction.ai_confidence,
        recommendations: alert.recommendations,
        pipeline_status: "LIVE",
        // Extended data
        risk_level: riskScore.risk_level,
        probability_level: prediction.prediction_strength,
        alert_triggered: alert.alert_triggered,
        monitoring_status: alert.monitoring_status,
        risk_trend: prediction.risk_trend,
        time_horizon: prediction.time_horizon,
        key_triggers: prediction.key_triggers,
        risk_tags: prediction.risk_tags,
        pipeline_log: pipelineLog,
        execution_time_ms: Date.now() - startTime,
        // Full agent data for conversational AI access
        agent_data: {
            scanner,
            blockchain_risk: blockchainRisk,
            sentiment,
            risk_score: riskScore,
            prediction,
            alert,
        },
    };

    return finalReport;
}

// ── Helper: Run Deep Search Consensus ─────────────────────────────
async function runDeepSearch(tokenId, onStep = null) {
    const report = await runPipeline(tokenId, onStep);
    const consensusAgent = new ExpertConsensusAgent();
    
    if (onStep) {
        onStep({ event: "step_start", step: "ExpertConsensusAgent", index: 7, total: 7, detail: "Board of AI experts is deliberating on the final verdict..." });
    }
    
    const consensus = await consensusAgent.generateConsensus(report);
    
    if (onStep) {
        onStep({ event: "step_complete", step: "ExpertConsensusAgent", index: 7, total: 7, status: "OK", preview: `Verdict: ${consensus.consensus_verdict || "N/A"}` });
    }

    return {
        ...report,
        expert_consensus: consensus,
        analysis_mode: "DEEP_SEARCH"
    };
}

// ═══════════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════════

// ── Health Check (API) ────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
    res.json({
        status: "RugGuard AI running",
        version: "2.0.0",
        endpoints: {
            dashboard: "GET /",
            health: "GET /api/health",
            analyze_get: "GET /analyze/:tokenId",
            analyze_post: "POST /analyze",
            chat: "POST /chat",
        },
    });
});

// ── GET /analyze/:tokenId ─────────────────────────────────────────
app.get("/analyze/:tokenId", async (req, res) => {
    const { tokenId } = req.params;

    if (!isValidTokenId(tokenId)) {
        return res.status(400).json({
            error: "Invalid token ID format. Expected format: 0.0.XXXXXXX",
        });
    }

    try {
        const report = await runPipeline(tokenId);
        res.json(report);
    } catch (err) {
        console.error(`[API] Pipeline error for ${tokenId}:`, err.message);
        res.status(500).json({
            error: "analysis failed",
            token_id: tokenId,
            details: err.message,
        });
    }
});

// ── GET /analyze/deep/:tokenId ────────────────────────────────────
app.get("/analyze/deep/:tokenId", async (req, res) => {
    const { tokenId } = req.params;

    if (!isValidTokenId(tokenId)) {
        return res.status(400).json({
            error: "Invalid token ID format. Expected format: 0.0.XXXXXXX",
        });
    }

    try {
        const deepReport = await runDeepSearch(tokenId);
        res.json(deepReport);
    } catch (err) {
        console.error(`[API] Deep search error for ${tokenId}:`, err.message);
        res.status(500).json({
            error: "deep search failed",
            token_id: tokenId,
            details: err.message,
        });
    }
});

// ── POST /analyze ─────────────────────────────────────────────────
app.post("/analyze", async (req, res) => {
    const { token_id } = req.body || {};

    if (!token_id) {
        return res.status(400).json({
            error: "Missing token_id in request body. Expected: { \"token_id\": \"0.0.XXXXXXX\" }",
        });
    }

    if (!isValidTokenId(token_id)) {
        return res.status(400).json({
            error: "Invalid token ID format. Expected format: 0.0.XXXXXXX",
        });
    }

    try {
        const report = await runPipeline(token_id);
        res.json(report);
    } catch (err) {
        console.error(`[API] Pipeline error for ${token_id}:`, err.message);
        res.status(500).json({
            error: "analysis failed",
            token_id,
            details: err.message,
        });
    }
});

// ── POST /chat — Conversational AI Interface ─────────────────────
app.post("/chat", async (req, res) => {
    const { session_id, message } = req.body || {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({
            error: "Missing or empty 'message' in request body.",
        });
    }

    const sessionId = session_id || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let tokensAnalyzed = [];

    try {
        // 1. Extract token IDs and names from the message
        const tokenIds = conversationalAgent.extractAllTokenIds(message);
        const tokenNames = conversationalAgent.extractTokenNames(message);

        // 2. Resolve token names to IDs via the registry
        const resolvedIds = new Set(tokenIds);
        for (const name of tokenNames) {
            const id = conversationManager.resolveTokenName(name);
            if (id) resolvedIds.add(id);
        }

        // 3. Run pipeline for each new token (use cache for already-analyzed tokens)
        const allReports = [];

        for (const tokenId of resolvedIds) {
            if (!isValidTokenId(tokenId)) continue;

            // Check session cache first
            let report = conversationManager.getReportByTokenId(sessionId, tokenId);

            if (!report) {
                // Run pipeline for new token
                try {
                    const isDeepSearch = conversationalAgent.isDeepSearchQuery(message);
                    if (isDeepSearch) {
                        console.log(`[Chat] Running Deep Search Expert Consensus for ${tokenId}...`);
                        report = await runDeepSearch(tokenId);
                    } else {
                        report = await runPipeline(tokenId);
                    }
                    conversationManager.setReport(sessionId, report, tokenId);
                    tokensAnalyzed.push(tokenId);
                } catch (pipeErr) {
                    console.warn(`[Chat] Pipeline failed for ${tokenId}: ${pipeErr.message}`);
                }
            } else {
                tokensAnalyzed.push(tokenId);
            }

            if (report) allReports.push(report);
        }

        // 4. If no new tokens found, fall back to all cached reports or last report
        let reportForChat;
        if (allReports.length > 0) {
            reportForChat = allReports.length === 1 ? allReports[0] : allReports;
        } else {
            // Check if user is asking about previously analyzed tokens by name
            const sessionReports = conversationManager.getAllReports(sessionId);
            if (sessionReports.size > 1 && tokenNames.length > 0) {
                // User may be asking to compare cached tokens
                reportForChat = [...sessionReports.values()];
            } else {
                const cached = conversationManager.getLastReport(sessionId);
                reportForChat = cached.report;
                if (cached.tokenId) tokensAnalyzed.push(cached.tokenId);
            }
        }

        // 5. Record user message in history
        conversationManager.addMessage(sessionId, "user", message);

        // 6. Get conversation history
        const history = conversationManager.getHistory(sessionId);

        // 7. Generate conversational response
        let aiReplyMessage = "";
        let finalConfidence = 80;
        let finalMode = "HYBRID_AI";

        if (globalElizaRuntime) {
            // ROUTE THROUGH NEW ELIZA OS BRAIN
            aiReplyMessage = await globalElizaRuntime.executeChat(sessionId, message);
            finalMode = "ELIZA_OS_AUTONOMOUS";
        } else {
            // ROUTE THROUGH OLD PIPELINE
            const result = await conversationalAgent.chat(message, history, reportForChat);
            aiReplyMessage = result.message;
            finalConfidence = result.ai_confidence;
            finalMode = result.alert_generation_mode;
        }

        // 8. Record assistant response in history
        conversationManager.addMessage(sessionId, "assistant", aiReplyMessage);

        res.json({
            session_id: sessionId,
            reply: aiReplyMessage,
            ai_confidence: finalConfidence,
            alert_generation_mode: finalMode,
            token_analyzed: tokensAnalyzed.length === 1 ? tokensAnalyzed[0] : tokensAnalyzed,
            tokens_compared: allReports.length > 1 ? allReports.length : undefined,
        });
    } catch (err) {
        console.error(`[Chat] Error:`, err.message);
        res.status(500).json({
            session_id: sessionId,
            reply: "I'm sorry, I encountered an error processing your request. Please try again.",
            ai_confidence: 0,
            alert_generation_mode: "ERROR",
            token_analyzed: tokensAnalyzed,
            error: err.message,
        });
    }
});

// ── POST /chat/stream — Automation Mode (SSE) ────────────────────
app.post("/chat/stream", async (req, res) => {
    const { session_id, message } = req.body || {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Missing or empty 'message'." });
    }

    const sessionId = session_id || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // Establish SSE connection immediately

    const sseEmit = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let tokensAnalyzed = [];

    try {
        const tokenIds = conversationalAgent.extractAllTokenIds(message);
        const tokenNames = conversationalAgent.extractTokenNames(message);

        const resolvedIds = new Set(tokenIds);
        for (const name of tokenNames) {
            const id = conversationManager.resolveTokenName(name);
            if (id) resolvedIds.add(id);
        }

        const allReports = [];

        for (const tokenId of resolvedIds) {
            if (!isValidTokenId(tokenId)) continue;

            let report = conversationManager.getReportByTokenId(sessionId, tokenId);

            if (!report) {
                try {
                    // Stream pipeline progress via onStep callback
                    report = await runPipeline(tokenId, (stepData) => {
                        // stepData contains: { event, step, index, total, detail, preview, error, elapsed_ms }
                        sseEmit(stepData.event, stepData);
                    });
                    conversationManager.setReport(sessionId, report, tokenId);
                    tokensAnalyzed.push(tokenId);
                } catch (pipeErr) {
                    console.warn(`[Chat Stream] Pipeline failed for ${tokenId}: ${pipeErr.message}`);
                }
            } else {
                tokensAnalyzed.push(tokenId);
                // Simulate fast pipeline steps for cached reports so UI still shows workflow
                const fakeSteps = ["TokenScannerAgent", "BlockchainRiskAnalysisAgent", "SentimentAnalysisAgent", "RiskScoringAgent", "RugPredictorAgent", "AlertAgent"];
                for (let i = 0; i < fakeSteps.length; i++) {
                    sseEmit("step_complete", { step: fakeSteps[i], index: i + 1, total: 6, status: "CACHED", preview: "Using cached data..." });
                }
            }

            if (report) allReports.push(report);
        }

        let reportForChat;
        if (allReports.length > 0) {
            reportForChat = allReports.length === 1 ? allReports[0] : allReports;
        } else {
            const sessionReports = conversationManager.getAllReports(sessionId);
            if (sessionReports.size > 1 && tokenNames.length > 0) {
                reportForChat = [...sessionReports.values()];
            } else {
                const cached = conversationManager.getLastReport(sessionId);
                reportForChat = cached.report;
                if (cached.tokenId) tokensAnalyzed.push(cached.tokenId);
            }
        }

        conversationManager.addMessage(sessionId, "user", message);
        const history = conversationManager.getHistory(sessionId);

        // Notify UI that AI is thinking
        sseEmit("ai_thinking", { message: "Generating conversational response..." });

        const result = await conversationalAgent.chat(message, history, reportForChat);

        conversationManager.addMessage(sessionId, "assistant", result.message);

        // Send final response
        sseEmit("ai_response", {
            session_id: sessionId,
            reply: result.message,
            ai_confidence: result.ai_confidence,
            alert_generation_mode: result.alert_generation_mode,
            token_analyzed: tokensAnalyzed.length === 1 ? tokensAnalyzed[0] : tokensAnalyzed,
            tokens_compared: allReports.length > 1 ? allReports.length : undefined,
        });

    } catch (err) {
        console.error(`[Chat Stream] Error:`, err.message);
        sseEmit("ai_response", {
            session_id: sessionId,
            reply: "I'm sorry, an error occurred during automation mode processing.",
            ai_confidence: 0,
            alert_generation_mode: "ERROR",
            error: err.message,
        });
    } finally {
        res.end();
    }
});

// ── Global error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error("[Server] Unhandled error:", err.message);
    res.status(500).json({
        error: "Internal server error",
        details: err.message,
    });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  RugGuard AI Security Pipeline — LIVE`);
    console.log(`  Port: ${PORT}`);
    console.log(`  Dashboard: http://localhost:${PORT}/`);
    console.log(`  Health:    http://localhost:${PORT}/api/health`);
    console.log(`  Analyze:   http://localhost:${PORT}/analyze/0.0.2283230`);
    console.log(`═══════════════════════════════════════════════════\n`);
});
