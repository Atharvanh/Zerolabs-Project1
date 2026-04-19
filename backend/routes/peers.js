// routes/peers.js
// Phase 4: Peer comparison & percentile ranking.
// Stores profile scores in a local JSON file and calculates
// where a developer sits relative to others analyzed on this instance.

import { Router } from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const PEERS_FILE = join(DATA_DIR, 'peers.json');

const router = Router();

// ── In-memory cache of peer data ──────────────────────────────────────
let peersCache = null;

async function loadPeers() {
    if (peersCache) return peersCache;
    try {
        const raw = await readFile(PEERS_FILE, 'utf-8');
        peersCache = JSON.parse(raw);
    } catch {
        peersCache = { profiles: {} };
    }
    return peersCache;
}

async function savePeers() {
    if (!peersCache) return;
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(PEERS_FILE, JSON.stringify(peersCache, null, 2), 'utf-8');
}

/**
 * Record a profile's scores for percentile calculation.
 * Called internally after an analysis completes.
 */
export async function recordProfile(username, analysisData) {
    if (!username || !analysisData) return;

    const peers = await loadPeers();
    const dashboard = analysisData.analysis?.dashboard;
    if (!dashboard) return;

    const velocity = dashboard.velocity?.score ?? null;
    const languages = analysisData.analysis?.skill_graph?.languages || [];
    const topLang = languages[0]?.language || 'Unknown';
    const repoCount = analysisData.analysis?.projects?.repos?.length || 0;
    const totalStars = (analysisData.analysis?.projects?.repos || [])
        .reduce((sum, r) => sum + (r.stars || 0), 0);

    // Derive a composite score (0-100) from available signals
    const langCount = languages.length;
    const langScore = Math.min(100, langCount * 10); // 10 langs = 100
    const repoScore = Math.min(100, repoCount * 5);  // 20 repos = 100
    const starScore = Math.min(100, totalStars * 2);  // 50 stars = 100
    const compositeScore = Math.round(
        (velocity || 0) * 0.4 +
        langScore * 0.2 +
        repoScore * 0.2 +
        starScore * 0.2
    );

    peers.profiles[username.toLowerCase()] = {
        username,
        velocity,
        composite_score: compositeScore,
        top_language: topLang,
        repo_count: repoCount,
        total_stars: totalStars,
        lang_count: langCount,
        updated_at: new Date().toISOString()
    };

    await savePeers();
}

/**
 * Calculate percentile for a given score within a set of scores.
 * Returns 0-100 (percentage of peers you're better than).
 */
function percentile(score, allScores) {
    if (allScores.length <= 1) return 50; // Not enough data
    const below = allScores.filter(s => s < score).length;
    return Math.round((below / (allScores.length - 1)) * 100);
}

// ── GET /api/peers/percentile/:username ───────────────────────────────
router.get('/percentile/:username', async (req, res, next) => {
    try {
        const username = req.params.username.toLowerCase();
        const peers = await loadPeers();
        const profile = peers.profiles[username];

        if (!profile) {
            return res.status(404).json({
                error: 'not_found',
                message: 'Profile not yet analyzed. Run an analysis first.'
            });
        }

        const allProfiles = Object.values(peers.profiles);
        const totalPeers = allProfiles.length;

        // Velocity percentile
        const velocityScores = allProfiles
            .map(p => p.velocity)
            .filter(v => v != null);
        const velocityPercentile = percentile(profile.velocity || 0, velocityScores);

        // Composite percentile
        const compositeScores = allProfiles.map(p => p.composite_score);
        const compositePercentile = percentile(profile.composite_score, compositeScores);

        // Repo count percentile
        const repoScores = allProfiles.map(p => p.repo_count);
        const repoPercentile = percentile(profile.repo_count, repoScores);

        // Stars percentile
        const starScores = allProfiles.map(p => p.total_stars);
        const starsPercentile = percentile(profile.total_stars, starScores);

        // Language diversity percentile
        const langScores = allProfiles.map(p => p.lang_count);
        const langPercentile = percentile(profile.lang_count, langScores);

        // Peer group: developers with same top language
        const sameLangPeers = allProfiles.filter(
            p => p.top_language === profile.top_language
        );
        const sameLangComposites = sameLangPeers.map(p => p.composite_score);
        const peerGroupPercentile = percentile(profile.composite_score, sameLangComposites);

        res.json({
            username: profile.username,
            total_peers: totalPeers,
            peer_group: {
                language: profile.top_language,
                count: sameLangPeers.length,
                percentile: peerGroupPercentile
            },
            percentiles: {
                overall: compositePercentile,
                velocity: velocityPercentile,
                repos: repoPercentile,
                stars: starsPercentile,
                languages: langPercentile
            },
            scores: {
                composite: profile.composite_score,
                velocity: profile.velocity,
                repo_count: profile.repo_count,
                total_stars: profile.total_stars,
                lang_count: profile.lang_count
            },
            updated_at: profile.updated_at
        });
    } catch (err) {
        next(err);
    }
});

// ── GET /api/peers/leaderboard ────────────────────────────────────────
router.get('/leaderboard', async (_req, res, next) => {
    try {
        const peers = await loadPeers();
        const allProfiles = Object.values(peers.profiles)
            .sort((a, b) => b.composite_score - a.composite_score)
            .slice(0, 20)
            .map((p, i) => ({
                rank: i + 1,
                username: p.username,
                composite_score: p.composite_score,
                velocity: p.velocity,
                top_language: p.top_language,
                repo_count: p.repo_count,
                total_stars: p.total_stars
            }));

        res.json({
            total_profiles: Object.keys(peers.profiles).length,
            leaderboard: allProfiles
        });
    } catch (err) {
        next(err);
    }
});

export default router;
