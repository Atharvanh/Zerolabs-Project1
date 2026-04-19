# ⚡ ZeroLabs — AI-Powered Developer Career Intelligence

> **One GitHub username. Full career X-ray in 15 seconds.**

ZeroLabs reads a developer's **actual source code** — not just stars, commit counts, or profile bios — and produces a comprehensive career intelligence report powered by **Google Gemini 2.5 Flash**. It combines real-time GitHub analysis, AI-driven code auditing, and live job matching into a 7-page interactive dashboard.

---

## 🎯 The Problem

Developers don't know their true skill level. Recruiters rely on resumes full of buzzwords. GitHub profile pages show commit streaks and star counts — but neither reveals **code quality, architectural depth, or real proficiency**.

## 💡 The Solution

ZeroLabs connects to GitHub, **pulls real source files**, and uses a multi-layered AI pipeline to answer:
- *"What's this developer actually good at — based on their code, not their claims?"*
- *"What should they learn next to get promoted?"*
- *"Which jobs are they genuinely qualified for?"*
- *"Are their resume claims actually backed by evidence?"*

---

## 🏆 Key Technical Highlights (For Judges)

| Innovation | What We Built | Why It Matters |
|---|---|---|
| **Skill Density Algorithm** | Volume (70%) + Complexity (30%) weighted ranking | Prevents a single impressive repo from outranking 6+ repos in another language |
| **Quality-First Scoring** | Projects scored on architecture & patterns, NOT recency | A 3-year-old clean codebase outranks yesterday's spaghetti code |
| **Anti-Hallucination System** | 5 explicit rules + server-side computed metrics injected into prompts | LLM cannot invent repo names, inflate scores, or claim skills not in the data |
| **Server-Side YoY** | Real `pushed_at` timestamps computed in JS, not LLM-guessed | Year-over-year growth is a hard number, not AI estimation |
| **Zero Fake Data Policy** | Empty array on 0 results, HTTP 500 on API crash | No mock jobs. No fake hope. Honest failures. |
| **Multi-Key Rotation** | 3 Gemini API keys rotating round-robin | 30 RPM effective throughput on free tier |
| **Resume vs Code Audit** | PDF.js client-side extraction → AI cross-reference | Upload a resume, we'll tell you which claims your code actually supports |
| **Technical Red Flags** | Anti-pattern detection with blast radius analysis | "God Component in repo X → single failed API call crashes entire UI" |

---

## 📄 Features — Page by Page

### 1. 🏠 Landing Page (`index.html`)

The entry point. Accepts **3 input types**:

| Input | Example | Result |
|---|---|---|
| GitHub Username | `torvalds` | Full 5-screen career analysis |
| Repo URL | `github.com/user/repo` | Deep 360° code audit |
| Live Website URL | `myapp.vercel.app` | Tech stack detection scan |

**Features:**
- 🎨 **3D Mesh-Wave Background** — Three.js animated particle mesh with separate dark/light renderers that crossfade on theme toggle
- 📄 **Resume Upload** — Drag & drop PDF/TXT/MD. PDF.js extracts text client-side (no server upload). Combined with manual claims for audit comparison
- ✨ **Dissolve Animation** — On analyze click, all UI dissolves upward with staggered blur animations, leaving only the mesh-wave visible behind a floating glass loader popup
- 🔄 **4-Stage Loader** — Real-time progress: *Fetching profile → Scanning repos → Aggregating languages → Running AI analysis*
- ⚠️ **Smart Error Handling** — 429 rate-limit detection with retry countdown, 404 user-not-found, inline error messages with dismiss

---

### 2. 📊 Intelligence Dashboard (`dashboard.html`)

The primary results screen. Everything at a glance.

| Section | What It Shows | Grounding Rule |
|---|---|---|
| **Career Velocity** | 0-100 score + YoY% change + 7-bar sparkline | Score computed from repo count + code bytes + language diversity. YoY from real `pushed_at` timestamps. |
| **AI Insights** | 3 cards (positive / warning / info) | Every insight **must cite a specific repo name or number**. Generic statements are forbidden. |
| **Skill Distribution** | 4 bars (Frontend, Backend, Data & ML, DevOps) | Percentages follow the Skill Density Algorithm. 0 repos in a category = ≤10%. |
| **Role Matches** | 2 best-fit roles with match scores | Roles derived from top 2 skill categories. No ML Engineer suggestions for JS-only profiles. |
| **Resume Tip** | One actionable sentence | Must reference a specific repo name. |

---

### 3. 🕸 Skill Topography (`skill_graph.html`)

Multi-dimensional skill mapping.

- **Languages** — Top 3 with calibrated levels:
  - *Expert* = 5+ repos AND >40% bytes
  - *Advanced* = 3+ repos OR >25% bytes
  - *Intermediate* = 2 repos OR >10% bytes
  - *Familiar* = 1 repo or <10% bytes
- **Frameworks** — Inferred from repo names, topics, descriptions. Must appear in actual data — no guessing.
- **Tools & Infra** — Docker, AWS, CI/CD. No evidence = capped at 15%.
- **Soft Skills** — Anti-inflation rules:
  - "Mentorship" requires 50+ stars
  - "System Design" requires 10+ file repos with clear architecture
  - "Open Source Leadership" requires 5+ forks
  - Below thresholds = percent capped at 25%
- **Velocity Index Card** — Score with momentum badge (High Momentum / Steady Growth / Building / Getting Started), YoY change labeled "vs. previous 12 months", activity stats strip (Active 12mo / Total Repos / Languages), peak skill badge
- **5-Axis Radar Chart** — Each axis has a defined formula grounded in real data (e.g., Languages = distinct count / 8 × 100)

---

### 4. 💼 Project Portfolio (`projects.html`)

AI-evaluated repository ranking.

- **Featured Benchmark** — Highest quality repo with large score display + quality justification
- **Quality Score (0-100)** — Based strictly on:
  - Code Quality (patterns, error handling, testing signals)
  - Architectural Complexity (file structure, separation of concerns)
  - Tech Stack Sophistication (modern tools, multiple layers)
  - **NOT recency** — `updated_at` is stripped from data sent to AI
- **Resume Priority Tags** — Each project gets priority 1 (lead-with), 2 (strong supporting), or 3 (background only) with a `resume_why` sentence for hiring managers
- **Tone Badges** — Positive / Warning / Neutral labels per project

---

### 5. 🗺 90-Day Career Roadmap (`roadmap.html`)

Personalized 3-month learning plan.

- **Target Role** — Must align with #1 skill category by density. JS-heavy profile → frontend/fullstack role, not ML.
- **Overall Progress** — 0-100% based on repo count in target area + code complexity
- **3-Month Plan** — Foundation → Deep Dive → Mastery, each with 2 tasks
- **Task Grounding** — Every task references a specific repo: *"Add unit tests to my-project"* not *"learn testing"*

---

### 6. 🎯 Career Matches (`career_matches.html`)

Real-time job matching engine.

- **Hybrid Scoring** — Server-side algorithm (not LLM):
  1. Extract skills from GitHub languages + repo topics
  2. Query JSearch API with top skills
  3. Score every posting: required skills (70%) + nice-to-have (30%)
  4. Skill normalization via 100+ alias map (e.g., `react.js` → `React`, `k8s` → `Kubernetes`)
- **Up to 8 Match Cards** — Ranked by score, with Live Job badges for real-time results
- **Featured Match Detail** — Affinity grade (A+/A/B+), Intelligence brief (must cite actual repo names), skill gap analysis with repo-specific acquisition actions
- **Apply Now** — Direct links to real job postings
- **Strict Policy** — 0 results = empty array. API crash = HTTP 500. **Never returns fake/mock jobs.**

---

### 7. 🔍 360° Code Audit (`audit.html`)

The deepest technical feature. A brutally-honest AI code review.

**Three Modes:**
| Mode | Input | Process |
|---|---|---|
| Profile Audit | Username | Samples top 3 repos, reads actual source files |
| Repo Audit | Repo URL | Deep-dives into single repository |
| URL Scan | Live website | Detects tech stack from production page |

**What the AI Produces:**

| Section | Detail |
|---|---|
| **Verdict** | Level (junior/mid/senior/staff) + calibrated confidence + one-line reality check |
| **Confidence Calibration** | 3+ repos source files = 60-95%. READMEs only = 20-40% max. |
| **Claim vs Actual** | Each claimed skill gets evidence rating (strong/some/none) with repo citations |
| **Contradictions** | Gaps between claims and code (e.g., *"Claims 4yr React but only has jQuery repos"*) |
| **Code Review** | 3-6 findings with repo, file path, severity, issue, specific fix, blast radius |
| **Technical Red Flags** | Anti-patterns like "God Component", "N+1 queries", "Missing input validation" — with severity badges (critical/major/minor) and blast radius descriptions |
| **Strengths** | 2-4 genuine strengths with evidence |
| **Elevation Path** | 3-5 repo-specific improvement actions |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  FRONTEND (Vanilla JS)                    │
│                                                          │
│  index.html ──→ dashboard ──→ skill_graph ──→ projects   │
│                    ──→ roadmap ──→ career_matches         │
│                    ──→ audit (360°)                       │
│                                                          │
│  Shared: zl-api.js │ transitions.js │ zerolabs.js        │
│  Visual: Three.js mesh-wave │ TailwindCSS CDN            │
│  UX: dissolve animations │ page transitions │ toasts     │
└────────────────────────┬─────────────────────────────────┘
                         │ REST API (fetch)
                         ▼
┌──────────────────────────────────────────────────────────┐
│               BACKEND (Node.js + Express)                 │
│                                                          │
│  /api/analyze   ── Gemini LLM with Skill Density algo    │
│  /api/audit     ── Gemini LLM + GitHub file sampling     │
│  /api/career    ── JSearch API + deterministic scoring    │
│  /api/github    ── Profile data proxy                    │
│  /api/peers     ── Percentile ranking                    │
│                                                          │
│  Services: gemini.js (multi-key) │ github.js │ jsearch   │
│  Cache: 30-min TTL in-memory per endpoint                │
└────────┬──────────┬───────────┬──────────────────────────┘
         │          │           │
         ▼          ▼           ▼
   GitHub API   Gemini 2.5   JSearch API
   (REST v3)    Flash (AI)   (RapidAPI)
```

---

## 🛠 Tech Stack

| Layer | Technology | Why We Chose It |
|---|---|---|
| **Frontend** | Vanilla HTML/CSS/JS | Zero build step. Judge can open `index.html` and it works. |
| **Styling** | TailwindCSS CDN + Custom CSS | Utility-first + glassmorphism + dark mode |
| **3D Visuals** | Three.js r128 | Animated mesh-wave background with theme-aware renderers |
| **Animations** | CSS Keyframes + JS | Dissolve transitions, page slats, micro-interactions |
| **Backend** | Node.js + Express 4 | REST API with structured middleware |
| **AI Engine** | Google Gemini 2.5 Flash | Structured JSON output with schema validation |
| **GitHub Data** | GitHub REST API v3 | Profile, repos, languages, actual file contents |
| **Job Search** | JSearch (RapidAPI) | Real-time Google Jobs aggregation |
| **Resume Parse** | PDF.js (client-side) | No server upload needed. Text extracted in browser. |
| **Caching** | In-memory Map (30min TTL) | Protects API quotas during demos |
| **Fonts** | Google Fonts (Inter) | Preloaded with FOUT prevention |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+
- **VS Code** + Live Server extension

### Setup
```bash
# 1. Clone
git clone https://github.com/Atharvanh/Zerolabs-Project1.git
cd project

# 2. Backend
cd backend
npm install
cp .env.example .env
# Fill in API keys (see below)
npm run dev

# 3. Frontend
# Open frontend/ in VS Code → Right-click index.html → Open with Live Server
```

### Environment Variables (`backend/.env`)

| Key | Required | Free Tier | Purpose |
|---|---|---|---|
| `GITHUB_TOKEN` | ✅ | 5,000 req/hr | GitHub profile + repo + file access |
| `GEMINI_API_KEY` | ✅ | ~10 RPM | Primary AI analysis key |
| `GEMINI_API_KEY_2` | Optional | ~10 RPM | Rate-limit rotation (recommended) |
| `GEMINI_API_KEY_3` | Optional | ~10 RPM | Rate-limit rotation |
| `RAPIDAPI_KEY` | Optional | 200 req/mo | Real-time job search via JSearch |

---

## 🔄 How It Works

### Profile Analysis Flow
```
Username → GitHub API (profile + repos + languages)
         → Server computes: language repo counts, YoY from pushed_at, activity metrics
         → Gemini 2.5 Flash with Skill Density algorithm prompt
         → Structured JSON → 30-min cache → Frontend renders 5 screens
```

### 360° Audit Flow
```
Username + Resume/Claim → GitHub API + file sampling (README, config, source files)
         → Gemini with skeptical audit prompt
         → Verdict + contradictions + code review + red flags + elevation path
```

### Career Matching Flow
```
GitHub skills extraction → JSearch API (real-time) + static corpus (24 postings)
         → Deterministic scoring: required (70%) + nice-to-have (30%)
         → Top matches + Gemini intelligence brief for #1 match
```

---

## 🧠 AI Engineering Details

### Skill Density Algorithm
```
Skill Density = (Volume × 0.70) + (Complexity × 0.30)
```
- **Volume** = how many repos use the skill (server-computed, injected as `LANGUAGE REPO COUNTS`)
- **Complexity** = code sophistication within those repos
- **Hard Rule**: A 1-repo language **cannot** rank above a 3+ repo language unless the multi-repo language has <1% of total bytes

### Anti-Hallucination Rules (embedded in every prompt)
1. Never invent repo names not in the data
2. Never claim skills not visible in language breakdown
3. <3 repos → velocity ≤30, progress ≤25, match scores ≤50
4. 0 repos in a skill category → percent ≤10
5. Every number must be justifiable by a specific metric

### Confidence Calibration (Audit)
| Evidence Level | Confidence Cap |
|---|---|
| Source files from 3+ repos | 60-95% |
| Source files from 1-2 repos | 50-70% |
| READMEs and configs only | 20-40% |

---

## 📁 Project Structure

```
project/
├── frontend/                    # Static frontend (24 files)
│   ├── index.html               # Landing page + dissolve animation + 3D mesh
│   ├── dashboard.html/js        # Intelligence dashboard
│   ├── skill_graph.html/js      # Skill topography + radar + velocity
│   ├── projects.html/js         # Quality-scored project portfolio
│   ├── roadmap.html/js          # 90-day career roadmap
│   ├── career_matches.html/js   # Job matches + live jobs
│   ├── audit.html/js            # 360° code audit
│   ├── zl-api.js                # API client + caching layer
│   ├── transitions.js/css       # SPA page transitions + toasts
│   ├── interactions.js/css      # Micro-interactions (hover, scroll)
│   ├── zerolabs.css/js          # Design system + shared utilities
│   ├── theme.js                 # Light/dark toggle + persistence
│   └── mesh-wave.js / mesh-wave-light.js  # Three.js backgrounds
│
├── backend/                     # Node.js Express API
│   ├── server.js                # Entry point + middleware + error handler
│   ├── routes/
│   │   ├── analyze.js           # Main analysis (Gemini + Skill Density)
│   │   ├── audit.js             # 360° audit (Gemini + file sampling)
│   │   ├── career.js            # Career matching (JSearch + scoring)
│   │   ├── peers.js             # Peer percentile ranking
│   │   └── github.js            # Profile data proxy
│   ├── services/
│   │   ├── gemini.js            # Multi-key rotation + request queue
│   │   ├── github.js            # GitHub API client
│   │   └── jsearch.js           # JSearch API client (strict error policy)
│   └── data/
│       └── job-postings.js      # Static job corpus (fallback)
│
└── README.md
```

---

## 📊 Complete Feature Matrix

| # | Feature | Status | Technology |
|---|---|---|---|
| 1 | GitHub Profile Analysis | ✅ Live | GitHub API + Gemini 2.5 Flash |
| 2 | Skill Density Algorithm (70/30 weighting) | ✅ Live | Server-side computation + LLM prompt |
| 3 | Quality-First Project Scoring (no recency) | ✅ Live | Gemini with timestamps stripped |
| 4 | Server-Side YoY Computation | ✅ Live | Real `pushed_at` analysis |
| 5 | Anti-Hallucination System (5 rules) | ✅ Live | Grounding rules in every prompt |
| 6 | Skill Topography (radar + proficiency bars) | ✅ Live | SVG rendering + Gemini |
| 7 | Velocity Index with Momentum Badge | ✅ Live | Activity metrics + threshold labels |
| 8 | 90-Day Career Roadmap | ✅ Live | Gemini with repo-specific tasks |
| 9 | Real-Time Job Matching (JSearch) | ✅ Live | JSearch API + skill scoring engine |
| 10 | Apply Now Direct Links | ✅ Live | JSearch `apply_link` field |
| 11 | Live Job Badges | ✅ Live | Frontend detection of JSearch sources |
| 12 | 360° Code Audit (3 modes) | ✅ Live | Gemini + GitHub file sampling |
| 13 | Resume Upload + PDF Parsing | ✅ Live | PDF.js client-side extraction |
| 14 | Claim vs Code Contradictions | ✅ Live | AI cross-reference analysis |
| 15 | Technical Red Flags Detection | ✅ Live | Anti-pattern identification + severity |
| 16 | Confidence Calibration | ✅ Live | Evidence-based scoring caps |
| 17 | Multi-Key API Rotation | ✅ Live | 3-key round-robin for 30 RPM |
| 18 | Zero Fake Data Policy | ✅ Live | Empty array / HTTP 500, never mock |
| 19 | 30-Min Response Caching | ✅ Live | In-memory Map with TTL |
| 20 | Dissolve Loading Animation | ✅ Live | CSS keyframes + staggered blur |
| 21 | 3D Mesh-Wave Background | ✅ Live | Three.js with dark/light renderers |
| 22 | SPA Page Transitions | ✅ Live | CSS slat animations |
| 23 | Light/Dark Theme Toggle | ✅ Live | CSS + localStorage + mesh swap |
| 24 | Toast Notification System | ✅ Live | transitions.js ZLToast |
| 25 | Font Preloading (FOUT fix) | ✅ Live | `<link preload>` + `document.fonts` |
| 26 | Peer Percentile Comparison | ✅ Live | In-memory aggregate scoring |

---

## 👥 Team

Built during the hackathon by the ZeroLabs team.

---

## 📜 License

Built for hackathon demonstration purposes. Not intended for production use without additional security hardening, persistent storage, and proper API key management.
