require("dotenv").config();
const OpenAI = require("openai");

let openai = null;

/**
 * Lazily initializes the OpenAI client.
 * This prevents a crash at require-time when OPENAI_API_KEY is not set.
 */
function getClient() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return null;
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve
 * within `ms` milliseconds, it rejects with a timeout error.
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`LLM request timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Send a prompt to GPT-4o-mini for crypto sentiment analysis.
 * Includes a 5-second timeout to protect the pipeline.
 *
 * @param {string} prompt - The analysis prompt
 * @returns {string} The LLM response text, or a fallback message on failure
 */
async function askLLM(prompt) {
  try {
    const client = getClient();
    if (!client) {
      console.warn("[LLM WARNING] OPENAI_API_KEY not configured — skipping AI analysis");
      return "AI sentiment analysis unavailable";
    }

    const response = await withTimeout(
      client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a crypto market sentiment analyst specializing in rug pull detection."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      }),
      15000 // 15-second timeout
    );

    return response.choices[0].message.content;
  } catch (error) {
    console.warn(`[LLM WARNING] ${error.message}`);
    return "AI sentiment analysis unavailable";
  }
}

module.exports = askLLM;
