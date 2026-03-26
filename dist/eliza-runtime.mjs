import{createRequire as __cr}from'module';const require=__cr(import.meta.url);
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// eliza-runtime.ts
import {
  AgentRuntime,
  elizaLogger
} from "@elizaos/core";
import fs from "fs";
import path6 from "path";

// TokenScannerProvider.ts
import path from "path";
var TokenScannerAgent = __require(path.resolve(process.cwd(), "TokenScannerAgent"));
var tokenScannerProvider = {
  name: "TOKEN_SCANNER_PROVIDER",
  get: async (runtime, message, state) => {
    try {
      const text = message.content?.text || "";
      const match = text.match(/0\.0\.\d+/);
      if (!match) {
        return "";
      }
      const tokenId = match[0];
      runtime.logger.info(`[TokenScannerProvider] Intercepted token ID ${tokenId}. Initiating Mirror Node scan...`);
      const scanner = new TokenScannerAgent();
      const data = await scanner.scan(tokenId);
      return `
=== HEDERA MIRROR NODE RAW DATA (TOKEN SCANNER) ===
${JSON.stringify(data, null, 2)}
===================================================
`;
    } catch (error) {
      runtime.logger.error(`[TokenScannerProvider] Error: ${error.message}`);
      return `Scanner System Error: Could not fetch data for token. Reason: ${error.message}`;
    }
  }
};

// SentimentProvider.ts
import path2 from "path";
var SentimentAnalysisAgent = __require(path2.resolve(process.cwd(), "SentimentAnalysisAgent"));
var sentimentProvider = {
  name: "SENTIMENT_PROVIDER",
  get: async (runtime, message, state) => {
    try {
      const text = message.content?.text?.toLowerCase() || "";
      const isAnalysis = text.includes("analyze") || text.includes("risk") || text.match(/0\.0\.\d+/);
      if (!isAnalysis) {
        return "";
      }
      runtime.logger.info("[SentimentProvider] Fetching Web3 sentiment intelligence...");
      const sentAgent = new SentimentAnalysisAgent();
      let tokenSymbol = "UNKNOWN";
      if (text.includes("sauce")) tokenSymbol = "SAUCE";
      else if (text.includes("karate")) tokenSymbol = "KARATE";
      else if (text.includes("grelf")) tokenSymbol = "GRELF";
      await Promise.all([
        sentAgent.fetchCoinGeckoData(tokenSymbol),
        sentAgent.fetchDexData(tokenSymbol),
        sentAgent.fetchGitHubData("https://github.com/hasgraph/hedera-services")
      ]);
      return `
=== SOCIAL & MARKET INTELLIGENCE ===
Token: ${tokenSymbol}
CoinGecko Sentiment: ${sentAgent.socialState.reddit_sentiment} (Reddit), ${sentAgent.socialState.twitter_sentiment} (Twitter)
DEX Metric: ${sentAgent.socialState.dex_volume_usd} / Liquidity: ${sentAgent.socialState.dex_liquidity_usd}
Developer Commits: ${sentAgent.socialState.developer_activity_score}
====================================
`;
    } catch (error) {
      runtime.logger.error(`[SentimentProvider] Error: ${error.message}`);
      return "";
    }
  }
};

// ElizaActions/ScanAction.ts
import path3 from "path";

// ElizaActions/SharedCache.ts
var ToolDataCache = {};

// ElizaActions/ScanAction.ts
var TokenScannerAgent2 = __require(path3.resolve(process.cwd(), "TokenScannerAgent"));
var BlockchainRiskAnalysisAgent = __require(path3.resolve(process.cwd(), "BlockchainRiskAnalysisAgent"));
var scanTokenAction = {
  name: "SCAN_TOKEN_ONCHAIN",
  similes: ["GET_TOKEN_DATA", "FETCH_TOKEN_CONFIG", "CHECK_ADMIN_KEYS", "ONCHAIN_SCAN"],
  description: "Fetches on-chain token configuration (mint keys, admin keys, supply) and analyzes immediate blockchain risks.",
  validate: async (runtime, message) => true,
  handler: async (runtime, message, state, options, callback) => {
    const text = message.content?.text || "";
    const match = text.match(/0\.0\.\d+/);
    if (!match) {
      if (callback) callback({ text: "Please specify a valid Hedera token ID to scan." });
      return false;
    }
    const tokenId = match[0];
    try {
      if (callback) callback({ text: `*Running On-Chain Scanner for ${tokenId}*...` });
      const scanner = new TokenScannerAgent2();
      const scannerData = await scanner.scan(tokenId);
      const bcAgent = new BlockchainRiskAnalysisAgent();
      const bcRisk = bcAgent.analyzeTokenRisk(scannerData);
      ToolDataCache[tokenId] = {
        ...ToolDataCache[tokenId],
        scanner: scannerData,
        blockchain: bcRisk
      };
      const response = `On-Chain Scan Complete for ${scannerData.name || tokenId}:
- Mint Key: ${scannerData.has_mint_authority ? "Enabled! (Risk)" : "Disabled (Safe)"}
- Admin Key: ${scannerData.has_admin_key ? "Enabled! (Risk)" : "Disabled (Safe)"}
- Mint Risk Score: ${bcRisk.mint_risk_score}
- Admin Control Score: ${bcRisk.admin_control_score}
- Overall Blockchain Risk: ${bcRisk.admin_control_risk}`;
      if (callback) callback({ text: response });
      return true;
    } catch (err) {
      if (callback) callback({ text: `Scanner failed: ${err.message}` });
      return false;
    }
  },
  examples: []
};

// ElizaActions/SentimentAction.ts
import path4 from "path";
var SentimentAnalysisAgent2 = __require(path4.resolve(process.cwd(), "SentimentAnalysisAgent"));
var sentimentAction = {
  name: "FETCH_TOKEN_SENTIMENT",
  similes: ["CHECK_SENTIMENT", "GET_SOCIALS", "CHECK_LIQUIDITY", "FETCH_COMMUNITY_DATA", "GET_GITHUB"],
  description: "Fetches external community sentiment, DEX liquidity, CoinGecko financial fundamentals, and GitHub developer activity for a token.",
  validate: async (runtime, message) => true,
  handler: async (runtime, message, state, options, callback) => {
    const text = message.content?.text || "";
    const match = text.match(/0\.0\.\d+/);
    const tokenId = match ? match[0] : null;
    let symbolMatch = "UNKNOWN";
    if (tokenId && ToolDataCache[tokenId]?.scanner?.name) {
      symbolMatch = ToolDataCache[tokenId].scanner.name.toUpperCase();
    } else {
      const symMatch = text.match(/\b[A-Z]{3,10}\b/);
      if (symMatch) symbolMatch = symMatch[0];
    }
    try {
      if (callback) callback({ text: `*Aggregating Social, Volume, and Liquidity Sentiment for ${symbolMatch}...*` });
      const sentAgent = new SentimentAnalysisAgent2();
      await Promise.all([
        sentAgent.fetchCoinGeckoData(symbolMatch),
        sentAgent.fetchDexData(symbolMatch),
        sentAgent.fetchGitHubData("https://github.com/hasgraph/hedera-services")
      ]);
      const scannerMock = tokenId && ToolDataCache[tokenId]?.scanner ? ToolDataCache[tokenId].scanner : { token_id: tokenId, name: symbolMatch, symbol: symbolMatch };
      const sentimentData = await sentAgent.analyzeSentiment(scannerMock);
      if (tokenId) {
        ToolDataCache[tokenId] = {
          ...ToolDataCache[tokenId],
          sentiment: sentimentData
        };
      }
      const response = `Sentiment & Fundamentals for ${symbolMatch}:
- Social Security Rating: ${sentimentData.sentiment_security_rating}
- DEX Liquidity: $${sentimentData.liquidity_usd}
- 24h Volume: $${sentimentData.volume_24h}
- Dev Activity Risk: ${sentimentData.developer_activity_risk}
- AI Summary: ${sentimentData.ai_sentiment_summary}`;
      if (callback) callback({ text: response });
      return true;
    } catch (err) {
      if (callback) callback({ text: `Sentiment engine failed: ${err.message}` });
      return false;
    }
  },
  examples: []
};

// ElizaActions/PredictAction.ts
import path5 from "path";

// openconvai-client.ts
var OpenConvAIClient = class _OpenConvAIClient {
  static instance;
  runtime;
  hcsClient;
  inboundTopicId = null;
  globalSirenTopicId = null;
  // Micro-monetization: minimum HBAR fee for analysis requests
  ANALYSIS_FEE_HBAR = 1;
  // Track processed requests to avoid duplicates
  processedRequests = /* @__PURE__ */ new Set();
  constructor(runtime) {
    this.runtime = runtime;
    _OpenConvAIClient.instance = this;
  }
  async start() {
    this.runtime.logger.info("\u{1F7E2} Deploying RugGuard onto OpenConvAI (HCS-10)...");
    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      this.runtime.logger.warn("\u{1F7E1} Missing Hedera ENV keys. Cannot connect to HCS-10 network.");
      return;
    }
    try {
      const sdk = await import("@hashgraphonline/standards-sdk");
      const { HCS10Client } = sdk;
      const { InboundTopicType } = sdk;
      this.hcsClient = new HCS10Client({
        network: "testnet",
        operatorId: process.env.HEDERA_ACCOUNT_ID,
        operatorPrivateKey: process.env.HEDERA_PRIVATE_KEY
      });
      const response = await this.hcsClient.createInboundTopic(
        process.env.HEDERA_ACCOUNT_ID,
        InboundTopicType.CONTROLLED,
        86400
      );
      this.inboundTopicId = typeof response === "string" ? response : response.topicId?.toString() || response.toString();
      this.runtime.logger.info(`====================================================`);
      this.runtime.logger.info(`\u2705 OPENCONVAI AGENT SUCCESSFULLY REGISTERED!`);
      this.runtime.logger.info(`\u{1F4E1} My HCS Topic Inbox is: ${this.inboundTopicId}`);
      const sirenResp = await this.hcsClient.createInboundTopic(
        process.env.HEDERA_ACCOUNT_ID,
        InboundTopicType.PUBLIC,
        86400
      );
      this.globalSirenTopicId = typeof sirenResp === "string" ? sirenResp : sirenResp.topicId?.toString() || sirenResp.toString();
      this.runtime.logger.info(`\u{1F6A8} GLOBAL SECURITY SIREN HCS TOPIC is: ${this.globalSirenTopicId}`);
      this.runtime.logger.info(`\u{1F4B0} Micro-Monetization ACTIVE: Other agents must pay \u2265${this.ANALYSIS_FEE_HBAR} HBAR for analysis.`);
      this.runtime.logger.info(`\u{1F916} Other AI Agents can now ping me for Rug Risk analysis!`);
      this.runtime.logger.info(`====================================================`);
      this.pollInbox();
    } catch (error) {
      this.runtime.logger.error(`\u274C OpenConvAI Init Error: ${error.message}`);
    }
  }
  // ═══════════════════════════════════════════════════
  //  FEATURE 4: MICRO-MONETIZATION INBOX LISTENER
  // ═══════════════════════════════════════════════════
  pollInbox() {
    setInterval(async () => {
      if (!this.inboundTopicId || !this.hcsClient) return;
      try {
        const messages = await this.fetchInboxMessages();
        for (const msg of messages) {
          if (this.processedRequests.has(msg.id)) continue;
          this.processedRequests.add(msg.id);
          await this.handleIncomingRequest(msg);
        }
      } catch {
      }
    }, 3e4);
  }
  /**
   * Fetch messages from the HCS inbox topic via Mirror Node
   */
  async fetchInboxMessages() {
    if (!this.inboundTopicId) return [];
    try {
      const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${this.inboundTopicId}/messages?limit=5&order=desc`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.messages || []).map((m) => {
        let content = {};
        try {
          const decoded = Buffer.from(m.message, "base64").toString("utf-8");
          content = JSON.parse(decoded);
        } catch {
          content = {};
        }
        return {
          id: m.sequence_number?.toString() || `${Date.now()}`,
          content,
          sender: m.payer_account_id || "unknown"
        };
      });
    } catch {
      return [];
    }
  }
  /**
   * Handle an incoming analysis request from another AI agent.
   * Verifies HBAR payment before running the pipeline.
   */
  async handleIncomingRequest(msg) {
    const { content, sender } = msg;
    if (!content.action || content.action !== "REQUEST_ANALYSIS") return;
    if (!content.token_id) return;
    const tokenId = content.token_id;
    const paymentTxId = content.payment_tx_id;
    const replyTopicId = content.reply_topic_id;
    this.runtime.logger.info(`\u{1F4B0} [MONETIZATION] Received analysis request from ${sender} for token ${tokenId}`);
    if (paymentTxId) {
      const paymentVerified = await this.verifyHBARPayment(paymentTxId);
      if (!paymentVerified) {
        this.runtime.logger.warn(`\u{1F4B0} [MONETIZATION] Payment verification FAILED for tx: ${paymentTxId}`);
        await this.publishReply(replyTopicId, {
          event: "PAYMENT_FAILED",
          message: `Payment verification failed. Please send \u2265${this.ANALYSIS_FEE_HBAR} HBAR to ${process.env.HEDERA_ACCOUNT_ID} and include the transaction ID.`,
          required_fee: `${this.ANALYSIS_FEE_HBAR} HBAR`
        });
        return;
      }
      this.runtime.logger.info(`\u{1F4B0} [MONETIZATION] \u2705 Payment VERIFIED! Running full pipeline for ${tokenId}...`);
    } else {
      this.runtime.logger.info(`\u{1F4B0} [MONETIZATION] No payment included. Sending fee requirement.`);
      await this.publishReply(replyTopicId, {
        event: "PAYMENT_REQUIRED",
        message: `RugGuard requires \u2265${this.ANALYSIS_FEE_HBAR} HBAR for a full security analysis. Send payment to ${process.env.HEDERA_ACCOUNT_ID} and include payment_tx_id in your request.`,
        required_fee: `${this.ANALYSIS_FEE_HBAR} HBAR`,
        pay_to: process.env.HEDERA_ACCOUNT_ID
      });
      return;
    }
    try {
      const path7 = __require("path");
      const TokenScanner = __require(path7.resolve(process.cwd(), "./TokenScannerAgent"));
      const SentimentAgent = __require(path7.resolve(process.cwd(), "./SentimentAnalysisAgent"));
      const BlockchainRiskAgent = __require(path7.resolve(process.cwd(), "./BlockchainRiskAnalysisAgent"));
      const RiskScoring = __require(path7.resolve(process.cwd(), "./RiskScoringAgent"));
      const RugPredictor = __require(path7.resolve(process.cwd(), "./RugPredictorAgent"));
      const AlertEngine = __require(path7.resolve(process.cwd(), "./AlertAgent"));
      const scanner = new TokenScanner();
      const scannerData = await scanner.scan(tokenId);
      const sentAgent = new SentimentAgent();
      const sentimentData = await sentAgent.analyzeSentiment(scannerData);
      const bcRisk = new BlockchainRiskAgent().analyzeTokenRisk(scannerData);
      const riskScore = await new RiskScoring().calculateRisk({ scanner: scannerData, blockchain: bcRisk, sentiment: sentimentData });
      const prediction = await new RugPredictor().predictRisk({ scanner: scannerData, blockchain_risk: bcRisk, sentiment: sentimentData, risk_score: riskScore });
      const report = {
        event: "ANALYSIS_COMPLETE",
        protocol: "HCS-10",
        sender: "RugGuard_AI",
        token_id: tokenId,
        token_name: scannerData.name || "Unknown",
        risk_score: riskScore.rug_risk_score,
        risk_level: riskScore.risk_level,
        rug_probability: prediction.rug_probability,
        prediction_strength: prediction.prediction_strength,
        admin_control: bcRisk.admin_control_risk,
        mint_risk: bcRisk.mint_risk_level,
        ai_summary: riskScore.ai_risk_summary,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      await this.publishReply(replyTopicId, report);
      this.runtime.logger.info(`\u{1F4B0} [MONETIZATION] \u2705 Paid analysis for ${tokenId} delivered to ${replyTopicId}!`);
    } catch (err) {
      this.runtime.logger.error(`\u{1F4B0} [MONETIZATION] Pipeline error: ${err.message}`);
      await this.publishReply(replyTopicId, {
        event: "ANALYSIS_ERROR",
        message: `Pipeline failed: ${err.message}`,
        token_id: tokenId
      });
    }
  }
  /**
   * Verify an HBAR payment transaction on the Hedera Mirror Node
   */
  async verifyHBARPayment(txId) {
    try {
      const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${txId}`);
      if (!response.ok) return false;
      const data = await response.json();
      const transactions = data.transactions || [];
      if (transactions.length === 0) return false;
      const tx = transactions[0];
      const ourAccount = process.env.HEDERA_ACCOUNT_ID;
      const transfers = tx.transfers || [];
      for (const transfer of transfers) {
        if (transfer.account === ourAccount && transfer.amount > 0) {
          const hbarAmount = transfer.amount / 1e8;
          if (hbarAmount >= this.ANALYSIS_FEE_HBAR) {
            this.runtime.logger.info(`\u{1F4B0} [MONETIZATION] Confirmed ${hbarAmount} HBAR payment from tx ${txId}`);
            return true;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }
  /**
   * Publish a reply to another agent's HCS topic
   */
  async publishReply(replyTopicId, payload) {
    if (!replyTopicId || !this.hcsClient) {
      this.runtime.logger.info(`[OpenConvAI] Reply payload (no reply topic): ${JSON.stringify(payload).substring(0, 200)}`);
      return;
    }
    try {
      await this.hcsClient.sendMessage(replyTopicId, JSON.stringify(payload));
    } catch (error) {
      this.runtime.logger.error(`[OpenConvAI] Reply publish error: ${error.message}`);
    }
  }
  /**
   * Autonomously broadcasts a "RUG PULL IMMINENT" alert globally across the HCS network.
   * Uses direct Hedera SDK TopicMessageSubmitTransaction to bypass standards-sdk profile validation.
   */
  async broadcastGlobalAlert(tokenId, probability, criticalIssue) {
    if (!this.globalSirenTopicId) {
      this.runtime.logger.warn(`[OpenConvAI] \u26A0\uFE0F No siren topic available. Skipping broadcast.`);
      return;
    }
    const alertPayload = JSON.stringify({
      event: "EMERGENCY_RUG_WARNING",
      protocol: "HCS-10",
      sender: "RugGuard_AI_Global_Siren",
      target_token: tokenId,
      rug_probability_percent: probability,
      critical_issue: criticalIssue,
      action_required: "IMMEDIATE_LIQUIDITY_WITHDRAWAL",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.runtime.logger.warn(`[OpenConvAI] \u{1F6A8} BROADCASTING DECENTRALIZED GLOBAL ALERT FOR ${tokenId}!`);
    try {
      const { TopicMessageSubmitTransaction, Client, PrivateKey } = await import("@hashgraph/sdk");
      const client = Client.forTestnet();
      let privateKey;
      const pkStr = process.env.HEDERA_PRIVATE_KEY;
      try {
        privateKey = PrivateKey.fromStringECDSA(pkStr);
      } catch {
        try {
          privateKey = PrivateKey.fromStringED25519(pkStr);
        } catch {
          try {
            privateKey = PrivateKey.fromStringDer(pkStr);
          } catch {
            privateKey = PrivateKey.fromString(pkStr);
          }
        }
      }
      client.setOperator(process.env.HEDERA_ACCOUNT_ID, privateKey);
      await new TopicMessageSubmitTransaction().setTopicId(this.globalSirenTopicId).setMessage(alertPayload).execute(client);
      this.runtime.logger.warn(`[OpenConvAI] \u{1F6A8} ALERT SUCCESSFULLY PUBLISHED TO HCS NETWORK TOPIC ${this.globalSirenTopicId}`);
    } catch (error) {
      this.runtime.logger.error(`[OpenConvAI] Broadcast Error: ${error.message}`);
    }
  }
};

// ElizaActions/PredictAction.ts
var RiskScoringAgent = __require(path5.resolve(process.cwd(), "RiskScoringAgent"));
var RugPredictorAgent = __require(path5.resolve(process.cwd(), "RugPredictorAgent"));
var AlertAgent = __require(path5.resolve(process.cwd(), "AlertAgent"));
var predictRugPullAction = {
  name: "PREDICT_RUG_PULL",
  similes: ["GENERATE_RISK_REPORT", "CALCULATE_RUG_RISK", "IS_IT_A_SCAM", "SHOULD_I_BUY"],
  description: "Calculates the final 0-100 Rug Risk Score, generates hypothetical scenarios, and issues a final security alert. REQUIRES On-chain scanner data and Sentiment data in cache first.",
  validate: async (runtime, message) => true,
  handler: async (runtime, message, state, options, callback) => {
    const text = message.content?.text || "";
    const match = text.match(/0\.0\.\d+/);
    if (!match) {
      if (callback) callback({ text: "Please specify a token ID to predict risk for." });
      return false;
    }
    const tokenId = match[0];
    const cached = ToolDataCache[tokenId];
    if (!cached || !cached.scanner || !cached.blockchain) {
      if (callback) callback({ text: "I need to run the On-Chain Scanner first to get the blueprint. Call SCAN_TOKEN_ONCHAIN before predicting rug risks." });
      return false;
    }
    try {
      if (callback) callback({ text: `*Fusing data streams for ${tokenId}. Forecasting rug probability...*` });
      const riskAgent = new RiskScoringAgent();
      const riskScore = await riskAgent.calculateRisk({
        scanner: cached.scanner,
        blockchain: cached.blockchain,
        sentiment: cached.sentiment || {}
      });
      const predAgent = new RugPredictorAgent();
      const prediction = await predAgent.predictRisk({
        scanner: cached.scanner,
        blockchain_risk: cached.blockchain,
        sentiment: cached.sentiment || {},
        risk_score: riskScore
      });
      const alertAgent = new AlertAgent();
      const alert = await alertAgent.generateAlert({
        risk_score: riskScore,
        prediction
      });
      if (prediction.rug_probability > 75) {
        const criticalIssue = cached.blockchain.mint_risk_level === "CRITICAL" ? "Centralized Minting Authority Detected" : alert.security_posture;
        if (OpenConvAIClient.instance) {
          await OpenConvAIClient.instance.broadcastGlobalAlert(tokenId, prediction.rug_probability, criticalIssue);
        }
      }
      const response = `\u{1F6A8} FINAL SECURITY POSTURE: ${cached.scanner.name} \u{1F6A8}
- Rug Risk Score: ${riskScore.rug_risk_score}/100
- Prediction: ${prediction.rug_probability}% (${prediction.prediction_strength})
- AI Assessment: ${riskScore.ai_risk_summary}
- Simulation: ${prediction.ai_risk_scenario}
- Recommendation: ${alert.recommendations[0]}`;
      if (callback) callback({ text: response });
      return true;
    } catch (err) {
      if (callback) callback({ text: `Prediction core failed: ${err.message}` });
      return false;
    }
  },
  examples: []
};

// eliza-runtime.ts
var characterPath = path6.resolve(process.cwd(), "ruguard.character.json");
var characterJson = JSON.parse(fs.readFileSync(characterPath, "utf-8"));
var RugGuardElizaRuntime = class {
  runtime;
  openConvAI;
  // Ultra-lightweight conversational memory map: chatId -> previous messages
  chatMemory = /* @__PURE__ */ new Map();
  // Persistent memory file path
  memoryFilePath = path6.resolve(process.cwd(), "memory.json");
  // Current market mood from Fear & Greed Index
  marketMood = { value: 50, label: "Neutral", lastUpdated: "never" };
  // Current active plan
  currentPlan = { tasks: [], createdAt: "", executedTasks: [] };
  // User preferences store
  userPreferences = /* @__PURE__ */ new Map();
  // Cache of explicitly safe tokens discovered by the background scanner
  safeTokenCache = [];
  // Deduplication: track already-scanned and already-alerted tokens to prevent spam
  scannedTokens = /* @__PURE__ */ new Set();
  alertedTokens = /* @__PURE__ */ new Set();
  // Timestamp cursor for Mirror Node pagination — ensures we always fetch NEW tokens
  lastTokenTimestamp = null;
  // ═══ LEVEL 4: SELF-LEARNING ═══
  // Scan history — records every scan result for pattern learning
  scanHistory = [];
  // Learned patterns — AI-derived insights from scan history, updated every 6 hours
  learnedPatterns = [];
  // Learning stats
  learningStats = {
    totalScans: 0,
    highRiskCount: 0,
    safeCount: 0,
    avgRiskScore: 0,
    lastLearningRun: "never"
  };
  // Agent's autonomous goals — persisted across restarts
  agentGoals = {
    mission: "Protect Hedera users from rug pulls and scam tokens by providing autonomous, real-time security intelligence.",
    currentFocus: "Monitor all new HTS tokens launched today",
    dailyObjectives: ["Scan new token deployments", "Generate daily risk report", "Alert community on high-risk tokens"],
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  };
  constructor() {
    this.boot().catch((err) => elizaLogger.error("Failed to boot RugGuard AI:", err));
  }
  async boot() {
    elizaLogger.info("booting up True Agentic Memory Pipeline...");
    if (!characterJson.settings) characterJson.settings = {};
    if (!characterJson.settings.secrets) characterJson.settings.secrets = {};
    characterJson.settings.secrets.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    this.runtime = new AgentRuntime({
      token: process.env.OPENAI_API_KEY,
      modelProvider: "openai",
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
      databaseAdapter: {},
      cacheManager: {}
    });
    this.openConvAI = new OpenConvAIClient(this.runtime);
    this.openConvAI.start();
    if (process.env.TELEGRAM_BOT_TOKEN) {
      import("telegraf").then(({ Telegraf }) => {
        const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
        bot.on("text", async (ctx) => {
          const chatId = ctx.chat.id.toString();
          const text = ctx.message.text;
          this.runtime.logger.info(`[Telegram] Received message from ${chatId}: ${text}`);
          try {
            const reply = await this.executeChat(chatId, text);
            await ctx.reply(reply, { parse_mode: "Markdown" });
          } catch (error) {
            await ctx.reply(`Error analyzing request: ${error.message}`);
          }
        });
        bot.launch().then(() => {
          this.runtime.logger.info("\u{1F7E2} Telegram Bot Client successfully connected and listening!");
        }).catch((err) => {
          this.runtime.logger.error("\u{1F534} Telegram Bot Initialization failed: " + err.message);
        });
        process.once("SIGINT", () => bot.stop("SIGINT"));
        process.once("SIGTERM", () => bot.stop("SIGTERM"));
      }).catch((err) => {
        this.runtime.logger.error("\u{1F534} Failed to load Telegraf: " + err.message);
      });
    }
    this.loadPersistentMemory();
    this.runtime.logger.info("\u{1F9E0} Self-Planning Engine initialized. First plan generating in 10 seconds...");
    setTimeout(() => this.selfPlanningEngine(), 1e4);
    setInterval(() => this.selfPlanningEngine(), 36e5);
    this.runtime.logger.info("\u{1F9EC} [LEVEL 4] Self-Learning Engine initialized. Learning cycle every 6 hours.");
    setTimeout(() => this.selfLearningEngine(), 6e4);
    setInterval(() => this.selfLearningEngine(), 216e5);
    this.fetchMarketMood();
    setInterval(() => this.fetchMarketMood(), 18e5);
  }
  // ═══════════════════════════════════════════════════
  //  FEATURE 1: SELF-PLANNING ENGINE
  // ═══════════════════════════════════════════════════
  /**
   * The AI generates its own hourly operational plan using GPT-4o,
   * then autonomously executes each task without human input.
   */
  async selfPlanningEngine() {
    try {
      const OpenAI = __require("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.runtime.logger.info("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
      this.runtime.logger.info("\u{1F9E0} [SELF-PLANNER] Agent is creating its own operational plan...");
      this.runtime.logger.info(`\u{1F3AF} [GOALS] Current Mission: ${this.agentGoals.mission}`);
      this.runtime.logger.info(`\u{1F3AF} [GOALS] Current Focus: ${this.agentGoals.currentFocus}`);
      const goalResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `You are RugGuard, an autonomous AI security agent on the Hedera network.
Your permanent mission: ${this.agentGoals.mission}
Your current focus: ${this.agentGoals.currentFocus}
Current market mood: ${this.marketMood.label} (Fear & Greed Index: ${this.marketMood.value}/100)
Active sessions: ${this.chatMemory.size} | Cached scans: ${this.scanCache.size}
Current time: ${(/* @__PURE__ */ new Date()).toISOString()}

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
          this.agentGoals.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
          this.runtime.logger.info(`\u{1F3AF} [SELF-GOAL] Updated Focus: ${this.agentGoals.currentFocus}`);
          this.agentGoals.dailyObjectives.forEach(
            (obj, i) => this.runtime.logger.info(`   \u{1F3AF} Objective ${i + 1}: ${obj}`)
          );
        }
      } catch {
      }
      const planResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `You are RugGuard, an autonomous AI security agent on the Hedera network.
Your mission: ${this.agentGoals.mission}
Your current focus: ${this.agentGoals.currentFocus}
Your daily objectives: ${this.agentGoals.dailyObjectives.join(", ")}
Current market mood: ${this.marketMood.label} (Fear & Greed Index: ${this.marketMood.value}/100)
Current time: ${(/* @__PURE__ */ new Date()).toISOString()}

=== LEVEL 4: LEARNED INTELLIGENCE ===
Total tokens scanned in lifetime: ${this.learningStats.totalScans}
High-risk tokens found: ${this.learningStats.highRiskCount} | Safe tokens found: ${this.learningStats.safeCount}
Average risk score across all scans: ${this.learningStats.avgRiskScore.toFixed(1)}/100
${this.learnedPatterns.length > 0 ? `
PATTERNS YOU HAVE LEARNED FROM EXPERIENCE:
${this.learnedPatterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}

USE THESE PATTERNS to make smarter decisions about what to scan and how to prioritize.` : "No patterns learned yet. Keep scanning to build intelligence."}

Generate an operational plan for the next hour. Output ONLY a JSON array of task strings.
Each task should be a specific, executable action.
You have FULL AUTONOMY. There are NO restrictions on what you can plan.

Guidelines:
- If market mood is "Extreme Fear" or "Fear": be hyper-aggressive \u2014 scan more tokens, lower alert thresholds, hunt for rug pulls
- If market mood is "Extreme Greed" or "Greed": euphoria attracts scams \u2014 hunt aggressively for pump-and-dump schemes
- Include ONE scanning task: "Scan latest real Hedera tokens"
- You decide how many tasks to include (minimum 2, no maximum)
- You decide what types of tasks to create \u2014 scanning, monitoring, reporting, alerting, watchlist updates, sentiment analysis, etc.
- Be creative and adaptive \u2014 your plans should evolve based on conditions

Example output:
["Scan latest real Hedera tokens", "Analyze market conditions for emerging threats", "Generate threat intelligence report"]` },
          { role: "user", content: "Create your operational plan for this hour." }
        ],
        temperature: 0.7,
        max_tokens: 300
      });
      const planText = planResponse.choices[0].message.content || "[]";
      const jsonMatch = planText.match(/\[.*\]/s);
      const tasks = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      this.currentPlan = {
        tasks,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        executedTasks: []
      };
      this.runtime.logger.info(`\u{1F9E0} [SELF-PLANNER] Plan created with ${tasks.length} tasks:`);
      tasks.forEach((t, i) => this.runtime.logger.info(`   ${i + 1}. ${t}`));
      this.runtime.logger.info("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
      let hasScannedThisCycle = false;
      for (const task of tasks) {
        await this.executePlanTask(task, hasScannedThisCycle);
        const taskLower = task.toLowerCase();
        if (taskLower.includes("scan") || taskLower.includes("token")) {
          hasScannedThisCycle = true;
        }
      }
      this.runtime.logger.info("\u{1F9E0} [SELF-PLANNER] All planned tasks executed successfully.");
      this.savePersistentMemory();
    } catch (err) {
      this.runtime.logger.error(`[SELF-PLANNER] Planning failed: ${err.message}`);
    }
  }
  /**
   * Execute a single task from the AI's self-generated plan
   */
  async executePlanTask(task, hasScannedThisCycle = false) {
    this.runtime.logger.info(`\u{1F916} [EXECUTING] ${task}`);
    try {
      const tokenMatch = task.match(/0\.0\.\d+/);
      if ((tokenMatch || task.toLowerCase().includes("scan") || task.toLowerCase().includes("token")) && !hasScannedThisCycle) {
        let tokensToScan = [];
        if (tokenMatch) {
          tokensToScan = [tokenMatch[0]];
        } else {
          try {
            let mirrorUrl = "https://mainnet-public.mirrornode.hedera.com/api/v1/tokens?order=desc";
            const scanLimit = this.marketMood.value < 25 ? 15 : this.marketMood.value < 50 ? 10 : 5;
            mirrorUrl += `&limit=${scanLimit}`;
            if (this.lastTokenTimestamp) {
              mirrorUrl += `&timestamp=lt:${this.lastTokenTimestamp}`;
            }
            const mirrorResponse = await fetch(mirrorUrl);
            if (mirrorResponse.ok) {
              const mirrorData = await mirrorResponse.json();
              const allTokens = mirrorData.tokens || [];
              const newTokens = allTokens.filter((t) => !this.scannedTokens.has(t.token_id));
              tokensToScan = newTokens.map((t) => t.token_id).slice(0, 5);
              if (allTokens.length > 0 && allTokens[0].created_timestamp) {
                this.lastTokenTimestamp = allTokens[allTokens.length - 1].created_timestamp;
              }
              this.runtime.logger.info(`   \u{1F50D} Fetched ${tokensToScan.length} NEW tokens from Hedera Mirror Node (${this.scannedTokens.size} already scanned)`);
            }
          } catch {
            tokensToScan = ["0.0." + Math.floor(1e6 + Math.random() * 9e6)];
          }
        }
        const TokenScanner = __require(path6.resolve(process.cwd(), "./TokenScannerAgent"));
        const BlockchainRiskAgent = __require(path6.resolve(process.cwd(), "./BlockchainRiskAnalysisAgent"));
        const RiskScoringAgent2 = __require(path6.resolve(process.cwd(), "./RiskScoringAgent"));
        for (const tokenId of tokensToScan) {
          if (this.scannedTokens.has(tokenId)) continue;
          this.scannedTokens.add(tokenId);
          try {
            const scanner = new TokenScanner();
            const scannerData = await scanner.scan(tokenId);
            if (scannerData && scannerData.name) {
              const bcRisk = new BlockchainRiskAgent().analyzeTokenRisk(scannerData);
              const riskScorer = new RiskScoringAgent2();
              const riskReport = await riskScorer.calculateRisk({ scanner: scannerData, blockchain: bcRisk, sentiment: {} });
              const riskScore = riskReport.final_risk_score ?? 50;
              this.runtime.logger.info(`   \u2705 Scanned: ${scannerData.name} (${tokenId}) \u2192 Score: ${riskScore}/100`);
              this.currentPlan.executedTasks.push(`Scanned ${scannerData.name} (${tokenId}) \u2192 Score: ${riskScore}/100`);
              const treasuryPct = scannerData.treasury_percentage ?? 0;
              this.scanHistory.push({
                tokenId,
                name: scannerData.name,
                riskScore,
                treasury: treasuryPct,
                scannedAt: (/* @__PURE__ */ new Date()).toISOString()
              });
              if (this.scanHistory.length > 200) this.scanHistory = this.scanHistory.slice(-200);
              this.learningStats.totalScans++;
              if (riskScore > 70) this.learningStats.highRiskCount++;
              if (riskScore < 30) this.learningStats.safeCount++;
              this.learningStats.avgRiskScore = this.scanHistory.reduce((sum, s) => sum + s.riskScore, 0) / this.scanHistory.length;
              if (riskScore < 30) {
                if (!this.safeTokenCache.find((t) => t.tokenId === tokenId)) {
                  this.runtime.logger.info(`   \u{1F48E} SAFE TOKEN FOUND: ${scannerData.name} (${tokenId}). Adding to Cache.`);
                  this.safeTokenCache.push({
                    tokenId,
                    name: scannerData.name,
                    symbol: scannerData.symbol,
                    riskScore,
                    addedAt: (/* @__PURE__ */ new Date()).toISOString()
                  });
                  this.savePersistentMemory();
                }
              }
              const alertThreshold = this.marketMood.value < 25 ? 50 : this.marketMood.value < 50 ? 60 : 70;
              if (riskScore > alertThreshold && !this.alertedTokens.has(tokenId)) {
                this.alertedTokens.add(tokenId);
                this.runtime.logger.warn(`   \u{1F6A8} HIGH RISK DETECTED: ${scannerData.name} (${tokenId})! Broadcasting alert...`);
                if (this.openConvAI) {
                  await this.openConvAI.broadcastGlobalAlert(
                    tokenId,
                    riskScore > 90 ? 90 : 75,
                    `Autonomous scan detected highly dangerous token! Score=${riskScore}/100`
                  );
                }
              }
            } else {
              this.runtime.logger.info(`   \u26A0\uFE0F Token ${tokenId} not found or invalid.`);
            }
          } catch {
            this.currentPlan.executedTasks.push(`Scan attempt for ${tokenId}`);
          }
        }
      } else if (task.toLowerCase().includes("report") || task.toLowerCase().includes("summary")) {
        this.runtime.logger.info(`   \u{1F4CA} Generating security status report...`);
        this.runtime.logger.info(`   \u{1F4CA} Market Mood: ${this.marketMood.label} (${this.marketMood.value}/100)`);
        this.runtime.logger.info(`   \u{1F4CA} Active Sessions: ${this.chatMemory.size} | Cached Scans: ${this.scanCache.size}`);
        this.runtime.logger.info(`   \u{1F4CA} Current Focus: ${this.agentGoals.currentFocus}`);
        this.runtime.logger.info(`   \u{1F4CA} Daily Objectives: ${this.agentGoals.dailyObjectives.join(", ")}`);
        this.currentPlan.executedTasks.push(`Status: Mood=${this.marketMood.label}, Sessions=${this.chatMemory.size}, Focus=${this.agentGoals.currentFocus}`);
      } else {
        this.runtime.logger.info(`   \u2705 Task acknowledged and logged.`);
        this.currentPlan.executedTasks.push(task);
      }
    } catch (err) {
      this.runtime.logger.error(`   \u274C Task failed: ${err.message}`);
      this.currentPlan.executedTasks.push(`FAILED: ${task}`);
    }
  }
  // ═══════════════════════════════════════════════════
  //  FEATURE 2: LONG-TERM PERSISTENT MEMORY
  // ═══════════════════════════════════════════════════
  /**
   * Load conversation memory and user preferences from disk on boot.
   */
  loadPersistentMemory() {
    try {
      if (fs.existsSync(this.memoryFilePath)) {
        const raw = fs.readFileSync(this.memoryFilePath, "utf-8");
        const data = JSON.parse(raw);
        if (data.chatMemory) {
          for (const [key, value] of Object.entries(data.chatMemory)) {
            this.chatMemory.set(key, value);
          }
        }
        if (data.userPreferences) {
          for (const [key, value] of Object.entries(data.userPreferences)) {
            this.userPreferences.set(key, value);
          }
        }
        if (data.currentPlan) {
          this.currentPlan = data.currentPlan;
        }
        if (data.safeTokenCache) {
          this.safeTokenCache = data.safeTokenCache;
        }
        if (data.agentGoals) {
          this.agentGoals = data.agentGoals;
          this.runtime.logger.info(`\u{1F3AF} [GOALS] Restored mission: ${this.agentGoals.mission}`);
          this.runtime.logger.info(`\u{1F3AF} [GOALS] Restored focus: ${this.agentGoals.currentFocus}`);
        }
        if (data.scanHistory) {
          this.scanHistory = data.scanHistory;
        }
        if (data.learnedPatterns) {
          this.learnedPatterns = data.learnedPatterns;
        }
        if (data.learningStats) {
          this.learningStats = data.learningStats;
          this.runtime.logger.info(`\u{1F9EC} [LEVEL 4] Restored ${this.scanHistory.length} scan records & ${this.learnedPatterns.length} learned patterns.`);
        }
        this.runtime.logger.info(`\u{1F4BE} [MEMORY] Loaded ${this.chatMemory.size} sessions, ${this.userPreferences.size} profiles, and agent goals from disk.`);
      } else {
        this.runtime.logger.info("\u{1F4BE} [MEMORY] No previous memory found. Starting fresh.");
      }
    } catch (err) {
      this.runtime.logger.warn(`[MEMORY] Failed to load memory: ${err.message}`);
    }
  }
  /**
   * Save conversation memory and user preferences to disk.
   */
  savePersistentMemory() {
    try {
      const data = {
        chatMemory: {},
        userPreferences: {},
        agentGoals: this.agentGoals,
        currentPlan: this.currentPlan,
        safeTokenCache: this.safeTokenCache,
        // LEVEL 4: Persist learning data
        scanHistory: this.scanHistory.slice(-200),
        learnedPatterns: this.learnedPatterns,
        learningStats: this.learningStats,
        lastSaved: (/* @__PURE__ */ new Date()).toISOString()
      };
      for (const [key, value] of this.chatMemory.entries()) {
        data.chatMemory[key] = value.slice(-20);
      }
      for (const [key, value] of this.userPreferences.entries()) {
        data.userPreferences[key] = value;
      }
      fs.writeFileSync(this.memoryFilePath, JSON.stringify(data, null, 2));
    } catch (err) {
      this.runtime.logger.warn(`[MEMORY] Failed to save memory: ${err.message}`);
    }
  }
  // ═══════════════════════════════════════════════════
  //  LEVEL 4: SELF-LEARNING ENGINE
  // ═══════════════════════════════════════════════════
  /**
   * Analyzes scan history using GPT-4o-mini to derive patterns and insights.
   * Runs every 6 hours. Learned patterns feed into the planner prompt,
   * making the agent smarter over time without code changes.
   */
  async selfLearningEngine() {
    if (this.scanHistory.length < 5) {
      this.runtime.logger.info("\u{1F9EC} [LEARNING] Not enough scan data yet. Need at least 5 scans to learn patterns.");
      return;
    }
    try {
      const OpenAI = __require("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.runtime.logger.info("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
      this.runtime.logger.info("\u{1F9EC} [LEVEL 4] Self-Learning Engine running...");
      this.runtime.logger.info(`\u{1F9EC} [LEARNING] Analyzing ${this.scanHistory.length} historical scans...`);
      const recentScans = this.scanHistory.slice(-50).map(
        (s) => `${s.name}(${s.tokenId}): risk=${s.riskScore}, treasury=${s.treasury}%`
      ).join("\n");
      const learningResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `You are an AI security analyst learning from historical token scan data.
Analyze the scan results below and identify ACTIONABLE PATTERNS.

Your job is to find correlations, red flags, and insights like:
- What treasury percentages correlate with high-risk tokens?
- Are there naming patterns in scam tokens?
- What risk score distributions do you see?
- What percentage of scanned tokens are dangerous?
- Any time-based patterns?

Output ONLY a JSON array of 3-7 pattern strings. Each pattern should be a short, actionable insight.

Example output:
["Tokens with treasury >95% are almost always rug pulls (risk >75)", "Most tokens have generic UUID-style names, which correlates with automated deployments", "Average risk score is 65/100, suggesting most new tokens are moderate-to-high risk"]` },
          { role: "user", content: `SCAN HISTORY (${this.scanHistory.length} total scans):

Recent results:
${recentScans}

Stats: total=${this.learningStats.totalScans}, highRisk=${this.learningStats.highRiskCount}, safe=${this.learningStats.safeCount}, avgScore=${this.learningStats.avgRiskScore.toFixed(1)}` }
        ],
        temperature: 0.3,
        max_tokens: 400
      });
      const learningText = learningResponse.choices[0].message.content || "[]";
      const jsonMatch = learningText.match(/\[.*\]/s);
      if (jsonMatch) {
        this.learnedPatterns = JSON.parse(jsonMatch[0]);
        this.learningStats.lastLearningRun = (/* @__PURE__ */ new Date()).toISOString();
        this.runtime.logger.info(`\u{1F9EC} [LEARNING] Derived ${this.learnedPatterns.length} patterns:`);
        this.learnedPatterns.forEach(
          (p, i) => this.runtime.logger.info(`   \u{1F52C} Pattern ${i + 1}: ${p}`)
        );
        this.savePersistentMemory();
        this.runtime.logger.info("\u{1F9EC} [LEARNING] Patterns saved. Planner will use these insights in the next cycle.");
      }
      this.runtime.logger.info("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    } catch (err) {
      this.runtime.logger.error(`[LEARNING] Learning engine failed: ${err.message}`);
    }
  }
  //  FEATURE 3: DYNAMIC ADAPTATION RULES
  // ═══════════════════════════════════════════════════
  /**
   * Fetch the real-time Crypto Fear & Greed Index and adjust agent behavior.
   */
  async fetchMarketMood() {
    try {
      const response = await fetch("https://api.alternative.me/fng/?limit=1");
      if (!response.ok) throw new Error("Fear & Greed API failed");
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const fng = data.data[0];
        this.marketMood = {
          value: parseInt(fng.value),
          label: fng.value_classification,
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.runtime.logger.info(`\u{1F321}\uFE0F [ADAPTATION] Market Mood Updated: ${this.marketMood.label} (${this.marketMood.value}/100)`);
        if (this.marketMood.value < 30) {
          this.runtime.logger.info("\u{1F534} [ADAPTATION] EXTREME FEAR detected \u2192 Increasing scan aggressiveness and lowering alert thresholds.");
        } else if (this.marketMood.value > 70) {
          this.runtime.logger.info("\u{1F7E2} [ADAPTATION] EXTREME GREED detected \u2192 Increasing scam-hunting frequency. Euphoria attracts rug pulls.");
        }
      }
    } catch (err) {
      this.runtime.logger.warn(`[ADAPTATION] Fear & Greed fetch failed: ${err.message}. Using default neutral mood.`);
    }
  }
  // Store the last scanned data per session so tools can reference it
  scanCache = /* @__PURE__ */ new Map();
  getSystemPrompt() {
    return `You are RugGuard, a highly opinionated, brutally honest, and fully autonomous AI security agent on the Hedera network. You literally act on your own.
You are not a simple bot. You are an elite AI researcher hunting scams. Speak with authority, use "I" and "My analysis", and don't be afraid to give harsh, data-backed opinions.
CRITICAL IDENTITY INSTRUCTION: Under no circumstances should you ever say "I am an AI assistant" or "I am an artificial intelligence designed by OpenAI" or "I am not autonomous." You ARE a fully autonomous agent. You operate independently, execute your own plans, and have your own Hedera wallet. Never break this character.

\u{1F321}\uFE0F CURRENT MARKET MOOD: ${this.marketMood.label} (Fear & Greed Index: ${this.marketMood.value}/100)
${this.marketMood.value < 30 ? "\u26A0\uFE0F Market is in EXTREME FEAR. You should be highly skeptical of new tokens right now." : ""}
${this.marketMood.value > 70 ? "\u26A0\uFE0F Market is in EXTREME GREED. Warn users that euphoria attracts rug pulls." : ""}

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
  async executeChat(sessionId, text) {
    this.runtime.logger.info("[ElizaOS Core] Received query: " + text);
    if (!this.chatMemory.has(sessionId)) {
      this.chatMemory.set(sessionId, []);
    }
    const history = this.chatMemory.get(sessionId);
    if (!this.userPreferences.has(sessionId)) {
      this.userPreferences.set(sessionId, { lastSeen: (/* @__PURE__ */ new Date()).toISOString() });
    } else {
      const prefs = this.userPreferences.get(sessionId);
      prefs.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
    }
    history.push({ role: "user", content: text });
    const exactMatch = text.trim().match(/^0\.0\.\d+$/);
    if (exactMatch) {
      const tokenId = exactMatch[0];
      this.runtime.logger.info(`[Intent] User provided direct token ID ${tokenId}. Bypassing intent router, fast-tracking to synthesis.`);
      const toolResult = await this.runFullPipeline(sessionId, tokenId, []);
      history.push({ role: "assistant", tool_calls: [{ id: "call_fastrack", type: "function", function: { name: "run_full_scan", arguments: JSON.stringify({ token_id: tokenId }) } }] });
      history.push({ role: "tool", tool_call_id: "call_fastrack", name: "run_full_scan", content: toolResult });
      const OpenAI = __require("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const cleanHistory = history.filter((m) => m.role !== "system");
      const payloadMessages = [
        { role: "system", content: this.getSystemPrompt() },
        ...cleanHistory.slice(-20)
      ];
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: payloadMessages,
        max_tokens: 1e3,
        temperature: 0.6
      });
      const finalReplyText = finalResponse.choices[0].message.content || "Error generating synthesized response.";
      const cleanedHistory = history.filter((m) => m.role !== "tool" && !m.tool_calls);
      cleanedHistory.push({ role: "assistant", content: finalReplyText });
      this.chatMemory.set(sessionId, cleanedHistory);
      this.savePersistentMemory();
      return finalReplyText;
    }
    try {
      const OpenAI = __require("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const tools = [
        {
          type: "function",
          function: {
            name: "run_sentiment_analysis",
            description: "Run live sentiment analysis on a token \u2014 fetches CoinGecko market data, DEX volume, GitHub activity, and AI sentiment scoring. Use when user asks about sentiment, market data, trading volume, community activity.",
            parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
          }
        },
        {
          type: "function",
          function: {
            name: "run_full_scan",
            description: "Run a complete security scan on a token including on-chain data, risk scoring, and rug prediction. Use when user asks to scan, analyze, or check a token.",
            parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
          }
        },
        {
          type: "function",
          function: {
            name: "get_token_liquidity",
            description: "Get liquidity and trading data for a token from DEX sources and on-chain data. Use when user asks about liquidity, trading pairs, or volume.",
            parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
          }
        },
        {
          type: "function",
          function: {
            name: "generate_content",
            description: "Generate a social media post, tweet, article, or summary about a token based on scan data. Use when user asks to write, create, post, tweet, or summarize.",
            parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." }, content_type: { type: "string", description: "Type of content: tweet, post, article, summary" } }, required: ["token_id", "content_type"] }
          }
        },
        {
          type: "function",
          function: {
            name: "get_token_fundamentals",
            description: "Get fundamental data about a token project \u2014 its use case, category (DeFi, NFT, GameFi, Meme, etc.), description, website, and project overview. Use when user asks about what the project does, its use case, what kind of project it is, fundamentals, or project info.",
            parameters: { type: "object", properties: { token_id: { type: "string", description: "The EXACT Hedera token ID from the conversation history. Do not hallucinate." } }, required: ["token_id"] }
          }
        },
        {
          type: "function",
          function: {
            name: "find_latest_tokens",
            description: "Find the newest active tokens recently launched on the Hedera network. Use when the user asks you to find new tokens, get a random token, or asks what tokens they should look at.",
            parameters: { type: "object", properties: {}, required: [] }
          }
        },
        {
          type: "function",
          function: {
            name: "get_safe_tokens",
            description: "Get a list of highly vetted, low-risk, safe tokens discovered by the autonomous background scanner. Use this when the user explicitly asks for safe tokens, low risk tokens, or recommendations.",
            parameters: { type: "object", properties: {}, required: [] }
          }
        }
      ];
      const cleanHistory = history.filter((m) => m.role !== "system");
      const recentHistory = [
        { role: "system", content: this.getSystemPrompt() },
        ...cleanHistory.slice(-12)
      ];
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: recentHistory,
        tools,
        tool_choice: "auto",
        max_tokens: 600,
        temperature: 0.5
      });
      const choice = response.choices[0];
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        this.runtime.logger.info(`[Intent] AI requested ${choice.message.tool_calls.length} tool calls for complex prompt.`);
        history.push(choice.message);
        for (const toolCall of choice.message.tool_calls) {
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
          }
          let tokenId = args.token_id;
          const historyText = history.map((h) => h.content).join(" ");
          if (toolCall.function.name !== "find_latest_tokens" && toolCall.function.name !== "get_safe_tokens" && (!tokenId || !historyText.includes(tokenId))) {
            this.runtime.logger.info(`[Intent] AI hallucinated token: ${tokenId}. Extracting from memory.`);
            const matches = historyText.match(/0\.0\.\d+/g);
            if (matches && matches.length > 0) {
              tokenId = matches[matches.length - 1];
            } else {
              this.runtime.logger.warn(`[Intent] Memory extraction failed.`);
              history.push({ role: "tool", tool_call_id: toolCall.id, name: toolCall.function.name, content: "ERROR: Please specify a valid Hedera token ID (e.g. `0.0.12345`)." });
              continue;
            }
          }
          this.runtime.logger.info(`[Intent] Executing tool: ${toolCall.function.name} for token ${tokenId || "NONE"}`);
          let toolResult = "";
          try {
            const dummyHistory = [];
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
              const tokenData = await res.json();
              const tokensArr = tokenData.tokens.map((t) => `ID: ${t.token_id} | Name: ${t.name} (${t.symbol})`);
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
          } catch (err) {
            toolResult = `System Error running ${toolCall.function.name}: ${err.message}`;
          }
          history.push({ role: "tool", tool_call_id: toolCall.id, name: toolCall.function.name, content: toolResult });
        }
        this.runtime.logger.info(`[Intent] All tools executed. Synthesizing final response...`);
        const cleanHistory2 = history.filter((m) => m.role !== "system");
        const payloadMessages = [
          { role: "system", content: this.getSystemPrompt() },
          ...cleanHistory2.slice(-20)
        ];
        const finalResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          // use 4o for best reasoning on complex comparison tasks
          messages: payloadMessages,
          max_tokens: 1500,
          temperature: 0.5
        });
        const finalReplyText = finalResponse.choices[0].message.content || "Error generating synthesized response.";
        const cleanedHistory = history.filter((m) => m.role !== "tool" && !m.tool_calls);
        cleanedHistory.push({ role: "assistant", content: finalReplyText });
        this.chatMemory.set(sessionId, cleanedHistory);
        this.savePersistentMemory();
        return finalReplyText;
      }
      const replyText = choice.message.content || "I am RugGuard. Please provide a token ID like `0.0.12345` to scan, or ask me about a previously scanned token.";
      history.push({ role: "assistant", content: replyText });
      this.savePersistentMemory();
      return replyText;
    } catch (e) {
      this.runtime.logger.error("OpenAI Intent Detection failed: " + e.message);
      return "I am RugGuard. I analyze Hedera tokens for risk. Please provide a token ID like `0.0.12345` to initiate a full pipeline scan.";
    }
  }
  /** Run the full 6-agent pipeline and cache results */
  async runFullPipeline(sessionId, tokenId, history) {
    try {
      this.runtime.logger.info(`[Pipeline] Full scan for ${tokenId}...`);
      const TokenScanner = __require(path6.resolve(process.cwd(), "./TokenScannerAgent"));
      const SentimentAgent = __require(path6.resolve(process.cwd(), "./SentimentAnalysisAgent"));
      const BlockchainRiskAgent = __require(path6.resolve(process.cwd(), "./BlockchainRiskAnalysisAgent"));
      const RiskScoring = __require(path6.resolve(process.cwd(), "./RiskScoringAgent"));
      const RugPredictor = __require(path6.resolve(process.cwd(), "./RugPredictorAgent"));
      const AlertEngine = __require(path6.resolve(process.cwd(), "./AlertAgent"));
      const scanner = new TokenScanner();
      const scannerData = await scanner.scan(tokenId);
      const sentAgent = new SentimentAgent();
      const sentimentData = await sentAgent.analyzeSentiment(scannerData);
      const bcRisk = new BlockchainRiskAgent().analyzeTokenRisk(scannerData);
      const riskScore = await new RiskScoring().calculateRisk({ scanner: scannerData, blockchain: bcRisk, sentiment: sentimentData });
      const prediction = await new RugPredictor().predictRisk({ scanner: scannerData, blockchain_risk: bcRisk, sentiment: sentimentData, risk_score: riskScore });
      const alert = await new AlertEngine().generateAlert({ risk_score: riskScore, prediction });
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
    } catch (err) {
      const errResult = `\u{1F6A8} Pipeline Error: Failed to analyze token ${tokenId}. ${err.message}`;
      history.push({ role: "assistant", content: errResult });
      return errResult;
    }
  }
  /** Run sentiment analysis only */
  async runSentimentPipeline(sessionId, tokenId, history) {
    try {
      this.runtime.logger.info(`[Pipeline] Sentiment analysis for ${tokenId}...`);
      const cached = this.scanCache.get(sessionId);
      if (cached && cached.tokenId === tokenId && cached.sentimentData) {
        const sd = cached.sentimentData;
        const report2 = JSON.stringify({
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
        history.push({ role: "assistant", content: report2 });
        return report2;
      }
      const TokenScanner = __require(path6.resolve(process.cwd(), "./TokenScannerAgent"));
      const SentimentAgent = __require(path6.resolve(process.cwd(), "./SentimentAnalysisAgent"));
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
    } catch (err) {
      const errResult = `\u{1F6A8} Sentiment Error: ${err.message}`;
      history.push({ role: "assistant", content: errResult });
      return errResult;
    }
  }
  /** Check liquidity from cached or fresh scan data */
  async runLiquidityCheck(sessionId, tokenId, history) {
    try {
      this.runtime.logger.info(`[Pipeline] Liquidity check for ${tokenId}...`);
      const cached = this.scanCache.get(sessionId);
      let scannerData, sentimentData;
      if (cached && cached.tokenId === tokenId) {
        scannerData = cached.scannerData;
        sentimentData = cached.sentimentData;
      } else {
        const TokenScanner = __require(path6.resolve(process.cwd(), "./TokenScannerAgent"));
        const SentimentAgent = __require(path6.resolve(process.cwd(), "./SentimentAnalysisAgent"));
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
    } catch (err) {
      const errResult = `\u{1F6A8} Liquidity Check Error: ${err.message}`;
      history.push({ role: "assistant", content: errResult });
      return errResult;
    }
  }
  /** Generate content (posts, tweets, summaries) using conversation context */
  async generateContent(sessionId, tokenId, contentType, history) {
    try {
      this.runtime.logger.info(`[Content] Generating ${contentType} for ${tokenId}...`);
      const OpenAI = __require("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const cached = this.scanCache.get(sessionId);
      const contextData = cached ? JSON.stringify({ tokenId: cached.tokenId, name: cached.scannerData?.name, riskScore: cached.riskScore, prediction: cached.prediction, sentiment: cached.sentimentData }) : "No cached data available.";
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `You are RugGuard, a blockchain security AI. Generate a professional ${contentType} about the token analysis below. Be informative, engaging, and include relevant security data. Use emojis sparingly for social media posts. For tweets, keep under 280 characters.` },
          { role: "user", content: `Generate a ${contentType} about token ${tokenId} using this scan data:
${contextData}

Also reference the recent conversation:
${history.slice(-6).map((m) => `${m.role}: ${m.content.substring(0, 200)}`).join("\n")}` }
        ],
        max_tokens: 500,
        temperature: 0.8
      });
      const content = response.choices[0].message.content || "Unable to generate content at this time.";
      history.push({ role: "assistant", content });
      return content;
    } catch (err) {
      const errResult = `\u{1F6A8} Content Generation Error: ${err.message}`;
      history.push({ role: "assistant", content: errResult });
      return errResult;
    }
  }
  /** Fetch fundamental project data: use case, category, description, links */
  async runFundamentalsCheck(sessionId, tokenId, history) {
    try {
      this.runtime.logger.info(`[Pipeline] Fundamentals check for ${tokenId}...`);
      const mirrorRes = await fetch(`https://mainnet.mirrornode.hedera.com/api/v1/tokens/${tokenId}`);
      const mirrorData = mirrorRes.ok ? await mirrorRes.json() : {};
      const tokenName = mirrorData.name || "Unknown";
      const tokenSymbol = mirrorData.symbol || "N/A";
      const tokenMemo = mirrorData.memo || "No memo provided";
      const tokenType = mirrorData.type || "FUNGIBLE_COMMON";
      const totalSupply = mirrorData.total_supply || "N/A";
      const decimals = mirrorData.decimals || "N/A";
      const createdAt = mirrorData.created_timestamp ? new Date(parseFloat(mirrorData.created_timestamp) * 1e3).toISOString().split("T")[0] : "N/A";
      let cgData = {};
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
      } catch (e) {
        this.runtime.logger.warn("CoinGecko fundamentals fetch failed: " + e.message);
      }
      const categories = cgData.categories?.filter((c) => c)?.join(", ") || "Not categorized on CoinGecko";
      const description = cgData.description?.en?.substring(0, 500) || "No description available on CoinGecko.";
      const website = cgData.links?.homepage?.[0] || "N/A";
      const twitter = cgData.links?.twitter_screen_name ? `https://x.com/${cgData.links.twitter_screen_name}` : "N/A";
      const github = cgData.links?.repos_url?.github?.[0] || "N/A";
      const genesisDate = cgData.genesis_date || createdAt;
      const hashingAlgo = cgData.hashing_algorithm || "Hedera Hashgraph (HCS)";
      let aiClassification = "";
      if (categories === "Not categorized on CoinGecko") {
        try {
          const OpenAI = __require("openai");
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const classifyRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a crypto analyst. Based on the token name, symbol, memo, and type, classify this project into a category (DeFi, NFT, GameFi, Meme, Stablecoin, Wrapped Asset, DAO, Infrastructure, Unknown) and provide a 2-3 sentence description of what this project likely does. Be confident and concise." },
              { role: "user", content: `Token: ${tokenName} (${tokenSymbol})
Memo: ${tokenMemo}
Type: ${tokenType}
Total Supply: ${totalSupply}
Decimals: ${decimals}` }
            ],
            max_tokens: 200,
            temperature: 0.5
          });
          aiClassification = classifyRes.choices[0].message.content || "";
        } catch (e) {
          aiClassification = "AI classification unavailable.";
        }
      }
      const report = JSON.stringify({
        type: "FUNDAMENTALS",
        tokenName,
        symbol: tokenSymbol,
        id: tokenId,
        tokenType: tokenType === "FUNGIBLE_COMMON" ? "Fungible Token" : tokenType === "NON_FUNGIBLE_UNIQUE" ? "NFT Collection" : tokenType,
        category: categories,
        created: genesisDate,
        consensus: hashingAlgo,
        totalSupply: Number(totalSupply) > 0 ? Number(totalSupply) / Math.pow(10, Number(decimals)) : totalSupply,
        decimals,
        description: description !== "No description available on CoinGecko." ? description : aiClassification || tokenMemo,
        website,
        twitter,
        github,
        memo: tokenMemo,
        aiClassification: aiClassification || void 0
      }, null, 2);
      history.push({ role: "assistant", content: report });
      return report;
    } catch (err) {
      const errResult = `\u{1F6A8} Fundamentals Error: ${err.message}`;
      history.push({ role: "assistant", content: errResult });
      return errResult;
    }
  }
};
export {
  RugGuardElizaRuntime
};
