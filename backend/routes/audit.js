// routes/audit.js
// Brutally-honest 360 audit: compares what the developer CLAIMS about
// themselves against what their GitHub code actually demonstrates.
//
// Flow:
//   1. Pull profile + repo list + languages
//   2. Pick top ~3 repos by signal (stars + recency + size)
//   3. For each pick, fetch README + package/config file + 1-2 source files
//   4. Feed real excerpts + the claim into Gemini with a staff-engineer
//      code-review prompt
//   5. Return a structured report

import { Router } from 'express';
import {
    getUser,
    getRepo,
    listRepos,
    aggregateLanguages,
    getRepoContents,
    getFileContent,
    getRepoLanguages
} from '../services/github.js';
import { gemini } from '../services/gemini.js';

const router = Router();

const auditCache = new Map();
const AUDIT_TTL_MS = 30 * 60 * 1000;

const MAX_REPOS = 3;
const MAX_FILES_PER_REPO = 3;
const MAX_EXCERPT_CHARS = 4000;

const SOURCE_EXTS = [
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.py', '.rb', '.go', '.rs', '.java', '.kt',
    '.swift', '.c', '.cc', '.cpp', '.h', '.hpp',
    '.cs', '.php', '.scala', '.lua', '.sh'
];

const CONFIG_FILES = new Set([
    'package.json', 'pyproject.toml', 'requirements.txt',
    'go.mod', 'Cargo.toml', 'Gemfile', 'build.gradle',
    'pom.xml', 'composer.json', 'tsconfig.json'
]);

const SKIP_DIRS = new Set([
    'node_modules', 'dist', 'build', '.next', '.nuxt',
    'vendor', 'target', 'out', '__pycache__', '.venv'
]);

function hasSourceExt(name) {
    const lower = name.toLowerCase();
    return SOURCE_EXTS.some(ext => lower.endsWith(ext));
}

function truncate(s, limit) {
    if (!s) return '';
    if (s.length <= limit) return s;
    return s.slice(0, limit) + '\n... [truncated ' + (s.length - limit) + ' more chars]';
}

function pickTopRepos(repos) {
    return [...repos]
        .map(r => ({
            repo: r,
            signal: (r.stargazers_count || 0) * 3
                + (r.forks_count || 0) * 2
                + Math.min(20, Math.log2((r.size || 1) + 1))
                + (r.description ? 2 : 0)
                + (Array.isArray(r.topics) ? r.topics.length : 0)
        }))
        .sort((a, b) => b.signal - a.signal)
        .slice(0, MAX_REPOS)
        .map(x => x.repo);
}

/**
 * Walk a repo's root, pick README + a config file + a couple of source files.
 * Returns [{ path, content, size }].
 */
async function sampleRepoFiles(owner, repo) {
    const root = await getRepoContents(owner, repo).catch(() => []);
    if (!Array.isArray(root)) return [];

    const files = root.filter(c => c.type === 'file');
    const dirs = root.filter(c => c.type === 'dir' && !SKIP_DIRS.has(c.name));

    const picks = [];

    const readme = files.find(f => /^readme(\.|$)/i.test(f.name));
    if (readme) picks.push(readme.path);

    const config = files.find(f => CONFIG_FILES.has(f.name));
    if (config) picks.push(config.path);

    const rootSource = files
        .filter(f => hasSourceExt(f.name) && f.size < 40_000)
        .sort((a, b) => b.size - a.size)
        .slice(0, 2);
    rootSource.forEach(f => picks.push(f.path));

    if (picks.length < MAX_FILES_PER_REPO) {
        for (const dir of ['src', 'lib', 'app', 'source'].map(n => dirs.find(d => d.name === n)).filter(Boolean)) {
            const inside = await getRepoContents(owner, repo, dir.path).catch(() => []);
            if (!Array.isArray(inside)) continue;
            const candidates = inside
                .filter(c => c.type === 'file' && hasSourceExt(c.name) && c.size < 40_000)
                .sort((a, b) => b.size - a.size)
                .slice(0, 2);
            candidates.forEach(f => picks.push(f.path));
            if (picks.length >= MAX_FILES_PER_REPO + 1) break;
        }
    }

    const unique = [...new Set(picks)].slice(0, MAX_FILES_PER_REPO);

    const fetched = [];
    for (const path of unique) {
        const f = await getFileContent(owner, repo, path, { maxBytes: 40_000 }).catch(() => null);
        if (!f) continue;
        if (f.skipped) continue;
        fetched.push({ path, content: truncate(f.content, MAX_EXCERPT_CHARS), size: f.size });
    }
    return fetched;
}

function buildPrompt({ profile, repos, languages, claim, repoSamples }) {
    const repoSummary = repos.slice(0, 10).map(r => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        size_kb: r.size,
        created_at: r.created_at,
        updated_at: r.updated_at,
        topics: r.topics || []
    }));

    const excerpts = repoSamples.map(s => {
        const body = s.files.map(f => (
            `--- FILE: ${f.path} (${f.size} bytes) ---\n${f.content}`
        )).join('\n\n');
        return `### REPO: ${s.name}\n${body || '(no readable source files)'}`;
    }).join('\n\n');

    return `You are a staff engineer performing a skeptical, brutally-honest 360 code audit. You are comparing what this developer CLAIMS about themselves against what their actual GitHub code demonstrates. Do not flatter. If the profile is thin or the code is junior, say so. If a claim is unsupported, flag it.

## DEVELOPER SELF-CLAIM
"${claim || '(no claim provided — infer the most likely claim from profile/bio and audit that)'}"

## PROFILE
login: ${profile.login}
name: ${profile.name || 'n/a'}
bio: ${profile.bio || 'n/a'}
public_repos: ${profile.public_repos}
followers: ${profile.followers}
account_created: ${profile.created_at}

## LANGUAGE BREAKDOWN (bytes + %)
${JSON.stringify(languages.slice(0, 10), null, 2)}

## REPO SUMMARY (top 10)
${JSON.stringify(repoSummary, null, 2)}

## REAL FILE EXCERPTS (top ${repoSamples.length} repos, sampled)
${excerpts || '(no files could be read — flag this; no code evidence exists)'}

## REQUIRED OUTPUT (JSON only, no prose)

Return ONE JSON object with exactly these keys: verdict, claim_vs_actual, code_review, strengths, elevation_path.

### verdict
{
  level: one of "junior" | "mid" | "senior" | "staff",
  confidence: int 0-100 (how sure you are given the evidence available),
  one_line: one blunt sentence (<= 120 chars) that states the gap between claim and reality,
  reasoning: 2-4 sentence paragraph citing specific repos and specific code patterns as evidence
}
CONFIDENCE CALIBRATION:
- If you saw source files from 3+ repos: confidence can be 60-95.
- If you saw source files from 1-2 repos: confidence capped at 50-70.
- If you only saw READMEs and configs, no source code: confidence capped at 20-40.
- NEVER set confidence above 80 unless you read actual source code from 3+ repos.

LEVEL GROUNDING:
- "staff": requires evidence of system design patterns, multi-service architecture, or advanced patterns across 3+ repos.
- "senior": requires clean error handling, separation of concerns, and evidence of testing or CI in at least 2 repos.
- "mid": basic working code with some structure but missing advanced patterns.
- "junior": single-file scripts, no error handling, no tests, copy-paste patterns.

### claim_vs_actual
{
  claimed_skills: array of { skill (string), evidence: "strong" | "some" | "none", note (one sentence citing a specific repo/file when possible) },
  contradictions: array (0-4 items) of { claim (what they implied), reality (what the code shows), severity: "high" | "medium" | "low" }
}
If no claim was provided, derive claimed_skills from profile bio + repo topics and still run the same check.

### code_review
Array of 3-6 concrete findings across the repos you saw. Each finding:
{
  repo: string,
  file: string (path),
  severity: "blocker" | "major" | "minor",
  issue: one sentence — what the problem is; quote 1-3 actual lines if useful,
  specific_fix: one sentence — the exact change you'd make (not "improve error handling" — "replace the empty catch on line X with a typed Result"),
  why_senior_rejects: one sentence — the concrete blast radius or downstream pain a senior engineer anticipates
}
If the only file you had was a README, you can still find issues in the README (vague claims, missing install steps, no license).
Be specific. Generic advice is forbidden.

### strengths
Array of 2-4 items: { title (short), evidence (one sentence pointing at a specific repo or file) }. Only include genuine strengths. If there aren't many, that's fine — keep it short and honest.

### elevation_path
Array of 3-5 strings. Each item is a CONCRETE action tied to a specific repo. Format: "In <repo>, <action> — moves you from <current level> to <next level> because <reason>."

Do not use phrases like "learn system design", "study best practices", or "practice more". Every suggestion must reference a specific repo and name a specific technique or change.

### technical_red_flags
Array of 3-5 specific architectural or code-level ANTI-PATTERNS found in the repos. Each item:
{
  pattern: string — name the specific anti-pattern (e.g. "God Component", "N+1 query pattern", "Raw SQL concatenation", "No error boundaries", "Shared mutable state", "Missing input validation", "Synchronous blocking in async context"),
  repo: string — which repo exhibits this,
  severity: "critical" | "major" | "minor",
  blast_radius: one sentence — the concrete production damage this anti-pattern causes (e.g. "A single failed API call crashes the entire UI with no recovery path")
}
Be specific. "Bad error handling" is too vague. "Empty catch blocks in auth.js swallow JWT validation failures" is acceptable.

Return ONLY the JSON object.`;
}

const auditSchema = {
    type: 'object',
    properties: {
        verdict: {
            type: 'object',
            properties: {
                level: { type: 'string' },
                confidence: { type: 'integer' },
                one_line: { type: 'string' },
                reasoning: { type: 'string' }
            },
            required: ['level', 'confidence', 'one_line', 'reasoning']
        },
        claim_vs_actual: {
            type: 'object',
            properties: {
                claimed_skills: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            skill: { type: 'string' },
                            evidence: { type: 'string' },
                            note: { type: 'string' }
                        },
                        required: ['skill', 'evidence', 'note']
                    }
                },
                contradictions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            claim: { type: 'string' },
                            reality: { type: 'string' },
                            severity: { type: 'string' }
                        },
                        required: ['claim', 'reality', 'severity']
                    }
                }
            },
            required: ['claimed_skills', 'contradictions']
        },
        code_review: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    repo: { type: 'string' },
                    file: { type: 'string' },
                    severity: { type: 'string' },
                    issue: { type: 'string' },
                    specific_fix: { type: 'string' },
                    why_senior_rejects: { type: 'string' }
                },
                required: ['repo', 'file', 'severity', 'issue', 'specific_fix', 'why_senior_rejects']
            }
        },
        strengths: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    evidence: { type: 'string' }
                },
                required: ['title', 'evidence']
            }
        },
        elevation_path: {
            type: 'array',
            items: { type: 'string' }
        },
        technical_red_flags: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    pattern: { type: 'string' },
                    repo: { type: 'string' },
                    severity: { type: 'string' },
                    blast_radius: { type: 'string' }
                },
                required: ['pattern', 'repo', 'severity', 'blast_radius']
            }
        }
    },
    required: ['verdict', 'claim_vs_actual', 'code_review', 'strengths', 'elevation_path', 'technical_red_flags']
};

function cacheKey(username, claim) {
    return `${username.toLowerCase()}::${(claim || '').trim().slice(0, 500)}`;
}

async function runAudit(username, claim) {
    const key = cacheKey(username, claim);
    const hit = auditCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data;

    const [profile, repos, languages] = await Promise.all([
        getUser(username),
        listRepos(username),
        aggregateLanguages(username)
    ]);

    const topRepos = pickTopRepos(repos);
    const sampleJobs = topRepos.map(async r => ({
        name: r.name,
        files: await sampleRepoFiles(r.owner.login, r.name)
    }));
    const repoSamples = await Promise.all(sampleJobs);

    const prompt = buildPrompt({ profile, repos, languages, claim, repoSamples });

    const analysis = await gemini(prompt, {
        json: true,
        schema: auditSchema,
        temperature: 0.3
    });

    const payload = {
        profile: {
            login: profile.login,
            name: profile.name,
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            html_url: profile.html_url
        },
        claim: claim || '',
        repos_sampled: repoSamples.map(r => ({
            name: r.name,
            files: r.files.map(f => ({ path: f.path, size: f.size }))
        })),
        analysis
    };

    auditCache.set(key, { data: payload, expiresAt: Date.now() + AUDIT_TTL_MS });
    return payload;
}

router.post('/profile/:username', async (req, res, next) => {
    try {
        const claim = typeof req.body?.claim === 'string' ? req.body.claim : '';
        const data = await runAudit(req.params.username, claim);
        res.json(data);
    } catch (err) {
        if (err.status === 404) {
            return res.status(404).json({ error: 'user_not_found', message: `No GitHub user named "${req.params.username}"` });
        }
        if (String(err.message || '').toLowerCase().includes('rate limited')) {
            return res.status(503).json({ error: 'rate_limited', message: err.message });
        }
        next(err);
    }
});

router.get('/profile/:username', async (req, res, next) => {
    try {
        const claim = typeof req.query?.claim === 'string' ? req.query.claim : '';
        const data = await runAudit(req.params.username, claim);
        res.json(data);
    } catch (err) {
        if (err.status === 404) {
            return res.status(404).json({ error: 'user_not_found', message: `No GitHub user named "${req.params.username}"` });
        }
        if (String(err.message || '').toLowerCase().includes('rate limited')) {
            return res.status(503).json({ error: 'rate_limited', message: err.message });
        }
        next(err);
    }
});

// =====================================================================
// PHASE 3 — Single-repo deep audit
// =====================================================================

function buildRepoAuditPrompt({ repoMeta, languages, claim, files }) {
    const excerpts = files.map(f => (
        `--- FILE: ${f.path} (${f.size} bytes) ---\n${f.content}`
    )).join('\n\n');

    return `You are a staff engineer performing a brutally-honest deep audit of a SINGLE repository. Do not flatter. If the code is junior, say so. If a claim is unsupported, flag it.

## DEVELOPER SELF-CLAIM
"${claim || '(no claim provided — infer the developer\'s likely skill level from the code quality)'}"

## REPOSITORY
name: ${repoMeta.name}
full_name: ${repoMeta.full_name}
description: ${repoMeta.description || 'n/a'}
language: ${repoMeta.language || 'n/a'}
stars: ${repoMeta.stargazers_count}
forks: ${repoMeta.forks_count}
size_kb: ${repoMeta.size}
created: ${repoMeta.created_at}
updated: ${repoMeta.updated_at}
topics: ${JSON.stringify(repoMeta.topics || [])}

## LANGUAGE BREAKDOWN (bytes)
${JSON.stringify(languages, null, 2)}

## REAL FILE EXCERPTS
${excerpts || '(no files could be read — flag this; no code evidence exists)'}

## REQUIRED OUTPUT (JSON only, no prose)

Return ONE JSON object with exactly these keys: verdict, claim_vs_actual, code_review, strengths, elevation_path.

### verdict
{
  level: one of "junior" | "mid" | "senior" | "staff",
  confidence: int 0-100,
  one_line: one blunt sentence (<= 120 chars) about the code quality of THIS repo,
  reasoning: 2-4 sentence paragraph citing specific files and code patterns
}

### claim_vs_actual
{
  claimed_skills: array of { skill (string), evidence: "strong" | "some" | "none", note (one sentence citing a specific file) },
  contradictions: array (0-4 items) of { claim, reality, severity: "high" | "medium" | "low" }
}
If no claim was provided, derive claimed_skills from repo description/topics.

### code_review
Array of 3-6 concrete findings. Each finding:
{
  repo: string,
  file: string (path),
  severity: "blocker" | "major" | "minor",
  issue: one sentence — quote 1-3 actual lines if useful,
  specific_fix: one sentence — the exact change (not generic advice),
  why_senior_rejects: one sentence — the concrete blast radius
}

### strengths
Array of 2-4 items: { title (short), evidence (one sentence pointing at a specific file) }.

### elevation_path
Array of 3-5 strings. Each: "In this repo, <action> — moves from <current> to <next> because <reason>."

Return ONLY the JSON object.`;
}

async function runRepoAudit(owner, repoName, claim) {
    const key = `repo::${owner}/${repoName}::${(claim || '').trim().slice(0, 500)}`;
    const hit = auditCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data;

    const [repoMeta, languages] = await Promise.all([
        getRepo(owner, repoName),
        getRepoLanguages(owner, repoName).catch(() => ({}))
    ]);

    const files = await sampleRepoFiles(owner, repoName);
    const prompt = buildRepoAuditPrompt({ repoMeta, languages, claim, files });

    const analysis = await gemini(prompt, {
        json: true,
        schema: auditSchema,
        temperature: 0.3
    });

    const ownerProfile = await getUser(repoMeta.owner?.login || owner).catch(() => null);

    const payload = {
        mode: 'repo',
        profile: ownerProfile ? {
            login: ownerProfile.login,
            name: ownerProfile.name,
            avatar_url: ownerProfile.avatar_url,
            bio: ownerProfile.bio,
            html_url: ownerProfile.html_url
        } : { login: owner, name: owner },
        repo_meta: {
            name: repoMeta.name,
            full_name: repoMeta.full_name,
            description: repoMeta.description,
            language: repoMeta.language,
            stars: repoMeta.stargazers_count,
            forks: repoMeta.forks_count,
            html_url: repoMeta.html_url
        },
        claim: claim || '',
        repos_sampled: [{
            name: repoMeta.name,
            files: files.map(f => ({ path: f.path, size: f.size }))
        }],
        analysis
    };

    auditCache.set(key, { data: payload, expiresAt: Date.now() + AUDIT_TTL_MS });
    return payload;
}

router.post('/repo/:owner/:repo', async (req, res, next) => {
    try {
        const claim = typeof req.body?.claim === 'string' ? req.body.claim : '';
        const data = await runRepoAudit(req.params.owner, req.params.repo, claim);
        res.json(data);
    } catch (err) {
        if (err.status === 404) {
            return res.status(404).json({ error: 'repo_not_found', message: `Repository "${req.params.owner}/${req.params.repo}" not found.` });
        }
        if (String(err.message || '').toLowerCase().includes('rate limited')) {
            return res.status(503).json({ error: 'rate_limited', message: err.message });
        }
        next(err);
    }
});

// =====================================================================
// PHASE 3 — Live URL scan
// =====================================================================

const URL_FETCH_TIMEOUT_MS = 8000;
const URL_MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

// Block private / loopback IPs to prevent SSRF
const BLOCKED_HOSTS = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.0\.0\.0|\[::1\])/i;

function extractStackSignals(html, headers) {
    const signals = {
        frameworks: [],
        meta: {},
        indicators: []
    };

    // Framework fingerprints
    if (html.includes('__NEXT_DATA__') || html.includes('_next/static')) {
        signals.frameworks.push('Next.js');
    }
    if (html.includes('__NUXT__') || html.includes('/_nuxt/')) {
        signals.frameworks.push('Nuxt.js');
    }
    if (html.includes('ng-version') || html.includes('ng-app')) {
        signals.frameworks.push('Angular');
    }
    if (html.includes('data-reactroot') || html.includes('__REACT_DEVTOOLS') || html.includes('react-root')) {
        signals.frameworks.push('React');
    }
    if (html.includes('data-svelte') || html.includes('__svelte')) {
        signals.frameworks.push('Svelte');
    }
    if (html.includes('__VUE__') || html.includes('data-v-')) {
        signals.frameworks.push('Vue.js');
    }
    if (html.includes('__GATSBY')) {
        signals.frameworks.push('Gatsby');
    }
    if (html.includes('__remixContext') || html.includes('__remix')) {
        signals.frameworks.push('Remix');
    }
    if (html.includes('astro-island') || html.includes('astro-static')) {
        signals.frameworks.push('Astro');
    }

    // CSS frameworks
    if (html.includes('tailwindcss') || html.includes('tailwind') || /class="[^"]*\b(flex|grid|bg-|text-|p-|m-)/.test(html.slice(0, 50000))) {
        signals.frameworks.push('Tailwind CSS');
    }
    if (html.includes('bootstrap') || html.includes('btn btn-')) {
        signals.frameworks.push('Bootstrap');
    }

    // Meta tags
    const generatorMatch = html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i);
    if (generatorMatch) signals.meta.generator = generatorMatch[1];

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{0,300})["']/i);
    if (descMatch) signals.meta.description = descMatch[1];

    const titleMatch = html.match(/<title>([^<]{0,200})<\/title>/i);
    if (titleMatch) signals.meta.title = titleMatch[1];

    // Quality indicators
    if (/<meta[^>]*name=["']viewport["']/i.test(html)) signals.indicators.push('Mobile viewport set');
    else signals.indicators.push('⚠ No mobile viewport meta tag');

    if (/<meta[^>]*property=["']og:/i.test(html)) signals.indicators.push('Open Graph tags present');
    else signals.indicators.push('⚠ No Open Graph meta tags');

    if (/<link[^>]*rel=["']icon["']/i.test(html)) signals.indicators.push('Favicon set');

    const scriptCount = (html.match(/<script/gi) || []).length;
    signals.indicators.push(`${scriptCount} script tag(s) loaded`);

    const stylesheetCount = (html.match(/<link[^>]*rel=["']stylesheet["']/gi) || []).length;
    signals.indicators.push(`${stylesheetCount} stylesheet(s) linked`);

    // Server header
    const server = headers.get('server');
    if (server) signals.meta.server = server;
    const poweredBy = headers.get('x-powered-by');
    if (poweredBy) signals.meta.powered_by = poweredBy;

    return signals;
}

function buildUrlAuditPrompt({ url, claim, stack, metrics, htmlSnippet }) {
    return `You are a staff engineer evaluating a LIVE deployed web application from its public-facing HTML and detected stack signals. You cannot see server-side code — be honest about that limitation. Judge what you CAN see.

## DEVELOPER SELF-CLAIM
"${claim || '(no claim provided — assess the site on its own merits)'}"

## URL
${url}

## DETECTED STACK
Frameworks: ${stack.frameworks.length ? stack.frameworks.join(', ') : 'none detected'}
Meta: ${JSON.stringify(stack.meta)}
Indicators: ${stack.indicators.join('; ')}

## SURFACE METRICS
Response time: ${metrics.response_time_ms}ms
Content size: ${metrics.content_length_kb}KB
SSL: ${metrics.has_ssl ? 'yes' : 'no'}
Status: ${metrics.status_code}

## HTML SNIPPET (first ~8000 chars of <head> + <body>)
${htmlSnippet}

## REQUIRED OUTPUT (JSON only)

Return ONE JSON object with these keys: verdict, claim_vs_actual, code_review, strengths, elevation_path.

IMPORTANT context: you are reviewing a deployed URL, not raw source code. Adapt your review to what's observable:
- verdict.level should reflect the engineering quality visible from the deployment ("junior" = no meta tags, broken layout, random inline styles; "senior" = framework detected, SSR, security headers, performance signals)
- code_review findings should reference the HTML/stack (e.g., missing meta tags, no lazy loading, excessive scripts, no caching headers, no HTTPS)
- Be honest that this is a surface-level scan; note that server-side architecture is invisible

### verdict
{ level: "junior"|"mid"|"senior"|"staff", confidence: int 0-100 (should be lower than a full code-review, typically 30-60), one_line: string, reasoning: string }

### claim_vs_actual
{ claimed_skills: [{ skill, evidence: "strong"|"some"|"none", note }], contradictions: [{ claim, reality, severity }] }

### code_review
Array of 3-5 findings about the deployed site:
{ repo: "(deployed site)", file: "(HTML/headers)", severity, issue, specific_fix, why_senior_rejects }

### strengths
Array of 2-3 items: { title, evidence }

### elevation_path
Array of 3-4 concrete suggestions.

Return ONLY the JSON object.`;
}

async function runUrlAudit(url, claim) {
    const key = `url::${url}::${(claim || '').trim().slice(0, 500)}`;
    const hit = auditCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data;

    // Block private IPs
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        throw Object.assign(new Error('Invalid URL'), { status: 400 });
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw Object.assign(new Error('Only HTTP/HTTPS URLs are supported'), { status: 400 });
    }
    if (BLOCKED_HOSTS.test(parsedUrl.hostname)) {
        throw Object.assign(new Error('Cannot scan private/localhost URLs'), { status: 400 });
    }

    // Fetch the URL
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
    const startMs = Date.now();
    let res;
    try {
        res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'ZeroLabs-Scanner/1.0 (career-intelligence)',
                'Accept': 'text/html,application/xhtml+xml'
            },
            redirect: 'follow'
        });
    } catch (fetchErr) {
        clearTimeout(timer);
        if (fetchErr.name === 'AbortError') {
            throw Object.assign(new Error(`URL took too long to respond (>${URL_FETCH_TIMEOUT_MS}ms)`), { status: 504 });
        }
        throw Object.assign(new Error(`Could not reach ${parsedUrl.hostname}: ${fetchErr.message}`), { status: 502 });
    }
    clearTimeout(timer);
    const responseTimeMs = Date.now() - startMs;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw Object.assign(new Error(`URL returned ${contentType}, not HTML. We can only scan web pages.`), { status: 400 });
    }

    const bodyBuffer = await res.arrayBuffer();
    if (bodyBuffer.byteLength > URL_MAX_BODY_BYTES) {
        throw Object.assign(new Error('Page too large to scan (>2MB)'), { status: 400 });
    }
    const html = new TextDecoder().decode(bodyBuffer);

    const metrics = {
        response_time_ms: responseTimeMs,
        content_length_kb: Math.round(bodyBuffer.byteLength / 1024),
        has_ssl: parsedUrl.protocol === 'https:',
        status_code: res.status
    };

    const stack = extractStackSignals(html, res.headers);
    const htmlSnippet = html.slice(0, 8000);

    const prompt = buildUrlAuditPrompt({ url, claim, stack, metrics, htmlSnippet });

    const analysis = await gemini(prompt, {
        model: 'gemini-2.5-flash',
        json: true,
        schema: auditSchema,
        temperature: 0.3
    });

    const payload = {
        mode: 'url',
        url,
        stack_detected: stack,
        surface_metrics: metrics,
        claim: claim || '',
        analysis
    };

    auditCache.set(key, { data: payload, expiresAt: Date.now() + AUDIT_TTL_MS });
    return payload;
}

router.post('/url', async (req, res, next) => {
    try {
        const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
        if (!url) {
            return res.status(400).json({ error: 'missing_url', message: 'A URL is required.' });
        }
        const claim = typeof req.body?.claim === 'string' ? req.body.claim : '';
        const data = await runUrlAudit(url, claim);
        res.json(data);
    } catch (err) {
        if (err.status && err.status >= 400 && err.status < 500) {
            return res.status(err.status).json({ error: 'bad_request', message: err.message });
        }
        if (err.status === 502 || err.status === 504) {
            return res.status(err.status).json({ error: 'upstream_error', message: err.message });
        }
        if (String(err.message || '').toLowerCase().includes('rate limited')) {
            return res.status(503).json({ error: 'rate_limited', message: err.message });
        }
        next(err);
    }
});

export default router;
