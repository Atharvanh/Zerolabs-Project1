// skill_graph.js
// Renders the Technical Topology page from the shared analysis payload.

(function () {
    const LEVEL_COLOR = {
        Expert: 'text-tertiary',
        Advanced: 'text-primary',
        Intermediate: 'text-outline',
        Familiar: 'text-on-surface-variant'
    };

    const BAR_COLOR = [
        'bg-gradient-to-r from-primary to-primary-container',
        'bg-primary-fixed-dim',
        'bg-secondary',
        'bg-secondary-fixed-dim',
        'bg-tertiary',
        'bg-tertiary-fixed-dim',
        'bg-outline'
    ];

    function $(id) { return document.getElementById(id); }

    function renderProficiencyList(hostId, items) {
        const host = $(hostId);
        if (!host) return;
        host.innerHTML = '';
        (items || []).forEach((item, i) => {
            const pct = Math.max(0, Math.min(100, item.percent ?? 0));
            const levelColor = LEVEL_COLOR[item.level] || 'text-outline';
            const barColor = BAR_COLOR[i % BAR_COLOR.length];
            const row = document.createElement('div');
            row.innerHTML = `
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-on-surface font-medium">${ZL.escapeHtml(item.name)}</span>
                    <span class="${levelColor}">${ZL.escapeHtml(item.level || '')}</span>
                </div>
                <div class="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden interactive-card">
                    <div class="h-full ${barColor} rounded-full" style="width: ${pct}%"></div>
                </div>`;
            host.appendChild(row);
        });
    }

    function renderRadar(radar) {
        const svg = $('zl-radar-svg');
        const labels = $('zl-radar-labels');
        if (!svg || !labels) return;
        const pts = (radar || []).slice(0, 5);
        if (pts.length < 3) return;
        const cx = 50;
        const cy = 50;
        const rMax = 42;
        const n = pts.length;
        const coords = pts.map((p, i) => {
            const angle = (-Math.PI / 2) + (i * 2 * Math.PI / n);
            const r = rMax * (Math.max(0, Math.min(100, p.value)) / 100);
            return {
                x: cx + r * Math.cos(angle),
                y: cy + r * Math.sin(angle),
                lx: cx + (rMax + 10) * Math.cos(angle),
                ly: cy + (rMax + 10) * Math.sin(angle),
                axis: p.axis
            };
        });

        svg.innerHTML = `
            <polygon fill="rgba(173, 198, 255, 0.15)" stroke="#adc6ff" stroke-width="1.5"
                points="${coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')}"></polygon>
            ${coords.map(c => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2" fill="#adc6ff"></circle>`).join('')}
        `;

        labels.innerHTML = '';
        coords.forEach((c, i) => {
            const span = document.createElement('span');
            span.className = 'absolute text-[10px] text-on-surface-variant font-medium tracking-wider uppercase';
            const parent = labels.parentElement;
            const parentRect = parent ? parent.getBoundingClientRect() : { width: 320, height: 320 };
            const w = parentRect.width || 320;
            const h = parentRect.height || 320;
            span.style.left = `${(c.lx / 100) * w}px`;
            span.style.top = `${(c.ly / 100) * h}px`;
            span.style.transform = 'translate(-50%, -50%)';
            span.textContent = pts[i].axis;
            labels.appendChild(span);
        });
    }

    function renderVelocityIndex(vi, reposSummary, languages) {
        if (!vi) return;

        // ── Score ──
        const score = vi.score ?? 0;
        const scoreEl = $('zl-vi-score');
        if (scoreEl) scoreEl.textContent = String(score);

        // ── Momentum Badge ──
        const badgeEl = $('zl-vi-momentum-badge');
        if (badgeEl) {
            let label, cls;
            if (score >= 70) {
                label = 'High Momentum';
                cls = 'bg-tertiary/10 text-tertiary border-tertiary/20';
            } else if (score >= 40) {
                label = 'Steady Growth';
                cls = 'bg-primary/10 text-primary border-primary/20';
            } else if (score >= 15) {
                label = 'Building';
                cls = 'bg-secondary/10 text-secondary border-secondary/20';
            } else {
                label = 'Getting Started';
                cls = 'bg-outline/10 text-on-surface-variant border-outline-variant/20';
            }
            badgeEl.textContent = label;
            badgeEl.className = `px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${cls}`;
        }

        // ── YoY ──
        const yoy = vi.yoy ?? 0;
        const yoyEl = $('zl-vi-yoy');
        if (yoyEl) {
            const arrow = yoy >= 0 ? 'arrow_upward' : 'arrow_downward';
            const sign = yoy > 0 ? '+' : '';
            const colorCls = yoy > 0 ? 'text-tertiary' : yoy < 0 ? 'text-error' : 'text-on-surface-variant';
            yoyEl.className = `text-sm font-bold ${colorCls} inline-flex items-center gap-0.5`;
            yoyEl.innerHTML = `<span class="material-symbols-outlined text-xs">${arrow}</span>${sign}${yoy}%`;
        }

        // ── Peak Skill ──
        const peakEl = $('zl-vi-peak');
        if (peakEl) peakEl.textContent = vi.peak_skill || '--';

        // ── Activity Stats Strip ──
        const totalRepos = reposSummary?.total ?? '--';
        const distinctLangs = languages?.length ?? '--';
        // Estimate active repos from the history trend (last value as proxy)
        const history = (vi.history && vi.history.length) ? vi.history.slice(-6) : [];
        const lastVal = history.length ? history[history.length - 1] : 0;
        // Approximate: if score is high, most repos are active
        const estimatedActive = totalRepos !== '--'
            ? Math.max(1, Math.round(totalRepos * (lastVal / 100)))
            : '--';

        const activeEl = $('zl-vi-active');
        if (activeEl) activeEl.textContent = estimatedActive;
        const totalReposEl = $('zl-vi-total-repos');
        if (totalReposEl) totalReposEl.textContent = totalRepos;
        const langsEl = $('zl-vi-langs');
        if (langsEl) langsEl.textContent = distinctLangs;

        // ── Chart (unchanged logic) ──
        const svg = $('zl-vi-history');
        if (svg) {
            const h = history.length ? history : [10, 12, 15, 18, 20, 22];
            const n = h.length;
            const maxV = Math.max(...h, 100);
            const coords = h.map((v, i) => ({
                x: (i / (n - 1)) * 200,
                y: 100 - ((v / maxV) * 90)
            }));
            const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
            const area = `${line} L200,100 L0,100 Z`;
            svg.innerHTML = `
                <defs>
                    <linearGradient id="growthGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stop-color="#4edea3" stop-opacity="0.3"></stop>
                        <stop offset="100%" stop-color="#4edea3" stop-opacity="0"></stop>
                    </linearGradient>
                </defs>
                <path d="${area}" fill="url(#growthGrad)"></path>
                <path d="${line}" fill="none" stroke="#4edea3" stroke-width="2"></path>
                <circle class="animate-pulse" cx="${coords[n - 1].x.toFixed(1)}" cy="${coords[n - 1].y.toFixed(1)}" fill="#4edea3" r="3"></circle>
            `;
        }
    }

    async function init() {
        const username = ZL.getUsername();
        if (!username) { window.location.href = 'index.html'; return; }
        try {
            const data = await ZL.fetchAnalysis(username);
            ZL.applyProfile(data.profile);
            const sg = data.analysis.skill_graph;
            const sideName = $('zl-sidebar-name');
            const sideVel = $('zl-sidebar-velocity');
            if (sideName) sideName.textContent = data.profile.name || data.profile.login;
            if (sideVel) sideVel.textContent = `Career Velocity: ${data.analysis.dashboard.velocity.score}%`;

            renderProficiencyList('zl-sg-languages', sg.languages);
            renderProficiencyList('zl-sg-frameworks', sg.frameworks);
            renderProficiencyList('zl-sg-tools', sg.tools);
            renderProficiencyList('zl-sg-soft', sg.soft_skills);
            renderVelocityIndex(sg.velocity_index, data.repos_summary, data.languages);
            renderRadar(sg.radar);
        } catch (err) {
            console.error('[ZeroLabs] skill_graph failed:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
