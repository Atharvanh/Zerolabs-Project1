// services/gemini.js
// Wraps the Google Gemini API.
//
// Supports multiple API keys for rotation (GEMINI_API_KEY, GEMINI_API_KEY_2, etc.)
// Each call rotates to the next key, effectively multiplying the RPM limit.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── Multi-key rotation ──────────────────────────────────────────────
// Collect all GEMINI_API_KEY* env vars for round-robin rotation
const API_KEYS = [];
if (process.env.GEMINI_API_KEY) API_KEYS.push(process.env.GEMINI_API_KEY);
if (process.env.GEMINI_API_KEY_2) API_KEYS.push(process.env.GEMINI_API_KEY_2);
if (process.env.GEMINI_API_KEY_3) API_KEYS.push(process.env.GEMINI_API_KEY_3);
if (API_KEYS.length === 0) {
    console.error('❌ No GEMINI_API_KEY set in .env');
    process.exit(1);
}
let _keyIndex = 0;
function getKey() {
    const key = API_KEYS[_keyIndex % API_KEYS.length];
    _keyIndex++;
    return key;
}
console.log(`🔑 Gemini: ${API_KEYS.length} API key(s) loaded for rotation`);

// ── Global request queue ─────────────────────────────────────────────
// Serialize requests + rotate keys to maximize throughput.
// Free tier of gemini-2.5-flash = 15 RPM (4s between calls). Stay safely
// under that: 5s for single key = 12 RPM. With N keys we can pipeline,
// so the effective per-key gap is 5s/N.
const SINGLE_KEY_GAP_MS = 5000;
let _queue = Promise.resolve();
let _lastCall = 0;
const MIN_GAP_MS = Math.ceil(SINGLE_KEY_GAP_MS / API_KEYS.length);

function enqueue(fn) {
    const next = _queue.then(async () => {
        const elapsed = Date.now() - _lastCall;
        if (elapsed < MIN_GAP_MS) {
            await sleep(MIN_GAP_MS - elapsed);
        }
        const result = await fn();
        _lastCall = Date.now();
        return result;
    });
    // Isolate the queue from failures — a rejected call must not block all future calls
    _queue = next.catch(() => {});
    return next;
}

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
    return enqueue(() => _geminiRaw(prompt, { model, system, json, schema, temperature }));
}

async function _geminiRaw(prompt, {
    model,
    system,
    json,
    schema,
    temperature
}) {
    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature,
            maxOutputTokens: 8192,
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

    const url = `${GEMINI_BASE}/${model}:generateContent?key=${getKey()}`;

    let attempt = 0;
    const MAX_ATTEMPTS = 4;
    // Exponential-ish backoff so transient free-tier 429s recover
    // without the user ever seeing a failure.
    const BACKOFF = [8000, 20000, 40000];

    while (attempt < MAX_ATTEMPTS) {
        attempt++;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.status === 429) {
            // Honor Retry-After if the server sent one, otherwise use our backoff.
            const retryAfter = parseInt(res.headers.get('retry-after') || '', 10);
            const backoff = BACKOFF[attempt - 1] || 40000;
            const wait = Number.isFinite(retryAfter) && retryAfter > 0
                ? Math.min(retryAfter * 1000, 60000)
                : backoff;
            console.warn(`⏳ Gemini rate-limited (attempt ${attempt}/${MAX_ATTEMPTS}), waiting ${Math.round(wait / 1000)}s...`);
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

    // Throw a clear, detectable rate-limit error
    const err = new Error('rate_limited: Gemini API rate limit exceeded. Please wait 30-60 seconds and try again.');
    err.status = 429;
    throw err;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
