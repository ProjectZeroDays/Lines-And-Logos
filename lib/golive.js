/* Lines & Logos — Go Live feature.
 *
 * Webflow: dashboard banner → wizard (golive.html):
 *   1. Welcome & readiness score
 *   2. Erase demo content (typed confirmation, shows keep/remove lists)
 *   3. Launch checklist — 5 phases, mark done, set per-task deadlines
 *   4. Timeline — target launch date → auto milestones on calendar + reminders
 *   5. Go Live — locks the wizard, announces, starts the reminder engine
 *
 * State lives in db.settings.goLive; tasks in db.launchTasks (seeded on first
 * wizard open). Demo erase preserves: users (login keeps working), settings
 * (company identity), and the goLive block itself.
 */
'use strict';

/* ---------- launch checklist: 5 phases, business launch for a facility-branding co ---------- */
const PHASES = [
  { key: 'foundation', name: 'Foundation & Legal', hint: 'Everything the business stands on', tasks: [
    'Confirm business entity & EIN are registered',
    'Bind general liability + workers\' comp insurance',
    'Open business bank account',
    'Verify payment processing (card + ACH) with a test transaction',
    'Set up accounting (chart of accounts, invoicing, expense tracking)',
  ]},
  { key: 'brand', name: 'Brand & Web Presence', hint: 'What customers see first', tasks: [
    'Connect your domain & confirm SSL (https) is live',
    'Claim & verify Google Business Profile',
    'Replace demo gallery photos with real project photos',
    'Publish service-area pages (400-mile radius)',
    'Turn on the review-collection pipeline',
  ]},
  { key: 'ops', name: 'Operations', hint: 'Delivering jobs consistently', tasks: [
    'Finalize pricing sheets & quote templates',
    'Get contract templates approved by your attorney',
    'Open supplier accounts (paint, vinyl, flooring, hardware)',
    'Hire/train crew — employees & contractor partners',
    'Stock equipment & materials; set reorder points',
  ]},
  { key: 'marketing', name: 'Marketing & Pipeline', hint: 'Filling the calendar', tasks: [
    'Schedule the launch promotion (offer + creative)',
    'Prepare Google Ads / local SEO campaign',
    'Build the outreach list (schools, churches, parks, rec depts)',
    'Set up email capture + follow-up sequences',
  ]},
  { key: 'launch', name: 'Launch Day', hint: 'Flip the switch with confidence', tasks: [
    'Confirm security scan & self-heal watchdog are armed',
    'Schedule phone/support coverage for launch week',
    'Write the first-job protocol (intake → quote → contract)',
    'Run a backup & disaster-recovery drill',
    'Press GO — set the app live',
  ]},
];

/* Collections wiped by demo-erase (operational/demo data only) */
const DEMO_COLLECTIONS = [
  'accounts','contacts','leads','quotes','quoteRequests','jobs','timeEntries','checklists','checklistRuns',
  'invoices','expenses','payments','tasks','gallery','reviews','inquiries','chats','contracts','inventory',
  'inventoryTx','events','messages','emails','reminders','passwordResets','purchaseOrders','calendarNotes',
  'tripPlans','travelEvents','candidates','employees','vendors','content','campaigns','tickets','feedback',
  'employeeOnboardings','clientOnboardings','surveys','followUps','payouts','financialAlerts','crmVisitors',
  'affiliates','commissions','interviews','hirePackages','filings','seoAudits','securityFindings','disclosures',
  'workflows','workflowRuns','brandAssets','improvements','recommendations','exitTracker',
];

function now() { return new Date().toISOString(); }

/* ---------- state ---------- */
function state(db) {
  db.settings.goLive = db.settings.goLive || {};
  return db.settings.goLive;
}
function ensureTasks(db, uidFn) {
  if (db.launchTasks && db.launchTasks.length) return db.launchTasks;
  db.launchTasks = [];
  let order = 0;
  for (const ph of PHASES)
    for (const t of ph.tasks)
      db.launchTasks.push({ id: uidFn('lt'), phase: ph.key, phaseName: ph.name, text: t, done: false, due: null, order: order++ });
  return db.launchTasks;
}
function progress(db) {
  const tasks = db.launchTasks || [];
  const done = tasks.filter(t => t.done).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const overdue = tasks.filter(t => !t.done && t.due && new Date(t.due) < new Date());
  const phases = PHASES.map(ph => {
    const pt = tasks.filter(t => t.phase === ph.key);
    return { key: ph.key, name: ph.name, hint: ph.hint, done: pt.filter(t => t.done).length, total: pt.length,
      pct: pt.length ? Math.round(pt.filter(t => t.done).length / pt.length * 100) : 0 };
  });
  return { tasks: tasks.length, done, pct, overdue: overdue.length, overdueTasks: overdue.map(t => ({ id: t.id, text: t.text, due: t.due })), phases };
}

/* ---------- demo erase ---------- */
function eraseDemo(db, ctx) {
  const st = state(db);
  if (st.status === 'live') throw new Error('App is already live — demo erase is disabled.');
  const removed = {};
  for (const c of DEMO_COLLECTIONS) {
    const n = Array.isArray(db[c]) ? db[c].length : 0;
    if (n) removed[c] = n;
    db[c] = [];
  }
  // keep: users (login keeps working), settings (company identity), goLive block
  st.erasedDemo = true; st.erasedAt = now();
  ctx.save(); ctx.logActivity(`Go Live: demo content erased (${Object.keys(removed).length} collections cleared)`);
  return { removed, kept: ['users', 'settings', 'goLive state'] };
}

/* ---------- milestones → calendar events + reminders ---------- */
function syncMilestones(db, uidFn) {
  const st = state(db);
  const out = { events: 0, reminders: 0 };
  if (!st.launchDate) return out;
  const launch = new Date(st.launchDate);
  const MILESTONES = [
    { offsetDays: -21, title: 'Milestone — Foundation & Legal complete', phase: 'foundation' },
    { offsetDays: -14, title: 'Milestone — Brand & Web complete', phase: 'brand' },
    { offsetDays: -7, title: 'Milestone — Operations ready', phase: 'ops' },
    { offsetDays: -3, title: 'Milestone — Marketing live', phase: 'marketing' },
    { offsetDays: 0, title: '🚀 LAUNCH DAY — Lines & Logos is live', phase: 'launch' },
  ];
  // remove previously auto-created golive milestones to avoid duplicates
  db.events = (db.events || []).filter(e => !(e.meta && e.meta.goLive));
  db.reminders = (db.reminders || []).filter(r => !(r.meta && r.meta.goLive));
  for (const m of MILESTONES) {
    const at = new Date(launch.getTime() + m.offsetDays * 864e5).toISOString().slice(0, 10);
    db.events.push({ id: uidFn('ev'), title: m.title, type: 'milestone', at, meta: { goLive: true, phase: m.phase } });
    out.events++;
    if (m.offsetDays < 0) {
      for (const lead of [7, 2, 1]) {
        const remAt = new Date(launch.getTime() + (m.offsetDays - lead) * 864e5).toISOString().slice(0, 10);
        db.reminders.push({ id: uidFn('rm'), text: `${m.title} — in ${lead} day(s)`, at: remAt, done: false, meta: { goLive: true, milestone: m.title, launchDate: st.launchDate } });
        out.reminders++;
      }
    }
  }
  ctx.save();
  return out;
}

/* ---------- go live ---------- */
function goLive(db, ctx) {
  const st = state(db);
  if (st.status === 'live') throw new Error('Already live.');
  const p = progress(db);
  st.status = 'live'; st.liveAt = now(); st.progressAtLaunch = p.pct;
  ctx.save();
  ctx.notify(null, '🚀 Lines & Logos is LIVE', `Launched with launch checklist ${p.pct}% complete. The Improvement Agent, Security Agent and Self-Heal Watchdog are on duty.`, ['in-app']);
  ctx.logActivity(`Go Live: app launched (checklist ${p.pct}% at launch)`);
  return st;
}

/* ---------- reminder engine (runs on interval) ---------- */
function reminderSweep(db, ctx) {
  const st = state(db);
  if (!st.launchDate || st.reminded === 'live-done') return { nudges: 0 };
  const launch = new Date(st.launchDate);
  const daysLeft = Math.ceil((launch - Date.now()) / 864e5);
  const p = progress(db);
  let nudges = 0;
  const key = 'gl_' + new Date().toISOString().slice(0, 10);
  if (st.lastNudge === key) return { nudges: 0 };   // once per day max
  const lines = [];
  if (p.overdue > 0) { lines.push(`${p.overdue} launch task(s) overdue.`); }
  if (daysLeft <= 7 && daysLeft > 0 && p.pct < 100) { lines.push(`Launch in ${daysLeft} day(s) — checklist ${p.pct}% done.`); }
  if (daysLeft === 1) { lines.push('Launch is TOMORROW — final checks today.'); }
  if (daysLeft <= 0 && st.status !== 'live') { lines.push('Launch date reached — ready to flip the switch?'); }
  if (lines.length) {
    st.lastNudge = key; nudges = 1;
    ctx.notify(db.settings.quotes ? db.settings.quotes.approvalEmail : null,
      'Go Live on track?', lines.join(' '), ['in-app', 'email']);
    ctx.save();
  }
  return { nudges, daysLeft, pct: p.pct };
}

module.exports = { PHASES, DEMO_COLLECTIONS, state, ensureTasks, progress, eraseDemo, syncMilestones, goLive, reminderSweep };
