// server.js
// ZeroLabs backend entry point.
//
// Exposes REST endpoints the frontend calls to get real GitHub data
// and real Gemini-powered analysis.
//
// Run with: npm start  (or: npm run dev  for auto-reload)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import githubRoutes from './routes/github.js';
import analyzeRoutes from './routes/analyze.js';
import auditRoutes from './routes/audit.js';
import careerRoutes from './routes/career.js';
import peersRoutes from './routes/peers.js';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Sanity check on startup: fail loud if keys are missing ------------
if (!process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN.includes('PASTE')) {
    console.error('\n❌ GITHUB_TOKEN is not set. Copy .env.example to .env and fill it in.\n');
    process.exit(1);
}
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('PASTE')) {
    console.error('\n❌ GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in.\n');
    process.exit(1);
}

// --- Middleware -------------------------------------------------------
// CORS: allow the frontend (running on Live Server / file:// / localhost)
// to call this backend. For the hackathon we're permissive.
app.use(cors({
    origin: true, // reflect request origin — fine for localhost demo
    credentials: false
}));

app.use(express.json({ limit: '2mb' }));

// Log every request so you can see what's happening during dev
app.use((req, _res, next) => {
    const t = new Date().toISOString().slice(11, 19);
    console.log(`[${t}] ${req.method} ${req.path}`);
    next();
});

// --- Routes -----------------------------------------------------------
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'zerolabs-backend', time: new Date().toISOString() });
});

app.use('/api/github', githubRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/peers', peersRoutes);

// --- Error handler ----------------------------------------------------
app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    console.error(`💥 Error (${status}):`, err.message);
    res.status(status).json({
        error: status === 429 ? 'rate_limited' : 'internal_error',
        message: err.message || 'Something went wrong'
    });
});

app.listen(PORT, () => {
    console.log(`\n⚡ ZeroLabs backend listening on http://localhost:${PORT}`);
    console.log(`   Try: curl http://localhost:${PORT}/api/health\n`);
});
