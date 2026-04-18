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

const router = Router();

router.get('/ping', (_req, res) => {
    res.json({ ok: true, message: 'analyze routes wired up' });
});

const analysisCache = new Map();
const ANALYSIS_TTL_MS = 15 * 60 * 1000;

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
                        score: { type: 'integer' },
                        html_url: { type: 'string' },
                        badges: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['name', 'description', 'language', 'score', 'badges']
                },
                list: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            language: { type: 'string' },
                            icon: { type: 'string' },
                            score: { type: 'integer' },
                            html_url: { type: 'string' },
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
                        required: ['name', 'language', 'icon', 'score', 'badges']
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
    const topRepos = repos.slice(0, 15).map(r => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        size_kb: r.size,
        updated_at: r.updated_at,
        created_at: r.created_at,
        topics: r.topics || [],
        html_url: r.html_url
    }));

    const topLanguages = languages.slice(0, 10);

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

## REQUIRED OUTPUT (JSON only, no prose)
Return ONE JSON object with these top-level keys: dashboard, skill_graph, projects, roadmap, career_matches.

### dashboard
- velocity: { score (0-100), yoy (int percent, may be negative), bars: 7 integers 0-100 (oldest to newest) }
- insights: exactly 3 items { type: "positive"|"warning"|"info", title (2-4 words), text (one sentence grounded in data) }
- skills: 4 items { name (e.g. "Frontend", "Backend", "Data & ML", "DevOps", "Systems", "Mobile"), icon (Material Symbols name like "desktop_windows","dns","cloud","account_tree","memory","smartphone"), percent (0-100) }
- roles: 2 items { title, icon (material symbol), match (0-100), note (<=10 words) }
- resume_tip: one sentence

### skill_graph
- languages: 3 items { name, level: "Expert"|"Advanced"|"Intermediate"|"Familiar", percent 0-100 } — pull from the real language breakdown
- frameworks: 3 items (infer frameworks/libraries from repo names, topics, descriptions)
- tools: 3 items (e.g., Docker, AWS, CI/CD — infer from topics/descriptions; if no evidence, mark lower)
- soft_skills: 3 items (System Design, Code Review, Mentorship, Open Source Leadership — infer from repo scale, stars, collaboration signals)
- velocity_index: { score (0-100, one decimal ok as number), yoy (int), peak_skill (e.g. "React / Next.js"), history: 6 integers 0-100 (Jul..Dec oldest to newest) }
- radar: exactly 5 items { axis (e.g. "Languages","Frameworks","Infrastructure","Architecture","Open Source"), value 0-100 }

### projects
- featured: the strongest repo { name, description (<= 240 chars, rewrite if missing), language, score 0-100 based on stars/activity/quality signals, html_url, badges: 2-3 short labels }
- list: up to 6 items { name, language, icon (material symbol fitting the language: "data_object" python, "javascript" js/ts, "memory" rust/c, "terminal" go/shell, "cloud" yaml, "neurology" ml), score 0-100, html_url, badges: 2 items each with label + tone ("positive"|"warning"|"neutral") }

### roadmap
- target_role: one concrete next role (e.g. "Senior Frontend Engineer", "ML Platform Engineer")
- overall_progress: 0-100 integer (how close they already are to target)
- est_completion: short date-like label (e.g. "Dec 15, 2026" or "Q2 2026")
- subtitle: one-sentence pitch explaining the roadmap goal
- months: exactly 3 items { month 1|2|3, title (e.g. "Foundation","Deep Dive","Mastery"), focus (one sentence), status ("in_progress"|"upcoming"|"locked"), tasks: 2 items { title, hours (int), description, done (bool) } }. First month should be in_progress with at least one task done=false.

### career_matches
- matches: 3 items { title, company, location, match 0-100, salary (e.g. "$140k+"), badge_letter (single uppercase letter, first of company) }. Sort descending by match.
- featured: the top match, expanded { title, company, location, salary, match, affinity_grade (e.g. "A-","B+"), intelligence_brief (2 sentences, mention 1-2 actual repo names or languages as evidence), required_skills: 4 items { name, owned boolean }, gaps: 3 items { skill, status ("Owned"|"Gap"|"Growing"), acquisition (short action like "Project Alpha Integration", "2mo Projected Roadmap") } }

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
        res.json(payload);
    } catch (err) {
        if (err.status === 404) {
            return res.status(404).json({ error: 'user_not_found', message: `No GitHub user named "${req.params.username}"` });
        }
        next(err);
    }
});

export default router;
