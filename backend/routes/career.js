// routes/career.js
// Career match engine.
// Scores the user's demonstrated skills against job postings from:
//   1. JSearch API (real-time, if RAPIDAPI_KEY is set)
//   2. Static corpus of 24 curated postings (fallback)
// Uses Gemini ONLY for the 2-sentence intelligence brief.

import { Router } from 'express';
import {
    getUser,
    listRepos,
    aggregateLanguages
} from '../services/github.js';
import { gemini } from '../services/gemini.js';
import { searchJobs } from '../services/jsearch.js';
import { JOB_POSTINGS } from '../data/job-postings.js';

const router = Router();

const matchCache = new Map();
const MATCH_TTL_MS = 30 * 60 * 1000;

// ── Skill normalization ──────────────────────────────────────────────
// Maps language/framework names from GitHub to the canonical form used
// in job postings. Case-insensitive, handles common aliases.

const SKILL_ALIASES = {
    'typescript': 'TypeScript',
    'javascript': 'JavaScript',
    'python': 'Python',
    'go': 'Go',
    'golang': 'Go',
    'rust': 'Rust',
    'ruby': 'Ruby',
    'java': 'Java',
    'kotlin': 'Kotlin',
    'swift': 'Swift',
    'c++': 'C++',
    'cpp': 'C++',
    'c#': 'C#',
    'csharp': 'C#',
    'php': 'PHP',
    'scala': 'Scala',
    'elixir': 'Elixir',
    'lua': 'Lua',
    'shell': 'Shell',
    'bash': 'Shell',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'CSS',
    'sass': 'CSS',
    'sql': 'SQL',
    'react': 'React',
    'react.js': 'React',
    'reactjs': 'React',
    'next.js': 'Next.js',
    'nextjs': 'Next.js',
    'vue': 'Vue.js',
    'vue.js': 'Vue.js',
    'vuejs': 'Vue.js',
    'nuxt': 'Nuxt.js',
    'nuxt.js': 'Nuxt.js',
    'angular': 'Angular',
    'svelte': 'Svelte',
    'node': 'Node.js',
    'node.js': 'Node.js',
    'nodejs': 'Node.js',
    'express': 'Node.js',
    'express.js': 'Node.js',
    'django': 'Python',
    'flask': 'Python',
    'fastapi': 'Python',
    'rails': 'Rails',
    'ruby on rails': 'Rails',
    'spring': 'Java',
    'spring boot': 'Java',
    'pytorch': 'PyTorch',
    'tensorflow': 'Machine Learning',
    'machine learning': 'Machine Learning',
    'ml': 'Machine Learning',
    'deep learning': 'Machine Learning',
    'graphql': 'GraphQL',
    'rest': 'REST API',
    'rest api': 'REST API',
    'restful': 'REST API',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'k8s': 'Kubernetes',
    'aws': 'AWS',
    'amazon web services': 'AWS',
    'gcp': 'Cloud',
    'google cloud': 'Cloud',
    'azure': 'Cloud',
    'terraform': 'Terraform',
    'ci/cd': 'CI/CD',
    'github actions': 'CI/CD',
    'jenkins': 'CI/CD',
    'postgresql': 'PostgreSQL',
    'postgres': 'PostgreSQL',
    'mysql': 'SQL',
    'sqlite': 'SQL',
    'mongodb': 'MongoDB',
    'redis': 'Redis',
    'kafka': 'Kafka',
    'react native': 'React Native',
    'objective-c': 'Objective-C',
    'swiftui': 'SwiftUI',
    'jetpack compose': 'Jetpack Compose',
    'android': 'Android SDK',
    'linux': 'Linux',
    'c': 'C',
    'wasm': 'C++/WASM',
    'webassembly': 'C++/WASM'
};

function normalizeSkill(raw) {
    const lower = raw.toLowerCase().trim();
    return SKILL_ALIASES[lower] || raw;
}

/**
 * Extract the set of skills a user demonstrably has from their GitHub data.
 * Sources: language breakdown + repo names/topics/descriptions.
 */
function extractUserSkills(languages, repos) {
    const skills = new Set();

    // From language breakdown (only include if >= 1% of total code)
    for (const lang of languages) {
        if (lang.percent >= 1) {
            skills.add(normalizeSkill(lang.language));
        }
    }

    // From repo topics and descriptions — look for framework/tool signals
    const textBlob = repos
        .map(r => [r.name, r.description, ...(r.topics || [])].filter(Boolean).join(' '))
        .join(' ')
        .toLowerCase();

    const FRAMEWORK_SIGNALS = [
        'react', 'next.js', 'nextjs', 'vue', 'nuxt', 'angular', 'svelte',
        'node', 'express', 'django', 'flask', 'fastapi', 'rails',
        'spring', 'graphql', 'rest api', 'docker', 'kubernetes', 'k8s',
        'aws', 'terraform', 'ci/cd', 'github actions',
        'postgresql', 'postgres', 'mongodb', 'redis', 'kafka',
        'react native', 'pytorch', 'tensorflow', 'machine learning',
        'android', 'ios', 'swift', 'swiftui', 'jetpack compose',
        // Systems / infrastructure signals (repo topics/descriptions)
        'linux', 'unix', 'kernel', 'embedded', 'distributed systems',
        'systems programming', 'networking', 'cryptography', 'security',
        'wasm', 'webassembly', 'open source', 'observability'
    ];

    for (const signal of FRAMEWORK_SIGNALS) {
        if (textBlob.includes(signal)) {
            skills.add(normalizeSkill(signal));
        }
    }

    // Infer some meta-skills from repo patterns
    if (repos.length >= 10) skills.add('Open Source');
    if (repos.some(r => (r.topics || []).some(t => /system.design|architecture|distributed/i.test(t)))) {
        skills.add('System Design');
    }
    if (repos.some(r => (r.topics || []).some(t => /security|crypto|auth/i.test(t)))) {
        skills.add('Security');
    }

    return skills;
}

/**
 * Score a single job posting against the user's skill set.
 * Returns 0–100 match score + breakdown.
 */
function scorePosting(posting, userSkills) {
    const required = posting.required_skills || [];
    const nice = posting.nice_to_have || [];

    const requiredMatched = required.filter(s => userSkills.has(normalizeSkill(s)));
    const niceMatched = nice.filter(s => userSkills.has(normalizeSkill(s)));

    // Weighted scoring: required skills worth 70%, nice-to-have 30%
    const reqScore = required.length > 0 ? (requiredMatched.length / required.length) : 0;
    const niceScore = nice.length > 0 ? (niceMatched.length / nice.length) : 0;
    const rawScore = reqScore * 70 + niceScore * 30;

    // Clamp to 0–100 and round
    const score = Math.round(Math.max(0, Math.min(100, rawScore)));

    return {
        ...posting,
        match: score,
        required_matched: requiredMatched,
        required_missing: required.filter(s => !userSkills.has(normalizeSkill(s))),
        nice_matched: niceMatched,
        nice_missing: nice.filter(s => !userSkills.has(normalizeSkill(s))),
        badge_letter: (posting.company || '?')[0].toUpperCase()
    };
}

/**
 * Build the Gemini brief prompt — Gemini's ONLY job is the intelligence
 * brief for the top match. It does NOT invent roles or scores.
 */
function buildBriefPrompt({ profile, topMatch, userSkills, languages }) {
    return `You are a senior technical recruiter writing a 2-sentence intelligence brief for a candidate's top job match. Be specific and cite real data.

## CANDIDATE
login: ${profile.login}
name: ${profile.name || 'n/a'}
bio: ${profile.bio || 'n/a'}
Top languages: ${languages.slice(0, 5).map(l => `${l.language} (${l.percent}%)`).join(', ')}
Demonstrated skills: ${[...userSkills].join(', ')}

## TOP MATCH
Role: ${topMatch.title} at ${topMatch.company}
Match: ${topMatch.match}%
Required matched: ${topMatch.required_matched.join(', ') || 'none'}
Required missing: ${topMatch.required_missing.join(', ') || 'none'}
Nice-to-have matched: ${topMatch.nice_matched.join(', ') || 'none'}

## REQUIRED OUTPUT (JSON)
Return ONE JSON object:
{
  "intelligence_brief": "2 sentences. First sentence: why this candidate is a fit, citing 1-2 specific repos or languages as evidence. Second sentence: the one biggest gap and how to close it.",
  "affinity_grade": "A+, A, A-, B+, B, B-, C+, C — based on the match data above",
  "gaps": [
    { "skill": "<missing skill>", "status": "Gap" | "Growing", "acquisition": "<concrete action, 5-10 words>" }
  ]
}
Include up to 3 gaps. Mark a skill as "Growing" if the candidate has a related skill. Return ONLY the JSON.`;
}

const briefSchema = {
    type: 'object',
    properties: {
        intelligence_brief: { type: 'string' },
        affinity_grade: { type: 'string' },
        gaps: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    skill: { type: 'string' },
                    status: { type: 'string' },
                    acquisition: { type: 'string' }
                },
                required: ['skill', 'status', 'acquisition']
            }
        }
    },
    required: ['intelligence_brief', 'affinity_grade', 'gaps']
};

router.get('/matches/:username', async (req, res, next) => {
    try {
        const username = req.params.username;

        const cached = matchCache.get(username);
        if (cached && cached.expiresAt > Date.now()) {
            return res.json(cached.data);
        }

        const [profile, repos, languages] = await Promise.all([
            getUser(username),
            listRepos(username),
            aggregateLanguages(username)
        ]);

        const userSkills = extractUserSkills(languages, repos);

        // ── Real-time jobs (if RAPIDAPI_KEY is set) ────────────────
        // STRICT: If API is configured but crashes, propagate the error.
        // If API returns 0 jobs, pass empty array — NEVER fake jobs.
        let dataSource = 'static_corpus';
        let corpusSize = JOB_POSTINGS.length;
        let allPostings = [...JOB_POSTINGS];

        const topSkillsList = [...userSkills].slice(0, 6);
        const liveJobs = await searchJobs(topSkillsList); // throws on API failure (500)

        if (liveJobs !== null) {
            // RAPIDAPI_KEY is set — JSearch was queried
            if (liveJobs.length > 0) {
                allPostings = [...liveJobs, ...JOB_POSTINGS];
                dataSource = 'live_jsearch';
                corpusSize = allPostings.length;
                console.log(`📊 Scoring ${liveJobs.length} live + ${JOB_POSTINGS.length} static postings`);
            } else {
                // JSearch returned 0 jobs — use static corpus only, no fake padding
                dataSource = 'static_corpus';
                console.log(`📊 JSearch returned 0 jobs, using ${JOB_POSTINGS.length} static postings`);
            }
        }

        // Score every posting — keep all regardless of score so the page always
        // shows jobs. Zero-score results appear last, signalling skill gaps.
        const scored = allPostings
            .map(p => scorePosting(p, userSkills))
            .sort((a, b) => b.match - a.match);

        // Top matches for the queue (show up to 8)
        const topMatches = scored.slice(0, 8).map(m => ({
            id: m.id,
            title: m.title,
            company: m.company,
            location: m.location,
            match: m.match,
            salary: m.salary_range,
            badge_letter: m.badge_letter,
            category: m.category,
            level: m.level,
            apply_link: m.apply_link || null,
            employer_logo: m.employer_logo || null,
            source: m.source || 'static'
        }));

        // Featured: the top match, enriched with Gemini brief
        const topMatch = scored[0];
        let featured = null;

        if (topMatch) {
            let brief;
            try {
                brief = await gemini(
                    buildBriefPrompt({ profile, topMatch, userSkills, languages }),
                    { model: 'gemini-2.5-flash', json: true, schema: briefSchema, temperature: 0.3 }
                );
            } catch {
                // If Gemini fails, fall back to a static brief
                brief = {
                    intelligence_brief: `Strong match for ${topMatch.title} at ${topMatch.company} based on demonstrated ${topMatch.required_matched.join(', ')} skills. ${topMatch.required_missing.length ? `Bridge the gap in ${topMatch.required_missing[0]} to strengthen this application.` : 'Your skill coverage is comprehensive.'}`,
                    affinity_grade: topMatch.match >= 85 ? 'A' : topMatch.match >= 70 ? 'B+' : topMatch.match >= 55 ? 'B' : 'C+',
                    gaps: topMatch.required_missing.slice(0, 3).map(s => ({
                        skill: s,
                        status: 'Gap',
                        acquisition: `Build a project using ${s}`
                    }))
                };
            }

            featured = {
                title: topMatch.title,
                company: topMatch.company,
                location: topMatch.location,
                salary: topMatch.salary_range,
                match: topMatch.match,
                affinity_grade: brief.affinity_grade,
                intelligence_brief: brief.intelligence_brief,
                required_skills: (topMatch.required_skills || []).map(s => ({
                    name: s,
                    owned: userSkills.has(normalizeSkill(s))
                })),
                gaps: brief.gaps || [],
                category: topMatch.category,
                level: topMatch.level,
                apply_link: topMatch.apply_link || null,
                employer_logo: topMatch.employer_logo || null,
                source: topMatch.source || 'static'
            };
        }

        const payload = {
            profile: {
                login: profile.login,
                name: profile.name,
                avatar_url: profile.avatar_url,
                bio: profile.bio
            },
            user_skills: [...userSkills],
            matches: topMatches,
            featured,
            corpus_size: corpusSize,
            data_source: dataSource
        };

        matchCache.set(username, { data: payload, expiresAt: Date.now() + MATCH_TTL_MS });
        res.json(payload);
    } catch (err) {
        if (err.status === 404) {
            return res.status(404).json({ error: 'user_not_found', message: `No GitHub user named "${req.params.username}"` });
        }
        next(err);
    }
});

export default router;
