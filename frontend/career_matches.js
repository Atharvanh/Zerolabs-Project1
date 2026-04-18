// career_matches.js
// Renders the Career Matches page from the shared analysis payload.

(function () {
    const GAP_STATUS = {
        Owned: { icon: 'check_circle', color: 'text-tertiary' },
        Gap: { icon: 'trending_up', color: 'text-secondary' },
        Growing: { icon: 'trending_up', color: 'text-primary' }
    };

    function $(id) { return document.getElementById(id); }

    function scoreColor(score) {
        if (score >= 85) return 'text-tertiary';
        if (score >= 70) return 'text-primary';
        if (score >= 55) return 'text-secondary';
        return 'text-error';
    }

    function affinityLabel(score) {
        if (score >= 85) return 'High Affinity';
        if (score >= 70) return 'Strong Affinity';
        return 'Emerging';
    }

    function slugify(s) {
        return String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'UNKNOWN';
    }

    function renderQueue(matches) {
        const host = $('zl-matches-queue');
        const count = $('zl-matches-count');
        if (count) count.textContent = `${(matches || []).length} ROLES IDENTIFIED`;
        if (!host) return;
        host.innerHTML = '';
        (matches || []).forEach((m, i) => {
            const match = Math.max(0, Math.min(100, m.match ?? 0));
            const selected = i === 0;
            const wrapperCls = selected
                ? 'p-4 rounded-xl border border-primary/50 bg-primary/5 relative cursor-pointer group'
                : 'p-4 rounded-xl border border-outline-variant/10 hover:border-outline-variant/30 transition-all cursor-pointer group bg-surface-container interactive-card';
            const card = document.createElement('article');
            card.className = wrapperCls;
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="w-8 h-8 bg-surface-container-lowest rounded-md flex items-center justify-center border border-outline-variant/20 interactive-card">
                        <span class="text-sm font-bold">${ZL.escapeHtml((m.badge_letter || '?').slice(0, 1))}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-lg font-black ${scoreColor(match)}">${match}%</span>
                    </div>
                </div>
                <h3 class="font-bold text-sm text-on-surface truncate">${ZL.escapeHtml(m.title || '')}</h3>
                <p class="text-[10px] text-on-surface-variant font-medium">${ZL.escapeHtml(m.company || '')} • ${ZL.escapeHtml(m.location || '')}</p>
                <div class="mt-3 flex gap-1">
                    <div class="h-1 flex-1 bg-surface-container-highest rounded-full overflow-hidden interactive-card">
                        <div class="h-full bg-tertiary" style="width: ${match}%"></div>
                    </div>
                </div>
                ${selected ? `<div class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"><span class="material-symbols-outlined text-primary">chevron_right</span></div>` : ''}
            `;
            host.appendChild(card);
        });
    }

    function skillPill(s) {
        const tone = s.owned ? 'text-primary' : 'text-on-surface-variant';
        return `<span class="px-3 py-1.5 bg-surface-container-highest rounded-md text-xs font-bold ${tone} border border-outline-variant/30 uppercase interactive-card">${ZL.escapeHtml(s.name || '')}</span>`;
    }

    function gapCells(g) {
        const conf = GAP_STATUS[g.status] || { icon: 'help', color: 'text-on-surface-variant' };
        return `
            <div class="spec-item">
                <span class="block text-[10px] text-on-surface-variant font-bold uppercase mb-1">Skill Set</span>
                <span class="block font-bold text-sm">${ZL.escapeHtml(g.skill || '')}</span>
            </div>
            <div class="spec-item flex items-center gap-2">
                <span class="block text-[10px] text-on-surface-variant font-bold uppercase mr-auto">Status</span>
                <span class="${conf.color} material-symbols-outlined text-[18px]">${conf.icon}</span>
                <span class="text-xs font-bold uppercase ${conf.color}">${ZL.escapeHtml(g.status || '')}</span>
            </div>
            <div class="spec-item">
                <span class="block text-[10px] text-on-surface-variant font-bold uppercase mb-1">Acquisition</span>
                <span class="block text-xs font-mono">${ZL.escapeHtml(g.acquisition || '')}</span>
            </div>`;
    }

    function renderDetail(f) {
        const host = $('zl-match-detail');
        if (!host || !f) return;
        const match = Math.max(0, Math.min(100, f.match ?? 0));
        const skills = (f.required_skills || []).map(skillPill).join('');
        const gaps = (f.gaps || []).map(gapCells).join('');
        host.innerHTML = `
            <header class="p-8 md:p-12 border-b border-outline-variant/20 bg-surface-container-lowest/30 interactive-card">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div class="space-y-4">
                        <div class="flex items-center gap-4">
                            <span class="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded border border-tertiary/20 uppercase tracking-widest">${ZL.escapeHtml(affinityLabel(match))}</span>
                            <span class="text-on-surface-variant text-[10px] font-mono">ID: ROLE_${ZL.escapeHtml(slugify(f.company))}</span>
                        </div>
                        <h1 class="text-4xl md:text-6xl font-black text-on-surface tracking-tighter leading-none">${ZL.escapeHtml(f.title || '')}</h1>
                        <div class="flex flex-wrap items-center gap-6">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary text-sm">apartment</span>
                                <span class="text-sm font-semibold">${ZL.escapeHtml(f.company || '')}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary text-sm">location_on</span>
                                <span class="text-sm font-semibold">${ZL.escapeHtml(f.location || '')}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary text-sm">payments</span>
                                <span class="text-sm font-semibold">${ZL.escapeHtml(f.salary || '')}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="p-6 bg-surface-container rounded-2xl border border-outline-variant/20 flex flex-col items-center justify-center min-w-[120px] interactive-card">
                            <span class="text-4xl font-black ${scoreColor(match)}">${match}<span class="text-xl">%</span></span>
                            <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">Match Score</span>
                        </div>
                        <div class="p-6 bg-surface-container rounded-2xl border border-outline-variant/20 flex flex-col items-center justify-center min-w-[120px] interactive-card">
                            <span class="text-4xl font-black text-secondary">${ZL.escapeHtml(f.affinity_grade || '--')}</span>
                            <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">Role Affinity</span>
                        </div>
                    </div>
                </div>
            </header>
            <div class="p-8 md:p-12 space-y-12">
                <section>
                    <div class="flex items-center gap-4 mb-6">
                        <h2 class="text-sm font-black uppercase tracking-[0.2em] text-primary">Intelligence Brief</h2>
                        <div class="flex-1 h-px bg-outline-variant/20"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div class="space-y-6">
                            <p class="text-lg text-on-surface leading-relaxed font-medium">${ZL.escapeHtml(f.intelligence_brief || '')}</p>
                            <div class="flex flex-wrap gap-2">${skills}</div>
                        </div>
                        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 interactive-card">
                            <h3 class="text-xs font-bold text-on-surface-variant uppercase mb-4 tracking-widest">Recommended Action</h3>
                            <p class="text-sm text-on-surface-variant mb-6">Your profile matches the core architectural requirements for ${ZL.escapeHtml(f.company || 'this role')}. Generate a tailored resume that highlights the skills flagged above.</p>
                            <button class="btn-primary-glow w-full py-4 rounded-xl text-background font-black text-sm flex items-center justify-center gap-3">
                                <span class="material-symbols-outlined">auto_awesome</span>
                                GENERATE RESUME FOR THIS ROLE
                            </button>
                        </div>
                    </div>
                </section>
                <section>
                    <div class="flex items-center gap-4 mb-6">
                        <h2 class="text-sm font-black uppercase tracking-[0.2em] text-primary">Gap Analysis</h2>
                        <div class="flex-1 h-px bg-outline-variant/20"></div>
                    </div>
                    <div class="spec-grid border border-outline-variant/20 rounded-xl overflow-hidden">${gaps}</div>
                </section>
            </div>`;
    }

    async function init() {
        const username = ZL.getUsername();
        if (!username) { window.location.href = 'index.html'; return; }
        try {
            const data = await ZL.fetchAnalysis(username);
            ZL.applyProfile(data.profile);
            const sideName = $('zl-sidebar-name');
            const sideVel = $('zl-sidebar-velocity');
            if (sideName) sideName.textContent = data.profile.name || data.profile.login;
            if (sideVel) sideVel.textContent = `Career Velocity: ${data.analysis.dashboard.velocity.score}%`;
            const cm = data.analysis.career_matches;
            renderQueue(cm.matches);
            renderDetail(cm.featured);
        } catch (err) {
            console.error('[ZeroLabs] career_matches failed:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
