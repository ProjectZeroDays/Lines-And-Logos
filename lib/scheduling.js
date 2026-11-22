/* Lines & Logos — Contractor Scheduling & Acceptance Gate.
 *
 * Flow:
 *   admin assigns job → offer goes to contractor (push + portal calendar)
 *   → contractor ACCEPTS, COUNTER-PROPOSES times, or declines (unavailable)
 *   → job reaches "crew confirmed" ONLY via an accepted offer
 *   → admin approves the customer work → AI sends the e-sign contract
 *   → contractor manages availability; offers respect it automatically.
 *
 * State machine (db.jobOffers):
 *   offered → accepted | countered → accepted(new time) | declined | expired
 * Admin approval is hard-gated on an accepted offer for the job.
 */
'use strict';

const OFFER_TTL_HOURS = 24;
const REMIND_AT_HOURS = 12;

function nowISO() { return new Date().toISOString(); }
function hoursSince(iso) { return (Date.now() - new Date(iso).getTime()) / 36e5; }

/* ---------- availability ---------- */
function isUnavailable(db, email, date) {
  const u = db.users.find(x => x.email === email);
  if (!u) return false;
  const blocked = (u.unavailable || []).map(d => String(d).slice(0, 10));
  return blocked.includes(String(date).slice(0, 10));
}
function setUnavailable(db, email, dates) {
  const u = db.users.find(x => x.email === email);
  if (!u) throw new Error('Contractor not found');
  u.unavailable = (dates || []).map(d => String(d).slice(0, 10));
  return u.unavailable;
}

/* ---------- offers ---------- */
function offerJob(db, uid, jobId, contractorEmail, proposedTime, ctx) {
  const job = db.jobs.find(j => j.id === jobId);
  if (!job) throw new Error('Job not found');
  const date = (proposedTime || job.startDate || '').slice(0, 10);
  if (isUnavailable(db, contractorEmail, date))
    throw new Error('Contractor is unavailable on ' + date + ' — pick another date or contractor');
  // close prior open offers for this job
  for (const o of db.jobOffers) if (o.jobId === jobId && ['offered', 'countered'].includes(o.status)) o.status = 'superseded';
  const offer = { id: uid('of'), jobId, jobTitle: job.title || job.name || 'Job', contractorEmail,
    date, time: proposedTime || job.startTime || null,
    status: 'offered', offeredAt: nowISO(), expiresAt: new Date(Date.now() + OFFER_TTL_HOURS * 36e5).toISOString(),
    history: [{ at: nowISO(), action: 'offered', by: ctx.admin || 'admin' }] };
  db.jobOffers.unshift(offer);
  job.crewStatus = 'offered'; job.contractorEmail = contractorEmail;
  ctx.logActivity(`Job offer ${offer.id} → ${contractorEmail} for "${offer.jobTitle}" (${date || 'date TBD'})`);
  ctx.push && ctx.push('contractor', `New job offer — ${offer.jobTitle}`,
    `${date || 'Date TBD'}${offer.time ? ' at ' + offer.time : ''}. Accept, propose new time, or decline.`, '/portal.html', { category: 'job' });
  ctx.notify(contractorEmail, `Job offer: ${offer.jobTitle}`, `${date || 'Date TBD'} — please accept or propose a time within ${OFFER_TTL_HOURS}h.`, ['in-app', 'email']);
  return offer;
}

/* contractor responds: accept | counter {date,time,reason} | decline {reason} */
function respond(db, offerId, email, action, payload, ctx) {
  const o = db.jobOffers.find(x => x.id === offerId);
  if (!o) throw new Error('Offer not found');
  if (o.contractorEmail !== email) throw new Error('Not your offer');
  if (!['offered', 'countered'].includes(o.status)) throw new Error('Offer already ' + o.status);
  const job = db.jobs.find(j => j.id === o.jobId);
  o.history.push({ at: nowISO(), action, by: email, ...(payload || {}) });

  if (action === 'accept') {
    o.status = 'accepted'; o.respondedAt = nowISO();
    if (job) { job.crewStatus = 'confirmed'; job.confirmedTime = o.time; job.confirmedDate = o.date; job.status = job.status === 'draft' ? 'pending-approval' : job.status; }
    ctx.logActivity(`Offer ${offerId} ACCEPTED by ${email}`);
    ctx.notify(db.settings.quotes.approvalEmail, `Crew confirmed — ${o.jobTitle}`,
      `${email} accepted ${o.date || ''} ${o.time || ''}. You can now approve the job and send the contract.`, ['in-app', 'email']);
    ctx.push && ctx.push('admin', `Crew confirmed — ${o.jobTitle}`, `${email} accepted. Approve to send contract.`, '/dashboard.html', { category: 'approval' });
  } else if (action === 'counter') {
    o.status = 'countered'; o.respondedAt = nowISO();
    o.date = (payload.date || o.date).slice(0, 10); o.time = payload.time || o.time;
    if (isUnavailable(db, email, o.date)) throw new Error('You are marked unavailable on ' + o.date);
    ctx.logActivity(`Offer ${offerId}: counter-proposal → ${o.date} ${o.time || ''} (${payload.reason || 'no reason'})`);
    ctx.notify(db.settings.quotes.approvalEmail, `Counter-proposal — ${o.jobTitle}`,
      `${email} proposes ${o.date}${o.time ? ' at ' + o.time : ''}${payload.reason ? ': "' + payload.reason + '"' : ''}. Accept their time or reassign.`, ['in-app', 'email']);
  } else if (action === 'decline') {
    o.status = 'declined'; o.respondedAt = nowISO(); o.reason = payload.reason || null;
    if (job) { job.crewStatus = 'needs-reassignment'; }
    ctx.logActivity(`Offer ${offerId} DECLINED by ${email}${payload.reason ? ' — ' + payload.reason : ''}`);
    ctx.notify(db.settings.quotes.approvalEmail, `Contractor unavailable — ${o.jobTitle}`,
      `${email} declined${payload.reason ? ': "' + payload.reason + '"' : ''}. Reassign before approving the customer.`, ['in-app', 'email']);
    ctx.push && ctx.push('admin', `Contractor unavailable — ${o.jobTitle}`, 'Reassign before customer approval.', '/dashboard.html', { category: 'job' });
  }
  return o;
}

/* admin accepts a counter-proposal (crew confirmed with new time) */
function acceptCounter(db, offerId, admin, ctx) {
  const o = db.jobOffers.find(x => x.id === offerId);
  if (!o || o.status !== 'countered') throw new Error('No counter-proposal to accept');
  o.status = 'accepted'; o.respondedAt = nowISO();
  o.history.push({ at: nowISO(), action: 'counter-accepted', by: admin });
  const job = db.jobs.find(j => j.id === o.jobId);
  if (job) { job.crewStatus = 'confirmed'; job.confirmedDate = o.date; job.confirmedTime = o.time; if (job.startDate !== o.date) job.startDate = o.date; }
  ctx.notify(o.contractorEmail, `Time confirmed — ${o.jobTitle}`, `Locked in: ${o.date}${o.time ? ' at ' + o.time : ''}.`, ['in-app', 'email']);
  ctx.logActivity(`Offer ${offerId}: counter-accepted by ${admin} → crew confirmed`);
  return o;
}

/* ---------- the approval gate ---------- */
function assertCrewConfirmed(db, jobId) {
  const ok = db.jobOffers.some(o => o.jobId === jobId && o.status === 'accepted');
  if (!ok) throw new Error('Crew not confirmed — a contractor must accept the job offer before customer approval.');
  return true;
}

/* ---------- AI contract send (post-acceptance + admin approval) ---------- */
function sendContract(db, uid, jobId, customerEmail, ctx) {
  assertCrewConfirmed(db, jobId);
  const job = db.jobs.find(j => j.id === jobId);
  const accepted = db.jobOffers.find(o => o.jobId === jobId && o.status === 'accepted');
  const contract = { id: uid('ct'), jobId, number: 'CT-' + new Date().getFullYear() + '-' + String(db.contracts.length + 101).padStart(3, '0'),
    clientEmail: customerEmail || (job && job.customerEmail) || null, jobTitle: job ? job.title : 'Job',
    amount: job ? job.amount : null, status: 'sent-for-signature', sentAt: nowISO(),
    confirmedCrew: accepted ? accepted.contractorEmail : null, confirmedDate: accepted ? accepted.date : null, confirmedTime: accepted ? accepted.time : null };
  db.contracts.unshift(contract);
  if (job) { job.contractSent = true; job.contractId = contract.id; job.status = 'contract-sent'; }
  ctx.logActivity(`Contract ${contract.number} sent for "${contract.jobTitle}" (crew: ${contract.confirmedCrew})`);
  ctx.notify(contract.clientEmail, `Your contract is ready — ${contract.jobTitle}`,
    `Review and e-sign: confirmed crew date ${contract.confirmedDate || 'TBD'}${contract.confirmedTime ? ' at ' + contract.confirmedTime : ''}.`, ['in-app', 'email']);
  return contract;
}

/* ---------- expiry / reminder sweep (runs on interval) ---------- */
function sweep(db, ctx) {
  let reminded = 0, expired = 0;
  for (const o of db.jobOffers) {
    if (o.status === 'offered' && !o.remindedAt && hoursSince(o.offeredAt) >= REMIND_AT_HOURS) {
      o.remindedAt = nowISO(); reminded++;
      ctx.push && ctx.push('contractor', `Reminder: job offer expires soon — ${o.jobTitle}`, 'Please accept, propose a time, or decline.', '/portal.html', { category: 'job' });
    }
    if (['offered', 'countered'].includes(o.status) && hoursSince(o.offeredAt) >= OFFER_TTL_HOURS) {
      o.status = 'expired'; expired++;
      const job = db.jobs.find(j => j.id === o.jobId);
      if (job) job.crewStatus = 'needs-reassignment';
      ctx.notify(db.settings.quotes.approvalEmail, `Job offer expired — ${o.jobTitle}`, `${o.contractorEmail} did not respond in ${OFFER_TTL_HOURS}h. Reassign before customer approval.`, ['in-app']);
    }
  }
  return { reminded, expired };
}

/* contractor's calendar: assigned + confirmed + offers needing response */
function contractorCalendar(db, email) {
  const offers = db.jobOffers.filter(o => o.contractorEmail === email && ['offered', 'countered', 'accepted'].includes(o.status));
  const jobs = db.jobs.filter(j => j.contractorEmail === email);
  return {
    needsResponse: offers.filter(o => ['offered', 'countered'].includes(o.status)),
    confirmed: offers.filter(o => o.status === 'accepted').map(o => ({ ...o, job: jobs.find(j => j.id === o.jobId) })),
    unavailable: (db.users.find(u => u.email === email) || {}).unavailable || [],
  };
}

module.exports = { OFFER_TTL_HOURS, isUnavailable, setUnavailable, offerJob, respond, acceptCounter, assertCrewConfirmed, sendContract, sweep, contractorCalendar };
