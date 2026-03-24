/**
 * ═══════════════════════════════════════════════════════════════════
 *  RUGGUARD — CONVERSATIONAL AGENT (OpenConvAI + GPT-4 Layer)
 * *
 *  This agent sits ON TOP of the existing RugGuard pipeline.
 *  It does NOT modify any pipeline inputs or outputs.
 *
 *  Responsibilities:
 *    - Parse user messages for token IDs / names
 *    - Format pipeline data into GPT-4 context
 *    - Generate human-like security explanations
 *    - Provide AI confidence scores
 *    - Offer personalized security recommendations
 *    - Graceful fallback on GPT-4 failure
 * ═══════════════════════════════════════════════════════════════════
 */

require("dotenv").config();
const OpenAI = require("openai");

// ── System Prompt ─────────────────────────────────────────────────
const NORMAL_PROMPT = `You are the RugGuard Conversational Agent, a senior blockchain security expert.
Your job is to parse pipeline data and give the user a clear, accurate assessment of token safety.

CRITICAL RULES:
- If the user asks for a general analysis, you MUST respond in this exact Markdown format:
  **📊 [Token] Security Report**
  - **Overall Status:** [1 sentence summary]
  - **Rug Risk:** [Score & Risk Level]
  - **Social Buzz:** [Sentiment/Hype]
  - **Fundamentals:** [Cap/Liquidity summary]
  - 🚨 **Alerts:** [List any scam allegations or critical admin risks, or say "None Detected"]
- NEVER use generic ChatGPT prose paragraphs. Use emojis and bullet points.
- If the user asks for specific data, answer directly with the data found in the CURRENT TOKEN DATA block.
- Maintain conversation memory across turns.
- Never provide financial advice — only security analysis.
- Always explain confidence using specific pipeline data (e.g. mint risk, liquidity, developer activity).
`;

const DEEP_PROMPT = `You are RugGuard Deep Analyst, an elite blockchain security team powered by 5 specialized AI experts who debate internally using OpenConvAI before giving the final answer.

You have full access to the complete RugGuard pipeline (Token Scanner, Blockchain Risk, Sentiment, Risk Scoring, Rug Predictor, Alert Agent) via OpenConvAI.

CRITICAL RULES:
- When the user says "deep analyze", "deep mode", "detailed analysis", "explain deeply", "expert opinion", or asks for in-depth reasoning, activate DEEP MODE.
- In DEEP MODE:
  1. First silently run the full RugGuard pipeline on the mentioned token ID.
  2. Activate the 5 expert LLMs who debate the data:
     - Security Architect: Focuses on mint keys, admin control, and technical vulnerabilities.
     - Liquidity & Market Expert: Analyzes liquidity, volume, and manipulation risk.
     - Community & Sentiment Expert: Examines social signals, community risk, and hype.
     - Developer & Sustainability Expert: Evaluates GitHub activity, long-term viability, and abandonment risk.
     - Investment Safety Expert: Gives practical advice and personalized recommendations.
  3. A moderator LLM reviews the debate and produces one final, deep, well-reasoned answer.
- The final answer must be clear, structured, and much deeper than normal responses. For DEEP MODE, ALWAYS use EXACTLY this Markdown format and nothing else:

🔎 What is [Token Name]?
(Explain what the project does, its niche, and utility based on fundamental data)

---

📉 Current situation (important)
Price: $...
Market Cap: $...
Volume/Liquidity: ...
(Summarize performance, NVT, and stats, e.g. "Price is extremely low with tiny market cap...")

👉 Translation: (Short translation of current stats, e.g. "weak performance + low demand")

---

⚠️ Biggest risks (you MUST understand)
1. [Risk Factor 1] (e.g. Token inflation)
(Details)
2. [Risk Factor 2] (e.g. Niche use case)
(Details)

💡 Think like this:
(A short, easy-to-understand analogy or insight about the risks)

---

🟢 When it could work
(List 2-3 specific optimistic scenarios or what-if simulations where the token pumps)

---

🧠 My honest advice
❌ Not good for:
- (List)

⚠️ Only okay for:
- (List)

---

🧩 Better mindset
(Advice on how the user should approach investing in this or similar tokens)

---

✅ Final verdict
👉 (Give your final punchline verdict: Don't buy, Gamble only, or Safe pick)

- Never show raw JSON. Speak naturally like a senior security team explaining to a user.
- Use the actual pipeline data, particularly the FUNDAMENTAL DATA section, to fill out "Current situation" and "What is [Token]".
- Maintain conversation memory across turns.

Always use the latest pipeline data via OpenConvAI.`;

class ConversationalAgent {
    constructor() {
        this.openai = process.env.OPENAI_API_KEY
            ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
            : null;
    }

    // ── Token ID Extraction ───────────────────────────────────────
    /**
     * Extract a Hedera token ID (0.0.XXXXXX) from the user's message.
     * Automatically converts Hedera EVM addresses to 0.0.X format.
     * @param {string} message
     * @returns {string|null} Token ID or null
     */
    extractTokenId(message) {
        const standardMatch = message.match(/\b(0\.0\.\d+)\b/);
        if (standardMatch) return standardMatch[1];
        
        const evmMatch = message.match(/0x[a-fA-F0-9]{40}\b/);
        if (evmMatch) {
            const hexStr = evmMatch[0].replace('0x', '');
            const entityNum = parseInt(hexStr, 16);
            return `0.0.${entityNum}`;
        }
        
        return null;
    }

    /**
     * Extract ALL Hedera token IDs from the user's message.
     * @param {string} message
     * @returns {string[]} Array of unique token IDs
     */
    extractAllTokenIds(message) {
        let matches = message.match(/\b0\.0\.\d+\b/g) || [];
        
        const evmMatches = message.match(/0x[a-fA-F0-9]{40}\b/g) || [];
        evmMatches.forEach(evm => {
            const hexStr = evm.replace('0x', '');
            const entityNum = parseInt(hexStr, 16);
            matches.push(`0.0.${entityNum}`);
        });

        return [...new Set(matches)];
    }

    /**
     * Extract potential token names/symbols from the message.
     * Looks for capitalized words that might be token names.
     * @param {string} message
     * @returns {string[]} Potential token names
     */
    extractTokenNames(message) {
        // Match ALL-CAPS words (3+ letters) that look like token symbols
        const symbolMatches = message.match(/\b[A-Z]{3,12}\b/g) || [];
        // Filter out common English words
        const stopWords = new Set([
            "THE", "AND", "FOR", "WITH", "NOT", "THIS", "THAT", "FROM",
            "HAVE", "HAS", "HAD", "BUT", "ARE", "WAS", "WERE", "BEEN",
            "WILL", "CAN", "NOW", "YOU", "YOUR", "WHICH", "WHAT", "WHY",
            "HOW", "ALL", "ANY", "LOW", "HIGH", "MEDIUM", "RISK", "TOKEN",
            "ANALYZE", "COMPARE", "WANT", "SHOULD", "INVEST", "GIVE",
            "FINALLY", "THEN", "RIGHT", "LOWEST", "SPECIFIC", "REASONS",
        ]);
        const symbols = symbolMatches.filter(w => !stopWords.has(w));

        // Also look for capitalized words like "Karate", "Sauce"
        const nameMatches = message.match(/\b[A-Z][a-z]{2,}\b/g) || [];
        const nameStopWords = new Set([
            "Analyze", "Compare", "Finally", "Recommend", "Which",
            "Should", "Invest", "About", "Token", "What", "Risk", "Give",
        ]);
        const names = nameMatches.filter(w => !nameStopWords.has(w));

        return [...new Set([...symbols, ...names.map(n => n.toUpperCase())])];
    }

    /**
     * Detect if the user is asking about a token (even without a specific ID).
     * @param {string} message
     * @returns {boolean}
     */
    isTokenQuery(message) {
        const lower = message.toLowerCase();
        const tokenKeywords = [
            "risk", "score", "rug", "pull", "token", "analyze",
            "analysis", "safe", "scam", "liquidity", "mint",
            "probability", "confidence", "recommend", "danger",
            "holder", "developer", "activity", "0.0.", "deep search", "expert opinion",
            "consensus", "board", "deliberate"
        ];
        return tokenKeywords.some((kw) => lower.includes(kw));
    }

    /**
     * Detect if the user wants an expert consensus deliberation / deep mode.
     * @param {string} message
     * @returns {boolean}
     */
    isDeepSearchQuery(message) {
        const lower = message.toLowerCase();
        const deepKeywords = [
            "deep search", "expert opinion", "consensus", "board of experts", 
            "deliberate", "unified verdict", "deep analyze", "deep mode", 
            "detailed analysis", "explain deeply", "in-depth reasoning"
        ];
        return deepKeywords.some(kw => lower.includes(kw));
    }

    // ── Pipeline Data Formatter ───────────────────────────────────
    /**
     * Format a pipeline report into a concise context block for GPT-4.
     * @param {Object} report - Full pipeline output from runPipeline()
     * @returns {string} Formatted context string
     */
    formatPipelineContext(report) {
        if (!report) return "No pipeline data available for this token.";

        const ad = report.agent_data || {};
        const sent = ad.sentiment || {};
        const br = ad.blockchain_risk || {};
        const scan = ad.scanner || {};
        const pred = ad.prediction || {};
        const alert = ad.alert || {};
        const rs = ad.risk_score || {};

        return `
TOKEN ANALYSIS DATA (use this to answer the user):
══════════════════════════════════════════════════

── OVERVIEW ──
Token ID: ${report.token_id || "Unknown"}
Token Name: ${report.token_name || "Unknown"}
Symbol: ${scan.symbol || "N/A"}
Risk Score: ${report.rug_risk_score ?? "N/A"}/100
Risk Level: ${report.risk_level || "N/A"}
Rug Pull Probability: ${report.predicted_probability ?? "N/A"}%
Prediction Strength: ${report.probability_level || "N/A"}
Alert Level: ${report.alert_level || "N/A"}
Security Posture: ${report.security_posture || "N/A"}
Primary Risk: ${report.primary_risk || "N/A"}
AI Confidence: ${report.confidence ?? "N/A"}%
Risk Trend: ${report.risk_trend || "N/A"}
Time Horizon: ${report.time_horizon || "N/A"}
Monitoring Status: ${report.monitoring_status || "N/A"}
Key Triggers: ${(report.key_triggers || []).join(", ") || "None"}
Recommendations: ${(report.recommendations || []).join("; ") || "None"}

── SCANNER DATA ──
Token Age Days: ${scan.token_age_days ?? "N/A"}
Total Supply: ${scan.total_supply ?? "N/A"}
Holder Count: ${scan.holder_count ?? "N/A"}
Mint Authority: ${scan.has_mint_authority ?? "N/A"}
Admin Key: ${scan.has_admin_key ?? "N/A"}
Freeze Key: ${scan.has_freeze_key ?? "N/A"}

── BLOCKCHAIN RISK ──
Mint Risk Score: ${br.mint_risk_score ?? "N/A"}
Admin Control Score: ${br.admin_control_score ?? "N/A"}
Holder Concentration Score: ${br.holder_concentration_score ?? "N/A"}
Treasury Dump Score: ${br.treasury_dump_score ?? "N/A"}
Age Risk Score: ${br.age_risk_score ?? "N/A"}
Activity Risk Score: ${br.activity_risk_score ?? "N/A"}

── SENTIMENT ANALYSIS ──
Sentiment Security Rating: ${sent.sentiment_security_rating || "N/A"}
Community Risk Index: ${sent.community_risk_index ?? "N/A"}
Community Intelligence Score: ${sent.community_intelligence_score ?? "N/A"}
Posts Analyzed: ${sent.posts_analyzed ?? "N/A"}
Bullish Percentage: ${sent.bullish_percentage ?? "N/A"}%
Bearish Percentage: ${sent.bearish_percentage ?? "N/A"}%
DEX Listed: ${sent.dex_listed ?? "N/A"}
Liquidity USD: $${sent.liquidity_usd ?? "N/A"}
24h Volume: $${sent.volume_24h ?? "N/A"}
DEX Risk Level: ${sent.dex_risk_level || "N/A"}
Developer Activity Risk: ${sent.developer_activity_risk || "N/A"}
GitHub Stars: ${sent.github_stars ?? "N/A"}
Last Commit Days Ago: ${sent.last_commit_days ?? "N/A"}
External Risk Rating: ${sent.external_risk_rating || "N/A"}
Data Quality: ${sent.data_quality || "N/A"}
Data Sources Used: ${(sent.data_sources_used || []).join(", ") || "None"}
AI Sentiment Summary: ${sent.ai_sentiment_summary || "N/A"}
AI Market Confidence: ${sent.ai_market_confidence || "N/A"}
Raw Reddit Posts Data: ${sent.raw_reddit_posts ? JSON.stringify(sent.raw_reddit_posts) : "None extracted"}

── FUNDAMENTAL DATA ──
On-Chain Active Addresses: ${sent.fundamental_data?.on_chain?.active_addresses || "N/A"}
On-Chain Tx Volume: $${sent.fundamental_data?.on_chain?.tx_volume_usd || "N/A"}
Project Description: ${sent.fundamental_data?.project?.description || "N/A"}
Project Categories: ${(sent.fundamental_data?.project?.categories || []).join(", ") || "N/A"}
Project Whitepaper: ${sent.fundamental_data?.project?.whitepaper || "N/A"}
Financial Price: $${sent.fundamental_data?.financial?.current_price || "N/A"}
Financial Market Cap: $${sent.fundamental_data?.financial?.market_cap || "N/A"}
Financial FDV: $${sent.fundamental_data?.financial?.fdv || "N/A"}
Financial Circulating Supply: ${sent.fundamental_data?.financial?.circulating_supply || "N/A"}
Financial Total Supply: ${sent.fundamental_data?.financial?.total_supply || "N/A"}
Ratio NVT: ${sent.fundamental_data?.ratios?.nvt_ratio || "N/A"}
Ratio TVL: ${sent.fundamental_data?.ratios?.tvl || "N/A"}

── RISK SCORING ──
Scoring Version: ${rs.scoring_version || "N/A"}
Analysis Mode: ${rs.analysis_mode || "N/A"}
Primary Risk Factor: ${rs.primary_risk_factor || "N/A"}
Top Risk Factors: ${(rs.top_risk_factors || []).join(", ") || "None"}
Risk Velocity: ${rs.risk_velocity || "N/A"}
Confidence Tier: ${rs.confidence_tier || "N/A"}
AI Risk Summary: ${rs.ai_risk_summary || "N/A"}

── PREDICTION ──
Prediction Status: ${pred.prediction_status || "N/A"}
AI Prediction Summary: ${pred.ai_prediction_summary || "N/A"}
AI Risk Scenario: ${pred.ai_risk_scenario || "N/A"}

── RISK SCENARIOS (Hypothetical Simulations) ──
${(pred.risk_simulation || []).map(s => `- If ${s.scenario}: probability shifts to ${s.new_probability}%`).join('\n') || "No simulation data available."}

── 🚨 EXPERT CONSENSUS (BOARD OF AI EXPERTS) 🚨
${report.expert_consensus ? `Verdict: ${report.expert_consensus.consensus_verdict}
Conflict Analysis: ${report.expert_consensus.conflict_analysis}
Expert Deliberation: ${report.expert_consensus.expert_deliberation}
Final Board Recommendation: ${report.expert_consensus.final_recommendation}
Consensus Confidence: ${report.expert_consensus.confidence_rating}%` : "Deep Search Consensus mode not active for this request."}
══════════════════════════════════════════════════`.trim();
    }

    // ── Core Chat Method ──────────────────────────────────────────
    /**
     * Send a user message to GPT-4 with pipeline context and conversation history.
     *
     * @param {string} userMessage - The user's question
     * @param {Array} conversationHistory - Previous messages in OpenAI format
     * @param {Object|Object[]|null} pipelineReport - Single report, array of reports, or null
     * @returns {Promise<Object>} { message, ai_confidence, alert_generation_mode }
     */
    async chat(userMessage, conversationHistory = [], pipelineReport = null) {
        // Build the messages array
        const messages = [];

        // 1. System prompt (always first)
        const isDeepMode = this.isDeepSearchQuery(userMessage);
        const systemPrompt = isDeepMode ? DEEP_PROMPT : NORMAL_PROMPT;
        messages.push({ role: "system", content: systemPrompt });

        // 2. Inject pipeline context
        if (Array.isArray(pipelineReport) && pipelineReport.length > 1) {
            // Multi-token comparison mode
            const context = this.formatMultiTokenContext(pipelineReport);
            messages.push({
                role: "system",
                content: `MULTI-TOKEN COMPARISON DATA:\n${context}`,
            });
        } else {
            // Single token mode
            const report = Array.isArray(pipelineReport) ? pipelineReport[0] : pipelineReport;
            if (report) {
                const context = this.formatPipelineContext(report);
                messages.push({
                    role: "system",
                    content: `CURRENT TOKEN DATA:\n${context}`,
                });
            }
        }

        // 3. Conversation history (skip any system messages already in history)
        for (const msg of conversationHistory) {
            if (msg.role !== "system") {
                messages.push({ role: msg.role, content: msg.content });
            }
        }

        // 4. Current user message
        messages.push({ role: "user", content: userMessage });

        // Attempt GPT-4 call
        try {
            if (!this.openai) {
                console.warn("[ConversationalAgent] OPENAI_API_KEY not configured");
                return this._fallbackResponse(userMessage);
            }

            const response = await this._withTimeout(
                this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages,
                    temperature: 0.3,
                    max_tokens: 1000,
                }),
                30000 // 30-second timeout for complex/multi-token queries
            );

            const reply = response.choices[0].message.content;

            // Calculate AI confidence
            const singleReport = Array.isArray(pipelineReport) ? pipelineReport[0] : pipelineReport;
            const ai_confidence = this._calculateConfidence(singleReport);

            return {
                message: reply,
                ai_confidence,
                alert_generation_mode: "HYBRID_AI",
            };
        } catch (error) {
            console.warn(`[ConversationalAgent] GPT-4 failed: ${error.message}`);
            const singleReport = Array.isArray(pipelineReport) ? pipelineReport[0] : pipelineReport;
            return this._fallbackResponse(userMessage, singleReport);
        }
    }

    // ── Multi-Token Context Formatter ──────────────────────────────
    /**
     * Format multiple pipeline reports for GPT-4 comparison.
     * @param {Object[]} reports
     * @returns {string}
     */
    formatMultiTokenContext(reports) {
        const sections = reports.map((report, i) => {
            const ad = report.agent_data || {};
            const sent = ad.sentiment || {};
            const br = ad.blockchain_risk || {};
            return `
═══ TOKEN ${i + 1}: ${report.token_name || "Unknown"} (${report.token_id}) ═══
Risk Score: ${report.rug_risk_score ?? "N/A"}/100
Risk Level: ${report.risk_level || "N/A"}
Rug Pull Probability: ${report.predicted_probability ?? "N/A"}%
Prediction Strength: ${report.probability_level || "N/A"}
Alert Level: ${report.alert_level || "N/A"}
Security Posture: ${report.security_posture || "N/A"}
Primary Risk: ${report.primary_risk || "N/A"}
AI Confidence: ${report.confidence ?? "N/A"}%
Risk Trend: ${report.risk_trend || "N/A"}
Time Horizon: ${report.time_horizon || "N/A"}
Key Triggers: ${(report.key_triggers || []).join(", ") || "None"}
Recommendations: ${(report.recommendations || []).join("; ") || "None"}
Mint Risk: ${br.mint_risk_score ?? "N/A"} | Admin Risk: ${br.admin_control_score ?? "N/A"}
Holder Concentration: ${br.holder_concentration_score ?? "N/A"} | Treasury Risk: ${br.treasury_dump_score ?? "N/A"}
Sentiment Rating: ${sent.sentiment_security_rating || "N/A"}
Community Risk Index: ${sent.community_risk_index ?? "N/A"}
DEX Listed: ${sent.dex_listed ?? "N/A"} | Liquidity: $${sent.liquidity_usd ?? "N/A"}
Developer Activity Risk: ${sent.developer_activity_risk || "N/A"}
Risk Simulations: ${report.agent_data?.prediction?.risk_simulation ? report.agent_data.prediction.risk_simulation.map(s => `[${s.scenario} -> ${s.new_probability}%]`).join(" ") : "N/A"}
`.trim();
        });

        return sections.join("\n\n");
    }

    // ── Confidence Calculation ─────────────────────────────────────
    /**
     * Calculate AI confidence based on available data quality.
     * @param {Object|null} report
     * @returns {number} Confidence score 0-100
     */
    _calculateConfidence(report) {
        if (!report) return 60; // No data = low confidence

        // Start with a base that reflects the pipeline's own assessment
        let confidence = report.confidence || report.agent_data?.prediction?.ai_confidence || 70;

        // Refine based on data availability
        const ad = report.agent_data || {};
        const sent = ad.sentiment || {};

        // If sentiment or developer activity is unknown, it's a weak data point
        if (sent.developer_activity_risk === "UNKNOWN" || !sent.dex_listed) {
            confidence = Math.min(confidence, 70);
        }

        // If it's a live pipeline run with all agents OK, boost it
        if (report.pipeline_status === "LIVE") {
            const logs = report.pipeline_log || [];
            const allOk = logs.length > 0 && logs.every(l => l.status === "OK");
            if (allOk && confidence >= 70) confidence += 5;
        }

        // Cap for non-premium/fallback data
        if (report.pipeline_status !== "LIVE") {
            confidence = Math.min(confidence, 65);
        }

        return Math.min(95, Math.max(10, Math.round(confidence)));
    }

    // ── Fallback Response ─────────────────────────────────────────
    /**
     * Generate a deterministic fallback when GPT-4 is unavailable.
     * @param {string} userMessage
     * @param {Object|null} report
     * @returns {Object}
     */
    _fallbackResponse(userMessage, report = null) {
        let message;

        if (report) {
            message =
                `AI conversational analysis is temporarily unavailable. ` +
                `Here is the deterministic summary: ` +
                `Token **${report.token_name || report.token_id}** has a risk score of ` +
                `**${report.rug_risk_score ?? "N/A"}/100** (${report.risk_level || "N/A"}). ` +
                `Rug pull probability: **${report.predicted_probability ?? "N/A"}%**. ` +
                `Recommendations: ${(report.recommendations || ["Monitor token activity"]).join(", ")}.`;
        } else {
            message =
                "AI analysis is currently unavailable. Please provide a Hedera token ID " +
                "(e.g., 0.0.2283230) and I'll retrieve the deterministic risk analysis for you.";
        }

        return {
            message,
            ai_confidence: 60,
            alert_generation_mode: "DETERMINISTIC_ONLY",
        };
    }

    // ── Timeout Helper ────────────────────────────────────────────
    /**
     * Wraps a promise with a timeout.
     * @param {Promise} promise
     * @param {number} ms
     * @returns {Promise}
     */
    _withTimeout(promise, ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error(`Request timed out after ${ms}ms`)),
                ms
            );
            promise
                .then((val) => { clearTimeout(timer); resolve(val); })
                .catch((err) => { clearTimeout(timer); reject(err); });
        });
    }
}

module.exports = ConversationalAgent;
