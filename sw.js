/* Lines & Logos PWA service worker
   - HTML / navigations: network-first (a fresh publish must win; cache is the offline fallback)
   - Static assets (css/js/png/fonts): cache-first with background refresh
   - New versions activate immediately (skipWaiting + clientsClaim) */
const VERSION = 'll-v20';
const STATIC_CACHE = VERSION + '-static';
const PAGE_CACHE = VERSION + '-pages';
const CORE = [
  '/index.html', '/login.html', '/offline.html',
  '/assets/os.css', '/assets/os.js', '/assets/chat.js', '/assets/theme.css', '/assets/theme.js', '/assets/pwa.js',
  '/logo.png', '/logo-hero.png', '/icons/icon-192.png', '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // never cache API traffic or cross-origin calls (Google Fonts CSS is allowed below)
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;

  // navigations & HTML → network-first, fall back to cache, then offline page
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('.html'))) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const clone = res.clone(); caches.open(PAGE_CACHE).then(c => c.put(req, clone)); }
        return res;
      }).catch(async () => {
        const cached = await caches.match(req);
        return cached || caches.match('/offline.html');
      })
    );
    return;
  }

  // same-origin assets + Google Fonts → cache-first, refresh in background
  if (url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then(cached => {
        const fresh = fetch(req).then(res => {
          if (res.ok) { const clone = res.clone(); caches.open(STATIC_CACHE).then(c => c.put(req, clone)); }
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
});

/* ---------- Web Push — rich lock-screen notifications ----------
   The server sends an encrypted JSON payload; we style it per category
   (icon, vibration pattern, action buttons, image, priority) so it reads
   well on Android/iOS/Windows lock screens. Payload contract:
   { title, body, url, category, tag, image, silent,
     actions: [{action,title}], data: { url, actionUrls: {...} } } */
const LL_ICON = '/icons/icon-192.png';
const LL_BADGE = '/icons/favicon-32.png';
/* per-category presentation (server may override any field) */
const PUSH_STYLE = {
  approval:  { icon: LL_ICON, vibrate: [300, 100, 300], requireInteraction: true, renotify: true,
              actions: [{ action: 'view', title: '✓ Review & approve' }] },
  security:  { icon: LL_ICON, vibrate: [400, 150, 400, 150, 400], requireInteraction: true, renotify: true,
              actions: [{ action: 'view', title: 'Review finding' }] },
  job:       { icon: LL_ICON, vibrate: [200], actions: [{ action: 'view', title: 'Open job' }] },
  trip:      { icon: LL_ICON, vibrate: [200, 80, 200],
              actions: [{ action: 'view', title: 'Itinerary' }, { action: 'navigate', title: 'Directions' }] },
  payment:   { icon: LL_ICON, vibrate: [150], actions: [{ action: 'view', title: 'View invoice' }] },
  message:   { icon: LL_ICON, vibrate: [120] },
  default:   { icon: LL_ICON, vibrate: [200] },
};

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch { d = { title: 'Lines & Logos', body: e.data ? e.data.text() : '' }; }

  const style = Object.assign({}, PUSH_STYLE[d.category] || PUSH_STYLE.default, d.style || {});
  const opts = {
    body: d.body || 'You have new activity.',
    icon: d.icon || style.icon || LL_ICON,
    badge: d.badge || LL_BADGE,
    tag: d.tag || ('ll-' + (d.category || 'push')),
    dir: 'auto',
    timestamp: d.timestamp || Date.now(),
    data: Object.assign({ url: d.url || '/' }, d.data || {}),
  };
  if (style.vibrate && !d.silent) opts.vibrate = style.vibrate;
  if (style.requireInteraction) opts.requireInteraction = true;
  if (style.renotify) opts.renotify = true;
  if (d.image || style.image) opts.image = d.image || style.image;
  const acts = (d.actions || style.actions || []).slice(0, 2);   // platform max
  if (acts.length) opts.actions = acts;
  if (d.silent) { opts.silent = true; delete opts.vibrate; }

  e.waitUntil(
    (d.silent
      ? self.registration.showNotification(d.title || 'Lines & Logos', { ...opts, silent: true })
      : Promise.resolve())
      .then(() => d.silent ? null : self.registration.showNotification(d.title || 'Lines & Logos', opts))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const act = e.action;
  const url = (act && data.actionUrls && data.actionUrls[act])
    || (act === 'navigate' && data.directionsUrl)
    || data.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});

/* closed without interaction — tell the server for engagement analytics */
self.addEventListener('notificationclose', e => {
  const data = e.notification.data || {};
  if (data.logUrl) fetch(data.logUrl, { method: 'POST' }).catch(() => {});
});
