"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenScannerProvider = void 0;
const path_1 = __importDefault(require("path"));
const TokenScannerAgent = require(path_1.default.resolve(process.cwd(), "TokenScannerAgent"));
exports.tokenScannerProvider = {
    name: "TOKEN_SCANNER_PROVIDER",
    get: async (runtime, message, state) => {
        try {
            // Extract token ID closely matching 0.0.X from the message
            const text = message.content?.text || "";
            const match = text.match(/0\.0\.\d+/);
            if (!match) {
                return ""; // No token ID detected in the conversation turn
            }
            const tokenId = match[0];
            runtime.logger.info(`[TokenScannerProvider] Intercepted token ID ${tokenId}. Initiating Mirror Node scan...`);
            // Utilize existing heavily-optimized JS logic
            const scanner = new TokenScannerAgent();
            const data = await scanner.scan(tokenId);
            // Eliza Providers must return strings containing context to inject before the LLM thinks
            return `
=== HEDERA MIRROR NODE RAW DATA (TOKEN SCANNER) ===
${JSON.stringify(data, null, 2)}
===================================================
`;
        }
        catch (error) {
            runtime.logger.error(`[TokenScannerProvider] Error: ${error.message}`);
            return `Scanner System Error: Could not fetch data for token. Reason: ${error.message}`;
        }
    }
};
