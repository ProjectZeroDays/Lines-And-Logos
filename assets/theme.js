/* Lines & Logos — system-aware white/dark theme control. */
(() => {
  'use strict';
  const root = document.documentElement;
  const STORAGE_KEY = 'll-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let button = null;

  function savedTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch { return null; }
  }

  function systemTheme() { return media.matches ? 'dark' : 'light'; }

  function updateButton() {
    if (!button) return;
    const dark = root.dataset.theme === 'dark';
    const target = dark ? 'white' : 'dark';
    const source = root.dataset.themeSource === 'system' ? ' (system default)' : '';
    button.setAttribute('aria-label', `Switch to ${target} mode. Current mode: ${dark ? 'dark' : 'white'}${source}`);
    button.setAttribute('title', `Switch to ${target} mode${source}`);
    button.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"/></svg>';
  }

  function applyTheme(theme, source) {
    root.dataset.theme = theme;
    root.dataset.themeSource = source;
    root.style.colorScheme = theme;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#04060d' : '#ffffff');
    updateButton();
  }

  applyTheme(savedTheme() || systemTheme(), savedTheme() ? 'manual' : 'system');

  function toggleTheme() {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    applyTheme(next, 'manual');
  }

  function mountButton() {
    if (document.querySelector('.ll-theme-toggle')) return;
    // mobile: the theme control already lives inside the hamburger menu — skip the floating button
    if (window.matchMedia('(max-width:980px)').matches) return;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'll-theme-toggle';
    button.addEventListener('click', toggleTheme);

    const host = document.querySelector('.nav-inner') || document.querySelector('nav.nav') || document.querySelector('#nav');
    if (host) {
      button.classList.add('ll-theme-in-nav');
      const burger = host.querySelector('.nav-burger');
      host.insertBefore(button, burger || null);
    } else {
      button.classList.add('ll-theme-fixed');
      document.body.classList.add('ll-fixed-theme');
      document.body.appendChild(button);
    }
    updateButton();
  }

  const onSystemChange = () => {
    if (!savedTheme()) applyTheme(systemTheme(), 'system');
  };
  if (media.addEventListener) media.addEventListener('change', onSystemChange);
  else if (media.addListener) media.addListener(onSystemChange);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton, { once: true });
  else mountButton();
})();
