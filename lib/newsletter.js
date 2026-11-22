/* Lines & Logos — Newsletter Agent.
 *
 * Manages the customer newsletter: subscriber list (public signup, token
 * unsubscribe), a content engine that drafts each issue from (1) seasonal
 * court-care tips, (2) sports-facility news items you curate or that arrive
 * by email alert, (3) your own announcements (promos, new services). Drafts
 * are held for admin approval, then "sent" (recorded to the email log per
 * subscriber). Open tracking via a 1-pixel beacon. Zero-dep.
 */
'use strict';
const crypto = require('crypto');

const now = () => new Date().toISOString();
function token() { return crypto.randomBytes(16).toString('hex'); }

/* ---------- subscribers ---------- */
function subscribe(db, input) {
  const email = String(input.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid email required');
  let sub = db.subscribers.find(s => s.email === email);
  if (sub) { sub.status = 'active'; sub.name = input.name || sub.name; sub.unsubscribedAt = null; return { sub, reactivated: true }; }
  sub = { id: 'sub' + Date.now().toString(36), email, name: input.name || null,
    source: input.source || 'website', subscribedAt: now(), status: 'active', opens: 0, token: token() };
  db.subscribers.unshift(sub);
  return { sub, reactivated: false };
}
function unsubscribe(db, emailOrToken) {
  const sub = db.subscribers.find(s => s.email === String(emailOrToken).toLowerCase() || s.token === emailOrToken);
  if (!sub) throw new Error('Subscriber not found');
  sub.status = 'unsubscribed'; sub.unsubscribedAt = now();
  return sub;
}
function activeCount(db) { return db.subscribers.filter(s => s.status === 'active').length; }

/* ---------- curated content library ----------
 * Seasonal tips are evergreen; news items are seeded + admin-editable, and
 * items can also flow in via the email monitor. Each has a source URL. */
const SEASONAL_TIPS = [
  { months: [6, 7, 8], tip: 'Summer is refinish season', body: 'With gyms empty, summer is the cheapest time for a full sand & refinish — book before August clinics fill the calendar.', tag: 'maintenance' },
  { months: [3, 4, 5], tip: 'Spring deep-clean before tournaments', body: 'A recoat now protects the floor through playoff and tournament season — a fraction of a full refinish.', tag: 'maintenance' },
  { months: [11, 12, 1], tip: 'Winter moisture = wood movement', body: 'Hardwood moves with humidity. Keep gym humidity 35–50% to prevent cupping and seams. We include a moisture check in every visit.', tag: 'education' },
  { months: [9, 10], tip: 'New school year inspection', body: 'Annual logo/line touch-ups before basketball season starts keep your courts game-legal (NFHS line widths change periodically).', tag: 'compliance' },
];
const SEED_NEWS = [
  { title: 'Pickleball keeps converting gyms', body: 'Facilities across the Mid-South are adding pickleball courts in existing gym space — a low-cost way to add programming revenue. Multi-use line packages keep basketball intact.', url: 'https://www.usapickleball.org/' },
  { title: 'NFHS updates court-marking guidance', body: 'State associations periodically update required line dimensions and colors. We track the current rules for every court we stripe.', url: 'https://www.nfhs.org/' },
  { title: 'Facility branding boosts school pride — and enrollment tours', body: 'Wall pads, center-court logos and branded entry graphics are consistently cited by ADs as the highest-visibility upgrade per dollar.', url: null },
  { title: 'Summer projects: book crews early', body: 'Refinishing crews within a 400-mile radius of Memphis book out 6–8 weeks deep in peak season. Early contracts lock pricing.', url: null },
];
function seasonalTip() {
  const m = new Date().getMonth() + 1;
  const hit = SEASONAL_TIPS.find(t => t.months.includes(m));
  return hit || SEASONAL_TIPS[0];
}

/* ---------- campaign drafting ---------- */
function draftCampaign(db, input) {
  const tip = seasonalTip();
  const adminNews = (input.newsItems || []).filter(Boolean);
  const stats = { subs: activeCount(db) };
  const subject = input.subject || `${tip.tip} — plus what's new at ${(db.settings.company && db.settings.company.name) || 'Lines & Logos'}`;
  const sections = [
    { kind: 'hero', title: tip.tip, body: tip.body },
    ...adminNews.map(n => ({ kind: 'news', title: n.title || 'Update', body: n.body || '', url: n.url || null })),
    { kind: 'cta', title: 'Get a free site survey', body: 'Reply to this email or book online — we measure, spec, and quote on the spot.', url: 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('2847 New Broadway St, Memphis, TN 38109') },
  ];
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1a2438">
    <h1 style="color:#0a1533">${esc(subject)}</h1>
    ${sections.map(s => `<div style="margin:18px 0"><h3 style="margin:0 0 6px">${esc(s.title)}</h3><p style="margin:0;line-height:1.5">${esc(s.body)}</p>${s.url ? `<p><a href="${s.url}">Learn more →</a></p>` : ''}</div>`).join('<hr style="border:none;border-top:1px solid #dde3ef">')}
    <p style="font-size:12px;color:#889">You're receiving this because you subscribed at our website. <a href="{{unsubscribe}}">Unsubscribe</a> anytime.</p></body></html>`;
  const camp = { id: 'cmp' + Date.now().toString(36), subject, sections, html, draftedAt: now(),
    status: 'pending-approval', sentAt: null, recipientCount: 0, openCount: 0, createdBy: input.createdBy || 'agent' };
  db.campaigns.unshift(camp);
  return camp;
}
function esc(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* admin approves → "send" (record one email per active subscriber w/ pixel) */
function sendCampaign(db, id, ctx) {
  const c = db.campaigns.find(x => x.id === id);
  if (!c) throw new Error('Campaign not found');
  if (c.status !== 'pending-approval') throw new Error('Already ' + c.status);
  const actives = db.subscribers.filter(s => s.status === 'active');
  let sent = 0;
  for (const s of actives) {
    const pixel = `/api/newsletter/open?c=${c.id}&s=${s.token}`;
    db.emails.push({ id: 'em' + Date.now() + sent, to: s.email, subject: c.subject,
      body: c.html.replace('{{unsubscribe}}', '/api/newsletter/unsubscribe?t=' + s.token).replace('</body>', `<img src="${pixel}" width="1" height="1" alt=""></body>`),
      status: 'sent', sentAt: now(), kind: 'newsletter' });
    sent++;
  }
  c.status = 'sent'; c.sentAt = now(); c.recipientCount = sent;
  ctx.logActivity(`Newsletter sent: "${c.subject}" to ${sent} subscriber(s)`);
  return c;
}
/* open pixel */
function trackOpen(db, campaignId, subToken) {
  const s = db.subscribers.find(x => x.token === subToken);
  if (s) { s.opens = (s.opens || 0) + 1; s.lastOpenAt = now(); }
  const c = db.campaigns.find(x => x.id === campaignId);
  if (c) c.openCount = (c.openCount || 0) + 1;
  return true;
}

function stats(db) {
  const camps = db.campaigns || [];
  return { subscribers: activeCount(db), totalSubscribers: db.subscribers.length,
    campaigns: camps.length, sent: camps.filter(c => c.status === 'sent').length,
    avgOpenRate: camps.filter(c => c.recipientCount > 0).length
      ? Math.round(camps.filter(c => c.recipientCount > 0).reduce((s, c) => s + c.openCount / c.recipientCount, 0) / camps.filter(c => c.recipientCount > 0).length * 100) : null,
    pending: camps.filter(c => c.status === 'pending-approval').length };
}

/* email monitor: sports/news alerts → curated news library (db.newsItems) */
function monitorEmails(db, ctx) {
  let found = 0;
  db.newsItems = db.newsItems || [...SEED_NEWS.map((n, i) => ({ id: 'ni' + i, ...n, addedAt: now(), curated: true }))];
  for (const em of (db.emails || [])) {
    const text = ((em.subject || '') + ' ' + (em.body || '')).toLowerCase();
    if (!/(pickleball|nfhs|gym floor|court|sports facility|recoat|refinish)/.test(text)) continue;
    if (db.newsItems.some(n => n.title === em.subject)) continue;
    db.newsItems.unshift({ id: 'ni' + Date.now(), title: (em.subject || 'News').slice(0, 100), body: (em.body || '').replace(/<[^>]+>/g, ' ').slice(0, 300), url: null, addedAt: now(), curated: false, source: em.from });
    found++;
  }
  return found;
}

module.exports = { subscribe, unsubscribe, activeCount, draftCampaign, sendCampaign, trackOpen, stats, monitorEmails, SEASONAL_TIPS, SEED_NEWS, seasonalTip };
