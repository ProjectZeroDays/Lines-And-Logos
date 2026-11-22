/* Lines & Logos — Business Documents & Funding Agent.
 *
 * Three document generators (operating agreement, business plan, pitch deck)
 * built from LIVE business data — valuation agent financials, client counts,
 * milestones from the launch plan, market position — refreshed on demand.
 * Plus: a funding playbook (where to go, how to approach, how to close),
 * a curated grant database matched against owner/business eligibility, grant
 * DRAFT writing held for admin approval before any submission, and a weekly
 * sweep that re-matches grants and alerts on new ones.
 *
 * Honest limits: grant data is a curated, dated DB — each entry says "verify
 * current cycle"; actual submission is always manual (admin approves the
 * generated draft, then files it in the grant's own portal).
 */
'use strict';
const valuation = require('./valuation');

const now = () => new Date().toISOString();
function money(n) { return '$' + Math.round(n || 0).toLocaleString(); }

/* ---------- eligibility profile ---------- */
const DEFAULT_PROFILE = {
  ownerName: null, veteran: false, womanOwned: false, minorityOwned: false,
  disabledOwned: false, ruralLocation: false, opportunityZone: true,
  yearsInBusiness: null, employees: null, annualRevenue: null,
  industry: 'facility services / specialty contracting',
};
function profile(db) {
  db.settings.fundingProfile = Object.assign({}, DEFAULT_PROFILE, db.settings.fundingProfile || {});
  return db.settings.fundingProfile;
}

/* ---------- grant database (curated — verify current cycle before applying) ---------- */
const GRANTS = [
  { id: 'fedex', name: 'FedEx Small Business Grant Contest', source: 'FedEx', type: 'grant', amount: '$1,000–$50,000',
    tags: [], region: 'national', cycle: 'annual (verify dates)',
    fit: 'For established small businesses with a story. Memphis roots are a plus with FedEx HQ in town.',
    effort: 'essay + business profile', url: 'https://www.fedex.com/en-us/small-business/marketing-series/grant-contest.html' },
  { id: 'amber', name: 'Amber Grant for Women', source: 'WomensNet', type: 'grant', amount: '$10,000/mo + $25k year-end',
    tags: ['womanOwned'], region: 'national', cycle: 'monthly',
    fit: 'Simple application — one question about your business. Fast turnaround.',
    effort: 'short essay', url: 'https://ambergrantsforwomen.com/' },
  { id: 'nav', name: 'Nav Small Business Grant', source: 'Nav', type: 'grant', amount: '$10,000',
    tags: [], region: 'national', cycle: 'annual',
    fit: 'Needs a Nav account (free); rewards businesses with clear use-of-funds plans.',
    effort: 'short essay', url: 'https://www.nav.com/grants/' },
  { id: 'usda-rbdg', name: 'USDA Rural Business Development Grant', source: 'USDA', type: 'grant', amount: 'varies',
    tags: ['ruralLocation'], region: 'rural TN', cycle: 'annual (via local govt)',
    fit: 'For businesses in rural Shelby County / surrounding rural counties. Applied through local government.',
    effort: 'full proposal', url: 'https://www.rd.usda.gov/programs-services/business-programs/rural-business-development-grants' },
  { id: 'hope', name: 'HOPE Business-in-a-Box / Fuel Fund', source: 'HOPE Enterprise Corp (Memphis-based)', type: 'capital', amount: 'loans + coaching',
    tags: [], region: 'Mid-South', cycle: 'rolling',
    fit: 'Memphis-headquartered CDFI — the first stop for local capital + free coaching. Special focus on communities of color.',
    effort: 'application + coaching', url: 'https://hopecu.org/business/' },
  { id: 'sba-8a', name: 'SBA 8(a) Business Development', source: 'SBA', type: 'certification', amount: 'set-aside contracts',
    tags: ['minorityOwned', 'womanOwned', 'veteran'], region: 'federal', cycle: 'annual',
    fit: 'If socially/economically disadvantaged — unlocks federal set-aside contracts (schools/gov jobs are your market).',
    effort: 'certification paperwork', url: 'https://www.sba.gov/federal-contracting/contracting-assistance-programs/8a-business-development-program' },
  { id: 'tnsbdc', name: 'Tennessee SBDC / LaunchTN Funding Navigator', source: 'TN SBDC', type: 'advisory', amount: 'advisory',
    tags: [], region: 'TN', cycle: 'rolling',
    fit: 'FREE advisors (funded by SBA/TN) who will match you to capital sources and review your plan. Start here before any lender.',
    effort: 'book an appointment', url: 'https://www.tnsbdc.org/' },
  { id: 'memphis-chamber', name: 'Greater Memphis Chamber programs', source: 'Memphis Chamber', type: 'grant/advisory', amount: 'varies',
    tags: [], region: 'Memphis/Shelby', cycle: 'rolling',
    fit: 'Local incentives for growing businesses incl. possible EDGE programs — worth a call.',
    effort: 'call', url: 'https://memphischamber.com/' },
  { id: 'kiva', name: 'Kiva 0% Interest Crowdfunded Loan', source: 'Kiva', type: 'loan', amount: 'up to $15,000',
    tags: [], region: 'national', cycle: 'rolling',
    fit: '0% interest, no credit check — community-backed. Great for a machine/equipment purchase.',
    effort: 'crowdfunding campaign', url: 'https://www.kiva.org/borrow' },
  { id: 'sba-lender-match', name: 'SBA Lender Match', source: 'SBA', type: 'loan match', amount: 'up to $5M (7(a))',
    tags: [], region: 'national', cycle: 'rolling',
    fit: 'Fill one form → matched with SBA lenders. The doc pack this agent generates covers what they ask for.',
    effort: 'one form', url: 'https://lenders.sba.gov/' },
];

function matchGrants(db) {
  const p = profile(db);
  const tags = [];
  if (p.veteran) tags.push('veteran');
  if (p.womanOwned) tags.push('womanOwned');
  if (p.minorityOwned) tags.push('minorityOwned');
  if (p.ruralLocation) tags.push('ruralLocation');
  return GRANTS.map(g => {
    const eligible = g.tags.every(t => tags.includes(t));
    const reasons = [];
    if (eligible && g.tags.length) reasons.push('You match eligibility flags: ' + g.tags.join(', '));
    if (g.region === 'Memphis/Shelby') reasons.push('Memphis-based — home-field advantage');
    if (g.region === 'Mid-South') reasons.push('Mid-South regional program');
    if (!g.tags.length) reasons.push('Open to all businesses');
    return { ...g, eligible, matchReasons: reasons };
  }).sort((a, b) => (b.eligible - a.eligible));
}

/* ---------- grant draft writer ---------- */
function writeGrantDraft(db, grantId) {
  const g = matchGrants(db).find(x => x.id === grantId);
  if (!g) throw new Error('Grant not found');
  if (!g.eligible) throw new Error('Eligibility flags do not match this grant yet — update your profile first.');
  const p = profile(db);
  const d = valuation.gatherData(db);
  const v = valuation.computeValuation(d, db);
  const co = (db.settings.company && db.settings.company.name) || 'Lines & Logos';
  const narrative = [
    `# Grant Application Draft — ${g.name}`, ``,
    `> Prepared by the Funding Agent from live business records. Review, personalize, then file at: ${g.url}`, ``,
    `## Business snapshot`,
    `- **Business:** ${co} — ${p.industry}, Memphis TN (400-mile service radius)`,
    `- **Owner:** ${p.ownerName || '[owner name]'}`,
    `- **Seasoning:** ${d.seasoningMonths} months · **Team:** ${d.employees} · **Equipment:** ${d.machines} machines`,
    `- **Clients:** ${d.clients} active · **Leads converted:** ${d.converted}/${d.leads} (${d.conversionRate}%)`,
    `- **12-mo revenue:** ${money(d.revenue12)} · **Net:** ${money(d.netProfit)} · **Growth:** ${d.growthPct}%`,
    `- **Estimated business value:** ${money(v.total)} (score ${v.score}/100)`, ``,
    `## Use of funds (customize amounts)`,
    `- Equipment & capacity: 40% — [e.g., new drum sander / second crew truck]`,
    `- Working capital: 35% — [bridge school-district payment terms]`,
    `- Marketing & growth: 25% — [city landing pages + LSA campaign per GAP plan]`, ``,
    `## Narrative (edit to fit the application questions)`,
    `${co} provides court refinishing, painting, and facility branding for schools, churches, and athletic facilities across the Mid-South. In the last 12 months we generated ${money(d.revenue12)} in revenue from ${d.clients} active clients with ${d.conversionRate}% lead conversion, growing ${d.growthPct}% period-over-period. Our competitive edge is a proprietary business-management platform (AI-assisted scheduling, e-sign contracts, automated logistics) that lets a small crew run like a large firm. Funds from ${g.name} will [state use], projecting to [state measurable outcome — e.g., add $X revenue / Y jobs].`, ``,
    `## Attachments checklist`,
    `- [ ] Business plan (generate from the Documents tab)`,
    `- [ ] P/L statement (Finance tab → export)`,
    `- [ ] Business license + insurance COIs (License & Insurance tab)`,
    `- [ ] Tax returns (last 2 years, if requested)`, ``,
    `--- _Cycle: ${g.cycle} — verify the application window is open before submitting._`,
  ].join('\n');
  const sub = { id: 'gs' + Date.now().toString(36), grantId, grantName: g.name, url: g.url,
    draftedAt: now(), status: 'pending-approval', draft: narrative, submittedAt: null };
  db.grantSubmissions.unshift(sub);
  return sub;
}

/* ---------- document generators ---------- */
function baseData(db) {
  const p = profile(db);
  const d = valuation.gatherData(db);
  const v = valuation.computeValuation(d, db);
  const co = (db.settings.company && db.settings.company.name) || 'Lines & Logos';
  const owner = (db.users || []).find(u => u.role === 'owner') || (db.users || [])[0] || {};
  const milestones = (db.launchTasks || []).filter(t => t.done).slice(0, 8).map(t => `✓ ${t.text}`);
  return { p, d, v, co, owner, milestones };
}

function operatingAgreement(db) {
  const { p, co, owner } = baseData(db);
  return [
    `# Operating Agreement — ${co}, LLC`, ``,
    `_Template generated from your business profile. TN LLC — **have your attorney review before signing.**_`, ``,
    `## Article I — Formation`, `1.1 Company: ${co}, LLC, a Tennessee limited liability company filed with the TN Secretary of State.`,
    `1.2 Principal place of business: Memphis, Tennessee.`, `1.3 Purpose: facility services — athletic court refinishing, painting, graphics, and related contracting.`, ``,
    `## Article II — Members & Ownership`,
    `2.1 Sole Member: ${p.ownerName || owner.name || '[owner name]'} (100% ownership interest).`,
    `2.2 Capital contributions: initial contribution of $[amount] + equipment (see Schedule A).`, ``,
    `## Article III — Management`, `3.1 Member-managed; the Member has full authority for contracts, hiring, banking, and litigation.`,
    `3.2 Banking: business accounts at [bank]; two-signature rule for disbursements over $[amount].`, ``,
    `## Article IV — Distributions & Allocations`, `4.1 Profits/losses allocated per ownership; distributions at Member discretion.`,
    `4.2 Annual tax distributions sufficient to cover member tax liability.`, ``,
    `## Article V — Records, Tax, Dissolution`, `5.1 Fiscal year = calendar; books kept per GAAP; records at principal office.`,
    `5.2 Dissolution per TN Code § 48-249-601; assets distributed per capital accounts.`, ``,
    `## Schedule A — Equipment (from inventory records)`, ...((db.inventory || []).filter(i => /sander|sprayer|machine|trailer|buffer|coater/i.test(i.name || '')).map(i => `- ${i.name} — est. value ${money((i.unitCost || 0) * (i.stock || 1))}`) || ['- [list equipment]']), ``,
    `IN WITNESS WHEREOF, the Member executes as of ${now().slice(0, 10)}.`, ``, `____________________  ${p.ownerName || owner.name || '[owner name]'}, Member`,
  ].join('\n');
}

function businessPlan(db) {
  const { p, d, v, co, owner, milestones } = baseData(db);
  return [
    `# Business Plan — ${co}`, `_Generated from live business data — refresh before any lender meeting._`, ``,
    `## 1. Executive Summary`,
    `${co} is a facility-services company serving schools, churches, and athletic facilities within a 400-mile radius of Memphis, TN. 12-month revenue ${money(d.revenue12)}, net ${money(d.netProfit)}, ${d.growthPct}% growth, ${d.clients} active clients. Requested funding: [amount] for [purpose]. Current estimated value ${money(v.total)}.`, ``,
    `## 2. Company`, `- Legal: ${co}, LLC (TN) · Owner: ${p.ownerName || owner.name || '[owner name]'}`,
    `- Seasoning: ${d.seasoningMonths} months · Team: ${d.employees} · Equipment: ${d.machines} machines (${money(d.machineValue)})`,
    `## 3. Services`, `- Gym floor refinishing (recoat ${money(1.5)}–${money(2.5)}/sqft, full refinish ${money(3)}–${money(5)}/sqft)`,
    `- Court painting, striping, logos · Wall pads, vinyl, branding · Maintenance programs (recurring)`, `## 4. Market`,
    `US gymnasium floors ≈ $1.9B market growing ~6%/yr. Mid-South: 1,000+ schools/facilities in the 400-mile radius; competitors are mostly paper-based local crews — our edge is an AI-run operating platform.`, ``,
    `## 5. Marketing & Sales`, `- Instant-quote site, city landing pages, Google LSA, school/church outreach, referral partners`,
    `- Lead conversion ${d.conversionRate}%${d.roas ? `, ad ROAS ${d.roas}×` : ''}`, ``,
    `## 6. Operations`, `- Crew-acceptance scheduling gate, e-sign contracts, automated trip planning + logistics, self-monitoring platform`, ``,
    `## 7. Financials (12 mo)`, `- Revenue ${money(d.revenue12)} · Expenses ${money(d.expenses12)} · Net ${money(d.netProfit)} · SDE ${money(d.sde)}`,
    `- Recurring revenue ${d.recurringPct}%${d.recurringPct < 30 ? ' — maintenance plan expansion is the primary growth lever' : ''}`, ``,
    `## 8. Milestones completed`, ...(milestones.length ? milestones : ['- [set milestones in the Go Live checklist]']), ``,
    `## 9. Use of funds`, `[amount] → 40% equipment/capacity · 35% working capital · 25% marketing. Repayment source: contracted backlog + maintenance MRR.`,
  ].join('\n');
}

function pitchDeck(db) {
  const { p, d, v, co, owner } = baseData(db);
  const slide = (t, body) => `\n--- SLIDE: ${t} ---\n${body}`;
  return [
    `PITCH DECK OUTLINE — ${co} (12 slides; pair with visuals)`,
    slide('1. Title', `${co} — Modernizing athletic facility services\n${p.ownerName || owner.name || '[owner]'} · [contact] · [date]`),
    slide('2. Problem', 'Schools & churches face 6–12 month waits, opaque pricing, and unprofessional crews for gym floor refinishing & court branding.'),
    slide('3. Solution', 'One AI-run platform: instant quotes, e-sign contracts, crew-dispatch with acceptance gates, automated logistics — professional delivery at local prices.'),
    slide('4. Traction', `${money(d.revenue12)} revenue (12 mo) · ${d.growthPct}% growth · ${d.clients} clients · ${d.conversionRate}% conversion${d.roas ? ` · ROAS ${d.roas}×` : ''} · ${d.seasoningMonths} months operating.`),
    slide('5. Market', '$1.9B US gym-floor market, +6%/yr; 1,000+ facilities in 400-mi radius; fragmented local competition.'),
    slide('6. Product', 'Live demo: quote → contract → crew acceptance → trip plan → invoice in one flow.'),
    slide('7. Business model', 'Project revenue (avg job $8–28k) + maintenance subscriptions (recurring, target 30%+ of revenue).'),
    slide('8. Competition', 'Tier-1 manufacturers route through dealers; local crews run on paper. We own local + software.'),
    slide('9. Marketing', 'City landing pages, GBP, LSA ads, school partnerships — measured end-to-end in-platform.'),
    slide('10. Financials', `Revenue ${money(d.revenue12)} · Net ${money(d.netProfit)} · est. value ${money(v.total)} (score ${v.score}/100).`),
    slide('11. Team', `${d.employees} people + contractor bench; platform handles what a back-office would.`),
    slide('12. The Ask', '[Amount] for [equipment/working capital/marketing]. Contact: [phone] [email].'),
  ].join('\n');
}

const DOCS = { 'operating-agreement': operatingAgreement, 'business-plan': businessPlan, 'pitch-deck': pitchDeck };
function generateDoc(db, type) {
  const fn = DOCS[type];
  if (!fn) throw new Error('Unknown document type');
  const md = fn(db);
  const doc = { id: 'doc' + Date.now().toString(36), type, title: { 'operating-agreement': 'Operating Agreement', 'business-plan': 'Business Plan', 'pitch-deck': 'Pitch Deck' }[type],
    generatedAt: now(), markdown: md, wordCount: md.split(/\s+/).length };
  db.fundingDocs.unshift(doc);
  db.fundingDocs = db.fundingDocs.slice(0, 20);
  return doc;
}

/* ---------- funding playbook ---------- */
const PLAYBOOK = [
  { stage: '1. Prepare the pack', steps: [
    'Generate the three documents above — most lenders ask for exactly these',
    'Export P/L from Finance; gather tax returns + COIs from the License & Insurance tab',
    'Fix the cheapest gaps first: Google reviews count + GBP verification',
  ], resources: [{ name: 'SBA loan documentation checklist', url: 'https://www.sba.gov/business-guide/plan-your-business/small-business-loans-grants' }] },
  { stage: '2. Start with free advisors', steps: [
    'Book a FREE TN SBDC advisor (tnsbdc.org) — they review your plan and match you to capital',
    'Memphis: HOPE Enterprise Corp (hopecu.org/business) — local CDFI, coaching + capital',
    'Ask your current bank for an SBA 7(a) — relationship history lowers rates',
  ], resources: [{ name: 'TN SBDC — free advising', url: 'https://www.tnsbdc.org/' }, { name: 'SBA Lender Match', url: 'https://lenders.sba.gov/' }] },
  { stage: '3. Sequence the asks', steps: [
    'Small + fast first: Kiva $15k 0% loan or Amber Grant — proof of repayment helps bigger asks',
    'Then equipment financing (the machines are the collateral — easiest to close)',
    'Then a working-capital line sized to school-district payment terms (30–90 day receivables)',
  ], resources: [{ name: 'Kiva 0% loans', url: 'https://www.kiva.org/borrow' }] },
  { stage: '4. Close', steps: [
    'Respond to lender document requests within 24h — speed signals quality',
    'Compare total cost (APR + fees), not just rate; SBA 7(a) fees can be rolled in',
    'Sign, then set repayment autopay + calendar reminders (the suite reminds you)',
  ], resources: [{ name: 'SBA loan programs overview', url: 'https://www.sba.gov/funding-programs/loans' }] },
];

/* ---------- weekly sweep: re-match grants, alert on new eligible ---------- */
function sweep(db, ctx) {
  const matches = matchGrants(db);
  const prev = new Set((db.grantMatches || []).map(m => m.id + ':' + m.eligible));
  db.grantMatches = matches.map(m => ({ id: m.id, eligible: m.eligible, checkedAt: now() }));
  const fresh = matches.filter(m => m.eligible && !prev.has(m.id + ':true'));
  for (const g of fresh) {
    ctx.notify(db.settings.quotes.approvalEmail, `New grant match — ${g.name}`,
      `${g.amount} · ${g.fit} Draft it from the Funding tab for your approval.`, ['in-app', 'email']);
    ctx.push && ctx.push('admin', `Grant match: ${g.name}`, g.amount + ' — draft ready for approval', '/dashboard.html', { category: 'approval' });
  }
  ctx.save && ctx.save();
  return { matched: matches.length, newEligible: fresh.length };
}

module.exports = { DEFAULT_PROFILE, profile, GRANTS, matchGrants, writeGrantDraft, generateDoc, PLAYBOOK, sweep, DOCS };
