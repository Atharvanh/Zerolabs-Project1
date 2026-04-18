// services/gemini.js
// Wraps the Google Gemini API.
//
// Gemini free tier: 15 req/min on 2.5-flash, 1500/day. Plenty for the demo.
// We default to 2.5-flash (fast, smart enough). Use 2.5-pro only for the
// flagship code review call where quality matters most.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const KEY = process.env.GEMINI_API_KEY;

/**
 * Call Gemini. Returns the raw text response.
 *
 * @param {string} prompt       The user prompt.
 * @param {object} opts
 * @param {string} opts.model   'gemini-2.5-flash' (default) or 'gemini-2.5-pro'
 * @param {string} opts.system  Optional system instruction.
 * @param {boolean} opts.json   If true, forces JSON output + parses it.
 * @param {object} opts.schema  Optional JSON schema for structured output.
 * @param {number} opts.temperature  0..1, default 0.3 (we want consistent analysis)
 */
export async function gemini(prompt, {
    model = 'gemini-2.5-flash',
    system,
    json = false,
    schema,
    temperature = 0.3
} = {}) {
    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature,
            maxOutputTokens: 32768,
            thinkingConfig: { thinkingBudget: 0 }
        }
    };

    if (system) {
        body.systemInstruction = { parts: [{ text: system }] };
    }

    if (json) {
        body.generationConfig.responseMimeType = 'application/json';
        if (schema) body.generationConfig.responseSchema = schema;
    }

    const url = `${GEMINI_BASE}/${model}:generateContent?key=${KEY}`;

    let attempt = 0;
    let sawRateLimit = false;
    let lastRateLimitWait = 0;
    while (attempt < 3) {
        attempt++;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.status === 429) {
            // Rate limited — wait and retry
            const retryAfter = Number(res.headers.get('retry-after'));
            const wait = Number.isFinite(retryAfter) && retryAfter > 0
                ? retryAfter * 1000
                : attempt * 2000;
            sawRateLimit = true;
            lastRateLimitWait = wait;
            console.warn(`⏳ Gemini rate-limited, waiting ${wait}ms then retrying...`);
            await sleep(wait);
            continue;
        }

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 300)}`);
        }

        const data = await res.json();
        const candidate = data?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error(`Gemini returned no text. Finish reason: ${candidate?.finishReason}`);
        }

        if (json) {
            try {
                return JSON.parse(text);
            } catch (e) {
                const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
                try {
                    return JSON.parse(cleaned);
                } catch (e2) {
                    const reason = candidate?.finishReason;
                    if (reason === 'MAX_TOKENS') {
                        throw new Error(`Gemini output was truncated (finishReason=MAX_TOKENS). Response was ${text.length} chars. Raise maxOutputTokens or shrink the schema.`);
                    }
                    throw new Error(`Gemini JSON parse failed (finishReason=${reason}): ${e2.message}`);
                }
            }
        }

        return text;
    }

    if (sawRateLimit) {
        const seconds = Math.max(2, Math.ceil(lastRateLimitWait / 1000));
        throw new Error(`Gemini rate limited. Please retry in ${seconds}s.`);
    }

    throw new Error('Gemini: exhausted retries');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
