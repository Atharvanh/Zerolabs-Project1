// audit.js
// Renders the 360 Audit page.
// Supports three modes (via ?mode= query param):
//   - profile (default) — full-profile 360 audit
//   - repo — single-repo deep audit
//   - url — live URL stack scan

(function () {
    const EVIDENCE_STYLES = {
        strong: 'bg-tertiary/15 text-tertiary border-tertiary/30',
        some: 'bg-primary/15 text-primary border-primary/30',
        none: 'bg-error/10 text-error border-error/30'
    };

    const SEVERITY_STYLES = {
        blocker: 'bg-error/10 text-error border-error/30',
        major: 'bg-secondary/10 text-secondary border-secondary/30',
        minor: 'bg-tertiary/10 text-tertiary border-tertiary/30'
    };

    const CONTRADICTION_STYLES = {
        high: 'bg-error/10 text-error border-error/30',
        medium: 'bg-secondary/10 text-secondary border-secondary/30',
        low: 'bg-surface-container-low text-on-surface-variant ghost-border'
    };

    function $(id) { return document.getElementById(id); }

    function getMode() {
        const params = new URLSearchParams(window.location.search);
        return params.get('mode') || 'profile';
    }

    function getRepoParams() {
        const params = new URLSearchParams(window.location.search);
        return { owner: params.get('owner') || '', repo: params.get('repo') || '' };
    }

    function getUrlParam() {
        const params = new URLSearchParams(window.location.search);
        return params.get('url') || '';
    }

    function showLoading() {
        $('zl-audit-loading')?.classList.remove('hidden');
        $('zl-audit-error')?.classList.add('hidden');
        $('zl-audit-report')?.classList.add('hidden');
    }

    function showError(message) {
        const errBox = $('zl-audit-error');
        const msg = $('zl-audit-error-msg');
        if (msg) msg.textContent = message || 'Audit failed. Please try again.';
        errBox?.classList.remove('hidden');
        $('zl-audit-loading')?.classList.add('hidden');
        $('zl-audit-report')?.classList.add('hidden');
    }

    function showReport() {
        $('zl-audit-loading')?.classList.add('hidden');
        $('zl-audit-error')?.classList.add('hidden');
        $('zl-audit-report')?.classList.remove('hidden');
    }

    function renderVerdict(verdict) {
        const host = $('zl-audit-verdict');
        if (!host || !verdict) return;
        const level = ZL.escapeHtml(verdict.level || '--').toUpperCase();
        const confidence = Math.max(0, Math.min(100, verdict.confidence ?? 0));
        host.innerHTML = `
            <div class="flex flex-col md:flex-row gap-6 md:items-center">
                <div class="bg-surface-container-lowest rounded-lg p-4 ghost-border min-w-[180px]">
                    <div class="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">Verdict</div>
                    <div class="text-3xl font-bold text-on-surface mt-2">${level}</div>
                    <div class="text-xs text-on-surface-variant mt-2">Confidence: ${confidence}%</div>
                    <div class="w-full bg-surface-variant h-1 mt-3 rounded-full overflow-hidden">
                        <div class="bg-gradient-to-r from-tertiary to-primary h-full" style="width: ${confidence}%"></div>
                    </div>
                </div>
                <div class="flex-1">
                    <div class="text-lg font-semibold text-on-surface mb-2">${ZL.escapeHtml(verdict.one_line || '')}</div>
                    <p class="text-sm text-on-surface-variant leading-relaxed">${ZL.escapeHtml(verdict.reasoning || '')}</p>
                </div>
            </div>`;
    }

    function renderClaimedSkills(list) {
        const host = $('zl-audit-skills');
        if (!host) return;
        host.innerHTML = '';
        (list || []).forEach(item => {
            const evidence = String(item.evidence || 'none').toLowerCase();
            const tone = EVIDENCE_STYLES[evidence] || EVIDENCE_STYLES.none;
            const card = document.createElement('div');
            card.className = 'glass-card p-4 rounded-lg ghost-border';
            card.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-semibold text-on-surface">${ZL.escapeHtml(item.skill || '')}</span>
                    <span class="px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-widest ${tone}">${ZL.escapeHtml(evidence)}</span>
                </div>
                <p class="text-xs text-on-surface-variant">${ZL.escapeHtml(item.note || '')}</p>`;
            host.appendChild(card);
        });
        if (!host.children.length) {
            host.innerHTML = '<div class="text-xs text-on-surface-variant">No claimed skills extracted.</div>';
        }
    }

    function renderContradictions(list) {
        const host = $('zl-audit-contradictions');
        if (!host) return;
        host.innerHTML = '';
        (list || []).forEach(item => {
            const severity = String(item.severity || 'low').toLowerCase();
            const tone = CONTRADICTION_STYLES[severity] || CONTRADICTION_STYLES.low;
            const card = document.createElement('div');
            card.className = `glass-card p-4 rounded-lg border ${tone}`;
            card.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold uppercase tracking-[0.2em]">${ZL.escapeHtml(severity)}</span>
                </div>
                <p class="text-xs text-on-surface">${ZL.escapeHtml(item.claim || '')}</p>
                <p class="text-xs text-on-surface-variant mt-2">${ZL.escapeHtml(item.reality || '')}</p>`;
            host.appendChild(card);
        });
        if (!host.children.length) {
            host.innerHTML = '<div class="text-xs text-on-surface-variant">No contradictions found.</div>';
        }
    }

    function renderCodeReview(list) {
        const host = $('zl-audit-review');
        if (!host) return;
        host.innerHTML = '';
        (list || []).forEach((item, idx) => {
            const severity = String(item.severity || 'minor').toLowerCase();
            const tone = SEVERITY_STYLES[severity] || SEVERITY_STYLES.minor;
            const card = document.createElement('div');
            card.className = 'glass-card p-5 rounded-lg ghost-border';
            card.innerHTML = `
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="text-sm font-semibold text-on-surface">${ZL.escapeHtml(item.repo || '')}</div>
                        <div class="text-[11px] text-on-surface-variant font-mono">${ZL.escapeHtml(item.file || '')}</div>
                    </div>
                    <button type="button" class="px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-widest ${tone}" data-toggle="${idx}">${ZL.escapeHtml(severity)}</button>
                </div>
                <div class="mt-3 text-xs text-on-surface-variant">${ZL.escapeHtml(item.issue || '')}</div>
                <div class="mt-4 hidden" data-detail="${idx}">
                    <div class="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-2">Specific Fix</div>
                    <pre class="text-[11px] font-mono text-on-surface-variant whitespace-pre-wrap">${ZL.escapeHtml(item.specific_fix || '')}</pre>
                    <div class="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mt-3 mb-2">Why Senior Rejects</div>
                    <p class="text-[11px] text-on-surface-variant">${ZL.escapeHtml(item.why_senior_rejects || '')}</p>
                </div>`;
            host.appendChild(card);
        });

        host.querySelectorAll('[data-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-toggle');
                const detail = host.querySelector(`[data-detail="${key}"]`);
                if (!detail) return;
                detail.classList.toggle('hidden');
            });
        });

        if (!host.children.length) {
            host.innerHTML = '<div class="text-xs text-on-surface-variant">No code review findings returned.</div>';
        }
    }

    function renderStrengths(list) {
        const host = $('zl-audit-strengths');
        if (!host) return;
        host.innerHTML = '';
        (list || []).forEach(item => {
            const card = document.createElement('div');
            card.className = 'glass-card p-4 rounded-lg ghost-border';
            card.innerHTML = `
                <div class="text-sm font-semibold text-on-surface mb-2">${ZL.escapeHtml(item.title || '')}</div>
                <p class="text-xs text-on-surface-variant">${ZL.escapeHtml(item.evidence || '')}</p>`;
            host.appendChild(card);
        });
        if (!host.children.length) {
            host.innerHTML = '<div class="text-xs text-on-surface-variant">No strengths highlighted.</div>';
        }
    }

    function renderElevation(list) {
        const host = $('zl-audit-elevation');
        if (!host) return;
        host.innerHTML = '';
        (list || []).forEach((item, i) => {
            const li = document.createElement('li');
            li.className = 'glass-card p-4 rounded-lg ghost-border text-sm text-on-surface-variant flex items-start gap-3';
            li.innerHTML = `
                <span class="text-xs font-bold text-tertiary mt-1">${String(i + 1).padStart(2, '0')}</span>
                <span>${ZL.escapeHtml(item)}</span>`;
            host.appendChild(li);
        });
        if (!host.children.length) {
            host.innerHTML = '<li class="text-xs text-on-surface-variant">No elevation path returned.</li>';
        }
    }

    function renderRedFlags(flags) {
        const host = $('zl-audit-red-flags');
        if (!host) return;
        host.innerHTML = '';
        const severityStyle = {
            critical: 'bg-error/10 text-error border-error/30',
            major: 'bg-secondary/10 text-secondary border-secondary/30',
            minor: 'bg-tertiary/10 text-tertiary border-tertiary/30'
        };
        (flags || []).forEach(f => {
            const style = severityStyle[f.severity] || severityStyle.minor;
            const card = document.createElement('div');
            card.className = 'glass-card p-4 rounded-lg ghost-border';
            card.innerHTML = `
                <div class="flex items-center gap-3 mb-2">
                    <span class="material-symbols-outlined text-error text-base">warning</span>
                    <span class="text-sm font-semibold text-on-surface">${ZL.escapeHtml(f.pattern)}</span>
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${style}">${ZL.escapeHtml(f.severity)}</span>
                    <span class="text-[10px] text-on-surface-variant font-mono ml-auto">${ZL.escapeHtml(f.repo)}</span>
                </div>
                <p class="text-xs text-on-surface-variant leading-relaxed ml-7">${ZL.escapeHtml(f.blast_radius)}</p>`;
            host.appendChild(card);
        });
        if (!host.children.length) {
            host.innerHTML = '<p class="text-xs text-on-surface-variant">No red flags detected — clean code.</p>';
        }
    }

    function renderFiles(sampled) {
        const host = $('zl-audit-files');
        if (!host) return;
        host.innerHTML = '';
        (sampled || []).forEach(repo => {
            (repo.files || []).forEach(file => {
                const li = document.createElement('li');
                li.textContent = `${repo.name}/${file.path}`;
                host.appendChild(li);
            });
        });
        if (!host.children.length) {
            host.innerHTML = '<li>No files sampled.</li>';
        }
    }

    /** Render the URL scan details section (only for mode=url) */
    function renderUrlScan(data) {
        const section = $('zl-audit-url-scan');
        if (!section) return;
        section.classList.remove('hidden');

        const stack = data.stack_detected || {};
        const metrics = data.surface_metrics || {};
        const frameworks = (stack.frameworks || []).map(f => ZL.escapeHtml(f));
        const indicators = (stack.indicators || []).map(i => ZL.escapeHtml(i));
        const meta = stack.meta || {};

        section.innerHTML = `
            <!-- Limited evidence banner -->
            <div class="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/10 border border-secondary/20 mb-6">
                <span class="material-symbols-outlined text-secondary text-xl">link</span>
                <div>
                    <div class="text-sm font-semibold text-secondary">Live URL Scan · Limited Evidence</div>
                    <div class="text-xs text-on-surface-variant">We scanned the deployed HTML&hairsp;—&hairsp;server-side architecture, database design, and backend code are invisible from this vantage point.</div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Stack detected -->
                <div class="glass-card p-5 rounded-lg ghost-border">
                    <h3 class="text-xs font-bold uppercase text-on-surface-variant mb-4 tracking-widest flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm text-primary">layers</span>
                        Detected Stack
                    </h3>
                    ${frameworks.length
                        ? `<div class="flex flex-wrap gap-2 mb-4">${frameworks.map(f =>
                            `<span class="px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold border border-primary/20">${f}</span>`
                        ).join('')}</div>`
                        : '<div class="text-xs text-on-surface-variant mb-4">No frameworks detected from the HTML.</div>'
                    }
                    ${meta.title ? `<div class="text-xs text-on-surface-variant"><span class="font-semibold text-on-surface">Title:</span> ${ZL.escapeHtml(meta.title)}</div>` : ''}
                    ${meta.generator ? `<div class="text-xs text-on-surface-variant mt-1"><span class="font-semibold text-on-surface">Generator:</span> ${ZL.escapeHtml(meta.generator)}</div>` : ''}
                    ${meta.server ? `<div class="text-xs text-on-surface-variant mt-1"><span class="font-semibold text-on-surface">Server:</span> ${ZL.escapeHtml(meta.server)}</div>` : ''}
                    ${meta.powered_by ? `<div class="text-xs text-on-surface-variant mt-1"><span class="font-semibold text-on-surface">Powered by:</span> ${ZL.escapeHtml(meta.powered_by)}</div>` : ''}
                </div>

                <!-- Surface metrics -->
                <div class="glass-card p-5 rounded-lg ghost-border">
                    <h3 class="text-xs font-bold uppercase text-on-surface-variant mb-4 tracking-widest flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm text-tertiary">speed</span>
                        Surface Metrics
                    </h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <div class="text-2xl font-bold text-on-surface">${metrics.response_time_ms || '--'}<span class="text-xs font-normal text-on-surface-variant">ms</span></div>
                            <div class="text-[10px] uppercase tracking-widest text-on-surface-variant">Response Time</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold text-on-surface">${metrics.content_length_kb || '--'}<span class="text-xs font-normal text-on-surface-variant">KB</span></div>
                            <div class="text-[10px] uppercase tracking-widest text-on-surface-variant">Page Size</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold ${metrics.has_ssl ? 'text-tertiary' : 'text-error'}">${metrics.has_ssl ? '✓ SSL' : '✗ No SSL'}</div>
                            <div class="text-[10px] uppercase tracking-widest text-on-surface-variant">HTTPS</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold text-on-surface">${metrics.status_code || '--'}</div>
                            <div class="text-[10px] uppercase tracking-widest text-on-surface-variant">Status</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quality indicators -->
            ${indicators.length ? `
            <div class="mt-4 glass-card p-5 rounded-lg ghost-border">
                <h3 class="text-xs font-bold uppercase text-on-surface-variant mb-3 tracking-widest">Quality Indicators</h3>
                <div class="flex flex-wrap gap-2">
                    ${indicators.map(ind => {
                        const isWarning = ind.startsWith('⚠');
                        return `<span class="px-2 py-1 rounded text-[11px] font-medium ${isWarning ? 'bg-error/10 text-error border border-error/20' : 'bg-tertiary/10 text-tertiary border border-tertiary/20'}">${ind}</span>`;
                    }).join('')}
                </div>
            </div>` : ''}
        `;
    }

    /** Render repo metadata badge (only for mode=repo) */
    function renderRepoMeta(repoMeta) {
        const section = $('zl-audit-repo-meta');
        if (!section || !repoMeta) return;
        section.classList.remove('hidden');

        section.innerHTML = `
            <div class="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 mb-6">
                <span class="material-symbols-outlined text-primary text-xl">folder_open</span>
                <div class="flex-1">
                    <div class="text-sm font-semibold text-primary">Single Repository Audit</div>
                    <div class="text-xs text-on-surface-variant">
                        <a href="${ZL.escapeHtml(repoMeta.html_url || '')}" target="_blank" rel="noopener" class="hover:text-primary transition-colors">${ZL.escapeHtml(repoMeta.full_name || '')}</a>
                        ${repoMeta.language ? ` · ${ZL.escapeHtml(repoMeta.language)}` : ''}
                        ${repoMeta.stars ? ` · ⭐ ${repoMeta.stars}` : ''}
                        ${repoMeta.description ? ` — ${ZL.escapeHtml(repoMeta.description)}` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function applySidebar(profile, analysis) {
        const sideName = $('zl-sidebar-name');
        const sideVel = $('zl-sidebar-velocity');
        if (sideName) sideName.textContent = profile?.name || profile?.login || 'Developer Intelligence';
        if (sideVel) {
            const velocity = analysis?.analysis?.dashboard?.velocity?.score;
            sideVel.textContent = velocity != null ? `Career Velocity: ${velocity}%` : 'Career Velocity: --';
        }
    }

    async function init() {
        const mode = getMode();

        if (mode === 'url') {
            // --- URL scan mode ---
            const url = getUrlParam();
            if (!url) { window.location.href = 'index.html'; return; }
            showLoading();

            // Update loading text
            const loadingTitle = document.querySelector('#zl-audit-loading h1');
            if (loadingTitle) loadingTitle.textContent = 'Scanning live URL';
            const loadingDesc = document.querySelector('#zl-audit-loading p');
            if (loadingDesc) loadingDesc.innerHTML = `Fetching <strong>${ZL.escapeHtml(new URL(url).hostname)}</strong>, detecting stack, and running AI analysis.<br>This usually takes 10–30 seconds.`;

            try {
                const auditData = await ZL.fetchUrlAudit(url);
                const report = auditData?.analysis;

                const sub = $('zl-audit-sub');
                const header = document.querySelector('#zl-audit-report h1');
                if (header) header.textContent = 'URL Stack Audit';
                if (sub) sub.textContent = `Scanning ${ZL.escapeHtml(new URL(url).hostname)} for stack signals and engineering quality.`;

                renderUrlScan(auditData);
                renderVerdict(report?.verdict);
                renderClaimedSkills(report?.claim_vs_actual?.claimed_skills);
                renderContradictions(report?.claim_vs_actual?.contradictions);
                renderCodeReview(report?.code_review);
                renderStrengths(report?.strengths);
                renderElevation(report?.elevation_path);
                renderRedFlags(report?.technical_red_flags);

                // Hide files-sampled section for URL mode
                const filesSection = $('zl-audit-files')?.closest('section');
                if (filesSection) filesSection.classList.add('hidden');

                showReport();
            } catch (err) {
                console.error('[ZeroLabs] URL audit failed:', err);
                showError((err && err.message) || 'URL scan failed. Please try again.');
            }

        } else if (mode === 'repo') {
            // --- Single-repo audit mode ---
            const { owner, repo } = getRepoParams();
            if (!owner || !repo) { window.location.href = 'index.html'; return; }
            showLoading();

            const loadingTitle = document.querySelector('#zl-audit-loading h1');
            if (loadingTitle) loadingTitle.textContent = 'Deep auditing repository';
            const loadingDesc = document.querySelector('#zl-audit-loading p');
            if (loadingDesc) loadingDesc.innerHTML = `Reading files from <strong>${ZL.escapeHtml(owner)}/${ZL.escapeHtml(repo)}</strong> and running staff-level code review.<br>This usually takes 20–60 seconds.`;

            try {
                const auditData = await ZL.fetchRepoAudit(owner, repo);
                const report = auditData?.analysis;
                const claim = (auditData?.claim || '').trim();
                const sub = $('zl-audit-sub');
                if (sub) {
                    sub.textContent = claim
                        ? `Claim: ${claim.length > 220 ? claim.slice(0, 220) + '...' : claim}`
                        : `Deep audit of ${owner}/${repo} — reading real source files.`;
                }

                if (auditData.profile) {
                    ZL.applyProfile(auditData.profile);
                }
                applySidebar(auditData.profile);
                renderRepoMeta(auditData.repo_meta);
                renderVerdict(report?.verdict);
                renderClaimedSkills(report?.claim_vs_actual?.claimed_skills);
                renderContradictions(report?.claim_vs_actual?.contradictions);
                renderCodeReview(report?.code_review);
                renderStrengths(report?.strengths);
                renderElevation(report?.elevation_path);
                renderRedFlags(report?.technical_red_flags);
                renderFiles(auditData?.repos_sampled);

                showReport();
            } catch (err) {
                console.error('[ZeroLabs] repo audit failed:', err);
                const msg = err && err.status === 404
                    ? `Repository "${owner}/${repo}" not found.`
                    : (err && err.message) || 'Audit failed. Please try again.';
                showError(msg);
            }

        } else {
            // --- Default profile audit mode ---
            const username = ZL.getUsername();
            if (!username) { window.location.href = 'index.html'; return; }
            showLoading();
            try {
                const [auditData, analysisData] = await Promise.all([
                    ZL.fetchAudit(username),
                    ZL.fetchAnalysis(username).catch(() => null)
                ]);
                const report = auditData?.analysis;
                const claim = (auditData?.claim || '').trim();
                const sub = $('zl-audit-sub');
                if (sub) {
                    sub.textContent = claim
                        ? `Claim: ${claim.length > 220 ? claim.slice(0, 220) + '...' : claim}`
                        : 'Cross-referencing your stated experience against the code in your repos.';
                }

                ZL.applyProfile(auditData.profile);
                applySidebar(auditData.profile, analysisData);

                renderVerdict(report?.verdict);
                renderClaimedSkills(report?.claim_vs_actual?.claimed_skills);
                renderContradictions(report?.claim_vs_actual?.contradictions);
                renderCodeReview(report?.code_review);
                renderStrengths(report?.strengths);
                renderElevation(report?.elevation_path);
                renderRedFlags(report?.technical_red_flags);
                renderFiles(auditData?.repos_sampled);

                showReport();
            } catch (err) {
                console.error('[ZeroLabs] audit failed:', err);
                const msg = err && err.status === 404
                    ? `No GitHub user named "${username}".`
                    : (err && err.message) || 'Audit failed. Please try again.';
                showError(msg);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
