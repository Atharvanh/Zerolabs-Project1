// dashboard.js
// Renders the Intelligence Overview page from the shared analysis payload.

(function () {
    const INSIGHT_STYLES = {
        positive: { dot: 'bg-tertiary', border: 'border-tertiary/20' },
        warning: { dot: 'bg-error', border: 'border-error/20' },
        info: { dot: 'bg-secondary', border: 'border-secondary/20' }
    };

    const SKILL_GRADIENTS = [
        { bar: 'bg-gradient-to-r from-primary-container to-primary', glow: 'shadow-[0_0_10px_rgba(173,198,255,0.5)]' },
        { bar: 'bg-gradient-to-r from-secondary-container to-secondary', glow: 'shadow-[0_0_10px_rgba(208,188,255,0.3)]' },
        { bar: 'bg-gradient-to-r from-tertiary-container to-tertiary', glow: 'shadow-[0_0_10px_rgba(78,222,163,0.3)]' },
        { bar: 'bg-gradient-to-r from-outline-variant to-outline', glow: '' }
    ];

    const ROLE_ACCENTS = [
        { text: 'text-primary', score: 'text-tertiary', hoverBorder: 'hover:border-primary/30', gradFrom: 'from-primary/5' },
        { text: 'text-secondary', score: 'text-secondary', hoverBorder: 'hover:border-secondary/30', gradFrom: 'from-secondary/5' }
    ];

    function $(id) { return document.getElementById(id); }

    function setStatus(text, tone = 'loading') {
        const dot = $('zl-status-dot');
        const textEl = $('zl-status-text');
        if (!dot || !textEl) return;
        textEl.textContent = text;
        dot.classList.remove('bg-tertiary', 'bg-error', 'bg-primary', 'animate-pulse');
        if (tone === 'ready') dot.classList.add('bg-tertiary');
        else if (tone === 'error') dot.classList.add('bg-error');
        else dot.classList.add('bg-tertiary', 'animate-pulse');
    }

    function showError(msg) {
        const box = $('zl-error');
        if (box) {
            box.textContent = msg;
            box.classList.remove('hidden');
        }
        setStatus('Failed', 'error');
    }

    function renderProfile(profile) {
        if (profile.avatar_url) {
            const hdr = $('zl-header-avatar');
            const side = $('zl-sidebar-avatar');
            if (hdr) hdr.src = profile.avatar_url;
            if (side) side.src = profile.avatar_url;
        }
        const title = $('zl-hero-title');
        const sub = $('zl-hero-sub');
        const sideName = $('zl-sidebar-name');
        const displayName = profile.name || profile.login;
        if (title) title.textContent = `${displayName}'s Intelligence`;
        if (sub) {
            sub.textContent = profile.bio
                ? profile.bio
                : `Atmospheric analysis of ${profile.login}'s engineering velocity, skill distribution, and immediate career trajectory.`;
        }
        if (sideName) sideName.textContent = displayName;
    }

    function renderVelocity(velocity) {
        const score = Math.max(0, Math.min(100, velocity.score ?? 0));
        const yoy = velocity.yoy ?? 0;
        const bars = Array.isArray(velocity.bars) && velocity.bars.length
            ? velocity.bars.slice(-7)
            : [5, 8, 10, 12, 14, 16, 18]; // modest fallback, not optimistic ramp

        const scoreEl = $('zl-velocity-score');
        if (scoreEl) scoreEl.textContent = String(score);

        const yoyEl = $('zl-velocity-yoy');
        if (yoyEl) {
            const arrow = yoy > 0 ? 'trending_up' : yoy < 0 ? 'trending_down' : 'trending_flat';
            const sign = yoy > 0 ? '+' : '';
            const color = yoy > 0 ? 'text-tertiary' : yoy < 0 ? 'text-error' : 'text-on-surface-variant';
            const label = yoy === 0 ? 'No change vs prev year' : `${sign}${yoy}% vs prev year`;
            yoyEl.className = `text-lg font-medium ${color} flex items-center`;
            yoyEl.innerHTML = `<span class="material-symbols-outlined text-sm mr-1">${arrow}</span>${label}`;
        }

        const sideVel = $('zl-sidebar-velocity');
        if (sideVel) sideVel.textContent = `Career Velocity: ${score}%`;

        const barsContainer = $('zl-velocity-bars');
        if (barsContainer) {
            barsContainer.innerHTML = '';
            const maxIdx = bars.indexOf(Math.max(...bars));
            bars.forEach((h, i) => {
                const pct = Math.max(5, Math.min(100, h));
                const div = document.createElement('div');
                const isMax = i === maxIdx;
                div.className = isMax
                    ? 'w-full bg-primary/60 rounded-t-sm shadow-[0_0_15px_rgba(173,198,255,0.3)] relative transition-colors'
                    : 'w-full bg-surface-container-highest rounded-t-sm hover:bg-primary/40 transition-colors cursor-pointer relative interactive-card';
                div.style.height = `${pct}%`;
                barsContainer.appendChild(div);
            });
        }
    }

    function renderInsights(insights) {
        const host = $('zl-insights');
        if (!host) return;
        host.innerHTML = '';
        (insights || []).forEach(ins => {
            const styles = INSIGHT_STYLES[ins.type] || INSIGHT_STYLES.info;
            const wrap = document.createElement('div');
            wrap.className = 'group';
            wrap.innerHTML = `
                <div class="flex items-center gap-2 mb-1">
                    <span class="w-1.5 h-1.5 rounded-full ${styles.dot}"></span>
                    <span class="text-sm font-medium text-on-surface">${ZL.escapeHtml(ins.title || '')}</span>
                </div>
                <p class="text-xs text-on-surface-variant/80 pl-3.5 border-l ${styles.border} ml-0.5 pb-1">
                    ${ZL.escapeHtml(ins.text || '')}
                </p>`;
            host.appendChild(wrap);
        });
    }

    function renderSkills(skills) {
        const host = $('zl-skills');
        if (!host) return;
        host.innerHTML = '';
        (skills || []).forEach((skill, i) => {
            const pct = Math.max(0, Math.min(100, skill.percent ?? 0));
            const grad = SKILL_GRADIENTS[i % SKILL_GRADIENTS.length];
            const wrap = document.createElement('div');
            wrap.innerHTML = `
                <div class="flex justify-between text-sm mb-2">
                    <span class="text-on-surface font-medium flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm text-outline-variant">${ZL.escapeHtml(skill.icon || 'code')}</span>
                        ${ZL.escapeHtml(skill.name || '')}
                    </span>
                    <span class="text-on-surface-variant">${pct}%</span>
                </div>
                <div class="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden interactive-card">
                    <div class="${grad.bar} h-1.5 rounded-full ${grad.glow}" style="width: ${pct}%"></div>
                </div>`;
            host.appendChild(wrap);
        });
    }

    function renderRoles(roles) {
        const host = $('zl-roles');
        if (!host) return;
        host.innerHTML = '';
        (roles || []).forEach((role, i) => {
            const accent = ROLE_ACCENTS[i % ROLE_ACCENTS.length];
            const match = Math.max(0, Math.min(100, role.match ?? 0));
            const wrap = document.createElement('div');
            wrap.className = `bg-surface-container p-4 rounded-lg border border-outline-variant/10 ${accent.hoverBorder} transition-colors group cursor-pointer relative overflow-hidden interactive-card`;
            wrap.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br ${accent.gradFrom} to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div class="p-2 bg-surface-container-highest rounded ${accent.text} interactive-card">
                        <span class="material-symbols-outlined">${ZL.escapeHtml(role.icon || 'work')}</span>
                    </div>
                    <span class="text-lg font-bold ${accent.score}">${match}%</span>
                </div>
                <h4 class="text-base font-semibold text-on-surface mb-1 relative z-10">${ZL.escapeHtml(role.title || '')}</h4>
                <p class="text-xs text-on-surface-variant relative z-10">${ZL.escapeHtml(role.note || '')}</p>`;
            host.appendChild(wrap);
        });
    }

    function renderResumeTip(tip) {
        const el = $('zl-resume-tip');
        if (el && tip) el.textContent = tip;
    }

    function ordinal(n) {
        const s = ['th','st','nd','rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    function renderPeerPercentile(peer) {
        if (!peer) return;
        const overall = $('zl-peer-overall');
        if (overall) overall.textContent = peer.percentiles.overall;

        // Ordinal suffix
        const suffix = overall?.nextElementSibling;
        if (suffix) suffix.textContent = ordinal(peer.percentiles.overall);

        // Animated bars
        const metrics = ['velocity', 'repos', 'stars', 'languages'];
        metrics.forEach(m => {
            const bar = $(`zl-peer-bar-${m}`);
            const val = $(`zl-peer-val-${m}`);
            const pct = peer.percentiles[m] ?? 0;
            if (bar) setTimeout(() => { bar.style.width = `${pct}%`; }, 300);
            if (val) val.textContent = `${pct}%`;
        });

        // Peer count
        const countEl = $('zl-peer-count');
        if (countEl) countEl.textContent = peer.total_peers;
    }

    async function init() {
        const username = ZL.getUsername();
        if (!username) {
            showError('No GitHub username provided. Go back to the home page and enter one.');
            return;
        }
        setStatus(`Analyzing ${username}...`, 'loading');
        try {
            const data = await ZL.fetchAnalysis(username);
            const d = data.analysis.dashboard;
            renderProfile(data.profile);
            renderVelocity(d.velocity);
            renderInsights(d.insights);
            renderSkills(d.skills);
            renderRoles(d.roles);
            renderResumeTip(d.resume_tip);
            setStatus(`Synced ${data.profile.login}`, 'ready');
            const timeEl = $('zl-status-time');
            if (timeEl) timeEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;

            // Fetch peer percentile (non-blocking)
            ZL.fetchPeerPercentile(username).then(peer => {
                if (peer) renderPeerPercentile(peer);
            }).catch(() => {});
        } catch (err) {
            console.error('[ZeroLabs] analysis failed:', err);
            showError(err.message || 'Could not reach the ZeroLabs backend. Make sure it is running on :3001.');
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
