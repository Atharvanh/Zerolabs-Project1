/* ═══════════════════════════════════════════════════════════
   ZeroLabs — transitions.js
   SPA-style page transitions, brutalist loading overlay,
   toast notification system.
   Attach to EVERY HTML page (via <script src="transitions.js">).
═══════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ── Constants ────────────────────────────────────────────
    const TRANSITION_EXIT_MS  = 450;   // time for exit slat animation
    const TRANSITION_ENTER_MS = 500;   // time for enter slat animation
    const LOADING_MESSAGES = [
        'Cloning repository graph…',
        'Scanning commit velocity…',
        'Analyzing naming conventions…',
        'Measuring code entropy…',
        'Parsing dependency trees…',
        'Evaluating test coverage…',
        'Mapping skill topography…',
        'Calculating career vectors…',
        'Cross-referencing industry data…',
        'Generating intelligence report…',
    ];

    // ── DOM Injection ────────────────────────────────────────

    /**
     * Builds the page-transition overlay (3 slats) and appends
     * it to <body>. Also builds the toast container.
     */
    function injectTransitionOverlay() {
        // -- Transition slats
        const overlay = document.createElement('div');
        overlay.id = 'zl-transition-overlay';
        overlay.innerHTML = `
            <div class="zl-slat zl-slat--3"></div>
            <div class="zl-slat zl-slat--2"></div>
            <div class="zl-slat zl-slat--1"></div>
        `;
        document.body.appendChild(overlay);

        // -- Toast container
        if (!document.getElementById('zl-toast-container')) {
            const tc = document.createElement('div');
            tc.id = 'zl-toast-container';
            document.body.appendChild(tc);
        }
    }

    /**
     * Builds the brutalist loading overlay (only on index.html)
     */
    function injectLoadingOverlay() {
        if (document.getElementById('zl-loading-overlay')) return;
        const lo = document.createElement('div');
        lo.id = 'zl-loading-overlay';
        lo.innerHTML = `
            <div class="zl-loading-inner">
                <div class="zl-loading-logo">
                    <span class="zl-accent">⚡</span> ZeroLabs
                </div>
                <div class="zl-loading-frame">
                    <div class="zl-loading-frame-corners"></div>
                    <div class="zl-loading-status" id="zl-loading-text">
                        Initializing…
                    </div>
                    <div class="zl-loading-progress-track">
                        <div class="zl-loading-progress-bar" id="zl-loading-bar"></div>
                    </div>
                    <div class="zl-loading-counter" id="zl-loading-counter">0 / ${LOADING_MESSAGES.length}</div>
                </div>
            </div>
        `;
        document.body.appendChild(lo);
    }


    // ═══════════════════════════════════════════════════════════
    //  1. Smooth Page Transitions
    // ═══════════════════════════════════════════════════════════

    /**
     * Plays the EXIT animation (slats cover the page),
     * waits for it, then navigates to `href`.
     */
    function navigateTo(href) {
        const overlay = document.getElementById('zl-transition-overlay');
        if (!overlay) { window.location.href = href; return; }

        overlay.className = 'zl-transition-exit';
        // pointer-events so user can't click anything during transition
        overlay.style.pointerEvents = 'all';

        setTimeout(() => {
            window.location.href = href;
        }, TRANSITION_EXIT_MS);
    }

    /**
     * On page load: if the overlay is present, play the ENTER
     * animation (slats reveal the page).
     */
    function playEnterTransition() {
        const overlay = document.getElementById('zl-transition-overlay');
        if (!overlay) return;

        // Start with slats covering the screen (enter state)
        overlay.className = 'zl-transition-enter';
        overlay.style.pointerEvents = 'all';

        setTimeout(() => {
            overlay.className = '';
            overlay.style.pointerEvents = 'none';
        }, TRANSITION_ENTER_MS);
    }

    /**
     * Intercepts <a> clicks that navigate to local .html pages.
     */
    function interceptLinks() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href) return;

            // Skip anchors (#), external links, javascript:, mailto: etc.
            if (
                href.startsWith('#') ||
                href.startsWith('javascript:') ||
                href.startsWith('mailto:') ||
                href.startsWith('tel:') ||
                link.target === '_blank' ||
                link.hasAttribute('data-no-transition')
            ) return;

            // Only intercept local navigation (same-origin .html files or relative paths)
            try {
                const url = new URL(href, window.location.origin);
                if (url.origin !== window.location.origin) return;
            } catch (_) {
                // relative path — fine to proceed
            }

            // Special case: the "Analyze Profile" button on index.html
            // is handled by the loading overlay system, not the normal transition.
            if (link.closest('#zl-analyze-form') || link.hasAttribute('data-analyze-trigger')) {
                return; // handled separately in setupIndexAnalyze()
            }

            e.preventDefault();
            navigateTo(href);
        }, true);
    }


    // ═══════════════════════════════════════════════════════════
    //  2. Global Loading State (index.html only)
    // ═══════════════════════════════════════════════════════════

    function isIndexPage() {
        const path = window.location.pathname;
        return path.endsWith('index.html') || path.endsWith('/') || path === '';
    }

    /**
     * GitHub URL validation (basic heuristic).
     */
    function isValidGitHubUrl(raw) {
        const val = raw.trim();
        if (!val) return false;
        // Accept: github.com/user, https://github.com/user, user/repo, etc.
        const patterns = [
            /^https?:\/\/(www\.)?github\.com\/.+/i,
            /^(www\.)?github\.com\/.+/i,
            /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/,       // user/repo
            /^[a-zA-Z0-9_-]+$/,                           // just username
        ];
        return patterns.some(p => p.test(val));
    }

    /**
     * Runs the loading overlay message cycle, then triggers
     * the page transition to the dashboard.
     */
    function runLoadingSequence(targetHref) {
        const overlay  = document.getElementById('zl-loading-overlay');
        const textEl   = document.getElementById('zl-loading-text');
        const barEl    = document.getElementById('zl-loading-bar');
        const counterEl = document.getElementById('zl-loading-counter');
        if (!overlay || !textEl || !barEl) return;

        overlay.classList.add('active');

        let idx = 0;
        const total = LOADING_MESSAGES.length;
        const interval = 420; // ms between messages

        function showNext() {
            if (idx >= total) {
                // Done — trigger page transition
                setTimeout(() => {
                    overlay.classList.remove('active');
                    navigateTo(targetHref);
                }, 300);
                return;
            }

            textEl.textContent = LOADING_MESSAGES[idx];
            const pct = Math.round(((idx + 1) / total) * 100);
            barEl.style.width = pct + '%';
            if (counterEl) counterEl.textContent = `${idx + 1} / ${total}`;
            idx++;
            setTimeout(showNext, interval + Math.random() * 200);
        }

        // Kick off after a brief beat
        setTimeout(showNext, 350);
    }

    /**
     * Hooks up the "Analyze Profile" button on index.html.
     * Converts the <a> to a button-like behavior with validation.
     */
    function setupIndexAnalyze() {
        if (!isIndexPage()) return;

        injectLoadingOverlay();

        // Find the analyze link — it's the <a href="dashboard.html"> inside the input group
        const analyzeLink = document.querySelector('a[href="dashboard.html"]');
        const inputEl     = document.querySelector('input[placeholder*="github"]') ||
                            document.querySelector('input[type="text"]');

        if (!analyzeLink || !inputEl) return;

        // Mark it so the general link interceptor ignores it
        analyzeLink.setAttribute('data-analyze-trigger', 'true');

        analyzeLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const value = inputEl.value.trim();

            if (!value) {
                ZLToast.error('Input Required', 'Please enter a GitHub username or profile URL to analyze.');
                inputEl.focus();
                // Shake the input container
                const container = inputEl.closest('.relative') || inputEl.parentElement;
                container.style.animation = 'none';
                void container.offsetHeight; // reflow
                container.style.animation = 'inputShake 0.5s ease';
                return;
            }

            if (!isValidGitHubUrl(value)) {
                ZLToast.error('Invalid URL', `"${value}" doesn't look like a valid GitHub profile. Try: github.com/username`);
                inputEl.focus();
                return;
            }

            // Valid — run the loading sequence
            runLoadingSequence(analyzeLink.getAttribute('href'));
        });

        // Also handle Enter key on the input
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                analyzeLink.click();
            }
        });
    }


    // ═══════════════════════════════════════════════════════════
    //  3. Toast Notification System
    // ═══════════════════════════════════════════════════════════

    const ZLToast = {
        /**
         * Show an error toast.
         * @param {string} title
         * @param {string} message
         * @param {number} duration  - auto-dismiss ms (default 4500)
         */
        error(title, message, duration = 4500) {
            this._show('error', title, message, duration);
        },

        /**
         * Show a success toast.
         */
        success(title, message, duration = 3500) {
            this._show('success', title, message, duration);
        },

        /** @private */
        _show(type, title, message, duration) {
            const container = document.getElementById('zl-toast-container');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = `zl-toast ${type === 'success' ? 'zl-toast--success' : ''}`;
            toast.style.position = 'relative';
            toast.style.setProperty('--toast-duration', duration + 'ms');

            const iconClass = type === 'error' ? 'zl-toast-icon--error' : 'zl-toast-icon--success';
            const iconChar  = type === 'error' ? '✕' : '✓';
            const timerClass = type === 'error' ? 'zl-toast-timer--error' : 'zl-toast-timer--success';

            toast.innerHTML = `
                <div class="zl-toast-icon ${iconClass}">${iconChar}</div>
                <div class="zl-toast-body">
                    <div class="zl-toast-title">${title}</div>
                    <div class="zl-toast-message">${message}</div>
                </div>
                <button class="zl-toast-close" aria-label="Dismiss">✕</button>
                <div class="zl-toast-timer ${timerClass}"></div>
            `;

            // Dismiss on close click
            toast.querySelector('.zl-toast-close').addEventListener('click', () => dismissToast(toast));

            container.appendChild(toast);

            // Auto-dismiss
            const timer = setTimeout(() => dismissToast(toast), duration);
            toast._timer = timer;
        }
    };

    function dismissToast(toast) {
        if (toast._dismissed) return;
        toast._dismissed = true;
        clearTimeout(toast._timer);
        toast.classList.add('dismiss');
        setTimeout(() => toast.remove(), 400);
    }

    // Expose globally so other scripts can use it
    window.ZLToast = ZLToast;


    // ═══════════════════════════════════════════════════════════
    //  4. Input Shake Keyframe (injected once)
    // ═══════════════════════════════════════════════════════════

    function injectExtraKeyframes() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes inputShake {
                0%, 100% { transform: translateX(0); }
                15%  { transform: translateX(-6px); }
                30%  { transform: translateX(5px); }
                45%  { transform: translateX(-4px); }
                60%  { transform: translateX(3px); }
                75%  { transform: translateX(-2px); }
                90%  { transform: translateX(1px); }
            }
        `;
        document.head.appendChild(style);
    }


    // ═══════════════════════════════════════════════════════════
    //  Boot
    // ═══════════════════════════════════════════════════════════

    function init() {
        injectTransitionOverlay();
        injectExtraKeyframes();
        interceptLinks();
        setupIndexAnalyze();

        // Wait for custom fonts to load before revealing the page
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                document.documentElement.classList.remove('zl-fonts-loading');
                document.body.classList.add('zl-fonts-ready');
                playEnterTransition();
            });
        } else {
            // Fallback for older browsers
            document.documentElement.classList.remove('zl-fonts-loading');
            document.body.classList.add('zl-fonts-ready');
            playEnterTransition();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
