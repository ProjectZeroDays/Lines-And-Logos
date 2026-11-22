/* Lines & Logos — Business Valuation Agent.
 *
 * Continuously monitors the business and calculates its worth from live app
 * data: P/L, clients, leads & conversion, recurring revenue, employees,
 * machines, inventory, marketing/ad performance, plus the app itself as a
 * software asset. Produces:
 *   - a live valuation + value-readiness score (0–100)
 *   - an improvement plan: ordered steps, each with value impact, steps,
 *     tools, links, phone/email where relevant
 *   - a full valuation report (markdown) for owners/lenders/buyers
 *   - handoff branching: asks the new owner same-name vs rebrand and runs the
 *     matching setup workflow
 */
'use strict';

/* ---------- data gathering ---------- */
function last12(coll, dateField, valueField) {
  const cutoff = new Date(Date.now() - 365 * 864e5);
  return (coll || []).filter(r => r[dateField] && new Date(r[dateField]) >= cutoff)
    .reduce((s, r) => s + (parseFloat(r[valueField]) || 0), 0);
}
function gatherData(db) {
  const clients = db.accounts || [];
  const leads = db.leads || [];
  const invoices = db.invoices || [];
  const expenses = db.expenses || [];
  const now = new Date();

  const revenue12 = last12(invoices.map(i => ({ ...i, d: i.date || i.createdAt })), 'd', 'amount');
  const expenses12 = last12(expenses.map(e => ({ ...e, d: e.date || e.createdAt })), 'd', 'amount');
  const netProfit = revenue12 - expenses12;
  // SDE = net profit + owner compensation + one-time add-backs (est. owner comp from settings or $60k default)
  const ownerComp = (db.settings.pricing && db.settings.pricing.ownerComp) || 60000;
  const oneTimeAddBacks = (db.settings.valuation && db.settings.valuation.addBacks) || 15000;
  const sde = Math.max(0, netProfit + ownerComp + oneTimeAddBacks);

  // recurring revenue: invoices tied to maintenance contracts / repeat accounts
  const recurring = invoices.filter(i => /maintenance|recoat|program|subscription|monthly|annual/i.test(i.item || i.note || i.title || ''))
    .reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const recurringPct = revenue12 ? Math.round(recurring / revenue12 * 100) : 0;

  // conversion
  const converted = leads.filter(l => l.status === 'converted' || l.stage === 'won' || clients.some(c => c.email && c.email === l.email)).length;
  const conversionRate = leads.length ? Math.round(converted / leads.length * 100) : 0;

  // employees & machines
  const employees = (db.users || []).filter(u => u.role !== 'client' && u.role !== 'partner' && u.role !== 'affiliate' && u.active !== false);
  const machines = (db.inventory || []).filter(i => /sander|sprayer|strip|machine|drum|edger|buffer|coater|lift|trailer|compressor/i.test(i.name || i.category || ''));
  const machineCount = machines.length;
  const machineValue = machines.reduce((s, m) => s + (parseFloat(m.unitCost || m.cost || m.price) || 0) * (m.stock || 1), 0);
  const inventoryValue = (db.inventory || []).reduce((s, i) => s + (parseFloat(i.unitCost || i.cost || i.price) || 0) * (i.stock || 0), 0);

  // marketing & ad performance
  const campaigns = db.campaigns || [];
  const adSpend = campaigns.reduce((s, c) => s + (parseFloat(c.spend) || 0), 0);
  const adRevenue = campaigns.reduce((s, c) => s + (parseFloat(c.revenue) || 0), 0);
  const roas = adSpend ? +(adRevenue / adSpend).toFixed(2) : null;

  // client concentration (top client share of revenue)
  const byClient = {};
  for (const i of invoices) { const k = i.accountId || i.client || 'unknown'; byClient[k] = (byClient[k] || 0) + (parseFloat(i.amount) || 0); }
  const topShare = revenue12 ? Math.round(Math.max(0, ...Object.values(byClient)) / revenue12 * 100) : 0;

  // seasoning: months since earliest business record
  const dates = [...invoices.map(i => i.date || i.createdAt), ...leads.map(l => l.createdAt)].filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d));
  const earliest = dates.length ? new Date(Math.min(...dates)) : now;
  const seasoningMonths = Math.max(1, Math.round((now - earliest) / (30.4 * 864e5)));

  // growth: revenue this 6mo vs prior 6mo
  const sixMoAgo = new Date(now.getTime() - 183 * 864e5);
  const twelveMoAgo = new Date(now.getTime() - 365 * 864e5);
  const revRecent = invoices.filter(i => { const d = new Date(i.date || i.createdAt || 0); return d >= sixMoAgo; }).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const revPrior = invoices.filter(i => { const d = new Date(i.date || i.createdAt || 0); return d >= twelveMoAgo && d < sixMoAgo; }).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const growthPct = revPrior ? Math.round((revRecent - revPrior) / revPrior * 100) : 0;

  return { clients: clients.length, leads: leads.length, converted, conversionRate,
    revenue12, expenses12, netProfit, sde, ownerComp, oneTimeAddBacks, recurring, recurringPct,
    employees: employees.length, machines: machineCount, machineValue, inventoryValue,
    campaigns: campaigns.length, adSpend, adRevenue, roas, topShare,
    seasoningMonths, growthPct, reviews: (db.reviews || []).length,
    positiveReviews: (db.reviews || []).filter(r => r.sentiment === 'positive').length };
}

/* ---------- valuation ---------- */
function computeValuation(d, db) {
  // services multiple: 2.5–4× SDE, driven by recurring % + growth + concentration
  let multiple = 2.5;
  if (d.recurringPct >= 30) multiple += 0.5;
  if (d.recurringPct >= 50) multiple += 0.5;
  if (d.growthPct > 10) multiple += 0.3;
  if (d.growthPct > 30) multiple += 0.2;
  if (d.topShare < 25) multiple += 0.2;
  if (d.topShare > 50) multiple -= 0.5;
  multiple = Math.min(4, +multiple.toFixed(2));
  const servicesValue = Math.round(d.sde * multiple);

  // software value: the app itself (ARR proxy = recurring) + suite replacement cost floor
  const arr = d.recurring;
  const softwareValue = arr > 0 ? Math.round(arr * 3.5) : 80000; // replacement-cost floor when no ARR yet

  const assetsValue = Math.round(d.inventoryValue + d.machineValue);
  const total = servicesValue + softwareValue + assetsValue;

  // value-readiness score (0–100): how sellable/polished the business is
  const score = Math.max(0, Math.min(100, Math.round(
    15 * Math.min(1, d.recurringPct / 40) +          // recurring revenue up to 40%
    10 * Math.min(1, d.growthPct / 30) +               // growth
    10 * (d.topShare < 25 ? 1 : d.topShare < 40 ? 0.6 : 0.2) +  // concentration
    10 * Math.min(1, d.clients / 25) +                // client base
    10 * Math.min(1, d.conversionRate / 20) +         // sales machine
    10 * (d.seasoningMonths >= 24 ? 1 : d.seasoningMonths / 24) + // seasoning
    10 * Math.min(1, (d.employees >= 3 ? 0.5 : d.employees / 6) + (d.machines >= 3 ? 0.5 : d.machines / 6)) + // team+equipment
    10 * Math.min(1, d.reviews / 10) +                // social proof
    5 * (d.roas && d.roas > 2 ? 1 : d.roas && d.roas > 1 ? 0.5 : 0) + // marketing efficiency
    5 * 1                                            // documented systems (the app itself)
  )));

  return { servicesValue, servicesMultiple: multiple, softwareValue, assetsValue, total, score };
}

/* ---------- improvement plan ---------- */
function improvementPlan(d, v) {
  const steps = [];
  if (d.recurringPct < 30) steps.push({
    title: 'Build recurring revenue to 30%+ of total', impact: `could add ~$${Math.round(d.sde * 0.5).toLocaleString()}–${Math.round(d.sde * 1).toLocaleString()} to valuation`,
    why: `Recurring maintenance contracts lift your multiple from ~2.5× toward 4× SDE. Currently ${d.recurringPct}%.`,
    steps: [
      '1. Create a "Court Care Plan": annual recoat + quarterly inspection, priced at ~10% of a full refinish',
      '2. Offer it to every completed job — the Logistics Agent can add it to the post-job follow-up email',
      '3. Target: sign 10 maintenance accounts in 90 days; the suite already invoices + reminds automatically',
      '4. Track in Marketing → Campaigns as "Maintenance Plan" to watch take-rate',
    ],
    tools: 'Use the existing Invoices + Reminders engine. Script template: "Protect your floor for $X/mo — we handle everything."',
    links: [{ name: 'BBJ maintenance program model (industry benchmark)', url: 'https://www.gymfloors.com/' }] });
  if (d.topShare > 40) steps.push({
    title: 'Reduce client concentration below 25%', impact: 'multiple +0.2–0.5× SDE',
    why: `Your largest client is ${d.topShare}% of revenue — buyers/lenders discount concentrated revenue heavily.`,
    steps: [
      '1. Set a rule: no new client exceeds 15% of annual revenue',
      '2. Activate the dormant leads list (Sales tab) — re-quote 20 past leads this month',
      '3. Add 2 nearby markets from the 400-mile radius (city pages from the GAP analysis)',
    ],
    tools: 'Leads pipeline + quotes engine already in the suite.',
    links: [{ name: 'SBA: diversify your customer base', url: 'https://www.sba.gov/business-guide/manage-your-business' }] });
  if (d.growthPct < 10) steps.push({
    title: 'Accelerate growth above 10% YoY', impact: 'multiple +0.3× SDE + directly raises SDE',
    why: `Recent 6-mo growth is ${d.growthPct}%. Growing revenue grows both the numerator and the multiple.`,
    steps: [
      '1. Publish the pricing-guide + city landing pages (GAP analysis P0) — cheapest lead source',
      '2. Claim Google Business Profile + start review asks on every job (Reputation Agent drafts them)',
      '3. Book 5 site surveys/week using the scheduling gate (crew-confirmed before you promise dates)',
      '4. Raise prices 5–8% — floor refinishing has pricing power with schools (budget cycles, low price sensitivity)',
    ],
    tools: 'GBP: google.com/business · Reviews pipeline in Reputation tab.',
    links: [{ name: 'Google Business Profile', url: 'https://www.google.com/business/' }] });
  if (d.reviews < 10) steps.push({
    title: 'Build social proof to 25+ Google reviews', impact: 'score +up to 10 pts, lifts conversion ~15%',
    why: `You have ${d.reviews} monitored reviews. Schools check references; buyers discount unproven demand.`,
    steps: [
      '1. Reputation Agent → enable auto thank-you + low-risk responses',
      '2. Text the review link (google.com/maps place link) to every customer at job completion',
      '3. Ask 3 anchor clients (schools) for written testimonials for the case-study page',
    ],
    tools: 'Reputation tab review intake; Go Live checklist "review pipeline" step.',
    links: [{ name: 'Get your Google review link', url: 'https://support.google.com/business/answer/3474122' }] });
  if (d.campaigns === 0) steps.push({
    title: 'Stand up measurable marketing', impact: 'feeds the growth engine; ROAS >2 adds score',
    why: 'No campaigns tracked — you cannot improve what you do not measure.',
    steps: [
      '1. Start Google Local Service Ads (pay per lead, ~$30–80/lead in trades) — phone: 1-866-2LSA-ADS',
      '2. Or Google Ads search on "gym floor refinishing [city]" — set $500/mo test budget',
      '3. Log spend + attributed revenue in Marketing → Campaigns monthly',
    ],
    tools: 'LSA: support.google.com/localservices · Campaigns tab.',
    links: [{ name: 'Google Local Service Ads', url: 'https://ads.google.com/local-services-ads/' }] });
  steps.push({
    title: 'Document the business for transferability (raises buyer confidence)', impact: 'broader buyer pool + faster sale',
    why: 'A documented business sells faster and for more. The app itself is your documentation.',
    steps: [
      '1. Complete the Exit Advisor Stage 3 data-room checklist (it lists exactly what buyers ask for)',
      '2. Keep P/L clean in Finance — buyers/lenders price off tax returns + P&L',
      '3. Run the self-test (Go Live tab) so a technical buyer sees a healthy codebase',
    ],
    tools: 'Exit Advisor tab + Self-test harness.',
    links: [{ name: 'SBA transfer-ownership guide', url: 'https://www.sba.gov/business-guide/plan-your-business/transfer-ownership' }] });
  return steps;
}

/* ---------- full report ---------- */
const APP_FEATURES = [
  'AI agent suite: logistics/travel with map+contract emails, SEO, security w/ coordinated disclosure, self-healing watchdog, continuous improvement, scheduling & crew-acceptance gate, reputation & disputes, valuation, licensing/insurance tracking',
  'Business suite: CRM, quotes, e-sign contracts, invoicing, expenses, P/L, calendar, inventory, purchase orders, trip planning',
  'Portals: client, crew/contractor, affiliate — role-gated, PWA-installable with lock-screen push',
  'Go Live wizard with launch checklist + milestone reminders; exit/sale advisor with 6-stage playbook',
  'Self-test harness (up to 1000-pass regression loop), GitHub/Slack/webhook integrations',
];
function generateReport(db) {
  const d = gatherData(db);
  const v = computeValuation(d, db);
  const plan = improvementPlan(d, v);
  const now = new Date().toISOString().slice(0, 10);
  const md = [
    `# Business Valuation Report — Lines & Logos`, ``,
    `_Generated by the Valuation Agent on ${now}_`, ``,
    `## Headline valuation: **$${v.total.toLocaleString()}**  ·  Value-readiness score: **${v.score}/100**`, ``,
    `| Component | Value | Basis |`, `|---|---|---|`,
    `| Services business | $${v.servicesValue.toLocaleString()} | $${Math.round(d.sde).toLocaleString()} SDE × ${v.servicesMultiple}× |`,
    `| Software (this app) | $${v.softwareValue.toLocaleString()} | ${d.recurring > 0 ? '$' + d.recurring.toLocaleString() + ' recurring × 3.5' : 'replacement-cost floor'} |`,
    `| Tangible assets | $${v.assetsValue.toLocaleString()} | $${Math.round(d.inventoryValue).toLocaleString()} inventory + $${Math.round(d.machineValue).toLocaleString()} equipment |`, ``,
    `## Business fundamentals`,
    `- **Seasoning:** ${d.seasoningMonths} months in operation`,
    `- **Clients:** ${d.clients} active · **Leads:** ${d.leads} lifetime · **Conversion:** ${d.conversionRate}%`,
    `- **Revenue (12 mo):** $${Math.round(d.revenue12).toLocaleString()} · **Expenses:** $${Math.round(d.expenses12).toLocaleString()} · **Net:** $${Math.round(d.netProfit).toLocaleString()}`,
    `- **SDE:** $${Math.round(d.sde).toLocaleString()} (net + $${d.ownerComp} owner comp + $${d.oneTimeAddBacks} add-backs)`,
    `- **Recurring revenue:** ${d.recurringPct}% ($${Math.round(d.recurring).toLocaleString()})`,
    `- **Growth (6-mo YoY):** ${d.growthPct}% · **Top-client concentration:** ${d.topShare}%`,
    `- **Team:** ${d.employees} people · **Machines:** ${d.machines} units ($${Math.round(d.machineValue).toLocaleString()}) · **Inventory:** $${Math.round(d.inventoryValue).toLocaleString()}`,
    `- **Marketing:** ${d.campaigns} campaign(s), $${Math.round(d.adSpend).toLocaleString()} spend${d.roas ? `, ROAS ${d.roas}` : ' (no spend tracked)'}`,
    `- **Reputation:** ${d.reviews} review(s), ${d.positiveReviews} positive`, ``,
    `## App assets & functions`, ...APP_FEATURES.map(f => `- ${f}`), ``,
    `## Improvement plan (highest value first)`,
    ...plan.map((s, i) => `### ${i + 1}. ${s.title}\n**Impact:** ${s.impact}\n\n${s.why}\n\n${s.steps.join('\n')}\n\n_Tools:_ ${s.tools}${s.links && s.links.length ? '\n' + s.links.map(l => `- [${l.name}](${l.url})`).join('\n') : ''}`),
    ``, `---`, `_Valuation is an estimate for planning — a formal appraisal/broker opinion of value governs any transaction. SDE multiples per industry norms for facility services (2.5–4×)._`,
  ].join('\n');
  return { markdown: md, data: d, valuation: v, plan };
}

/* ---------- handoff branching ---------- */
function handoffStep(db) {
  const h = db.settings.handoff = db.settings.handoff || {};
  if (!h.active) return { mode: 'inactive' };
  if (h.sameName === null || h.sameName === undefined) {
    return { mode: 'question',
      question: 'Will you run the business under the SAME name & branding, or a DIFFERENT name?',
      options: [
        { value: 'same', label: 'Same name & branding', implications: 'Continuity path: keep domain, LLC/DBA assignment, licenses (with agency consent), reviews, Google Business Profile, phone number. Faster + keeps goodwill value.', workflow: 'continuity' },
        { value: 'different', label: 'Different name & branding', implications: 'Rebrand path: new LLC or DBA filing, new domain + site rebrand, new GBP listing (reviews do NOT transfer), new phone (port or new), re-file business license, update insurance. The app has a brand kit + walkthrough to guide you.', workflow: 'rebrand' },
      ] };
  }
  return { mode: 'workflow', sameName: h.sameName,
    workflow: h.sameName === 'same' ? {
      name: 'Continuity setup', steps: [
        '1. Transfer domain registrar access + DNS to your accounts',
        '2. Assignment of LLC/DBA per the APA — keep EIN unless entity transfers',
        '3. Notify insurer of ownership change (GL + workers comp endorsements)',
        '4. Keep Google Business Profile — request ownership transfer from seller',
        '5. Update bank/payment processor signatories',
        '6. Keep the app as-is: replace credentials via the Brand Kit + walkthrough',
      ] } : {
      name: 'Rebrand setup', steps: [
        '1. Register new LLC/DBA + new domain before launch (run both brands 60–90 days)',
        '2. Brand Kit tab: replace logo, colors, fonts — the site re-skins instantly',
        '3. Update manifest + favicons (pkg/icons/generate-icons.py after new logo)',
        '4. New Google Business Profile; ask happy clients to review the new listing',
        '5. Port the phone number or set up forwarding for 12 months',
        '6. Re-file business license + notify insurer of the name change',
        '7. 301-redirect old domain pages to the new site for SEO continuity',
      ] } };
}
function answerHandoff(db, sameName) {
  const h = db.settings.handoff = db.settings.handoff || {};
  h.sameName = sameName === 'different' ? 'different' : 'same';
  return handoffStep(db);
}

module.exports = { gatherData, computeValuation, improvementPlan, generateReport, handoffStep, answerHandoff };
