/* Lines & Logos — Exit & Acquisition Advisor
 * Stage-by-stage playbook for selling the company and handing off the
 * app + business. Pure data + pure functions — no server deps, fully
 * testable in isolation. Wired into server.js routes and the dashboard.
 */
'use strict';

/* The six stages of a sale, in order. durationWeeks is a planning estimate
 * for a services+software SMB; scale up if a formal process is run. */
const STAGES = [
  {
    key: 'readiness', n: 1, name: 'Preparation & Readiness',
    goal: 'Decide to sell, get the business and yourself exit-ready.',
    durationWeeks: '4–8',
    steps: [
      { id: 'r1', text: 'Define your why (retirement, new venture, burnout) and non-negotiables (price floor, terms, stay-on period)', link: null },
      { id: 'r2', text: 'Assemble the deal team: M&A attorney, CPA/tax advisor, and decide broker vs. direct outreach', link: 'https://www.sba.gov/business-guide/plan-your-business/transfer-ownership' },
      { id: 'r3', text: 'Tax positioning review with CPA — entity structure, capital gains, QSBS eligibility, state residency', link: 'https://www.irs.gov/businesses/small-businesses-self-employed' },
      { id: 'r4', text: 'Clean up financials: 3 years P&L, balance sheet, recurring vs. one-time revenue split, owner add-backs (SDE)', link: null },
      { id: 'r5', text: 'Remove owner-dependence: document key processes, delegate or cross-train, write the owner role description', link: null },
      { id: 'r6', text: 'Resolve legal loose ends: contracts assignable? customer consent clauses? liens, disputes, compliance gaps', link: null },
      { id: 'r7', text: 'Separate personal from business: accounts, equipment, vehicles, IP ownership (see Stage 3 app handoff)', link: null },
      { id: 'r8', text: 'Set a confidential timeline and decide what staff/founders are told, and when', link: null },
    ],
    resources: [
      { name: 'SBA — Transfer Ownership guide', url: 'https://www.sba.gov/business-guide/plan-your-business/transfer-ownership' },
      { name: 'SCORE — Exit planning mentors (free)', url: 'https://www.score.org/' },
      { name: 'Owner add-backs / SDE worksheet', url: 'https://www.bizbuysell.com/' },
    ],
  },
  {
    key: 'valuation', n: 2, name: 'Valuation',
    goal: 'Establish a defensible asking range for the business.',
    durationWeeks: '2–4',
    steps: [
      { id: 'v1', text: 'Value the services business: SDE × industry multiple (facility services typically 2.5–4× SDE)', link: 'https://www.bizbuysell.com/' },
      { id: 'v2', text: 'Value the software separately: ARR × SaaS multiple (typically 3–6× ARR) if it stands alone', link: 'https://mergersandinquisitions.com/' },
      { id: 'v3', text: 'Decide: one integrated sale vs. asset split (services co + software co) — get CPA + attorney input', link: null },
      { id: 'v4', text: 'Run two valuation methods (market comparables + income/DCF) and reconcile the range', link: null },
      { id: 'v5', text: 'Document value drivers: recurring contracts, renewal rates, pipeline, code quality, uptime, documented ops', link: null },
      { id: 'v6', text: 'Set asking price, target price, and walk-away floor; write the one-page deal thesis', link: null },
    ],
    resources: [
      { name: 'BizBuySell — sold-comps database', url: 'https://www.bizbuysell.com/' },
      { name: 'Axial — lower-middle-market network', url: 'https://www.axial.net/' },
      { name: 'Quiet Light / FE International — digital & SaaS comps', url: 'https://quietlight.com/' },
    ],
  },
  {
    key: 'packaging', n: 3, name: 'Packaging & Data Room',
    goal: 'Build the CIM (confidential info memorandum) and a clean handoff package — including the app.',
    durationWeeks: '3–6',
    steps: [
      { id: 'p1', text: 'Write the CIM: story, market, financials (add-back adjusted), customers, team, growth plan', link: null },
      { id: 'p2', text: 'Build the data room: financials, tax returns, contracts, employee roster, insurance, licenses', link: 'https://www.docsend.com/' },
      { id: 'p3', text: 'APP HANDOFF — Code: export the repo (GitHub), document architecture, build/run instructions, env vars (never commit secrets)', link: 'https://docs.github.com/en/repositories/archiving-a-github-repository' },
      { id: 'p4', text: 'APP HANDOFF — Runtime: list hosting (VPS/PaaS), DNS registrar, domains, SSL, backups, cron/scheduler jobs', link: null },
      { id: 'p5', text: 'APP HANDOFF — Accounts: admin credentials via a password vault handoff (Bitwarden/1Password transfer), API keys, email/SMS sender accounts, payment processor', link: 'https://bitwarden.com/' },
      { id: 'p6', text: 'APP HANDOFF — Data: document db.json collections + retention, export a clean data snapshot, write the restore drill', link: null },
      { id: 'p7', text: 'APP HANDOFF — Ops: incident runbook, deploy steps, monitoring, the workflow/agent inventory (this OS self-documents via /api/agents)', link: null },
      { id: 'p8', text: 'Prepare NDAs + blind profile for buyer outreach', link: null },
    ],
    resources: [
      { name: 'Docsend / Firmex — data rooms', url: 'https://www.docsend.com/' },
      { name: 'GitHub — archive/export repository', url: 'https://docs.github.com/en/repositories/archiving-a-github-repository' },
      { name: 'Bitwarden — credential vault handoff', url: 'https://bitwarden.com/' },
    ],
  },
  {
    key: 'marketing', n: 4, name: 'Marketing & Buyer Outreach',
    goal: 'Reach strategic and financial buyers under NDA.',
    durationWeeks: '4–12',
    steps: [
      { id: 'm1', text: 'Profile buyer types: strategic (facilities cos, sports surfacing cos, ed-tech), PE search funds, individual operators', link: null },
      { id: 'm2', text: 'Decide broker vs. self-run; if broker, interview 3 (fee ~8–10%, minimums, their buyer list)', link: 'https://www.bizbuysell.com/' },
      { id: 'm3', text: 'List on marketplaces (BizBuySell, Axial, industry buyers) with blind teaser', link: null },
      { id: 'm4', text: 'Direct outreach: 20–40 named strategic buyers with a tailored one-pager', link: null },
      { id: 'm5', text: 'Screen inbound: NDA first, then CIM, then intro call; qualify funds and intent', link: null },
      { id: 'm6', text: 'Track every buyer in the CRM (this OS: add them as leads with stage tags)', link: null },
      { id: 'm7', text: 'Collect IOIs (indications of interest); shortlist 2–4 to advance', link: null },
    ],
    resources: [
      { name: 'BizBuySell — listing platform', url: 'https://www.bizbuysell.com/' },
      { name: 'Axial — private deal network', url: 'https://www.axial.net/' },
      { name: 'IBBA — business broker directory', url: 'https://ibba.org/' },
    ],
  },
  {
    key: 'diligence', n: 5, name: 'Due Diligence',
    goal: 'Survive QofE, legal, and technical diligence to a signed LOI.',
    durationWeeks: '4–8',
    steps: [
      { id: 'd1', text: 'Negotiate the LOI: price, structure (asset vs. stock), earn-out, escrow/holdback (typ. 10–15%), exclusivity window, non-compete', link: null },
      { id: 'd2', text: 'Quality of Earnings: reconcile tax returns to P&L; be ready to defend add-backs', link: null },
      { id: 'd3', text: 'Legal diligence: contracts assignability, customer concentration, employment/IC classification, litigation', link: null },
      { id: 'd4', text: 'TECHNICAL DILIGENCE — app: walk buyer’s engineer through architecture, dependencies, test/deploy, and this OS’s agent/workflow inventory', link: null },
      { id: 'd5', text: 'TECHNICAL DILIGENCE — data: verify data integrity, backups restore drill, security posture (run the Security Agent scan report)', link: null },
      { id: 'd6', text: 'Customer calls: pick 5–8 reference accounts; brief them on messaging', link: null },
      { id: 'd7', text: 'Manage the data-room request list; answer in 24–48h cadence', link: null },
      { id: 'd8', text: 'Definitive agreement drafted (APA or SPA); close escrow, reps & warranties, transition services agreement (TSA)', link: null },
    ],
    resources: [
      { name: 'QoE overview — MBA stack', url: 'https://mergersandinquisitions.com/' },
      { name: 'Stripe Atlas — asset purchase basics', url: 'https://stripe.com/guides/atlas' },
    ],
  },
  {
    key: 'transition', n: 6, name: 'Closing & Handoff',
    goal: 'Close, transfer everything, and exit on a 30/60/90 plan.',
    durationWeeks: '2–6',
    steps: [
      { id: 't1', text: 'Close: funds wired, escrow funded, signatures; announce to staff with retention/role clarity', link: null },
      { id: 't2', text: 'Day-1 transfer checklist: bank accounts, merchant/payment processor, payroll, insurance, licenses', link: null },
      { id: 't3', text: 'APP TRANSFER: domain registrar + DNS, hosting account, email/SMS providers, GitHub org transfer, vault handoff, revoke-then-grant admin access', link: 'https://docs.github.com/en/organizations/managing-organization-settings/transferring-organization-ownership' },
      { id: 't4', text: 'APP TRANSFER: run a joint restore drill with the buyer; hand over runbooks, cron/workflow inventory, monitoring access', link: null },
      { id: 't5', text: 'Execute the TSA: your consulting/transition hours, availability windows, response SLAs', link: null },
      { id: 't6', text: '30/60/90 plan: introduce buyer to top accounts, shadow key workflows, then step back', link: null },
      { id: 't7', text: 'Final: release from non-compete terms review, retain copies per agreement, close out', link: null },
    ],
    resources: [
      { name: 'GitHub — org ownership transfer', url: 'https://docs.github.com/en/organizations/managing-organization-settings/transferring-organization-ownership' },
      { name: 'SBA — complete transfer checklist', url: 'https://www.sba.gov/business-guide/plan-your-business/transfer-ownership' },
    ],
  },
];

const ORDER = STAGES.map(s => s.key);

/* tracker: persisted per-owner checklist state */
function emptyTracker() {
  const done = {};
  for (const s of STAGES) for (const st of s.steps) done[st.id] = false;
  return { done, notes: {}, startedAt: new Date().toISOString() };
}
function createTracker(existing) {
  const t = emptyTracker();
  if (existing && existing.done) Object.assign(t.done, existing.done);
  if (existing && existing.notes) t.notes = existing.notes || {};
  if (existing && existing.startedAt) t.startedAt = existing.startedAt;
  return t;
}

/* pure progress computation from a tracker */
function computeProgress(tracker) {
  const stages = STAGES.map(s => {
    const done = s.steps.filter(st => tracker.done[st.id]).length;
    return {
      key: s.key, n: s.n, name: s.name, goal: s.goal, durationWeeks: s.durationWeeks,
      stepsTotal: s.steps.length, stepsDone: done,
      pct: s.steps.length ? Math.round(done / s.steps.length * 100) : 0,
    };
  });
  const totalSteps = STAGES.reduce((n, s) => n + s.steps.length, 0);
  const totalDone = stages.reduce((n, s) => n + s.stepsDone, 0);
  let current = ORDER.find(k => {
    const s = STAGES.find(x => x.key === k);
    return s.steps.some(st => !tracker.done[st.id]);
  }) || ORDER[ORDER.length - 1];
  return {
    stages,
    overall: { stepsDone: totalDone, stepsTotal: totalSteps, pct: totalSteps ? Math.round(totalDone / totalSteps * 100) : 0 },
    currentStage: current,
    complete: totalDone === totalSteps,
  };
}

/* the advisor’s nudge text, derived from state (used by the agent runner) */
function advise(tracker, biz) {
  const p = computeProgress(tracker);
  const s = STAGES.find(x => x.key === p.currentStage);
  const next = s.steps.find(st => !tracker.done[st.id]);
  const lines = [
    `Exit readiness: ${p.overall.pct}% — currently at Stage ${s.n}: ${s.name}.`,
    next ? `Next step: ${next.text}` : 'Stage complete — move to the next stage.',
  ];
  if (biz && biz.recurringRevenuePct != null && biz.recurringRevenuePct < 30)
    lines.push('Advisor note: recurring revenue under 30% of total will pressure the multiple — consider structuring maintenance/service contracts before going to market.');
  if (p.overall.pct === 100) lines.push('All stages complete — you are deal-ready. Export the data room and engage buyers.');
  return lines.join('\n');
}

module.exports = { STAGES, ORDER, emptyTracker, createTracker, computeProgress, advise };
