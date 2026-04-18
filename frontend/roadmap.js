// roadmap.js
// Renders the 90-Day Roadmap page from the shared analysis payload.

(function () {
    const STATUS_STYLE = {
        in_progress: {
            orbBg: 'bg-surface-container-high',
            orbBorder: 'border-primary',
            orbShadow: 'shadow-[0_0_15px_rgba(173,198,255,0.2)]',
            icon: 'check_circle',
            iconColor: 'text-primary',
            iconFilled: true,
            bodyOpacity: '',
            pill: `<span class="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20 inline-flex items-center w-fit">In Progress</span>`
        },
        upcoming: {
            orbBg: 'bg-surface-container-lowest',
            orbBorder: 'border-outline-variant/50',
            orbShadow: '',
            icon: 'lock',
            iconColor: 'text-outline-variant',
            iconFilled: false,
            bodyOpacity: 'opacity-60',
            pill: `<span class="px-3 py-1 bg-surface-container text-on-surface-variant text-xs font-semibold rounded-full border border-outline-variant/20 inline-flex items-center w-fit interactive-card">Upcoming</span>`
        },
        locked: {
            orbBg: 'bg-surface-container-lowest',
            orbBorder: 'border-outline-variant/50',
            orbShadow: '',
            icon: 'lock',
            iconColor: 'text-outline-variant',
            iconFilled: false,
            bodyOpacity: 'opacity-40',
            pill: ''
        }
    };

    function $(id) { return document.getElementById(id); }

    function taskCard(task, status) {
        const hours = Number.isFinite(task.hours) ? task.hours : 0;
        if (status === 'in_progress') {
            const toggleIcon = task.done ? 'toggle_on' : 'toggle_off';
            const toggleColor = task.done ? 'text-primary' : 'text-outline-variant';
            const toggleFill = task.done ? `style="font-variation-settings: 'FILL' 1;"` : '';
            return `
                <div class="glass-card p-5 rounded-lg hover:bg-surface-container-high transition-colors group cursor-pointer relative overflow-hidden interactive-card">
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div class="relative z-10">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="text-base font-medium text-on-surface group-hover:text-primary transition-colors">${ZL.escapeHtml(task.title)}</h3>
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-on-surface-variant bg-surface px-2 py-1 rounded border border-outline-variant/20">${hours}h</span>
                                <button class="${toggleColor} transition-colors">
                                    <span class="material-symbols-outlined" ${toggleFill}>${toggleIcon}</span>
                                </button>
                            </div>
                        </div>
                        <p class="text-sm text-on-surface-variant line-clamp-2">${ZL.escapeHtml(task.description || '')}</p>
                    </div>
                </div>`;
        }
        return `
            <div class="bg-surface-container-low p-5 rounded-lg border border-outline-variant/10 interactive-card">
                <div class="flex justify-between items-start mb-3">
                    <h3 class="text-base font-medium text-on-surface">${ZL.escapeHtml(task.title)}</h3>
                    <span class="text-xs text-on-surface-variant bg-surface px-2 py-1 rounded border border-outline-variant/20">${hours}h</span>
                </div>
                <p class="text-sm text-on-surface-variant">${ZL.escapeHtml(task.description || '')}</p>
            </div>`;
    }

    function monthBlock(m) {
        const style = STATUS_STYLE[m.status] || STATUS_STYLE.locked;
        const iconFill = style.iconFilled ? `style="font-variation-settings: 'FILL' 1;"` : '';
        const tasks = (m.tasks || []).map(t => taskCard(t, m.status)).join('');
        const monthNum = m.month || '';
        return `
            <div class="relative">
                <div class="absolute -left-5 md:-left-9 top-0 w-10 h-10 rounded-full ${style.orbBg} border-2 ${style.orbBorder} flex items-center justify-center z-10 ${style.orbShadow} interactive-card">
                    <span class="material-symbols-outlined ${style.iconColor} text-sm" ${iconFill}>${style.icon}</span>
                </div>
                <div class="ml-6 md:ml-10 ${style.bodyOpacity}">
                    <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-2">
                        <div>
                            <h2 class="text-2xl font-semibold text-on-surface">Month ${ZL.escapeHtml(monthNum)}: ${ZL.escapeHtml(m.title || '')}</h2>
                            <p class="text-sm text-on-surface-variant mt-1">${ZL.escapeHtml(m.focus || '')}</p>
                        </div>
                        ${style.pill}
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${tasks}</div>
                </div>
            </div>`;
    }

    function renderRoadmap(r) {
        if (!r) return;
        const progress = Math.max(0, Math.min(100, r.overall_progress ?? 0));
        const title = $('zl-roadmap-title');
        if (title) title.textContent = `${r.target_role || 'Career'} — 90-Day Roadmap`;
        const sub = $('zl-roadmap-sub');
        if (sub) sub.textContent = r.subtitle || '';
        const prog = $('zl-roadmap-progress');
        if (prog) prog.textContent = `${progress}%`;
        const eta = $('zl-roadmap-eta');
        if (eta) eta.textContent = r.est_completion || '--';
        const bar = $('zl-roadmap-bar');
        if (bar) bar.style.width = `${progress}%`;

        const host = $('zl-roadmap-months');
        if (host) host.innerHTML = (r.months || []).map(monthBlock).join('');
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
            renderRoadmap(data.analysis.roadmap);
        } catch (err) {
            console.error('[ZeroLabs] roadmap failed:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
