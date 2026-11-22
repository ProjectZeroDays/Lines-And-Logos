/* Lines & Logos — Reputation & Disputes Agent.
 *
 * Two jobs:
 *   1. FINANCIAL DISPUTES — intake, verify against invoices/payments, propose
 *      resolution (refund / credit / explanation), execute on admin approval,
 *      follow up with the customer.
 *   2. REVIEW & COMPLAINT MONITORING — BBB, Google, Yelp and friends have no
 *      free public read API, so the agent watches the email alerts those
 *      platforms send (BBB emails on complaints; GBP/Yelp email new reviews),
 *      plus an optional GBP integration and a manual/webhook intake. Each item
 *      is classified, gets a drafted response + remediation recommendation,
 *      and either auto-responds (simple, low-risk) or holds for admin sign-off.
 *
 * Zero-dependency; deterministic templates (same style as the other agents).
 */
'use strict';

/* ---------- classification ---------- */
const CATEGORIES = {
  billing:    { keywords: ['overcharge','double charge','charged twice','wrong amount','billing','invoice dispute','refund','payment','price'], label: 'Billing & payments' },
  quality:    { keywords: ['poor quality','peeling','fading','chipping','cracked','uneven','bubbles','bad job','sloppy','defect'], label: 'Work quality' },
  timeliness: { keywords: ['late','no show','no-show','missed appointment','delay','never showed','took too long'], label: 'Scheduling & timeliness' },
  communication:{ keywords: ['never called','no response','ignored','rude','unprofessional','no reply','hard to reach'], label: 'Communication' },
  damage:     { keywords: ['damaged','broke','broken','property damage','scratch','stain','spilled'], label: 'Property damage' },
};
const POSITIVE = ['great','amazing','excellent','love','perfect','beautiful','professional','fast','recommend','fantastic','best'];

function classify(text) {
  const t = ' ' + (text || '').toLowerCase() + ' ';
  let best = null, bestHits = 0;
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const hits = cat.keywords.filter(k => t.includes(k)).length;
    if (hits > bestHits) { best = key; bestHits = hits; }
  }
  const positives = POSITIVE.filter(k => t.includes(k)).length;
  const sentiment = positives > bestHits ? 'positive' : bestHits > 0 ? 'negative' : 'neutral';
  const sev = bestHits >= 2 ? 'high' : bestHits === 1 ? 'medium' : 'low';
  return { category: best, sentiment, severity: sentiment === 'negative' ? sev : 'low', label: best ? CATEGORIES[best].label : 'General' };
}

/* ---------- response + remediation templates ---------- */
function draftResponse(item) {
  const c = item.category || 'general';
  const who = 'Lines & Logos';
  const contact = 'our team at your earliest convenience';
  const R = {
    billing: {
      response: `Thank you for bringing this to our attention — billing errors are never acceptable and we take them seriously. We've opened a priority review of your invoice and payment records. You can expect a corrected statement or refund within 3 business days. We appreciate the chance to make this right.`,
      remediation: ['Pull invoice + payment records and reconcile totals', 'Issue refund or credit memo within 3 business days', 'Log root cause in finance notes to prevent recurrence', 'Follow up with customer confirming resolution'],
    },
    quality: {
      response: `We're sorry your project didn't meet the standard we hold ourselves to. Every job carries our workmanship warranty, and we'd like to inspect and correct this at no charge. Please contact us directly so we can schedule a warranty visit.`,
      remediation: ['Schedule warranty inspection (no charge)', 'Document defect with photos before/after fix', 'Correct per warranty terms', 'Flag crew/crew-lead in job notes for coaching'],
    },
    timeliness: {
      response: `Thank you for your patience, and we apologize for the missed window. Our schedule is built around school and facility availability, and we clearly failed to communicate. We'd like to make it right — please contact us and we'll prioritize your rescheduled visit.`,
      remediation: ['Review scheduling log for the miss', 'Offer priority rescheduling + small goodwill credit', 'Add confirmation call 48h before all future appointments', 'Coach dispatcher on the communication gap'],
    },
    communication: {
      response: `We apologize for the communication breakdown — being reachable is the minimum we owe every customer. A manager will contact you personally within one business day. Thank you for holding us accountable.`,
      remediation: ['Manager personal callback within 1 business day', 'Audit response-time logs for this thread', 'Set 1-business-day response SLA in settings', 'Coach the responsible team member'],
    },
    damage: {
      response: `We're sorry about the damage to your property — that's on us. Please contact us immediately so we can assess and repair or compensate promptly. Our insurance and warranty fully cover property damage from our work.`,
      remediation: ['Same-day acknowledgement + site assessment', 'Repair or compensate via insurance claim', 'Photograph and document everything', 'File incident report; review crew handling'],
    },
    general: {
      response: `Thank you for the feedback — we appreciate you taking the time. A manager will review this and follow up within one business day.`,
      remediation: ['Manager review', 'Personal follow-up within 1 business day', 'Log for pattern analysis'],
    },
  };
  return R[c] || R.general;
}

/* ---------- disputes (financial) ---------- */
function fileDispute(db, uid, input) {
  const inv = (db.invoices || []).find(i => i.number === input.invoiceNumber || i.id === input.invoiceId);
  const d = { id: uid('dsp'), at: new Date().toISOString(), customer: input.customer || input.email || '—',
    invoiceId: inv ? inv.id : null, invoiceNumber: input.invoiceNumber || (inv && inv.number) || null,
    amountClaimed: input.amountClaimed || null, reason: input.reason || input.text || '',
    status: 'open', ...classify((input.reason || '') + ' ' + (input.text || '')) };
  if (inv) {
    d.verification = { invoiceTotal: inv.amount, invoiceStatus: inv.status, match: true };
    if (inv.status === 'paid' && d.amountClaimed && d.amountClaimed <= inv.amount) d.proposedResolution = 'refund';
    else if (inv && d.amountClaimed && d.amountClaimed > inv.amount) d.proposedResolution = 'partial-refund-review';
    else d.proposedResolution = 'explanation';
  } else d.verification = { match: false, note: 'No matching invoice found — verify manually' };
  const res = draftResponse(d);
  d.recommendedRemediation = res.remediation;
  db.disputes.unshift(d);
  return d;
}

function resolveDispute(db, id, action, admin) {
  const d = db.disputes.find(x => x.id === id);
  if (!d) throw new Error('Dispute not found');
  d.status = 'resolved'; d.resolution = action; d.resolvedBy = admin; d.resolvedAt = new Date().toISOString();
  if (action === 'refund' || action === 'partial-refund') {
    db.expenses.push({ id: 'x' + Date.now(), date: new Date().toISOString().slice(0, 10),
      category: 'Refunds & Disputes', vendor: d.customer, amount: d.amountClaimed || 0,
      note: `Dispute refund ${d.id}${d.invoiceNumber ? ' re invoice ' + d.invoiceNumber : ''}` });
  }
  return d;
}

/* ---------- review intake (BBB / Google / Yelp / webhook / email) ---------- */
function ingestReview(db, uid, input, autoRespondEnabled) {
  const r = { id: uid('rev'), at: new Date().toISOString(), source: input.source || 'manual',
    author: input.author || 'Anonymous', rating: input.rating || null, text: input.text || '',
    status: 'open', ...classify(input.text || '') };
  const draft = draftResponse(r);
  r.responseDraft = draft.response; r.recommendedRemediation = draft.remediation;
  db.reviews.unshift(r);
  // auto-respond only to low-risk negatives and positives; high/medium hold for admin
  const canAuto = r.sentiment !== 'negative' || (r.severity === 'low' && autoRespondEnabled);
  if (canAuto && r.sentiment === 'negative') { r.status = 'auto-responded'; r.respondedAt = r.at; r.responseSent = r.responseDraft; }
  else if (r.sentiment === 'positive') { r.status = 'thank-you-queued'; r.responseDraft = `Thank you so much for the kind words${r.author && r.author !== 'Anonymous' ? ', ' + r.author : ''}! It was a pleasure working with you — we appreciate the recommendation.`; }
  return r;
}

/* ---------- email monitor ---------- */
function monitorEmails(db, ctx) {
  const seen = new Set((db.reviews || []).map(r => r.author + (r.at || '')));
  let found = 0;
  const cfg = (db.settings.reputation) || {};
  for (const em of (db.emails || [])) {
    const text = ((em.subject || '') + ' ' + (em.body || '')).toLowerCase();
    const key = em.from + (em.sentAt || em.at || '');
    if (seen.has(key)) continue;
    const isBbb = /better business bureau|bbb\.org|complaint case|case #/.test(text);
    const isReview = /(google|yelp|facebook) (review|rating)|left you a review|new review|star review/.test(text);
    const isFinance = /(invoice|charge|billing|refund|payment).*(dispute|error|wrong|issue)|dispute/.test(text) && cfg.autoIntakeDisputes !== false;
    if (!isBbb && !isReview && !isFinance) continue;
    const source = isBbb ? 'bbb' : isReview ? (text.includes('yelp') ? 'yelp' : text.includes('facebook') ? 'facebook' : 'google') : 'email';
    const rating = (text.match(/(\d)\s*star/) || [])[1];
    const r = ingestReview(db, ctx.uid, { source, author: em.from, rating: rating ? +rating : null, text: em.subject + ' ' + (em.body || '').slice(0, 400) }, cfg.autoRespond);
    seen.add(key); found++;
    if (r.severity === 'high' || source === 'bbb') {
      ctx.notify(db.settings.quotes.approvalEmail,
        `⚠ ${source.toUpperCase()} ${r.sentiment} review — action needed`,
        `"${(r.text || '').slice(0, 120)}" — drafted response + remediation ready. Review in Reputation.`,
        ['in-app', 'email']);
      ctx.push && ctx.push('admin', `${source} ${r.sentiment} review needs approval`, (r.text || '').slice(0, 90), '/dashboard.html', { category: 'approval' });
    }
  }
  return found;
}

function stats(db) {
  const revs = db.reviews || [];
  const dis = db.disputes || [];
  const open = revs.filter(r => r.status === 'open' || r.status === 'thank-you-queued');
  return { totalReviews: revs.length, negative: revs.filter(r => r.sentiment === 'negative').length,
    positive: revs.filter(r => r.sentiment === 'positive').length, awaitingApproval: open.length,
    avgRating: revs.filter(r => r.rating).length ? (revs.filter(r => r.rating).reduce((s, r) => s + r.rating, 0) / revs.filter(r => r.rating).length).toFixed(1) : null,
    openDisputes: dis.filter(d => d.status === 'open').length, resolvedDisputes: dis.filter(d => d.status === 'resolved').length,
    bySource: ['bbb','google','yelp','facebook','email','manual'].map(s => ({ source: s, count: revs.filter(r => r.source === s).length })) };
}

module.exports = { CATEGORIES, classify, draftResponse, fileDispute, resolveDispute, ingestReview, monitorEmails, stats };
