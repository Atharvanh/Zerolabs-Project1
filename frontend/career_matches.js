// career_matches.js
// Renders the Career Matches page.
// Phase 5: Now uses the real matching engine (/api/career/matches/:username)
// instead of AI-fabricated roles from the analyze endpoint.

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

    function levelBadge(level) {
        const config = {
            junior: 'bg-tertiary/10 text-tertiary border-tertiary/20',
            mid: 'bg-primary/10 text-primary border-primary/20',
            senior: 'bg-secondary/10 text-secondary border-secondary/20',
            staff: 'bg-error/10 text-error border-error/20'
        };
        return config[level] || config.mid;
    }

    function renderQueue(matches, onSelect) {
        const host = $('zl-matches-queue');
        const count = $('zl-matches-count');
        if (count) count.textContent = `${(matches || []).length} ROLES MATCHED`;
        if (!host) return;
        host.innerHTML = '';
        (matches || []).forEach((m, i) => {
            const match = Math.max(0, Math.min(100, m.match ?? 0));
            const selected = i === 0;
            const wrapperCls = selected
                ? 'p-4 rounded-xl border border-primary/50 bg-primary/5 relative cursor-pointer group zl-match-item'
                : 'p-4 rounded-xl border border-outline-variant/10 hover:border-outline-variant/30 transition-all cursor-pointer group bg-surface-container interactive-card zl-match-item';
            const card = document.createElement('article');
            card.className = wrapperCls;
            card.dataset.index = String(i);
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
                <div class="flex items-center gap-2 mt-2">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${levelBadge(m.level)}">${ZL.escapeHtml(m.level || '')}</span>
                    <span class="text-[9px] text-on-surface-variant">${ZL.escapeHtml(m.salary || '')}</span>
                </div>
                <div class="mt-3 flex gap-1">
                    <div class="h-1 flex-1 bg-surface-container-highest rounded-full overflow-hidden interactive-card">
                        <div class="h-full bg-tertiary" style="width: ${match}%"></div>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => onSelect(i));
            host.appendChild(card);
        });
    }

    function highlightQueueItem(index) {
        document.querySelectorAll('.zl-match-item').forEach((el, i) => {
            if (i === index) {
                el.className = el.className
                    .replace(/border-outline-variant\/10/, 'border-primary/50')
                    .replace(/bg-surface-container/, 'bg-primary/5');
            } else {
                el.className = el.className
                    .replace(/border-primary\/50/, 'border-outline-variant/10')
                    .replace(/bg-primary\/5/, 'bg-surface-container');
            }
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

    function clearSkeleton() {
        const sk = $('zl-detail-skeleton');
        if (sk) sk.remove();
    }

    function renderDetail(f, corpusSize) {
        const host = $('zl-match-detail');
        if (!host || !f) return;
        clearSkeleton();
        const match = Math.max(0, Math.min(100, f.match ?? 0));
        const skills = (f.required_skills || []).map(skillPill).join('');
        const gaps = (f.gaps || []).map(gapCells).join('');
        host.innerHTML = `
            <header class="p-8 md:p-12 border-b border-outline-variant/20 bg-surface-container-lowest/30 interactive-card">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div class="space-y-4">
                        <div class="flex items-center gap-4">
                            <span class="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded border border-tertiary/20 uppercase tracking-widest">${ZL.escapeHtml(affinityLabel(match))}</span>
                            <span class="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded border border-primary/20 uppercase tracking-widest">${ZL.escapeHtml(f.level || 'mid')}</span>
                            ${f.source === 'jsearch' ? '<span class="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] font-bold rounded border border-green-500/20 uppercase tracking-widest">🔴 Live Job</span>' : ''}
                            <span class="text-on-surface-variant text-[10px] font-mono">Matched from ${corpusSize || '24'} postings</span>
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
                            <p class="text-sm text-on-surface-variant mb-6">Your profile matches the core requirements for ${ZL.escapeHtml(f.company || 'this role')}. Generate a tailored resume that highlights the skills flagged above.</p>
                            ${f.apply_link ? `<a href="${ZL.escapeHtml(f.apply_link)}" target="_blank" rel="noopener" class="btn-primary-glow w-full py-4 rounded-xl text-background font-black text-sm flex items-center justify-center gap-3 mb-3 no-underline">
                                <span class="material-symbols-outlined">open_in_new</span>
                                APPLY NOW
                            </a>` : ''}
                            <button class="btn-primary-glow w-full py-4 rounded-xl text-background font-black text-sm flex items-center justify-center gap-3${f.apply_link ? ' opacity-70' : ''}">
                                <span class="material-symbols-outlined">auto_awesome</span>
                                GENERATE RESUME FOR THIS ROLE
                            </button>
                        </div>
                    </div>
                </section>
                ${gaps ? `
                <section>
                    <div class="flex items-center gap-4 mb-6">
                        <h2 class="text-sm font-black uppercase tracking-[0.2em] text-primary">Gap Analysis</h2>
                        <div class="flex-1 h-px bg-outline-variant/20"></div>
                    </div>
                    <div class="spec-grid border border-outline-variant/20 rounded-xl overflow-hidden">${gaps}</div>
                </section>
                ` : ''}
            </div>`;
    }

    async function init() {
        const username = ZL.getUsername();
        if (!username) { window.location.href = 'index.html'; return; }

        try {
            // Fetch real matches + analysis (for sidebar velocity)
            const [careerData, analysisData] = await Promise.all([
                ZL.fetchCareerMatches(username),
                ZL.fetchAnalysis(username).catch(() => null)
            ]);

            if (careerData.profile) ZL.applyProfile(careerData.profile);
            const sideName = $('zl-sidebar-name');
            const sideVel = $('zl-sidebar-velocity');
            if (sideName) sideName.textContent = careerData.profile?.name || careerData.profile?.login || '';
            if (sideVel && analysisData) {
                sideVel.textContent = `Career Velocity: ${analysisData.analysis?.dashboard?.velocity?.score ?? '--'}%`;
            }

            const matches = careerData.matches || [];
            const featured = careerData.featured;
            const corpusSize = careerData.corpus_size;

            // Update footer source label
            const srcEl = $('zl-queue-source');
            if (srcEl) srcEl.textContent = `CORPUS: ${corpusSize || '--'}`;

            function makeBasicDetail(m) {
                return {
                    title: m.title,
                    company: m.company,
                    location: m.location,
                    salary: m.salary,
                    match: m.match,
                    affinity_grade: m.match >= 85 ? 'A' : m.match >= 70 ? 'B+' : m.match >= 55 ? 'B' : 'C+',
                    intelligence_brief: `${m.match > 0
                        ? `Matched ${m.match}% based on your demonstrated skills.`
                        : `This role requires skills not yet in your profile — a growth opportunity.`
                    } This ${m.level}-level ${m.category} role at ${m.company} is worth exploring.`,
                    required_skills: [],
                    gaps: [],
                    level: m.level,
                    category: m.category,
                    apply_link: m.apply_link || null,
                    source: m.source || 'static'
                };
            }

            function selectMatch(index) {
                highlightQueueItem(index);
                if (index === 0 && featured) {
                    renderDetail(featured, corpusSize);
                } else {
                    const m = matches[index];
                    if (!m) return;
                    renderDetail(makeBasicDetail(m), corpusSize);
                }
            }

            renderQueue(matches, selectMatch);
            // Show featured for top match; fall back to basic detail for index 0 if no featured
            if (featured) {
                renderDetail(featured, corpusSize);
            } else if (matches.length > 0) {
                renderDetail(makeBasicDetail(matches[0]), corpusSize);
            } else {
                clearSkeleton();
            }

        } catch (err) {
            console.error('[ZeroLabs] career_matches failed:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
