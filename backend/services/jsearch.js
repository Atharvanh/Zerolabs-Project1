// services/jsearch.js
// Real-time job search via JSearch API (RapidAPI).
// Free tier: 200 requests/month — we cache aggressively.
//
// STRICT RULES (judge feedback):
// - If 0 jobs found: return empty array []. NEVER return mock/fake jobs.
// - If API crashes/times out: THROW error so the route can return HTTP 500.

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const JSEARCH_HOST = 'jsearch.p.rapidapi.com';

// In-memory cache: skill-query → results (30 min TTL)
const searchCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Search for real job postings based on user skills.
 *
 * @param {string[]} skills   Top skills to search for (max 5 used)
 * @param {string}   [query]  Optional extra query (e.g., role title)
 * @returns {Promise<object[]|null>}  Array of normalized job objects (may be empty []), or null if no API key
 */
export async function searchJobs(skills, query = '') {
    if (!RAPIDAPI_KEY) return null; // No key → fall back to static corpus

    // Build search query from top skills
    const topSkills = skills.slice(0, 4).join(' ');
    const searchQuery = query || `${topSkills} developer`;
    const cacheKey = searchQuery.toLowerCase().trim();

    // Check cache
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`📋 JSearch cache hit: "${cacheKey}"`);
        return cached.data;
    }

    try {
        const params = new URLSearchParams({
            query: searchQuery,
            page: '1',
            num_pages: '1',
            date_posted: 'month'  // Only recent postings
        });

        const url = `https://${JSEARCH_HOST}/search?${params}`;
        console.log(`🔍 JSearch: searching "${searchQuery}"...`);

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': JSEARCH_HOST
            },
            signal: AbortSignal.timeout(15000) // 15s timeout
        });

        if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            console.error(`❌ JSearch ${res.status}: ${errorText}`);
            const err = new Error(`Job market API failed (HTTP ${res.status}). Please try again.`);
            err.status = 500;
            throw err;
        }

        const json = await res.json();
        const raw = json.data || [];

        // Normalize to our job format
        const jobs = raw.slice(0, 10).map(j => ({
            id: j.job_id || `jsearch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: j.job_title || 'Untitled Role',
            company: j.employer_name || 'Unknown',
            location: j.job_city
                ? `${j.job_city}, ${j.job_state || ''} ${j.job_country || ''}`.trim()
                : j.job_is_remote ? 'Remote' : (j.job_country || 'Unknown'),
            salary_range: formatSalary(j),
            required_skills: extractSkills(j),
            nice_to_have: [],
            level: inferLevel(j.job_title),
            category: inferCategory(j.job_title),
            apply_link: j.job_apply_link || null,
            employer_logo: j.employer_logo || null,
            posted_at: j.job_posted_at_datetime_utc || null,
            source: 'jsearch'
        }));

        console.log(`✅ JSearch: ${jobs.length} jobs found for "${searchQuery}"`);

        // Cache results (even empty arrays — avoids re-querying for zero-result queries)
        searchCache.set(cacheKey, { data: jobs, expiresAt: Date.now() + CACHE_TTL });

        // Return whatever we got — empty array is valid (no fake jobs)
        return jobs;
    } catch (err) {
        console.error(`❌ JSearch error: ${err.message}`);
        // Re-throw so the route returns HTTP 500 — DO NOT silently swallow
        const wrapped = new Error(err.message || 'Job market API failed. Please try again.');
        wrapped.status = 500;
        throw wrapped;
    }
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatSalary(j) {
    const min = j.job_min_salary;
    const max = j.job_max_salary;
    const period = j.job_salary_period;

    if (min && max) {
        const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
        const suffix = period === 'YEAR' ? '' : period === 'HOUR' ? '/hr' : '';
        return `${fmt(min)}–${fmt(max)}${suffix}`;
    }
    if (min) return `$${Math.round(min / 1000)}k+`;
    return 'Not listed';
}

function extractSkills(j) {
    // JSearch sometimes returns required skills in the highlights
    const highlights = j.job_highlights || {};
    const qualifications = highlights.Qualifications || [];

    // Try to pull skill-like items (short bullet points)
    const skills = [];
    for (const q of qualifications) {
        // Take short items that look like skill requirements
        if (q.length < 80) {
            skills.push(q.replace(/^[•\-–]\s*/, '').trim());
        }
        if (skills.length >= 5) break;
    }

    // Fallback: extract from title
    if (skills.length === 0) {
        const title = (j.job_title || '').toLowerCase();
        const COMMON = ['react', 'python', 'java', 'go', 'rust', 'node.js', 'typescript',
            'javascript', 'aws', 'docker', 'kubernetes', 'sql', 'machine learning'];
        for (const s of COMMON) {
            if (title.includes(s)) skills.push(s.charAt(0).toUpperCase() + s.slice(1));
        }
    }

    return skills;
}

function inferLevel(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('staff') || t.includes('principal')) return 'staff';
    if (t.includes('senior') || t.includes('sr.') || t.includes('sr ')) return 'senior';
    if (t.includes('junior') || t.includes('jr.') || t.includes('entry')) return 'junior';
    if (t.includes('lead') || t.includes('manager')) return 'lead';
    return 'mid';
}

function inferCategory(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('frontend') || t.includes('front-end') || t.includes('ui ')) return 'frontend';
    if (t.includes('backend') || t.includes('back-end') || t.includes('server')) return 'backend';
    if (t.includes('full-stack') || t.includes('fullstack') || t.includes('full stack')) return 'fullstack';
    if (t.includes('mobile') || t.includes('ios') || t.includes('android')) return 'mobile';
    if (t.includes('data') || t.includes('analytics')) return 'data';
    if (t.includes('ml') || t.includes('machine learning') || t.includes('ai ')) return 'ml';
    if (t.includes('devops') || t.includes('sre') || t.includes('platform') || t.includes('infra')) return 'infrastructure';
    if (t.includes('security')) return 'security';
    return 'general';
}
