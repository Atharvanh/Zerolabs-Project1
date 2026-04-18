import "dotenv/config";
import cors from "cors";
import express from "express";

const PORT = Number(process.env.PORT) || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const AI_PROVIDER = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

const app = express();
app.use(cors());
app.use(express.json({ limit: "32kb" }));

function githubHeaders() {
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "zerolabs-audit-server",
  };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function fetchUserRepos(username) {
  const url = new URL(`https://api.github.com/users/${encodeURIComponent(username)}/repos`);
  url.searchParams.set("type", "owner");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("per_page", "100");

  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) {
    const err = new Error("GitHub user not found");
    err.code = "GITHUB_NOT_FOUND";
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`GitHub API error (${res.status}): ${text.slice(0, 200)}`);
    err.code = "GITHUB_API";
    throw err;
  }
  return res.json();
}

function summarizeRepos(repos) {
  const publicRepos = repos.filter((r) => !r.private);
  const recent = publicRepos.slice(0, 3).map((r) => r.name);

  const langs = new Set();
  for (const r of publicRepos) {
    if (r.language) langs.add(r.language);
  }

  return {
    recentRepositories: recent,
    languages: [...langs].sort((a, b) => a.localeCompare(b)),
    publicRepoCount: publicRepos.length,
  };
}

function buildAuditPrompt({ username, github }) {
  return [
    `You are helping a hackathon demo. Given public GitHub activity for username "${username}", write a short, friendly "audit" (3–6 sentences).`,
    `Be factual: only use the data below. If the list is empty, say they have no public repos visible.`,
    ``,
    `Languages observed across public repos: ${github.languages.length ? github.languages.join(", ") : "(none listed)"}`,
    `Three most recently updated public repos: ${github.recentRepositories.length ? github.recentRepositories.join(", ") : "(none)"}`,
    `Public repo count (from this page of results, max 100): ${github.publicRepoCount}`,
  ].join("\n");
}

async function callOpenAI(prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You write concise, accurate summaries for developers.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data).slice(0, 300);
    const err = new Error(`OpenAI API error (${res.status}): ${msg}`);
    err.code = "OPENAI_API";
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const err = new Error("OpenAI returned an empty response");
    err.code = "OPENAI_EMPTY";
    throw err;
  }
  return text;
}

async function callAnthropic(prompt) {
  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data).slice(0, 300);
    const err = new Error(`Anthropic API error (${res.status}): ${msg}`);
    err.code = "ANTHROPIC_API";
    throw err;
  }

  const text = data?.content?.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  if (!text) {
    const err = new Error("Anthropic returned an empty response");
    err.code = "ANTHROPIC_EMPTY";
    throw err;
  }
  return text;
}

async function runAuditLLM(prompt) {
  if (AI_PROVIDER === "anthropic") {
    if (!ANTHROPIC_API_KEY) {
      const err = new Error("Missing ANTHROPIC_API_KEY (set it in your environment or .env)");
      err.code = "MISSING_API_KEY";
      throw err;
    }
    return { provider: "anthropic", text: await callAnthropic(prompt) };
  }

  if (!OPENAI_API_KEY) {
    const err = new Error("Missing OPENAI_API_KEY (set it in your environment or .env)");
    err.code = "MISSING_API_KEY";
    throw err;
  }
  return { provider: "openai", text: await callOpenAI(prompt) };
}

app.post("/api/audit", async (req, res) => {
  try {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    if (!username) {
      return res.status(400).json({ ok: false, error: "Request body must include { \"username\": \"...\" }" });
    }

    const repos = await fetchUserRepos(username);
    const github = summarizeRepos(repos);
    const prompt = buildAuditPrompt({ username, github });
    const { provider, text } = await runAuditLLM(prompt);

    return res.json({
      ok: true,
      github: {
        username,
        languages: github.languages,
        recentRepositories: github.recentRepositories,
        publicRepoCount: github.publicRepoCount,
      },
      ai: {
        provider,
        auditText: text,
      },
    });
  } catch (err) {
    const code = err.code ?? "INTERNAL";
    if (code === "GITHUB_NOT_FOUND") {
      return res.status(404).json({ ok: false, error: err.message, code });
    }
    if (code === "MISSING_API_KEY") {
      return res.status(500).json({ ok: false, error: err.message, code });
    }
    if (code === "GITHUB_API" || code === "OPENAI_API" || code === "ANTHROPIC_API") {
      return res.status(502).json({ ok: false, error: err.message, code });
    }
    console.error(err);
    return res.status(500).json({ ok: false, error: "Unexpected server error", code });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Audit server listening on http://localhost:${PORT}`);
});
