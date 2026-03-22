/**
 * ═══════════════════════════════════════════════════════════════════
 *  RUGGUARD — CONVERSATION MANAGER
 *  In-memory session & context management for multi-turn conversations
 * ═══════════════════════════════════════════════════════════════════
 */

class ConversationManager {
    constructor() {
        this.sessions = new Map();
        this.SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
        // Global token name → ID registry (persists across sessions)
        this.tokenRegistry = new Map();
        this._startCleanupInterval();
    }

    /**
     * Get an existing session or create a new one.
     * @param {string} sessionId
     * @returns {Object} session object
     */
    getOrCreateSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            session.lastAccessedAt = Date.now();
            return session;
        }

        const session = {
            sessionId,
            conversationHistory: [],
            lastPipelineReport: null,
            lastTokenId: null,
            lastTokenName: null,
            // Multi-token report cache: tokenId → report
            reports: new Map(),
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
        };

        this.sessions.set(sessionId, session);
        return session;
    }

    /**
     * Append a message to the session's conversation history.
     * @param {string} sessionId
     * @param {"system"|"user"|"assistant"} role
     * @param {string} content
     */
    addMessage(sessionId, role, content) {
        const session = this.getOrCreateSession(sessionId);
        session.conversationHistory.push({ role, content });

        // Keep history bounded to last 20 messages to control token usage
        if (session.conversationHistory.length > 20) {
            // Always preserve the first system message if present
            const first = session.conversationHistory[0];
            if (first.role === "system") {
                session.conversationHistory = [
                    first,
                    ...session.conversationHistory.slice(-19),
                ];
            } else {
                session.conversationHistory = session.conversationHistory.slice(-20);
            }
        }
    }

    /**
     * Get the full conversation history for a session.
     * @param {string} sessionId
     * @returns {Array} conversation messages in OpenAI format
     */
    getHistory(sessionId) {
        const session = this.getOrCreateSession(sessionId);
        return session.conversationHistory;
    }

    /**
     * Cache the last pipeline report for follow-up questions.
     * @param {string} sessionId
     * @param {Object} report - Pipeline analysis output
     * @param {string} tokenId
     * @param {string} [tokenName]
     */
    setReport(sessionId, report, tokenId, tokenName) {
        const session = this.getOrCreateSession(sessionId);
        session.lastPipelineReport = report;
        session.lastTokenId = tokenId;
        session.lastTokenName = tokenName || report?.token_name || null;
        // Store in multi-token cache
        session.reports.set(tokenId, report);
        // Register name → ID mapping globally
        const name = (tokenName || report?.token_name || "").toUpperCase().trim();
        if (name && tokenId) {
            this.tokenRegistry.set(name, tokenId);
        }
        // Also register symbol if available
        const symbol = report?.agent_data?.scanner?.symbol;
        if (symbol) {
            this.tokenRegistry.set(symbol.toUpperCase().trim(), tokenId);
        }
    }

    /**
     * Retrieve the last cached pipeline report.
     * @param {string} sessionId
     * @returns {{ report: Object|null, tokenId: string|null, tokenName: string|null }}
     */
    getLastReport(sessionId) {
        const session = this.getOrCreateSession(sessionId);
        return {
            report: session.lastPipelineReport,
            tokenId: session.lastTokenId,
            tokenName: session.lastTokenName,
        };
    }

    /**
     * Get a specific report by token ID from the session cache.
     * @param {string} sessionId
     * @param {string} tokenId
     * @returns {Object|null}
     */
    getReportByTokenId(sessionId, tokenId) {
        const session = this.getOrCreateSession(sessionId);
        return session.reports.get(tokenId) || null;
    }

    /**
     * Get all cached reports for a session.
     * @param {string} sessionId
     * @returns {Map<string, Object>}
     */
    getAllReports(sessionId) {
        const session = this.getOrCreateSession(sessionId);
        return session.reports;
    }

    /**
     * Resolve a token name/symbol to a token ID.
     * @param {string} name
     * @returns {string|null}
     */
    resolveTokenName(name) {
        return this.tokenRegistry.get(name.toUpperCase().trim()) || null;
    }

    /**
     * Remove expired sessions (older than SESSION_TTL_MS).
     */
    cleanup() {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (now - session.lastAccessedAt > this.SESSION_TTL_MS) {
                this.sessions.delete(id);
            }
        }
    }

    /**
     * Start periodic cleanup every 5 minutes.
     */
    _startCleanupInterval() {
        this._cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        // Allow the process to exit even if the timer is active
        if (this._cleanupTimer.unref) {
            this._cleanupTimer.unref();
        }
    }

    /**
     * Stop the cleanup interval (for testing / graceful shutdown).
     */
    destroy() {
        if (this._cleanupTimer) {
            clearInterval(this._cleanupTimer);
            this._cleanupTimer = null;
        }
    }
}

module.exports = ConversationManager;
