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
    listRepos,
    aggregateLanguages,
    getRepoContents,
    getFileContent
} from '../services/github.js';
import { gemini } from '../services/gemini.js';

const router = Router();

const auditCache = new Map();
const AUDIT_TTL_MS = 15 * 60 * 1000;

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
        }
    },
    required: ['verdict', 'claim_vs_actual', 'code_review', 'strengths', 'elevation_path']
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
        model: 'gemini-2.5-pro',
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

export default router;
