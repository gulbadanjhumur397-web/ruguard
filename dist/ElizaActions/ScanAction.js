"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanTokenAction = void 0;
const path_1 = __importDefault(require("path"));
const TokenScannerAgent = require(path_1.default.resolve(process.cwd(), "TokenScannerAgent"));
const BlockchainRiskAnalysisAgent = require(path_1.default.resolve(process.cwd(), "BlockchainRiskAnalysisAgent"));
const SharedCache_1 = require("./SharedCache");
exports.scanTokenAction = {
    name: "SCAN_TOKEN_ONCHAIN",
    similes: ["GET_TOKEN_DATA", "FETCH_TOKEN_CONFIG", "CHECK_ADMIN_KEYS", "ONCHAIN_SCAN"],
    description: "Fetches on-chain token configuration (mint keys, admin keys, supply) and analyzes immediate blockchain risks.",
    validate: async (runtime, message) => true,
    handler: async (runtime, message, state, options, callback) => {
        const text = message.content?.text || "";
        const match = text.match(/0\.0\.\d+/);
        if (!match) {
            if (callback)
                callback({ text: "Please specify a valid Hedera token ID to scan." });
            return false;
        }
        const tokenId = match[0];
        try {
            if (callback)
                callback({ text: `*Running On-Chain Scanner for ${tokenId}*...` });
            const scanner = new TokenScannerAgent();
            const scannerData = await scanner.scan(tokenId);
            const bcAgent = new BlockchainRiskAnalysisAgent();
            const bcRisk = bcAgent.analyzeTokenRisk(scannerData);
            // Save to shared tool cache
            SharedCache_1.ToolDataCache[tokenId] = {
                ...SharedCache_1.ToolDataCache[tokenId],
                scanner: scannerData,
                blockchain: bcRisk
            };
            const response = `On-Chain Scan Complete for ${scannerData.name || tokenId}:
- Mint Key: ${scannerData.has_mint_authority ? "Enabled! (Risk)" : "Disabled (Safe)"}
- Admin Key: ${scannerData.has_admin_key ? "Enabled! (Risk)" : "Disabled (Safe)"}
- Mint Risk Score: ${bcRisk.mint_risk_score}
- Admin Control Score: ${bcRisk.admin_control_score}
- Overall Blockchain Risk: ${bcRisk.admin_control_risk}`;
            if (callback)
                callback({ text: response });
            return true;
        }
        catch (err) {
            if (callback)
                callback({ text: `Scanner failed: ${err.message}` });
            return false;
        }
    },
    examples: []
};
