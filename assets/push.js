/* Lines & Logos — Web Push subscription manager (dashboards only).
 *
 * Opt-in per dashboard: <body data-push-role="admin|contractor|client|affiliate">.
 * Marketing pages never load this file.
 *
 * Flow: the pwa.js pre-prompt (data-perms="notifications") explains WHY and asks
 * for Notification permission. Once granted, this module registers the push
 * subscription with the L&L server, tagged with the dashboard role, so the
 * server can target pushes (dispatch → contractor, payouts → contractor,
 * approvals → admin, commissions → affiliate, quote steps → client).
 *
 * Demo/static mode (no server): the subscription intent is stored in
 * localStorage and in-app notifications keep working — nothing breaks.
 */
(function () {
  const role = document.body && document.body.getAttribute('data-push-role');
  if (!role) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const DEMO_KEY = 'll_push_sub_' + role;

  function token() {
    return localStorage.getItem('ll_token')
        || localStorage.getItem('ll_portal')
        || sessionStorage.getItem('ll_client_token')
        || localStorage.getItem('ll_affiliate')
        || '';
  }
  function headers() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() };
  }
  function b64ToU8(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }
  async function vapidKey() {
    try {
      const r = await fetch('api/push/vapid', { headers: headers() });
      if (!r.ok) return null;
      return (await r.json()).publicKey || null;
    } catch { return null; }              // demo/static hosting — no server
  }

  async function ensure() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(rej, 8000)),
      ]);
      let sub = await reg.pushManager.getSubscription();
      const key = await vapidKey();
      if (!sub) {
        /* Chrome/Edge require a VAPID key; without the server we still try a
           keyless subscription so the intent is recorded for demo mode. */
        const opts = key ? { userVisibleOnly: true, applicationServerKey: b64ToU8(key) } : { userVisibleOnly: true };
        try { sub = await reg.pushManager.subscribe(opts); } catch { sub = null; }
      }
      if (!sub) return;
      if (key) {
        await fetch('api/push/subscribe', { method: 'POST', headers: headers(), body: JSON.stringify({ role, subscription: sub.toJSON() }) }).catch(() => {});
      } else {
        try { localStorage.setItem(DEMO_KEY, JSON.stringify({ role, subscription: sub.toJSON(), demo: true, at: Date.now() })); } catch {}
      }
    } catch { /* push must never break a dashboard */ }
  }

  /* manual test — dashboards can call LL_PUSH.test() from a settings toggle */
  async function test() {
    try {
      const r = await fetch('api/push/test', { method: 'POST', headers: headers() });
      return r.ok ? await r.json() : { sent: 0, demo: true };
    } catch { return { sent: 0, demo: true }; }
  }

  window.LL_PUSH = { ensure, test, role };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => setTimeout(ensure, 2500));
  else setTimeout(ensure, 2500);

  /* re-check when permission flips to granted via the pwa.js pre-prompt */
  if ('permissions' in navigator && navigator.permissions.query) {
    navigator.permissions.query({ name: 'notifications' }).then(st => {
      st.onchange = () => { if (st.state === 'granted') ensure(); };
    }).catch(() => {});
  }
})();
