# ZeroLabs Backend

Hackathon backend for the Developer Career Intelligence System.

## Quick start (each team member does this once)

1. **Install Node.js 20+** — check with `node -v`. If you don't have it, grab it from [nodejs.org](https://nodejs.org).

2. **Install deps:**
   ```bash
   cd backend
   npm install
   ```

3. **Set up API keys:**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste in:
   - Your GitHub fine-grained PAT (get one at https://github.com/settings/tokens?type=beta — Public repositories, read-only)
   - Your Gemini API key (get one at https://aistudio.google.com/apikey)

4. **Run it:**
   ```bash
   npm run dev
   ```
   You should see: `⚡ ZeroLabs backend listening on http://localhost:3001`

5. **Test it works:**
   ```bash
   curl http://localhost:3001/api/health
   curl http://localhost:3001/api/github/profile/torvalds
   ```

## Endpoints (current)

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | Sanity check |
| GET | `/api/github/profile/:username` | Profile + repos + language breakdown |
| GET | `/api/github/repo/:owner/:repo/tree` | File listing at repo root |
| GET | `/api/analyze/ping` | Stub (for now) |

## Rules

- **Never commit `.env`** — it's gitignored, don't fight it.
- **Don't share keys in screenshots** during the demo.
- **Cache is in-memory** — restart wipes it. That's fine for a hackathon.

## Architecture

```
server.js              ← Express entry, CORS, logging
routes/
  github.js            ← raw GitHub data endpoints
  analyze.js           ← analysis endpoints (Gemini-powered)
services/
  github.js            ← GitHub API wrapper + in-memory cache
  gemini.js            ← Gemini wrapper with JSON mode + retry
  analyzers/           ← one file per analysis type (coming soon)
```
