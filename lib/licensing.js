/* Lines & Logos — License & Insurance Center.
 *
 * Admin-facing (owner/admin only) tracker for:
 *   - what a TN facility-services business legally needs (requirements DB)
 *   - active licenses, permits & insurance policies with expiry + renewal reminders
 *   - cheapest-vetted starting points for each (estimates — always verify)
 *   - renewal sweep: T-30 / T-7 / expired nudges to admin
 */
'use strict';

/* ---------- requirements knowledge base (Tennessee facility services) ---------- */
/* prices marked est = estimate, verify at source. */
const REQUIREMENTS = [
  { key:'ein', type:'license', name:'EIN (Federal Tax ID)', authority:'IRS — irs.gov', needed:true,
    cost:'Free (apply online in ~10 min)', est:0, applyUrl:'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
    note:'Required before opening a business bank account or hiring.' },
  { key:'llc', type:'license', name:'LLC Formation (TN)', authority:'TN Secretary of State', needed:true,
    cost:'~$300 state filing fee; ~$50/member/yr annual report (est)', est:300, applyUrl:'https://tnbear.tn.gov/Ecommerce/FilingSearch.aspx',
    note:'Register at tnbeartn.gov. Separates personal assets from business liability.' },
  { key:'business-license', type:'license', name:'Local Business License', authority:'Shelby County / Memphis clerk', needed:true,
    cost:'~$15–30/yr depending on city/county (est)', est:25, applyUrl:'https://www.shelbycountytn.gov/',
    note:'Required in each TN city/county you operate in — Memphis AND Shelby County if working both.' },
  { key:'sales-tax', type:'license', name:'TN Sales Tax Permit', authority:'TN Dept. of Revenue', needed:true,
    cost:'Free', est:0, applyUrl:'https://www.tn.gov/revenue/businesses/new-business.html',
    note:'Register before collecting sales tax on taxable services/materials.' },
  { key:'contractor-license', type:'license', name:'TN Contractor License', authority:'TN Board for Licensing Contractors', needed:'conditional',
    cost:'~$250–500 exam + fees (est)', est:400, applyUrl:'https://www.tn.gov/commerce/regulatory-boards/contractor-licensing.html',
    note:'ONLY required for projects ≥ $25,000 (incl. materials+labor). Under $25k per job, you are exempt.' },
  { key:'gl', type:'insurance', name:'General Liability', authority:'private insurers', needed:true,
    cost:'~$400–900/yr for $1M coverage (est); painters pay more than office trades', est:650,
    options:['NEXT Insurance — next.com','Thimble — thimble.com (on-demand, from ~$17/mo)','biBERK — biberk.com','Hiscox — hiscox.com'],
    note:'Gyms/schools will ask for a COI before you step on site. Get $1M/$2M limits.' },
  { key:'workers-comp', type:'insurance', name:'Workers\' Compensation', authority:'private insurers (TN has no state fund)', needed:'conditional',
    cost:'~2–5% of payroll for painting/floor trades (est)', est:null,
    options:['The Hartford — thehartford.com','NEXT Insurance','Progressive Commercial — progressivecommercial.com','CoverWallet — coverwallet.com (compares carriers)'],
    note:'Required in TN at 5+ employees. Subcontractors must carry their own COI — collect them.' },
  { key:'commercial-auto', type:'insurance', name:'Commercial Auto', authority:'private insurers', needed:'conditional',
    cost:'~$1,200–2,500/yr per vehicle (est)', est:1800,
    options:['Progressive Commercial','GEICO Commercial — geico.com','The Hartford'],
    note:'Required once vehicles are titled to the business or used primarily for work.' },
  { key:'equipment', type:'insurance', name:'Inland Marine / Equipment Coverage', authority:'private insurers', needed:false,
    cost:'~1–3% of equipment value/yr (est)', est:null,
    options:['The Hartford','biBERK','Travelers — travelers.com'],
    note:'Covers sanders, stripers, sprayers in transit & on job sites. Worth it once equipment > ~$10k.' },
  { key:'umbrella', type:'insurance', name:'Umbrella Liability', authority:'private insurers', needed:false,
    cost:'~$300–600/yr per $1M (est)', est:450,
    options:['biBERK','The Hartford'],
    note:'Adds $1M+ on top of GL — school districts often require it.' },
];

/* cheapest-first suggestion per item */
function cheapestFor(reqKey) {
  const r = REQUIREMENTS.find(x => x.key === reqKey);
  if (!r) return null;
  const free = r.est === 0;
  return { key: r.key, name: r.name, cost: r.cost, free,
    best: free ? r.authority : (r.options ? r.options[0] : r.authority),
    options: r.options || [r.authority], applyUrl: r.applyUrl, note: r.note };
}

/* ---------- tracker ---------- */
function addItem(db, uid, input) {
  const it = { id: uid('lic'), createdAt: new Date().toISOString(), status: 'active',
    name: input.name, type: input.type || 'license', provider: input.provider || null,
    policyNumber: input.policyNumber || null, cost: input.cost || null,
    expiresAt: input.expiresAt || null, renewsEveryMonths: input.renewsEveryMonths || null,
    notes: input.notes || null, reminded: {} };
  db.licenses.unshift(it);
  return it;
}
function removeItem(db, id) {
  const i = db.licenses.findIndex(x => x.id === id);
  if (i < 0) throw new Error('Item not found');
  db.licenses.splice(i, 1);
}

/* coverage gaps: required-by-knowledge-base items with no active tracked policy */
function gaps(db) {
  const tracked = db.licenses.filter(l => l.status === 'active');
  return REQUIREMENTS.filter(r => r.needed === true || r.needed === 'conditional')
    .map(r => ({ ...r, tracked: tracked.some(t => t.type === r.type && (t.name || '').toLowerCase().includes(r.name.split(' ')[0].toLowerCase())) }))
    .filter(r => !r.tracked);
}

/* ---------- renewal sweep: T-30 / T-7 / expired ---------- */
function sweep(db, ctx) {
  let nudges = 0;
  const today = new Date();
  for (const it of db.licenses) {
    if (it.status !== 'active' || !it.expiresAt) continue;
    const exp = new Date(it.expiresAt);
    const days = Math.ceil((exp - today) / 864e5);
    const windows = days <= 0 ? ['expired'] : days <= 7 ? ['d7'] : days <= 30 ? ['d30'] : [];
    for (const w of windows) {
      if (it.reminded[w]) continue;
      it.reminded[w] = new Date().toISOString(); nudges++;
      const msg = w === 'expired'
        ? `🚨 EXPIRED: ${it.name}${it.provider ? ' (' + it.provider + ')' : ''} expired ${it.expiresAt.slice(0,10)} — you may be out of compliance NOW.`
        : `${it.name}${it.provider ? ' (' + it.provider + ')' : ''} expires in ${days} day(s) (${it.expiresAt.slice(0,10)}). Renew before it lapses.`;
      ctx.notify(db.settings.quotes.approvalEmail, `License/Insurance renewal — ${it.name}`, msg, ['in-app', 'email']);
      ctx.push && ctx.push('admin', `${w==='expired'?'🚨 EXPIRED':'⏳ Renew soon'} — ${it.name}`, `${days <= 0 ? 'EXPIRED' : days + ' day(s) left'} · ${it.expiresAt.slice(0,10)}`, '/dashboard.html', { category: 'approval' });
    }
  }
  return { nudges };
}

function summary(db) {
  const items = db.licenses || [];
  const active = items.filter(i => i.status === 'active');
  const expiringSoon = active.filter(i => i.expiresAt && Math.ceil((new Date(i.expiresAt) - Date.now())/864e5) <= 30);
  const expired = active.filter(i => i.expiresAt && new Date(i.expiresAt) < new Date());
  return { total: items.length, active: active.length, expiringSoon: expiringSoon.length, expired: expired.length,
    estAnnualCost: active.reduce((s,i) => s + (parseFloat(i.cost) || 0), 0), gapCount: gaps(db).length, gaps: gaps(db).map(g => g.name) };
}

module.exports = { REQUIREMENTS, cheapestFor, addItem, removeItem, gaps, sweep, summary };
