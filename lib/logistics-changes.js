/* Lines & Logos — Logistics Change Management.
 * Watches db.emails for reschedule/cancel/sick signals, recomputes trip plans,
 * issues PO deltas, tracks hotel cancellation deadlines, and suggests
 * replacement crew when someone gets sick. Zero-dependency.
 */
'use strict';
const logistics = require('./logistics');

function cfg(db) { return logistics.cfg(db); }

/* classify a subject+body into a travel event */
function classify(text, c) {
  const t = ' ' + text.toLowerCase() + ' ';
  if (c.sickKeywords.some(k => t.includes(k))) return 'sick';
  if (/cancel/.test(t)) return 'cancel';
  if (c.changeKeywords.some(k => t.includes(k))) return 'reschedule';
  return null;
}

/* find the trip plan an email most likely refers to */
function matchPlan(db, text) {
  const t = text.toLowerCase();
  return db.tripPlans.find(p => p.status === 'approved'
    && (t.includes((p.title || '').toLowerCase())
      || t.includes((p.destination || '').toLowerCase())
      || t.includes((p.contractId || '').toLowerCase())
      || t.includes('crew') || t.includes('hotel'))) || null;
}

/* replace a sick crew member with the best available match */
function suggestReplacement(db, sickEmail, plan, c) {
  const skills = ['installer', 'tech', 'crew', 'driver'];
  const candidates = db.users.filter(u =>
    u.email !== sickEmail && u.active !== false && (u.role === 'tech' || u.role === 'crew')
    && !(plan.crewEmails || []).includes(u.email));
  return candidates.slice(0, 3).map(u => ({
    email: u.email, name: u.name, role: u.role,
    note: skills.some(s => JSON.stringify(u).toLowerCase().includes(s)) ? 'field-skilled' : 'general',
  }));
}

/* process one inbound email → optional travelEvent + recompute */
function ingestEmail(email, ctx) {
  const { db, save, uid, logActivity, notify } = ctx;
  const c = cfg(db);
  const kind = classify((email.subject || '') + ' ' + (email.body || ''), c);
  if (!kind) return null;
  const plan = matchPlan(db, (email.subject || '') + ' ' + (email.body || ''));
  if (!plan) return null;

  const ev = { id: uid('te'), planId: plan.id, kind, source: email.from, at: new Date().toISOString(),
    summary: (email.subject || '').slice(0, 120), handled: false };
  db.travelEvents.unshift(ev);
  plan.events.unshift(ev);

  const before = plan.total;
  let action;

  if (kind === 'sick') {
    const repl = suggestReplacement(db, email.from, plan, c);
    ev.replacementSuggestions = repl;
    notify(db.settings.quotes.approvalEmail, `Crew change — ${plan.title}`,
      `${email.from} may be out. Suggested replacement(s): ${repl.map(r => r.email).join(', ') || 'none available'}.`,
      ['in-app', 'email']);
    ctx.push && ctx.push('admin', `Crew change — ${plan.title}`,
      `${email.from} reported sick; ${repl.length} replacement candidate(s).`, '/dashboard.html', { category: 'trip' });
    action = 'notified-admin-with-replacements';
  } else if (kind === 'cancel') {
    for (const po of plan.pos) {
      const hoursLeft = po.cancelBy ? (new Date(po.cancelBy) - Date.now()) / 36e5 : 0;
      ev['cancel_' + po.id] = hoursLeft > 0
        ? `PO ${po.number}: inside cancellation window (${Math.round(hoursLeft)}h left) — cancel reservation now`
        : `PO ${po.number}: cancellation deadline PASSED — fee likely due`;
    }
    notify(db.settings.quotes.approvalEmail, `Cancellation request — ${plan.title}`,
      'Hotel cancellation deadlines checked; see travel events for fees.', ['in-app', 'email']);
    action = 'cancellation-deadlines-checked';
  } else if (kind === 'reschedule') {
    // extract an explicit date if present ("march 5", "3/5", "2026-03-05")
    const m = (email.subject + ' ' + (email.body || '')).match(/(\w+\s+\d{1,2}|\d{1,2}\/\d{1,2}|20\d{2}-\d{2}-\d{2})/);
    const delta = m ? 1 : 0; // count of schedule shifts requested
    ev.requestedDate = m ? m[0] : null;
    // recompute: each shift day costs roughly one hotel night + per-diem
    const nightly = c.hotelNightly ? 0 : 0;
    const rate = (c.hotelRates && c.hotelRates[plan.destination]) || c.nightlyRate;
    const deltaCost = delta * Math.round(plan.rooms * rate * (1 + c.lodgingTaxPct / 100) + plan.crew * c.perDiem);
    ev.deltaCost = deltaCost;
    if (deltaCost > c.autoApproveDeltaUnder) {
      db.approvals.push({ id: uid('apv'), type: 'purchase', title: `Reschedule cost delta — ${plan.title}`,
        amount: deltaCost, requestedBy: 'Logistics Agent', status: 'pending',
        created: new Date().toISOString().slice(0, 10), tripPlanId: plan.id, note: ev.requestedDate ? `New date: ${ev.requestedDate}` : 'date TBD — confirm with customer' });
      notify(db.settings.quotes.approvalEmail, `Reschedule needs approval — ${plan.title}`,
        `Cost delta $${deltaCost.toLocaleString()} (hotel + per-diem shift).`, ['in-app', 'email']);
      action = 'approval-queued-for-delta';
    } else {
      action = 'auto-applied-small-delta';
    }
    // push hotel cancellation deadline forward when date moves
    for (const po of plan.pos) if (po.cancelBy) po.cancelBy = new Date(Date.now() + 5 * 864e5).toISOString();
  }

  ev.action = action;
  ev.costBefore = before;
  ev.handled = true;
  logActivity(`Logistics change [${kind}] on ${plan.title} → ${action}`);
  save();
  return ev;
}

/* sweep the email log for unprocessed logistics signals (called on interval) */
function monitorEmails(ctx) {
  const { db } = ctx;
  const seen = new Set((db.travelEvents || []).map(e => e.source + e.at));
  let found = 0;
  for (const em of db.emails) {
    const key = em.from + (em.sentAt || em.at || '');
    if (seen.has(key)) continue;
    if (ingestEmail(em, ctx)) found++;
  }
  return found;
}

/* upcoming approved trips → T-48h / T-24h reminder pushes + cancellation warnings */
function tripReminders(ctx) {
  const { db, notify } = ctx;
  let n = 0;
  for (const p of db.tripPlans) {
    if (p.status !== 'approved') continue;
    const hoursLeft = (new Date(p.startDate || Date.now() + 3 * 864e5) - Date.now()) / 36e5;
    const key = p.id + '_' + (hoursLeft > 24 ? '48' : '24');
    if (!p.reminded) p.reminded = [];
    if ((hoursLeft <= 48 && hoursLeft > 24) || (hoursLeft <= 24 && hoursLeft > 0)) {
      if (!p.reminded.includes(key)) {
        p.reminded.push(key); n++;
        const lodgingPO = p.pos.find(x => x.kind === 'lodging');
        const cancelHrs = lodgingPO && lodgingPO.cancelBy ? Math.round((new Date(lodgingPO.cancelBy) - Date.now()) / 36e5) : null;
        ctx.push && ctx.push('admin', `${p.title} — crew departs in ${Math.round(hoursLeft)}h`,
          (cancelHrs !== null && cancelHrs < 24 ? `Hotel cancellation window closes in ${cancelHrs}h. ` : '') + `Itinerary & directions sent to ${(p.emailedTo || []).length} recipient(s).`,
          '/dashboard.html', { category: 'trip', directionsUrl: p.maps && p.maps.directions });
      }
    }
  }
  return n;
}

/* hotel cancellation-deadline sweep — warns before each PO's cancelBy passes */
function cancellationWatch(ctx) {
  const { db, notify } = ctx;
  const warned = [];
  for (const p of db.tripPlans) {
    for (const po of p.pos) {
      if (po.kind !== 'lodging' || !po.cancelBy || po.cancelWarned) continue;
      const h = (new Date(po.cancelBy) - Date.now()) / 36e5;
      if (h > 0 && h <= 24) {
        po.cancelWarned = true;
        notify(db.settings.quotes.approvalEmail, `Hotel cancellation deadline — ${p.title}`,
          `${po.vendorName}: ${Math.round(h)}h left to cancel without penalty ($${(po.amount || 0).toLocaleString()} at stake).`, ['in-app', 'email']);
        warned.push(po.number);
      }
    }
  }
  return warned;
}

module.exports = { classify, matchPlan, suggestReplacement, ingestEmail, monitorEmails, tripReminders, cancellationWatch };
