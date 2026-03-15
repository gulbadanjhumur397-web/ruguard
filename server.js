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

// ── Config ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const PYTHON_CMD = process.env.PYTHON_CMD || "python3";
const SCANNER_TIMEOUT_MS = parseInt(process.env.SCANNER_TIMEOUT_MS, 10) || 30000;
const PIPELINE_TIMEOUT_MS = parseInt(process.env.PIPELINE_TIMEOUT_MS, 10) || 60000;

const app = express();

// ── Middleware ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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
async function runPipeline(tokenId) {
    const startTime = Date.now();
    const pipelineLog = [];

    const log = (step, status) => {
        pipelineLog.push({ step, status, elapsed_ms: Date.now() - startTime });
    };

    // 1. Token Scanner (Python)
    let scanner;
    try {
        scanner = await runTokenScanner(tokenId);
        log("TokenScannerAgent", "OK");
    } catch (err) {
        log("TokenScannerAgent", `FAILED: ${err.message}`);
        throw new Error(`TokenScannerAgent failed: ${err.message}`);
    }

    // 2. Blockchain Risk Analysis
    let blockchainRisk;
    try {
        const agent = new BlockchainRiskAnalysisAgent();
        blockchainRisk = agent.analyzeTokenRisk(scanner);
        log("BlockchainRiskAnalysisAgent", "OK");
    } catch (err) {
        log("BlockchainRiskAnalysisAgent", `FAILED: ${err.message}`);
        throw new Error(`BlockchainRiskAnalysisAgent failed: ${err.message}`);
    }

    // 3. Sentiment Analysis (async, with fallback)
    let sentiment;
    try {
        const sentimentAgent = new SentimentAnalysisAgent();
        sentiment = await sentimentAgent.analyzeSentiment({
            token_id: tokenId,
            name: scanner.name || "Unknown Token",
            symbol: scanner.symbol || "UNKNOWN",
        });
        log("SentimentAnalysisAgent", "OK");
    } catch (err) {
        console.warn(`[Pipeline] SentimentAgent failed, using fallback: ${err.message}`);
        sentiment = buildFallbackSentiment(tokenId);
        log("SentimentAnalysisAgent", `FALLBACK: ${err.message}`);
    }

    // 4. Risk Scoring
    let riskScore;
    try {
        const scoringAgent = new RiskScoringAgent();
        riskScore = scoringAgent.calculateRisk({
            scanner,
            blockchain: blockchainRisk,
            sentiment,
        });
        log("RiskScoringAgent", "OK");
    } catch (err) {
        log("RiskScoringAgent", `FAILED: ${err.message}`);
        throw new Error(`RiskScoringAgent failed: ${err.message}`);
    }

    // 5. Rug Predictor
    let prediction;
    try {
        const predictorAgent = new RugPredictorAgent();
        prediction = predictorAgent.predictRisk({
            scanner,
            blockchain_risk: blockchainRisk,
            sentiment,
            risk_score: riskScore,
        });
        log("RugPredictorAgent", "OK");
    } catch (err) {
        log("RugPredictorAgent", `FAILED: ${err.message}`);
        throw new Error(`RugPredictorAgent failed: ${err.message}`);
    }

    // 6. Alert Agent
    let alert;
    try {
        const alertAgent = new AlertAgent();
        alert = alertAgent.generateAlert({
            risk_score: riskScore,
            prediction,
        });
        log("AlertAgent", "OK");
    } catch (err) {
        log("AlertAgent", `FAILED: ${err.message}`);
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
        probability_level: prediction.probability_level,
        alert_triggered: alert.alert_triggered,
        monitoring_status: alert.monitoring_status,
        risk_trend: prediction.risk_trend,
        time_horizon: prediction.time_horizon,
        key_triggers: prediction.key_triggers,
        risk_tags: prediction.risk_tags,
        pipeline_log: pipelineLog,
        execution_time_ms: Date.now() - startTime,
    };

    return finalReport;
}

// ═══════════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════════

// ── Health Check ──────────────────────────────────────────────────
app.get("/", (_req, res) => {
    res.json({
        status: "RugGuard AI running",
        version: "1.0.0",
        endpoints: {
            health: "GET /",
            analyze_get: "GET /analyze/:tokenId",
            analyze_post: "POST /analyze",
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
    console.log(`  Health: http://localhost:${PORT}/`);
    console.log(`  Analyze: http://localhost:${PORT}/analyze/0.0.2283230`);
    console.log(`═══════════════════════════════════════════════════\n`);
});
