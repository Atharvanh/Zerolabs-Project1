// routes/github.js
// Endpoints the frontend uses to get raw GitHub data.
// Keep these thin — they just call the service layer and return JSON.

import { Router } from 'express';
import {
    getUser,
    listRepos,
    aggregateLanguages,
    getRepoContents
} from '../services/github.js';

const router = Router();

/**
 * GET /api/github/profile/:username
 * Returns: profile + repo list + aggregated languages.
 * This is the "bootstrap" call the dashboard makes right after you paste a URL.
 */
router.get('/profile/:username', async (req, res, next) => {
    try {
        const username = req.params.username;

        // Fire these in parallel — they don't depend on each other
        const [profile, repos, languages] = await Promise.all([
            getUser(username),
            listRepos(username),
            aggregateLanguages(username)
        ]);

        res.json({
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
            repos: repos.map(r => ({
                name: r.name,
                full_name: r.full_name,
                description: r.description,
                language: r.language,
                stars: r.stargazers_count,
                forks: r.forks_count,
                size: r.size,
                updated_at: r.updated_at,
                created_at: r.created_at,
                html_url: r.html_url,
                topics: r.topics || []
            })),
            languages
        });
    } catch (err) {
        if (err.status === 404) {
            return res.status(404).json({ error: 'user_not_found', message: `No GitHub user named "${req.params.username}"` });
        }
        next(err);
    }
});

/**
 * GET /api/github/repo/:owner/:repo/tree
 * Returns the top-level file listing of a repo.
 * Useful for showing the user "we looked at these files".
 */
router.get('/repo/:owner/:repo/tree', async (req, res, next) => {
    try {
        const { owner, repo } = req.params;
        const contents = await getRepoContents(owner, repo);
        res.json(contents.map(c => ({
            name: c.name,
            path: c.path,
            type: c.type,
            size: c.size
        })));
    } catch (err) {
        next(err);
    }
});

export default router;
