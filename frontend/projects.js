// projects.js
// Renders the Projects Analysis page.

(function () {
    const TONE_CLASS = {
        positive: 'bg-tertiary/10 text-tertiary border border-tertiary/20',
        warning: 'bg-error/10 text-error border border-error/20',
        neutral: 'bg-surface-container-lowest text-on-surface-variant ghost-border'
    };

    function scoreColor(score) {
        if (score >= 85) return 'text-tertiary';
        if (score >= 70) return 'text-primary';
        if (score >= 55) return 'text-secondary';
        return 'text-error';
    }

    function $(id) { return document.getElementById(id); }

    function renderFeatured(f) {
        const host = $('zl-project-featured');
        if (!host || !f) return;
        const score = Math.max(0, Math.min(100, f.score ?? 0));
        host.innerHTML = `
            <div class="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div class="flex flex-col md:flex-row justify-between gap-8 relative z-10">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="material-symbols-outlined text-tertiary">star</span>
                        <span class="text-xs font-bold text-tertiary uppercase tracking-widest">Featured Benchmark</span>
                    </div>
                    <h2 class="text-2xl font-semibold mb-2">
                        ${f.html_url ? `<a href="${ZL.escapeHtml(f.html_url)}" target="_blank" rel="noopener" class="hover:text-primary transition-colors">${ZL.escapeHtml(f.name)}</a>` : ZL.escapeHtml(f.name)}
                    </h2>
                    <p class="text-on-surface-variant text-sm mb-6 max-w-xl">${ZL.escapeHtml(f.description || '')}</p>
                    <div class="flex flex-wrap gap-2 mb-6">
                        <span class="px-3 py-1 bg-surface-container-highest rounded-full text-xs font-semibold text-on-surface ghost-border flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">code</span> ${ZL.escapeHtml(f.language || '--')}
                        </span>
                        ${(f.badges || []).map(b => `
                            <span class="px-3 py-1 bg-primary/10 rounded-full text-xs font-semibold text-primary border border-primary/20">${ZL.escapeHtml(b)}</span>
                        `).join('')}
                    </div>
                </div>
                <div class="flex flex-col items-center justify-center bg-surface-container-lowest p-6 rounded-lg ghost-border min-w-[200px]">
                    <div class="text-[3.5rem] font-bold text-primary mb-1 leading-none">${score}</div>
                    <div class="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Quality Score</div>
                    <div class="w-full bg-surface-variant h-1 mt-4 rounded-full overflow-hidden">
                        <div class="bg-gradient-to-r from-primary to-tertiary h-full" style="width: ${score}%"></div>
                    </div>
                </div>
            </div>`;
    }

    function renderCards(list) {
        const host = $('zl-project-grid');
        if (!host) return;
        host.innerHTML = '';
        (list || []).forEach(p => {
            const score = Math.max(0, Math.min(100, p.score ?? 0));
            const card = document.createElement('div');
            card.className = 'project-card bg-surface-container-low rounded-xl p-6 ghost-border hover:bg-surface-container-high transition-colors cursor-pointer group relative overflow-hidden';
            const nameNode = p.html_url
                ? `<a href="${ZL.escapeHtml(p.html_url)}" target="_blank" rel="noopener" class="hover:text-primary transition-colors">${ZL.escapeHtml(p.name)}</a>`
                : ZL.escapeHtml(p.name);
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-lg font-medium">${nameNode}</h3>
                    <div class="score-orb flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-highest ghost-border">
                        <span class="text-sm font-bold ${scoreColor(score)}">${score}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 text-on-surface-variant text-sm mb-6">
                    <span class="material-symbols-outlined text-[16px]">${ZL.escapeHtml(p.icon || 'code')}</span> ${ZL.escapeHtml(p.language || '--')}
                </div>
                <div class="flex flex-wrap gap-2">
                    ${(p.badges || []).map(b => {
                        const tone = TONE_CLASS[b.tone] || TONE_CLASS.neutral;
                        return `<span class="px-2 py-1 rounded text-[0.6875rem] font-semibold ${tone}">${ZL.escapeHtml(b.label)}</span>`;
                    }).join('')}
                </div>`;
            host.appendChild(card);
        });
    }

    async function init() {
        const username = ZL.getUsername();
        if (!username) { window.location.href = 'index.html'; return; }
        try {
            const data = await ZL.fetchAnalysis(username);
            ZL.applyProfile(data.profile);
            const p = data.analysis.projects;

            const sideName = document.getElementById('zl-sidebar-name');
            const sideVel = document.getElementById('zl-sidebar-velocity');
            const sub = document.getElementById('zl-projects-sub');
            if (sideName) sideName.textContent = data.profile.name || data.profile.login;
            if (sideVel) sideVel.textContent = `Career Velocity: ${data.analysis.dashboard.velocity.score}%`;
            if (sub) sub.textContent = `Evaluating architectural integrity across ${data.repos_summary.total} repositories.`;

            renderFeatured(p.featured);
            renderCards(p.list);
        } catch (err) {
            console.error('[ZeroLabs] projects failed:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
