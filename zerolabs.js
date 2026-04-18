/* zerolabs-interactions.js
   Global interaction engine for all ZeroLabs inner pages.
   Handles: cursor glow, 3D tilt, ripples, smooth counters,
   progress bar animation, sidebar active state.
*/

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {

        /* ─── 1. Cursor-tracking radial glow on cards ─── */
        const glowTargets = document.querySelectorAll(
            '.glass-card, .bg-surface-container-low, .bg-surface-container, .glass-panel, .interactive-card, .project-card, article'
        );

        document.addEventListener('mousemove', (e) => {
            glowTargets.forEach(el => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
                el.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
            });
        });

        /* ─── 2. Subtle 3D tilt on cards ─────────────── */
        glowTargets.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const x = e.clientX - r.left;
                const y = e.clientY - r.top;
                const cx = r.width / 2;
                const cy = r.height / 2;
                const rx = ((y - cy) / cy) * -4;
                const ry = ((x - cx) / cx) * 4;
                card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });

        /* ─── 3. Ripple effect on clickable elements ─── */
        document.querySelectorAll('button, a[href], article').forEach(el => {
            el.style.position = 'relative';
            el.style.overflow = 'hidden';
            el.addEventListener('click', function (e) {
                const r = this.getBoundingClientRect();
                const size = Math.max(r.width, r.height) * 2;
                const ripple = document.createElement('span');
                ripple.className = 'ripple';
                ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size/2}px;top:${e.clientY - r.top - size/2}px;`;
                this.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
            });
        });

        /* ─── 4. Animated number counters ────────────── */
        const counters = document.querySelectorAll(
            '[class*="text-4xl"][class*="font-black"], [class*="text-\\[3.5rem\\]"][class*="font-bold"], .text-lg.font-black'
        );
        const countObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                const raw = el.textContent.replace(/[^0-9.]/g, '');
                const end = parseFloat(raw);
                if (!end || el.dataset.counted) return;
                el.dataset.counted = '1';
                const suffix = el.textContent.replace(raw, '');
                const start = 0;
                const duration = 900;
                const step = (end - start) / (duration / 16);
                let current = start;
                const timer = setInterval(() => {
                    current = Math.min(current + step, end);
                    el.textContent = (Number.isInteger(end) ? Math.round(current) : current.toFixed(1)) + suffix;
                    if (current >= end) clearInterval(timer);
                }, 16);
                countObserver.unobserve(el);
            });
        }, { threshold: 0.5 });
        counters.forEach(el => countObserver.observe(el));

        /* ─── 5. Progress bars animate in on scroll ──── */
        const progressBars = document.querySelectorAll(
            '[class*="h-full"][class*="bg-gradient"], [class*="h-full"][class*="bg-primary"], [class*="h-full"][class*="bg-tertiary"], [class*="h-full"][class*="bg-secondary"]'
        );
        progressBars.forEach(bar => {
            const realWidth = bar.style.width;
            bar.style.width = '0%';
            bar.style.transition = 'width 1.2s cubic-bezier(0.19,1,0.22,1)';
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        setTimeout(() => { bar.style.width = realWidth; }, 100);
                        obs.unobserve(bar);
                    }
                });
            }, { threshold: 0.3 });
            obs.observe(bar);
        });

        /* ─── 6. Mark sidebar active item ────────────── */
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('nav a[href]').forEach(link => {
            if (link.getAttribute('href') === currentPage) {
                link.classList.add('!bg-[rgba(173,198,255,0.12)]', '!text-[#ADC6FF]', '!border', '!border-[rgba(173,198,255,0.2)]');
            }
        });

        /* ─── 7. Stagger children inside grids on load ── */
        document.querySelectorAll('.grid').forEach((grid, gi) => {
            Array.from(grid.children).forEach((child, ci) => {
                child.style.animationDelay = `${(gi * 0.05) + (ci * 0.08)}s`;
                child.style.opacity = '0';
                child.style.animation = 'itemEnter 0.6s cubic-bezier(0.19,1,0.22,1) forwards';
                child.style.animationDelay = `${ci * 0.09}s`;
            });
        });

        /* ─── 8. Smooth hover on sidebar nav icons ───── */
        document.querySelectorAll('nav .material-symbols-outlined').forEach(icon => {
            icon.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
            icon.closest('a')?.addEventListener('mouseenter', () => { icon.style.transform = 'scale(1.2) rotate(-5deg)'; });
            icon.closest('a')?.addEventListener('mouseleave', () => { icon.style.transform = ''; });
        });

    });
})();
