// zl-api.js
// Shared helpers used by every ZeroLabs page:
//   - resolves the current GitHub username (URL ?u= or sessionStorage)
//   - fetches the full analysis from the backend once and caches in sessionStorage
//   - rewrites sidebar/nav links so the username is preserved across pages

(function () {
    const API_BASE = 'http://localhost:3001/api';
    const CACHE_KEY = 'zl:analysis';
    const AUDIT_CACHE_KEY = 'zl:audit';

    function getUsername() {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = (params.get('u') || '').trim();
        if (fromUrl) {
            try { sessionStorage.setItem('zl:user', fromUrl); } catch {}
            return fromUrl;
        }
        try { return (sessionStorage.getItem('zl:user') || '').trim(); } catch { return ''; }
    }

    function readCache(username) {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.username === username && parsed.expiresAt > Date.now()) {
                return parsed.data;
            }
        } catch {}
        return null;
    }

    function writeCache(username, data) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                username,
                data,
                expiresAt: Date.now() + 10 * 60 * 1000
            }));
        } catch {}
    }

    async function fetchAnalysis(username) {
        const cached = readCache(username);
        if (cached) return cached;
        const res = await fetch(`${API_BASE}/analyze/profile/${encodeURIComponent(username)}`);
        if (!res.ok) {
            let body = {};
            try { body = await res.json(); } catch {}
            const err = new Error(body.message || `Backend returned ${res.status}`);
            err.status = res.status;
            throw err;
        }
        const data = await res.json();
        writeCache(username, data);
        return data;
    }

    function getClaim() {
        try { return (sessionStorage.getItem('zl:claim') || '').trim(); } catch { return ''; }
    }

    async function fetchAudit(username, claim) {
        const effectiveClaim = (claim == null ? getClaim() : claim) || '';
        try {
            const raw = sessionStorage.getItem(AUDIT_CACHE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.username === username && parsed.claim === effectiveClaim && parsed.expiresAt > Date.now()) {
                    return parsed.data;
                }
            }
        } catch {}

        const res = await fetch(`${API_BASE}/audit/profile/${encodeURIComponent(username)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claim: effectiveClaim })
        });
        if (!res.ok) {
            let body = {};
            try { body = await res.json(); } catch {}
            const err = new Error(body.message || `Backend returned ${res.status}`);
            err.status = res.status;
            throw err;
        }
        const data = await res.json();
        try {
            sessionStorage.setItem(AUDIT_CACHE_KEY, JSON.stringify({
                username,
                claim: effectiveClaim,
                data,
                expiresAt: Date.now() + 10 * 60 * 1000
            }));
        } catch {}
        return data;
    }

    function preserveNavLinks(username) {
        if (!username) return;
        const internal = [
            'dashboard.html',
            'skill_graph.html',
            'projects.html',
            'roadmap.html',
            'career_matches.html',
            'audit.html'
        ];
        document.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            const base = href.split('?')[0].split('#')[0];
            if (internal.includes(base)) {
                a.setAttribute('href', `${base}?u=${encodeURIComponent(username)}`);
            }
        });
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function applyProfile(profile) {
        if (!profile) return;
        const displayName = profile.name || profile.login;
        document.querySelectorAll('[data-zl-avatar]').forEach(img => {
            if (profile.avatar_url) img.src = profile.avatar_url;
        });
        document.querySelectorAll('[data-zl-username]').forEach(el => {
            el.textContent = displayName;
        });
    }

    window.ZL = {
        API_BASE,
        getUsername,
        getClaim,
        fetchAnalysis,
        fetchAudit,
        preserveNavLinks,
        escapeHtml,
        applyProfile
    };

    document.addEventListener('DOMContentLoaded', () => {
        const u = getUsername();
        preserveNavLinks(u);
    });
})();
