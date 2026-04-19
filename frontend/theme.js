// theme.js
// Phase 6: Light/Dark mode toggle.
// Reads preference from localStorage, applies it to <html>,
// and auto-injects a toggle button into the header bar.
// MUST be loaded in <head> to prevent flash of wrong theme.

(function () {
    const STORAGE_KEY = 'zl:theme';
    const html = document.documentElement;

    function getPreferred() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'light' || saved === 'dark') return saved;
        } catch {}
        if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
        return 'dark';
    }

    function currentTheme() {
        return html.classList.contains('light') ? 'light' : 'dark';
    }

    function apply(theme) {
        if (theme === 'light') {
            html.classList.remove('dark');
            html.classList.add('light');
        } else {
            html.classList.remove('light');
            html.classList.add('dark');
        }
        html.setAttribute('data-theme', theme);
        try { localStorage.setItem(STORAGE_KEY, theme); } catch {}

        // Update any existing toggle icons
        document.querySelectorAll('.zl-theme-icon').forEach(icon => {
            icon.textContent = theme === 'light' ? 'dark_mode' : 'light_mode';
        });
    }

    function toggle() {
        apply(currentTheme() === 'light' ? 'dark' : 'light');
    }

    // Apply immediately (before DOM renders) to prevent flash
    apply(getPreferred());

    // On DOM ready: wire toggle buttons
    document.addEventListener('DOMContentLoaded', () => {
        // 1. Wire any pre-existing .zl-theme-toggle buttons (e.g. index page)
        const existingToggles = document.querySelectorAll('.zl-theme-toggle');
        existingToggles.forEach(btn => {
            // Update the icon to match current theme
            const icon = btn.querySelector('.zl-theme-icon');
            if (icon) icon.textContent = currentTheme() === 'light' ? 'dark_mode' : 'light_mode';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                toggle();
            });
        });

        if (existingToggles.length > 0) return; // Already wired

        // 2. Repurpose settings buttons on inner pages (dashboard, etc.)
        const headerBtns = document.querySelectorAll('header button');
        let injected = false;

        headerBtns.forEach(btn => {
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon && icon.textContent.trim() === 'settings') {
                btn.classList.add('zl-theme-toggle');
                btn.setAttribute('title', 'Toggle light/dark mode');
                icon.classList.add('zl-theme-icon');
                icon.textContent = currentTheme() === 'light' ? 'dark_mode' : 'light_mode';
                icon.style.fontVariationSettings = "'FILL' 0";
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggle();
                });
                injected = true;
            }
        });

        // 3. Fallback: inject a toggle if nothing found
        if (!injected) {
            const header = document.querySelector('header.fixed');
            if (header) {
                const container = header.querySelector('.flex.items-center.gap-4');
                if (container) {
                    const btn = document.createElement('button');
                    btn.className = 'zl-theme-toggle hover:text-[#ADC6FF] hover:bg-white/5 transition-all p-2 rounded-full active:scale-95 duration-200';
                    btn.title = 'Toggle light/dark mode';
                    btn.innerHTML = `<span class="material-symbols-outlined zl-theme-icon" style="font-variation-settings: 'FILL' 0;">${currentTheme() === 'light' ? 'dark_mode' : 'light_mode'}</span>`;
                    btn.addEventListener('click', toggle);
                    container.insertBefore(btn, container.firstChild);
                }
            }
        }
    });

    window.ZLTheme = { toggle, apply, getPreferred, currentTheme };
})();
