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
 * @param {string} opts.model   'gemini-3.1-flash-lite-preview' (default) or 'gemini-3.1-pro'
 * @param {string} opts.system  Optional system instruction.
 * @param {boolean} opts.json   If true, forces JSON output + parses it.
 * @param {object} opts.schema  Optional JSON schema for structured output.
 * @param {number} opts.temperature  0..1, default 0.3 (we want consistent analysis)
 */
export async function gemini(prompt, {
    model = 'gemini-3.1-flash-lite-preview',
    system,
    json = false,
    schema,
    temperature = 0.3
} = {}) {
    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature,
            maxOutputTokens: 8192
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
    while (attempt < 5) {
        attempt++;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.status === 429) {
            // Rate limited — wait and retry
            const wait = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
            console.warn(`⏳ Gemini rate-limited (attempt ${attempt}/5), waiting ${Math.round(wait)}ms then retrying...`);
            await sleep(wait);
            continue;
        }

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 300)}`);
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error(`Gemini returned no text. Finish reason: ${data?.candidates?.[0]?.finishReason}`);
        }

        if (json) {
            try {
                return JSON.parse(text);
            } catch (e) {
                // Sometimes Gemini wraps JSON in ```json ... ``` — strip that
                const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
                return JSON.parse(cleaned);
            }
        }

        return text;
    }

    throw new Error('Gemini: exhausted retries');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
