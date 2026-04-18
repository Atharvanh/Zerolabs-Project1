// routes/analyze.js
// Analysis endpoints that combine GitHub data + Gemini.
// Currently just a stub — we'll build this out in the next step
// (Feature 2: real code review on the top 3 repos).

import { Router } from 'express';

const router = Router();

router.get('/ping', (_req, res) => {
    res.json({ ok: true, message: 'analyze routes wired up' });
});

// TODO next: POST /api/analyze/repo/:owner/:repo  → full code review
// TODO after: GET  /api/analyze/skills/:username  → skill inference
// TODO after: GET  /api/analyze/roadmap/:username → 90-day plan

export default router;
