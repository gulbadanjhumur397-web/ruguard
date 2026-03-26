# 🛡️ RugGuard — Autonomous AI Security Agent for Hedera

> **⚠️ NOTE TO HACKATHON JUDGES:** 
> The core autonomous pipeline was completed and submitted by the deadline (Commit `f92c080` on March 24). Commits made on March 25-26 were strictly limited to patching a critical API loop bug, updating documentation to help you test the app smoothly, and a few minor post-hackathon quality-of-life adjustments. The architecture presented in our demo video reflects the deadline state.

> **Multi-agent AI pipeline that autonomously protects Hedera users from rug pulls, scam tokens, and market manipulation — powered by ElizaOS, OpenConvAI (HCS-10), and GPT-4o.**

[![Hedera](https://img.shields.io/badge/Hedera-Testnet-blueviolet)](https://hedera.com)
[![ElizaOS](https://img.shields.io/badge/ElizaOS-Agentic_Runtime-green)](https://elizaos.ai)
[![OpenConvAI](https://img.shields.io/badge/OpenConvAI-HCS--10-orange)](https://openconvai.com)
[![Railway](https://img.shields.io/badge/Deployed-Railway-purple)](https://railway.com)

---

## 📌 Overview

RugGuard is a **fully autonomous, self-planning AI security agent** built on the Hedera network. It runs a 10-agent pipeline that scans newly launched HTS tokens, analyzes on-chain risk factors, aggregates multi-source sentiment intelligence, predicts rug pull probability, and broadcasts real-time alerts — all without human intervention.

### Key Features
- 🤖 **Self-Planning Engine** — AI generates its own hourly operational plans using GPT-4o, with creative non-repetition across cycles
- 🧬 **Self-Learning Engine** — Derives patterns from scan history and feeds insights back into the planner
- 🌡️ **Market Adaptation** — Reads the Crypto Fear & Greed Index and dynamically adjusts alert thresholds
- 💬 **Conversational Interface** — Users can chat naturally to request token scans, sentiment reports, and risk analysis
- 📡 **Inter-Agent Communication** — Registers on the OpenConvAI (HCS-10) network for agent-to-agent messaging
- 🔒 **Pipeline Mutex** — Serializes heavy operations to prevent resource contention

---

## 🏗️ Entities

All on-chain entities referenced by RugGuard on the Hedera network:

| Entity | ID | Hashscan Link | Purpose |
|--------|----|---------------|---------|
| **RugGuard Operator Account** | `0.0.8072136` | [View on Hashscan](https://hashscan.io/testnet/account/0.0.8072136) | Agent's Hedera testnet account for OpenConvAI registration and HCS messaging |
| **KARATE Token (Example Scan)** | `0.0.2283230` | [View on Hashscan](https://hashscan.io/mainnet/token/0.0.2283230) | Primary test token used for pipeline validation (Karate Combat) — scanned via mainnet |
| **HBAR (Reference Token)** | `0.0.1456986` | [View on Hashscan](https://hashscan.io/mainnet/token/0.0.1456986) | Wrapped HBAR reference used in DEX liquidity analysis |
| **Hedera Mirror Node (Mainnet)** | — | [mirror-node-api](https://mainnet-public.mirrornode.hedera.com) | Source of truth for token metadata, holder distribution, and transaction data |
| **Hedera Mirror Node (Testnet)** | — | [mirror-node-api](https://testnet.mirrornode.hedera.com) | Used for OpenConvAI (HCS-10) agent registration and inter-agent messaging |

> **Note:** RugGuard autonomously scans newly created HTS tokens via the Hedera Mirror Node API. Token IDs are dynamic — the agent discovers new tokens each planning cycle.

---

## ⚙️ How It Works

RugGuard runs a **6-stage sequential pipeline**, orchestrated by an ElizaOS autonomous runtime with self-planning and self-learning capabilities.

### Pipeline Architecture

```
┌──────────────┐    ┌────────────────────┐    ┌────────────────────────┐
│ Token Scanner │───▶│ Blockchain Risk    │───▶│ Sentiment Analysis     │
│ Agent         │    │ Analysis Agent     │    │ Agent (4-Source Fusion) │
└──────────────┘    └────────────────────┘    └────────────────────────┘
                                                         │
┌──────────────┐    ┌────────────────────┐               ▼
│ Alert Agent  │◀───│ Rug Predictor      │◀──┌────────────────────────┐
│ (Broadcast)  │    │ Agent (ML + LLM)   │   │ Risk Scoring Agent     │
└──────────────┘    └────────────────────┘   │ (Composite Scorer)     │
                                              └────────────────────────┘
```

### Key Functions & Code References

| Stage | Agent | Key Function | File & Line |
|-------|-------|-------------|-------------|
| **1. Token Scanning** | `TokenScannerAgent` | [`scan(tokenId)`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/TokenScannerAgent.js#L14) | Fetches token metadata, holder distribution, admin/supply keys, and treasury % from Hedera Mirror Node |
| **2. Blockchain Risk** | `BlockchainRiskAnalysisAgent` | [`analyzeTokenRisk(scannerData)`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/BlockchainRiskAnalysisAgent.js#L31) | Evaluates on-chain risk signals: admin keys, supply concentration, treasury control |
| **3. Sentiment Analysis** | `SentimentAnalysisAgent` | [`analyzeSentiment(scannerData)`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/SentimentAnalysisAgent.js#L561) | 4-source fusion: Reddit (35%), DEX Liquidity (30%), GitHub (20%), CoinGecko (15%) |
| **3a. SmartScore™** | `SentimentAnalysisAgent` | [`calculateCommunityIntelligence()`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/SentimentAnalysisAgent.js#L445) | SmartScore with divergence correction, allegation boost, and anti-extreme caps |
| **4. Risk Scoring** | `RiskScoringAgent` | [`calculateRisk()`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/RiskScoringAgent.js#L10) | Composite risk score (0-100) with AI reasoning and confidence tiers |
| **5. Rug Prediction** | `RugPredictorAgent` | [`predictRisk()`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/RugPredictorAgent.js#L16) | ML feature extraction + GPT-4o risk prediction with rug probability |
| **6. Alert System** | `AlertAgent` | [`generateAlert()`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/AlertAgent.js#L25) | AI-generated alert summaries with actionable recommendations |

### Autonomous Runtime (ElizaOS)

| Feature | Key Function | File & Line |
|---------|-------------|-------------|
| **Self-Planning Engine** | [`selfPlanningEngine()`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/eliza-runtime.ts#L157) | GPT-4o generates creative, non-repetitive hourly operational plans |
| **Self-Learning Engine** | [`selfLearningEngine()`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/eliza-runtime.ts#L586) | Derives patterns from scan history every 6 hours, feeds insights back |
| **Pipeline Mutex** | [`PipelineMutex`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/server.js#L63) | Serializes heavy pipeline operations, light tasks run in parallel |
| **OpenConvAI Client** | [`OpenConvAIClient`](https://github.com/gulbadanjhumur397-web/ruguard/blob/main/openconvai-client.ts) | HCS-10 agent registration and inter-agent messaging on Hedera |

---

## 🧪 Walkthrough — Manual Testing Guide

Follow these steps to manually test the RugGuard pipeline end-to-end.

### Prerequisites

```bash
git clone https://github.com/gulbadanjhumur397-web/ruguard.git
cd ruguard
npm install
```

Create a `.env` file with your `OPENAI_API_KEY` and `HEDERA_ACCOUNT_ID` (see `.env` template above).

### Step 1: Start the Server

```bash
npm run dev
```

You should see:
```
🟢 RugGuard API Server running on port 3000
🧠 Self-Planning Engine initialized. First plan generating in 10 seconds...
```

### Step 2: Run a Standard Token Analysis

Open a browser or use curl to scan a real Hedera token:

```bash
curl http://localhost:3000/analyze/0.0.2283230
```

**Expected Response:** A full JSON report including:
- `token_id`, `token_name`, `token_symbol`
- `blockchain_risk_level` (LOW / MEDIUM / HIGH / CRITICAL)
- `community_risk_index` (0-100, SmartScore™)
- `rug_risk_score` (0-100, composite)
- `predicted_rug_probability` (0-100, ML + LLM)
- `final_alert_level` and `ai_alert_summary`

### Step 3: Run a Deep Expert Consensus Analysis

```bash
curl http://localhost:3000/analyze/deep/0.0.2283230
```

This runs 3 independent AI experts (Blockchain Forensics, Market Psychology, Data Science) and synthesizes their findings into a consensus report.

### Step 4: Chat with the Agent

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Is 0.0.2283230 safe to invest in?", "session_id": "judge-test"}'
```

The conversational AI will analyze the token and provide a natural-language security assessment.

### Step 5: Run the Full E2E Pipeline Test

```bash
node testFullE2EPipeline.js 0.0.2283230
```

**Expected Output:**
```
  TokenScannerAgent:             PASS
  BlockchainRiskAgent:           PASS
  SentimentAgent:                PASS
  RiskScoringAgent:              PASS
  RugPredictorAgent:             PASS
  AlertAgent:                    PASS
  Data Flow Integrity:           PASS
  AI Prediction Working:         PASS
  Alert System Working:          PASS
  ✅ FINAL STATUS: PIPELINE READY FOR DEMO
```

### Step 6: Observe the Self-Planning Engine

Wait ~10 seconds after server start. The autonomous planner will generate its first operational plan in the console logs:

```
🧠 [SELF-PLANNER] Agent is creating its own operational plan...
🎯 [GOALS] Current Mission: Protect Hedera users from rug pulls...
🤖 [EXECUTING] Scan latest real Hedera tokens
   🔍 Fetched 3 NEW tokens from Hedera Mirror Node
   ✅ Scanned: TokenName (0.0.XXXXX) → Score: 72/100
   🚨 HIGH RISK DETECTED: TokenName! Broadcasting alert...
🧠 [SELF-PLANNER] All planned tasks executed successfully.
```

Each hourly cycle generates a **unique, creative plan** — the agent never repeats the same strategy twice.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js ≥ 18.0.0 |
| **AI Framework** | ElizaOS (Agentic Runtime) |
| **LLM** | OpenAI GPT-4o / GPT-4o-mini |
| **Blockchain** | Hedera Hashgraph (HTS, HCS, Mirror Node) |
| **Inter-Agent** | OpenConvAI / HCS-10 Standard |
| **Sentiment** | Reddit API, CoinGecko, GeckoTerminal, GitHub |
| **Deployment** | Railway (auto-deploy from `main`) |
| **Frontend** | React + Vite |

---

## 📁 Project Structure

```
ruguard/
├── server.js                    # Express API + PipelineMutex
├── eliza-runtime.ts             # ElizaOS autonomous brain (self-planning, learning, adaptation)
├── openconvai-client.ts         # HCS-10 inter-agent communication
├── TokenScannerAgent.js         # Stage 1: On-chain data fetcher
├── BlockchainRiskAnalysisAgent.js  # Stage 2: Blockchain risk evaluator
├── SentimentAnalysisAgent.js    # Stage 3: 4-source sentiment fusion + SmartScore
├── RiskScoringAgent.js          # Stage 4: Composite risk calculator
├── RugPredictorAgent.js         # Stage 5: ML + LLM rug predictor
├── AlertAgent.js                # Stage 6: AI alert generator
├── ConversationalAgent.js       # Natural language chat interface
├── ExpertConsensusAgent.js      # Multi-expert deep analysis
├── testFullE2EPipeline.js       # End-to-end regression test suite
└── frontend/                    # React dashboard
```

---

## 📜 License

MIT License — Built for the Hedera Apex Hackathon 2026.