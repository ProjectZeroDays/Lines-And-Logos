/* Lines & Logos PWA bootstrap — registers the service worker, handles the
   install prompt, captures affiliate referral codes, and exposes a tiny
   "Install app" affordance when the browser offers one. */
(function () {
  // --- service worker (http/https only; skip for file:// previews) ---
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // relative fallback when served from a subpath
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    });
  }

  // --- affiliate referral capture: ?ref=CODE persists for 90 days ---
  try {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref) {
      const until = Date.now() + 90 * 864e5;
      localStorage.setItem('ll_ref', JSON.stringify({ code: ref.toUpperCase(), until }));
    }
  } catch (e) {}
  window.LL_REF = (function () {
    try {
      const r = JSON.parse(localStorage.getItem('ll_ref') || 'null');
      return r && r.until > Date.now() ? r.code : null;
    } catch (e) { return null; }
  })();

  // --- install bot: floating pill on every page; once the user exits it, it stays gone ---
  const INSTALL_EXIT_KEY = 'll_install_dismissed';
  const installExited = () => { try { return localStorage.getItem(INSTALL_EXIT_KEY) === '1'; } catch (e) { return false; } };
  const alreadyInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let deferred = null;
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    return; // install pill removed per owner request — the app stays installable via the browser's own menu
    if (alreadyInstalled() || installExited()) return;
    if (/(^|\/)login\.html$/.test(location.pathname)) return; // login page shows its own top install toast
    let pill = document.getElementById('pwaInstall');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'pwaInstall';
      pill.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:9000;display:flex;align-items:center;gap:9px;font:700 13px Archivo,sans-serif;letter-spacing:.04em;color:#fff;background:linear-gradient(180deg,#4d7dff,#2d5bff);border:1px solid rgba(140,175,255,.5);border-radius:100px;padding:9px 9px 9px 18px;box-shadow:0 10px 30px rgba(45,91,255,.45);transition:transform .15s';
      const go = document.createElement('span');
      go.id = 'pwaInstallGo';
      go.textContent = '⤓ Install App';
      go.style.cssText = 'cursor:pointer;white-space:nowrap';
      const x = document.createElement('button');
      x.id = 'pwaInstallX';
      x.setAttribute('aria-label', 'Dismiss install prompt');
      x.textContent = '×';
      x.style.cssText = 'width:24px;height:24px;border-radius:50%;border:none;background:rgba(4,6,13,.45);color:#c6d0e6;font-size:15px;line-height:1;cursor:pointer;flex:none;padding:0';
      x.onclick = ev => { ev.stopPropagation(); try { localStorage.setItem(INSTALL_EXIT_KEY, '1'); } catch (e) {} pill.remove(); };
      pill.appendChild(go);
      pill.appendChild(x);
      pill.onmouseenter = () => pill.style.transform = 'translateY(-2px)';
      pill.onmouseleave = () => pill.style.transform = '';
      go.onclick = async () => {
        pill.style.display = 'none';
        if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; }
      };
      document.body.appendChild(pill);
    }
    pill.style.display = 'flex';
  });
  addEventListener('appinstalled', () => {
    try { localStorage.setItem(INSTALL_EXIT_KEY, '1'); } catch (e) {}
    const pill = document.getElementById('pwaInstall');
    if (pill) pill.remove();
  });
})();

/* ---------- Permissions manager ----------
   Pages opt in with <body data-perms="notifications"> (and/or "install").
   A branded pre-prompt explains WHY before the browser asks — required for
   good grant rates and for app-store / PWA review compliance. */
(function () {
  const wants = (document.body && document.body.getAttribute('data-perms')) || '';

  function card(title, text, cta, onYes, onNo) {
    if (document.getElementById('llPermCard')) return;
    const el = document.createElement('div');
    el.id = 'llPermCard';
    el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9500;max-width:330px;background:linear-gradient(180deg,#132a63,#0a1533);border:1px solid rgba(120,160,255,.45);border-radius:16px;padding:18px 20px;box-shadow:0 24px 60px rgba(0,0,0,.6);font-family:Space Grotesk,system-ui,sans-serif;color:#c6d0e6';
    el.innerHTML = '<b style="color:#fff;font-family:Archivo,sans-serif;font-size:14px;letter-spacing:.03em">' + title + '</b>' +
      '<p style="font-size:12.5px;line-height:1.5;margin:8px 0 14px">' + text + '</p>';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px';
    const yes = document.createElement('button'); yes.textContent = cta;
    yes.style.cssText = 'flex:1;font:800 12px Archivo,sans-serif;color:#fff;border:none;cursor:pointer;padding:9px 12px;border-radius:9px;background:linear-gradient(180deg,#4d7dff,#2d5bff 45%,#1c3fd6)';
    const no = document.createElement('button'); no.textContent = 'Not now';
    no.style.cssText = 'font:700 12px Archivo,sans-serif;color:#c6d0e6;background:transparent;border:1px solid rgba(120,145,205,.3);cursor:pointer;padding:9px 12px;border-radius:9px';
    yes.onclick = () => { el.remove(); onYes && onYes(); };
    no.onclick = () => { el.remove(); try { localStorage.setItem('ll_perm_snooze', Date.now() + 3 * 864e5); } catch (e) {} onNo && onNo(); };
    row.appendChild(yes); row.appendChild(no); el.appendChild(row);
    document.body.appendChild(el);
  }

  window.LL_PERMS = {
    async notifications() {
      if (!('Notification' in window)) return 'unsupported';
      if (Notification.permission !== 'default') return Notification.permission;
      return Notification.requestPermission();
    },
    card,
  };

  // Auto-prompt for notifications on pages that ask for it (snoozed 3 days)
  if (wants.includes('notifications') && 'Notification' in window && Notification.permission === 'default') {
    let snoozed = false;
    try { snoozed = (+localStorage.getItem('ll_perm_snooze') || 0) > Date.now(); } catch (e) {}
    if (!snoozed) setTimeout(() => card(
      'Enable notifications',
      'Get instant alerts for quote approvals, schedule changes, payroll updates and agent approvals — even when the app is closed.',
      'Enable notifications',
      () => window.LL_PERMS.notifications()
    ), 2500);
  }
})();
