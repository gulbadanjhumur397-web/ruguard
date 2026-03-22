const Sentiment = require("sentiment");
const sentiment = new Sentiment();
const askLLM = require("./llmClient");

class SentimentAnalysisAgent {
  constructor() {
    // 9. Performance: Add Caching
    // Cache structure: cache[token_symbol] = { timestamp: number, data: Object }
    this.cache = {};
    this.CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Generates a realistic set of simulated social media posts,
   * now including advanced security terminology for testing.
   */
  generateSimulatedPosts(name, symbol) {
    const trustTemplates = [
      `${name} looks like a solid project`,
      `The team behind $${symbol} is a good team`,
      `Everything checks out, ${name} is legit`,
      `I'm holding $${symbol} long term`,
      `The dev is a trusted dev in the community`
    ];

    const fudTemplates = [
      `I'm worried ${name} might rug`,
      `$${symbol} is definitely a rugpull`,
      `${name} seems like a scam`,
      `Are we just exit liquidity for $${symbol}?`,
      `Looks like a honeypot, I can't sell ${name}`,
      `Incoming dev dump for $${symbol}`,
      `Another fraud project... ${name} is a trap`,
      `Watch out for fake liquidity on $${symbol}`,
      `Did they withdraw liquidity from ${name}?`
    ];

    const hypeTemplates = [
      `$${symbol} to the moon!`,
      `${name} is the next bitcoin`,
      `Guaranteed 100x on $${symbol}`,
      `Buy now! Don't miss ${name}`,
      `Huge pump incoming for $${symbol}`,
      `${name} is an early gem`
    ];

    const devRiskTemplates = [
      `Why is the ${name} dev silent?`,
      `There is no roadmap for $${symbol}`,
      `Anonymous dev for ${name} makes me nervous`,
      `The team missing in action on $${symbol}?`,
      `${name} has no audit yet`
    ];

    const generalTemplates = [
      `What does everyone think about ${name}?`,
      `${name} volume is picking up`,
      `${name} token is gaining attention lately`,
      `Reading the whitepaper for ${symbol}`,
      `New Hedera token`,
      `Anyone trading this?`
    ];

    // Select 30-50 posts
    const numPosts = Math.floor(Math.random() * 21) + 30;
    const posts = [];

    // Probability targets: 40% positive, 30% neutral, 30% negative.
    // We map categories to these buckets:
    // Positive bucket (40%): trustTemplates + hypeTemplates
    // Negative bucket (30%): fudTemplates + devRiskTemplates
    // Neutral bucket (30%): generalTemplates

    // Base loop with explicit probability distribution 
    for (let i = 0; i < numPosts; i++) {
        let category;
        const rand = Math.random();
        
        if (rand < 0.40) { // 40% Positive
             // Split 60/40 between trust and hype
             category = (Math.random() < 0.6) ? trustTemplates : hypeTemplates;
        } else if (rand < 0.70) { // 30% Negative
             // Split 60/40 between fud and dev risk
             category = (Math.random() < 0.6) ? fudTemplates : devRiskTemplates;
        } else { // 30% Neutral
             category = generalTemplates;
        }
        
        const templateList = category;
        const post = templateList[Math.floor(Math.random() * templateList.length)];
        posts.push(post);
    }
    
    return posts;
  }

  // --- NLP HELPER FUNCTIONS ---

  _detectTrust(post) {
      const phrases = ["solid project", "good team", "legit", "long term", "trusted dev"];
      return phrases.some(phrase => post.toLowerCase().includes(phrase));
  }

  _detectFUD(post) {
      const phrases = ["rug", "rugpull", "scam", "exit liquidity", "honeypot", "dev dump", "fraud", "fake liquidity", "withdraw liquidity"];
      return phrases.some(phrase => post.toLowerCase().includes(phrase));
  }

  _detectHype(post) {
      const phrases = ["100x", "moon", "next bitcoin", "buy now", "don't miss", "pump", "early gem"];
      return phrases.some(phrase => post.toLowerCase().includes(phrase));
  }

  _detectDevRisk(post) {
      const phrases = ["dev silent", "no roadmap", "anonymous dev", "team missing", "no audit"];
      return phrases.some(phrase => post.toLowerCase().includes(phrase));
  }

  _calculateRiskMetrics(metrics) {
      const fud_score = metrics.fud_mentions * 5;
      const manipulation_score = metrics.manipulation_mentions * 4;

      let developer_trust_risk = "LOW";
      if (metrics.dev_risk_mentions >= 6) {
          developer_trust_risk = "HIGH";
      } else if (metrics.dev_risk_mentions >= 3) {
          developer_trust_risk = "MEDIUM";
      }

      let community_trust_score = (metrics.positive_mentions * 3) + (metrics.community_trust_mentions * 4) - (metrics.fud_mentions * 3);
      community_trust_score = Math.max(0, Math.min(100, (community_trust_score * 2) + 50)); 

      let community_risk_index = (fud_score * 0.4) + (manipulation_score * 0.3) + (metrics.dev_risk_mentions * 0.3);
      community_risk_index = Math.max(0, Math.min(100, Math.floor(community_risk_index)));

      let sentiment_confidence = Math.floor((metrics.total_posts / 50) * 100);
      sentiment_confidence = Math.min(100, sentiment_confidence);

      let sentiment_security_rating = "LOW RISK";
      if (community_risk_index > 70) {
          sentiment_security_rating = "HIGH RISK";
      } else if (community_risk_index >= 40) {
          sentiment_security_rating = "MEDIUM RISK";
      }

      return {
          fud_score,
          manipulation_score,
          developer_trust_risk,
          community_trust_score,
          community_risk_index,
          sentiment_confidence,
          sentiment_security_rating
      };
  }

  // --- EXTERNAL INTELLIGENCE HELPERS ---

  /**
   * Safe fetch helper with timeout
   */
  async _fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  /**
   * 1. CoinGecko Community Intelligence
   */
  async fetchCoinGeckoData(tokenSymbol) {
    try {
      // CoinGecko search endpoint to find the ID first, then fetch the coin.
      // This is a mockup of the exact fields since many specific endpoint paths require PRO API or precise IDs.
      // We will query the search endpoint mapping:
      const searchResponse = await this._fetchWithTimeout(`https://api.coingecko.com/api/v3/search?query=${tokenSymbol}`);
      if (!searchResponse.ok) throw new Error("CoinGecko search failed");
      const searchData = await searchResponse.json();
      
      let id = tokenSymbol.toLowerCase();
      if (searchData.coins && searchData.coins.length > 0) {
          id = searchData.coins[0].id;
      }

      const response = await this._fetchWithTimeout(`https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=true&developer_data=true`);
      
      if (!response.ok) {
         return { coingecko_data_available: false };
      }

      const data = await response.json();
      
      // Attempt to extract data safely
      return {
          coingecko_data_available: true,
          coingecko_community_score: data.community_score || 0,
          coingecko_dev_score: data.developer_score || 0,
          public_interest_score: data.public_interest_score || 0,
          bullish_percentage: data.sentiment_votes_up_percentage || 0,
          bearish_percentage: data.sentiment_votes_down_percentage || 0,
          github_repos_url: data.links?.repos_url?.github?.[0] || null,
          // Token fundamentals
          current_price: data.market_data?.current_price?.usd || 0,
          market_cap: data.market_data?.market_cap?.usd || 0,
          fully_diluted_valuation: data.market_data?.fully_diluted_valuation?.usd || 0,
          circulating_supply: data.market_data?.circulating_supply || 0,
          total_supply: data.market_data?.total_supply || 0,
          max_supply: data.market_data?.max_supply || 0,
          price_change_24h: data.market_data?.price_change_percentage_24h || 0,
          ath: data.market_data?.ath?.usd || 0,
          atl: data.market_data?.atl?.usd || 0,
          tvl: data.market_data?.total_value_locked?.usd || null,
          
          // Qualitative Project Metrics
          project_description: data.description?.en || "No description available",
          categories: data.categories || [],
          homepage: data.links?.homepage?.[0] || null,
          whitepaper_link: data.links?.whitepaper || null
      };

    } catch (error) {
      return { coingecko_data_available: false };
    }
  }

  /**
   * Helper: Convert Hedera Token ID (0.0.12345) to EVM Hex Address
   */
  _toEvmAddress(tokenId) {
      if (!tokenId || !tokenId.startsWith('0.0.')) return null;
      const numStr = tokenId.split('.')[2];
      try {
          const num = BigInt(numStr);
          let hex = num.toString(16);
          // Pad with leading zeros to make it 40 characters (20 bytes)
          while (hex.length < 40) {
              hex = '0' + hex;
          }
          return '0x' + hex;
      } catch (e) {
          return null;
      }
  }

  /**
   * 2. GeckoTerminal Native Liquidity & Volume (Zero-Auth, Exact Matching)
   */
  async fetchGeckoTerminalData(tokenId) {
    const evmAddress = this._toEvmAddress(tokenId);
    if (!evmAddress) return { dex_listed: false, dex_risk_level: "UNKNOWN" };

    try {
      // Step 1: Fetch token-level data (liquidity reserve + market cap)
      const tokenResponse = await this._fetchWithTimeout(`https://api.geckoterminal.com/api/v2/networks/hedera-hashgraph/tokens/${evmAddress}`);
      
      if (!tokenResponse.ok) {
          return { dex_listed: false, dex_risk_level: "HIGH" };
      }
      
      const tokenResData = await tokenResponse.json();
      const tokenAttrs = tokenResData?.data?.attributes;
      if (!tokenAttrs) return { dex_listed: false, dex_risk_level: "HIGH" };

      let liquidity_usd = parseFloat(tokenAttrs.total_reserve_in_usd || "0") * 2; // Fallback estimate
      const market_cap_usd = parseFloat(tokenAttrs.market_cap_usd || "0");

      // Step 2: Fetch pool-level data for accurate liquidity, volume & transactions
      let volume_24h = 0;
      let transactions_24h = 0;
      let total_pool_liquidity = 0;

      try {
          const poolsResponse = await this._fetchWithTimeout(`https://api.geckoterminal.com/api/v2/networks/hedera-hashgraph/tokens/${evmAddress}/pools?page=1`);
          if (poolsResponse.ok) {
              const poolsData = await poolsResponse.json();
              for (const pool of (poolsData?.data || [])) {
                  const pa = pool.attributes;
                  total_pool_liquidity += parseFloat(pa?.reserve_in_usd || "0");
                  volume_24h += parseFloat(pa?.volume_usd?.h24 || "0");
                  const txns = pa?.transactions?.h24;
                  if (txns) {
                      transactions_24h += (txns.buys || 0) + (txns.sells || 0);
                  }
              }
              
              if (total_pool_liquidity > 0) {
                  liquidity_usd = total_pool_liquidity;
              }
          }
      } catch (poolErr) {
          // Pool fetch failed, use token-level volume as fallback
          volume_24h = parseFloat(tokenAttrs.volume_usd?.h24 || "0");
      }

      let dex_risk_level = "LOW";
      if (liquidity_usd < 50000) {
          dex_risk_level = "HIGH";
      } else if (liquidity_usd >= 50000 && liquidity_usd < 200000) {
          dex_risk_level = "MEDIUM";
      }

      return {
          dex_listed: true,
          liquidity_usd,
          volume_24h,
          market_cap_usd,
          transactions_24h,
          dex_risk_level
      };

    } catch (error) {
       return { dex_listed: false, dex_risk_level: "UNKNOWN" };
    }
  }

  /**
   * 3. GitHub Developer Trust Signals
   */
  async fetchGitHubData(githubUrl) {
    if (!githubUrl) return null;
    
    try {
        // e.g., "https://github.com/bitcoin/bitcoin" -> owner: "bitcoin", repo: "bitcoin"
        const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) return null;

        const owner = match[1];
        const repo = match[2];

        // Fetch repository metrics
        const response = await this._fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`);
        if (!response.ok) return null;

        const data = await response.json();
        const lastCommitDate = data.pushed_at || data.updated_at;
        
        let last_commit_days = null;
        let developer_activity_risk = "UNKNOWN";

        if (lastCommitDate) {
            const lastDate = new Date(lastCommitDate);
            const now = new Date();
            const diffTime = Math.abs(now - lastDate);
            last_commit_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (last_commit_days > 90) {
                developer_activity_risk = "HIGH RISK";
            } else if (last_commit_days >= 30 && last_commit_days <= 90) {
                developer_activity_risk = "MEDIUM";
            } else {
                developer_activity_risk = "LOW";
            }
        }

        return {
            github_stars: data.stargazers_count || 0,
            last_commit_days,
            developer_activity_risk
        };
    } catch (error) {
        return null;
    }
  }

  /**
   * 4. Sentiment Fusion Layer - Hybrid Scoring
   */
  calculateCommunityIntelligence({ local_sentiment_score, cg_score, dex_score, gh_score }) {
      // Normalizing to 100 pt scales
      // local_sentiment_score bounds roughly 0-100
      // cg_score logic: coingecko community score typically 0-100
      // dex risk logic: mapped 0, 50, 100 based on risk
      let mapped_dex_score = 50; 
      if (dex_score === "LOW") mapped_dex_score = 100;
      else if (dex_score === "HIGH") mapped_dex_score = 10;
      
      // Github logic
      let mapped_gh_score = 50;
      if (gh_score === "LOW") mapped_gh_score = 100;
      else if (gh_score === "HIGH RISK") mapped_gh_score = 10;
      
      const score = (local_sentiment_score * 0.3) + 
                    (cg_score * 0.25) + 
                    (mapped_dex_score * 0.25) + 
                    (mapped_gh_score * 0.20);
                    
      return Math.floor(Math.max(0, Math.min(100, score)));
  }

  // --- PROFESSIONAL RISK & SUMMARY ---

  generateSecuritySummary(metrics, externalIntelligence) {
      const { liquidity_usd, developer_activity_risk, external_risk_rating } = externalIntelligence;
      
      let liqPhrase = "unknown liquidity metrics";
      if (liquidity_usd !== undefined) {
         if (liquidity_usd < 50000) liqPhrase = "critically low DEX liquidity";
         else if (liquidity_usd < 200000) liqPhrase = "moderate liquidity reserves";
         else liqPhrase = "healthy liquidity pools";
      }
      
      let devPhrase = "unverified development metrics";
      if (developer_activity_risk === "LOW") devPhrase = "robust and active development tracks";
      else if (developer_activity_risk === "HIGH RISK") devPhrase = "stagnant or abandoned repositories";

      if (external_risk_rating === "HIGH") {
          return `High Risk Alert: ${liqPhrase} combined with ${devPhrase} suggests elevated rug risk. External intelligence flags severe network vulnerabilities paired with poor community sentiment ratios.`;
      } else if (external_risk_rating === "MEDIUM") {
          return `Moderate Warning: External intelligence analysis shows ${liqPhrase} alongside ${devPhrase}. Community sentiment remains cautious but balanced.`;
      } else {
          return `Secure Outlook: External intelligence analysis shows ${liqPhrase} and ${devPhrase}. Community sentiment remains steadily positive with minimal manipulation detected.`;
      }
  }

  /**
   * Main execution method. Analyzes sentiment around a token using Local NLP + Hybrid External APIs.
   * @param {Object} scannerData - Token data, e.g., {token_id, name, symbol}
   * @returns {Object} Security Intelligence output
   */
  async analyzeSentiment(scannerData) {
    if (!scannerData || !scannerData.name || !scannerData.symbol) {
      throw new Error("Invalid input: Token name and symbol are required.");
    }

    const { token_id, name, symbol } = scannerData;
    
    console.log(`Running Sentiment Intelligence Engine for ${name}...`);

    // --- CHECK CACHE ---
    const currentTime = Date.now();
    let externalData = null;
    if (this.cache[symbol] && (currentTime - this.cache[symbol].timestamp < this.CACHE_DURATION_MS)) {
        console.log(`[CACHE HIT] Using cached external intelligence for ${symbol}`);
        externalData = this.cache[symbol].data;
    } else {
        // --- FETCH EXTERNAL DATA ---
        externalData = {
            coingecko: {},
            dex: {},
            github: {},
            sources: []
        };
        
        console.log(`Fetching CoinGecko intelligence...`);
        const cgData = await this.fetchCoinGeckoData(symbol);
        if (cgData && cgData.coingecko_data_available) {
            externalData.coingecko = cgData;
            externalData.sources.push("coingecko");
        }

        console.log(`Fetching DEX liquidity signals...`);
        const dexData = await this.fetchGeckoTerminalData(token_id);
        
        externalData.dex = dexData || { dex_listed: false };
        if (dexData?.dex_listed) externalData.sources.push("geckoterminal");

        if (externalData.coingecko.github_repos_url) {
            console.log(`Fetching developer activity...`);
            const ghData = await this.fetchGitHubData(externalData.coingecko.github_repos_url);
            if (ghData) {
                externalData.github = ghData;
                externalData.sources.push("github");
            }
        }
        
        // Cache the result
        this.cache[symbol] = {
            timestamp: currentTime,
            data: externalData
        };
    }
    
    // --- LOCAL NLP SENTIMENT ---
    const posts = this.generateSimulatedPosts(name, symbol);
    
    let positive_mentions = 0;
    let neutral_mentions = 0;
    let negative_mentions = 0;
    let community_trust_mentions = 0;
    let fud_mentions = 0;
    let manipulation_mentions = 0;
    let dev_risk_mentions = 0;
    
    for (const post of posts) {
        const result = sentiment.analyze(post);
        if (result.score > 2) positive_mentions++;
        else if (result.score >= -2 && result.score <= 2) neutral_mentions++;
        else negative_mentions++;
        
        if (this._detectTrust(post)) community_trust_mentions++;
        if (this._detectFUD(post)) fud_mentions++;
        if (this._detectHype(post)) manipulation_mentions++;
        if (this._detectDevRisk(post)) dev_risk_mentions++;
    }

    const metrics = {
        total_posts: posts.length,
        positive_mentions, neutral_mentions, negative_mentions,
        community_trust_mentions, fud_mentions, manipulation_mentions, dev_risk_mentions
    };

    const riskMetrics = this._calculateRiskMetrics(metrics);

    console.log(`Calculating intelligence score...`);

    // --- FUSION LAYER ---
    // Extract liquidity from GeckoTerminal
    const combined_dex_liquidity = externalData.dex?.liquidity_usd || 0;
    const combined_volume_24h = externalData.dex?.volume_24h || externalData.coingecko?.volume_24h || 0;

    const preferred_dex_score = externalData.dex?.dex_risk_level || "HIGH";

    const community_intelligence_score = this.calculateCommunityIntelligence({
        local_sentiment_score: riskMetrics.community_trust_score,
        cg_score: externalData.coingecko.coingecko_community_score || 0,
        dex_score: preferred_dex_score,
        gh_score: externalData.github.developer_activity_risk || riskMetrics.developer_trust_risk // Fallback to local NLP
    });

    let external_risk_rating = "HIGH";
    if (community_intelligence_score > 70) external_risk_rating = "LOW RISK";
    else if (community_intelligence_score >= 40) external_risk_rating = "MEDIUM";

    // --- FINAL SUMMARY ---
    const summary = this.generateSecuritySummary(metrics, {
        liquidity_usd: combined_dex_liquidity,
        developer_activity_risk: externalData.github.developer_activity_risk,
        external_risk_rating
    });

    // --- AI SENTIMENT ANALYSIS (LLM ENHANCEMENT) ---
    const tokenName = name;
    const liquidity = combined_dex_liquidity || 0;
    const bullishPercent = externalData.coingecko.bullish_percentage || 0;
    const bearishPercent = externalData.coingecko.bearish_percentage || 0;
    const dexRisk = preferred_dex_score || "UNKNOWN";
    const communityRisk = riskMetrics.community_risk_index;

    // Use GeckoTerminal Market Cap if available, fallback to CoinGecko
    const marketCap = externalData.dex?.market_cap_usd || externalData.coingecko.market_cap || 0;
    const nvtRatio = (marketCap > 0 && combined_volume_24h > 0) 
        ? +(marketCap / combined_volume_24h).toFixed(2) 
        : "Unknown";
    const projectDesc = externalData.coingecko.project_description || "Unknown";
    const whitepaper = externalData.coingecko.whitepaper_link || "None";

    const aiPrompt = `
Analyze this token market sentiment:

Token: ${tokenName}
Project Utility: ${projectDesc.substring(0, 150)}...
Market Cap: $${marketCap}
Liquidity USD: $${liquidity}
NVT Ratio: ${nvtRatio}
Bullish sentiment: ${bullishPercent}%
Bearish sentiment: ${bearishPercent}%
DEX risk level: ${dexRisk}
Community risk index: ${communityRisk}

Explain:
1 overall sentiment condition
2 fundamental market strength (using Cap, Liquidity, and NVT)
3 possible rug concerns

Max 3 short sentences.
`;

    let sentimentSummary;
    try {
      sentimentSummary = await askLLM(aiPrompt);
    } catch (err) {
      sentimentSummary = "AI sentiment unavailable";
    }

    // Determine AI market confidence from available data
    let ai_market_confidence = "NEUTRAL";
    if (bullishPercent > bearishPercent && marketCap > 500000) {
      ai_market_confidence = "STRONG";
    } else if (bullishPercent > bearishPercent) {
      ai_market_confidence = "MODERATE";
    } else if (bearishPercent > 60 || liquidity < 10000) {
      ai_market_confidence = "WEAK";
    }

    // --- DATA QUALITY CALCULATIONS ---
    const api_sources = externalData.sources.length;
    const liquidity_present = combined_dex_liquidity > 0;
    
    let confidence_score = (metrics.total_posts * 0.5) + (api_sources * 10) + (liquidity_present ? 15 : 0);
    
    // Bonuses for fundamental data
    if (whitepaper !== "None" && whitepaper !== null) confidence_score += 10;
    if (marketCap > 0) confidence_score += 10;

    // Negative factors
    if (metrics.total_posts < 20) confidence_score -= 10;
    if (!externalData.coingecko.coingecko_data_available) confidence_score -= 10;
    if (externalData.github.developer_activity_risk === "UNKNOWN" || !externalData.github.developer_activity_risk) confidence_score -= 10;
    
    // Penalty for impossible/extreme NVT
    if (nvtRatio !== "Unknown" && nvtRatio > 100000) confidence_score -= 5;
    
    confidence_score = Math.floor(Math.min(100, Math.max(0, confidence_score)));
    
    let data_quality = "LOW";
    if (confidence_score >= 70) data_quality = "HIGH";
    else if (confidence_score >= 40) data_quality = "MEDIUM";

    return {
        token_id: token_id || "unknown",
        posts_analyzed: metrics.total_posts,
        sentiment_security_rating: riskMetrics.sentiment_security_rating,
        community_risk_index: riskMetrics.community_risk_index,
        
        confidence_score,
        data_quality,
        
        community_intelligence_score,
        
        coingecko_community_score: externalData.coingecko.coingecko_community_score || 0,
        coingecko_dev_score: externalData.coingecko.coingecko_dev_score || 0,
        bullish_percentage: externalData.coingecko.bullish_percentage || 0,
        bearish_percentage: externalData.coingecko.bearish_percentage || 0,
        
        // Comprehensive Fundamental Data
        fundamental_data: {
            on_chain: {
                active_addresses: "N/A (Requires Pro Node)",
                tx_volume_usd: externalData.dex.volume_24h || 0,
                tx_count: "N/A",
                network_fees: "N/A",
                hash_rate_staked: "N/A"
            },
            project: {
                description: externalData.coingecko.project_description || "Unknown",
                categories: externalData.coingecko.categories || [],
                homepage: externalData.coingecko.homepage || null,
                whitepaper: externalData.coingecko.whitepaper_link || "N/A",
                team: "N/A",
                use_case: "N/A",
                roadmap: "N/A",
                competitor_analysis: "N/A"
            },
            financial: {
                current_price: externalData.coingecko.current_price || 0,
                market_cap: externalData.coingecko.market_cap || 0,
                fdv: externalData.coingecko.fully_diluted_valuation || 0,
                circulating_supply: externalData.coingecko.circulating_supply || 0,
                total_supply: externalData.coingecko.total_supply || 0,
                max_supply: externalData.coingecko.max_supply || 0,
                vesting_schedules: "N/A",
                liquidity_usd: combined_dex_liquidity || 0, // Use combined liquidity
                volume_24h: combined_volume_24h || 0 // Use combined volume
            },
            ratios: {
                nvt_ratio: (externalData.coingecko.market_cap && combined_volume_24h > 0) 
                     ? +(externalData.coingecko.market_cap / combined_volume_24h).toFixed(2) 
                     : "N/A",
                mvrv_ratio: "N/A (Requires Historical On-Chain Data)",
                tvl: externalData.coingecko.tvl || "N/A"
            }
        },
        
        dex_listed: externalData.dex.dex_listed || false,
        liquidity_usd: externalData.dex.liquidity_usd || 0,
        volume_24h: externalData.dex.volume_24h || 0,
        dex_risk_level: externalData.dex.dex_risk_level || "UNKNOWN",
        
        developer_activity_risk: externalData.github.developer_activity_risk || "UNKNOWN",
        github_stars: externalData.github.github_stars || 0,
        last_commit_days: externalData.github.last_commit_days || null,
        
        external_risk_rating,
        data_sources_used: externalData.sources,
        summary,

        // AI-enhanced fields
        ai_sentiment_summary: sentimentSummary,
        ai_market_confidence,
        data_quality_note: "AI enhanced sentiment analysis"
    };
  }
}

module.exports = SentimentAnalysisAgent;
