// routes/analyze.js
// Produces the AI-powered analysis powering every dashboard page.
// One Gemini call per user (cached for 15 min) fills: dashboard, skill graph,
// projects, roadmap, and career matches.

import { Router } from 'express';
import {
    getUser,
    listRepos,
    aggregateLanguages
} from '../services/github.js';
import { gemini } from '../services/gemini.js';
import { recordProfile } from './peers.js';

const router = Router();

router.get('/ping', (_req, res) => {
    res.json({ ok: true, message: 'analyze routes wired up' });
});

const analysisCache = new Map();
const ANALYSIS_TTL_MS = 30 * 60 * 1000; // 30 min — reduce API calls

const proficiencyItem = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        level: { type: 'string' },
        percent: { type: 'integer' }
    },
    required: ['name', 'level', 'percent']
};

const analysisSchema = {
    type: 'object',
    properties: {
        dashboard: {
            type: 'object',
            properties: {
                velocity: {
                    type: 'object',
                    properties: {
                        score: { type: 'integer' },
                        yoy: { type: 'integer' },
                        bars: { type: 'array', items: { type: 'integer' } }
                    },
                    required: ['score', 'yoy', 'bars']
                },
                insights: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            type: { type: 'string' },
                            title: { type: 'string' },
                            text: { type: 'string' }
                        },
                        required: ['type', 'title', 'text']
                    }
                },
                skills: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            icon: { type: 'string' },
                            percent: { type: 'integer' }
                        },
                        required: ['name', 'icon', 'percent']
                    }
                },
                roles: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            icon: { type: 'string' },
                            match: { type: 'integer' },
                            note: { type: 'string' }
                        },
                        required: ['title', 'icon', 'match', 'note']
                    }
                },
                resume_tip: { type: 'string' }
            },
            required: ['velocity', 'insights', 'skills', 'roles', 'resume_tip']
        },
        skill_graph: {
            type: 'object',
            properties: {
                languages: { type: 'array', items: proficiencyItem },
                frameworks: { type: 'array', items: proficiencyItem },
                tools: { type: 'array', items: proficiencyItem },
                soft_skills: { type: 'array', items: proficiencyItem },
                velocity_index: {
                    type: 'object',
                    properties: {
                        score: { type: 'number' },
                        yoy: { type: 'integer' },
                        peak_skill: { type: 'string' },
                        history: { type: 'array', items: { type: 'integer' } }
                    },
                    required: ['score', 'yoy', 'peak_skill', 'history']
                },
                radar: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            axis: { type: 'string' },
                            value: { type: 'integer' }
                        },
                        required: ['axis', 'value']
                    }
                }
            },
            required: ['languages', 'frameworks', 'tools', 'soft_skills', 'velocity_index', 'radar']
        },
        projects: {
            type: 'object',
            properties: {
                featured: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        language: { type: 'string' },
                        quality_score: { type: 'integer' },
                        quality_justification: { type: 'string' },
                        html_url: { type: 'string' },
                        badges: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['name', 'description', 'language', 'quality_score', 'quality_justification', 'badges']
                },
                list: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            language: { type: 'string' },
                            icon: { type: 'string' },
                            quality_score: { type: 'integer' },
                            quality_justification: { type: 'string' },
                            html_url: { type: 'string' },
                            resume_priority: { type: 'integer' },
                            resume_why: { type: 'string' },
                            badges: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        label: { type: 'string' },
                                        tone: { type: 'string' }
                                    },
                                    required: ['label', 'tone']
                                }
                            }
                        },
                        required: ['name', 'language', 'icon', 'quality_score', 'quality_justification', 'badges', 'resume_priority', 'resume_why']
                    }
                }
            },
            required: ['featured', 'list']
        },
        roadmap: {
            type: 'object',
            properties: {
                target_role: { type: 'string' },
                overall_progress: { type: 'integer' },
                est_completion: { type: 'string' },
                subtitle: { type: 'string' },
                months: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            month: { type: 'integer' },
                            title: { type: 'string' },
                            focus: { type: 'string' },
                            status: { type: 'string' },
                            tasks: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        hours: { type: 'integer' },
                                        description: { type: 'string' },
                                        done: { type: 'boolean' }
                                    },
                                    required: ['title', 'hours', 'description', 'done']
                                }
                            }
                        },
                        required: ['month', 'title', 'focus', 'status', 'tasks']
                    }
                }
            },
            required: ['target_role', 'overall_progress', 'est_completion', 'subtitle', 'months']
        },
        career_matches: {
            type: 'object',
            properties: {
                matches: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            company: { type: 'string' },
                            location: { type: 'string' },
                            match: { type: 'integer' },
                            salary: { type: 'string' },
                            badge_letter: { type: 'string' }
                        },
                        required: ['title', 'company', 'location', 'match', 'salary', 'badge_letter']
                    }
                },
                featured: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        company: { type: 'string' },
                        location: { type: 'string' },
                        salary: { type: 'string' },
                        match: { type: 'integer' },
                        affinity_grade: { type: 'string' },
                        intelligence_brief: { type: 'string' },
                        required_skills: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    owned: { type: 'boolean' }
                                },
                                required: ['name', 'owned']
                            }
                        },
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
                    required: ['title', 'company', 'location', 'salary', 'match', 'affinity_grade', 'intelligence_brief', 'required_skills', 'gaps']
                }
            },
            required: ['matches', 'featured']
        }
    },
    required: ['dashboard', 'skill_graph', 'projects', 'roadmap', 'career_matches']
};

function buildPrompt({ profile, repos, languages }) {
    // NOTE: We deliberately EXCLUDE updated_at / created_at so the LLM
    // cannot bias scores on recency. Scoring must be purely quality-based.
    const topRepos = repos.slice(0, 8).map(r => ({
        name: r.name,
        description: (r.description || '').slice(0, 100),
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        size_kb: r.size,
        topics: (r.topics || []).slice(0, 5),
        html_url: r.html_url
    }));

    const topLanguages = languages.slice(0, 10);

    // Pre-compute how many repos use each language so the LLM
    // can enforce volume-based ranking (judges flagged this).
    const langCounts = {};
    for (const r of repos) {
        const lang = r.language;
        if (lang) langCounts[lang] = (langCounts[lang] || 0) + 1;
    }
    // Sort descending by repo count
    const languageRepoCounts = Object.entries(langCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([lang, count]) => ({ language: lang, repo_count: count }));

    // ── Pre-compute REAL activity metrics for velocity/yoy ─────────
    // Uses pushed_at (last push timestamp) from all repos, not just top 8.
    const now = Date.now();
    const ONE_YEAR = 365.25 * 24 * 60 * 60 * 1000;
    const cutoff12mo = now - ONE_YEAR;
    const cutoff24mo = now - (2 * ONE_YEAR);

    let reposActiveLastYear = 0;   // pushed in last 12 months
    let reposActivePrevYear = 0;   // pushed 12-24 months ago
    let totalCodeBytes = 0;

    for (const r of repos) {
        const pushed = r.pushed_at ? new Date(r.pushed_at).getTime() : 0;
        if (pushed >= cutoff12mo) reposActiveLastYear++;
        else if (pushed >= cutoff24mo) reposActivePrevYear++;
        totalCodeBytes += (r.size || 0) * 1024; // size is in KB
    }

    // Real YoY percentage change
    let computedYoy = 0;
    if (reposActivePrevYear > 0) {
        computedYoy = Math.round(((reposActiveLastYear - reposActivePrevYear) / reposActivePrevYear) * 100);
    } else if (reposActiveLastYear > 0) {
        computedYoy = 100; // went from 0 to something
    }
    // else both are 0 → yoy stays 0

    const accountAgeDays = Math.max(1, Math.round((now - new Date(profile.created_at).getTime()) / (24 * 60 * 60 * 1000)));
    const accountAgeYears = (accountAgeDays / 365.25).toFixed(1);

    const activityStats = {
        total_repos: repos.length,
        total_code_bytes: totalCodeBytes,
        distinct_languages: Object.keys(langCounts).length,
        repos_active_last_12mo: reposActiveLastYear,
        repos_active_prev_12mo: reposActivePrevYear,
        computed_yoy_percent: computedYoy,
        account_age_years: parseFloat(accountAgeYears)
    };

    return `You are a senior engineering recruiter + staff engineer producing a full career intelligence report for a developer dashboard. The report fuels 5 screens: dashboard, skill graph, projects, 90-day roadmap, and career matches.

## GITHUB PROFILE
login: ${profile.login}
name: ${profile.name || 'n/a'}
bio: ${profile.bio || 'n/a'}
public_repos: ${profile.public_repos}
followers: ${profile.followers}
account_created: ${profile.created_at}

## TOP REPOS (JSON)
${JSON.stringify(topRepos, null, 2)}

## LANGUAGE BREAKDOWN (JSON, bytes + %)
${JSON.stringify(topLanguages, null, 2)}

## LANGUAGE REPO COUNTS (how many repos use each language)
${JSON.stringify(languageRepoCounts, null, 2)}

## ACTIVITY METRICS (pre-computed from real pushed_at timestamps)
${JSON.stringify(activityStats, null, 2)}

## CRITICAL SKILL RANKING ALGORITHM
When ranking ANY skill, language, or framework, you MUST use this weighted formula:
  Skill Density = (Volume × 0.70) + (Complexity × 0.30)
Where:
  - Volume (70% weight) = how many repositories use this language/framework. A language appearing in 5 repos MUST rank higher than one in 1 repo.
  - Complexity (30% weight) = how advanced/sophisticated the code is within those repos (architecture, patterns, depth).

HARD RULE: A language used in only 1 repository is FORBIDDEN from ranking above a language used in 3+ repositories, UNLESS every multi-repo language has near-zero bytes (<1% of total code). This is non-negotiable.

Use the LANGUAGE REPO COUNTS table above as the ground truth for Volume.

## REQUIRED OUTPUT (JSON only, no prose)
Return ONE JSON object with these top-level keys: dashboard, skill_graph, projects, roadmap, career_matches.

### dashboard
- velocity: { score (0-100), yoy (int percent, may be negative), bars: 7 integers 0-100 (oldest to newest) }.
  GROUNDING RULES for velocity:
  - score: base it on ACTIVITY METRICS above. Formula: min(100, (total_repos * 3) + (total_code_bytes / 50000) + (distinct_languages * 5) + (repos_active_last_12mo * 8)). Round to nearest int. A user with 3 repos and 10k bytes should score 15-35. DO NOT inflate.
  - yoy: YOU MUST USE the pre-computed value from ACTIVITY METRICS → computed_yoy_percent. This is calculated from real pushed_at dates (repos active in last 12 months vs previous 12 months). DO NOT invent your own yoy number.
  - bars: 7 values representing growth over time. If repos_active_last_12mo <= 2, bars should be mostly low (10-30) with a slight ramp. If repos_active_last_12mo >= 5, bars can ramp to 60-80. The last bar should roughly match the velocity score.
- insights: exactly 3 items { type: "positive"|"warning"|"info", title (2-4 words), text (one sentence grounded in data) }.
  RULE: Every insight MUST cite at least one specific repo name or a specific number from the data (e.g., "7 repos use JavaScript" or "no test files found across repos"). Generic statements like "shows promise" or "has potential" are FORBIDDEN.
- skills: 4 items { name (e.g. "Frontend", "Backend", "Data & ML", "DevOps", "Systems", "Mobile"), icon (Material Symbols name like "desktop_windows","dns","cloud","account_tree","memory","smartphone"), percent (0-100) }. IMPORTANT: The percent for each skill category MUST reflect the Skill Density algorithm above. A category backed by 5 repos scores higher than one backed by 1 repo, regardless of the single repo's complexity. Categories with 0 matching repos MUST get percent <= 10.
- roles: 2 items { title, icon (material symbol), match (0-100), note (<=10 words) }.
  GROUNDING RULE: Role titles MUST derive from the user's top 2 skill categories by Skill Density. If the user's densest skill is JavaScript/React across 6 repos, the first role must be frontend-related. Do NOT suggest "ML Engineer" if the user has zero ML repos.
- resume_tip: one sentence that references a specific repo name

### skill_graph
Apply the Skill Density algorithm (Volume 70% + Complexity 30%) to rank everything below. Use LANGUAGE REPO COUNTS as the Volume source.

- languages: 3 items { name, level: "Expert"|"Advanced"|"Intermediate"|"Familiar", percent 0-100 }. Rank by Skill Density: the language appearing in the MOST repos comes first. Pull from the real language breakdown + repo counts. A language in 1 repo CANNOT be "Expert" unless it has massive byte share (>60%).
  LEVEL CALIBRATION: Expert = 5+ repos AND >40% bytes. Advanced = 3+ repos OR >25% bytes. Intermediate = 2 repos OR >10% bytes. Familiar = 1 repo or <10% bytes.
- frameworks: 3 items (infer frameworks/libraries from repo names, topics, descriptions). Rank by how many repos reference each framework, not by impressiveness of a single repo. If a framework appears in 0 repo topics/names/descriptions, do NOT include it — pick "None detected" with percent 0 instead of guessing.
- tools: 3 items (e.g., Docker, AWS, CI/CD — infer from topics/descriptions; if no evidence, mark percent <= 15 and level "Familiar")
- soft_skills: 3 items (System Design, Code Review, Mentorship, Open Source Leadership — infer from repo scale, stars, collaboration signals).
  ANTI-INFLATION RULES: "Mentorship" requires 50+ stars on at least 1 repo or visible contributor activity. "System Design" requires repos with 10+ files showing clear architecture. "Open Source Leadership" requires 5+ forks across repos. If none of these thresholds are met, set percent <= 25.
- velocity_index: { score (0-100, one decimal ok as number), yoy (int), peak_skill: set this to the language/framework with the HIGHEST repo count, history: 6 integers 0-100 (Jul..Dec oldest to newest) }
- radar: exactly 5 items { axis (e.g. "Languages","Frameworks","Infrastructure","Architecture","Open Source"), value 0-100 }.
  GROUNDING: "Languages" = number of distinct languages / 8 * 100 (capped at 100). "Frameworks" = count of detected frameworks * 25 (capped at 100). "Infrastructure" = evidence of Docker/AWS/CI in topics, 0 if none. "Architecture" = average repo size_kb / 500 * 100 (capped at 100). "Open Source" = total stars + forks across all repos, scaled logarithmically.

### projects
IMPORTANT: Score projects STRICTLY on Code Quality, Architectural Complexity, and Tech Stack. DO NOT factor in recency, timestamps, or how recently the project was updated. A 3-year-old project with clean architecture scores higher than a yesterday project with spaghetti code.

- featured: the highest-quality repo { name, description (<= 240 chars, rewrite if missing), language, quality_score 0-100 (based ONLY on: code quality, architectural complexity, tech stack sophistication, test coverage signals, documentation quality), quality_justification (one sentence explaining exactly why this score — cite specific code patterns, architecture decisions, or tech choices), html_url, badges: 2-3 short labels }
- list: up to 6 items { name, language, icon (material symbol fitting the language: "data_object" python, "javascript" js/ts, "memory" rust/c, "terminal" go/shell, "cloud" yaml, "neurology" ml), quality_score 0-100 (same criteria as featured — code quality, complexity, stack), quality_justification (one sentence citing specific evidence from repo structure/stack/patterns), html_url, badges: 2 items each with label + tone ("positive"|"warning"|"neutral"), resume_priority (1|2|3: 1 = lead-with on resume, 2 = strong supporting, 3 = background only; AT LEAST 1 item MUST be priority 1 and no more than 2 items may share priority 1), resume_why (one short sentence, <= 110 chars, explaining to a hiring manager why this project is worth putting first — cite a concrete signal like architectural complexity, design patterns, or demonstrated technique) }

### roadmap
- target_role: one concrete next role (e.g. "Senior Frontend Engineer", "ML Platform Engineer").
  GROUNDING: This MUST align with the user's #1 skill category by Skill Density. If their densest skill is JavaScript across 6 repos, target_role should be a JS/Frontend/Fullstack role. Do NOT suggest "ML Engineer" for a user with zero Python ML repos.
- overall_progress: 0-100 integer (how close they already are to target). Base this on: repo count in the target skill area, code complexity signals, and diversity of tools shown.
- est_completion: short date-like label (e.g. "Dec 15, 2026" or "Q2 2026")
- subtitle: one-sentence pitch explaining the roadmap goal
- months: exactly 3 items { month 1|2|3, title (e.g. "Foundation","Deep Dive","Mastery"), focus (one sentence), status ("in_progress"|"upcoming"|"locked"), tasks: 2 items { title, hours (int), description, done (bool) } }. First month should be in_progress with at least one task done=false.
  TASK GROUNDING: Tasks must reference specific gaps visible in the repos (e.g., "Add unit tests to <repo-name>" not "learn testing"). Every task title must be actionable and specific.

### career_matches
- matches: 3 items { title, company, location, match 0-100, salary (e.g. "$140k+"), badge_letter (single uppercase letter, first of company) }. Sort descending by match.
  GROUNDING: Role titles in matches MUST align with the user's top skills by Skill Density. If the user writes JavaScript in 6 repos, at least 2 of 3 matches should be JS/frontend/fullstack roles. Do NOT suggest ML roles for a JS-heavy profile.
- featured: the top match, expanded { title, company, location, salary, match, affinity_grade (e.g. "A-","B+"), intelligence_brief (2 sentences, mention 1-2 actual repo names or languages as evidence — you MUST name a specific repo from the TOP REPOS list), required_skills: 4 items { name, owned boolean }, gaps: 3 items { skill, status ("Owned"|"Gap"|"Growing"), acquisition (short action like "Build a REST API in <repo-name>", "Add Docker to <repo-name>") } }
  GAP ACQUISITION RULE: Every acquisition action must reference a specific repo name or a concrete deliverable, NOT vague advice like "study more" or "gain experience".

## ANTI-HALLUCINATION RULES
1. NEVER invent repo names that don't appear in the TOP REPOS list.
2. NEVER claim the user has skills not visible in LANGUAGE BREAKDOWN or LANGUAGE REPO COUNTS.
3. If the profile has fewer than 3 repos, set velocity score <= 30, overall_progress <= 25, and career match scores <= 50.
4. If a skill category has 0 repos, its percent MUST be 0-10, not higher.
5. Every number you output must be justifiable by the data above. If a judge asks "why 78%?", you must be able to point to a specific metric.

Be honest. Ground every number and every role match in the real data. If the profile is thin, scores should be modest. Return ONLY the JSON object.`;
}

router.get('/profile/:username', async (req, res, next) => {
    try {
        const username = req.params.username;

        const cached = analysisCache.get(username);
        if (cached && cached.expiresAt > Date.now()) {
            return res.json(cached.data);
        }

        const [profile, repos, languages] = await Promise.all([
            getUser(username),
            listRepos(username),
            aggregateLanguages(username)
        ]);

        const prompt = buildPrompt({ profile, repos, languages });

        const analysis = await gemini(prompt, {
            model: 'gemini-2.5-flash',
            json: true,
            schema: analysisSchema,
            temperature: 0.4
        });

        const payload = {
            profile: {
                login: profile.login,
                name: profile.name,
                bio: profile.bio,
                avatar_url: profile.avatar_url,
                public_repos: profile.public_repos,
                followers: profile.followers,
                following: profile.following,
                created_at: profile.created_at,
                html_url: profile.html_url
            },
            repos_summary: {
                total: repos.length,
                top: repos.slice(0, 6).map(r => ({
                    name: r.name,
                    description: r.description,
                    language: r.language,
                    stars: r.stargazers_count,
                    html_url: r.html_url
                }))
            },
            languages: languages.slice(0, 10),
            analysis
        };

        analysisCache.set(username, { data: payload, expiresAt: Date.now() + ANALYSIS_TTL_MS });

        // Phase 4: record scores for peer comparison (fire-and-forget)
        recordProfile(username, payload).catch(err =>
            console.warn('⚠ Failed to record peer data:', err.message)
        );

        res.json(payload);
    } catch (err) {
        if (err.status === 404) {
            return res.status(404).json({ error: 'user_not_found', message: `No GitHub user named "${req.params.username}"` });
        }
        next(err);
    }
});

export default router;
