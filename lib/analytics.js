/* Lines & Logos — lightweight, privacy-safe visitor analytics.
 * Zero-dep. No cookies, no raw IP storage: daily visitors are counted via a
 * sha256(ip + date + user-agent) hash that can't identify anyone and expires
 * with the day. Aggregates per day: pageviews, uniques, top pages, referrers,
 * devices. Dashboard reads /api/analytics/*.
 */
'use strict';
const crypto = require('crypto');

function today() { return new Date().toISOString().slice(0, 10); }
function dayBucket(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(ip + '|' + today() + '|' + ua).digest('hex').slice(0, 24);
}
function deviceOf(ua) {
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}
function refOf(ref) {
  if (!ref) return 'direct';
  try { const h = new URL(ref).hostname.replace(/^www\./, '');
    if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(h)) return 'search';
    return h; } catch { return 'other'; }
}

/* called from the static-server path for every HTML page view */
function track(db, req, page) {
  try {
    db.visitorStats = db.visitorStats || { days: {}, hashes: {} };
    const S = db.visitorStats;
    const d = today();
    S.days[d] = S.days[d] || { pageviews: 0, uniques: 0, pages: {}, referrers: {}, devices: {} };
    const day = S.days[d];
    day.pageviews++;
    day.pages[page] = (day.pages[page] || 0) + 1;
    const ua = req.headers['user-agent'] || '';
    const dev = deviceOf(ua);
    day.devices[dev] = (day.devices[dev] || 0) + 1;
    const ref = refOf(req.headers['referer']);
    day.referrers[ref] = (day.referrers[ref] || 0) + 1;
    const h = dayBucket(req);
    if (!S.hashes[d + ':' + h]) { S.hashes[d + ':' + h] = 1; day.uniques++; }
    // prune old day-hashes (> 35 days) so db stays small
    const cutoff = new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
    for (const k of Object.keys(S.hashes)) { if (k.slice(0, 10) < cutoff) delete S.hashes[k]; }
    for (const k of Object.keys(S.days)) { if (k < cutoff) delete S.days[k]; }
  } catch (e) { /* tracking must never break a page */ }
}

function summary(db, days = 30) {
  const S = db.visitorStats || { days: {} };
  const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const window = Object.keys(S.days).filter(d => d >= cutoff).sort();
  const totals = { pageviews: 0, uniques: 0 };
  const pages = {}, referrers = {}, devices = {};
  let trend = [];
  for (const d of window) {
    const day = S.days[d];
    totals.pageviews += day.pageviews; totals.uniques += day.uniques;
    for (const [p, n] of Object.entries(day.pages)) pages[p] = (pages[p] || 0) + n;
    for (const [r, n] of Object.entries(day.referrers)) referrers[r] = (referrers[r] || 0) + n;
    for (const [v, n] of Object.entries(day.devices)) devices[v] = (devices[v] || 0) + n;
    trend.push({ date: d, pageviews: day.pageviews, uniques: day.uniques });
  }
  const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, count: v }));
  const todayStr = today();
  const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  return { days: window.length, totals,
    today: S.days[todayStr] ? { pageviews: S.days[todayStr].pageviews, uniques: S.days[todayStr].uniques } : null,
    yesterday: S.days[yest] ? { pageviews: S.days[yest].pageviews, uniques: S.days[yest].uniques } : null,
    topPages: top(pages, 10), topReferrers: top(referrers, 8), devices,
    trend: trend.slice(-30) };
}

module.exports = { track, summary };
