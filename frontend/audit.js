// audit.js
// Renders the 360 Audit page from the audit endpoint.

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

    document.addEventListener('DOMContentLoaded', init);
})();
