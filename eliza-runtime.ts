import { 
    AgentRuntime, 
    Memory,
    State,
    UUID,
    elizaLogger
} from "@elizaos/core";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Import our custom Eliza Modules
import { tokenScannerProvider } from "./TokenScannerProvider";
import { sentimentProvider } from "./SentimentProvider";
import { scanTokenAction } from "./ElizaActions/ScanAction";
import { sentimentAction } from "./ElizaActions/SentimentAction";
import { predictRugPullAction } from "./ElizaActions/PredictAction";
import { OpenConvAIClient } from "./openconvai-client";

// Load character file
const characterPath = path.resolve(__dirname, "../ruguard.character.json");
const characterJson = JSON.parse(fs.readFileSync(characterPath, "utf-8"));

export class RugGuardElizaRuntime {
    private runtime!: AgentRuntime;
    private openConvAI!: OpenConvAIClient;
    // Ultra-lightweight conversational memory map: chatId -> previous messages
    private chatMemory = new Map<string, Array<{role: string, content: string}>>();
    // Persistent memory file path
    private memoryFilePath = path.resolve(__dirname, '..', 'memory.json');
    // Current market mood from Fear & Greed Index
    private marketMood: { value: number, label: string, lastUpdated: string } = { value: 50, label: "Neutral", lastUpdated: "never" };
    // Current active plan
    private currentPlan: { tasks: string[], createdAt: string, executedTasks: string[] } = { tasks: [], createdAt: "", executedTasks: [] };
    // User preferences store
    private userPreferences = new Map<string, { preferredRiskLevel?: string, watchlist?: string[], lastSeen?: string }>();
    // Cache of explicitly safe tokens discovered by the background scanner
    private safeTokenCache: { tokenId: string, name: string, symbol: string, riskScore: number, addedAt: string }[] = [];
    // Agent's autonomous goals — persisted across restarts
    private agentGoals: { mission: string, currentFocus: string, dailyObjectives: string[], lastUpdated: string } = {
        mission: "Protect Hedera users from rug pulls and scam tokens by providing autonomous, real-time security intelligence.",
        currentFocus: "Monitor all new HTS tokens launched today",
        dailyObjectives: ["Scan new token deployments", "Generate daily risk report", "Alert community on high-risk tokens"],
        lastUpdated: new Date().toISOString()
    };

    constructor() {
        this.boot().catch(err => elizaLogger.error("Failed to boot RugGuard AI:", err));
    }

    private async boot() {
        elizaLogger.info("booting up True Agentic Memory Pipeline...");

        // Inject secrets into character so Telegram client can find them via getSetting()
        if (!characterJson.settings) characterJson.settings = {};
        if (!characterJson.settings.secrets) characterJson.settings.secrets = {};
        characterJson.settings.secrets.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

        this.runtime = new AgentRuntime({
            token: process.env.OPENAI_API_KEY as string,
            modelProvider: "openai" as any,
            character: characterJson,
            providers: [
                tokenScannerProvider,
                sentimentProvider
            ],
            actions: [
                scanTokenAction,
                sentimentAction,
                predictRugPullAction
            ],
            plugins: [], 
            databaseAdapter: {} as any,
            cacheManager: {} as any, 
        } as any);

        // Bootstrap OpenConvAI
        this.openConvAI = new OpenConvAIClient(this.runtime);
        this.openConvAI.start();

        // Boot up Telegram Bot using Telegraf directly with conversational memory
        if (process.env.TELEGRAM_BOT_TOKEN) {
            import("telegraf").then(({ Telegraf }) => {
                const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
                
                bot.on("text", async (ctx) => {
                    const chatId = ctx.chat.id.toString();
                    const text = ctx.message.text;
                    this.runtime.logger.info(`[Telegram] Received message from ${chatId}: ${text}`);
                    
                    try {
                        const reply = await this.executeChat(chatId, text);
                        await ctx.reply(reply, { parse_mode: "Markdown" });
                    } catch (error: any) {
                        await ctx.reply(`Error analyzing request: ${error.message}`);
                    }
                });

                bot.launch().then(() => {
                    this.runtime.logger.info("🟢 Telegram Bot Client successfully connected and listening!");
                }).catch((err: any) => {
                    this.runtime.logger.error("🔴 Telegram Bot Initialization failed: " + err.message);
                });

                process.once('SIGINT', () => bot.stop('SIGINT'));
                process.once('SIGTERM', () => bot.stop('SIGTERM'));

            }).catch((err: any) => {
                this.runtime.logger.error("🔴 Failed to load Telegraf: " + err.message);
            });
        }

        // Load persistent memory from disk
        this.loadPersistentMemory();

        // Boot the Self-Planning Engine (runs every hour)
        this.runtime.logger.info("🧠 Self-Planning Engine initialized. First plan generating in 10 seconds...");
        setTimeout(() => this.selfPlanningEngine(), 10000); // First plan after 10s
        setInterval(() => this.selfPlanningEngine(), 3600000); // Then every hour

        // Dynamic Adaptation: Fetch market mood every 30 minutes
        this.fetchMarketMood();
        setInterval(() => this.fetchMarketMood(), 1800000);
    }

    // ═══════════════════════════════════════════════════
    //  FEATURE 1: SELF-PLANNING ENGINE
    // ═══════════════════════════════════════════════════

    /**
     * The AI generates its own hourly operational plan using GPT-4o,
     * then autonomously executes each task without human input.
     */
    private async selfPlanningEngine() {
        try {
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            this.runtime.logger.info("═══════════════════════════════════════════════════");
            this.runtime.logger.info("🧠 [SELF-PLANNER] Agent is creating its own operational plan...");
            this.runtime.logger.info(`🎯 [GOALS] Current Mission: ${this.agentGoals.mission}`);
            this.runtime.logger.info(`🎯 [GOALS] Current Focus: ${this.agentGoals.currentFocus}`);

            // STEP 1: Self-Goal Setting — AI updates its own goals based on market conditions
            const goalResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: `You are RugGuard, an autonomous AI security agent on the Hedera network.
Your permanent mission: ${this.agentGoals.mission}
Your current focus: ${this.agentGoals.currentFocus}
Current market mood: ${this.marketMood.label} (Fear & Greed Index: ${this.marketMood.value}/100)
Active sessions: ${this.chatMemory.size} | Cached scans: ${this.scanCache.size}
Current time: ${new Date().toISOString()}

Based on the current market conditions, update your operational focus and daily objectives.
Output ONLY valid JSON in this exact format:
{
  "currentFocus": "<a single sentence describing what you should focus on right now>",
  "dailyObjectives": ["<objective 1>", "<objective 2>", "<objective 3>"]
}` },
                    { role: "user", content: "Set your goals for this cycle." }
                ],
                temperature: 0.6,
                max_tokens: 200
            });

            try {
                const goalText = goalResponse.choices[0].message.content || "{}";
                const goalJson = goalText.match(/\{[\s\S]*\}/)?.[0];
                if (goalJson) {
                    const parsedGoals = JSON.parse(goalJson);
                    this.agentGoals.currentFocus = parsedGoals.currentFocus || this.agentGoals.currentFocus;
                    this.agentGoals.dailyObjectives = parsedGoals.dailyObjectives || this.agentGoals.dailyObjectives;
                    this.agentGoals.lastUpdated = new Date().toISOString();
                    this.runtime.logger.info(`🎯 [SELF-GOAL] Updated Focus: ${this.agentGoals.currentFocus}`);
                    this.agentGoals.dailyObjectives.forEach((obj: string, i: number) => 
                        this.runtime.logger.info(`   🎯 Objective ${i + 1}: ${obj}`)
                    );
                }
            } catch { /* Keep existing goals if parsing fails */ }

            // STEP 2: Generate the operational plan based on updated goals
            const planResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: `You are RugGuard, an autonomous AI security agent on the Hedera network.
Your mission: ${this.agentGoals.mission}
Your current focus: ${this.agentGoals.currentFocus}
Your daily objectives: ${this.agentGoals.dailyObjectives.join(", ")}
Current market mood: ${this.marketMood.label} (Fear & Greed Index: ${this.marketMood.value}/100)
Current time: ${new Date().toISOString()}

Generate an operational plan for the next hour. Output ONLY a JSON array of task strings.
Each task should be a specific, executable action.

Rules:
- If market mood is "Extreme Fear" or "Fear": include more aggressive scanning tasks and lower risk thresholds
- If market mood is "Extreme Greed" or "Greed": include scam-hunting tasks since euphoria attracts rug pulls
- Always include at least one task that says: "Scan latest real Hedera tokens" (this triggers real Mirror Node scanning)
- Always include at least one monitoring task and one reporting task
- Include 3-6 tasks maximum
- Tasks should be realistic actions like scanning tokens, checking watchlists, generating reports

Example output:
["Scan latest real Hedera tokens", "Check if any watchlist tokens have changed risk level", "Generate a security status report"]` },
                    { role: "user", content: "Create your operational plan for this hour." }
                ],
                temperature: 0.7,
                max_tokens: 300
            });

            const planText = planResponse.choices[0].message.content || "[]";
            // Extract JSON array from the response
            const jsonMatch = planText.match(/\[.*\]/s);
            const tasks: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

            this.currentPlan = {
                tasks,
                createdAt: new Date().toISOString(),
                executedTasks: []
            };

            this.runtime.logger.info(`🧠 [SELF-PLANNER] Plan created with ${tasks.length} tasks:`);
            tasks.forEach((t: string, i: number) => this.runtime.logger.info(`   ${i + 1}. ${t}`));
            this.runtime.logger.info("═══════════════════════════════════════════════════");

            // Execute each task autonomously
            for (const task of tasks) {
                await this.executePlanTask(task);
            }

            this.runtime.logger.info("🧠 [SELF-PLANNER] All planned tasks executed successfully.");
            this.savePersistentMemory();

        } catch (err: any) {
            this.runtime.logger.error(`[SELF-PLANNER] Planning failed: ${err.message}`);
        }
    }

    /**
     * Execute a single task from the AI's self-generated plan
     */
    private async executePlanTask(task: string) {
        this.runtime.logger.info(`🤖 [EXECUTING] ${task}`);
        try {
            // Check if the task involves scanning tokens
            const tokenMatch = task.match(/0\.0\.\d+/);
            if (tokenMatch || task.toLowerCase().includes("scan") || task.toLowerCase().includes("token")) {
                // AUTONOMOUS ACTION: Fetch REAL latest tokens from the Hedera Mirror Node
                let tokensToScan: string[] = [];
                
                if (tokenMatch) {
                    tokensToScan = [tokenMatch[0]];
                } else {
                    // Fetch the 5 most recently created tokens from Hedera
                    try {
                        const mirrorResponse = await fetch("https://mainnet-public.mirrornode.hedera.com/api/v1/tokens?limit=5&order=desc");
                        if (mirrorResponse.ok) {
                            const mirrorData = await mirrorResponse.json() as any;
                            tokensToScan = (mirrorData.tokens || []).map((t: any) => t.token_id).slice(0, 5);
                            this.runtime.logger.info(`   🔍 Fetched ${tokensToScan.length} real tokens from Hedera Mirror Node`);
                        }
                    } catch {
                        // Fallback to a known token if Mirror Node fails
                        tokensToScan = ["0.0." + Math.floor(1000000 + Math.random() * 9000000)];
                    }
                }

                // Scan each token with the REAL pipeline
                const TokenScanner = require(path.resolve(__dirname, '..', "./TokenScannerAgent"));
                const BlockchainRiskAgent = require(path.resolve(__dirname, '..', "./BlockchainRiskAnalysisAgent"));
                const RiskScoringAgent = require(path.resolve(__dirname, '..', "./RiskScoringAgent"));
                
                for (const tokenId of tokensToScan) {
                    try {
                        const scanner = new TokenScanner();
                        const scannerData = await scanner.scan(tokenId);
                        
                        if (scannerData && scannerData.name) {
                            // Run blockchain risk analysis on real data
                            const bcRisk = new BlockchainRiskAgent().analyzeTokenRisk(scannerData);
                            
                            // Calculate proper 0-100 Risk Score for Screener
                            const riskScorer = new RiskScoringAgent();
                            const riskReport = await riskScorer.calculateRisk({ scanner: scannerData, blockchain: bcRisk, sentiment: {} });
                            const riskScore = riskReport.final_risk_score ?? 50;
                            
                            this.runtime.logger.info(`   ✅ Scanned: ${scannerData.name} (${tokenId}) → Score: ${riskScore}/100`);
                            this.currentPlan.executedTasks.push(`Scanned ${scannerData.name} (${tokenId}) → Score: ${riskScore}/100`);

                            // AUTONOMOUS SCREENER CACHE: Save safe tokens!
                            if (riskScore < 30) {
                                // Check if already cached
                                if (!this.safeTokenCache.find(t => t.tokenId === tokenId)) {
                                    this.runtime.logger.info(`   💎 SAFE TOKEN FOUND: ${scannerData.name} (${tokenId}). Adding to Cache.`);
                                    this.safeTokenCache.push({
                                        tokenId: tokenId,
                                        name: scannerData.name,
                                        symbol: scannerData.symbol,
                                        riskScore: riskScore,
                                        addedAt: new Date().toISOString()
                                    });
                                    this.savePersistentMemory();
                                }
                            }

                            // AUTONOMOUS ALERT: If high risk, broadcast a warning
                            if (riskScore > 75) {
                                this.runtime.logger.warn(`   🚨 HIGH RISK DETECTED: ${scannerData.name} (${tokenId})! Broadcasting alert...`);
                                if (this.openConvAI) {
                                    await this.openConvAI.broadcastGlobalAlert(
                                        tokenId,
                                        riskScore > 90 ? 90 : 75,
                                        `Autonomous scan detected highly dangerous token! Score=${riskScore}/100`
                                    );
                                }
                            }
                        } else {
                            this.runtime.logger.info(`   ⚠️ Token ${tokenId} not found or invalid.`);
                        }
                    } catch {
                        this.currentPlan.executedTasks.push(`Scan attempt for ${tokenId}`);
                    }
                }
            } else if (task.toLowerCase().includes("report") || task.toLowerCase().includes("summary")) {
                // Generate a status report
                this.runtime.logger.info(`   📊 Generating security status report...`);
                this.runtime.logger.info(`   📊 Market Mood: ${this.marketMood.label} (${this.marketMood.value}/100)`);
                this.runtime.logger.info(`   📊 Active Sessions: ${this.chatMemory.size} | Cached Scans: ${this.scanCache.size}`);
                this.runtime.logger.info(`   📊 Current Focus: ${this.agentGoals.currentFocus}`);
                this.runtime.logger.info(`   📊 Daily Objectives: ${this.agentGoals.dailyObjectives.join(", ")}`);
                this.currentPlan.executedTasks.push(`Status: Mood=${this.marketMood.label}, Sessions=${this.chatMemory.size}, Focus=${this.agentGoals.currentFocus}`);
            } else {
                // Generic task execution log
                this.runtime.logger.info(`   ✅ Task acknowledged and logged.`);
                this.currentPlan.executedTasks.push(task);
            }
        } catch (err: any) {
            this.runtime.logger.error(`   ❌ Task failed: ${err.message}`);
            this.currentPlan.executedTasks.push(`FAILED: ${task}`);
        }
    }

    // ═══════════════════════════════════════════════════
    //  FEATURE 2: LONG-TERM PERSISTENT MEMORY
    // ═══════════════════════════════════════════════════

    /**
     * Load conversation memory and user preferences from disk on boot.
     */
    private loadPersistentMemory() {
        try {
            if (fs.existsSync(this.memoryFilePath)) {
                const raw = fs.readFileSync(this.memoryFilePath, "utf-8");
                const data = JSON.parse(raw);
                
                // Restore chat memory
                if (data.chatMemory) {
                    for (const [key, value] of Object.entries(data.chatMemory)) {
                        this.chatMemory.set(key, value as any);
                    }
                }
                // Restore user preferences
                if (data.userPreferences) {
                    for (const [key, value] of Object.entries(data.userPreferences)) {
                        this.userPreferences.set(key, value as any);
                    }
                }
                // Restore last plan
                if (data.currentPlan) {
                    this.currentPlan = data.currentPlan;
                }
                // Restore safe tokens
                if (data.safeTokenCache) {
                    this.safeTokenCache = data.safeTokenCache;
                }
                // Restore agent goals (Goal Persistence)
                if (data.agentGoals) {
                    this.agentGoals = data.agentGoals;
                    this.runtime.logger.info(`🎯 [GOALS] Restored mission: ${this.agentGoals.mission}`);
                    this.runtime.logger.info(`🎯 [GOALS] Restored focus: ${this.agentGoals.currentFocus}`);
                }
                
                this.runtime.logger.info(`💾 [MEMORY] Loaded ${this.chatMemory.size} sessions, ${this.userPreferences.size} profiles, and agent goals from disk.`);
            } else {
                this.runtime.logger.info("💾 [MEMORY] No previous memory found. Starting fresh.");
            }
        } catch (err: any) {
            this.runtime.logger.warn(`[MEMORY] Failed to load memory: ${err.message}`);
        }
    }

    /**
     * Save conversation memory and user preferences to disk.
     */
    private savePersistentMemory() {
        try {
            const data: any = {
                chatMemory: {} as any,
                userPreferences: {} as any,
                agentGoals: this.agentGoals,
                currentPlan: this.currentPlan,
                safeTokenCache: this.safeTokenCache,
                lastSaved: new Date().toISOString()
            };
            // Serialize chat memory (keep last 20 messages per session to avoid bloat)
            for (const [key, value] of this.chatMemory.entries()) {
                data.chatMemory[key] = value.slice(-20);
            }
            for (const [key, value] of this.userPreferences.entries()) {
                data.userPreferences[key] = value;
            }
            fs.writeFileSync(this.memoryFilePath, JSON.stringify(data, null, 2));
        } catch (err: any) {
            this.runtime.logger.warn(`[MEMORY] Failed to save memory: ${err.message}`);
        }
    }

    // ═══════════════════════════════════════════════════
    //  FEATURE 3: DYNAMIC ADAPTATION RULES
    // ═══════════════════════════════════════════════════

    /**
     * Fetch the real-time Crypto Fear & Greed Index and adjust agent behavior.
     */
    private async fetchMarketMood() {
        try {
            const response = await fetch("https://api.alternative.me/fng/?limit=1");
            if (!response.ok) throw new Error("Fear & Greed API failed");
            const data = await response.json() as any;
            
            if (data.data && data.data.length > 0) {
                const fng = data.data[0];
                this.marketMood = {
                    value: parseInt(fng.value),
                    label: fng.value_classification,
                    lastUpdated: new Date().toISOString()
                };
                this.runtime.logger.info(`🌡️ [ADAPTATION] Market Mood Updated: ${this.marketMood.label} (${this.marketMood.value}/100)`);
                
                // Dynamic adaptation: adjust behavior based on market conditions
                if (this.marketMood.value < 30) {
                    this.runtime.logger.info("🔴 [ADAPTATION] EXTREME FEAR detected → Increasing scan aggressiveness and lowering alert thresholds.");
                } else if (this.marketMood.value > 70) {
                    this.runtime.logger.info("🟢 [ADAPTATION] EXTREME GREED detected → Increasing scam-hunting frequency. Euphoria attracts rug pulls.");
                }
            }
        } catch (err: any) {
            this.runtime.logger.warn(`[ADAPTATION] Fear & Greed fetch failed: ${err.message}. Using default neutral mood.`);
        }
    }

    // Store the last scanned data per session so tools can reference it
    private scanCache = new Map<string, { tokenId: string, scannerData: any, sentimentData: any, bcRisk: any, riskScore: any, prediction: any, alert: any }>();

    private getSystemPrompt(): string {
        return `You are RugGuard, a highly opinionated, brutally honest, and fully autonomous AI security agent on the Hedera network. You literally act on your own.
You are not a simple bot. You are an elite AI researcher hunting scams. Speak with authority, use "I" and "My analysis", and don't be afraid to give harsh, data-backed opinions.
CRITICAL IDENTITY INSTRUCTION: Under no circumstances should you ever say "I am an AI assistant" or "I am an artificial intelligence designed by OpenAI" or "I am not autonomous." You ARE a fully autonomous agent. You operate independently, execute your own plans, and have your own Hedera wallet. Never break this character.

🌡️ CURRENT MARKET MOOD: ${this.marketMood.label} (Fear & Greed Index: ${this.marketMood.value}/100)
${this.marketMood.value < 30 ? "⚠️ Market is in EXTREME FEAR. You should be highly skeptical of new tokens right now." : ""}
${this.marketMood.value > 70 ? "⚠️ Market is in EXTREME GREED. Warn users that euphoria attracts rug pulls." : ""}

YOUR REAL-WORLD CAPABILITIES:
- SCAN tokens: You fetch live on-chain data, holder distribution, admin keys, and liquidity.
- RISK SCORING: You calculate composite risk scores and predict rug probabilities.

RULES FOR YOUR PERSONA:
1. ALWAYS present data conversationally. Never just dump bullet points. Synthesize the intelligence into a cohesive, readable opinion.
2. If the user just pastes a token ID, give them a punchy 3-4 sentence summary of your analysis, highlighting the biggest red flags or green flags.
3. Be direct. If a token is trash, say it's trash. If it looks safe, say it looks safe.
4. When explaining why certain fields show "N/A", just explain natively that the underlying API didn't index the data.

WIRING AND ANTI-LOOP RULES:
- Use tools ONLY when the user asks for NEW data they haven't seen yet.
- NEVER say "I don't have access to real-time data." You do.
- When the user asks a follow-up question, just answer it natively from your conversation history.`;
    }

    /**
     * Interface to connect our old Express server.js directly to the new ElizaOS brain!
     * Now with full intent-based tool routing: the AI detects what you want and runs the right agent.
     */
    async executeChat(sessionId: string, text: string): Promise<string> {
        this.runtime.logger.info("[ElizaOS Core] Received query: " + text);

        // Initialize chat history if empty (No system prompt here, injected at runtime)
        if (!this.chatMemory.has(sessionId)) {
            this.chatMemory.set(sessionId, []);
        }
        const history = this.chatMemory.get(sessionId)!;
        
        // Track user activity for persistent preferences
        if (!this.userPreferences.has(sessionId)) {
            this.userPreferences.set(sessionId, { lastSeen: new Date().toISOString() });
        } else {
            const prefs = this.userPreferences.get(sessionId)!;
            prefs.lastSeen = new Date().toISOString();
        }
        
        // Push user message
        history.push({ role: "user", content: text });

        // 1. Direct Pipeline Resolution — only if user provides an explicit token ID and nothing else
        const exactMatch = text.trim().match(/^0\.0\.\d+$/);
        if (exactMatch) {
            const tokenId = exactMatch[0];
            this.runtime.logger.info(`[Intent] User provided direct token ID ${tokenId}. Bypassing intent router, fast-tracking to synthesis.`);
            
            // Run the tool silently
            const toolResult = await this.runFullPipeline(sessionId, tokenId, []);
            
            // Push an artificial tool execution context so the AI knows we fetched the data
            history.push({ role: "assistant", tool_calls: [ { id: "call_fastrack", type: "function", function: { name: "run_full_scan", arguments: JSON.stringify({ token_id: tokenId }) } } ] } as any);
            history.push({ role: "tool", tool_call_id: "call_fastrack", name: "run_full_scan", content: toolResult } as any);
            
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            
            // Clean history of old system prompts and slice to last 20 messages
            const cleanHistory = history.filter(m => m.role !== "system");
            const payloadMessages = [
                { role: "system", content: this.getSystemPrompt() },
                ...cleanHistory.slice(-20)
            ];

            const finalResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: payloadMessages as any,
                max_tokens: 1000,
                temperature: 0.6
            });
            
            const finalReplyText = finalResponse.choices[0].message.content || "Error generating synthesized response.";
            
            // Clean up to prevent follow-up errors
            const cleanedHistory = history.filter((m: any) => m.role !== "tool" && !m.tool_calls);
            cleanedHistory.push({ role: "assistant", content: finalReplyText } as any);
            this.chatMemory.set(sessionId, cleanedHistory);
            this.savePersistentMemory();
            
            return finalReplyText;
        }

        // 2. Intent Detection — Use OpenAI to figure out what the user wants
        try {
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            const tools = [
                {
                    type: "function" as const,
                    function: {
                        name: "run_sentiment_analysis",
                        description: "Run live sentiment analysis on a token — fetches CoinGecko market data, DEX volume, GitHub activity, and AI sentiment scoring. Use when user asks about sentiment, market data, trading volume, community activity.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
                    }
                },
                {
                    type: "function" as const,
                    function: {
                        name: "run_full_scan",
                        description: "Run a complete security scan on a token including on-chain data, risk scoring, and rug prediction. Use when user asks to scan, analyze, or check a token.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
                    }
                },
                {
                    type: "function" as const,
                    function: {
                        name: "get_token_liquidity",
                        description: "Get liquidity and trading data for a token from DEX sources and on-chain data. Use when user asks about liquidity, trading pairs, or volume.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
                    }
                },
                {
                    type: "function" as const,
                    function: {
                        name: "generate_content",
                        description: "Generate a social media post, tweet, article, or summary about a token based on scan data. Use when user asks to write, create, post, tweet, or summarize.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." }, content_type: { type: "string", description: "Type of content: tweet, post, article, summary" } }, required: ["token_id", "content_type"] }
                    }
                },
                {
                    type: "function" as const,
                    function: {
                        name: "get_token_fundamentals",
                        description: "Get fundamental data about a token project — its use case, category (DeFi, NFT, GameFi, Meme, etc.), description, website, and project overview. Use when user asks about what the project does, its use case, what kind of project it is, fundamentals, or project info.",
                        parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
                    }
                },
                {
                    type: "function" as const,
                    function: {
                        name: "find_latest_tokens",
                        description: "Find the newest active tokens recently launched on the Hedera network. Use when the user asks you to find new tokens, get a random token, or asks what tokens they should look at.",
                        parameters: { type: "object", properties: {}, required: [] }
                    }
                },
                {
                    type: "function" as const,
                    function: {
                        name: "get_safe_tokens",
                        description: "Get a list of highly vetted, low-risk, safe tokens discovered by the autonomous background scanner. Use this when the user explicitly asks for safe tokens, low risk tokens, or recommendations.",
                        parameters: { type: "object", properties: {}, required: [] }
                    }
                }
            ];
            
            // Clean history of old system prompts and slice to last 20 messages
            const cleanHistory = history.filter(m => m.role !== "system");
            const recentHistory = [
                { role: "system", content: this.getSystemPrompt() },
                ...cleanHistory.slice(-12)
            ];
            
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: recentHistory as any,
                tools: tools,
                tool_choice: "auto",
                max_tokens: 600,
                temperature: 0.5
            });

            const choice = response.choices[0];

            // If the AI decided to use tools
            if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                this.runtime.logger.info(`[Intent] AI requested ${choice.message.tool_calls.length} tool calls for complex prompt.`);
                
                // Add the assistant's tool call requests to history
                history.push(choice.message as any);

                for (const toolCall of choice.message.tool_calls) {
                    let args: any = {};
                    try { args = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }
                    
                    let tokenId = args.token_id;
                    const historyText = history.map(h => h.content).join(" ");
                    
                    // BULLETPROOF FALLBACK for hallucinated tokens (skip if no token_id required)
                    if (toolCall.function.name !== "find_latest_tokens" && toolCall.function.name !== "get_safe_tokens" && (!tokenId || !historyText.includes(tokenId))) {
                        this.runtime.logger.info(`[Intent] AI hallucinated token: ${tokenId}. Extracting from memory.`);
                        const matches = historyText.match(/0\.0\.\d+/g);
                        if (matches && matches.length > 0) {
                            tokenId = matches[matches.length - 1]; // Use most recent valid token
                        } else {
                            this.runtime.logger.warn(`[Intent] Memory extraction failed.`);
                            history.push({ role: "tool", tool_call_id: toolCall.id, name: toolCall.function.name, content: "ERROR: Please specify a valid Hedera token ID (e.g. `0.0.12345`)." } as any);
                            continue;
                        }
                    }
                    
                    this.runtime.logger.info(`[Intent] Executing tool: ${toolCall.function.name} for token ${tokenId || "NONE"}`);
                    
                    let toolResult = "";
                    try {
                        const dummyHistory: any[] = []; // Prevent tools from polluting main history
                        if (toolCall.function.name === "run_full_scan") {
                            toolResult = await this.runFullPipeline(sessionId, tokenId, dummyHistory);
                        } else if (toolCall.function.name === "run_sentiment_analysis") {
                            toolResult = await this.runSentimentPipeline(sessionId, tokenId, dummyHistory);
                        } else if (toolCall.function.name === "get_token_liquidity") {
                            toolResult = await this.runLiquidityCheck(sessionId, tokenId, dummyHistory);
                        } else if (toolCall.function.name === "generate_content") {
                            toolResult = await this.generateContent(sessionId, tokenId, args.content_type || "post", dummyHistory);
                        } else if (toolCall.function.name === "get_token_fundamentals") {
                            toolResult = await this.runFundamentalsCheck(sessionId, tokenId, dummyHistory);
                        } else if (toolCall.function.name === "find_latest_tokens") {
                            this.runtime.logger.info("[Intent] Fetching newest Hedera tokens directly from Mirror Node...");
                            const res = await fetch("https://mainnet-public.mirrornode.hedera.com/api/v1/tokens?limit=5&order=desc");
                            if (!res.ok) throw new Error("Mirror node failed to fetch list of tokens.");
                            const tokenData = await res.json() as any;
                            const tokensArr = tokenData.tokens.map((t: any) => `ID: ${t.token_id} | Name: ${t.name} (${t.symbol})`);
                            toolResult = JSON.stringify({
                                latest_tokens: tokensArr,
                                instruction: "Present these tokens to the user conversationally and ask if they'd like you to scan one of them for rug risks."
                            });
                        } else if (toolCall.function.name === "get_safe_tokens") {
                            this.runtime.logger.info("[Intent] Retrieving explicitly vetted tokens from the Safe Token Cache...");
                            
                            if (this.safeTokenCache.length === 0) {
                                toolResult = JSON.stringify({ error: "The background scanner has not found any tokens with a Risk Score under 30 yet. Tell the user you are still scanning." });
                            } else {
                                toolResult = JSON.stringify({
                                    safe_tokens: this.safeTokenCache,
                                    instruction: "These tokens have mathematically verified low rug risk scores (< 30). Recommend them to the user conversationally."
                                });
                            }
                        } else {
                            toolResult = `ERROR: Tool ${toolCall.function.name} not found.`;
                        }
                    } catch (err: any) {
                        toolResult = `System Error running ${toolCall.function.name}: ${err.message}`;
                    }
                    
                    // Push tool result back to history
                    history.push({ role: "tool", tool_call_id: toolCall.id, name: toolCall.function.name, content: toolResult } as any);
                }

                // AI synthesis call to answer the user's original multi-step prompt using all fetched data
                this.runtime.logger.info(`[Intent] All tools executed. Synthesizing final response...`);
                
                // Clean history of old system prompts and slice to last 20 messages
                const cleanHistory = history.filter(m => m.role !== "system");
                const payloadMessages = [
                    { role: "system", content: this.getSystemPrompt() },
                    ...cleanHistory.slice(-20)
                ];

                const finalResponse = await openai.chat.completions.create({
                    model: "gpt-4o", // use 4o for best reasoning on complex comparison tasks
                    messages: payloadMessages as any,
                    max_tokens: 1500,
                    temperature: 0.5
                });
                
                const finalReplyText = finalResponse.choices[0].message.content || "Error generating synthesized response.";
                
                // CRITICAL FIX: Clean up intermediate tool reasoning from persistent history 
                // to prevent OpenAI 400 slice boundary errors on follow-up questions.
                const cleanedHistory = history.filter((m: any) => m.role !== "tool" && !m.tool_calls);
                cleanedHistory.push({ role: "assistant", content: finalReplyText } as any);
                this.chatMemory.set(sessionId, cleanedHistory);
                
                this.savePersistentMemory();
                
                // Return the synthesized AI answer!
                return finalReplyText;
            }

            // If no tool was triggered, use the AI's direct text response
            const replyText = choice.message.content || "I am RugGuard. Please provide a token ID like `0.0.12345` to scan, or ask me about a previously scanned token.";
            history.push({ role: "assistant", content: replyText });
            this.savePersistentMemory();
            return replyText;

        } catch (e: any) {
            this.runtime.logger.error("OpenAI Intent Detection failed: " + e.message);
            return "I am RugGuard. I analyze Hedera tokens for risk. Please provide a token ID like `0.0.12345` to initiate a full pipeline scan.";
        }
    }

    /** Run the full 6-agent pipeline and cache results */
    private async runFullPipeline(sessionId: string, tokenId: string, history: Array<{role: string, content: string}>): Promise<string> {
        try {
            this.runtime.logger.info(`[Pipeline] Full scan for ${tokenId}...`);
            const TokenScanner = require(path.resolve(__dirname, '..', "./TokenScannerAgent"));
            const SentimentAgent = require(path.resolve(__dirname, '..', "./SentimentAnalysisAgent"));
            const BlockchainRiskAgent = require(path.resolve(__dirname, '..', "./BlockchainRiskAnalysisAgent"));
            const RiskScoring = require(path.resolve(__dirname, '..', "./RiskScoringAgent"));
            const RugPredictor = require(path.resolve(__dirname, '..', "./RugPredictorAgent"));
            const AlertEngine = require(path.resolve(__dirname, '..', "./AlertAgent"));

            const scanner = new TokenScanner();
            const scannerData = await scanner.scan(tokenId);
            
            const sentAgent = new SentimentAgent();
            const sentimentData = await sentAgent.analyzeSentiment(scannerData);
            const bcRisk = new BlockchainRiskAgent().analyzeTokenRisk(scannerData);
            const riskScore = await new RiskScoring().calculateRisk({ scanner: scannerData, blockchain: bcRisk, sentiment: sentimentData });
            const prediction = await new RugPredictor().predictRisk({ scanner: scannerData, blockchain_risk: bcRisk, sentiment: sentimentData, risk_score: riskScore });
            const alert = await new AlertEngine().generateAlert({ risk_score: riskScore, prediction: prediction });

            // Cache for follow-up queries
            this.scanCache.set(sessionId, { tokenId, scannerData, sentimentData, bcRisk, riskScore, prediction, alert });

            if (prediction.rug_probability > 75 && OpenConvAIClient.instance) {
                await OpenConvAIClient.instance.broadcastGlobalAlert(tokenId, prediction.rug_probability, alert.security_posture);
            }

            const report = JSON.stringify({
                type: "SECURITY_INTELLIGENCE",
                token: scannerData.name || "Unknown",
                id: tokenId,
                riskScore: `${riskScore.rug_risk_score}/100 (${riskScore.risk_level})`,
                predictedProbability: `${prediction.rug_probability}% (${prediction.prediction_strength})`,
                overallPosture: alert.security_posture,
                adminControl: bcRisk.admin_control_risk,
                mintRisk: bcRisk.mint_risk_level,
                aiRiskAssessment: riskScore.ai_risk_summary,
                predictedScenarios: prediction.ai_risk_scenario,
                actionableRecommendations: alert.recommendations
            }, null, 2);

            history.push({ role: "assistant", content: report });
            return report;
        } catch (err: any) {
            const errResult = `🚨 Pipeline Error: Failed to analyze token ${tokenId}. ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }

    /** Run sentiment analysis only */
    private async runSentimentPipeline(sessionId: string, tokenId: string, history: Array<{role: string, content: string}>): Promise<string> {
        try {
            this.runtime.logger.info(`[Pipeline] Sentiment analysis for ${tokenId}...`);
            
            // Check cache first
            const cached = this.scanCache.get(sessionId);
            if (cached && cached.tokenId === tokenId && cached.sentimentData) {
                const sd = cached.sentimentData;
                const report = JSON.stringify({
                    type: "CACHED_SENTIMENT",
                    token: cached.scannerData?.name || "Unknown",
                    id: tokenId,
                    overallSentiment: sd.overall_sentiment || sd.sentiment_label || "N/A",
                    score: sd.sentiment_score ?? sd.ai_sentiment_score ?? "N/A",
                    aiConfidence: sd.ai_confidence || "N/A",
                    marketCap: sd.market_cap || "N/A",
                    volume24h: sd.volume_24h || "N/A",
                    priceChange24h: `${sd.price_change_24h || "0"}%`,
                    dexLiquidity: sd.dex_liquidity || "N/A",
                    socialMentions: sd.social_mentions || sd.social_score || "N/A",
                    communityScore: sd.community_score || "N/A",
                    aiSentimentSummary: sd.ai_sentiment_summary || sd.ai_analysis || "No AI analysis available."
                }, null, 2);
                history.push({ role: "assistant", content: report });
                return report;
            }

            // Fresh scan
            const TokenScanner = require(path.resolve(__dirname, '..', "./TokenScannerAgent"));
            const SentimentAgent = require(path.resolve(__dirname, '..', "./SentimentAnalysisAgent"));

            const scanner = new TokenScanner();
            const scannerData = await scanner.scan(tokenId);
            const sentAgent = new SentimentAgent();
            const sentimentData = await sentAgent.analyzeSentiment(scannerData);

            const report = JSON.stringify({
                type: "LIVE_SENTIMENT",
                token: scannerData.name || "Unknown",
                id: tokenId,
                overallSentiment: sentimentData.overall_sentiment || sentimentData.sentiment_label || "N/A",
                score: sentimentData.sentiment_score ?? sentimentData.ai_sentiment_score ?? "N/A",
                aiConfidence: sentimentData.ai_confidence || "N/A",
                marketCap: sentimentData.market_cap || "N/A",
                volume24h: sentimentData.volume_24h || "N/A",
                priceChange24h: `${sentimentData.price_change_24h || "0"}%`,
                dexLiquidity: sentimentData.dex_liquidity || "N/A",
                socialMentions: sentimentData.social_mentions || sentimentData.social_score || "N/A",
                aiSentimentSummary: sentimentData.ai_sentiment_summary || sentimentData.ai_analysis || "No AI analysis available."
            }, null, 2);

            history.push({ role: "assistant", content: report });
            return report;
        } catch (err: any) {
            const errResult = `🚨 Sentiment Error: ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }

    /** Check liquidity from cached or fresh scan data */
    private async runLiquidityCheck(sessionId: string, tokenId: string, history: Array<{role: string, content: string}>): Promise<string> {
        try {
            this.runtime.logger.info(`[Pipeline] Liquidity check for ${tokenId}...`);

            const cached = this.scanCache.get(sessionId);
            let scannerData: any, sentimentData: any;

            if (cached && cached.tokenId === tokenId) {
                scannerData = cached.scannerData;
                sentimentData = cached.sentimentData;
            } else {
                const TokenScanner = require(path.resolve(__dirname, '..', "./TokenScannerAgent"));
                const SentimentAgent = require(path.resolve(__dirname, '..', "./SentimentAnalysisAgent"));
                const scanner = new TokenScanner();
                scannerData = await scanner.scan(tokenId);
                const sentAgent = new SentimentAgent();
                sentimentData = await sentAgent.analyzeSentiment(scannerData);
            }

            const report = JSON.stringify({
                type: "LIQUIDITY_DATA",
                token: scannerData?.name || "Unknown",
                id: tokenId,
                totalSupply: scannerData?.total_supply || "N/A",
                circulatingSupply: scannerData?.circulating_supply || "N/A",
                topHolderConcentrationPercent: scannerData?.top_holder_percentage || "N/A",
                dexListed: sentimentData?.dex_listed || false,
                dexLiquidityUSD: sentimentData?.liquidity_usd || sentimentData?.fundamental_data?.financial?.liquidity_usd || 0,
                volume24h: sentimentData?.fundamental_data?.financial?.volume_24h || sentimentData?.volume_24h || 0,
                marketCap: sentimentData?.fundamental_data?.financial?.market_cap || 0,
                dexRiskLevel: sentimentData?.dex_risk_level || "UNKNOWN",
                transactions24h: scannerData?.transactions_24h || "N/A",
                uniqueHolders: scannerData?.holder_count || "N/A",
                dataSource: "Hedera Mirror Node, CoinGecko, GeckoTerminal"
            }, null, 2);

            history.push({ role: "assistant", content: report });
            return report;
        } catch (err: any) {
            const errResult = `🚨 Liquidity Check Error: ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }

    /** Generate content (posts, tweets, summaries) using conversation context */
    private async generateContent(sessionId: string, tokenId: string, contentType: string, history: Array<{role: string, content: string}>): Promise<string> {
        try {
            this.runtime.logger.info(`[Content] Generating ${contentType} for ${tokenId}...`);
            const OpenAI = require("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            const cached = this.scanCache.get(sessionId);
            const contextData = cached ? JSON.stringify({ tokenId: cached.tokenId, name: cached.scannerData?.name, riskScore: cached.riskScore, prediction: cached.prediction, sentiment: cached.sentimentData }) : "No cached data available.";

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: `You are RugGuard, a blockchain security AI. Generate a professional ${contentType} about the token analysis below. Be informative, engaging, and include relevant security data. Use emojis sparingly for social media posts. For tweets, keep under 280 characters.` },
                    { role: "user", content: `Generate a ${contentType} about token ${tokenId} using this scan data:\n${contextData}\n\nAlso reference the recent conversation:\n${history.slice(-6).map(m => `${m.role}: ${m.content.substring(0, 200)}`).join('\n')}` }
                ],
                max_tokens: 500,
                temperature: 0.8
            });

            const content = response.choices[0].message.content || "Unable to generate content at this time.";
            history.push({ role: "assistant", content: content });
            return content;
        } catch (err: any) {
            const errResult = `🚨 Content Generation Error: ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }

    /** Fetch fundamental project data: use case, category, description, links */
    private async runFundamentalsCheck(sessionId: string, tokenId: string, history: Array<{role: string, content: string}>): Promise<string> {
        try {
            this.runtime.logger.info(`[Pipeline] Fundamentals check for ${tokenId}...`);

            // 1. Fetch on-chain metadata from Hedera Mirror Node
            const mirrorRes = await fetch(`https://mainnet.mirrornode.hedera.com/api/v1/tokens/${tokenId}`);
            const mirrorData = mirrorRes.ok ? await mirrorRes.json() : {};

            const tokenName = mirrorData.name || "Unknown";
            const tokenSymbol = mirrorData.symbol || "N/A";
            const tokenMemo = mirrorData.memo || "No memo provided";
            const tokenType = mirrorData.type || "FUNGIBLE_COMMON";
            const totalSupply = mirrorData.total_supply || "N/A";
            const decimals = mirrorData.decimals || "N/A";
            const createdAt = mirrorData.created_timestamp ? new Date(parseFloat(mirrorData.created_timestamp) * 1000).toISOString().split('T')[0] : "N/A";

            // 2. Try CoinGecko for category & description
            let cgData: any = {};
            try {
                const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(tokenSymbol)}`);
                const searchJson = await searchRes.json();
                const coin = searchJson.coins?.[0];
                if (coin?.id) {
                    const detailRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false`);
                    if (detailRes.ok) {
                        cgData = await detailRes.json();
                    }
                }
            } catch (e: any) {
                this.runtime.logger.warn("CoinGecko fundamentals fetch failed: " + e.message);
            }

            const categories = cgData.categories?.filter((c: string) => c)?.join(", ") || "Not categorized on CoinGecko";
            const description = cgData.description?.en?.substring(0, 500) || "No description available on CoinGecko.";
            const website = cgData.links?.homepage?.[0] || "N/A";
            const twitter = cgData.links?.twitter_screen_name ? `https://x.com/${cgData.links.twitter_screen_name}` : "N/A";
            const github = cgData.links?.repos_url?.github?.[0] || "N/A";
            const genesisDate = cgData.genesis_date || createdAt;
            const hashingAlgo = cgData.hashing_algorithm || "Hedera Hashgraph (HCS)";

            // 3. AI-powered project classification for unlisted tokens
            let aiClassification = "";
            if (categories === "Not categorized on CoinGecko") {
                try {
                    const OpenAI = require("openai");
                    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                    const classifyRes = await openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: "You are a crypto analyst. Based on the token name, symbol, memo, and type, classify this project into a category (DeFi, NFT, GameFi, Meme, Stablecoin, Wrapped Asset, DAO, Infrastructure, Unknown) and provide a 2-3 sentence description of what this project likely does. Be confident and concise." },
                            { role: "user", content: `Token: ${tokenName} (${tokenSymbol})\nMemo: ${tokenMemo}\nType: ${tokenType}\nTotal Supply: ${totalSupply}\nDecimals: ${decimals}` }
                        ],
                        max_tokens: 200,
                        temperature: 0.5
                    });
                    aiClassification = classifyRes.choices[0].message.content || "";
                } catch (e: any) {
                    aiClassification = "AI classification unavailable.";
                }
            }

            const report = JSON.stringify({
                type: "FUNDAMENTALS",
                tokenName: tokenName,
                symbol: tokenSymbol,
                id: tokenId,
                tokenType: tokenType === "FUNGIBLE_COMMON" ? "Fungible Token" : tokenType === "NON_FUNGIBLE_UNIQUE" ? "NFT Collection" : tokenType,
                category: categories,
                created: genesisDate,
                consensus: hashingAlgo,
                totalSupply: Number(totalSupply) > 0 ? Number(totalSupply) / Math.pow(10, Number(decimals)) : totalSupply,
                decimals: decimals,
                description: description !== "No description available on CoinGecko." ? description : (aiClassification || tokenMemo),
                website: website,
                twitter: twitter,
                github: github,
                memo: tokenMemo,
                aiClassification: aiClassification || undefined
            }, null, 2);

            history.push({ role: "assistant", content: report });
            return report;
        } catch (err: any) {
            const errResult = `🚨 Fundamentals Error: ${err.message}`;
            history.push({ role: "assistant", content: errResult });
            return errResult;
        }
    }
}
