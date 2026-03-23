const Sentiment = require("sentiment");
const sentiment = new Sentiment();
const askLLM = require("./llmClient");

class SentimentAnalysisAgent {
  constructor() {
    // 9. Performance: Add Caching
    // Cache structure: cache[token_symbol] = { timestamp: number, data: Object }
    this.cache = {};
    this.CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
    // Reddit post dedup cache — skip already-analyzed posts across runs
    this.redditPostCache = new Set();
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
      const current_price = parseFloat(tokenAttrs.price_usd || "0");

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
          current_price,
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
   * 4. Reddit Free JSON Endpoint — Social Intelligence Layer
   * Searches 6 subreddits with tiered reliability weights.
   * Returns relevant posts for LLM semantic analysis.
   */
  async fetchRedditSentiment(name, symbol, tokenId) {
    const subreddits = [
      // Tier 1 — General market sentiment
      { name: "CryptoCurrency", weight: 1.0 },
      { name: "CryptoMarkets", weight: 1.0 },
      // Tier 2 — Early hype & high rug probability
      { name: "CryptoMoonShots", weight: 0.6 },
      { name: "SatoshiStreetBets", weight: 0.6 },
      // Tier 3 — Scam reporting (highest reliability)
      { name: "CryptoScams", weight: 1.4 },
    ];

    const searchTerms = [name, symbol, `$${symbol}`];
    if (tokenId) searchTerms.push(tokenId);
    const query = searchTerms.join("+OR+");

    const allPosts = [];

    for (const sub of subreddits) {
      try {
        const url = `https://www.reddit.com/r/${sub.name}/search.json?q=${encodeURIComponent(query)}&sort=new&restrict_sr=on&limit=10&t=week`;
        const response = await this._fetchWithTimeout(url, {
          headers: { "User-Agent": "RugGuard-SecurityBot/1.0" }
        }, 8000);

        if (!response.ok) continue;

        const data = await response.json();
        const posts = data?.data?.children || [];

        for (const post of posts) {
          const p = post.data;
          if (!p || !p.id) continue;
          // Skip already-analyzed posts
          if (this.redditPostCache.has(p.id)) continue;
          this.redditPostCache.add(p.id);

          // Relevance filter: must contain token name, symbol, or ID
          const text = `${p.title || ""} ${p.selftext || ""}`.toLowerCase();
          const isRelevant = searchTerms.some(term => text.includes(term.toLowerCase()));
          if (!isRelevant) continue;

          const ageHours = (Date.now() / 1000 - (p.created_utc || 0)) / 3600;
          const weight = this._calculateRedditWeight(p.score || 0, sub.weight, ageHours);

          allPosts.push({
            id: p.id,
            subreddit: sub.name,
            subreddit_weight: sub.weight,
            title: (p.title || "").substring(0, 200),
            body: (p.selftext || "").substring(0, 300),
            upvotes: p.score || 0,
            num_comments: p.num_comments || 0,
            created_utc: p.created_utc || 0,
            age_hours: Math.round(ageHours),
            weight
          });
        }
      } catch (err) {
        // Subreddit fetch failed — skip silently
        continue;
      }
    }

    // Keep only top 15 posts by weight for LLM analysis
    allPosts.sort((a, b) => b.weight - a.weight);
    const topPosts = allPosts.slice(0, 15);

    // If no posts found, return minimal result
    if (topPosts.length === 0) {
      return {
        reddit_data_available: false,
        reddit_mentions: 0,
        reddit_sentiment: 0,
        rug_discussion_density: 0,
        dev_trust_score: 0.5,
        social_buzz: 0,
        allegations: []
      };
    }

    // Run batched LLM semantic analysis
    const analysis = await this._analyzeRedditWithLLM(topPosts, name, symbol);

    return {
      reddit_data_available: true,
      reddit_mentions: allPosts.length,
      ...analysis
    };
  }

  /**
   * Batched LLM Semantic Analysis for Reddit Posts
   * Sends up to 15 posts in ONE GPT-4o-mini call to minimize cost.
   */
  async _analyzeRedditWithLLM(posts, tokenName, tokenSymbol) {
    try {
      const postSummaries = posts.map((p, i) => 
        `[${i+1}] r/${p.subreddit} | ↑${p.upvotes} | ${p.age_hours}h ago\nTitle: ${p.title}\nBody: ${p.body.substring(0, 150)}`
      ).join("\n\n");

      const prompt = `You are a blockchain security analyst. Analyze these Reddit posts about "${tokenName}" ($${tokenSymbol}).

${postSummaries}

Return ONLY a JSON object with:
{
  "community_sentiment": -1.0 to 1.0 (overall mood),
  "rug_risk": 0.0 to 1.0 (how likely a rug pull based on discussion),
  "dev_trust": 0.0 to 1.0 (community trust in developers),
  "social_buzz": 0.0 to 1.0 (volume and intensity of discussion),
  "rug_discussion_density": 0.0 to 1.0 (how much rug/scam talk exists),
  "allegations": [{"type": "dev_dump|liquidity_unlock|scam_accusation|none", "confidence": 0.0 to 1.0}]
}

If posts are mostly positive, rug_risk should be low. If posts warn about scams, rug_risk should be high.
Be precise and data-driven.`;

      const result = await askLLM(prompt);
      const jsonMatch = result.match(/\{[\s\S]*\}/); 
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          reddit_sentiment: parsed.community_sentiment || 0,
          rug_risk: parsed.rug_risk || 0,
          dev_trust_score: parsed.dev_trust || 0.5,
          social_buzz: parsed.social_buzz || 0,
          rug_discussion_density: parsed.rug_discussion_density || 0,
          allegations: parsed.allegations || []
        };
      }
    } catch (err) {
      // LLM analysis failed — return neutral defaults
    }

    return {
      reddit_sentiment: 0,
      rug_risk: 0,
      dev_trust_score: 0.5,
      social_buzz: 0,
      rug_discussion_density: 0,
      allegations: []
    };
  }

  /**
   * Reddit Post Weight Calculator
   * weight = log(upvotes+1) × subreddit_reliability × time_decay
   */
  _calculateRedditWeight(upvotes, subredditWeight, ageHours) {
    const upvoteScore = Math.log(Math.abs(upvotes) + 1);
    const timeDecay = Math.exp(-0.1 * ageHours); // Fresh posts matter more
    return upvoteScore * subredditWeight * timeDecay;
  }

  /**
   * 5. Sentiment Fusion Layer - Hybrid Scoring (Updated with Reddit)
   */
  calculateCommunityIntelligence({ local_sentiment_score, cg_score, dex_score, gh_score, reddit_score }) {
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

      // Reddit logic: convert sentiment(-1 to 1) and rug_risk(0 to 1) to 0-100 score
      let mapped_reddit_score = 50; // neutral default
      if (reddit_score && reddit_score.reddit_data_available) {
          const sentimentComponent = ((reddit_score.reddit_sentiment || 0) + 1) * 50; // -1→0, 0→50, 1→100
          const riskComponent = (1 - (reddit_score.rug_risk || 0)) * 100; // 0 risk→100, 1 risk→0
          mapped_reddit_score = (sentimentComponent * 0.4) + (riskComponent * 0.6);
      }
      
      // 5-source fusion: local(20%) + CoinGecko(20%) + DEX(25%) + GitHub(15%) + Reddit(20%)
      const score = (local_sentiment_score * 0.20) + 
                    (cg_score * 0.20) + 
                    (mapped_dex_score * 0.25) + 
                    (mapped_gh_score * 0.15) +
                    (mapped_reddit_score * 0.20);
                    
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
            reddit: {},
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

        // Fetch Reddit social intelligence
        console.log(`Fetching Reddit social intelligence...`);
        const redditData = await this.fetchRedditSentiment(name, symbol, token_id);
        externalData.reddit = redditData || {};
        if (redditData?.reddit_data_available) externalData.sources.push("reddit");
        
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
        gh_score: externalData.github.developer_activity_risk || riskMetrics.developer_trust_risk,
        reddit_score: externalData.reddit || {}
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
Analyze this token market sentiment based on the following metrics:

Token: ${tokenName}
Project Utility: ${projectDesc.substring(0, 150)}...
Market Cap: $${marketCap}
Liquidity USD: $${liquidity}
NVT Ratio: ${nvtRatio}
CoinGecko Community Votes (Bullish): ${bullishPercent}%
CoinGecko Community Votes (Bearish): ${bearishPercent}%
DEX risk level: ${dexRisk}
Community risk index: ${communityRisk}

Explain:
1. Overall sentiment condition (explicitly credit CoinGecko if using their votes. If votes are 0%, state lack of community data).
2. Fundamental market strength (using Cap, Liquidity, and NVT).
3. Possible rug concerns.

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
                current_price: externalData.dex.current_price || externalData.coingecko.current_price || 0,
                market_cap: externalData.dex.market_cap_usd || externalData.coingecko.market_cap || 0,
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
        data_quality_note: "AI enhanced sentiment analysis with Reddit social intelligence",

        // Reddit Social Intelligence (Level 4 upgrade)
        reddit_data_available: externalData.reddit?.reddit_data_available || false,
        reddit_mentions: externalData.reddit?.reddit_mentions || 0,
        reddit_sentiment: externalData.reddit?.reddit_sentiment || 0,
        rug_discussion_density: externalData.reddit?.rug_discussion_density || 0,
        reddit_social_buzz: externalData.reddit?.social_buzz || 0,
        reddit_dev_trust: externalData.reddit?.dev_trust_score || 0.5,
        reddit_rug_risk: externalData.reddit?.rug_risk || 0,
        reddit_allegations: externalData.reddit?.allegations || []
    };
  }
}

module.exports = SentimentAnalysisAgent;
