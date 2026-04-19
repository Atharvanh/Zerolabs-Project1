// services/github.js
// Wraps the GitHub REST API.
//
// Why a wrapper: we want ONE place that adds the auth header, handles
// rate limits, decodes base64 file content, and caches responses so we
// don't burn our 5000/hr budget re-demoing the same repo.

const GH_API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN;

// Simple in-memory cache. Resets on server restart — fine for 24hr hackathon.
// Key: full URL. Value: { data, expiresAt }.
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min — long enough to re-demo fast

async function gh(path, { skipCache = false } = {}) {
    const url = `${GH_API}${path}`;

    if (!skipCache) {
        const hit = cache.get(url);
        if (hit && hit.expiresAt > Date.now()) return hit.data;
    }

    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'zerolabs-hackathon'
        }
    });

    // Surface rate-limit info so you see it in server logs when it matters
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining && Number(remaining) < 100) {
        console.warn(`⚠️  GitHub rate limit: ${remaining} requests remaining this hour`);
    }

    if (!res.ok) {
        const body = await res.text();
        const err = new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
        err.status = res.status;
        throw err;
    }

    const data = await res.json();
    cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
}

// --- Public API -------------------------------------------------------

/**
 * Fetch a user's public profile.
 * Returns: { login, name, bio, avatar_url, public_repos, followers, created_at, ... }
 */
export async function getUser(username) {
    return gh(`/users/${encodeURIComponent(username)}`);
}

/**
 * Fetch metadata for a single repo.
 * Returns: { name, full_name, description, language, stargazers_count, forks_count, size, ... }
 */
export async function getRepo(owner, repo) {
    return gh(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

/**
 * Fetch language breakdown for a single repo.
 * Returns: { JavaScript: 12345, Python: 6789, ... } (bytes per language)
 */
export async function getRepoLanguages(owner, repo) {
    return gh(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`);
}

/**
 * List a user's public repositories, sorted by last updated.
 * We cap at 30 — anything more and you'll blow LLM token budgets later.
 * Forks are filtered out because they don't represent the dev's own work.
 */
export async function listRepos(username, { limit = 30 } = {}) {
    const repos = await gh(
        `/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=${limit}&type=owner`
    );
    return repos.filter(r => !r.fork);
}

/**
 * List files at a path inside a repo (default: root).
 * Returns an array of { name, path, type: 'file'|'dir', size, ... }
 */
export async function getRepoContents(owner, repo, path = '') {
    return gh(`/repos/${owner}/${repo}/contents/${path}`);
}

/**
 * Fetch and decode a single file's text content.
 * GitHub returns content as base64 — we decode it here.
 * Skips files larger than maxBytes (default 50KB) to protect LLM token budgets.
 */
export async function getFileContent(owner, repo, path, { maxBytes = 50_000 } = {}) {
    const data = await gh(`/repos/${owner}/${repo}/contents/${path}`);
    if (data.type !== 'file') throw new Error(`${path} is not a file`);
    if (data.size > maxBytes) {
        return { path, size: data.size, skipped: true, reason: 'too_large' };
    }
    const text = Buffer.from(data.content, 'base64').toString('utf-8');
    return { path, size: data.size, content: text };
}

/**
 * Recent commit activity for a repo — we'll use this to compute "velocity".
 * Returns last 100 commits (or fewer if the repo is smaller).
 */
export async function getRecentCommits(owner, repo, { limit = 100 } = {}) {
    return gh(`/repos/${owner}/${repo}/commits?per_page=${limit}`);
}

/**
 * Aggregate languages across all repos for a user.
 * Returns: [{ language: 'TypeScript', bytes: 123456, percent: 42.1 }, ...]
 * Sorted descending by bytes.
 */
export async function aggregateLanguages(username) {
    const repos = await listRepos(username);
    const totals = {};

    // Fetch languages for each repo in parallel — but cap concurrency
    // so we don't slam the API.
    const batches = chunk(repos, 5);
    for (const batch of batches) {
        const results = await Promise.all(
            batch.map(r => getRepoLanguages(r.owner.login, r.name).catch(() => ({})))
        );
        for (const langMap of results) {
            for (const [lang, bytes] of Object.entries(langMap)) {
                totals[lang] = (totals[lang] || 0) + bytes;
            }
        }
    }

    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(totals)
        .map(([language, bytes]) => ({
            language,
            bytes,
            percent: Number(((bytes / grandTotal) * 100).toFixed(1))
        }))
        .sort((a, b) => b.bytes - a.bytes);
}

// --- helpers ---
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}
