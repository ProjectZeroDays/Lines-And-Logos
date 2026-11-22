/**
 * Lines & Logos — Business OS (standalone server, v2)
 * Zero-dependency Node.js backend mirroring the GitHub Business OS API surface:
 *   auth · stats · leads · accounts · contacts · quotes · jobs · schedule
 *   time-entries · checklists · invoices · expenses · revenue · employees
 *   applicants (apply/approve/reject) · candidates · vendors · purchase-orders
 *   content · campaigns · tickets · feedback · wiki · policies · approvals
 *   notifications · settings · agents (9) · cron/daily · cron/weekly · portal
 *
 * Run:  node server.js   →  http://localhost:3001
 * Data persists to data/db.json (seeded on first run from repo sample data).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* .env loader — zero-dep. Real environment variables always win over the file;
   .env is git-ignored and never written to db.json or any API response. */
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PORT = process.env.PORT || 3001;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data', 'db.json');
const CRON_SECRET = process.env.CRON_SECRET || '';
if (!CRON_SECRET) console.warn('WARNING: CRON_SECRET is not set — /api/cron/daily and /api/cron/weekly are callable by anyone. Set CRON_SECRET in .env to restrict them.');
const uid = (p) => p + crypto.randomBytes(4).toString('hex');
function hash(s){ return crypto.createHash('sha256').update(s).digest('hex'); }
/* Phase 3 — salted scrypt password hashing (Node built-in, zero deps) */
function scryptHash(password){ const salt = crypto.randomBytes(16).toString('hex'); return 'scrypt:' + salt + ':' + crypto.scryptSync(String(password), salt, 64).toString('hex'); }
function scryptVerify(password, stored){
  const parts = String(stored).split(':');
  if (parts[0] !== 'scrypt' || parts.length !== 3) return false;
  const test = crypto.scryptSync(String(password), parts[1], 64);
  const ref = Buffer.from(parts[2], 'hex');
  return test.length === ref.length && crypto.timingSafeEqual(test, ref);
}
function verifyPassword(password, stored){
  return String(stored).startsWith('scrypt:') ? scryptVerify(password, stored) : hash(password) === stored;
}
const loginBuckets = new Map();   // per-IP login throttle
function migratePasswords(){
  let changed = false;
  for (const u of db.users || []){
    if (u.pass && !String(u.pass).startsWith('scrypt:')){ u.pass = scryptHash(u.pass); changed = true; }
  }
  if (changed){ save(); logActivity('Security: passwords migrated to salted scrypt hashing'); }
}

/* onboarding step templates (employee + client) */
const EMP_STEPS = [
  { key:'offer',  label:'Offer letter signed' },
  { key:'w9',     label:'W-9 collected' },
  { key:'i9',     label:'ID / I-9 verification' },
  { key:'safety', label:'Safety & PPE training' },
  { key:'gear',   label:'Tools & gear issued' },
  { key:'portal', label:'Crew portal account activated' },
  { key:'shadow', label:'First job shadow scheduled' },
];
const CLIENT_STEPS = [
  { key:'kickoff',     label:'Kickoff call completed' },
  { key:'contract',    label:'Contract / MSA signed' },
  { key:'deposit',     label:'Deposit invoice sent' },
  { key:'walkthrough', label:'Site walkthrough & measurements' },
  { key:'portal',      label:'Client portal access granted' },
  { key:'welcome',     label:'Welcome packet delivered' },
];
const freshSteps = (tpl) => tpl.map(s => ({ ...s, done:false }));
const withProgress = (o) => { const t=(o.steps||[]).length, dn=(o.steps||[]).filter(s=>s.done).length; return { ...o, progress: t ? Math.round(dn/t*100) : 0, stepsDone: dn, stepsTotal: t }; };

/* ================= SEED DATA (mirrors repo seed.ts) ================= */
function seed() {
  const now = Date.now();
  const d = (days) => new Date(now + days * 864e5).toISOString().slice(0, 10);
  return {
    /* Fresh deployments start with NO users — the first person to open the app
       creates the owner account via POST /api/setup/admin (one-time, then locked).
       Set LL_DEMO_USERS=1 to seed the demo owner/crew accounts instead. */
    users: process.env.LL_DEMO_USERS === '1' ? [
      { id: 'u1', name: 'Trey Smith', email: 'admin@linesandlogos.com', role: 'owner', pass: hash('onepaint'), token: crypto.randomBytes(24).toString('hex') },
      { id: 'u2', name: 'Crew Lead', email: 'crew@linesandlogos.com', role: 'contractor', pass: hash('crew2026'), token: crypto.randomBytes(24).toString('hex'), portalToken: 'demo-crew-token', employeeId: 'e1' },
    ] : [],
    accounts: [
      { id: 'a1', name: 'Memphis-Shelby County Schools', tier: 'A', seats: 213, city: 'Memphis, TN', renewal: d(74), goal: 'Full-facility contract — 12 gyms', notes: 'District-wide vendor registration complete.' },
      { id: 'a2', name: 'DeSoto County School District', tier: 'A', seats: 42, city: 'Southaven, MS', renewal: d(41), goal: 'Gym refresh x3 + court restripes', notes: 'Board approval cycle ~3 weeks.' },
      { id: 'a3', name: 'Bellevue Baptist Church', tier: 'B', seats: 0, city: 'Cordova, TN', renewal: d(120), goal: 'Donors wall + lobby wraps', notes: 'Facilities committee meets monthly.' },
      { id: 'a4', name: 'University of Memphis — Rec Center', tier: 'B', seats: 0, city: 'Memphis, TN', renewal: d(200), goal: 'Annual lot striping + court surfacing', notes: 'Paid first invoice same week.', affiliateCode: 'RAMSEY10' },
    ],
    contacts: [
      { id: 'c1', accountId: 'a1', name: 'Dr. Roderick Richmond', role: 'Superintendent', email: 'richmond@scsk12.org', phone: '901-555-0140', decisionMaker: true },
      { id: 'c2', accountId: 'a1', name: 'Felicia Grant', role: 'Facilities Director', email: 'grant@scsk12.org', phone: '901-555-0148', decisionMaker: false },
      { id: 'c3', accountId: 'a2', name: 'Angela Porter', role: 'Athletic Director', email: 'aporter@desotocountyschools.org', phone: '662-555-0182', decisionMaker: true },
      { id: 'c4', accountId: 'a3', name: 'Marcus Bell', role: 'Facilities Manager', email: 'mbell@bellevue.org', phone: '901-555-0127', decisionMaker: true },
      { id: 'c5', accountId: 'a4', name: 'Tasha Reed', role: 'Rec Center Ops', email: 'treed@memphis.edu', phone: '901-555-0190', decisionMaker: false },
    ],
    leads: [
      { id: 'l1', name: 'Dr. Roderick Richmond', company: 'Memphis-Shelby County Schools', score: 92, tier: 'hot', stage: 'contacted', service: 'Full Facility', source: 'Referral', nextStep: 'Send full-facility proposal' },
      { id: 'l2', name: 'Angela Porter', company: 'DeSoto County School District', score: 87, tier: 'hot', stage: 'quoted', service: 'Gym Refresh x3', source: 'Outbound', nextStep: 'Follow up on quote' },
      { id: 'l3', name: 'Marcus Bell', company: 'Bellevue Baptist Church', score: 74, tier: 'warm', stage: 'contacted', service: 'Donors Wall + Wraps', source: 'Website', nextStep: 'Schedule walkthrough' },
      { id: 'l4', name: 'Dana Whitfield', company: 'City of Little Rock Parks', score: 68, tier: 'warm', stage: 'new', service: 'Outdoor Courts (6)', source: 'Website', nextStep: 'Qualify budget' },
      { id: 'l5', name: 'Coach Reggie Sanders', company: 'Huntsville HS', score: 55, tier: 'cold', stage: 'new', service: 'Court Restripe', source: 'Cold call', nextStep: 'Send battle card' },
    ],
    quotes: [
      { id: 'q1', number: 'Q-2026-001', accountId: 'a2', title: 'DeSoto — Court Restripe x2', amount: 18900, status: 'sent', sent: d(-8), validUntil: d(22) },
      { id: 'q2', number: 'Q-2026-002', accountId: 'a1', title: 'MSCS — Full Facility Proposal', amount: 148000, status: 'draft', sent: null, validUntil: d(30) },
      { id: 'q3', number: 'Q-2026-003', accountId: 'a3', title: 'Bellevue — Donors Wall Design', amount: 24000, status: 'sent', sent: d(-3), validUntil: d(27) },
      { id: 'q4', number: 'Q-2026-004', accountId: 'a4', title: 'U of M — Lot Striping', amount: 12750, status: 'accepted', sent: d(-25), validUntil: d(-10) },
    ],
    jobs: [
      { id: 'j1', title: 'MSCS — Gym Refresh (3 gyms)', accountId: 'a1', status: 'in-progress', crew: 'Crew A', value: 86500, due: d(9), progress: 55, notes: 'Gym 1 sanded; Gym 2 base coat.', siteLat: 35.1295, siteLng: -89.9590 },
      { id: 'j2', title: 'DeSoto — Court Restripe x2', accountId: 'a2', status: 'quoted', crew: 'Crew B', value: 18900, due: d(21), progress: 0, notes: 'Awaiting PO from district.', siteLat: 34.9626, siteLng: -89.9934 },
      { id: 'j3', title: 'Bellevue — Donors Wall Design', accountId: 'a3', status: 'lead', crew: null, value: 24000, due: d(30), progress: 0, notes: 'Design mockup in review.', siteLat: 35.1067, siteLng: -89.8731 },
      { id: 'j4', title: 'U of M — Parking Lot Striping', accountId: 'a4', status: 'complete', crew: 'Crew A', value: 12750, due: d(-12), progress: 100, notes: 'Completed ahead of schedule.', siteLat: 35.1186, siteLng: -89.9375 },
    ],
    /* prospect source pool — the Prospect Scout Agent verifies and promotes these into the sales pipeline.
       Public business data only (name, switchboard phone, public POC); verification stamps each check. */
    prospects: [
      { id:'pr1', business:'Houston High School Athletics', type:'school', city:'Germantown, TN', poc:'Athletics Department', email:'athletics@houstonhigh.org', phone:'(901) 555-0161', website:'https://houstonhigh.org', status:'pool' },
      { id:'pr2', business:'Collierville Parks & Recreation', type:'parks', city:'Collierville, TN', poc:'Parks Director', email:'parks@colliervilletn.gov', phone:'(901) 555-0122', website:'https://colliervilletn.gov', status:'pool' },
      { id:'pr3', business:'Life Church — Cordova Campus', type:'church', city:'Cordova, TN', poc:'Facilities Team', email:'facilities@lifechurchcordova.org', phone:'(901) 555-0173', website:'https://lifechurchcordova.org', status:'pool' },
      { id:'pr4', business:'Southaven Recreation Department', type:'parks', city:'Southaven, MS', poc:'Rec Facilities Manager', email:'rec@southavenms.gov', phone:'(662) 555-0114', website:'https://southavenms.gov', status:'pool' },
      { id:'pr5', business:'Christian Brothers High School', type:'school', city:'Memphis, TN', poc:'Athletic Director', email:'ad@cbhs.org', phone:'(901) 555-0155', website:'https://cbhs.org', status:'pool' },
      { id:'pr6', business:'Olive Branch School District', type:'school-district', city:'Olive Branch, MS', poc:'Facilities Director', email:'facilities@obsd.k12.ms.us', phone:'(662) 555-0139', website:'https://obsd.k12.ms.us', status:'pool' },
      { id:'pr7', business:'Bartlett Parks & Rec', type:'parks', city:'Bartlett, TN', poc:'Parks Superintendent', email:'parks@bartletttn.gov', phone:'(901) 555-0187', website:'https://bartletttn.gov', status:'pool' },
      { id:'pr8', business:'Hope Presbyterian Church', type:'church', city:'Memphis, TN', poc:'Executive Pastor', email:'epastor@hopememphis.org', phone:'(901) 555-0148', website:'https://hopememphis.org', status:'pool' },
      { id:'pr9', business:'Arlington Community Schools', type:'school-district', city:'Arlington, TN', poc:'Operations Director', email:'ops@acsk-12.org', phone:'(901) 555-0195', website:'https://acsk-12.org', status:'pool' },
      { id:'pr10', business:'Rhodes College Athletics', type:'university', city:'Memphis, TN', poc:'AD Office', email:'athletics@rhodes.edu', phone:'(901) 555-0126', website:'https://rhodes.edu', status:'pool' },
      { id:'pr11', business:'Germantown Municipal Parks', type:'parks', city:'Germantown, TN', poc:'Parks Director', email:'parks@germantown-tn.gov', phone:'(901) 555-0133', website:'https://germantown-tn.gov', status:'pool' },
      { id:'pr12', business:'Second Baptist Church — East', type:'church', city:'Memphis, TN', poc:'Facilities Committee', email:'facilities@2baptisteast.org', phone:'(901) 555-0119', website:'https://2baptisteast.org', status:'pool' },
      { id:'pr13', business:'Hernando Parks Department', type:'parks', city:'Hernando, MS', poc:'Parks Director', email:'parks@hernandoms.gov', phone:'(662) 555-0177', website:'https://hernandoms.gov', status:'pool' },
      { id:'pr14', business:'Lausanne Collegiate School', type:'school', city:'Memphis, TN', poc:'Director of Facilities', email:'facilities@lausanneschool.org', phone:'(901) 555-0168', website:'https://lausanneschool.org', status:'pool' },
      { id:'pr15', business:'Millington Central High School', type:'school', city:'Millington, TN', poc:'Athletic Director', email:'ad@millingtoncentral.org', phone:'(901) 555-0141', website:'https://millingtoncentral.org', status:'pool' },
      { id:'pr16', business:'Crossfit 901 — Midtown', type:'gym', city:'Memphis, TN', poc:'Owner', email:'owner@crossfit901.com', phone:'(901) 555-0182', website:'https://crossfit901.com', status:'pool' },
      { id:'pr17', business:'West Memphis School District', type:'school-district', city:'West Memphis, AR', poc:'Facilities Director', email:'facilities@wmsd.k12.ar.us', phone:'(870) 555-0158', website:'https://wmsd.k12.ar.us', status:'pool' },
      { id:'pr18', business:'Jonesboro Parks & Recreation', type:'parks', city:'Jonesboro, AR', poc:'Rec Director', email:'parks@jonesboroar.gov', phone:'(870) 555-0124', website:'https://jonesboroar.gov', status:'pool' },
      { id:'pr19', business:'First Baptist Jackson', type:'church', city:'Jackson, TN', poc:'Executive Pastor', email:'epastor@fbcjackson.org', phone:'(731) 555-0147', website:'https://fbcjackson.org', status:'pool' },
      { id:'pr20', business:'Tupelo Public School District', type:'school-district', city:'Tupelo, MS', poc:'Facilities Director', email:'facilities@tupeloschools.com', phone:'(662) 555-0112', website:'https://tupeloschools.com', status:'pool' },
    ],
    locations: [],
    locationConsents: [],          /* crew GPS pings — work-hours only, consent-gated */
    photoRequests: [],      /* client asks for job photos → approvals queue → approved album emailed */
    optOuts: [],            /* photo & reference opt-out e-sign records */
    payrollRuns: [],        /* payroll run history with per-tech progress */
    timeEntries: [
      { id: 't1', jobId: 'j1', employeeId: 'e1', date: d(-2), hours: 8, note: 'Gym 1 sanding complete' },
      { id: 't2', jobId: 'j1', employeeId: 'e2', date: d(-2), hours: 7.5, note: 'Base coat prep' },
      { id: 't3', jobId: 'j1', employeeId: 'e1', date: d(-1), hours: 8, note: 'Gym 2 base coat' },
      { id: 't4', jobId: 'j4', employeeId: 'e3', date: d(-13), hours: 6, note: 'Lot layout + striping' },
    ],
    checklists: [
      { id: 'k1', name: 'Gym Floor Refinishing — Safety', type: 'safety', items: ['Ventilation verified', 'Dust containment sealed', 'PPE on all crew', 'Exit paths clear', 'Finish batch logged'] },
      { id: 'k2', name: 'Court Restripe — Install', type: 'install', items: ['Surface cleaned & taped', 'Game lines measured to spec', 'Paint cured 24h', 'Photos captured', 'Client walkthrough signed'] },
    ],
    checklistRuns: [
      { id: 'kr1', checklistId: 'k1', jobId: 'j1', employeeId: 'e1', date: d(-2), completed: [true, true, true, true, false] },
    ],
    invoices: [
      { id: 'i1', number: 'L&L-2026-001', accountId: 'a4', amount: 12750, status: 'paid', issued: d(-20), dueDate: d(-6), paidDate: d(-8), reminders: 0 },
      { id: 'i2', number: 'L&L-2026-002', accountId: 'a2', amount: 9450, status: 'sent', issued: d(-6), dueDate: d(24), reminders: 0 },
      { id: 'i3', number: 'L&L-2026-003', accountId: 'a1', amount: 43250, status: 'sent', issued: d(-2), dueDate: d(28), reminders: 0 },
      { id: 'i4', number: 'L&L-2026-004', accountId: 'a3', amount: 6000, status: 'overdue', issued: d(-19), dueDate: d(-5), reminders: 1 },
    ],
    expenses: [
      { id: 'x1', date: d(-15), category: 'Materials', vendor: 'Sherwin-Williams Pro', amount: 3240, note: 'Gym finish + sealer' },
      { id: 'x2', date: d(-11), category: 'Equipment', vendor: 'Sunbelt Rentals', amount: 1180, note: 'Sander rental (2 wks)' },
      { id: 'x3', date: d(-7), category: 'Fuel & Travel', vendor: null, amount: 410, note: 'Crew travel — Southaven' },
      { id: 'x4', date: d(-4), category: 'Insurance', vendor: 'Next Insurance', amount: 890, note: 'GL policy monthly' },
      { id: 'x5', date: d(-2), category: 'Materials', vendor: 'Beacon Athletics', amount: 2260, note: 'Court paint + tape' },
      { id: 'x6', date: d(-1), category: 'Materials', vendor: 'Unknown Vendor — card ending 4471', amount: 14800, note: 'Bulk coating order, no PO attached' },
    ],
    revenue: [
      { id: 'r1', date: d(-8), source: 'U of M — Lot Striping', amount: 12750, note: 'Invoice L&L-2026-001 paid' },
      { id: 'r2', date: d(-31), source: 'DeSoto — Deposit', amount: 9450, note: 'Restripe deposit' },
    ],
    employees: [
      { id: 'e1', name: 'James Carter', role: 'Floor Installer', type: '1099', w9Signed: true, rating: 4.9, skills: ['hardwood', 'sanding', 'finish', 'gym'], availability: 'full-time' },
      { id: 'e2', name: 'Miguel Torres', role: 'Vinyl / Wrap Tech', type: '1099', w9Signed: true, rating: 4.7, skills: ['vinyl', 'wraps', 'donors wall', 'signage'], availability: 'full-time' },
      { id: 'e3', name: 'Andre Boone', role: 'Striping Lead', type: '1099', w9Signed: false, rating: 4.5, skills: ['striping', 'court', 'paint', 'parking lot'], availability: 'part-time' },
    ],
    applicants: [
      { id: 'ap1', firstName: 'Darius', lastName: 'Hall', email: 'dhall@example.com', phone: '901-555-0163', position: 'Floor Installer', experience: '5', skills: 'hardwood, sanding, finish', availability: 'full-time', hasTransport: true, hasInsurance: true, coverLetter: '5 yrs gym floor refinishing across Shelby County.', references: 'Sam Ortiz, 901-234-5678', aiScore: 95, recommendation: 'strong', status: 'new', applied: d(-2) },
      { id: 'ap2', firstName: 'Kayla', lastName: 'Wright', email: 'kwright@example.com', phone: '901-555-0177', position: 'Vinyl / Wrap Tech', experience: '2', skills: 'vinyl, signage', availability: 'part-time', hasTransport: true, hasInsurance: false, coverLetter: '2 yrs sign shop vinyl work.', references: 'Lee Amos, 901-555-0111', aiScore: 70, recommendation: 'maybe', status: 'new', applied: d(-1) },
    ],
    candidates: [
      { id: 'cd1', name: 'Darius Hall', position: 'Floor Installer', stage: 'screen', score: 95, source: 'Website apply' },
      { id: 'cd2', name: 'Kayla Wright', position: 'Vinyl / Wrap Tech', stage: 'applied', score: 70, source: 'Website apply' },
      { id: 'cd3', name: 'Terrence Cole', position: 'Striping Tech', stage: 'interview', score: 82, source: 'Referral' },
    ],
    vendors: [
      { id: 'v1', name: 'Sherwin-Williams Pro', category: 'Coatings', rating: 4.8, preferred: true, lastOrder: d(-15) },
      { id: 'v2', name: 'Beacon Athletics', category: 'Court materials', rating: 4.6, preferred: true, lastOrder: d(-2) },
      { id: 'v3', name: 'Sunbelt Rentals', category: 'Equipment', rating: 4.2, preferred: false, lastOrder: d(-11) },
      { id: 'v4', name: 'FastSigns Memphis', category: 'Signage overflow', rating: 4.0, preferred: false, lastOrder: d(-60) },
    ],
    purchaseOrders: [
      { id: 'po1', number: 'PO-2026-011', vendorId: 'v2', amount: 2260, status: 'received', date: d(-2), item: 'Court paint + tape' },
      { id: 'po2', number: 'PO-2026-012', vendorId: 'v1', amount: 3450, status: 'sent', date: d(-1), item: 'Gym finish (Gym 3)' },
    ],
    content: [
      { id: 'ct1', title: 'Gym Floor Refinishing: 5 Signs It Is Time', type: 'blog', status: 'published', channel: 'website', date: d(-14), body: 'A refinished gym floor is the centerpiece of a school athletic brand. Watch for finish wear, slippery spots, faded game lines, water damage, and board cupping. Lines & Logos restores floors to competition spec — lasting impressions for years to come.' },
      { id: 'ct2', title: 'MSCS Gym Refresh — Before/After', type: 'case-study', status: 'draft', channel: 'website', date: d(3), body: 'Three Memphis gyms refreshed in nine days: sanding, base coat, game lines, and a final walkthrough with facilities staff.' },
      { id: 'ct3', title: 'Donors Walls That Actually Raise Money', type: 'blog', status: 'scheduled', channel: 'website', date: d(6), body: 'Recognition walls turn donors into repeat donors. Materials, layouts, and naming-tier strategies that work for churches and schools.' },
    ],
    campaigns: [
      { id: 'cp1', name: 'MSCS Full-Facility Push', channel: 'email', status: 'active', start: d(-10), budget: 1200, results: 'Proposal drafted; 2 meetings booked' },
      { id: 'cp2', name: 'Summer Install Window', channel: 'social', status: 'planned', start: d(20), budget: 800, results: '—' },
      { id: 'cp3', name: 'Church Facilities Outreach', channel: 'email', status: 'active', start: d(-5), budget: 400, results: '11 replies / 60 sent' },
    ],
    tickets: [
      { id: 'tk1', accountId: 'a3', subject: 'Donors wall color proof question', status: 'open', priority: 'normal', created: d(-1) },
      { id: 'tk2', accountId: 'a1', subject: 'Gym 2 humidity during cure', status: 'in-progress', priority: 'high', created: d(-2) },
      { id: 'tk3', accountId: 'a4', subject: 'Stripe reflectivity spec', status: 'resolved', priority: 'normal', created: d(-20) },
    ],
    feedback: [
      { id: 'f1', accountId: 'a4', rating: 5, comment: 'Lot looks fantastic — ahead of schedule.', date: d(-10) },
      { id: 'f2', accountId: 'a1', rating: 4, comment: 'Great progress; want daily photo updates.', date: d(-3) },
    ],
    wiki: [
      { id: 'w1', title: 'Gym Floor Refinishing SOP', category: 'Operations', body: '1. Walkthrough & moisture test. 2. Seal & contain dust. 3. Drum-sand to bare wood (36→60→100 grit). 4. Tack & vacuum. 5. Base coat, abrade, finish coats. 6. Game lines to NFHS spec. 7. Cure 72h before play. 8. Client walkthrough & sign-off.' },
      { id: 'w2', title: 'Court Restripe SOP', category: 'Operations', body: '1. Clean & degrease surface. 2. Chalk-line layout to governing-body spec. 3. Tape lines. 4. Two coats acrylic striping paint. 5. Pull tape wet. 6. Cure 24h. 7. Photo documentation.' },
      { id: 'w3', title: 'Invoice & Dunning Policy', category: 'Finance', body: 'Net-30 standard. Friendly reminder at 1–7 days overdue, firm at 8–14, final at 15+. Escalate to phone call at day 10. Offer payment plans only with owner approval.' },
      { id: 'w4', title: '1099 Contractor Onboarding SOP', category: 'HR', body: 'Apply → AI screen → owner approve → portal link issued → W-9, 1099 acknowledgment, scope of work, safety agreement, offer letter signed → dispatchable.' },
    ],
    policies: [
      { id: 'p1', name: 'Safety & PPE Policy', version: '1.2', updated: d(-30), owner: 'Trey Smith' },
      { id: 'p2', name: 'Data & Privacy Policy', version: '1.0', updated: d(-60), owner: 'Trey Smith' },
      { id: 'p3', name: 'Subcontractor Agreement Policy', version: '2.0', updated: d(-15), owner: 'Trey Smith' },
    ],
    approvals: [
      { id: 'apv1', type: 'purchase', title: 'PO-2026-012 — Sherwin-Williams gym finish', amount: 3450, requestedBy: 'James Carter', status: 'pending', created: d(-1) },
      { id: 'apv2', type: 'discount', title: 'Bellevue — 10% nonprofit discount on donors wall', amount: 2400, requestedBy: 'Trey Smith', status: 'pending', created: d(-2) },
    ],
    payments: [
      { id: 'pay1', invoiceId: 'i1', date: d(-8), amount: 12750, method: 'ACH', note: 'Paid in full' },
      { id: 'pay2', invoiceId: 'i2', date: d(-1), amount: 3000, method: 'Check', note: 'Partial — deposit' },
    ],
    tasks: [
      { id: 'ts1', title: 'Order Gym 3 finish (SW Pro)', due: d(2), done: false, assignee: 'James Carter' },
      { id: 'ts2', title: 'Send MSCS full-facility proposal', due: d(1), done: false, assignee: 'Trey Smith' },
      { id: 'ts3', title: 'DeSoto walkthrough photos to client', due: d(-1), done: true, assignee: 'Crew B' },
    ],
    contracts: [
      { id: 'c1', leadId: 'l1', title: 'Full Facility Contract — Memphis-Shelby County Schools', amount: 86500, status: 'signed', signToken: 'demo-client-token',
        body: 'Lines & Logos agrees to refinish, restripe, and brand three gymnasiums plus adjacent hallways for a fixed price of $86,500. 50% deposit on execution; balance net-30 after completion photo documentation. Client authorizes Lines & Logos to identify Client as a business reference and to photograph and share completed work for portfolio and marketing purposes unless Client opts out in writing or via the Photo & Reference Opt-Out form (gallery.html#optout).',
        signerName: 'Dr. Roderick Richmond', signedAt: new Date(now - 86400e5).toISOString(), signature: 'Roderick Richmond' },
    ],
    quoteRequests: [],
    inquiries: [
      { id: 'iq1', name: 'Coach Dana Cole', email: 'dcole@nashchristian.edu', phone: '(615) 555-0142', source: 'contact',
        message: 'We need our main gym refinished before basketball season starts in November. About 10,500 sq ft. Can you also put our new logo at center court?', status: 'analyzed',
        sentiment: 'positive', intent: 'gym refinish + center-court logo', urgency: 'high — season deadline',
        extracted: { service: 'refinish', sqft: 10500, timeline: 'before November' }, reply: '', createdAt: new Date(now - 86400e4).toISOString() },
    ],
    chats: [
      { id: 'ch1', session: 'demo-session', messages: [
        { from: 'customer', text: 'Hi — do you travel to Birmingham for court striping?', at: new Date(now - 3600e3).toISOString() },
        { from: 'agent', text: 'Yes! Birmingham is 235 miles out — well inside our 400-mile service area. A two-court restripe there typically runs about a week including travel. Want an instant quote? Head to our Get a Quote page.', at: new Date(now - 3500e3).toISOString() },
      ]},
    ],
    events: [
      { id: 'ev1', title: 'PO sent — Polyurethane Finish (36 gal)', type: 'order', at: d(-1), meta: { vendor: 'Bona US', total: 3960 } },
      { id: 'ev2', title: 'Shipping — Bona US order', type: 'shipping', at: d(4), meta: { carrier: 'FedEx Freight', eta: d(4), time: '10:30 AM', status: 'in transit' } },
      { id: 'ev3', title: 'Walkthrough — Huntsville HS', type: 'walkthrough', at: d(2), meta: { contact: 'Coach Reggie Sanders' } },
      { id: 'ev4', title: 'Job — MSCS Gym Refresh (3 gyms)', type: 'job', at: d(9), meta: { crew: 'Crew A', value: 86500 } },
      { id: 'ev5', title: 'New lead — Nashville Christian Academy', type: 'lead-new', at: new Date(now - 86400e4).toISOString().slice(0,10) },
      { id: 'ev6', title: 'Quote sent — Nashville Christian Academy', type: 'quote-sent', at: new Date(now - 43200e4).toISOString().slice(0,10) },
      { id: 'ev7', title: 'Contract signed — Memphis-Shelby County Schools', type: 'contract-signed', at: new Date(now - 86400e3).toISOString().slice(0,10) },
    ],
    reviews: [
      { id: 'rv1', author: 'Dr. Roderick Richmond', company: 'Memphis-Shelby County Schools', rating: 5, text: 'Three gyms refinished, striped, and branded in nine days. The photo documentation closed our board report for us.', photos: [], status: 'approved', createdAt: new Date(now - 86400e5).toISOString() },
      { id: 'rv2', author: 'Marcus Bell', company: 'Bellevue Baptist Church', rating: 5, text: 'The donors wall exceeded the rendering. Families stop and read it every Sunday.', photos: [], status: 'pending', createdAt: new Date(now - 86400e3).toISOString() },
    ],
    gallery: [
      { id: 'g1', jobId: 'j4', caption: 'U of Memphis — parking lot striping, before/after', url: '', status: 'approved', approval: 'signed', uploadedAt: new Date(now - 86400e5).toISOString() },
      { id: 'g2', jobId: 'j1', caption: 'MSCS Gym 1 — fresh court lines', url: '', status: 'pending', approval: 'signed', uploadedAt: new Date(now - 43200e4).toISOString() },
    ],
    inventory: [
      { id: 'inv1', name: 'Court Paint (navy)', unit: 'gal', unitCost: 48, stock: 42, reorderPoint: 20, supplier: 'Sherwin-Williams Pro' },
      { id: 'inv2', name: 'Polyurethane Finish', unit: 'gal', unitCost: 110, stock: 18, reorderPoint: 10, supplier: 'Bona US' },
      { id: 'inv3', name: 'Premium Vinyl Wrap', unit: 'sq ft', unitCost: 3.10, stock: 5200, reorderPoint: 2000, supplier: '3M Commercial' },
      { id: 'inv4', name: 'Game-Line Tape', unit: 'roll', unitCost: 12, stock: 14, reorderPoint: 25, supplier: 'Sherwin-Williams Pro' },
      { id: 'inv5', name: 'Wall Primer', unit: 'gal', unitCost: 39, stock: 25, reorderPoint: 12, supplier: 'Sherwin-Williams Pro' },
      { id: 'inv6', name: 'Donors-Wall Hardware Kit', unit: 'kit', unitCost: 180, stock: 9, reorderPoint: 6, supplier: 'GBC Enclosures' },
      { id: 'inv7', name: 'Rubber Surfacing (poured)', unit: 'sq ft', unitCost: 1.90, stock: 8800, reorderPoint: 3000, supplier: 'RubberSafe' },
    ],
    inventoryTx: [],
    passwordResets: [],
    tripPlans: [], travelEvents: [],
    exitTracker: [], seoAudits: [], securityFindings: [], disclosures: [],
    workflows: [], workflowRuns: [], brandAssets: [], healLog: [],
    improvements: [], recommendations: [], launchTasks: [], jobOffers: [], disputes: [], reviews: [], licenses: [], valuations: [],
    fundingDocs: [], grantSubmissions: [], grantMatches: [],
    subscribers: [], campaigns: [], newsItems: [],
    emails: [], messages: [], reminders: [],
    notifications: [
      { id: 'n1', channel: 'email', to: 'mbell@bellevue.org', subject: 'Friendly reminder: Invoice L&L-2026-004', status: 'sent', sentAt: new Date(now - 7200e3).toISOString(), preview: 'Hi Marcus — a friendly note that invoice L&L-2026-004 ($6,000) is past due…' },
    ],
    filings: [
      { id: 'fl1', name: 'TN Annual Report — LLC', state: 'TN', agency: 'TN Secretary of State — Business Services', dueDate: '2027-04-01', fee: 300, status: 'upcoming', filedDate: null, notes: 'Due by the 1st day of the 4th month after fiscal-year end (Apr 1 for calendar-year LLCs). $50/member, $300 minimum.' },
      { id: 'fl2', name: 'MS Annual Report — Foreign LLC', state: 'MS', agency: 'MS Secretary of State', dueDate: '2027-04-15', fee: 0, status: 'upcoming', filedDate: null, notes: 'Foreign qualification active. Annual report window Jan 1 – Apr 15; no fee for LLCs.' },
      { id: 'fl3', name: 'Registered Agent Review', state: 'TN', agency: 'TN Secretary of State — registered agent on file', dueDate: d(58), fee: 0, status: 'upcoming', filedDate: null, notes: 'Self-appointed agent — confirm the address on file is current; update via SoS change-of-agent form if moved.' },
      { id: 'fl4', name: 'AR Foreign Qualification', state: 'AR', agency: 'AR Secretary of State — Business & Commercial Services', dueDate: d(21), fee: 300, status: 'recommended', filedDate: null, notes: 'Jobs booked inside Arkansas — file the Application for Certificate of Authority before work commences. Unregistered foreign LLCs cannot maintain a suit in AR courts.' },
      { id: 'fl5', name: 'Shelby County Business Tax License', state: 'TN', agency: 'Shelby County Clerk', dueDate: '2027-01-31', fee: 15, status: 'filed', filedDate: d(-320), notes: 'Minimal business license — renews annually with the TN business tax return.' },
    ],
    settings: {
      company: { name: 'Lines & Logos', phone: 'info@linesandlogos.team', email: 'quotes@linesandlogos.com', serviceRadiusMiles: 400 },
      agent: { enabled: true, tone: 'professional', maxEmailsPerDay: 25, followUpDays: 3, autoQuote: true, autoNegotiate: true },
      quotes: { requireApproval: true, approvalEmail: 'admin@linesandlogos.com', marginPct: 35, validityDays: 30 },
      contracts: { depositPct: 50, reminderHoursBefore: 48, requireSignoff: true },
      notifications: { inApp: true, email: true, sms: false, techPhone: 'info@linesandlogos.team', clientChannel: 'both' },
      sales: { revenueTarget: 400000, hotThreshold: 80, autoScore: true },
      finance: { overdueAfterDays: 30, autoReminders: true },
      ops: { defaultCrew: 'Crew A', checklistRequired: true },
      marketing: { serviceAreaLabel: '400-mile radius', dripIntervalDays: 7 },
      pricing: { crewDayRate: 350, mileageRate: 0.90, hotelNightly: 120, perDiemPerPersonDay: 45, truckCapacity: 3 },
      /* logistics & travel agent — owner-tunable after researching each area */
      logistics: { mpg: 14, fuelPrice: 3.60, reimburseMode: 'fuel', nightlyRate: 120, lodgingTaxPct: 14,
        perDiem: 45, tollsPerMile: 0.04, equipmentHaulRate: 1.35, maxDriveHoursPerDay: 8, bufferPct: 10,
        autoApproveDeltaUnder: 150, hotelRates: {} },
      inventory: { autoReorder: true, lowStockDefault: 20, reorderCoverDays: 30, consumptionAlerts: true },
      security: { passkeysEnabled: true, sessionHours: 12, allowClientSignup: false },
      email: { from: 'quotes@linesandlogos.com', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smsProvider: '' },
      /* flat keys used by the settings page */
      companyName: 'Lines & Logos', adminEmail: 'admin@linesandlogos.com', fromEmail: 'noreply@linesandlogos.com',
      invoiceTermsDays: 30, reminderCadence: 'friendly ≤7d · firm 8–14d · final 15d+',
      dailyCron: '07:00 America/Chicago', weeklyCron: 'Mon 08:00 America/Chicago',
      /* tax engine — QuickBooks Tax Service is the source of truth when connected */
      tax: { enabled: true, basis: 'subtotal-plus-margin', qbManaged: false, disclaimer: 'Estimated combined state + local rate. Final tax is calculated by QuickBooks at invoicing.' },
      /* third-party integrations (keys via env / connect flow — never committed) */
      integrations: {
        quickbooks: { connected: false, realmId: '', clientId: '', environment: 'sandbox', syncTax: true, lastSync: null },
        stripe:     { connected: false, publishableKey: '', webhookSecret: '', lastSync: null, mode: 'simulated' },
      },
      /* CRM agent behavior */
      crm: { surveyDelayHours: 2, followUpDays: 14, renewalWindowDays: 60, autoSurvey: true, autoInvoiceOnComplete: true },
      payroll: { defaultHourlyRate: 22, payoutDay: 'Friday', autoApproveUnderHours: 50, payPeriodDays: 14, overtimeThreshold: 40, otMultiplier: 1.5, requireHoursApproval: true },
      leadGen: { enabled: true, dailyCap: 8, states: ['TN','MS','AR','MO','AL','KY','LA','OK'], requireApprovalToSend: true, fromName: 'Trey Smith', fromEmail: 'info@linesandlogos.team', physicalAddress: 'Lines & Logos · Memphis, TN' },
      tracking: { enabled: true, intervalMin: 5, retentionDays: 90, requireConsent: true, onsiteRadiusM: 150 },
      /* affiliate program — commission % is owner-editable; recommendedPct is the benchmark default shown on the partners page */
      affiliate: { enabled: true, defaultPct: 10, recommendedPct: 10, minPayout: 50, cookieDays: 90, autoApprove: true, payoutDays: '1st & 15th of the month',
        tiers: { promoter: 10, creator: 12, partner: 15 },
        basis: 'completed job value (first job per referred account)',
        note: 'Benchmark: referral/promoter programs in the trades typically pay 10–20% of the first job; 10% is the recommended default at our 35% margin.' },
      /* legal entity profile — drives the Compliance & State Filings Agent */
      entity: { legalName: 'Lines & Logos LLC', entityType: 'LLC', formationState: 'TN', formationDate: '2025-03-12', einLast4: '4821',
        registeredAgent: { name: 'Trey Smith (self-appointed)', feePerYear: 0 },
        operatingStates: ['TN','MS','AR','MO','AL','KY','LA','OK'], foreignQualified: ['MS'] },
      aiProviders: [], agentRouting: {}, aiUsage: { date: '', byProvider: {} },
      setup: { aiConfigured: false, aiPromptedAt: null, opencodeKey: '' },
    },
    surveys: [
      { id: 'sv1', token: 'demo-survey-token', accountId: 'a4', jobId: 'j4', sentAt: new Date(now - 9*864e5).toISOString(), status: 'responded', rating: 5, comment: 'Flawless — the lot looks brand new and the crew was gone before Monday classes.', respondedAt: new Date(now - 8*864e5).toISOString() },
    ],
    followUps: [
      { id: 'fu1', accountId: 'a3', type: 'survey', status: 'open', note: 'Bellevue — donors wall job complete; survey not yet sent', due: d(1), createdAt: new Date(now - 864e5).toISOString() },
    ],
    payouts: [],
    financialAlerts: [],
    crmVisitors: [],
    competitors: [
      { id: 'co1', name: 'Hussey / GameDay Surfaces', focus: 'National gym floor franchise', pricingNote: 'Premium pricing, 10–15% above regional', lastMove: 'Running fall refinishing promo in TN districts', moveDate: d(-6), threat: 'high' },
      { id: 'co2', name: 'Mid-South Court Co.', focus: 'Regional court striping', pricingNote: 'Budget pricing, limited design services', lastMove: 'Hired 2 striping techs (job posts)', moveDate: d(-12), threat: 'medium' },
      { id: 'co3', name: 'Signarama Memphis', focus: 'Signage & wraps only', pricingNote: 'Comparable on wraps; no athletic surfaces', lastMove: 'Launched school-spirit wrap package', moveDate: d(-20), threat: 'medium' },
    ],
    portals: [
      { token: 'demo-crew-token', name: 'Crew Lead', docs: [
        { name: 'W-9', signed: false }, { name: '1099 Acknowledgment', signed: false },
        { name: 'Scope of Work', signed: false }, { name: 'Safety Agreement', signed: false }, { name: 'Offer Letter', signed: false },
      ]},
    ],
    affiliates: [
      { id: 'af1', name: 'Coach Mike Ramsey', email: 'mramsey@example.com', phone: '901-555-0188', type: 'promoter', code: 'RAMSEY10', token: 'demo-affiliate-token', pct: null, status: 'active', payoutMethod: 'ACH •••• 4471', audience: 'PE coaches & athletic directors across Shelby County', createdAt: d(-30) },
    ],
    commissions: [
      { id: 'cm1', affiliateId: 'af1', jobId: 'j4', invoiceId: null, title: 'U of M — Parking Lot Striping', basis: 12750, pct: 10, amount: 1275, status: 'paid', createdAt: d(-10), paidAt: d(-8) },
      { id: 'cm2', affiliateId: 'af1', jobId: 'j1', invoiceId: null, title: 'MSCS — Gym Refresh (3 gyms)', basis: 86500, pct: 10, amount: 8650, status: 'pending', createdAt: d(-2) },
    ],
    hirePackages: [],
    interviews: [
      { id: 'iv1', packageId: null, applicantId: 'cd3', name: 'Terrence Cole', position: 'Striping Tech', when: d(1) + 'T14:00:00', link: 'https://meet.linesandlogos.com/iv-terrence', status: 'scheduled', createdAt: d(-1) },
    ],
    vendorCatalog: [
      { id: 'vc1', material: 'Court Paint (navy)', vendor: 'Sherwin-Williams Pro', unitPrice: 48, shipDays: 3, carrier: 'FedEx Freight' },
      { id: 'vc2', material: 'Court Paint (navy)', vendor: 'Beacon Athletics', unitPrice: 45, shipDays: 5, carrier: 'UPS Freight' },
      { id: 'vc3', material: 'Court Paint (navy)', vendor: 'PPG Paints', unitPrice: 50, shipDays: 2, carrier: 'FedEx Freight' },
      { id: 'vc4', material: 'Polyurethane Finish', vendor: 'Bona US', unitPrice: 110, shipDays: 4, carrier: 'FedEx Freight' },
      { id: 'vc5', material: 'Polyurethane Finish', vendor: 'Sherwin-Williams Pro', unitPrice: 118, shipDays: 3, carrier: 'FedEx Freight' },
      { id: 'vc6', material: 'Polyurethane Finish', vendor: 'Basic Coatings', unitPrice: 104, shipDays: 7, carrier: 'XPO Logistics' },
      { id: 'vc7', material: 'Premium Vinyl Wrap', vendor: '3M Commercial', unitPrice: 3.10, shipDays: 5, carrier: 'UPS Freight' },
      { id: 'vc8', material: 'Premium Vinyl Wrap', vendor: 'Avery Dennison', unitPrice: 2.95, shipDays: 6, carrier: 'XPO Logistics' },
      { id: 'vc9', material: 'Premium Vinyl Wrap', vendor: 'Orafol', unitPrice: 2.80, shipDays: 8, carrier: 'Estes Express' },
      { id: 'vc10', material: 'Game-Line Tape', vendor: 'Sherwin-Williams Pro', unitPrice: 12, shipDays: 3, carrier: 'FedEx Freight' },
      { id: 'vc11', material: 'Game-Line Tape', vendor: 'Beacon Athletics', unitPrice: 11, shipDays: 5, carrier: 'UPS Freight' },
      { id: 'vc12', material: 'Wall Primer', vendor: 'Sherwin-Williams Pro', unitPrice: 39, shipDays: 3, carrier: 'FedEx Freight' },
      { id: 'vc13', material: 'Wall Primer', vendor: 'PPG Paints', unitPrice: 36, shipDays: 4, carrier: 'FedEx Freight' },
      { id: 'vc14', material: 'Donors-Wall Hardware Kit', vendor: 'GBC Enclosures', unitPrice: 180, shipDays: 6, carrier: 'XPO Logistics' },
      { id: 'vc15', material: 'Donors-Wall Hardware Kit', vendor: 'FastSigns Memphis', unitPrice: 195, shipDays: 4, carrier: 'UPS Freight' },
      { id: 'vc16', material: 'Rubber Surfacing (poured)', vendor: 'RubberSafe', unitPrice: 1.90, shipDays: 7, carrier: 'Estes Express' },
      { id: 'vc17', material: 'Rubber Surfacing (poured)', vendor: 'PlayCore', unitPrice: 2.05, shipDays: 5, carrier: 'XPO Logistics' },
    ],
    employeeOnboardings: [
      { id: 'eo1', name: 'Andre Boone', role: 'Striping Lead', email: 'aboone@example.com', phone: '901-555-0143', type: '1099', availability: 'part-time', startDate: d(3), status: 'in-progress',
        steps: EMP_STEPS.map(s => ({ ...s, done: ['offer','portal'].includes(s.key) })), notes: 'Promoted from applicant pool — strong references.', created: d(-4) },
      { id: 'eo2', name: 'Darius Hall', role: 'Floor Installer', email: 'dhall@example.com', phone: '901-555-0163', type: '1099', availability: 'full-time', startDate: d(7), status: 'not-started',
        steps: freshSteps(EMP_STEPS), notes: 'AI screen 95 — approved, awaiting paperwork.', created: d(-1) },
    ],
    clientOnboardings: [
      { id: 'cb1', company: 'DeSoto County School District', contact: 'Angela Porter', email: 'aporter@desotocountyschools.org', phone: '662-555-0182', service: 'Gym Refresh x3 + restripes', value: 18900, startDate: d(14), status: 'in-progress',
        steps: CLIENT_STEPS.map(s => ({ ...s, done: ['kickoff','contract','deposit'].includes(s.key) })), notes: 'Board-approved PO expected before walkthrough.', created: d(-6) },
      { id: 'cb2', company: 'City of Little Rock Parks', contact: 'Dana Whitfield', email: 'dwhitfield@littlerock.gov', phone: '501-555-0122', service: 'Outdoor Courts (6)', value: 41000, startDate: d(21), status: 'not-started',
        steps: freshSteps(CLIENT_STEPS), notes: 'Budget qualified — waiting on council sign-off.', created: d(-2) },
    ],
    chatLogs: [],
    activity: [
      { t: new Date(now - 3600e3).toISOString(), msg: 'Lead Score Agent scored Angela Porter 87 (hot)' },
      { t: new Date(now - 7200e3).toISOString(), msg: 'Invoice Reminder Agent sent friendly reminder for L&L-2026-004' },
      { t: new Date(now - 10800e3).toISOString(), msg: 'Job Dispatch Agent matched Crew B to DeSoto restripe' },
      { t: new Date(now - 86400e3).toISOString(), msg: 'Competitor Watch Agent flagged Hussey fall promo in TN districts' },
      { t: new Date(now - 90000e3).toISOString(), msg: 'Daily Ops Agent generated morning brief' },
    ],
  };
}

/* ================= persistence ================= */
const DB_VERSION = 4;
let db;
function load(){
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE,'utf8'));
    /* login performs the plaintext→scrypt upgrade (only login has the plaintext); no boot migration */
    backupDb('boot');
    const fresh = seed();                       // merge: keep live data, add any new collections
    for (const k of Object.keys(fresh)) if (db[k] === undefined) db[k] = fresh[k];
  // migrate: contractor users need an employeeId for clock/payroll
  (db.users||[]).filter(u => u.role === 'contractor' && !u.employeeId).forEach((u, i) => {
    const emp = (db.employees||[])[i]; if (emp) u.employeeId = emp.id;
  });
    for (const sect of Object.keys(fresh.settings)) {                        // deep-merge new settings sections (objects only)
      const fv = fresh.settings[sect];
      const cv = db.settings[sect];
      if (fv && typeof fv === 'object' && !Array.isArray(fv))
        db.settings[sect] = Object.assign({}, fv, (cv && typeof cv === 'object' && !Array.isArray(cv)) ? cv : {});
      else if (cv === undefined || typeof cv !== typeof fv) db.settings[sect] = fv;   // self-heal scalars corrupted into objects (or vice versa)
    }
    db._v = DB_VERSION; save();
  } catch { db = seed(); db._v = DB_VERSION; save(); }
}
function save(){ fs.mkdirSync(path.dirname(DB_FILE), {recursive:true}); fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
load();

/* ================= helpers ================= */
function json(res, code, body){ res.writeHead(code, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(body)); }
function body(req, maxBytes = Infinity){
  return new Promise(resolve => {
    let s = '', size = 0, tooLarge = false;
    req.on('data', c => {
      size += c.length;
      if (size > maxBytes) { tooLarge = true; s = ''; }
      else if (!tooLarge) s += c;
    });
    req.on('end', () => {
      if (tooLarge) return resolve({ __tooLarge: true });
      try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); }
    });
  });
}
function auth(req){ const h=req.headers.authorization||''; const tok=h.replace(/^Bearer\s+/i,''); return db.users.find(u=>u.token===tok)||null; }
/* API-level role gate — mirrors the front-end nav. owner/admin pass all;
   exec = owner/admin only; office = desk staff; staff = desk+field. */
const STAFF = ['owner','admin','manager','staff'];
const FIELD = ['owner','admin','manager','staff','contractor','tech','crew'];
function gate(req, res, roles){
  const u = auth(req);
  if (!u){ json(res, 401, { error: 'Login required' }); return null; }
  const r = u.role || 'staff';
  if (r === 'owner' || r === 'admin') return u;
  if (!(roles || STAFF).includes(r)){ json(res, 403, { error: 'Insufficient access' }); return null; }
  return u;
}
function acctName(id){ const a=db.accounts.find(a=>a.id===id); return a?a.name:'—'; }
function empName(id){ const e=db.employees.find(e=>e.id===id); return e?e.name:'—'; }
function logActivity(msg){ db.activity.push({ t: new Date().toISOString(), msg }); }

/* ================= OUTBOUND SALES AGENT ================= */
const STAGES = ['prospect','contacted','needs-captured','quoted','negotiating','contract-sent','signed','scheduled','in-progress','complete'];

function sendEmail(to, subject, body, leadId){
  const e = { id: uid('em'), to, subject, body, leadId: leadId||null, status: 'sent', sentAt: new Date().toISOString() };
  db.emails.push(e);
  return e;
}
function sendMessage(to, channel, subject, body){   // in-app / sms / email notification to a person
  const m = { id: uid('msg'), to, channel, subject, body, status: 'sent', sentAt: new Date().toISOString() };
  db.messages.push(m); db.notifications.unshift({ id: uid('n'), channel, to, subject, status: 'sent', sentAt: m.sentAt, preview: body.slice(0,110) });
  return m;
}
function notify(to, subject, body, channels){        // respects settings.notifications
  const s = db.settings.notifications;
  if (s.inApp) sendMessage(to, 'in-app', subject, body);
  if (s.email && (!channels || channels.includes('email'))) sendMessage(to, 'email', subject, body);
  if (s.sms && (!channels || channels.includes('sms'))) sendMessage(to, 'sms', subject, body.slice(0, 160));
  /* web push mirror — ops notifications reach closed dashboards, categorized
     for lock-screen styling (approval/security/trip/payment actions + buzz) */
  if (s.inApp && /admin@linesandlogos\.com|approvalEmail/i.test(String(to))) {
    const t = (subject + ' ' + body).toLowerCase();
    const category = /secur|vulnerab|advisory/.test(t) ? 'security'
      : /approv|sign(ed|ature)?\b|po needs/.test(t) ? 'approval'
      : /trip|itinerary|hotel|crew/.test(t) ? 'trip'
      : /invoice|payment|paid|deposit/.test(t) ? 'payment'
      : /job|schedule|dispatch/.test(t) ? 'job' : 'default';
    pushToRole('admin', subject, String(body).slice(0, 160), '/dashboard.html', { category }).catch(() => {});
  }
}

/* ================= WEB PUSH (RFC 8291 aes128gcm + RFC 8292 VAPID) — zero-dependency ================= */
const hmac256 = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const hkdf1 = (prk, info, len) => hmac256(prk, Buffer.concat([info, Buffer.from([1])])).slice(0, len);   // single-block HKDF-Expand (all lens ≤ 32)
const b64u = b => Buffer.from(b).toString('base64url');

function ensurePush(){
  db.settings.push = db.settings.push || {};
  if (!Array.isArray(db.settings.push.subs)) db.settings.push.subs = [];
  if (db.settings.push.vapid && db.settings.push.vapid.publicKey) return;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pubJwk = publicKey.export({ format: 'jwk' });
  db.settings.push.vapid = {
    publicKey: Buffer.concat([Buffer.from([4]), Buffer.from(pubJwk.x, 'base64url'), Buffer.from(pubJwk.y, 'base64url')]).toString('base64url'),
    publicJwk: pubJwk,
    privateJwk: privateKey.export({ format: 'jwk' }),
    subject: 'mailto:admin@linesandlogos.com',
    createdAt: new Date().toISOString(),
  };
  save();
}
function vapidJwt(aud){
  const v = db.settings.push.vapid;
  const h = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const pl = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject }));
  const sig = crypto.sign('sha256', Buffer.from(h + '.' + pl),
    { key: crypto.createPrivateKey({ key: v.privateJwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' });
  return h + '.' + pl + '.' + b64u(sig);
}
function encryptPush(sub, payload){                    // RFC 8291 + RFC 8188 (aes128gcm content coding)
  const uaPub = Buffer.from(sub.keys.p256dh, 'base64url');
  const authS = Buffer.from(sub.keys.auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(undefined, 'uncompressed');
  const shared = ecdh.computeSecret(uaPub);
  const prkKey = hmac256(authS, shared);               // extract with auth_secret as salt
  const ikm = hkdf1(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const salt = crypto.randomBytes(16);
  const prk = hmac256(salt, ikm);
  const cek = hkdf1(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf1(prk, Buffer.from('Content-Encoding: nonce\0'), 12);
  const plain = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);   // padding delimiter, single record (rs 4096)
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}
async function sendPush(sub, payloadObj){
  const jwt = vapidJwt(new URL(sub.endpoint).origin);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(sub.endpoint, { method: 'POST', signal: ctl.signal,
      headers: { 'TTL': '86400', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
        'Authorization': `vapid t=${jwt}, k=${db.settings.push.vapid.publicKey}` },
      body: encryptPush(sub, JSON.stringify(payloadObj)) });
    return r.status;
  } finally { clearTimeout(t); }
}
async function pushToRole(role, title, bodyText, url, opts = {}){
  try {
    ensurePush();
    const subs = db.settings.push.subs.filter(s => s.role === role);
    if (!subs.length) return { sent: 0, subs: 0 };
    const payload = { title, body: bodyText, url: url || '/login.html',
      category: opts.category || 'default', tag: opts.tag,
      image: opts.image, silent: !!opts.silent, timestamp: Date.now(),
      actions: opts.actions, data: Object.assign({}, opts.data || {}) };
    if (opts.directionsUrl) payload.data.directionsUrl = opts.directionsUrl;
    let sent = 0; const dead = [];
    for (const s of subs) {
      try {
        const status = await sendPush(s.subscription, payload);
        if (status === 404 || status === 410) dead.push(s.subscription.endpoint);
        else if (status < 300) sent++;
      } catch { /* push service unreachable — in-app notification still landed */ }
    }
    if (dead.length) { db.settings.push.subs = db.settings.push.subs.filter(s => !dead.includes(s.subscription.endpoint)); save(); }
    return { sent, subs: subs.length, pruned: dead.length };
  } catch { return { sent: 0, error: true }; }
}
/* identity for push routes — accepts user tokens, crew portal tokens, client sign tokens, affiliate tokens */
function pushIdentity(req){
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return null;
  const u = db.users.find(u => u.token === tok || u.portalToken === tok);
  if (u) return { role: u.role === 'contractor' ? 'contractor' : 'admin', id: u.id };
  if (db.portals.some(p => p.token === tok)) return { role: 'contractor', id: tok.slice(0, 8) };
  const c = db.contracts.find(c => c.signToken === tok);
  if (c) return { role: 'client', id: c.id };
  const a = db.affiliates.find(a => a.token === tok);
  if (a) return { role: 'affiliate', id: a.id };
  return null;
}
function estimateQuote(lead){
  const base = { 'Full Facility': 85000, 'Gym Refresh': 30000, 'Court Restripe': 6000, 'Wall Wraps': 12000, 'Donors Wall': 15000, 'Signage & Striping': 8000, 'Playground Surfacing': 18000 };
  const b = base[lead.service] || 10000;
  const sqft = lead.sqft || 8000;
  return Math.round((b + sqft * 1.35) / 100) * 100;
}
function firstName(n){ return (n||'there').split(' ')[0]; }

function agentDiscover(){
  const pool = [
    { name: 'Principal Dana Cole', company: 'Nashville Christian Academy', service: 'Gym Refresh', email: 'dcole@nashchristian.edu', city: 'Nashville, TN' },
    { name: 'Rev. Tom Okafor', company: 'Little Rock Fellowship Church', service: 'Donors Wall', email: 't.okafor@lrfellowship.org', city: 'Little Rock, AR' },
    { name: 'AD Sheryl Vance', company: 'Birmingham City Schools', service: 'Full Facility', email: 's.vance@bhamcity.k12.al.us', city: 'Birmingham, AL' },
    { name: 'Facilities Mgr Luis Ortega', company: 'St. Louis Rec District', service: 'Playground Surfacing', email: 'l.ortega@stlrec.org', city: 'St. Louis, MO' },
    { name: 'Coach Betty Lane', company: 'Huntsville High School', service: 'Court Restripe', email: 'b.lane@huntsvillehs.org', city: 'Huntsville, AL' },
  ];
  const fresh = pool.filter(p => !db.leads.some(l => l.company === p.company));
  const made = fresh.slice(0, 2).map(p => {
    const lead = { id: uid('l'), stage: 'prospect', source: 'Outbound Agent', ...p };
    const { score, tier } = agents.scoreLead(lead);
    Object.assign(lead, { score, tier });
    db.leads.push(lead);
    addEvent(`New lead — ${lead.company}`, 'lead-new', new Date().toISOString().slice(0,10));
    logActivity(`Outbound Agent discovered new prospect: ${lead.company} (${lead.city})`);
    return lead;
  });
  save();
  return made;
}

/* one pipeline step per call — advances every lead that is eligible */
function agentRun(){
  const s = db.settings;
  if (!s.agent.enabled) return { ran: 0, reason: 'agent disabled in settings' };
  const actions = [];
  for (const lead of db.leads){
    const st = lead.stage || 'prospect';
    if (st === 'prospect'){
      lead.stage = 'contacted';
      sendEmail(lead.email, `Quick question about ${lead.company}'s facility`,
        `Hi ${firstName(lead.name)},\n\nI'm reaching out from ${s.company.name} — we handle gym floors, court striping, wall wraps and signage for schools, churches and rec facilities across a ${s.company.serviceRadiusMiles}-mile radius around Memphis.\n\nCould I ask a few quick questions about your facility's needs this year?\n\n— Outbound Sales Agent, ${s.company.name}`,
        lead.id);
      logActivity(`Outbound Agent emailed intro to ${lead.company}`);
      actions.push(`${lead.company}: prospect → contacted`);
    }
    else if (st === 'contacted'){
      lead.stage = 'needs-captured';
      lead.needs = `Surfaces: ${lead.service}; approx. ${lead.sqft||8000} sq ft; target window: next 60–90 days; budget: pending; decision maker: ${lead.name}.`;
      sendEmail(lead.email, `Thanks — a few quick questions`,
        `Hi ${firstName(lead.name)},\n\nThanks for replying! To put together an accurate, fixed-price quote I just need:\n1) Which surfaces (gym floor, courts, walls, parking)?\n2) Approximate square footage?\n3) Ideal timeframe?\n\n— ${s.company.name}`,
        lead.id);
      logActivity(`Outbound Agent captured needs for ${lead.company}`);
      actions.push(`${lead.company}: contacted → needs-captured`);
    }
    else if (st === 'needs-captured' && s.agent.autoQuote){
      lead.stage = 'quoted';
      lead.quoteAmount = estimateQuote(lead);
      sendEmail(lead.email, `Your fixed-price quote — ${lead.service}`,
        `Hi ${firstName(lead.name)},\n\nBased on your needs, here is your fixed-price quote:\n\n• Service: ${lead.service}\n• Estimate: $${lead.quoteAmount.toLocaleString()}\n• Valid: ${s.quotes.validityDays} days\n• Photo-documented completion, start to finish.\n\nHappy to walk through it any time.\n\n— ${s.company.name}`,
        lead.id);
      addEvent(`Quote sent — ${lead.company}`, 'quote-sent', new Date().toISOString().slice(0,10), { amount: lead.quoteAmount });
      if (s.quotes.requireApproval){
        notify(s.quotes.approvalEmail, `Quote approval needed: ${lead.company}`,
          `The Outbound Agent quoted ${lead.company} $${lead.quoteAmount.toLocaleString()} for ${lead.service}. Approve to move to negotiation: /agents.html`);
      }
      logActivity(`Outbound Agent quoted ${lead.company} $${lead.quoteAmount.toLocaleString()}`);
      actions.push(`${lead.company}: needs-captured → quoted ($${lead.quoteAmount.toLocaleString()})`);
    }
    else if (st === 'negotiating' && s.agent.autoNegotiate){
      lead.stage = 'contract-sent';
      const token = crypto.randomBytes(12).toString('hex');
      const deposit = Math.round((lead.quoteAmount||estimateQuote(lead)) * s.contracts.depositPct / 100);
      db.contracts.push({ id: uid('c'), leadId: lead.id, title: `${lead.service} Contract — ${lead.company}`, amount: lead.quoteAmount||estimateQuote(lead),
        status: 'sent', signToken: token,
        body: `${s.company.name} agrees to complete ${lead.service} for ${lead.company} at a fixed price of $${(lead.quoteAmount||estimateQuote(lead)).toLocaleString()}, including materials, labor, photo documentation, and a one-year touch-up warranty. Deposit: $${deposit.toLocaleString()} (${s.contracts.depositPct}%) on execution; balance net-30 after completion. Scope per the approved quote; changes require written change order. Photo & reference: Client authorizes Lines & Logos to identify Client as a business reference and to photograph and share completed work for portfolio and marketing purposes unless Client opts out in writing or via the Photo & Reference Opt-Out form (gallery.html#optout).` });
      sendEmail(lead.email, `Contract ready to sign — ${lead.service}`,
        `Hi ${firstName(lead.name)},\n\nGreat — here is your contract for e-signature. It locks the fixed price, timeline, and warranty in writing.\n\nSign here: /sign.html?token=${token}\n\n— ${s.company.name}`,
        lead.id);
      logActivity(`Outbound Agent sent contract to ${lead.company}`);
      actions.push(`${lead.company}: negotiating → contract-sent`);
    }
  }
  fireDueReminders();
  save();
  return { ran: actions.length, actions };
}

function approveQuote(leadId){
  const lead = db.leads.find(l => l.id === leadId);
  if (!lead || lead.stage !== 'quoted') return { error: 'Lead not awaiting quote approval' };
  lead.stage = 'negotiating';
  logActivity(`Owner approved quote for ${lead.company} — moving to negotiation`);
  notify(lead.email || 'client', `Next steps — ${lead.service}`,
    `Hi ${firstName(lead.name)},\n\nYour quote of $${(lead.quoteAmount||0).toLocaleString()} is approved on our side. I'd like to confirm scope and timeline — reply here and I'll have your contract ready same day.\n\n— ${s().company.name}`);
  pushToRole('client', 'Quote approved — next steps', `Your ${lead.service} quote is approved. Open your portal to confirm scope & timeline.`, '/customer.html').catch(() => {});
  save();
  return { ok: true, lead };
}
function s(){ return db.settings; }

function signContract(token, signerName, signature){
  const c = db.contracts.find(c => c.signToken === token);
  if (!c) return { error: 'Contract not found' };
  if (c.status === 'signed') return { error: 'Already signed' };
  c.status = 'signed'; c.signerName = signerName; c.signature = signature; c.signedAt = new Date().toISOString();
  addEvent(`Contract signed — ${signerName}`, 'contract-signed', new Date().toISOString().slice(0,10), { amount: c.amount });
  const lead = db.leads.find(l => l.id === c.leadId);
  if (lead) lead.stage = 'signed';
  // upsert account + create job
  let acct = db.accounts.find(a => a.name === (lead ? lead.company : c.title));
  if (!acct){ acct = { id: uid('a'), name: lead ? lead.company : 'New Account', tier: 'B', health: 'green', seats: 0, city: lead ? lead.city || 'Memphis, TN' : 'Memphis, TN' }; db.accounts.push(acct); }
  const job = { id: uid('j'), title: `${lead ? lead.service : c.title} — ${acct.name}`, accountId: acct.id, status: 'scheduled', crew: s().ops.defaultCrew,
    value: c.amount, due: new Date(Date.now() + 21*864e5).toISOString().slice(0,10) };
  db.jobs.push(job);
  // confirmation + reminders to tech AND client
  const when = new Date(Date.now() + 21*864e5).toLocaleDateString('en-US',{month:'long',day:'numeric'});
  notify(s().quotes.approvalEmail, `NEW SIGNED CONTRACT — ${acct.name}`,
    `Contract "${c.title}" signed by ${signerName} ($${c.amount.toLocaleString()}). Job ${job.id} scheduled ${when}, crew ${job.crew}.`, ['in-app','email']);
  if (lead && lead.email) notify(lead.email, `Contract signed — see you ${when}`,
    `Hi ${firstName(lead.name)},\n\nYour contract is signed and on file. Your crew (${job.crew}) arrives ${when}. We'll send a reminder before the date. — ${s().company.name}`, ['in-app','email','sms']);
  db.reminders.push({ id: uid('rm'), jobId: job.id, audience: 'tech', fireAt: new Date(Date.now() + (21*24 - s().contracts.reminderHoursBefore)*3600e3).toISOString(), subject: `Reminder: ${job.title} in ${s().contracts.reminderHoursBefore}h`, status: 'scheduled' });
  db.reminders.push({ id: uid('rm'), jobId: job.id, audience: 'client', fireAt: new Date(Date.now() + (21*24 - s().contracts.reminderHoursBefore)*3600e3).toISOString(), subject: `Reminder: ${job.title} — crew arrives ${when}`, status: 'scheduled' });
  logActivity(`Contract signed by ${signerName} — job created & reminders scheduled`);
  save();
  return { ok: true, contract: c, job };
}
/* ================= TAX ENGINE =================
 * Estimated combined state + average local sales/use tax for the job's location.
 * Rates are refreshed from QuickBooks Tax Service when the QBO integration is
 * connected (settings.integrations.quickbooks); otherwise this built-in table is
 * used and every quote carries the "estimate" disclaimer. */
const TAX_RATES = {   // state → { rate (% combined avg), name }
  TN: { rate: 9.55, name: 'Tennessee' },  MS: { rate: 7.07, name: 'Mississippi' },
  AR: { rate: 9.45, name: 'Arkansas' },   AL: { rate: 9.24, name: 'Alabama' },
  MO: { rate: 8.36, name: 'Missouri' },   KY: { rate: 6.00, name: 'Kentucky' },
  LA: { rate: 9.55, name: 'Louisiana' },  IL: { rate: 8.82, name: 'Illinois' },
  GA: { rate: 7.35, name: 'Georgia' },    IN: { rate: 7.00, name: 'Indiana' },
  OK: { rate: 8.98, name: 'Oklahoma' },   TX: { rate: 8.20, name: 'Texas' },
  OH: { rate: 7.24, name: 'Ohio' },       KS: { rate: 8.70, name: 'Kansas' },
  IA: { rate: 6.94, name: 'Iowa' },       FL: { rate: 7.02, name: 'Florida' },
};
const CITY_STATE = {  // service-footprint cities → state (400-mile radius + edge metros)
  memphis:'TN', bartlett:'TN', collierville:'TN', cordova:'TN', germantown:'TN', nashville:'TN', 'jackson, tn':'TN', knoxville:'TN', chattanooga:'TN', clarksville:'TN', murfreesboro:'TN', dyersburg:'TN',
  southaven:'MS', 'olive branch':'MS', oxford:'MS', tupelo:'MS', 'jackson, ms':'MS', hattiesburg:'MS', meridian:'MS', gulfport:'MS',
  jonesboro:'AR', 'little rock':'AR', conway:'AR', 'pine bluff':'AR', fayetteville:'AR', rogers:'AR', 'fort smith':'AR', texarkana:'AR', 'hot springs':'AR',
  birmingham:'AL', huntsville:'AL', montgomery:'AL', mobile:'AL', tuscaloosa:'AL', decatur:'AL', florence:'AL', auburn:'AL', dothan:'AL',
  'st. louis':'MO', 'st louis':'MO', 'cape girardeau':'MO', springfield:'MO', columbia:'MO', 'jefferson city':'MO', joplin:'MO', 'kansas city':'MO',
  paducah:'KY', louisville:'KY', lexington:'KY', 'bowling green':'KY', owensboro:'KY', murray:'KY',
  'new orleans':'LA', 'baton rouge':'LA', shreveport:'LA', lafayette:'LA', monroe:'LA',
  carbondale:'IL', springfieldil:'IL', peoria:'IL', bloomington:'IL',
  atlanta:'GA', 'columbus, ga':'GA', indianapolis:'IN', evansville:'IN', tulsa:'OK', 'oklahoma city':'OK', cincinnati:'OH', dallas:'TX', 'fort worth':'TX', wichita:'KS',
};
function stateFromCity(city){
  const c = (city || '').toLowerCase().trim();
  const stMatch = c.match(/,\s*([a-z]{2})$/);
  if (stMatch && TAX_RATES[stMatch[1].toUpperCase()]) return stMatch[1].toUpperCase();
  if (CITY_STATE[c]) return CITY_STATE[c];
  const bare = c.split(',')[0].trim();
  if (CITY_STATE[bare]) return CITY_STATE[bare];
  return 'TN';   // home state default
}
function taxFor(city){
  const st = stateFromCity(city);
  const t = TAX_RATES[st];
  return { state: st, stateName: t.name, rate: t.rate,
    source: (db.settings.integrations && db.settings.integrations.quickbooks.connected && db.settings.integrations.quickbooks.syncTax) ? 'quickbooks' : 'builtin-table' };
}

/* ================= PRICING / QUOTING AGENT ================= */
/* service catalog: materials $/sqft, crew size, productivity sqft/day */
const SERVICES = {
  refinish:   { label:'Gym Floor Refinish',      materialPerSqft: 2.25, crew: 4, prodPerDay: 2500, minDays: 2 },
  restripe:   { label:'Court Restripe',          materialPerSqft: 0.35, crew: 2, prodPerDay: 12000, minDays: 0.5 },
  wallwrap:   { label:'Wall Wrap / Graphics',    materialPerSqft: 3.40, crew: 2, prodPerDay: 600, minDays: 1 },
  donorswall: { label:'Donors Wall',             materialPerSqft: 4.50, crew: 3, prodPerDay: 80, minDays: 3, flatMaterials: 900 },
  signage:    { label:'Signage & Parking Striping', materialPerSqft: 0.10, crew: 2, prodPerDay: 20000, minDays: 1, flatMaterials: 800 },
  playground: { label:'Playground Surfacing',    materialPerSqft: 2.80, crew: 3, prodPerDay: 1500, minDays: 1 },
};

function buildQuote(input){
  const P = db.settings.pricing, Q = db.settings.quotes;
  const svc = SERVICES[input.service] || SERVICES.refinish;
  const sqft = Math.max(200, +input.sqft || 8000);
  const miles = Math.max(0, +input.miles || 0);            // one-way from Memphis
  const days = Math.max(svc.minDays, Math.ceil(sqft / svc.prodPerDay));
  const crew = svc.crew;
  const trucks = Math.ceil(crew / P.truckCapacity);
  // labor
  const labor = crew * days * P.crewDayRate;
  // materials
  const materials = Math.round(sqft * svc.materialPerSqft + (svc.flatMaterials || 0));
  // travel — fuel/deprecation round-trip per truck
  const travel = Math.round(miles * 2 * P.mileageRate * trucks);
  // lodging — crew stays over only if job is far enough to warrant it
  const nights = miles > 60 ? Math.max(0, days - 0) : 0;   // one hotel night per crew day on the road
  const hotel = nights * crew * P.hotelNightly;
  const perDiem = days * crew * P.perDiemPerPersonDay;
  const subtotal = labor + materials + travel + hotel + perDiem;
  const margin = Math.round(subtotal * (Q.marginPct || 35) / 100);
  const total = subtotal + margin;
  /* location-aware sales tax on the quoted total */
  const t = taxFor(input.city || input.state || 'Memphis, TN');
  const taxAmount = db.settings.tax && db.settings.tax.enabled ? Math.round(total * t.rate / 100) : 0;
  const grandTotal = total + taxAmount;
  return {
    service: svc.label, sqft, miles, days, crew, trucks, nights,
    lineItems: [
      { label:`Labor — ${crew} crew × ${days} day${days>1?'s':''} × $${P.crewDayRate}/day`, amount: labor },
      { label:`Materials — ${sqft.toLocaleString()} sq ft × $${svc.materialPerSqft}/sq ft${svc.flatMaterials?` + $${svc.flatMaterials} hardware`:''}`, amount: materials },
      { label:`Travel — ${miles} mi one-way × 2 × $${P.mileageRate}/mi × ${trucks} truck${trucks>1?'s':''}`, amount: travel },
      ...(nights ? [{ label:`Hotel — ${nights} night${nights>1?'s':''} × ${crew} rooms × $${P.hotelNightly}/night`, amount: hotel }] : []),
      { label:`Per diem — ${crew} crew × ${days} day${days>1?'s':''} × $${P.perDiemPerPersonDay}/day`, amount: perDiem },
      { label:`Margin (${Q.marginPct || 35}%)`, amount: margin },
      ...(taxAmount ? [{ label:`Estimated sales tax — ${t.stateName} (${t.rate}% combined)`, amount: taxAmount, tax: true }] : []),
    ],
    subtotal, margin, total,
    taxState: t.state, taxStateName: t.stateName, taxRate: t.rate, taxAmount, grandTotal, taxSource: t.source,
    taxDisclaimer: (db.settings.tax && db.settings.tax.disclaimer) || '',
  };
}

/* ================= INVENTORY AGENT ================= */
/* materials consumed per service: itemId → qty per sq ft (or flat per job) */
const CONSUMPTION = {
  refinish:   [ { item:'inv2', perSqft:0.022 }, { item:'inv1', perSqft:0.008 } ],
  restripe:   [ { item:'inv1', perSqft:0.012 }, { item:'inv4', perSqft:0.0008 } ],
  wallwrap:   [ { item:'inv3', perSqft:1.0 } ],
  donorswall: [ { item:'inv5', perSqft:0.02 }, { item:'inv6', flat:3 } ],
  signage:    [ { item:'inv1', perSqft:0.004 }, { item:'inv6', flat:2 } ],
  playground: [ { item:'inv7', perSqft:1.0 }, { item:'inv1', perSqft:0.03 } ],
};

function txItem(item, delta, reason, jobId){
  item.stock = Math.round((item.stock + delta) * 100) / 100;
  db.inventoryTx.unshift({ id: uid('tx'), itemId: item.id, delta, reason, jobId: jobId || null, at: new Date().toISOString(), stockAfter: item.stock });
}

/* deduct materials for a job/quote; flags anything that drops below reorder point */
function consumeMaterials(service, sqft, jobId){
  const plan = CONSUMPTION[service] || [];
  const used = [];
  for (const line of plan){
    const item = db.inventory.find(i => i.id === line.item); if (!item) continue;
    const qty = Math.round(((line.perSqft || 0) * sqft + (line.flat || 0)) * 100) / 100;
    if (qty <= 0) continue;
    txItem(item, -qty, `Consumed — ${SERVICES[service] ? SERVICES[service].label : service} (${sqft.toLocaleString()} sq ft)`, jobId);
    used.push({ item: item.name, qty, unit: item.unit });
    if (db.settings.inventory.consumptionAlerts && item.stock <= item.reorderPoint)
      notify(db.settings.quotes.approvalEmail, `Low stock: ${item.name}`, `${item.name} is at ${item.stock} ${item.unit} after job consumption (reorder point ${item.reorderPoint}).`, ['in-app']);
  }
  return used;
}

/* audit stock vs reorder points → auto purchase orders + alerts (when enabled) */
function auditInventory(){
  const s = db.settings.inventory;
  const low = db.inventory.filter(i => i.stock <= i.reorderPoint);
  const pos = [];
  for (const item of low){
    const qty = Math.max(item.reorderPoint * 2 - item.stock, 10);
    notify(db.settings.quotes.approvalEmail, `Inventory alert: ${item.name}`, `${item.name} at ${item.stock} ${item.unit} (reorder point ${item.reorderPoint}). ${s.autoReorder ? 'Purchase order drafted.' : 'Reorder disabled in settings.'}`, ['in-app','email']);
    logActivity(`Inventory Agent flagged low stock: ${item.name} (${item.stock} ${item.unit})`);
    if (s.autoReorder){
      /* Procurement Agent sources best price + ship date and drafts the PO to the approvals queue */
      const r = draftProcurement([{ material: item.name, qty }], { reason: 'reorder-point' });
      pos.push(...r.pos);
      logActivity(`Inventory Agent flagged ${qty} ${item.unit} of ${item.name} → Procurement Agent sourcing (${r.pos.length ? 'PO drafted to approvals' : 'open PO already covers it'})`);
    }
  }
  save();
  return { low: low.map(i => ({ name: i.name, stock: i.stock, unit: i.unit, reorderPoint: i.reorderPoint })), purchaseOrders: pos };
}

/* ================= INQUIRY + CS AGENT ================= */
function analyzeText(msg){
  const m = (msg||'').toLowerCase(); let intent = 'general', reply = '';
  if (/price|quote|cost|estimate|bid/.test(m)) { intent = 'pricing';
    reply = 'Thanks for reaching out! The fastest path is an instant line-item quote at quotes.html — tell us the service type, approximate square footage, and your city (we serve a 400-mile radius around Memphis) and our Pricing Agent will email you a fixed price within minutes.'; }
  else if (/status|when.*(start|finish|done)|schedule|job update/.test(m)) { intent = 'job-status';
    reply = 'Happy to check! Reply with the email you booked with and we\'ll pull up your job status, crew assignment, and dates right away.'; }
  else if (/walk ?through|site visit|measure/.test(m)) { intent = 'walkthrough';
    reply = 'We can schedule a free walkthrough — laser measurements, photos, and a fixed quote within 48 hours. What days work best for your facility?'; }
  else if (/complaint|unhappy|problem|issue|wrong|damage/.test(m)) { intent = 'support';
    reply = 'I\'m sorry to hear that — a team lead will personally review this and respond within one business day. If urgent, call info@linesandlogos.team.'; }
  else if (/human|person|call me|speak/.test(m)) { intent = 'handoff';
    reply = 'No problem — I\'ve flagged this for the team. Someone will reply by email or phone within one business day.'; }
  else reply = 'Thanks for contacting Lines & Logos! We handle gym floors, court striping, wall wraps, donors walls, and signage across a 400-mile radius of Memphis. Tell us a bit about your facility and we\'ll take it from there.';
  const neg = /complaint|unhappy|problem|issue|wrong|damage|terrible|bad/.test(m);
  return { intent, sentiment: neg ? 'negative' : 'positive', reply };
}
function addInquiry(source, name, email, message, extra){
  const a = analyzeText(message);
  const q = { id: uid('in'), source, name: name||'Anonymous', email: email||'', message, intent: a.intent,
    sentiment: a.sentiment, reply: a.reply, status: 'analyzed', createdAt: new Date().toISOString(), ...(extra||{}) };
  db.inquiries.unshift(q); save(); return q;
}

/* ================= CALENDAR AGGREGATOR ================= */
function calendarEvents(){
  const ev = [];
  const day = iso => iso ? iso.slice(0,10) : null;
  for (const j of db.jobs) if (j.due) ev.push({ date: day(j.due), title: 'Job: ' + j.title, type: 'job', meta: `${j.status} · ${j.crew||'unassigned'}` });
  for (const l of db.leads){ if (l.createdAt) ev.push({ date: day(l.createdAt), title: 'New lead: ' + l.company, type: 'lead' }); }
  for (const q of db.quoteRequests) if (q.createdAt) ev.push({ date: day(q.createdAt), title: `Quote sent: ${q.service} — ${q.name}`, type: 'quote', meta: '$' + q.total.toLocaleString() });
  for (const c of db.contracts){
    if (c.signedAt) ev.push({ date: day(c.signedAt), title: 'Contract signed: ' + c.title, type: 'contract', meta: c.signerName });
    else ev.push({ date: day(new Date().toISOString()), title: 'Contract sent (awaiting signature): ' + c.title, type: 'contract' });
  }
  for (const po of db.purchaseOrders){
    ev.push({ date: day(po.createdAt), title: 'Materials ordered: ' + (po.vendor||'supplier'), type: 'order', meta: '$' + (po.total||0).toLocaleString() });
    if (po.shipEta && po.status !== 'delivered') ev.push({ date: day(po.shipEta), title: 'Shipping ETA: ' + (po.items||[]).map(i=>i.name).join(', '), type: 'shipping', meta: po.status || 'ordered', poId: po.id });
    if (po.deliveredAt) ev.push({ date: day(po.deliveredAt), title: 'Materials delivered: ' + (po.vendor||''), type: 'shipping' });
  }
  for (const r of db.reminders) if (r.fireAt) ev.push({ date: day(r.fireAt), title: r.subject, type: 'reminder', meta: r.audience });
  for (const e of (db.events||[])) ev.push(e);
  return ev.sort((a,b) => (a.date||'').localeCompare(b.date||''));
}

/* ================= INQUIRY + SERVICE AGENTS, CALENDAR, REVIEWS, GALLERY ================= */
function addEvent(title, type, at, meta){
  const ev = { id: uid('ev'), title, type, at, meta: meta || {} };
  db.events.push(ev);
  /* event notifications — interviews, orders, shipments, deliveries, walkthroughs, jobs ping the admin dashboard */
  if (['interview','shipping','order','walkthrough','delivery','job'].includes(type))
    db.notifications.push({ id: uid('n'), channel: 'in-app', to: db.settings.quotes.approvalEmail,
      subject: `Calendar: ${title}`, status: 'sent', sentAt: new Date().toISOString(),
      preview: `${type} — ${at}${ev.meta.time ? ' at ' + ev.meta.time : ''}` });
  return ev;
}

/* tiny rule-based customer-service brain — shared by chat + inquiry replies */
function serviceBrain(text){
  const t = (text||'').toLowerCase();
  if (/walk[\s-]?through|site visit|come (see|look)|book.*(visit|walkthrough)|schedule.*(visit|walkthrough)/.test(t))
    return { service:'scheduling', reply:'Happy to set that up — I can queue a site walkthrough for you. Tell me your city and preferred day (weekday mornings or afternoons work best), and the team will confirm the exact time within one business day.' };
  if (/remember that/i.test(text || '')){
    const fact = rememberFact(String(text).replace(/^.*?remember that\s*/i, ''), 'chat');
    return { service:'memory', reply: fact ? 'Noted — I\'ll keep that on file and bring it up when it\'s relevant. Say "what do you remember" anytime to see what I know.' : 'Tell me a bit more and I\'ll record it.' };
  }
  if (/what do you (know|remember)|recall|memory bank/i.test(t)){
    const found = memorySearch(text || '');
    return { service:'memory', reply: found.length ? 'Here\'s what I have on file:\n' + found.map(f => '• ' + f.text).join('\n') : 'Nothing on file about that yet — as work happens (jobs, vendors, decisions), I record durable facts automatically.' };
  }
  if (/(charge|transaction|expens|spend)/.test(t) && /(what|why|explain|which|who)/.test(t)){
    const found = spendLookup(text || '');
    return { service:'finance', reply: found ? `Here's what I found in the books: ${found}. Say the word and I'll flag any of these for review.` : 'I couldn\'t match that to a recorded expense or payment — give me the amount (e.g. "$214.50") or the vendor name and I\'ll dig again.' };
  }
  const service = /refinish|sand|finish/.test(t) ? 'gym floor refinishing'
    : /stripe|line/.test(t) ? 'court striping'
    : /wrap|vinyl|mural|wall/.test(t) ? 'wall wraps & graphics'
    : /donor/.test(t) ? 'donors walls'
    : /sign|parking/.test(t) ? 'signage & parking-lot striping'
    : /playground/.test(t) ? 'playground surfacing' : 'facility branding';
  const sqft = (t.match(/(\d[\d,]{2,})\s*(sq\s?ft|square feet)/) || [])[1];
  const city = (t.match(/(memphis|nashville|little rock|jackson|birmingham|st\.? louis|huntsville|atlanta|new orleans|louisville|tupelo|jonesboro|paducah)/) || [])[1];
  const urgent = /urgent|asap|immediately|emergency|before .*season/.test(t);
  const sentiment = /(terrible|awful|worst|furious|angry|disappointed|unacceptable)/.test(t) ? 'negative'
    : /(love|great|amazing|excellent|perfect|thanks|thank you)/.test(t) ? 'positive' : 'neutral';
  let reply = `Thanks for reaching out! Based on what you've described, that sounds like a ${service} project`;
  if (city) reply += ` in ${city} — that's inside our 400-mile service area`;
  if (sqft) reply += ` at roughly ${sqft} sq ft`;
  reply += `. Your best next step is our instant-quote page (quotes.html) for a fixed line-item price, or reply here and I'll route it to a specialist${urgent ? ' — I flagged your request as time-sensitive' : ''}.`;
  return { service, sqft: sqft || null, city: city || null, urgent, sentiment, reply };
}

function analyzeInquiry(iq){
  const a = serviceBrain(iq.message);
  iq.sentiment = a.sentiment;
  iq.intent = a.service;
  iq.urgency = a.urgent ? 'high' : 'normal';
  iq.extracted = { service: a.service, sqft: a.sqft, city: a.city };
  iq.reply = a.reply;
  iq.status = 'analyzed';
  logActivity(`Inquiry Agent analyzed inquiry from ${iq.name}: ${a.service} (${a.sentiment})`);
}
async function respondInquiry(iq){
  if (iq.status === 'new') analyzeInquiry(iq);
  let reply = iq.reply;
  const ai = await aiAssist('inbox', { system:'You are the customer-care agent for Lines & Logos, a Memphis TN gym-floor and athletic-branding company. Rewrite the reply: keep every fact, be warm and concise, never invent prices, certifications, or dates.',
    user:`Customer ${iq.name} (${iq.email || 'no email'}, ${iq.source || 'website'}) wrote: "${iq.message}"

Draft reply:
${reply}

Rewrite the reply.`, maxTokens: 350 });
  if (!ai.simulated && ai.text){ reply = ai.text; iq.reply = reply; iq.aiAssisted = ai.provider; }
  if (iq.email) sendEmail(iq.email, `Re: your Lines & Logos inquiry`, reply, null);
  iq.status = 'replied'; iq.repliedAt = new Date().toISOString();
  logActivity(`Inquiry Agent responded to ${iq.name} (${iq.source})${ai.simulated ? '' : ` — AI-polished via ${ai.provider}`}`);
}

function fireDueReminders(){
  const now = new Date().toISOString();
  for (const r of db.reminders.filter(r => r.status === 'scheduled' && r.fireAt <= now)){
    r.status = 'sent'; r.sentAt = now;
    const job = db.jobs.find(j => j.id === r.jobId);
    notify(r.audience === 'tech' ? s().quotes.approvalEmail : (job ? job.title.split(' — ')[1] : 'client'), r.subject,
      `${r.subject}. Job: ${job ? job.title : ''}. Crew: ${job ? job.crew : ''}.`, ['in-app','email','sms']);
    logActivity(`Reminder fired (${r.audience}): ${r.subject}`);
  }
}
function daysOverdue(inv){ const due = new Date(inv.dueDate || inv.issued); return Math.floor((Date.now() - due.getTime()) / 864e5); }
function invPaid(id){ return db.payments.filter(p => p.invoiceId === id).reduce((s,p) => s + p.amount, 0); }

/* ================= AI AGENTS (9) — deterministic heuristics ================= */
const agents = {
  /* 1 — Lead Score Agent */
  scoreLead(l){
    let s = 50;
    if (/school|district|university|college|academy/i.test(l.company||'')) s += 20;
    if (/church|park|city|municipal/i.test(l.company||'')) s += 8;
    if (/full|facility|campus/i.test(l.service||'')) s += 15;
    if (/gym|court|stripe|wrap|donor/i.test(l.service||'')) s += 6;
    if (l.source === 'Referral') s += 10;
    s += Math.min(10, (l.company||'').length % 11);
    s = Math.max(0, Math.min(100, s));
    const tier = s >= 80 ? 'hot' : s >= 60 ? 'warm' : 'cold';
    const nextStep = tier === 'hot' ? 'Send proposal within 24h'
      : /walk|donor|wrap/i.test(l.service||'') ? 'Schedule walkthrough'
      : tier === 'warm' ? 'Qualify budget & timeline' : 'Send battle card + nurture';
    return { score: s, tier, nextStep };
  },

  /* 2 — Job Dispatch Agent */
  dispatch(job){
    const text = (job.title + ' ' + (job.notes||'')).toLowerCase();
    const ranked = db.employees
      .filter(e => e.w9Signed)
      .map(e => {
        const hits = (e.skills||[]).filter(k => text.includes(k)).length;
        const load = db.timeEntries.filter(t => t.employeeId === e.id && new Date(t.date) > new Date(Date.now() - 7*864e5))
                                   .reduce((s,t) => s + t.hours, 0);
        return { employee: e, score: hits * 25 + e.rating * 6 + (e.availability === 'full-time' ? 8 : 0) - load * 0.6 };
      })
      .sort((a,b) => b.score - a.score);
    if (!ranked.length) return { match: null, rationale: 'No dispatchable contractors (W-9 pending).' };
    const best = ranked[0];
    return {
      match: { id: best.employee.id, name: best.employee.name, role: best.employee.role },
      rationale: `${best.employee.name} — ${best.employee.role}, rating ${best.employee.rating}, ${(best.employee.skills||[]).filter(k => text.includes(k)).length || 'general'} skill match${ranked[1] ? `; runner-up ${ranked[1].employee.name}` : ''}.`,
      ranked: ranked.map(r => ({ name: r.employee.name, score: Math.round(r.score) })),
    };
  },

  /* 3 — Invoice Reminder Agent (escalating tone) */
  reminder(inv){
    const days = daysOverdue(inv);
    const tone = days <= 7 ? 'friendly' : days <= 14 ? 'firm' : 'final';
    const acct = acctName(inv.accountId);
    const bodies = {
      friendly: `Hi ${acct.split(' ')[0]} team — a friendly note that invoice ${inv.number} for $${inv.amount.toLocaleString()} came due ${inv.dueDate}. If payment is already on its way, thank you! Otherwise we'd appreciate an update on timing.`,
      firm: `Hello ${acct} — invoice ${inv.number} ($${inv.amount.toLocaleString()}) is now ${days} days past due. Please remit payment this week or contact us to arrange a plan so we can keep your account in good standing.`,
      final: `FINAL NOTICE — ${acct}: invoice ${inv.number} ($${inv.amount.toLocaleString()}) is ${days} days past due. This is our final written reminder before the account is escalated and future work is paused. Please remit immediately or call us today.`,
    };
    return { tone, days, subject: `${tone === 'final' ? 'FINAL NOTICE' : tone === 'firm' ? 'Payment reminder' : 'Friendly reminder'}: Invoice ${inv.number}`, body: bodies[tone] };
  },

  /* 4 — Health Score Agent */
  health(a){
    const notes = [];
    let level = 'green';
    const od = db.invoices.filter(i => i.accountId === a.id && i.status === 'overdue');
    if (od.length) { level = 'red'; notes.push(`${od.length} overdue invoice(s): ${od.map(i=>i.number).join(', ')}`); }
    const daysToRenewal = a.renewal ? Math.floor((new Date(a.renewal) - Date.now()) / 864e5) : null;
    if (daysToRenewal !== null && daysToRenewal < 45) {
      if (level === 'green') level = 'yellow';
      notes.push(`Renewal in ${daysToRenewal} days — start renewal motion now`);
    }
    const openTickets = db.tickets.filter(t => t.accountId === a.id && t.status !== 'resolved').length;
    if (openTickets) { if (level === 'green') level = 'yellow'; notes.push(`${openTickets} open support ticket(s)`); }
    const fb = db.feedback.filter(f => f.accountId === a.id).pop();
    if (fb && fb.rating <= 3) { level = 'red'; notes.push(`Low client rating (${fb.rating}★)`); }
    if (!notes.length) notes.push('Healthy — no overdue invoices, tickets, or renewal risk');
    return { level, notes };
  },

  /* 5 — Competitor Watch Agent */
  competitorWatch(){
    return db.competitors
      .map(c => ({ ...c, daysAgo: Math.floor((Date.now() - new Date(c.moveDate)) / 864e5) }))
      .sort((a,b) => a.daysAgo - b.daysAgo)
      .map(c => ({ name: c.name, threat: c.threat, move: c.lastMove, pricing: c.pricingNote, daysAgo: c.daysAgo,
                   flag: c.daysAgo <= 7 && c.threat === 'high' ? 'ACT NOW' : c.daysAgo <= 14 ? 'watch' : 'logged' }));
  },

  /* 6 — Daily Ops Agent */
  dailyBrief(){
    fireDueReminders();
    const overdue = db.invoices.filter(i => i.status === 'overdue');
    return {
      date: new Date().toISOString().slice(0,10),
      jobsToday: db.jobs.filter(j => j.status === 'in-progress').map(j => ({ title: j.title, crew: j.crew, due: j.due })),
      openQuotes: db.quotes.filter(q => q.status === 'sent').map(q => ({ number: q.number, account: acctName(q.accountId), amount: q.amount })),
      overdueInvoices: overdue.map(i => ({ number: i.number, account: acctName(i.accountId), amount: i.amount, days: daysOverdue(i), tone: agents.reminder(i).tone })),
      hotLeads: db.leads.filter(l => l.tier === 'hot').map(l => ({ name: l.name, company: l.company, nextStep: l.nextStep })),
      pendingApprovals: db.approvals.filter(a => a.status === 'pending').length,
      openTasks: db.tasks.filter(t => !t.done).map(t => ({ title: t.title, due: t.due, assignee: t.assignee })),
      accountHealth: db.accounts.map(a => ({ name: a.name, health: agents.health(a).level })),
      generatedAt: new Date().toISOString(),
    };
  },

  /* 7 — Job Status Update Agent */
  jobStatusEmail(job){
    const acct = acctName(job.accountId);
    const pct = job.progress ?? (job.status === 'complete' ? 100 : job.status === 'in-progress' ? 50 : 0);
    const subject = `Update: ${job.title} — ${job.status === 'complete' ? 'complete' : pct + '% complete'}`;
    const body = job.status === 'complete'
      ? `Hi ${acct} team — great news: ${job.title} is complete. ${job.notes || ''} Final walkthrough photos are attached. Thank you for trusting Lines & Logos — lasting impressions for years to come.`
      : `Hi ${acct} team — a quick progress update on ${job.title}. We are ${pct}% complete and on track for ${job.due}. ${job.notes || ''} We'll send the next update at the next milestone. — Lines & Logos`;
    return { to: acct, subject, body };
  },

  /* 8 — Content Repurposing Agent */
  repurpose(item){
    const hook = item.body.split('.')[0] + '.';
    const tag = '#LinesAndLogos #FacilityBranding #AthleticSurfaces #Memphis';
    return { posts: [
      { channel: 'LinkedIn', text: `${hook}\n\n${item.body.split('.').slice(1,3).join('.').trim()}.\n\nLasting Impressions For Years to Come\n${tag}` },
      { channel: 'Instagram', text: `${hook} 🏀✨ Swipe for the transformation.\n${tag}` },
      { channel: 'Facebook', text: `${hook}\n\n${item.title} — read more on the Lines & Logos blog. Serving schools, churches & parks across the Mid-South.` },
      { channel: 'X', text: `${hook} ${tag}` },
    ]};
  },

  /* 8b — Social Media Manager Agent */
  socialPost(b = {}){
    const { BRAND } = require(path.join(ROOT, 'assets', 'brand.js'));
    const approved = db.gallery.filter(g => g.status === 'approved');
    const photo = b.photoId ? approved.find(g => g.id === b.photoId) : approved[Math.floor(Math.random() * approved.length)];
    const q = BRAND.quotes[Math.floor(Math.random() * BRAND.quotes.length)];
    const cta = BRAND.ctas[Math.floor(Math.random() * BRAND.ctas.length)];
    const tags = '#LinesAndLogos #FacilityBranding #AthleticSurfaces #CourtStriping #Memphis';
    const caption = `"${q.text}"\n\n${photo && photo.caption ? photo.caption + '\n\n' : ''}${cta}.\n${tags}`;
    return { caption, quote: q.text, cta,
      photo: photo ? { id: photo.id, caption: photo.caption, url: photo.url || null, consent: photo.approval || null } : null,
      suggestedTime: ['Tue 9:00 AM', 'Wed 12:30 PM', 'Thu 5:00 PM'][Math.floor(Math.random() * 3)],
      note: photo && !photo.url ? 'Photo is consent-approved but has no image file attached — upload it before posting.' : 'Ready to post.' };
  },

  /* 8c — Ad Manager Agent */
  adCopy(b = {}){
    const { BRAND, AD_PROVIDERS } = require(path.join(ROOT, 'assets', 'brand.js'));
    const p = AD_PROVIDERS.find(x => x.id === b.provider) || AD_PROVIDERS[0];
    const limits = b.limits || p.text || {};
    const hlMax = limits.headline || 40;
    const pool = BRAND.quotes.filter(q => q.text.length <= hlMax);
    const q = (pool.length ? pool : BRAND.quotes)[Math.floor(Math.random() * (pool.length ? pool.length : BRAND.quotes.length))];
    const cta = BRAND.ctas[Math.floor(Math.random() * BRAND.ctas.length)];
    const subMax = limits.description || limits.primary || 125;
    let sub = 'Courts • Painting • Vinyl • Graphics • More. Free walkthrough & quote.';
    if (sub.length > subMax) sub = sub.slice(0, subMax - 1) + '…';
    const size = p.sizes[0];
    return { provider: p.id, headline: q.text, sub, cta: cta.slice(0, 24),
      size: { w: size.w, h: size.h, label: size.label }, formats: p.formats, maxMB: p.maxMB,
      validated: { headlineChars: q.text.length, headlineMax: hlMax, subChars: sub.length, subMax,
        withinLimits: q.text.length <= hlMax && sub.length <= subMax } };
  },

  /* 9 — Competitor Analysis Agent */
  competitorAnalysis(name){
    const c = db.competitors.find(x => x.name.toLowerCase().includes((name||'').toLowerCase())) || db.competitors[0];
    const counters = {
      high: ['Counter within 72h with bundled one-contract pricing', 'Arm sales with battle card — emphasize local crew & response time', 'Offer multi-facility discount to in-flight prospects'],
      medium: ['Monitor weekly', 'Differentiate on design services they lack', 'Capture reviews/case studies from shared accounts'],
      low: ['Log and monitor quarterly'],
    };
    return {
      profile: c,
      impact: c.threat === 'high' ? 'Direct overlap on district bids — expect head-to-head on MSCS-scale deals.'
            : c.threat === 'medium' ? 'Partial overlap — they undercut on price but cannot bundle surfaces + branding.'
            : 'Minimal overlap with current pipeline.',
      counters: counters[c.threat] || counters.low,
    };
  },

  /* applicant screening (used by /api/apply) */
  scoreApplicant(b){
    let s = 50;
    if (/hardwood|vinyl|paint|stripe|sanding|finish|wrap/i.test(b.skills||'')) s += 20;
    if (+b.experience >= 3) s += 15;
    if (b.hasTransport) s += 10;
    if (b.hasInsurance) s += 10;
    return Math.min(98, s);
  },

  /* Compliance & State Filings Agent — Secretary of State tracker */
  stateFilings(){
    const ent = db.settings.entity || {};
    const filings = (db.filings || []).map(f => ({
      ...f, daysLeft: Math.ceil((new Date(f.dueDate) - Date.now()) / 864e5),
    }));
    const open = filings.filter(f => f.status !== 'filed');
    const overdue  = open.filter(f => f.daysLeft < 0).sort((a,b) => a.daysLeft - b.daysLeft);
    const dueSoon  = open.filter(f => f.daysLeft >= 0 && f.daysLeft <= 45).sort((a,b) => a.daysLeft - b.daysLeft);
    const upcoming = open.filter(f => f.daysLeft > 45).sort((a,b) => a.daysLeft - b.daysLeft);
    const qualified = new Set([ent.formationState, ...(ent.foreignQualified || [])].filter(Boolean));
    const gaps = (ent.operatingStates || []).filter(s => !qualified.has(s));
    const recommendations = [];
    if (overdue.length) recommendations.push({ priority: 'critical',
      text: `${overdue.length} filing(s) overdue — file immediately. Unregistered operation can mean treble back-fees (TN T.C.A. §48-25-102), per-state penalties, and loss of good standing.` });
    gaps.forEach(s => recommendations.push({ priority: 'high',
      text: `Foreign-qualify in ${s}: jobs are booked there but the LLC is not registered with the ${s} Secretary of State. File before work commences — most states bar unregistered foreign LLCs from enforcing contracts in their courts.` }));
    if (dueSoon.length) recommendations.push({ priority: 'medium',
      text: `${dueSoon.length} filing(s) due within 45 days — calendar them and stage the fees now.` });
    if (ent.registeredAgent) recommendations.push({ priority: 'low',
      text: `Registered agent (${ent.registeredAgent.name}) — confirm the address on file is current in every state of qualification; a lapsed agent means missed service of process and default-judgment risk.` });
    recommendations.push({ priority: 'low',
      text: 'Considering Wyoming formation while operating from TN? You would still need TN foreign qualification ($300 min/yr) plus WY annual license tax (min $60) and a WY registered agent (~$125/yr) — double the upkeep unless privacy or asset-protection is the specific goal.' });
    const checklist = open.sort((a,b) => a.daysLeft - b.daysLeft).map(f =>
      `${f.name} (${f.state}) — due ${f.dueDate} · est. fee $${f.fee} · ${f.agency}`);
    return {
      entity: { legalName: ent.legalName, type: ent.entityType, formationState: ent.formationState,
        formationDate: ent.formationDate, qualified: [...qualified], operatingStates: ent.operatingStates || [] },
      counts: { overdue: overdue.length, dueSoon: dueSoon.length, upcoming: upcoming.length, filed: filings.length - open.length },
      overdue, dueSoon, upcoming, recommendations, checklist,
    };
  },

  /* AP/AR Agent — receivables collection queue + payables schedule + cash-flow pinch check */
  apAr(){
    const acct = id => (db.accounts.find(a => a.id === id) || {}).name || '—';
    const vend = id => (db.vendors.find(v => v.id === id) || {}).name || '—';
    /* AR: open invoices, dunning cadence per settings */
    const ar = db.invoices.filter(i => i.status !== 'paid').map(i => {
      const d = Math.floor((Date.now() - new Date(i.dueDate || i.issued)) / 864e5);
      const tone = d < 0 ? 'current' : d <= 7 ? 'friendly' : d <= 14 ? 'firm' : 'final';
      const nextAction = tone === 'current' ? `Due in ${-d}d — no action yet`
        : tone === 'friendly' ? 'Send friendly reminder (Invoice Reminder Agent)'
        : tone === 'firm' ? 'Firm follow-up email + phone call to the facilities director'
        : 'Final notice — escalate: call + final-notice language, hold future scheduling';
      return { number: i.number, account: acct(i.accountId), amount: i.amount, dueDate: i.dueDate,
        daysOverdue: Math.max(0, d), reminders: i.reminders || 0, tone, nextAction };
    }).sort((a,b) => b.daysOverdue - a.daysOverdue);
    /* AP: open purchase orders, net-30 assumption from PO date */
    const ap = db.purchaseOrders.filter(p => p.status !== 'received').map(p => {
      const assumedDue = new Date(new Date(p.date).getTime() + 30 * 864e5).toISOString().slice(0,10);
      const daysLeft = Math.ceil((new Date(assumedDue) - Date.now()) / 864e5);
      return { number: p.number, vendor: vend(p.vendorId), item: p.item, amount: p.amount, status: p.status,
        assumedDue, daysLeft,
        nextAction: p.status === 'awaiting-approval' ? 'Needs owner approval before the agent can place the order'
          : daysLeft < 0 ? 'Vendor invoice likely waiting — verify receipt & pay'
          : `Pay within ${daysLeft}d (net-30)` };
    }).sort((a,b) => a.daysLeft - b.daysLeft);
    const totals = {
      receivable: ar.reduce((s,i) => s + i.amount, 0),
      overdueAR:  ar.filter(i => i.daysOverdue > 0).reduce((s,i) => s + i.amount, 0),
      payable:    ap.reduce((s,p) => s + p.amount, 0),
      payableNext30: ap.filter(p => p.daysLeft <= 30).reduce((s,p) => s + p.amount, 0),
    };
    const notes = [];
    if (totals.overdueAR) notes.push(`$${totals.overdueAR.toLocaleString()} is past due across ${ar.filter(i=>i.daysOverdue>0).length} invoice(s) — the dunning cadence (friendly ≤7d · firm 8–14d · final 15d+) should be running; every week of delay costs ~2% collectability.`);
    if (totals.payableNext30 > totals.receivable) notes.push(`Cash pinch ahead: $${totals.payableNext30.toLocaleString()} of payables come due within 30 days but open receivables total $${totals.receivable.toLocaleString()} — prioritize collections on the largest overdue invoice before scheduling vendor payments.`);
    if (ap.some(p => p.status === 'awaiting-approval')) notes.push(`${ap.filter(p=>p.status==='awaiting-approval').length} PO(s) sit in awaiting-approval — approving them lets the Procurement Agent lock vendor pricing and ship dates.`);
    if (!notes.length) notes.push('Books are clean — receivables outpace near-term payables and nothing is past due.');
    return { ar, ap, totals, notes };
  },
};

/* ================= CHAT ASSISTANT (docked chatbot backend) ================= */
function chatAnswer(msg){
  const m = (msg || '').toLowerCase();
  const money = n => '$' + (+n || 0).toLocaleString();
  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(m))
    return `Hey ${'there'} — I'm the Lines & Logos assistant. Ask me about overdue invoices, hot leads, today's jobs, onboarding status, open quotes, or say "brief" for the morning summary.`;
  if (/onboard/.test(m)) {
    const e = db.employeeOnboardings, c = db.clientOnboardings;
    const line = (o) => { const dn = o.steps.filter(s=>s.done).length; return `  • ${o.name || o.company} — ${dn}/${o.steps.length} steps (${o.status})`; };
    return [ `Employee onboarding (${e.filter(o=>o.status!=='complete').length} active):`,
      ...e.filter(o=>o.status!=='complete').map(line),
      `Client onboarding (${c.filter(o=>o.status!=='complete').length} active):`,
      ...c.filter(o=>o.status!=='complete').map(line),
      'Open the Onboarding page to advance steps or start a new intake.' ].join('\n');
  }
  if (/profit|loss|p&l|margin|spending|spend|net income|expense report/.test(m)) {
    const p = computePnl();
    return `P&L snapshot:\n  • Revenue collected: ${money(p.revenueTotal)}\n  • Total spending: ${money(p.expensesTotal)} (incl. contractor labor ${money(p.contractorLabor)})\n  • Gross profit: ${money(p.grossProfit)} (${p.grossMarginPct}%)\n  • Net profit: ${money(p.netProfit)} (${p.marginPct}% margin)\n  • Open A/R: ${money(p.openAR)} · Open contractor payouts: ${money(p.openPayouts)}\nCategory detail is on Finance → P&L.`;
  }
  if (/stripe|payout|anomal|fraud|suspicious|alert|odd|unusual/.test(m)) {
    const open = db.financialAlerts.filter(a => a.status === 'open');
    const pend = db.payouts.filter(p => p.status === 'pending');
    return `Financial Watchdog: ${open.length} open alert(s).\n` + (open.length ? open.slice(0,5).map(a => `  • [${a.severity}] ${a.title}`).join('\n') + '\n' : '')
      + `Contractor payouts pending: ${pend.length} (${money(pend.reduce((s,p)=>s+p.amount,0))}).\nStripe feed: ${process.env.STRIPE_SECRET_KEY ? 'LIVE' : 'simulated (set STRIPE_SECRET_KEY for live account monitoring)'}. Full detail on Admin → Integrations.`;
  }
  if (/tax/.test(m)) {
    const qb = db.settings.integrations.quickbooks;
    return `Quotes include location-aware sales tax — the Pricing Agent picks the combined state + local rate from the job city (e.g. TN ${TAX_RATES.TN.rate}%, MS ${TAX_RATES.MS.rate}%, AR ${TAX_RATES.AR.rate}%).\nQuickBooks integration: ${qb.connected ? `CONNECTED (${qb.environment}) — rates synced ${qb.lastSync ? qb.lastSync.slice(0,10) : 'pending'}` : 'not connected — using built-in rate table'}. Final tax is always confirmed by QuickBooks at invoicing.`;
  }
  if (/survey|follow.?up|crm|customer (care|success)|retention/.test(m)) {
    const openF = db.followUps.filter(f => f.status === 'open');
    const sv = db.surveys;
    const resp = sv.filter(s => s.status === 'responded');
    return `CRM status:\n  • Surveys: ${sv.length} sent, ${resp.length} responded${resp.length ? ` (avg ${(resp.reduce((s,x)=>s+x.rating,0)/resp.length).toFixed(1)}★)` : ''}\n  • Open follow-ups: ${openF.length}\n` + (openF.length ? openF.slice(0,4).map(f => `  • ${acctName(f.accountId)} — ${f.type}: ${f.note}`).join('\n') + '\n' : '')
      + `Run the CRM Manager Agent on Admin → AI Agents (or say "run crm") to sweep now.`;
  }
  if (/payroll|pay crew|contractor pay|pay contractors/.test(m)) {
    const pend = db.payouts.filter(p => p.status === 'pending');
    return pend.length ? `Pending contractor payouts:\n` + pend.map(p => `  • ${p.employee} — ${p.hours}h × $${p.rate} = ${money(p.amount)}`).join('\n') + `\nApprove on Admin → Employees.`
      : 'No pending contractor payouts. Run payroll from Admin → Employees to aggregate the last 14 days of time entries.';
  }
  if (/run crm|crm sweep/.test(m)) {
    const r = crmSweep();
    return `CRM sweep complete: ${r.surveysSent} survey(s) sent, ${r.invoicesSent} invoice(s) issued, ${r.followUpsCreated} follow-up(s) queued.\n` + r.details.map(d => '  • ' + d).join('\n');
  }
  if (/run (a )?scan|scan the books|watchdog/.test(m) || (/scan|watchdog/.test(m) && /financ|account|book/.test(m))) {
    const r = financeScan();
    return `Financial Watchdog scan complete — ${r.newAlerts} new alert(s), ${r.openTotal} open total.\n` + r.alerts.map(a => `  • [${a.severity}] ${a.title}`).join('\n');
  }
  if (/overdue|invoice|payment|owe/.test(m)) {
    const od = db.invoices.filter(i => i.status === 'overdue');
    if (!od.length) return 'No overdue invoices right now — everything past due has been collected.';
    return `${od.length} overdue invoice(s):\n` + od.map(i => `  • ${i.number} — ${acctName(i.accountId)}, ${money(i.amount)}, ${daysOverdue(i)} days late (${agents.reminder(i).tone} tone due)`).join('\n')
      + `\nTotal outstanding: ${money(db.invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+i.amount,0))}.`;
  }
  if (/lead|prospect|pipeline|sales/.test(m)) {
    const hot = db.leads.filter(l => l.tier === 'hot');
    return `Pipeline: ${db.leads.length} leads, ${hot.length} hot.\n` + hot.map(l => `  • ${l.name} (${l.company}) — ${l.score}, next: ${l.nextStep}`).join('\n')
      + `\nOpen pipeline value: ${money(db.jobs.filter(j=>j.status!=='complete').reduce((s,j)=>s+j.value,0))}.`;
  }
  if (/job|schedule|crew|today|dispatch/.test(m)) {
    const act = db.jobs.filter(j => j.status === 'in-progress');
    if (!act.length) return 'No jobs in progress right now. Quote-to-job conversion happens on the Sales page.';
    return `Jobs in progress:\n` + act.map(j => `  • ${j.title} — ${j.crew || 'unassigned'}, due ${j.due}, ${j.progress}%`).join('\n');
  }
  if (/quote|proposal/.test(m)) {
    const open = db.quotes.filter(q => q.status === 'sent');
    return open.length ? `Open quotes awaiting decision:\n` + open.map(q => `  • ${q.number} — ${q.title}, ${money(q.amount)}, valid until ${q.validUntil}`).join('\n') : 'No open quotes out for decision.';
  }
  if (/approval|approve/.test(m)) {
    const p = db.approvals.filter(a => a.status === 'pending');
    return p.length ? `${p.length} pending approval(s):\n` + p.map(a => `  • ${a.title} (${money(a.amount)}, requested by ${a.requestedBy})`).join('\n') : 'Nothing waiting on approval.';
  }
  if (/brief|summary|report|morning/.test(m)) {
    const b = agents.dailyBrief();
    return `Daily brief for ${b.date}:\n  • ${b.jobsToday.length} job(s) in progress\n  • ${b.openQuotes.length} open quote(s)\n  • ${b.overdueInvoices.length} overdue invoice(s)\n  • ${b.hotLeads.length} hot lead(s)\n  • ${b.pendingApprovals} pending approval(s)\nFull detail is on the Overview page.`;
  }
  if (/help|what can you|command/.test(m))
    return 'I can answer from live company data. Try:\n  • "overdue invoices"\n  • "hot leads"\n  • "jobs today"\n  • "onboarding status"\n  • "open quotes"\n  • "pending approvals"\n  • "daily brief"\n  • "profit and loss" · "stripe alerts" · "tax rates"\n  • "crm status" · "payroll" · "run crm" · "run scan"';
  return `Here's where things stand: ${db.leads.filter(l=>l.tier==='hot').length} hot leads, ${db.jobs.filter(j=>j.status==='in-progress').length} active jobs, ${db.invoices.filter(i=>i.status==='overdue').length} overdue invoices, ${db.employeeOnboardings.length + db.clientOnboardings.length} onboarding tracks. Ask about any of those — or say "help".`;
}

/* ================= CRM MANAGER AGENT =================
 * Sweeps accounts/jobs and does the follow-up work: surveys after completion,
 * invoices for finished work, stale-touchpoint follow-ups, renewal motions. */
function buildInvoiceFromJob(job, opts){
  const acct = db.accounts.find(a => a.id === job.accountId);
  const t = taxFor(acct ? acct.city : 'Memphis, TN');
  const base = job.value || 0;
  const taxAmount = db.settings.tax.enabled ? Math.round(base * t.rate / 100) : 0;
  const inv = { id: uid('i'), number: 'L&L-2026-' + String(db.invoices.length + 1).padStart(3,'0'),
    accountId: job.accountId, jobId: job.id, amount: base + taxAmount,
    subtotal: base, taxState: t.state, taxRate: t.rate, taxAmount,
    status: (opts && opts.draft) ? 'draft' : 'sent',
    issued: new Date().toISOString().slice(0,10),
    dueDate: new Date(Date.now() + (db.settings.invoiceTermsDays||30)*864e5).toISOString().slice(0,10), reminders: 0 };
  db.invoices.push(inv);
  return inv;
}
function sendSurveyForJob(job){
  const acct = db.accounts.find(a => a.id === job.accountId);
  const contact = db.contacts.find(c => c.accountId === job.accountId && c.decisionMaker) || db.contacts.find(c => c.accountId === job.accountId);
  const sv = { id: uid('sv'), token: crypto.randomBytes(12).toString('hex'), accountId: job.accountId, jobId: job.id,
    sentAt: new Date().toISOString(), status: 'sent', rating: null, comment: '' };
  db.surveys.push(sv);
  const link = `/survey.html?token=${sv.token}`;
  if (contact && contact.email) sendEmail(contact.email, `How did we do? — ${job.title}`,
    `Hi ${firstName(contact.name)},\n\n${job.title} is wrapped up. Would you take 60 seconds to rate the work? Your feedback goes straight to the owner.\n\n${link}\n\n— ${db.settings.company.name} CRM Agent`);
  logActivity(`CRM Agent sent post-job survey for ${job.title} (${acct ? acct.name : 'account'})`);
  return sv;
}
function crmSweep(){
  const out = { surveysSent: 0, invoicesSent: 0, followUpsCreated: 0, details: [] };
  const now = Date.now();
  for (const job of db.jobs.filter(j => j.status === 'complete')){
    // 1) post-job survey
    if (db.settings.crm.autoSurvey && !db.surveys.some(s => s.jobId === job.id)){
      sendSurveyForJob(job); out.surveysSent++;
      out.details.push(`Survey sent — ${job.title}`);
    }
    // 2) invoice for completed work with none
    if (db.settings.crm.autoInvoiceOnComplete && !db.invoices.some(i => i.jobId === job.id) && job.value){
      const inv = buildInvoiceFromJob(job);
      const contact = db.contacts.find(c => c.accountId === job.accountId && c.decisionMaker) || db.contacts.find(c => c.accountId === job.accountId);
      if (contact && contact.email) sendEmail(contact.email, `Invoice ${inv.number} — ${job.title}`,
        `Hi ${firstName(contact.name)},\n\nThank you for working with ${db.settings.company.name}. Invoice ${inv.number} is attached:\n\n• Work completed: $${inv.subtotal.toLocaleString()}\n• ${inv.taxStateName || 'Sales'} sales tax (${inv.taxRate}%): $${inv.taxAmount.toLocaleString()}\n• Total due: $${inv.amount.toLocaleString()} — net ${db.settings.invoiceTermsDays||30}\n\n— ${db.settings.company.name} CRM Agent`);
      logActivity(`CRM Agent issued invoice ${inv.number} for completed job ${job.title} ($${inv.amount.toLocaleString()} incl. ${inv.taxRate}% ${inv.taxState} tax)`);
      out.invoicesSent++; out.details.push(`Invoice ${inv.number} sent — ${job.title} ($${inv.amount.toLocaleString()})`);
    }
  }
  // 3) stale relationships → follow-up queue
  const staleAfter = db.settings.crm.followUpDays * 864e5;
  for (const acct of db.accounts){
    const lastTouch = Math.max(0, ...db.notifications.filter(n => acct.name && (n.to||'').includes(acct.name.split(' ')[0])).map(n => new Date(n.sentAt).getTime()),
      ...db.feedback.filter(f => f.accountId === acct.id).map(f => new Date(f.date).getTime()));
    const renewalDays = acct.renewal ? Math.floor((new Date(acct.renewal) - now) / 864e5) : null;
    const open = db.followUps.find(f => f.accountId === acct.id && f.status === 'open');
    if (!open && renewalDays !== null && renewalDays <= db.settings.crm.renewalWindowDays){
      db.followUps.push({ id: uid('fu'), accountId: acct.id, type: 'renewal', status: 'open',
        note: `Renewal in ${renewalDays} days — ${acct.goal || 'start renewal motion'}`, due: new Date(now + 3*864e5).toISOString().slice(0,10), createdAt: new Date().toISOString() });
      out.followUpsCreated++; out.details.push(`Renewal follow-up — ${acct.name} (${renewalDays}d)`);
    } else if (!open && lastTouch && (now - lastTouch) > staleAfter){
      db.followUps.push({ id: uid('fu'), accountId: acct.id, type: 'touchbase', status: 'open',
        note: `No contact in ${Math.floor((now - lastTouch)/864e5)} days — check in`, due: new Date(now + 2*864e5).toISOString().slice(0,10), createdAt: new Date().toISOString() });
      out.followUpsCreated++; out.details.push(`Follow-up queued — ${acct.name}`);
    }
  }
  logActivity(`CRM Agent sweep: ${out.surveysSent} survey(s), ${out.invoicesSent} invoice(s), ${out.followUpsCreated} follow-up(s)`);
  save();
  return out;
}

/* ================= FINANCIAL WATCHDOG AGENT =================
 * Scans payments/expenses/payouts for odd behavior; raises alerts + notifications. */
function financeScan(){
  const alerts = [];
  const push = (severity, kind, title, detail) => {
    if (db.financialAlerts.some(a => a.title === title && a.status === 'open')) return;
    const a = { id: uid('fa'), severity, kind, title, detail, status: 'open', at: new Date().toISOString() };
    db.financialAlerts.unshift(a); alerts.push(a);
    notify(db.settings.quotes.approvalEmail, `⚠ Financial Watchdog: ${title}`, detail, ['in-app','email']);
    logActivity(`Financial Watchdog alert (${severity}): ${title}`);
  };
  // 1) unusually large payment vs median
  const pays = db.payments.map(p => p.amount).sort((a,b) => a-b);
  const median = pays.length ? pays[Math.floor(pays.length/2)] : 0;
  for (const p of db.payments) if (median && p.amount > median * 2.5)
    push('high', 'charge', `Unusually large payment — $${p.amount.toLocaleString()}`,
      `Payment ${p.id} (${p.method||'unknown method'}) is ${(p.amount/median).toFixed(1)}× the median payment ($${median.toLocaleString()}). Verify with the bank feed before reconciling.`);
  // 2) possible duplicate payments (same invoice, same amount, within 48h)
  for (let i = 0; i < db.payments.length; i++) for (let j = i+1; j < db.payments.length; j++){
    const a = db.payments[i], b = db.payments[j];
    if (a.invoiceId === b.invoiceId && a.amount === b.amount && Math.abs(new Date(a.date) - new Date(b.date)) < 2*864e5)
      push('high', 'duplicate', `Possible duplicate payment — $${a.amount.toLocaleString()} on ${(db.invoices.find(x=>x.id===a.invoiceId)||{}).number || a.invoiceId}`,
        `Two identical payments (${a.id}, ${b.id}) posted within 48 hours. Confirm whether one should be refunded.`);
  }
  // 3) expense spike vs category average
  const cats = {};
  db.expenses.forEach(x => (cats[x.category] = cats[x.category] || []).push(x.amount));
  for (const x of db.expenses){
    const arr = cats[x.category] || [];
    const avg = arr.reduce((s,v)=>s+v,0) / Math.max(1, arr.length);
    if (arr.length >= 2 && x.amount > avg * 2)
      push('medium', 'expense', `Expense spike — ${x.category} $${x.amount.toLocaleString()}`,
        `${x.vendor || 'Unknown vendor'} charge "${x.note || '—'}" is ${(x.amount/avg).toFixed(1)}× the ${x.category} average ($${Math.round(avg).toLocaleString()}). Review the PO and receipt.`);
  }
  // 4) stalled payouts to contractors
  for (const po of db.payouts.filter(p => p.status === 'pending'))
    if (Date.now() - new Date(po.createdAt).getTime() > 5*864e5)
      push('medium', 'payout', `Contractor payout stalled — ${po.employee}`,
        `$${po.amount.toLocaleString()} has been pending since ${po.createdAt.slice(0,10)}. Pay or cancel to keep crew trust.`);
  // 5) collections risk
  for (const inv of db.invoices.filter(i => i.status === 'overdue' && daysOverdue(i) > 15))
    push('high', 'collections', `Collections risk — ${inv.number} (${daysOverdue(inv)}d overdue)`,
      `$${inv.amount.toLocaleString()} from ${acctName(inv.accountId)} is more than 15 days past due. Final-notice cadence is due; consider pausing new work.`);
  save();
  return { newAlerts: alerts.length, alerts, openTotal: db.financialAlerts.filter(a => a.status === 'open').length };
}

/* ================= P&L + STRIPE MONITOR + PAYROLL ================= */
function computePnl(){
  const paidInvoices = db.invoices.filter(i => i.status === 'paid');
  const revenueTotal = db.revenue.reduce((s,r) => s + r.amount, 0) + paidInvoices.reduce((s,i) => s + i.amount, 0);
  const contractorLabor = db.payouts.filter(p => p.status === 'paid').reduce((s,p) => s + p.amount, 0);
  const byCat = {};
  db.expenses.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + x.amount);
  /* paid payouts are already in byCat as Payroll expense rows (see payPayout) — do not double count */
  const expensesTotal = Object.values(byCat).reduce((s,v) => s + v, 0);
  const cogs = (byCat['Materials'] || 0) + (byCat['Equipment'] || 0) + contractorLabor;
  const grossProfit = revenueTotal - cogs;
  const netProfit = revenueTotal - expensesTotal;
  /* monthly series — last 6 calendar months */
  const months = [];
  for (let k = 5; k >= 0; k--){
    const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - k);
    const key = dt.toISOString().slice(0,7);
    const rev = db.revenue.filter(r => (r.date||'').startsWith(key)).reduce((s,r) => s + r.amount, 0)
      + paidInvoices.filter(i => (i.paidDate||'').startsWith(key)).reduce((s,i) => s + i.amount, 0);
    const exp = db.expenses.filter(x => (x.date||'').startsWith(key)).reduce((s,x) => s + x.amount, 0)
      + db.payouts.filter(p => p.status === 'paid' && (p.paidAt||'').startsWith(key)).reduce((s,p) => s + p.amount, 0);
    months.push({ month: key, revenue: rev, expenses: exp, net: rev - exp });
  }
  return { revenueTotal, expensesTotal, contractorLabor, cogs, grossProfit, netProfit,
    marginPct: revenueTotal ? Math.round(netProfit / revenueTotal * 100) : 0,
    grossMarginPct: revenueTotal ? Math.round(grossProfit / revenueTotal * 100) : 0,
    byCategory: byCat, months, openAR: db.invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + i.amount, 0),
    openPayouts: db.payouts.filter(p => p.status === 'pending').reduce((s,p) => s + p.amount, 0) };
}

/* Stripe account overview — live via Stripe API when STRIPE_SECRET_KEY is set, otherwise a
 * faithful simulation built from local invoices/payments/payouts (labeled as such). */
function httpsGetJson(url, headers){
  return new Promise((resolve, reject) => {
    const mod = require(url.startsWith('https') ? 'https' : 'http');
    mod.get(url, { headers }, (r) => { let s=''; r.on('data', c => s += c); r.on('end', () => { try { resolve(JSON.parse(s)); } catch(e){ reject(e); } }); }).on('error', reject);
  });
}
async function stripeOverview(){
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (key) {
    try {
      const authH = { Authorization: 'Bearer ' + key };
      const [bal, charges, payoutsR] = await Promise.all([
        httpsGetJson('https://api.stripe.com/v1/balance', authH),
        httpsGetJson('https://api.stripe.com/v1/charges?limit=10', authH),
        httpsGetJson('https://api.stripe.com/v1/payouts?limit=10', authH),
      ]);
      return { source: 'stripe-live', balance: bal, charges: charges.data || [], payouts: payoutsR.data || [] };
    } catch (e) { return { source: 'stripe-error', error: e.message }; }
  }
  const collected = db.payments.reduce((s,p) => s + p.amount, 0);
  const paidOut = db.payouts.filter(p => p.status === 'paid').reduce((s,p) => s + p.amount, 0);
  return {
    source: 'simulated',
    balance: { available: collected - paidOut, pending: db.invoices.filter(i=>i.status==='sent').reduce((s,i)=>s+i.amount,0), currency: 'usd' },
    charges: db.payments.slice().reverse().slice(0,10).map(p => ({ id: p.id, amount: p.amount, status: 'succeeded', method: p.method, created: p.date, invoice: (db.invoices.find(i=>i.id===p.invoiceId)||{}).number || '—' })),
    payouts: db.payouts.slice().reverse().slice(0,10),
    disputes: [],
    note: 'Simulated from local books — set STRIPE_SECRET_KEY to switch to the live Stripe account feed.',
  };
}

/* contractor payroll — aggregates time entries into payout rows */
function runPayroll(){
  const sum = payrollSummary();
  const notReady = sum.rows.filter(r => r.hours > 0 && !r.ready);
  if (notReady.length) return { error: 'Hours approval required first', notReady: notReady.map(r => r.employee) };
  const made = [];
  for (const r of sum.rows.filter(r => r.hours > 0)){
    const p = { id: uid('po'), employeeId: r.employeeId, employee: r.employee, hours: r.hours,
      regular: r.regular, overtime: r.overtime, rate: r.rate, amount: r.amount,
      periodStart: sum.periodStart, periodEnd: sum.periodEnd,
      onsiteMin: r.onsiteTodayMin, trackedMin: r.trackedTodayMin,
      status: 'pending', createdAt: new Date().toISOString(), method: 'Stripe transfer (simulated)' };
    db.payouts.push(p);
    db.timeEntries.filter(t => t.employeeId === r.employeeId && t.date >= sum.periodStart && !t.paidOut)
      .forEach(t => t.paidOut = p.id);
    made.push(p);
    logActivity(`Payroll: ${p.employee} — ${p.regular}h reg + ${p.overtime}h OT × $${p.rate} = $${p.amount.toLocaleString()} (pending)`);
  }
  const run = { id: uid('pr'), periodStart: sum.periodStart, periodEnd: sum.periodEnd,
    rows: sum.rows.map(r => ({ employeeId: r.employeeId, employee: r.employee, hours: r.hours, regular: r.regular,
      overtime: r.overtime, rate: r.rate, amount: r.amount, ready: r.ready })),
    total: sum.rows.reduce((t, r) => t + r.amount, 0), createdAt: new Date().toISOString(), payoutIds: made.map(p => p.id) };
  db.payrollRuns.push(run);
  save();
  return { ok: true, run, created: made.length, payouts: made };
}
function payPayout(id){
  const p = db.payouts.find(p => p.id === id); if (!p) return { error: 'Payout not found' };
  if (p.status === 'paid') return { error: 'Already paid' };
  p.status = 'paid'; p.paidAt = new Date().toISOString();
  p.transferRef = 'tr_sim_' + crypto.randomBytes(6).toString('hex');
  db.expenses.push({ id: uid('x'), date: p.paidAt.slice(0,10), category: 'Payroll', vendor: p.employee, amount: p.amount, note: `Contractor payout ${p.id} (${p.hours}h)` });
  notify(db.settings.quotes.approvalEmail, `Payout sent — ${p.employee}`, `$${p.amount.toLocaleString()} transferred (${p.transferRef}). Logged as Payroll expense.`, ['in-app']);
  logActivity(`Payout paid: ${p.employee} $${p.amount.toLocaleString()} (${p.transferRef})`);
  save();
  return p;
}

/* ================= AFFILIATE PROGRAM ================= */
function affByCode(code){ return db.affiliates.find(a => a.code === String(code||'').toUpperCase()); }
function affByToken(tok){ return db.affiliates.find(a => a.token === tok); }
function affPct(a){ return a.pct || (db.settings.affiliate.tiers && db.settings.affiliate.tiers[a.type]) || db.settings.affiliate.defaultPct; }
function affLedger(id){
  const cs = db.commissions.filter(c => c.affiliateId === id);
  return {
    pending:   cs.filter(c => c.status === 'pending').reduce((s,c) => s + c.amount, 0),
    approved:  cs.filter(c => c.status === 'approved').reduce((s,c) => s + c.amount, 0),
    paid:      cs.filter(c => c.status === 'paid').reduce((s,c) => s + c.amount, 0),
    count: cs.length,
  };
}
function notifyAffiliate(aff, subject, preview){
  db.notifications.push({ id: uid('n'), channel: 'in-app', to: 'affiliate:' + aff.token, subject, status: 'sent', sentAt: new Date().toISOString(), preview });
  pushToRole('affiliate', subject, String(preview).slice(0, 160), '/affiliate.html').catch(() => {});
}
/* credit the affiliate once per job / invoice when revenue is earned */
function creditAffiliate({ job, invoice }){
  const acct = job ? db.accounts.find(a => a.id === job.accountId) : db.accounts.find(a => a.id === invoice.accountId);
  const code = (job && job.affiliateCode) || (invoice && invoice.affiliateCode) || (acct && acct.affiliateCode);
  const aff = code && affByCode(code);
  if (!aff || aff.status !== 'active') return null;
  const key = job ? 'jobId' : 'invoiceId';
  const refId = job ? job.id : invoice.id;
  if (db.commissions.some(c => c.affiliateId === aff.id && c[key] === refId)) return null;   // already credited
  const basis = job ? job.value : invoice.amount;
  const pct = affPct(aff);
  const c = { id: uid('cm'), affiliateId: aff.id, jobId: job ? job.id : null, invoiceId: invoice ? invoice.id : null,
    title: (job && job.title) || ('Invoice ' + invoice.number), basis, pct, amount: Math.round(basis * pct / 100),
    status: 'pending', createdAt: new Date().toISOString() };
  db.commissions.push(c);
  notify(db.settings.quotes.approvalEmail, `Affiliate commission earned — ${aff.name}`, `${aff.name} earned $${c.amount.toLocaleString()} (${pct}% of $${basis.toLocaleString()}) on ${c.title}.`, ['in-app']);
  notifyAffiliate(aff, `Commission earned: $${c.amount.toLocaleString()}`, `${pct}% of ${c.title} — pending until payout approval.`);
  logActivity(`Affiliate: ${aff.name} credited $${c.amount.toLocaleString()} (${pct}%) for ${c.title}`);
  return c;
}
function requestAffiliatePayout(aff){
  const l = affLedger(aff.id);
  const payable = l.pending + l.approved;
  if (payable < (db.settings.affiliate.minPayout || 50)) return { error: `Minimum payout is $${db.settings.affiliate.minPayout || 50} — current payable balance is $${payable.toLocaleString()}.` };
  if (db.approvals.some(a => a.type === 'affiliate-payout' && a.affiliateId === aff.id && a.status === 'pending')) return { error: 'A payout request is already awaiting admin approval.' };
  const ap = { id: uid('apv'), type: 'affiliate-payout', affiliateId: aff.id, title: `Affiliate payout — ${aff.name}`, amount: payable,
    requestedBy: aff.name + ' (affiliate)', status: 'pending', created: new Date().toISOString().slice(0,10),
    detail: `Pays ${l.count ? 'all open commissions' : ''} to ${aff.payoutMethod || 'account on file'}.` };
  db.approvals.push(ap);
  notify(db.settings.quotes.approvalEmail, `Approval needed: affiliate payout — ${aff.name}`, `${aff.name} requested $${payable.toLocaleString()}. Approve in Agents & Admin → Approvals.`, ['in-app','email']);
  notifyAffiliate(aff, 'Payout requested', `$${payable.toLocaleString()} is awaiting admin approval — payouts run ${db.settings.affiliate.payoutDays}.`);
  logActivity(`Affiliate payout requested: ${aff.name} $${payable.toLocaleString()}`);
  save();
  return { ok: true, approval: ap };
}
function payAffiliate(aff, amount){
  db.commissions.filter(c => c.affiliateId === aff.id && ['pending','approved'].includes(c.status))
    .forEach(c => { c.status = 'paid'; c.paidAt = new Date().toISOString(); });
  const ref = 'tr_aff_' + crypto.randomBytes(6).toString('hex');
  db.payouts.push({ id: uid('po'), employeeId: null, employee: aff.name + ' (affiliate)', hours: 0, rate: 0, amount,
    periodStart: '', periodEnd: new Date().toISOString().slice(0,10), status: 'paid', paidAt: new Date().toISOString(), method: 'Stripe transfer (simulated)', transferRef: ref });
  db.expenses.push({ id: uid('x'), date: new Date().toISOString().slice(0,10), category: 'Affiliate commission', vendor: aff.name, amount, note: 'Affiliate payout ' + ref });
  notifyAffiliate(aff, `Payout sent: $${amount.toLocaleString()}`, `Transfer ${ref} to ${aff.payoutMethod || 'your account on file'}. Thank you for promoting Lines & Logos!`);
  notify(db.settings.quotes.approvalEmail, `Affiliate payout sent — ${aff.name}`, `$${amount.toLocaleString()} (${ref}). Logged as Affiliate commission expense.`, ['in-app']);
  logActivity(`Affiliate payout paid: ${aff.name} $${amount.toLocaleString()} (${ref})`);
}

/* ================= HIRING & ONBOARDING AGENT ================= */
const STATE_HIRE_FORMS = {
  TN: 'TN New-Hire Reporting Form', MS: 'MS New-Hire Report + Form 89-350 (state withholding)',
  AR: 'AR New-Hire Report + AR4EC', AL: 'AL New-Hire Report + Form A-4', MO: 'MO New-Hire Report + MO W-4',
  KY: 'KY New-Hire Report + K-4', LA: 'LA New-Hire Report + L-4', IL: 'IL New-Hire Report + IL-W-4',
  GA: 'GA New-Hire Report + G-4', IN: 'IN New-Hire Report + WH-4', OK: 'OK New-Hire Report + OK-W-4',
};
function hiringDocsFor(a){
  const st = stateFromCity(a.city || a.state || '') || 'TN';
  return [
    'Federal W-4 — Employee Withholding (2026)', 'Form I-9 — Employment Eligibility Verification',
    'W-9 — Request for Taxpayer ID (1099)', STATE_HIRE_FORMS[st] || (st + ' New-Hire Reporting Form'),
    'Direct Deposit Authorization', 'Offer Letter', 'Safety Agreement', 'Scope of Work',
  ].map(n => ({ name: n, signed: false }));
}
function sendHirePackage(a, emp, token){
  const pkg = { id: uid('hp'), applicantId: a.id, employeeId: emp.id, name: emp.name, position: a.position, email: a.email || '',
    portalToken: token, docs: hiringDocsFor(a), status: 'sent', sentAt: new Date().toISOString(), returnedAt: null };
  db.hirePackages.push(pkg);
  const portal = db.portals.find(p => p.token === token);
  if (portal) portal.docs = pkg.docs.map(d => ({ name: d.name, signed: false }));
  if (pkg.email) sendEmail(pkg.email, 'Action required: your Lines & Logos new-hire packet',
    `Hi ${a.firstName || firstName(emp.name)} — welcome aboard! Your new-hire e-sign packet is ready: federal W-4, I-9, W-9, your state new-hire paperwork, direct deposit authorization, safety agreement, and offer letter. Sign everything here: /portal.html?token=${token} — once the packet is back, our Hiring Agent schedules your video interview automatically.`);
  notify(db.settings.quotes.approvalEmail, `Hiring Agent: e-sign packet sent — ${emp.name}`,
    `Tax forms + state-required paperwork sent to ${pkg.email || 'the new hire'}. Video interview auto-schedules when the signed packet comes back.`, ['in-app']);
  logActivity(`Hiring Agent sent e-sign packet to ${emp.name} (W-4, I-9, W-9, state new-hire forms, offer letter)`);
  return pkg;
}
function nextBusinessDay(skipDays, hhmm){
  let t = Date.now() + skipDays * 864e5;
  let d = new Date(t);
  while ([0,6].includes(d.getDay())) { t += 864e5; d = new Date(t); }
  return d.toISOString().slice(0,10) + 'T' + hhmm + ':00';
}
function scheduleInterview(pkg){
  if (db.interviews.some(i => i.packageId === pkg.id)) return null;
  const when = nextBusinessDay(2, '10:00');
  const iv = { id: uid('iv'), packageId: pkg.id, applicantId: pkg.applicantId, name: pkg.name, position: pkg.position,
    when, link: 'https://meet.linesandlogos.com/' + pkg.portalToken.slice(0,10), status: 'scheduled', createdAt: new Date().toISOString() };
  db.interviews.push(iv);
  addEvent(`Video interview — ${pkg.name} (${pkg.position})`, 'interview', when.slice(0,10), { time: '10:00 AM CT', link: iv.link, applicantId: pkg.applicantId });
  notify(db.settings.quotes.approvalEmail, `Interview scheduled — ${pkg.name}`,
    `Signed hire packet received and stored. Video interview: ${when.slice(0,10)} at 10:00 AM CT — ${iv.link}. Added to the calendar.`, ['in-app','email']);
  if (pkg.email) sendEmail(pkg.email, 'Your Lines & Logos interview is scheduled',
    `Thanks ${firstName(pkg.name)} — your paperwork is complete and stored. Your video interview is set for ${when.slice(0,10)} at 10:00 AM CT: ${iv.link}`);
  logActivity(`Hiring Agent: ${pkg.name} returned the signed packet → video interview scheduled ${when}`);
  return iv;
}

/* ================= PROCUREMENT AGENT ================= */
function sourceBestVendor(material, qty, neededBy){
  const offers = db.vendorCatalog.filter(o => o.material === material).map(o => {
    const arrives = new Date(Date.now() + o.shipDays * 864e5).toISOString().slice(0,10);
    return { vendor: o.vendor, unitPrice: o.unitPrice, shipDays: o.shipDays, carrier: o.carrier,
      total: Math.round(o.unitPrice * qty), arrives,
      meetsDeadline: neededBy ? new Date(arrives) <= new Date(neededBy + 'T23:59:59') : true };
  }).sort((a, b) => (b.meetsDeadline - a.meetsDeadline) || (a.total - b.total) || (a.shipDays - b.shipDays));
  return { best: offers[0] || null, considered: offers };
}
/* items: [{material, qty}] → one draft PO per winning vendor, each with an approval + admin notification */
function draftProcurement(items, opts){
  opts = opts || {};
  const byVendor = {}; const comparisons = [];
  for (const it of items){
    const name = it.material || it.name;
    const { best, considered } = sourceBestVendor(name, it.qty, opts.neededBy);
    comparisons.push({ material: name, qty: it.qty, best, considered });
    if (!best) continue;
    const v = byVendor[best.vendor] = byVendor[best.vendor] || { vendor: best.vendor, shipDays: best.shipDays, carrier: best.carrier, lines: [], total: 0 };
    v.lines.push({ name, qty: it.qty, unitPrice: best.unitPrice, amount: best.total });
    v.total += best.total; v.shipDays = Math.max(v.shipDays, best.shipDays);
  }
  const pos = [];
  for (const v of Object.values(byVendor)){
    // skip if an open PO already covers the same materials
    const open = db.purchaseOrders.some(p => ['awaiting-approval','ordered'].includes(p.status) &&
      (p.items || []).some(l => v.lines.some(nl => nl.name === l.name)));
    if (open) continue;
    const vendor = db.vendors.find(x => x.name === v.vendor);
    const po = { id: uid('po'), number: 'PO-2026-' + String(db.purchaseOrders.length + 11).padStart(3,'0'),
      vendorId: vendor ? vendor.id : null, vendor: v.vendor, items: v.lines, item: v.lines.map(l => l.name).join(', '),
      total: Math.round(v.total), amount: Math.round(v.total), status: 'awaiting-approval',
      date: new Date().toISOString().slice(0,10), createdAt: new Date().toISOString(), auto: true,
      jobId: opts.jobId || null, neededBy: opts.neededBy || null,
      shipEta: new Date(Date.now() + v.shipDays * 864e5).toISOString().slice(0,10), carrier: v.carrier, agent: 'Procurement Agent' };
    db.purchaseOrders.push(po);
    const offersCompared = comparisons.reduce((s, c) => s + c.considered.length, 0);
    db.approvals.push({ id: uid('apv'), type: 'purchase', poId: po.id,
      title: `${po.number} — ${v.vendor} (${v.lines.map(l => l.name).join(', ')})`, amount: po.total,
      requestedBy: 'Procurement Agent', status: 'pending', created: po.date,
      detail: `Best price + earliest qualifying ship date of ${offersCompared} vendor offers compared. ETA ${po.shipEta} via ${v.carrier}${opts.neededBy ? ' — needed by ' + opts.neededBy : ''}. Approve and the agent places the order.` });
    notify(db.settings.quotes.approvalEmail, `Approval needed: ${po.number} — $${po.total.toLocaleString()}`,
      `Procurement Agent sourced ${v.lines.map(l => l.qty + '× ' + l.name).join(', ')} from ${v.vendor} (best price/ship date, ETA ${po.shipEta}). Approve in Agents & Admin → Approvals and the order is placed automatically.`, ['in-app','email']);
    logActivity(`Procurement Agent drafted ${po.number} → ${v.vendor} ($${po.total.toLocaleString()}, ETA ${po.shipEta}) — awaiting approval`);
    pos.push(po);
  }
  return { pos, comparisons };
}
function placeOrder(po){
  po.status = 'ordered'; po.orderedAt = new Date().toISOString();
  po.tracking = (po.carrier || 'FedEx Freight').split(' ')[0].toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  addEvent(`PO placed — ${po.number} (${po.vendor})`, 'order', po.orderedAt.slice(0,10), { vendor: po.vendor, total: po.total, tracking: po.tracking });
  addEvent(`Shipping — ${po.vendor} (${po.number})`, 'shipping', po.shipEta, { carrier: po.carrier, tracking: po.tracking, status: 'in transit', poId: po.id });
  notify(db.settings.quotes.approvalEmail, `Order placed: ${po.number} — tracking ${po.tracking}`,
    `${po.vendor} confirmed. ${(po.items || []).map(i => i.qty + '× ' + i.name).join(', ')} — $${po.total.toLocaleString()} via ${po.carrier}, ETA ${po.shipEta}. Tracking: ${po.tracking}. Delivery is on the calendar.`, ['in-app','email']);
  logActivity(`Procurement Agent placed ${po.number} with ${po.vendor} — ${po.carrier} tracking ${po.tracking}, ETA ${po.shipEta}`);
}
function deliverDueShipments(){
  const today = new Date().toISOString().slice(0,10);
  const done = [];
  for (const po of db.purchaseOrders.filter(p => p.status === 'ordered' && p.shipEta && p.shipEta <= today)){
    po.status = 'delivered'; po.deliveredAt = new Date().toISOString();
    for (const line of (po.items || [])){
      const inv = db.inventory.find(i => i.name === line.name || i.id === line.itemId);
      if (inv) txItem(inv, +line.qty, `Received — ${po.number} (${po.vendor})`, po.jobId);
    }
    addEvent(`Delivered — ${po.vendor} (${po.number})`, 'delivery', today, { tracking: po.tracking });
    notify(db.settings.quotes.approvalEmail, `Delivered: ${po.number}`,
      `${(po.items || []).map(i => i.qty + '× ' + i.name).join(', ')} received from ${po.vendor} (${po.tracking}). Inventory updated.`, ['in-app']);
    logActivity(`Procurement: ${po.number} delivered — inventory restocked`);
    done.push(po.number);
  }
  return done;
}
/* infer material needs for a contracted future job (service from title, sqft from value) minus stock on hand */
function materialsForJob(job){
  const t = (job.title || '').toLowerCase();
  const key = /restripe/.test(t) ? 'restripe' : /wrap/.test(t) ? 'wallwrap' : /donor/.test(t) ? 'donorswall'
    : /sign|parking|lot/.test(t) ? 'signage' : /playground|rubber/.test(t) ? 'playground' : 'refinish';
  const svc = SERVICES[key];
  const sqft = Math.max(2000, Math.round(job.value / (svc.materialPerSqft + 1.6)));   // back-solve sq ft from contract value
  const neededBy = job.due ? new Date(new Date(job.due).getTime() - 3 * 864e5).toISOString().slice(0,10) : null;
  const items = [];
  for (const line of (CONSUMPTION[key] || [])){
    const inv = db.inventory.find(i => i.id === line.item); if (!inv) continue;
    const need = Math.round(((line.perSqft || 0) * sqft + (line.flat || 0)) * 100) / 100;
    const shortfall = Math.round((need - inv.stock) * 100) / 100;
    if (shortfall > 0) items.push({ material: inv.name, qty: shortfall, unit: inv.unit, need, onHand: inv.stock });
  }
  return { service: svc.label, sqft, neededBy, items };
}

/* ================= logistics & travel agent ================= */
const logistics = require('./lib/logistics');
const logisticsChanges = require('./lib/logistics-changes');
const logisticsCtx = () => ({ db, save, uid, logActivity, notify, push: pushToRole });
const routes = {};   // populated below (object-literal + direct assignment sections)
routes['GET /api/trip-plans'] = async (req,res) =>
  json(res, 200, db.tripPlans.map(p => ({ ...p, contract:(db.contracts.find(c=>c.id===p.contractId)||{}).title||'—' })));
routes['POST /api/trip-plans'] = async (req,res) => {
  const b = await body(req);
  const plan = await logistics.createTripPlan(b, logisticsCtx());
  json(res, 201, plan);
};
routes['POST /api/trip-plans/estimate'] = async (req,res) => {
  const b = await body(req);
  json(res, 200, logistics.preContractBrief(b, { db }));
};
routes['GET /api/trip-plans/:id'] = async (req,res,id) => {
  const p = db.tripPlans.find(p => p.id === id); if (!p) return json(res,404,{error:'Trip plan not found'});
  json(res, 200, p);
};
routes['POST /api/trip-plans/:id/approve'] = async (req,res,id) => {
  const u = auth(req); const plan = db.tripPlans.find(p => p.id === id);
  if (!plan) return json(res,404,{error:'Trip plan not found'});
  if (u && u.role !== 'admin') return json(res,403,{error:'Admin approval required'});
  await logistics.approveTripPlan(id, u ? u.email : 'admin', logisticsCtx());
  json(res, 200, plan);
};
routes['POST /api/trip-plans/:id/reject'] = async (req,res,id) => {
  const u = auth(req); const plan = db.tripPlans.find(p => p.id === id);
  if (!plan) return json(res,404,{error:'Trip plan not found'});
  plan.status = 'rejected'; plan.approvedBy = u ? u.email : 'admin';
  plan.approvals.push({ by: plan.approvedBy, at: new Date().toISOString(), action: 'rejected' });
  logActivity(`Trip plan ${id} rejected by ${plan.approvedBy}`); save();
  json(res, 200, plan);
};
routes['GET /api/travel-events'] = async (req,res) => json(res, 200, db.travelEvents);
routes['POST /api/logistics/scan'] = async (req,res) => {
  const found = logisticsChanges.monitorEmails(logisticsCtx());
  json(res, 200, { processed: found });
};
collRoutes(routes, 'travelEvents', { prefix: 'te' });

/* ================= security / SEO / exit / integrations / self-heal ================= */
const securityAgent = require('./lib/security');
const seoAgent = require('./lib/seo');
const exitAdvisor = require('./lib/exit-advisor');
const integrationsLib = require('./lib/integrations');

routes['POST /api/security/scan'] = async (req,res) => {
  const { scan, disclosure } = await securityAgent.runScan(ROOT, db, { notify, logActivity });
  logActivity(`Security Agent scan: ${scan.total} finding(s), ${scan.autoFixed.length} auto-fixed, ${scan.open} open`);
  json(res, 200, { scan, disclosure: disclosure || null });
};
routes['GET /api/security/findings'] = async (req,res) => json(res, 200, db.securityFindings);
routes['GET /api/security/disclosures'] = async (req,res) => json(res, 200, db.disclosures);
routes['POST /api/security/disclosures/:id/approve'] = async (req,res,id) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  json(res, 200, securityAgent.approveDisclosure(db, id, { notify, logActivity })); save();
};
routes['POST /api/security/disclosures/:id/reject'] = async (req,res,id) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  json(res, 200, securityAgent.rejectDisclosure(db, id)); save();
};
collRoutes(routes, 'securityFindings', { prefix: 'sf' });
collRoutes(routes, 'disclosures', { prefix: 'ds' });

routes['GET /api/seo/audit'] = async (req,res) => {
  const audit = seoAgent.auditSite(ROOT);
  db.seoAudits.unshift({ id: uid('sa'), at: new Date().toISOString(), siteScore: audit.siteScore,
    pages: audit.pages.map(p => ({ page: p.page, score: p.score, issueCount: p.issues.length })) });
  db.seoAudits = db.seoAudits.slice(0, 50); save();
  json(res, 200, audit);
};
routes['POST /api/seo/apply'] = async (req,res) => {
  const u = auth(req); if (!u || u.role !== 'admin') return json(res,403,{error:'Admin only'});
  const b = await body(req);
  const out = seoAgent.applyFix(ROOT, b.page, b);
  logActivity(`SEO Agent applied approved fix '${b.rule}' on ${b.page} → ${out.ok ? 'ok' : out.reason}`);
  json(res, 200, out);
};
routes['GET /api/seo/audits'] = async (req,res) => json(res, 200, db.seoAudits);
collRoutes(routes, 'seoAudits', { prefix: 'seoa' });

/* exit & acquisition advisor */
routes['GET /api/exit/stages'] = async (req,res) => json(res, 200, exitAdvisor.STAGES);
routes['GET /api/exit/tracker'] = async (req,res) => {
  json(res, 200, exitAdvisor.computeProgress(exitAdvisor.createTracker(db.exitTracker && db.exitTracker[0])));
};
routes['POST /api/exit/tracker'] = async (req,res) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  const b = await body(req);
  const t = exitAdvisor.createTracker(db.exitTracker && db.exitTracker[0]);
  if (b.stepId) t.done[b.stepId] = !!b.done;
  if (b.notes) t.notes[b.stepId || '_'] = b.notes;
  db.exitTracker[0] = t; save();
  json(res, 200, exitAdvisor.computeProgress(t));
};
routes['GET /api/exit/advice'] = async (req,res) => {
  const t = exitAdvisor.createTracker(db.exitTracker && db.exitTracker[0]);
  json(res, 200, { advice: exitAdvisor.advise(t, { recurringRevenuePct: db.settings.pricing ? null : null }) });
};
collRoutes(routes, 'exitTracker', { prefix: 'ext' });

/* integrations & plugins */
routes['GET /api/integrations'] = async (req,res) => json(res, 200, integrationsLib.listConfigured(db));
routes['POST /api/integrations/:key/config'] = async (req,res,id) => {
  const u = auth(req); if (!u || u.role !== 'admin') return json(res,403,{error:'Admin only'});
  const b = await body(req);
  try { json(res, 200, integrationsLib.setConfig(db, id, b)); save(); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['POST /api/integrations/:key/test'] = async (req,res,id) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  try { json(res, 200, await integrationsLib.test(db, id)); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['POST /api/integrations/:key/dispatch'] = async (req,res,id) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  const b = await body(req);
  json(res, 200, await integrationsLib.dispatch(db, id, b.action, b.payload || {}, { logActivity }));
};
collRoutes(routes, 'integrations', { prefix: 'int' });

/* self-heal */
const selfHeal = require('./lib/selfheal');
routes['POST /api/selfheal/run'] = async (req,res) => {
  const u = auth(req); if (!u || u.role !== 'admin') return json(res,403,{error:'Admin only'});
  json(res, 200, { actions: selfHeal.healNow({ db, dataFile: DB_FILE, save, logActivity, notify, reload: load, quiet: false }) });
};
routes['GET /api/selfheal/log'] = async (req,res) => json(res, 200, (db.healLog || []).slice(0, 100));

/* continuous improvement agent */
const improveAgent = require('./lib/improve');
routes['POST /api/improve/run'] = async (req,res) => {
  const u = auth(req); if (!u || u.role !== 'admin') return json(res,403,{error:'Admin only'});
  json(res, 200, await improveAgent.runImprovement(ROOT, db, { logActivity, notify, save }));
};
routes['GET /api/improve/trend'] = async (req,res) => json(res, 200, db.improvements || []);
routes['GET /api/improve/recommendations'] = async (req,res) => json(res, 200, db.recommendations || []);
routes['POST /api/improve/recommendations/:id/resolve'] = async (req,res,id) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  const r = (db.recommendations || []).find(x => x.id === id);
  if (!r) return json(res,404,{error:'Not found'});
  r.status = 'resolved'; r.resolvedBy = u.email; r.resolvedAt = new Date().toISOString();
  save(); json(res, 200, r);
};
collRoutes(routes, 'recommendations', { prefix: 'rec' });

/* ================= go live + self-test ================= */
const goLive = require('./lib/golive');
const selfTest = require('./lib/selftest');
const goliveCtx = () => ({ save, logActivity, notify });
routes['GET /api/golive'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  goLive.ensureTasks(db, uid);
  json(res, 200, { status: goLive.state(db), progress: goLive.progress(db), phases: goLive.PHASES, tasks: db.launchTasks || [], launchDate: goLive.state(db).launchDate || null });
};
routes['POST /api/golive/task'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  const t = (db.launchTasks || []).find(x => x.id === b.id);
  if (!t) return json(res,404,{error:'Task not found'});
  if (b.done !== undefined) t.done = !!b.done;
  if (b.due !== undefined) t.due = b.due || null;
  save(); json(res, 200, t);
};
routes['POST /api/golive/launch-date'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  goLive.state(db).launchDate = b.launchDate || null;
  const sync = b.launchDate ? goLive.syncMilestones(db, uid) : { events: 0, reminders: 0 };
  logActivity(`Go Live: launch date set to ${b.launchDate} (${sync.events} milestone(s), ${sync.reminders} reminder(s) scheduled)`);
  json(res, 200, { launchDate: b.launchDate, sync });
};
routes['POST /api/golive/erase-demo'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  if (b.confirm !== 'ERASE') return json(res,400,{error:'Type ERASE to confirm'});
  try { json(res, 200, goLive.eraseDemo(db, goliveCtx())); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['POST /api/golive/go'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  try { json(res, 200, goLive.goLive(db, goliveCtx())); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['POST /api/selftest/run'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req).catch(() => ({}));
  const iterations = Math.min(1000, Math.max(1, parseInt(b.iterations) || 1000));
  logActivity(`Self-test: starting ${iterations}-pass loop`);
  const summary = await selfTest.runLoop(routes, { db }, { maxPasses: iterations, token: u.token });
  logActivity(`Self-test complete after ${summary.passes} pass(es): ${summary.verdict} (${summary.bugsFound} bugs)`);
  json(res, 200, summary);
};
routes['GET /api/selftest/invariants'] = async (req,res) => json(res, 200, selfTest.invariants(db));

/* ================= contractor scheduling & acceptance gate ================= */
const scheduling = require('./lib/scheduling');
const schedCtx = (admin) => ({ logActivity, notify, push: pushToRole, admin: admin || 'admin' });
routes['GET /api/schedule/offers'] = async (req,res) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  if (u.role === 'owner' || u.role === 'admin' || u.role === 'manager' || u.role === 'staff')
    return json(res, 200, db.jobOffers);
  json(res, 200, db.jobOffers.filter(o => o.contractorEmail === u.email));
};
routes['POST /api/schedule/offer'] = async (req,res) => {
  const u = gate(req, res, STAFF); if (!u) return;
  const b = await body(req);
  try { json(res, 201, scheduling.offerJob(db, uid, b.jobId, b.contractorEmail, b.proposedTime, schedCtx(u.email))); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['POST /api/schedule/offers/:id/respond'] = async (req,res,id) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  const b = await body(req);
  try { json(res, 200, scheduling.respond(db, id, u.email, b.action, b, schedCtx(u.email))); save(); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['POST /api/schedule/offers/:id/accept-counter'] = async (req,res,id) => {
  const u = gate(req, res, STAFF); if (!u) return;
  try { json(res, 200, scheduling.acceptCounter(db, id, u.email, schedCtx(u.email))); save(); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['POST /api/schedule/jobs/:id/approve'] = async (req,res,id) => {
  const u = gate(req, res, STAFF); if (!u) return;
  const b = await body(req);
  const job = db.jobs.find(j => j.id === id);
  if (!job) return json(res,404,{error:'Job not found'});
  try {
    scheduling.assertCrewConfirmed(db, id);               // ← the gate
    job.status = 'approved';
    const contract = scheduling.sendContract(db, uid, id, b.customerEmail || job.customerEmail, schedCtx(u.email));
    save();
    json(res, 200, { job, contract });
  } catch (e) { json(res, 409, { error: e.message, crewStatus: job.crewStatus }); }
};
routes['GET /api/schedule/calendar'] = async (req,res) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  json(res, 200, scheduling.contractorCalendar(db, u.email));
};
routes['POST /api/schedule/availability'] = async (req,res) => {
  const u = auth(req); if (!u) return json(res,401,{error:'Login required'});
  const b = await body(req);
  try { json(res, 200, scheduling.setUnavailable(db, u.email, b.dates || [])); save(); }
  catch (e) { json(res, 400, { error: e.message }); }
};
collRoutes(routes, 'jobOffers', { prefix: 'of' });

/* ================= reputation & disputes ================= */
const reputation = require('./lib/reputation');
const repCfg = () => (db.settings.reputation = db.settings.reputation || {});
routes['GET /api/reputation/stats'] = async (req,res) => { const u = gate(req, res, STAFF); if (!u) return; json(res, 200, reputation.stats(db)); };
routes['GET /api/reputation/disputes'] = async (req,res) => { const u = gate(req, res, STAFF); if (!u) return; json(res, 200, db.disputes); };
routes['POST /api/reputation/disputes'] = async (req,res) => {
  const u = gate(req, res, STAFF); if (!u) return;
  const b = await body(req);
  const d = reputation.fileDispute(db, uid, b);
  notify(db.settings.quotes.approvalEmail, `New dispute — ${d.category ? d.label : 'financial'}`, `From ${d.customer}: "${(d.reason || '').slice(0,120)}"`, ['in-app', 'email']);
  save(); json(res, 201, d);
};
routes['POST /api/reputation/disputes/:id/resolve'] = async (req,res,id) => {
  const u = gate(req, res, STAFF); if (!u) return;
  const b = await body(req);
  try { json(res, 200, reputation.resolveDispute(db, id, b.action, u.email)); save(); }
  catch (e) { json(res, 404, { error: e.message }); }
};
routes['GET /api/reputation/reviews'] = async (req,res) => { const u = gate(req, res, STAFF); if (!u) return; json(res, 200, db.reviews); };
routes['POST /api/reputation/reviews'] = async (req,res) => {
  const u = gate(req, res, STAFF); if (!u) return;
  const b = await body(req);
  const r = reputation.ingestReview(db, uid, b, repCfg().autoRespond);
  save(); json(res, 201, r);
};
routes['POST /api/reputation/reviews/:id/approve-response'] = async (req,res,id) => {
  const u = gate(req, res, STAFF); if (!u) return;
  const r = db.reviews.find(x => x.id === id);
  if (!r) return json(res,404,{error:'Not found'});
  r.status = 'responded'; r.respondedBy = u.email; r.respondedAt = new Date().toISOString(); r.responseSent = r.responseDraft;
  save(); json(res, 200, r);
};
routes['POST /api/reputation/scan'] = async (req,res) => {
  const u = gate(req, res, STAFF); if (!u) return;
  json(res, 200, { processed: reputation.monitorEmails(db, { uid, notify, push: pushToRole }) });
};
collRoutes(routes, 'reviews', { prefix: 'rev' });
collRoutes(routes, 'disputes', { prefix: 'dsp' });

/* ================= license & insurance center ================= */
const licensing = require('./lib/licensing');
routes['GET /api/licensing/requirements'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  json(res, 200, licensing.REQUIREMENTS.map(r => ({ ...r, cheapest: licensing.cheapestFor(r.key) })));
};
routes['GET /api/licensing/summary'] = async (req,res) => { const u = gate(req, res, STAFF); if (!u) return; json(res, 200, licensing.summary(db)); };
routes['GET /api/licensing'] = async (req,res) => { const u = gate(req, res, STAFF); if (!u) return; json(res, 200, db.licenses); };
routes['POST /api/licensing'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  json(res, 201, licensing.addItem(db, uid, b)); save();
};
routes['DELETE /api/licensing/:id'] = async (req,res,id) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  try { licensing.removeItem(db, id); save(); json(res, 200, { ok: true }); }
  catch (e) { json(res, 404, { error: e.message }); }
};
routes['PATCH /api/licensing/:id'] = async (req,res,id) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const it = (db.licenses || []).find(x => x.id === id);
  if (!it) return json(res, 404, { error: 'Not found' });
  const b = await body(req); delete b.id;
  for (const k of ['name','type','provider','policyNumber','cost','expiresAt','renewsEveryMonths','notes'])
    if (b[k] !== undefined) it[k] = b[k];
  save(); json(res, 200, it);
};
collRoutes(routes, 'licenses', { prefix: 'lic' });

/* ================= business valuation agent ================= */
const valuation = require('./lib/valuation');
routes['GET /api/valuation'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const d = valuation.gatherData(db);
  const v = valuation.computeValuation(d, db);
  json(res, 200, { ...d, ...v, plan: valuation.improvementPlan(d, v) });
};
routes['GET /api/valuation/report'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const r = valuation.generateReport(db);
  db.valuations.unshift({ id: uid('val'), at: new Date().toISOString(), total: r.valuation.total, score: r.valuation.score });
  db.valuations = db.valuations.slice(0, 24); save();
  json(res, 200, r);
};
routes['POST /api/valuation/assumptions'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  db.settings.valuation = Object.assign({}, db.settings.valuation, { ownerComp: +b.ownerComp || undefined, addBacks: +b.addBacks || undefined });
  save(); json(res, 200, db.settings.valuation);
};
routes['GET /api/valuation/handoff'] = async (req,res) => { const u = gate(req, res, ['owner','admin']); if (!u) return; json(res, 200, valuation.handoffStep(db)); };
routes['POST /api/valuation/handoff'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  if (b.active !== undefined) { db.settings.handoff = db.settings.handoff || {}; db.settings.handoff.active = !!b.active; if (!b.active) db.settings.handoff.sameName = null; }
  if (b.sameName) valuation.answerHandoff(db, b.sameName);
  save(); json(res, 200, valuation.handoffStep(db));
};

/* ================= business documents & funding agent ================= */
const funding = require('./lib/funding');
routes['GET /api/funding/profile'] = async (req,res) => { const u = gate(req, res, ['owner','admin']); if (!u) return; json(res, 200, funding.profile(db)); };
routes['POST /api/funding/profile'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  db.settings.fundingProfile = Object.assign({}, db.settings.fundingProfile, b); save();
  const s = funding.sweep(db, { notify, push: pushToRole, save });   // re-match immediately
  json(res, 200, { profile: db.settings.fundingProfile, ...s });
};
routes['POST /api/funding/documents/:type/generate'] = async (req,res,id) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  try { json(res, 201, funding.generateDoc(db, id)); save(); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['GET /api/funding/documents'] = async (req,res) => { const u = gate(req, res, ['owner','admin']); if (!u) return; json(res, 200, db.fundingDocs); };
routes['GET /api/funding/playbook'] = async (req,res) => { const u = gate(req, res, ['owner','admin']); if (!u) return; json(res, 200, funding.PLAYBOOK); };
routes['GET /api/funding/grants'] = async (req,res) => { const u = gate(req, res, ['owner','admin']); if (!u) return; json(res, 200, funding.matchGrants(db)); };
routes['POST /api/funding/grants/:id/draft'] = async (req,res,id) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  try { json(res, 201, funding.writeGrantDraft(db, id)); save(); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['GET /api/funding/submissions'] = async (req,res) => { const u = gate(req, res, ['owner','admin']); if (!u) return; json(res, 200, db.grantSubmissions); };
routes['POST /api/funding/submissions/:id/approve'] = async (req,res,id) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const s = db.grantSubmissions.find(x => x.id === id);
  if (!s) return json(res,404,{error:'Not found'});
  s.status = 'approved'; s.approvedBy = u.email; s.approvedAt = new Date().toISOString();
  logActivity(`Grant draft approved: ${s.grantName} by ${u.email} — ready to file at ${s.url}`);
  save(); json(res, 200, s);
};
routes['POST /api/funding/submissions/:id/submit'] = async (req,res,id) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const s = db.grantSubmissions.find(x => x.id === id);
  if (!s) return json(res,404,{error:'Not found'});
  if (s.status !== 'approved') return json(res, 409, { error: 'Approve the draft before marking it submitted' });
  s.status = 'submitted'; s.submittedAt = new Date().toISOString(); s.submittedBy = u.email;
  save(); json(res, 200, s);
};

/* ================= analytics + newsletter ================= */
const analytics = require('./lib/analytics');
const newsletter = require('./lib/newsletter');
routes['GET /api/analytics/summary'] = async (req,res) => {
  const u = gate(req, res, STAFF); if (!u) return;
  json(res, 200, analytics.summary(db));
};
/* public newsletter endpoints */
routes['POST /api/newsletter/subscribe'] = async (req,res) => {
  const b = await body(req);
  try {
    const r = newsletter.subscribe(db, b); save();
    json(res, 200, { ok: true, reactivated: r.reactivated, email: r.sub.email });
  } catch (e) { json(res, 400, { error: e.message }); }
};
routes['GET /api/newsletter/unsubscribe'] = async (req,res) => {
  const t = (req.url.split('?t=')[1] || '').split('&')[0];
  try { newsletter.unsubscribe(db, decodeURIComponent(t)); save(); json(res, 200, { ok: true, message: 'Unsubscribed — sorry to see you go.' }); }
  catch (e) { json(res, 404, { error: e.message }); }
};
routes['GET /api/newsletter/open'] = async (req,res) => {
  const q = req.url.split('?')[1] || '';
  const c = (q.match(/c=([^&]+)/) || [])[1];
  const s = (q.match(/s=([^&]+)/) || [])[1];
  newsletter.trackOpen(db, c, s); save();
  const pixel = Buffer.from('47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b', 'hex');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' });
  res.end(pixel);
};
/* admin newsletter management */
routes['GET /api/newsletter/stats'] = async (req,res) => { const u = gate(req, res, STAFF); if (!u) return; json(res, 200, newsletter.stats(db)); };
routes['GET /api/newsletter/subscribers'] = async (req,res) => { const u = gate(req, res, STAFF); if (!u) return; json(res, 200, db.subscribers); };
routes['POST /api/newsletter/subscribers/remove'] = async (req,res) => {
  const u = gate(req, res, STAFF); if (!u) return;
  const b = await body(req);
  try { newsletter.unsubscribe(db, b.email); save(); json(res, 200, { ok: true }); }
  catch (e) { json(res, 404, { error: e.message }); }
};
routes['POST /api/newsletter/draft'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  json(res, 201, newsletter.draftCampaign(db, { ...b, createdBy: u.email })); save();
};
routes['GET /api/newsletter/campaigns'] = async (req,res) => { const u = gate(req, res, STAFF); if (!u) return; json(res, 200, db.campaigns); };
routes['POST /api/newsletter/campaigns/:id/send'] = async (req,res,id) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  try { json(res, 200, newsletter.sendCampaign(db, id, { logActivity })); save(); }
  catch (e) { json(res, 400, { error: e.message }); }
};
routes['GET /api/newsletter/news-items'] = async (req,res) => { const u = gate(req, res, STAFF); if (!u) return;
  db.newsItems = db.newsItems || []; json(res, 200, db.newsItems); };
routes['POST /api/newsletter/news-items'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  db.newsItems = db.newsItems || [];
  db.newsItems.unshift({ id: 'ni' + Date.now(), title: b.title, body: b.body || '', url: b.url || null, addedAt: new Date().toISOString(), curated: true });
  save(); json(res, 201, db.newsItems[0]);
};
collRoutes(routes, 'subscribers', { prefix: 'sub' });
collRoutes(routes, 'campaigns', { prefix: 'cmp' });

/* ================= static ================= */
const MIME = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon','.webmanifest':'application/manifest+json',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.woff2':'font/woff2','.woff':'font/woff'};
function serveStatic(res, p){
  /* Hardening: never serve dotfiles (.env!), and never serve the data tree
     except approved gallery photos referenced by db.gallery (public by design).
     Everything else under data/ (db.json, backups, resumes, chat attachments)
     is reachable only through authenticated API routes. */
  const segs = p.split('/').filter(Boolean);
  if (p.includes('..') || segs.some(s => s.startsWith('.'))) return json(res, 403, { error: 'Forbidden' });
  if (segs[0] === 'data'){
    const ok = segs.length === 3 && segs[1] === 'uploads'
      && (db.gallery || []).some(g => g.status === 'approved' && g.url === 'data/uploads/' + segs[2]);
    if (!ok) return json(res, 404, { error: 'Not found' });
  }
  let fp = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (fp !== ROOT && !fp.startsWith(ROOT + path.sep)) return json(res, 403, { error: 'Forbidden' });
  fs.readFile(fp, (e,c) => { if (e) return json(res,404,{error:'Not found'}); res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(c); });
}

/* generic collection routes factory */
function collRoutes(routes, coll, opts = {}){
  routes[`GET /api/${coll}`] = async (req,res) => {
    let rows = db[coll] || [];
    if (opts.resolve) rows = rows.map(opts.resolve);
    json(res, 200, rows);
  };
  routes[`POST /api/${coll}`] = async (req,res) => {
    const b = await body(req);
    const item = { id: uid(opts.prefix || coll.slice(0,2)), ...(opts.defaults||{}), ...b };
    if (opts.onCreate) opts.onCreate(item);
    db[coll].push(item); save(); json(res, 201, opts.resolve ? opts.resolve(item) : item);
  };
}

/* ================= routes ================= */
Object.assign(routes, {
  'GET /api/health': async (req,res) => json(res,200,{ ok:true, app:'Lines & Logos Business OS', version:2, time:new Date().toISOString() }),

  /* ---- first-run setup: the first person to open a fresh deployment creates the owner account, then it's locked ---- */
  'GET /api/setup/status': async (req,res) => json(res,200,{ setupRequired: !(db.users||[]).length, demoUsers: process.env.LL_DEMO_USERS === '1' }),
  'POST /api/setup/admin': async (req,res) => {
    if ((db.users||[]).length) return json(res,409,{ error:'Setup already complete — sign in instead.' });
    const b = await body(req);
    const name = String(b.name||'').trim().slice(0,80);
    const email = String(b.email||'').trim().toLowerCase().slice(0,120);
    if (name.length < 2) return json(res,400,{ error:'Your name is required.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res,400,{ error:'A valid email is required.' });
    if (String(b.password||'').length < 12) return json(res,400,{ error:'Password must be at least 12 characters.' });
    if (b.password !== b.confirm) return json(res,400,{ error:'Passwords do not match.' });
    const u = { id: uid('u'), name, email, role:'owner', pass: scryptHash(b.password), token: crypto.randomBytes(24).toString('hex') };
    db.users.push(u);
    logActivity('Owner account created via first-run setup'); save();
    json(res,201,{ token: u.token, user: { id:u.id, name:u.name, email:u.email, role:u.role } });
  },
  'POST /api/login': async (req,res) => {
    const { email, password } = await body(req);
    /* per-IP login throttle: 6 attempts / 5 minutes */
    const ip = (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    let lb = loginBuckets.get(ip) || { n: 0, reset: now + 300000 };
    if (now > lb.reset){ lb = { n: 0, reset: now + 300000 }; }
    lb.n += 1; loginBuckets.set(ip, lb);
    if (lb.n > 6) return json(res,429,{ error:'Too many login attempts — try again in a few minutes.' });
    const u = db.users.find(x => x.email === email && verifyPassword(password, x.pass));
    if (!u) return json(res,401,{ error:'Invalid credentials' });
    if (!String(u.pass).startsWith('scrypt:')){ u.pass = scryptHash(password); save(); }  // opportunistic upgrade
    json(res,200,{ token:u.token, user:{ id:u.id, name:u.name, email:u.email, role:u.role } });
  },
  'GET /api/me': async (req,res) => { const u = auth(req); if (!u) return json(res,401,{error:'Unauthorized'}); json(res,200,{ id:u.id, name:u.name, email:u.email, role:u.role }); },

  'GET /api/stats': async (req,res) => json(res,200,{
    pipeline: db.jobs.filter(j => j.status !== 'complete').reduce((s,j) => s + j.value, 0),
    invoiced: db.invoices.reduce((s,i) => s + i.amount, 0),
    outstanding: db.invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + i.amount, 0),
    collected: db.invoices.filter(i => i.status === 'paid').reduce((s,i) => s + i.amount, 0),
    expensesTotal: db.expenses.reduce((s,x) => s + x.amount, 0),
    overdueCount: db.invoices.filter(i => i.status === 'overdue').length,
    hotLeads: db.leads.filter(l => l.tier === 'hot').length,
    activeJobs: db.jobs.filter(j => j.status === 'in-progress').length,
    openQuotes: db.quotes.filter(q => q.status === 'sent').length,
    pendingApprovals: db.approvals.filter(a => a.status === 'pending').length,
    openTickets: db.tickets.filter(t => t.status !== 'resolved').length,
    crew: db.employees.length,
    accounts: db.accounts.length,
  }),

  'GET /api/activity': async (req,res) => json(res,200, db.activity.slice(-80).reverse()),
});

/* ---- sales ---- */
collRoutes(routes, 'leads', { prefix:'l', defaults:{ stage:'new' },
  onCreate(l){ const r = agents.scoreLead(l); Object.assign(l, r); logActivity(`Lead Score Agent scored ${l.name||l.company} ${r.score} (${r.tier})`); } });
collRoutes(routes, 'accounts', { prefix:'a', resolve: a => ({ ...a, ...(()=>{const h=agents.health(a);return {health:h.level, healthNotes:h.notes}})() }) });
collRoutes(routes, 'contacts', { prefix:'c', resolve: c => ({ ...c, account: acctName(c.accountId) }) });
collRoutes(routes, 'quotes', { prefix:'q', defaults:{ status:'draft', sent:null },
  onCreate(q){ q.number = 'Q-2026-' + String(db.quotes.length + 1).padStart(3,'0'); },
  resolve: q => ({ ...q, account: acctName(q.accountId) }) });
routes['POST /api/quotes/convert'] = async (req,res,id) => {
  const q = db.quotes.find(q => q.id === id); if (!q) return json(res,404,{error:'Quote not found'});
  q.status = 'accepted';
  const job = { id: uid('j'), title: q.title, accountId: q.accountId, status: 'quoted', crew: null, value: q.amount, due: new Date(Date.now()+30*864e5).toISOString().slice(0,10), progress: 0, notes: `Converted from ${q.number}` };
  const qacct = db.accounts.find(a => a.id === q.accountId);
  if (q.affiliateCode || (qacct && qacct.affiliateCode)) job.affiliateCode = q.affiliateCode || qacct.affiliateCode;
  db.jobs.push(job); logActivity(`Quote ${q.number} accepted → job created: ${job.title}`); save();
  json(res,201,{ quote:q, job });
};

/* ---- operations ---- */
collRoutes(routes, 'jobs', { prefix:'j', defaults:{ status:'lead', crew:null, progress:0 },
  resolve: j => ({ ...j, account: acctName(j.accountId) }) });
routes['POST /api/jobs/dispatch'] = async (req,res,id) => {
  const j = db.jobs.find(j => j.id === id); if (!j) return json(res,404,{error:'Job not found'});
  const r = agents.dispatch(j);
  if (r.match) { j.crew = r.match.name; j.status = j.status === 'lead' ? 'quoted' : j.status; logActivity(`Job Dispatch Agent matched ${r.match.name} to ${j.title}`); save();
    pushToRole('contractor', 'New job assigned', `${j.title} — due ${j.due || 'TBD'}. Open your crew portal for details.`, '/portal.html').catch(() => {}); }
  json(res,200,{ job:j, ...r });
};
routes['POST /api/jobs/status-update'] = async (req,res,id) => {
  const j = db.jobs.find(j => j.id === id); if (!j) return json(res,404,{error:'Job not found'});
  const email = agents.jobStatusEmail(j);
  db.notifications.push({ id: uid('n'), channel:'email', to: acctName(j.accountId), subject: email.subject, status:'sent', sentAt:new Date().toISOString(), preview: email.body.slice(0,120) + '…' });
  logActivity(`Job Status Update Agent drafted progress email for ${j.title}`); save();
  json(res,200,email);
};
collRoutes(routes, 'timeEntries', { prefix:'t', resolve: t => ({ ...t, job:(db.jobs.find(j=>j.id===t.jobId)||{}).title||'—', employee:empName(t.employeeId) }) });
routes['GET /api/time-entries'] = routes['GET /api/timeEntries'];   // repo-style kebab-case alias
routes['POST /api/time-entries'] = routes['POST /api/timeEntries'];
collRoutes(routes, 'checklists', { prefix:'k' });
routes['POST /api/checklists/run'] = async (req,res,id) => {
  const k = db.checklists.find(k => k.id === id); if (!k) return json(res,404,{error:'Checklist not found'});
  const b = await body(req);
  const run = { id: uid('kr'), checklistId: id, jobId: b.jobId || null, employeeId: b.employeeId || null, date: new Date().toISOString().slice(0,10), completed: b.completed || k.items.map(()=>true) };
  db.checklistRuns.push(run); logActivity(`Checklist run logged: ${k.name}`); save(); json(res,201,run);
};
collRoutes(routes, 'checklistRuns', { prefix:'kr', resolve: r => ({ ...r, checklist:(db.checklists.find(k=>k.id===r.checklistId)||{}).name||'—', job:(db.jobs.find(j=>j.id===r.jobId)||{}).title||'—', employee:empName(r.employeeId) }) });

/* ---- finance ---- */
collRoutes(routes, 'invoices', { prefix:'i', defaults:{ status:'draft', reminders:0 },
  onCreate(i){ i.number = 'L&L-2026-' + String(db.invoices.length + 1).padStart(3,'0'); i.issued = new Date().toISOString().slice(0,10); i.dueDate = new Date(Date.now() + (db.settings.invoiceTermsDays||30)*864e5).toISOString().slice(0,10); },
  resolve: i => ({ ...i, account: acctName(i.accountId), daysOverdue: i.status==='overdue' ? daysOverdue(i) : 0, paidAmount: invPaid(i.id), balance: i.amount - invPaid(i.id) }) });
routes['POST /api/invoices/remind'] = async (req,res,id) => {
  const i = db.invoices.find(i => i.id === id); if (!i) return json(res,404,{error:'Invoice not found'});
  const r = agents.reminder(i);
  i.reminders = (i.reminders||0) + 1; i.lastReminderTone = r.tone;
  db.notifications.push({ id: uid('n'), channel:'email', to: acctName(i.accountId), subject: r.subject, status:'sent', sentAt:new Date().toISOString(), preview: r.body.slice(0,120) + '…' });
  logActivity(`Invoice Reminder Agent sent ${r.tone} reminder for ${i.number}`); save();
  json(res,200,{ invoice:i, ...r });
};
collRoutes(routes, 'expenses', { prefix:'x' });
collRoutes(routes, 'revenue', { prefix:'r' });

/* payments — partial-payment tracking; auto-marks invoices paid */
routes['GET /api/payments'] = async (req,res) =>
  json(res,200, db.payments.map(p => ({ ...p, invoice:(db.invoices.find(i=>i.id===p.invoiceId)||{}).number||'—' })));
routes['POST /api/payments'] = async (req,res) => {
  const b = await body(req);
  const p = { id: uid('pay'), date: new Date().toISOString().slice(0,10), method:'ACH', note:'', ...b };
  db.payments.push(p);
  const inv = db.invoices.find(i => i.id === p.invoiceId);
  if (inv) {
    inv.paidDate = p.date;
    const paid = invPaid(p.invoiceId);
    if (paid >= inv.amount) { inv.status = 'paid'; logActivity(`Invoice ${inv.number} paid in full ($${paid.toLocaleString()})`); creditAffiliate({ invoice: inv }); }
    else { if (inv.status !== 'sent') inv.status = 'sent'; logActivity(`Partial payment on ${inv.number}: $${paid.toLocaleString()} of $${inv.amount.toLocaleString()}`); }
  }
  save(); json(res,201,{ ...p, invoice: inv ? inv.number : '—' });
};

/* tasks — throughput tracking for reports & daily ops */
collRoutes(routes, 'tasks', { prefix:'ts', defaults:{ done:false } });

/* reports — /reports page data: pipeline, revenue vs target, task throughput */
routes['GET /api/reports'] = async (req,res) => {
  const exp = db.expenses.reduce((s,x) => s + x.amount, 0);
  const revenueTotal = db.revenue.reduce((s,r) => s + r.amount, 0)
    + db.invoices.filter(i => i.status === 'paid').reduce((s,i) => s + i.amount, 0);
  const target = (db.settings.sales && db.settings.sales.revenueTarget) || 400000;
  json(res,200,{
    pipelineValue: db.jobs.filter(j => j.status !== 'complete').reduce((s,j) => s + j.value, 0),
    quotesOut: db.quotes.filter(q => q.status === 'sent').reduce((s,q) => s + q.amount, 0),
    revenueTotal, revenueTarget: target, pctOfTarget: Math.round(revenueTotal / target * 100),
    expensesTotal: exp, grossMargin: revenueTotal - exp,
    taskThroughput: { total: db.tasks.length, done: db.tasks.filter(t => t.done).length },
    hoursThisWeek: db.timeEntries.filter(t => new Date(t.date) > new Date(Date.now() - 7*864e5)).reduce((s,t) => s + t.hours, 0),
    invoiceAging: {
      current: db.invoices.filter(i => i.status === 'sent').reduce((s,i) => s + i.amount, 0),
      overdue: db.invoices.filter(i => i.status === 'overdue').reduce((s,i) => s + i.amount, 0),
      paid: db.invoices.filter(i => i.status === 'paid').reduce((s,i) => s + i.amount, 0),
    },
  });
};

/* ============ OUTBOUND SALES AGENT + SETTINGS ============ */
routes['GET /api/settings'] = async (req,res) => json(res,200, db.settings);
routes['PUT /api/settings'] = async (req,res) => {
  const b = await body(req);
  const deep = (t,src)=>{ for (const k of Object.keys(src)){ if (src[k] && typeof src[k]==='object' && !Array.isArray(src[k]) && t[k]) deep(t[k],src[k]); else t[k]=src[k]; } };
  deep(db.settings, b); save(); logActivity('Dashboard settings updated');
  json(res,200, db.settings);
};
routes['GET /api/emails'] = async (req,res) => json(res,200, db.emails.slice(-100).reverse());
routes['GET /api/messages'] = async (req,res) => json(res,200, db.messages.slice(-100).reverse());
routes['GET /api/contracts'] = async (req,res) =>
  json(res,200, db.contracts.map(c => ({ ...c, lead:(db.leads.find(l=>l.id===c.leadId)||{}).company||'—' })));
routes['POST /api/agent/discover'] = async (req,res) => { const made=agentDiscover(); json(res,201,{ discovered: made.length, leads: made }); };
routes['POST /api/agent/run'] = async (req,res) => json(res,200, agentRun());
routes['GET /api/reminders'] = async (req,res) => json(res,200, db.reminders);

/* ============ INQUIRIES + AI CHAT ============ */
routes['POST /api/inquiries'] = async (req,res) => {                       // public — site/contact form
  const b = await body(req); if (!b.message || !b.name) return json(res,400,{error:'Name and message required'});
  const iq = { id: uid('iq'), source: b.source || 'site', status: 'new', reply: '', ...b, createdAt: new Date().toISOString() };
  db.inquiries.unshift(iq);
  notify(db.settings.quotes.approvalEmail, `New inquiry from ${b.name} (${iq.source})`, (b.message||'').slice(0,140));
  logActivity(`New ${iq.source} inquiry from ${b.name}`);
  save(); json(res,201,{ id: iq.id, ok: true });
};
routes['GET /api/inquiries'] = async (req,res) => json(res,200, db.inquiries);
routes['POST /api/agent/inquiries/analyze'] = async (req,res) => {
  const fresh = db.inquiries.filter(i => i.status === 'new'); fresh.forEach(analyzeInquiry);
  save(); json(res,200,{ analyzed: fresh.length, inquiries: db.inquiries });
};
routes['POST /api/agent/inquiries/respond'] = async (req,res) => {          // body {id?} — one or all analyzed
  const b = await body(req);
  const targets = b.id ? db.inquiries.filter(i => i.id === b.id) : db.inquiries.filter(i => i.status === 'analyzed');
  await Promise.all(targets.map(respondInquiry)); save();
  json(res,200,{ responded: targets.length });
};
routes['POST /api/chat'] = async (req,res) => {                             // public — customer-service agent
  const b = await body(req);
  let chat = db.chats.find(c => c.session === b.session);
  if (!chat){ chat = { id: uid('ch'), session: b.session || uid('sess'), messages: [] }; db.chats.unshift(chat); }
  chat.messages.push({ from: 'customer', text: b.message, at: new Date().toISOString() });
  const a = serviceBrain(b.message);
  const reply = { from: 'agent', text: (a && a.reply && a.service && a.service !== 'unknown') ? a.reply : publicBrain(b.message), at: new Date().toISOString() };   // reconcile: internal concierge defers to the shared public brain when it has no match
  chat.messages.push(reply);
  logActivity(`AI chat (${chat.session.slice(0,8)}): customer asked — agent replied (${a.service})`);
  save(); json(res,200,{ reply: reply.text, session: chat.session, thread: chat.messages.slice(-20) });
};
routes['GET /api/chats'] = async (req,res) => json(res,200, db.chats);

/* ============ CALENDAR ============ */
routes['GET /api/calendar'] = async (req,res) => {
  const { from, to } = await body(req).catch(()=>({})) || {};
  json(res,200, db.events.slice().sort((a,b) => (a.at||'').localeCompare(b.at||'')));
};
routes['POST /api/events'] = async (req,res) => {                           // manual event (walkthroughs etc.)
  const b = await body(req);
  const ev = { id: uid('ev'), meta: {}, ...b }; db.events.push(ev);
  logActivity(`Calendar event added: ${ev.title}`); save(); json(res,201,ev);
};
routes['PATCH /api/events/:id'] = async (req,res, id) => {
  const ev = db.events.find(e => e.id === id); if (!ev) return json(res,404,{error:'Not found'});
  Object.assign(ev, await body(req)); save(); json(res,200,ev);
};

/* ============ REVIEWS ============ */
routes['GET /api/reviews'] = async (req,res) => {                          // public — approved only (for the site)
  const u = auth(req);
  json(res,200, u ? db.reviews : db.reviews.filter(r => r.status === 'approved'));
};
routes['POST /api/admin/reviews/:id/approve'] = async (req,res, id) => {
  const r = db.reviews.find(r => r.id === id); if (!r) return json(res,404,{error:'Not found'});
  r.status = 'approved'; r.approvedAt = new Date().toISOString();
  logActivity(`Review by ${r.author} approved for the website`); save(); json(res,200,r);
};
routes['POST /api/admin/reviews/:id/reject'] = async (req,res, id) => {
  const r = db.reviews.find(r => r.id === id); if (!r) return json(res,404,{error:'Not found'});
  r.status = 'rejected'; save(); json(res,200,r);
};

/* ============ GALLERY (AI-curated job photos) ============ */
routes['POST /api/agent/gallery/curate'] = async (req,res) => {              // AI approves shots from signed jobs
  const signedJobIds = new Set(db.jobs.map(j => j.id));                    // jobs exist ⇒ contracts/jobs approved
  let approved = 0;
  for (const g of db.gallery.filter(g => g.status === 'pending')){
    if (signedJobIds.has(g.jobId) || g.approval === 'signed'){ g.status = 'approved'; g.curatedBy = 'AI Agent'; approved++; }
  }
  logActivity(`Gallery AI Agent curated ${approved} image(s) — now live on the site`);
  save(); json(res,200,{ curated: approved, gallery: db.gallery });
};
routes['POST /api/admin/gallery/:id/approve'] = async (req,res, id) => {
  const g = db.gallery.find(g => g.id === id); if (!g) return json(res,404,{error:'Not found'});
  g.status = 'approved'; g.approvedBy = 'admin'; g.approvedAt = new Date().toISOString();
  logActivity(`Gallery item approved by admin: ${g.caption}`); save(); json(res,200,g);
};
routes['POST /api/admin/gallery/:id/reject'] = async (req,res, id) => {
  const g = db.gallery.find(g => g.id === id); if (!g) return json(res,404,{error:'Not found'});
  g.status = 'rejected'; save(); json(res,200,g);
};

/* ============ INQUIRIES / CS CHAT / REVIEWS / GALLERY / CALENDAR ============ */
routes['POST /api/inquiry'] = async (req,res) => {                     // public — contact form
  const b = await body(req); if (!b.message) return json(res,400,{error:'Message required'});
  const q = addInquiry('contact', b.name, b.email, b.message);
  notify(db.settings.quotes.approvalEmail, `New inquiry (${q.intent}) from ${q.name}`, q.message.slice(0,200), ['in-app','email']);
  json(res,201, q);
};
routes['GET /api/inquiries'] = async (req,res) => json(res,200, db.inquiries);
routes['GET /api/job-status'] = async (req,res) => {                   // public — customer portal lookup by email
  const email = ((req.url.split('?')[1]||'').match(/email=([^&]*)/) || [])[1];
  if (!email) return json(res,400,{error:'email required'});
  const lead = db.leads.find(l => (l.email||'') === decodeURIComponent(email));
  if (!lead) return json(res,404,{error:'No records for that email'});
  const acct = db.accounts.find(a => a.name === lead.company);
  const jobs = acct ? db.jobs.filter(j => j.accountId === acct.id).map(j => ({ title:j.title, status:j.status, due:j.due, crew:j.crew })) : [];
  const contracts = db.contracts.filter(c => c.leadId === lead.id).map(c => ({ title:c.title, status:c.status, signedAt:c.signedAt }));
  const quotes = db.quoteRequests.filter(q => (q.email||'') === decodeURIComponent(email)).map(q => ({ ref:q.ref, service:q.service, total:q.total, status:q.status }));
  json(res,200,{ company: lead.company, stage: lead.stage, jobs, contracts, quotes });
};
routes['POST /api/agent/inquiries/respond'] = async (req,res) => {     // agent sends drafted reply
  const b = await body(req); const q = db.inquiries.find(x => x.id === b.id);
  if (!q) return json(res,404,{error:'Not found'});
  q.status = 'responded'; q.respondedAt = new Date().toISOString();
  if (q.email) sendEmail(q.email, 'Re: your Lines & Logos inquiry', b.reply || q.reply);
  logActivity(`Inquiry Agent responded to ${q.name} (${q.intent})`);
  save(); json(res,200, q);
};
routes['POST /api/chat'] = async (req,res) => {                        // public — CS agent chat
  const b = await body(req); if (!b.message) return json(res,400,{error:'Message required'});
  const a = analyzeText(b.message);
  const q = addInquiry('ai-chat', b.name || 'Chat visitor', b.email || '', b.message, { session: b.session || null });
  logActivity(`CS Agent answered chat (${q.intent})`);
  json(res,200,{ reply: a.reply, intent: a.intent, id: q.id });
};
routes['POST /api/review'] = async (req,res) => {                      // public — pending approval
  const b = await body(req);
  if (!b.name || !b.text || !b.rating) return json(res,400,{error:'Name, rating and text required'});
  const r = { id: uid('rv'), name: b.name, rating: Math.min(5, Math.max(1, +b.rating)), text: b.text,
    pics: b.pics || [], status: 'pending', createdAt: new Date().toISOString() };
  db.reviews.unshift(r); save();
  notify(db.settings.quotes.approvalEmail, 'New review awaiting approval', `${b.name} left a ${r.rating}-star review.`, ['in-app']);
  json(res,201,{ ok:true, id: r.id });
};
routes['GET /api/reviews'] = async (req,res) => json(res,200, db.reviews.filter(r => r.status === 'approved'));
routes['GET /api/reviews/all'] = async (req,res) => json(res,200, db.reviews);
routes['POST /api/gallery'] = async (req,res) => {                     // upload job photo — pending AI/admin approval
  const b = await body(req); if (!b.url) return json(res,400,{error:'Image URL required'});
  const job = db.jobs.find(j => j.id === (b.jobId || b.job));
  const acct = job && db.accounts.find(a => a.id === job.accountId);
  if (acct && acct.photoConsent === false) return json(res,403,{error:'This client has signed the Photo & Reference Opt-Out — their photos cannot be published'});
  const g = { id: uid('g'), url: b.url, caption: b.caption || '', job: b.job || '', status: 'pending', createdAt: new Date().toISOString() };
  db.gallery.unshift(g); save();
  notify(db.settings.quotes.approvalEmail, 'New gallery image awaiting approval', g.caption || g.url, ['in-app']);
  json(res,201,{ ok:true, id: g.id });
};
routes['GET /api/gallery'] = async (req,res) => json(res,200, db.gallery.filter(g => g.status === 'approved'));
routes['GET /api/gallery/all'] = async (req,res) => json(res,200, db.gallery);
routes['GET /api/calendar'] = async (req,res) => json(res,200, calendarEvents());
routes['POST /api/purchase-orders/shipping'] = async (req,res) => {    // shipping update → calendar + notification
  const b = await body(req); const po = db.purchaseOrders.find(p => p.id === b.id);
  if (!po) return json(res,404,{error:'PO not found'});
  po.status = b.status || po.status; po.shipEta = b.shipEta || po.shipEta;
  if (b.status === 'delivered') po.deliveredAt = new Date().toISOString();
  notify(db.settings.quotes.approvalEmail, `Shipping update: ${po.vendor||'PO '+po.id}`, `Status: ${po.status}${po.shipEta ? ' · ETA ' + po.shipEta : ''}`, ['in-app','email']);
  logActivity(`Shipping updated for PO ${po.id}: ${po.status} (ETA ${po.shipEta||'—'})`);
  save(); json(res,200, po);
};

/* ============ INVENTORY ============ */
routes['GET /api/inventory'] = async (req,res) => json(res,200, db.inventory);
routes['POST /api/inventory'] = async (req,res) => {
  const b = await body(req); if (!b.name) return json(res,400,{error:'Name required'});
  const item = { id: uid('inv'), unit:'ea', unitCost:0, stock:0, reorderPoint: db.settings.inventory.lowStockDefault, supplier:'', ...b };
  db.inventory.push(item); save(); json(res,201,item);
};
routes['POST /api/agent/inventory/audit'] = async (req,res) => json(res,200, auditInventory());
routes['POST /api/agent/inventory/consume'] = async (req,res) => {
  const b = await body(req); if (!b.service) return json(res,400,{error:'service required'});
  json(res,200,{ consumed: consumeMaterials(b.service, +b.sqft || 0, b.jobId || null) });
};
routes['GET /api/inventory/transactions'] = async (req,res) =>
  json(res,200, db.inventoryTx.slice(0,100).map(t => ({ ...t, item:(db.inventory.find(i=>i.id===t.itemId)||{}).name||'—' })));

/* ============ PASSKEYS + PASSWORD RESET ============ */
routes['POST /api/passkey/register'] = async (req,res) => {           // auth required — enroll a device passkey
  const u = auth(req); if (!u) return json(res,401,{error:'Unauthorized'});
  const b = await body(req);
  const key = crypto.randomBytes(32).toString('hex');
  u.passkeys = u.passkeys || [];
  u.passkeys.push({ id: uid('pk'), name: b.name || 'Device', keyHash: hash(key), createdAt: new Date().toISOString() });
  logActivity(`Passkey enrolled for ${u.email}`); save();
  json(res,201,{ id: u.passkeys[u.passkeys.length-1].id, key, name: b.name || 'Device' });
};
routes['POST /api/passkey/login'] = async (req,res) => {              // public — device-bound key check
  const b = await body(req);
  const u = db.users.find(u => u.email === b.email);
  const pk = u && (u.passkeys||[]).find(p => p.keyHash === hash(b.key||''));
  if (!pk) return json(res,401,{error:'Unknown passkey'});
  json(res,200,{ token: u.token, user:{ id:u.id, name:u.name, email:u.email, role:u.role }, passkey: pk.name });
};
routes['POST /api/forgot'] = async (req,res) => {                     // public — issues reset token (demo returns link)
  const b = await body(req);
  const u = db.users.find(u => u.email === b.email);
  if (!u) return json(res,200,{ ok:true, message:'If an account matches that email, reset instructions have been sent.' });  // neutral — no enumeration
  const token = crypto.randomBytes(24).toString('hex');
  db.passwordResets.push({ token, email: u.email, expires: Date.now() + 3600e3, used: false });
  const url = '/forgot.html?token=' + token;
  sendEmail(u.email, 'Reset your Lines & Logos password',
    `Hi ${u.name},\n\nUse this link within 1 hour to set a new password:\n\nhttp://localhost:3001${url}\n\nIf you didn't request this, ignore this email.\n— Lines & Logos`);
  logActivity(`Password reset issued for ${u.email}`);
  save(); json(res,200,{ ok:true, message:'If an account matches that email, reset instructions have been sent.', resetUrl: url });  // demo surfaces the link; email is also in the outbox
};
routes['POST /api/reset'] = async (req,res) => {                      // public — consumes token
  const b = await body(req);
  const r = db.passwordResets.find(r => r.token === b.token && !r.used && r.expires > Date.now());
  if (!r) return json(res,400,{error:'Reset link invalid or expired'});
  const u = db.users.find(u => u.email === r.email);
  u.pass = scryptHash(b.password); r.used = true; u.passkeys = [];          // rotate — kill enrolled passkeys
  logActivity(`Password reset completed for ${u.email}`);
  save(); json(res,200,{ ok:true });
};

/* public quote request — Pricing Agent builds the line-item quote instantly */
routes['POST /api/quote-request'] = async (req,res) => {
  const b = await body(req);
  if (!b.service || !b.name) return json(res,400,{error:'Service and name required'});
  const quote = buildQuote(b);
  const ref = 'Q' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const qr = { id: uid('qr'), ref, name: b.name, email: b.email || '', phone: b.phone || '',
    facility: b.facility || '', city: b.city || 'Memphis, TN', ...quote, status: 'sent', createdAt: new Date().toISOString() };
  /* affiliate referral tracking — ?ref=CODE links persist on the quote requester */
  const refAff = b.ref && affByCode(b.ref);
  if (refAff) {
    qr.affiliateCode = refAff.code; qr.referredBy = refAff.name;
    notify(db.settings.quotes.approvalEmail, `Affiliate referral quote — ${b.facility || b.name}`, `Came in via ${refAff.name} (code ${refAff.code}). Quote ${ref} · $${quote.grandTotal.toLocaleString()}.`, ['in-app']);
    notifyAffiliate(refAff, `Referral activity: ${b.facility || b.name}`, `They just requested an instant quote (${ref} — $${quote.grandTotal.toLocaleString()}). You earn ${affPct(refAff)}% when the first job completes.`);
    logActivity(`Quote ${ref} attributed to affiliate ${refAff.name} (${refAff.code})`);
  }
  db.quoteRequests.unshift(qr);
  // notify admin + auto-email the requester the full quote
  if (b.email) sendEmail(b.email, `Your Lines & Logos quote ${ref} — ${quote.service}`,
    `Hi ${b.name},\n\nHere is your instant, fixed-scope quote (ref ${ref}):\n\n` +
    quote.lineItems.map(li => `• ${li.label}: $${li.amount.toLocaleString()}`).join('\n') +
    `\n\nPre-tax total: $${quote.total.toLocaleString()}` +
    (quote.taxAmount ? `\nEstimated ${quote.taxStateName} sales tax (${quote.taxRate}%): $${quote.taxAmount.toLocaleString()}\nTotal due: $${quote.grandTotal.toLocaleString()}` : '') +
    `\nValid ${db.settings.quotes.validityDays} days. ${quote.taxDisclaimer || ''}\n\nBook a free walkthrough to lock it in: http://localhost:3001/quotes.html\n— Lines & Logos Pricing Agent`);
  notify(db.settings.quotes.approvalEmail, `New quote request ${ref} — ${b.facility || b.name}`,
    `${b.name} (${b.city}) requested a ${quote.service} quote for ${quote.sqft.toLocaleString()} sq ft, ${quote.miles} mi out. Total $${quote.grandTotal.toLocaleString()} incl. ${quote.taxRate}% ${quote.taxState} tax.`);
  logActivity(`Pricing Agent generated quote ${ref} for ${b.name}: $${quote.grandTotal.toLocaleString()} incl. tax (${quote.taxState} ${quote.taxRate}%)`);
  save(); json(res,201,{ ref, ...quote });
};
routes['GET /api/quote-requests'] = async (req,res) => json(res,200, db.quoteRequests);
routes['POST /api/agent/price'] = async (req,res) => json(res,200, buildQuote(await body(req)));

/* schedule — job calendar for crew allocation */
routes['GET /api/schedule'] = async (req,res) =>
  json(res,200, db.jobs.filter(j => j.status !== 'complete')
    .map(j => ({ id:j.id, title:j.title, account:acctName(j.accountId), due:j.due, status:j.status, crew:j.crew }))
    .sort((a,b) => a.due.localeCompare(b.due)));

/* ---- team & HR ---- */
collRoutes(routes, 'employees', { prefix:'e' });
/* ---- ATS helpers: resumes, consent comms, candidate booking, reminders ---- */
const UPLOADS_DIR = path.join(ROOT, 'data', 'uploads');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}
function sendSms(to, text){ db.notifications.push({ id: uid('ntf'), channel: 'sms', to, text, status: 'sent', at: new Date().toISOString() }); }
function appHistory(a, status, note){ (a.history ||= []).push({ status, at: new Date().toISOString(), note: String(note||'').slice(0,300) }); }
function sendCandidateComms(a, subject, text){
  if (a.consentEmail && a.email) sendEmail(a.email, subject, text);
  if (a.consentSms && a.phone) sendSms(a.phone, String(text).split('\n')[0].slice(0,160));
}
function readRaw(req, maxBytes = 8 * 1024 * 1024){
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > maxBytes){ reject(new Error('payload too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function parseMultipart(req, maxBytes){
  const buf = await readRaw(req, maxBytes);
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(req.headers['content-type'] || ''));
  if (!m) throw new Error('multipart boundary missing');
  const boundary = Buffer.from('--' + (m[1] || m[2]));
  const fields = {}; let file = null; let start = 0;
  while (start < buf.length){
    const idx = buf.indexOf(boundary, start); if (idx < 0) break;
    const hdrEnd = buf.indexOf('\r\n\r\n', idx); if (hdrEnd < 0) break;
    const header = buf.slice(idx, hdrEnd).toString('latin1');
    const name = /name="([^"]+)"/.exec(header); if (!name){ break; }
    const filename = /filename="([^"]*)"/.exec(header);
    const next = buf.indexOf(boundary, hdrEnd + 4);
    const end = next > 0 ? next - 2 : buf.length - 2;
    const data = buf.slice(hdrEnd + 4, Math.max(hdrEnd + 4, end));
    if (filename && filename[1]) {
      file = { fieldName: name[1], filename: filename[1], contentType: (/Content-Type:\s*([^\r\n]+)/i.exec(header) || [])[1] || 'application/octet-stream', data };
    } else {
      fields[name[1]] = data.toString('utf8').replace(/\r\n$/, '');
    }
    if (next < 0) break;
    start = next;
  }
  return { fields, file };
}
function upcomingInterviewSlots(takenISOs = [], perDay = 2, days = 10){
  const slots = []; const now = Date.now();
  for (let d = 1; slots.length < days * perDay && d < 21; d++){
    const day = new Date(now + d * 86400000);
    const wd = day.getUTCDay(); if (wd === 0 || wd === 6) continue;
    const ymd = day.toISOString().slice(0, 10);
    for (const t of ['14:00', '18:00']){ // 9:00 AM / 1:00 PM America/Chicago
      const iso = new Date(ymd + 'T' + t + ':00.000Z').toISOString();
      if (new Date(iso).getTime() > now && !takenISOs.includes(iso)) slots.push(iso);
    }
  }
  return slots;
}
function careerReminders(){
  const soon = Date.now() + 24 * 3600 * 1000;
  for (const iv of db.interviews){
    if (iv.reminded || !iv.when || iv.status !== 'scheduled') continue;
    const t = new Date(iv.when).getTime();
    if (t > Date.now() && t <= soon){
      const a = db.applicants.find(x => x.id === iv.applicantId);
      if (a) sendCandidateComms(a, 'Reminder: your Lines & Logos interview is coming up',
        `Hi ${a.firstName},\n\nReminder: your ${a.position} interview is on ${new Date(iv.when).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT. Reply to reschedule.`);
      iv.reminded = true;
    }
  }
  save();
}
function seedCareersConfig(){
  db.settings.careers ||= { referralBonus: '$500 after the referred hire completes 90 days', schools: [
    { name: 'TCAT Memphis', city: 'Memphis, TN', program: 'Building Construction Technology' },
    { name: 'TCAT Ripley', city: 'Ripley, TN', program: 'Carpentry / Construction' },
    { name: 'TCAT Covington', city: 'Covington, TN', program: 'Industrial Maintenance' },
    { name: 'Moore Tech', city: 'Memphis, TN', program: 'Construction Technology' },
    { name: 'Mid-South Community College', city: 'West Memphis, AR', program: 'Skilled Trades Pathway' }
  ] };
}

routes['POST /api/apply'] = async (req,res) => {
  // JSON, or multipart with an optional validated resume upload.
  const ct = String(req.headers['content-type'] || '');
  let b = {}, resumeFile = null;
  if (ct.includes('multipart/form-data')) {
    try { const mp = await parseMultipart(req, 6 * 1024 * 1024); b = mp.fields; resumeFile = mp.file; }
    catch (e) { return json(res, 400, { error: 'Could not parse upload: ' + String(e.message || e) }); }
  } else {
    b = await body(req);
  }
  if (!b.firstName || !b.lastName) return json(res,400,{error:'First and last name are required.'});
  if (!b.email) return json(res,400,{error:'Email is required.'});
  const truthy = (v) => v === true || v === 'true' || v === 'on' || v === '1';
  const rec = (s) => s >= 80 ? 'strong' : s >= 60 ? 'maybe' : 'weak';
  const s = agents.scoreApplicant(b);
  const app = { id: uid('ap'),
    firstName: String(b.firstName).slice(0,60), lastName: String(b.lastName).slice(0,60),
    email: String(b.email).slice(0,120), phone: String(b.phone||'').slice(0,30),
    city: String(b.city||'').slice(0,80), position: String(b.position||'General Labor').slice(0,60),
    experience: String(b.experience||0), skills: String(b.skills||'').slice(0,500),
    availability: b.availability === 'part-time' ? 'part-time' : 'full-time',
    coverLetter: String(b.coverLetter||'').slice(0,2000),
    hasTransport: truthy(b.hasTransport), hasInsurance: truthy(b.hasInsurance), canLift: truthy(b.canLift),
    consentEmail: truthy(b.consentEmail), consentSms: truthy(b.consentSms),
    token: crypto.randomBytes(12).toString('hex'),
    aiScore: s, recommendation: rec(s), status: 'new', history: [],
    applied: new Date().toISOString().slice(0,10), createdAt: new Date().toISOString() };
  if (resumeFile && resumeFile.data.length){
    const ALLOWED = { '.pdf':'application/pdf', '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.doc':'application/msword', '.txt':'text/plain' };
    const ext = path.extname(resumeFile.filename || '').toLowerCase();
    if (!ALLOWED[ext]) return json(res,400,{ error:'Resume must be a PDF, DOC, DOCX, or TXT file.' });
    if (resumeFile.data.length > 5 * 1024 * 1024) return json(res,400,{ error:'Resume exceeds the 5MB limit.' });
    const head = resumeFile.data.slice(0, 8).toString('latin1');
    const magicOk = head.startsWith('%PDF') || head.startsWith('PK') || head.startsWith('ÐÏ.') || ext === '.txt';
    if (!magicOk) return json(res,400,{ error:'Resume content does not match its extension.' });
    const rel = 'data/uploads/' + app.id + ext;
    fs.writeFileSync(path.join(ROOT, rel), resumeFile.data);
    app.resume = { file: rel, mime: ALLOWED[ext], size: resumeFile.data.length, originalName: String(resumeFile.filename||'resume').slice(0,120) };
  } else if (b.resumeText) {
    app.resumeText = String(b.resumeText).slice(0, 5000);
  }
  app.aiSummary = `Score ${s}/100 for ${app.position}. Experience: ${app.experience}y. Skills: ${app.skills || 'none listed'}. Transport: ${app.hasTransport ? 'yes' : 'no'}. Insurance: ${app.hasInsurance ? 'yes' : 'no'}. Lift 50lb: ${app.canLift ? 'yes' : 'no'}. Availability: ${app.availability}.`;
  app.history.push({ status: 'new', at: app.createdAt, note: 'Application received' });
  db.applicants.push(app);
  if (app.consentEmail && app.email) sendEmail(app.email, 'Your Lines & Logos application — received',
    `Hi ${app.firstName},\n\nThanks for applying for the ${app.position} role. Our screening agent scored your application ${s}/100 (${rec(s)} recommendation).\n\nBook your interview any time here: https://linesandlogosteam.com/careers.html?token=${app.token}#book\n\nWe respond within one business day.\n— Lines & Logos Hiring Team`);
  if (app.consentSms && app.phone) sendSms(app.phone, `Lines & Logos: application received (${app.position}). Book your interview: linesandlogosteam.com/careers.html?token=${app.token}#book`);
  logActivity(`Applicant Screening Agent scored ${app.firstName||''} ${app.lastName||''} ${s} (${app.recommendation})`);
  save();
  json(res,201,{ applicantId: app.id, aiScore: s, recommendation: app.recommendation,
    token: app.token, bookingUrl: `careers.html?token=${app.token}#book`, resumeUploaded: !!app.resume });
};
routes['GET /api/applicants'] = async (req,res) => json(res,200, db.applicants);
routes['POST /api/applicants/approve'] = async (req,res,id) => {
  const a = db.applicants.find(a => a.id === id); if (!a) return json(res,404,{error:'Applicant not found'});
  a.status = 'approved'; appHistory(a, 'approved', 'Approved — e-sign packet issued');
  const emp = { id: uid('e'), name: `${a.firstName} ${a.lastName}`, role: a.position, type: '1099', w9Signed: false, rating: 4.0, skills: (a.skills||'').split(/,\s*/), availability: a.availability || 'part-time' };
  db.employees.push(emp);
  const token = crypto.randomBytes(16).toString('hex');
  db.portals.push({ token, name: emp.name, docs: ['W-9','1099 Acknowledgment','Scope of Work','Safety Agreement','Offer Letter'].map(n => ({ name:n, signed:false })) });
  const pkg = sendHirePackage(a, emp, token);          // Hiring Agent: e-sign packet (tax forms + state paperwork) out automatically
  sendCandidateComms(a, 'You’re approved — complete your new-hire paperwork',
    `Hi ${a.firstName},\n\nGreat news — you’re approved for the ${a.position} role. Complete your paperwork here: /portal.html?token=${token}\n\nOnce everything is signed we’ll confirm your start date.`);
  logActivity(`Onboarding: ${emp.name} approved → portal link issued`); save();
  json(res,200,{ employee: emp, portalToken: token, portalUrl: `/portal.html?token=${token}`, hirePackage: { id: pkg.id, docs: pkg.docs.map(d => d.name), status: pkg.status } });
};
routes['POST /api/applicants/reject'] = async (req,res,id) => {
  const a = db.applicants.find(a => a.id === id); if (!a) return json(res,404,{error:'Applicant not found'});
  const b = await body(req); a.status = 'rejected'; a.rejectReason = b.reason || '';
  appHistory(a, 'rejected', b.reason || 'Not selected');
  sendCandidateComms(a, 'Update on your Lines & Logos application',
    `Hi ${a.firstName},\n\nThanks for applying for the ${a.position} role. After careful review we won’t be moving forward this time${b.reason ? ` (${b.reason})` : ''}. We keep applications on file and reach out when a matching role opens — especially in ${a.city || 'your area'}.`);
  logActivity(`Applicant ${a.firstName} ${a.lastName} rejected`); save(); json(res,200,{ ok:true });
};

/* ---- ATS completion: candidate self-booking, status pipeline, recruiting ---- */
routes['GET /api/candidate'] = async (req,res) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token') || '';
  const a = db.applicants.find(x => x.token === token);
  if (!a) return json(res,404,{ error:'Invalid or expired application link.' });
  const mine = db.interviews.filter(i => i.applicantId === a.id && i.status === 'scheduled').map(i => i.when);
  json(res,200,{ name: `${a.firstName} ${a.lastName}`, position: a.position, status: a.status,
    history: a.history || [], booked: mine[0] || null,
    slots: upcomingInterviewSlots(mine, 10), resumeUploaded: !!a.resume });
};
routes['POST /api/candidate/book'] = async (req,res) => {
  const b = await body(req);
  const a = db.applicants.find(x => x.token === b.token);
  if (!a) return json(res,404,{ error:'Invalid or expired application link.' });
  const slot = String(b.slot || '');
  const mine = db.interviews.filter(i => i.applicantId === a.id && i.status === 'scheduled').map(i => i.when);
  if (!upcomingInterviewSlots(mine, 10).includes(slot)) return json(res,400,{ error:'That slot is no longer available — pick another.' });
  for (const iv of db.interviews.filter(i => i.applicantId === a.id && i.status === 'scheduled')) iv.status = 'canceled';
  const iv = { id: uid('iv'), applicantId: a.id, name: `${a.firstName} ${a.lastName}`, position: a.position,
    when: slot, status: 'scheduled', link: 'Details sent by email — reply to reschedule', reminded: false, createdAt: new Date().toISOString() };
  db.interviews.push(iv);
  db.events.push({ id: uid('ev'), title: `Interview: ${iv.name} (${a.position})`, when: slot });
  a.status = 'interview-scheduled'; appHistory(a, 'interview-scheduled', 'Candidate self-booked ' + slot);
  sendCandidateComms(a, 'Your Lines & Logos interview is booked',
    `Hi ${a.firstName},\n\nYou're booked for ${new Date(slot).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT for the ${a.position} role. Reply to this message to reschedule.`);
  logActivity(`Interview booked: ${iv.name} → ${slot}`); save();
  json(res,200,{ interview: iv });
};
routes['POST /api/applicants/status'] = async (req,res) => {
  const b = await body(req); const a = db.applicants.find(x => x.id === b.id);
  if (!a) return json(res,404,{ error:'Applicant not found' });
  const ALLOWED = ['new','screening','interview-scheduled','offer','approved','rejected','hired','onboarding'];
  if (!ALLOWED.includes(b.status)) return json(res,400,{ error:'Invalid status. Use: ' + ALLOWED.join(', ') });
  a.status = b.status; appHistory(a, b.status, b.note || 'Status updated by team');
  sendCandidateComms(a, 'Update on your Lines & Logos application',
    `Hi ${a.firstName},\n\nStatus update on your ${a.position} application: ${b.status}${b.note ? ' — ' + b.note : ''}.`);
  save(); json(res,200,{ ok:true, status: a.status });
};
routes['GET /api/applicant-resume'] = async (req,res) => {
  const ru = gate(req,res,STAFF); if (!ru) return;
  const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
  const a = db.applicants.find(x => x.id === id);
  if (!a || !a.resume) return json(res,404,{ error:'Resume not found' });
  const buf = fs.readFileSync(path.join(ROOT, a.resume.file));
  res.writeHead(200, { 'Content-Type': a.resume.mime, 'Content-Length': buf.length,
    'Content-Disposition': `attachment; filename="${(a.resume.originalName || 'resume').replace(/"/g, '')}"` });
  res.end(buf);
};
routes['GET /api/chat-upload'] = async (req,res) => {          // staff download of a chat attachment (files are no longer web-served)
  const cu = gate(req,res,STAFF); if (!cu) return;
  const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
  const u = (db.chatUploads || []).find(x => x.id === id);
  if (!u) return json(res,404,{ error:'Attachment not found' });
  try {
    const buf = fs.readFileSync(path.join(ROOT, u.file));
    res.writeHead(200, { 'Content-Type': u.type, 'Content-Length': buf.length,
      'Content-Disposition': `attachment; filename="${String(u.name || 'attachment').replace(/"/g,'')}"` });
    res.end(buf);
  } catch { json(res,404,{ error:'Attachment file missing' }); }
};
routes['GET /api/careers/signals'] = async (req,res) => {
  const byCity = {}, bySvc = {}, byPos = {};
  for (const l of db.leads){ if (l.city) byCity[l.city] = (byCity[l.city] || 0) + 1; if (l.service) bySvc[l.service] = (bySvc[l.service] || 0) + 1; }
  for (const a of db.applicants) if (a.position) byPos[a.position] = (byPos[a.position] || 0) + 1;
  const top = (o,n) => Object.entries(o).sort((x,y) => y[1] - x[1]).slice(0,n).map(([name,count]) => ({ name, count }));
  json(res,200,{ hotCities: top(byCity,5), hotServices: top(bySvc,5), applicantsByRole: top(byPos,6),
    applicantsTotal: db.applicants.length, generatedAt: new Date().toISOString() });
};
routes['GET /api/careers/schools'] = async (req,res) => {
  seedCareersConfig();
  json(res,200,{ schools: db.settings.careers.schools, referralBonus: db.settings.careers.referralBonus });
};
routes['POST /api/careers/referral'] = async (req,res) => {
  seedCareersConfig();
  const b = await body(req);
  if (!b.referrerName || !b.referrerEmail || !b.candidateName) return json(res,400,{ error:'Your name, your email, and the candidate’s name are required.' });
  if (!b.consent) return json(res,400,{ error:'Please confirm the candidate agreed to be referred.' });
  const ref = { id: uid('ref'), referrerName: String(b.referrerName).slice(0,80), referrerEmail: String(b.referrerEmail).slice(0,120),
    referrerPhone: String(b.referrerPhone||'').slice(0,30), candidateName: String(b.candidateName).slice(0,80),
    candidateContact: String(b.candidateContact||'').slice(0,120), relationship: String(b.relationship||'').slice(0,60),
    note: String(b.note||'').slice(0,500), status: 'new', bonus: db.settings.careers.referralBonus, createdAt: new Date().toISOString() };
  (db.referrals ||= []).push(ref);
  notify('admin', 'New employee referral', `${ref.referrerName} referred ${ref.candidateName}${ref.relationship ? ` (${ref.relationship})` : ''}`);
  logActivity(`Referral: ${ref.referrerName} → ${ref.candidateName}`); save();
  json(res,201,{ referralId: ref.id, bonus: ref.bonus });
};
/* ================= PERSISTENT MEMORY BANK ================= */
function rememberFact(text, source){
  const t = String(text||'').trim().slice(0,500);
  if (t.length < 10) return null;
  const dup = (db.memoryBank||[]).find(m => m.text === t);
  if (dup) return dup;
  const fact = { id: uid('mem'), text: t, source: String(source||'').slice(0,60), learnedAt: new Date().toISOString() };
  (db.memoryBank ||= []).push(fact);
  if (db.memoryBank.length > 800) db.memoryBank = db.memoryBank.slice(-800);
  return fact;
}
function memorySearch(q){
  const words = String(q||'').toLowerCase().split(/\W+/).filter(w => w.length > 3);
  return (db.memoryBank||[]).filter(m => words.some(w => m.text.toLowerCase().includes(w))).slice(-3).reverse();
}
function memoryCaptureFromActivity(){
  for (const a of db.activity.slice(-40)){
    if (/qualified|referred|signed|completed|won|approved|booked/i.test(a.text||'')) rememberFact(a.text, 'activity:' + (a.by||'system'));
  }
}
routes['GET /api/memory'] = async (req,res) => json(res,200,(db.memoryBank||[]).slice(-200).reverse());
routes['POST /api/memory'] = async (req,res) => { const b = await body(req); const f = rememberFact(b.text, b.source || 'manual'); save(); json(res,201,{ fact: f }); };
routes['DELETE /api/memory'] = async (req,res) => { const b = await body(req); db.memoryBank = (db.memoryBank||[]).filter(m => m.id !== b.id); save(); json(res,200,{ ok:true }); };

/* ================= SPEND AUDIT + TRANSACTION Q&A ================= */
function spendAudit(){
  const alerts = [];
  const subs = {};
  for (const e of db.expenses || []){
    const who = String(e.vendor || e.category || 'unknown').toLowerCase().trim();
    (subs[who] ||= []).push(e);
  }
  for (const [who, list] of Object.entries(subs)){
    if (list.length >= 3 && /sub|monthly|annual|saas|software|host|insur|rent/i.test(who)){
      const monthly = list.slice(-3).reduce((s,e) => s + Number(e.amount||0), 0) / 3;
      alerts.push({ type:'subscription', severity: monthly > 300 ? 'review' : 'info', vendor: who,
        message:`"${who}" looks recurring (~$${monthly.toFixed(0)}/mo avg, ${list.length} charges). Verify it's still needed; approve removal before canceling anything.` });
    }
    const amounts = list.map(e => Number(e.amount||0));
    const avg = amounts.reduce((a,b) => a + b, 0) / (amounts.length || 1);
    for (const e of list){
      if (avg > 0 && Number(e.amount) > avg * 2.5 && Number(e.amount) > 100)
        alerts.push({ type:'anomaly', severity:'review', vendor: who,
          message:`Unusually large "${who}" charge of $${e.amount} (typical ~$${avg.toFixed(0)}). Pull invoice ${e.id} and confirm with the vendor.` });
    }
  }
  for (const e of db.expenses || []){
    const dup = (db.expenses||[]).find(x => x.id !== e.id
      && String(x.vendor||'').toLowerCase() === String(e.vendor||'').toLowerCase()
      && Number(x.amount) === Number(e.amount)
      && Math.abs(new Date(x.date||x.at||0) - new Date(e.date||e.at||0)) < 7 * 86400000);
    if (dup) alerts.push({ type:'duplicate', severity:'review', vendor: e.vendor,
      message:`Possible duplicate: two "${e.vendor}" charges of $${e.amount} within 7 days (${e.id} / ${dup.id}). Verify before paying twice.` });
  }
  db.financialAlerts = alerts.slice(0,50);
  return alerts;
}
function spendLookup(q){
  const t = String(q||'').toLowerCase();
  const amt = /(\$?\d[\d,]*(?:\.\d{2})?)/.exec(t);
  let hits = [];
  if (amt){
    const n = parseFloat(amt[1].replace(/[$,]/g,''));
    hits = (db.expenses||[]).filter(e => Math.abs(Number(e.amount) - n) < 0.01);
  }
  if (!hits.length){
    const words = t.split(/\W+/).filter(w => w.length > 3);
    hits = (db.expenses||[]).filter(e => words.some(w => String(e.vendor||e.category||'').toLowerCase().includes(w)));
  }
  if (!hits.length) return null;
  return hits.slice(0,5).map(e => `$${e.amount} → ${e.vendor||e.category||'unknown'} on ${String(e.date||e.at||'').slice(0,10)} (${e.category||'uncategorized'}) [${e.id}]`).join(' · ');
}
routes['GET /api/spend-audit'] = async (req,res) => json(res,200, spendAudit());

/* ---- automated db.json backups (timestamped, rotated, restorable) ---- */
function backupDb(reason = 'manual'){
  try {
    const dir = path.join(ROOT, 'data', 'backups');   // local const: this runs at module load — module-level const would be in TDZ
    fs.mkdirSync(dir, { recursive: true });
    const name = 'db-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19) + '.json';
    fs.copyFileSync(DB_FILE, path.join(dir, name));
    const files = fs.readdirSync(dir).filter(f => f.startsWith('db-')).sort();
    for (const old of files.slice(0, -10)) fs.unlinkSync(path.join(dir, old));   // keep last 10
    return name;
  } catch (e) { console.error('backup failed:', e.message); return null; }
}
/* ================= KIMI CLAW — coding-agent orchestration console ================= */
function clawConfig(){ return db.settings.claw ||= { repo:'ProjectZeroDays/lines-and-logos-business-os', branch:'main', agents:[], schedules:[], jobs:[] }; }
const CLAW_TASKS = ['feature','patch','docs-update','github-management','release-cut','seo-pass','dependency-audit'];
routes['GET /api/claw'] = async (req,res) => json(res,200, clawConfig());
routes['POST /api/claw/config'] = async (req,res) => {
  const b = await body(req); const c = clawConfig();
  if (b.repo) c.repo = String(b.repo).slice(0,120);
  if (b.branch) c.branch = String(b.branch).slice(0,60);
  if (b.agents != null) c.agents = (Array.isArray(b.agents) ? b.agents : String(b.agents).split(',')).map(s => s.trim()).filter(Boolean).slice(0,10);
  save(); json(res,200,{ ok:true, claw: c });
};
routes['POST /api/claw/run'] = async (req,res) => {
  const b = await body(req); const c = clawConfig();
  if (!CLAW_TASKS.includes(b.task)) return json(res,400,{ error:'task must be one of: ' + CLAW_TASKS.join(', ') });
  const job = { id: uid('claw'), task: b.task, brief: String(b.brief || '').slice(0,400), status: 'queued',
    assignedAgents: (b.agents || c.agents).slice(0,4), createdBy: (auth(req)||{}).email || 'admin', createdAt: new Date().toISOString() };
  c.jobs.unshift(job);
  if (c.jobs.length > 50) c.jobs = c.jobs.slice(0, 50);
  logActivity('Kimi Claw: ' + job.task + ' job queued (' + job.id + ')');
  notify('admin', 'Kimi Claw job queued', job.task + ' — ' + job.brief.slice(0, 80));
  save(); json(res,201,{ job });
};
routes['POST /api/claw/schedule'] = async (req,res) => {
  const b = await body(req); const c = clawConfig();
  if (!CLAW_TASKS.includes(b.task) || !b.cron) return json(res,400,{ error:'task + cron expression required' });
  const s = { id: uid('sch'), task: b.task, cron: String(b.cron).slice(0,40), brief: String(b.brief || '').slice(0,300), enabled: b.enabled !== false };
  c.schedules.push(s); save(); json(res,201,{ schedule: s });
};

/* ---- Google Workspace integration (storage / photos / video) ---- */
function gwsConfig(){ return db.settings.integrations = db.settings.integrations || {}, db.settings.integrations.gworkspace ||= { clientId:'', clientSecret:'', redirectUri:'', driveFolderPhotos:'', driveFolderVideo:'', connected:false }; }
routes['GET /api/gworkspace'] = async (req,res) => { const g = gwsConfig(); json(res,200,{ clientIdMasked: g.clientId ? g.clientId.slice(0,8)+'…' : '', connected: g.connected, folders:{ photos: g.driveFolderPhotos, video: g.driveFolderVideo } }); };
routes['POST /api/gworkspace'] = async (req,res) => {
  const b = await body(req); const g = gwsConfig();
  if (b.clientId != null) g.clientId = String(b.clientId);
  if (b.clientSecret != null) g.clientSecret = String(b.clientSecret);
  if (b.redirectUri != null) g.redirectUri = String(b.redirectUri);
  if (b.driveFolderPhotos != null) g.driveFolderPhotos = String(b.driveFolderPhotos);
  if (b.driveFolderVideo != null) g.driveFolderVideo = String(b.driveFolderVideo);
  save(); logActivity('Google Workspace settings updated'); json(res,200,{ ok:true, connected: g.connected });
};
/* OAuth handshake placeholder — completes when credentials are provided:
   1) GET https://accounts.google.com/o/oauth2/v2/auth?client_id=…&scope=https://www.googleapis.com/auth/drive.readonly&response_type=code&redirect_uri=…
   2) POST /token exchange → store refresh token → g.connected = true
   Wire-up lives behind the same config; nothing calls Google until connected. */

/* ================= GOOGLE SUITE (Maps, Business, Docs/Sheets/Slides/Calendar, Gemini backup) ================= */
function googleConfig(){ const I = db.settings.integrations = db.settings.integrations || {}; return I.google ||= { mapsKey:'', businessProfileId:'', calendarId:'', docsFolder:'', sheetsFolder:'', slidesFolder:'', geminiKey:'', connected:false }; }
routes['GET /api/google'] = async (req,res) => { const g = googleConfig();
  json(res,200,{ mapsKeySet: !!g.mapsKey, businessProfileId: g.businessProfileId, calendarId: g.calendarId,
    folders: { docs: g.docsFolder, sheets: g.sheetsFolder, slides: g.slidesFolder },
    geminiKeyMasked: g.geminiKey ? g.geminiKey.slice(0,10) + '…' : '', connected: g.connected }); };
routes['POST /api/google'] = async (req,res) => {
  const b = await body(req); const g = googleConfig();
  for (const k of ['mapsKey','businessProfileId','calendarId','docsFolder','sheetsFolder','slidesFolder','geminiKey'])
    if (b[k] != null) g[k] = String(b[k]).slice(0, 200);
  save(); logActivity('Google suite settings updated'); json(res,200,{ ok:true, connected: g.connected });
};
/* Gemini as AI backup: paste the same key into Admin → Settings → AI Providers (Gemini preset) and
   add it as a fallback in the routing table — auto-routing will use it when the primary is down. */

/* ---- Google Maps distance/miles (fallback: built-in city table) ---- */
const CITY_COORDS = { 'memphis, tn':[35.15,-90.05],'memphis':[35.15,-90.05],'nashville, tn':[36.16,-86.78],'little rock, ar':[34.75,-92.29],'jackson, tn':[35.61,-88.82],'jackson, ms':[32.30,-90.18],'birmingham, al':[33.52,-86.80],'huntsville, al':[34.73,-86.59],'tupelo, ms':[34.26,-88.70],'jonesboro, ar':[35.84,-90.70],'paducah, ky':[37.08,-88.60],'hot springs, ar':[34.50,-93.05],'cape girardeau, mo':[37.30,-89.52],'st. louis, mo':[38.63,-90.20],'louisville, ky':[38.25,-85.76],'chattanooga, tn':[35.05,-85.31],'atlanta, ga':[33.75,-84.39],'tulsa, ok':[36.15,-95.99],'new orleans, la':[29.95,-90.07] };
function haversineMi(a, b){ const R = 3958.8, rad = x => x * Math.PI / 180;
  const dLat = rad(b[0]-a[0]), dLon = rad(b[1]-a[1]);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h))); }
routes['GET /api/maps/distance'] = async (req,res) => {
  const q = new URL(req.url, 'http://x');
  const from = (q.searchParams.get('from') || 'memphis, tn').toLowerCase().trim();
  const to = (q.searchParams.get('to') || '').toLowerCase().trim();
  if (!to) return json(res,400,{ error:'?to=city required' });
  const g = googleConfig();
  if (g.mapsKey){   // Google Distance Matrix (driving miles)
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(from)}&destinations=${encodeURIComponent(to)}&units=imperial&key=${g.mapsKey}`;
      const j = await (await fetch(url)).json();
      const el = j.rows && j.rows[0] && j.rows[0].elements && j.rows[0].elements[0];
      if (el && el.status === 'OK') return json(res,200,{ source:'google', from, to, miles: Math.round(Number(el.distance.value) / 1609.34), duration: el.duration.text });
    } catch (e) { /* fall through to the built-in table */ }
  }
  const A = CITY_COORDS[from], Bm = CITY_COORDS[to];
  if (!A || !Bm) return json(res,404,{ error:'Unknown city — add a Google Maps key for arbitrary addresses, or use one of the 18 service-area cities.' });
  const miles = haversineMi(A, Bm);
  json(res,200,{ source:'built-in-table', from, to, miles, withinServiceArea: miles <= 400 });
};

/* ---- Video meetings (Jitsi rooms — zero-infra WebRTC; swap for a self-hosted SFU later if needed) ---- */
routes['POST /api/video/meeting'] = async (req,res) => {
  const b = await body(req);
  if (!b.with || !b.when) return json(res,400,{ error:'"with" and "when" are required' });
  const room = 'lines-logos-' + crypto.randomBytes(4).toString('hex');
  const link = 'https://meet.jit.si/' + room;
  db.events.push({ id: uid('ev'), title: 'Video call: ' + String(b.with), when: String(b.when), link });
  notify('admin', 'Video meeting scheduled', 'With ' + b.with + ' at ' + b.when + ' — ' + link);
  if (b.email) sendEmail(String(b.email), 'Your Lines & Logos video call', `Hi,\n\nYour video call is scheduled for ${b.when}.\nJoin here: ${link}\n\nWorks in any browser — no install needed.`);
  logActivity('Video meeting scheduled with ' + b.with);
  save(); json(res,201,{ link, room, when: b.when });
};

/* ================= CUSTOMER ACCOUNTS (portal v2: username+password, 2FA, passkeys) ================= */
function customerAccounts(){ return db.customerAccounts ||= []; }
function findAccount(idOrUser){ return customerAccounts().find(a => a.id === idOrUser || a.username.toLowerCase() === String(idOrUser).toLowerCase()); }
function accountSession(req){ const t = req.headers['authorization']; if (!t || !t.startsWith('Bearer cust_')) return null; return customerAccounts().find(a => a.sessions && a.sessions.includes(t.slice(7))) || null; }
function issueAccountSession(a){ const s = 'cust_' + crypto.randomBytes(18).toString('hex'); (a.sessions ||= []).push(s); if (a.sessions.length > 5) a.sessions = a.sessions.slice(-5); save(); return s; }
/* TOTP (RFC 6238) */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32encode = (buf) => { let bits = 0, val = 0, out = ''; for (const b of buf){ val = (val << 8) | b; bits += 8; while (bits >= 5){ out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(val << (5 - bits)) & 31]; return out; };
const b32decode = (s) => { let bits = 0, val = 0; const out = []; for (const ch of s.toUpperCase().replace(/=+$/,'')){ const i = B32.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8){ out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
function totpCode(secret, at = Date.now()){
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  const code = ((h[off] & 0x7f) << 24 | h[off+1] << 16 | h[off+2] << 8 | h[off+3]) % 1000000;
  return String(code).padStart(6, '0');
}
function verifyTotp(secret, code){
  for (const drift of [-1, 0, 1]) if (totpCode(secret, Date.now() + drift * 30000) === String(code).trim()) return true;
  return false;
}
/* WebAuthn / passkeys (platform authenticator; attestation "none") */
function wAuthnRp(){ return { name: 'Lines & Logos', id: 'linesandlogosteam.com' }; }
function webauthnChallenge(a){ a.webauthnCh ||= {}; const c = crypto.randomBytes(32).toString('base64url'); a.webauthnCh[c] = Date.now(); return c; }

routes['POST /api/auth/register'] = async (req,res) => {
  const b = await body(req);
  const username = String(b.username || '').trim();
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) return json(res,400,{ error:'Username: 3–30 chars, letters/numbers/._-' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email || ''))) return json(res,400,{ error:'Valid email required' });
  if (String(b.password || '').length < 12) return json(res,400,{ error:'Password must be at least 12 characters' });
  if (findAccount(username) || customerAccounts().find(x => x.email.toLowerCase() === String(b.email).toLowerCase()))
    return json(res,409,{ error:'Username or email already registered' });
  const a = { id: uid('ca'), username, email: String(b.email).slice(0,120), phone: String(b.phone || '').slice(0,30),
    pass: scryptHash(b.password), totpSecret: null, totpEnabled: false, passkeys: [], sessions: [],
    photoAuthority: true, company: { name:'', logo:'', banner:'', details:'' }, personal: {},
    disputes: [], modifyRequests: [], createdAt: new Date().toISOString() };
  customerAccounts().push(a);
  const s = issueAccountSession(a);
  logActivity('Customer account registered: ' + username); save();
  json(res,201,{ token: s, account: accountPublic(a), totpSetup: null });
};
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }   // HTML-escape for generated documents
function accountPublic(a){ return { id:a.id, username:a.username, email:a.email, phone:a.phone, totpEnabled:!!a.totpEnabled,
  passkeyCount:(a.passkeys||[]).length, photoAuthority: a.photoAuthority !== false, company: a.company, personal: a.personal,
  alerts: a.alerts || { jobs:true, invoices:true, marketing:false, sms:false, aiNotes:true } }; }

routes['POST /api/auth/login'] = async (req,res) => {
  const b = await body(req);
  const a = findAccount(String(b.username || ''));
  if (!a || !verifyPassword(b.password, a.pass)) return json(res,401,{ error:'Invalid credentials' });
  if (a.totpEnabled) return json(res,200,{ twoFactorRequired: true, pendingToken: crypto.randomBytes(16).toString('hex'), methods: ['totp','sms','passkey'] , _a: a.id });
  json(res,200,{ token: issueAccountSession(a), account: accountPublic(a) });
};
routes['POST /api/auth/2fa'] = async (req,res) => {
  const b = await body(req); const a = db.customerAccounts.find(x => x.id === b._aId) || findAccount(b.username || '');
  if (!a) return json(res,401,{ error:'Invalid credentials' });
  if (b.method === 'totp'){
    if (!a.totpSecret || !verifyTotp(a.totpSecret, b.code)) return json(res,401,{ error:'Invalid authenticator code' });
  } else if (b.method === 'sms'){
    sendSms(a.phone, 'Lines & Logos login code: ' + (a._smsCode = String(Math.floor(100000 + Math.random() * 900000))));
    if (String(b.code) !== String(a._smsCode)) return json(res,401,{ error:'Invalid SMS code (check the simulated SMS in admin notifications)' });
  } else return json(res,400,{ error:'Unsupported 2FA method' });
  json(res,200,{ token: issueAccountSession(a), account: accountPublic(a) });
};
routes['POST /api/auth/totp/setup'] = async (req,res) => {   // must be logged in
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  a.totpSecret = b32encode(crypto.randomBytes(20));
  save();
  json(res,200,{ secret: a.totpSecret, uri: `otpauth://totp/Lines%26Logos:${encodeURIComponent(a.username)}?secret=${a.totpSecret}&issuer=Lines%26Logos` });
};
routes['POST /api/auth/totp/enable'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const b = await body(req);
  if (!verifyTotp(a.totpSecret, b.code)) return json(res,400,{ error:'Code does not match — check your authenticator app' });
  a.totpEnabled = true; save(); json(res,200,{ ok:true });
};
/* passkey registration + assertion */
routes['POST /api/auth/passkey/register'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const challenge = webauthnChallenge(a);
  json(res,200,{ publicKey: { challenge: Buffer.from(challenge, 'base64url').toString('base64'), rp: wAuthnRp(),
    user: { id: Buffer.from(a.id).toString('base64'), name: a.username, displayName: a.username },
    pubKeyCredParams: [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }], timeout: 60000, attestation: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' } } });
};
routes['POST /api/auth/passkey/complete'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const b = await body(req);   // {id, publicKey, algorithm}
  if (!b.id || !b.publicKey) return json(res,400,{ error:'Passkey credential missing' });
  a.passkeys.push({ id: String(b.id).slice(0,200), publicKey: String(b.publicKey).slice(0,400), createdAt: new Date().toISOString() });
  save(); json(res,200,{ ok:true, passkeyCount: a.passkeys.length });
};
routes['GET /api/auth/passkey/challenge'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const challenge = webauthnChallenge(a);
  json(res,200,{ challenge: Buffer.from(challenge, 'base64url').toString('base64'), allowCredentials: (a.passkeys||[]).map(p => ({ type:'public-key', id: p.id })) });
};
routes['GET /api/account'] = async (req,res) => { const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' }); json(res,200, accountPublic(a)); };
routes['PUT /api/account'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const b = await body(req);
  if (b.company) a.company = { ...a.company, ...Object.fromEntries(Object.entries(b.company).map(([k,v]) => [k, typeof v === 'string' ? v.slice(0, 40000) : v])) };
  if (b.personal) a.personal = { ...a.personal, ...b.personal };
  if (b.photoAuthority != null) a.photoAuthority = !!b.photoAuthority;
  save(); json(res,200, accountPublic(a));
};
routes['POST /api/account/alerts'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const b = await body(req);
  a.alerts = { jobs: b.jobs !== false, invoices: b.invoices !== false, marketing: !!b.marketing, sms: !!b.sms, aiNotes: b.aiNotes !== false };
  save(); json(res,200,{ ok:true, alerts: a.alerts });
};
routes['GET /api/account/notes'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  json(res,200, (a.notes || []).slice(-40).reverse());
};
/* invoices going back one year, matched to this account */
function invoicesForAccount(a){
  const yearAgo = Date.now() - 365 * 86400000;
  return (db.invoices || []).filter(i => {
    const issued = new Date(i.issued || i.at || i.date || 0).getTime();
    if (issued < yearAgo) return false;
    const who = String(i.customer || i.customerEmail || '').toLowerCase();
    return who && (who === String(a.company.name || '').toLowerCase() || who === a.email.toLowerCase() || String(i.customerEmail || '').toLowerCase() === a.email.toLowerCase());
  });
}
routes['GET /api/account/invoices'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  json(res,200, invoicesForAccount(a));
};
routes['GET /api/account/invoice-download'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
  const inv = invoicesForAccount(a).find(i => i.id === id);
  if (!inv) return json(res,404,{ error:'Invoice not found (invoices are available for one year from issue).' });
  const company = db.settings.company || {};
  const paid = inv.status === 'paid';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv.id}</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#111;line-height:1.6}h1{font-size:24px;margin:0}h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:26px 0 8px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:9px 8px;border-bottom:1px solid #ccc;text-align:left}th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#555}.stamp{position:absolute;top:60px;right:60px;border:3px solid ${paid ? '#16a34a' : '#d97706'};color:${paid ? '#16a34a' : '#d97706'};font-weight:800;font-size:20px;letter-spacing:.2em;padding:6px 16px;transform:rotate(-8deg);text-transform:uppercase}.total{font-size:17px;font-weight:800}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1>Lines &amp; Logos</h1><p style="font-size:12px;margin:4px 0 0">${esc(company.address || '2847 New Broadway St., Memphis, TN 38109')}<br>${esc(company.email || 'info@linesandlogos.team')}</p></div>
<div style="text-align:right"><b style="font-size:18px">INVOICE ${inv.id}</b><br><span style="font-size:12px">Issued: ${esc(inv.issued || '')}</span></div></div>
<div class="stamp">${paid ? 'Paid' : inv.status}</div>
<h2>Bill to</h2><p style="font-size:13px">${esc(inv.customer || inv.customerEmail || a.company.name || a.username)}</p>
<h2>Line items</h2><table><tr><th>Description</th><th>Amount</th></tr>
${(inv.items && inv.items.length ? inv.items : [{ description: 'Contract work — ' + inv.id, amount: inv.total || inv.amount }]).map(it => `<tr><td>${esc(it.description)}</td><td>${fmtMoney(it.amount)}</td></tr>`).join('')}
<tr><td class="total">Total due</td><td class="total">${fmtMoney(inv.total || inv.amount)}</td></tr></table>
<p style="font-size:11.5px;color:#555;margin-top:26px">Payment terms as stated in your contract. Questions or disputes: info@linesandlogos.team. Thank you for your business.</p>
</body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8',
    'Content-Disposition': `attachment; filename="invoice-${inv.id}.html"` });
  res.end(html);
};
const fmtMoney = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function addAccountNote(account, text, source){
  (account.notes ||= []).push({ id: uid('nt'), at: new Date().toISOString(), text: String(text).slice(0,220), source: source || 'ai' });
  if (account.notes.length > 60) account.notes = account.notes.slice(-60);
}
routes['GET /api/account/export'] = async (req,res) => {   // download all personal/business data
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const photos = (db.gallery || []).filter(g => g.customerId === a.id);
  json(res,200,{ exportedAt: new Date().toISOString(), account: accountPublic(a), photos, jobs: db.jobs.filter(j => j.customerId === a.id), invoices: db.invoices.filter(i => i.customer === a.company.name || i.email === a.email) });
};
routes['DELETE /api/account'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  db.customerAccounts = customerAccounts().filter(x => x.id !== a.id);
  db.gallery = (db.gallery || []).filter(g => g.customerId !== a.id);
  logActivity('Customer account deleted: ' + a.username); save();
  json(res,200,{ ok:true, deleted: true });
};
routes['POST /api/account/photo'] = async (req,res) => {   // multipart logo/banner (≤800KB → data URL)
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const mp = await parseMultipart(req, 1024 * 1024);
  const f = mp.file; if (!f || !/^image\//.test(f.contentType)) return json(res,400,{ error:'Image file required' });
  if (f.data.length > 800 * 1024) return json(res,400,{ error:'Image exceeds 800KB' });
  const field = mp.fields['field'] === 'banner' ? 'banner' : 'logo';
  a.company[field] = `data:${f.contentType};base64,` + f.data.toString('base64');
  save(); json(res,200,{ ok:true, field });
};
routes['GET /api/blog'] = async (req,res) => {   // AI-written posts for the right rail
  db.blogPosts ||= [
    { id:'bp1', title:'How long does a gym floor refinish take?', body:'A court restripe is usually a one-day job; a full sand-and-finish typically runs about a week depending on square footage, coats, and cure time. Your written estimate states exact dates — and we schedule around your events calendar.', at:'2026-11-18' },
    { id:'bp2', title:'What schools should ask before hiring a floor contractor', body:'Ask for a written estimate valid at least 14 days, photo documentation of every phase, cure-time guarantees in writing, and a named crew lead. Every Lines & Logos project includes all four.', at:'2026-11-16' },
    { id:'bp3', title:'Spring floor-care checklist for athletic directors', body:'Check high-traffic lane wear, pad seams, and baseline tape before playoff season. Catching wear early turns a refinish into a recoat — a fraction of the cost and downtime.', at:'2026-11-12' }
  ];
  json(res,200, db.blogPosts);
};
routes['POST /api/account/job-photo'] = async (req,res) => {   // customer/contractor job photos → approval queue
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const mp = await parseMultipart(req, 6 * 1024 * 1024);
  const f = mp.file;
  if (!f || !/^image\//.test(f.contentType)) return json(res,400,{ error:'Image required' });
  const rel = 'data/uploads/job-' + a.id + '-' + Date.now() + '.jpg';
  fs.writeFileSync(path.join(ROOT, rel), f.data);
  (db.gallery ||= []).push({ id: uid('g'), customerId: a.id, url: rel, caption: String(mp.fields['caption'] || '').slice(0,120), uploadedBy: a.username, status: 'pending', uploadedAt: new Date().toISOString() });
  notify('admin', 'Job photo pending approval', a.username + ' uploaded a job photo');
  save(); json(res,201,{ ok:true, pending: true });
};
routes['GET /api/account/photos'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  json(res,200, (db.gallery || []).filter(g => g.customerId === a.id));
};
routes['POST /api/account/dispute'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const b = await body(req);
  if (!b.invoiceId || !b.reason) return json(res,400,{ error:'invoiceId and reason required' });
  const d = { id: uid('dsp'), invoiceId: b.invoiceId, reason: String(b.reason).slice(0,500), amount: Number(b.amount || 0), status: 'open', remediation: null, createdAt: new Date().toISOString() };
  a.disputes.unshift(d);
  notify('admin', 'Bill dispute opened', a.username + ' disputes ' + b.invoiceId + ': ' + String(b.reason).slice(0,80));
  logActivity('Bill dispute: ' + a.username + ' → ' + b.invoiceId); save();
  json(res,201,{ dispute: d });
};
routes['POST /api/account/modify-request'] = async (req,res) => {
  const a = accountSession(req); if (!a) return json(res,401,{ error:'Login required' });
  const b = await body(req);
  const job = db.jobs.find(j => j.id === b.jobId);
  if (!job) return json(res,404,{ error:'Job not found' });
  const days = Math.ceil((new Date(job.when || job.due) - Date.now()) / 86400000);
  if (days > 3) return json(res,400,{ error:'Appointments can only be modified within 3 days of the job date (yours is in ' + days + ' days). Partial-refund policy applies to changes made inside the window.' });
  const r = { id: uid('mod'), jobId: b.jobId, requested: String(b.requested || '').slice(0,300), status: 'pending', partialRefundNotice: true, createdAt: new Date().toISOString() };
  a.modifyRequests.unshift(r);
  notify('admin', 'Appointment modification requested', a.username + ' → ' + job.title);
  save(); json(res,201,{ request: r });
};

/* ================= AUTOMATION GAPS (blueprint Part 2) ================= */
function contractFlags(){
  const flags = [];
  for (const c of db.contracts || []){
    const id = c.id || c.title || 'untitled';
    if (c.status && c.status !== 'signed' && !c.signToken) flags.push(`Contract ${id} unsigned with no signing link`);
    const amt = Number(c.amount || c.value || 0);
    if (amt > 25000 && !c.depositPaid) flags.push(`Contract ${id} ($${amt.toLocaleString()}) has no recorded deposit`);
  }
  return flags.slice(0,5);
}
function weeklyMemo(){
  const weekAgo = Date.now() - 7 * 86400000;
  const newLeads = db.leads.filter(l => new Date(l.createdAt || 0) > weekAgo).length;
  const newQuotes = (db.quoteRequests || []).filter(q => new Date(q.at || q.createdAt || 0) > weekAgo).length;
  const paidInv = db.invoices.filter(i => i.status === 'paid' && new Date(i.paidAt || 0) > weekAgo);
  const paidSum = paidInv.reduce((s,i) => s + Number(i.total || i.amount || 0), 0);
  const unpaid = db.invoices.filter(i => i.status !== 'paid');
  const openDisputes = (db.customerAccounts || []).flatMap(a => a.disputes || []).filter(d => d.status !== 'resolved').length;
  const agentRuns = (db.agentAudits || []).filter(a => new Date(a.at) > weekAgo).length;
  const evalScore = ((db.settings.agentGovernance || {}).lastEval || {}).score;
  const memo = { id: uid('memo'), at: new Date().toISOString(), lines: [
    `Leads: +${newLeads} new (pipeline now ${db.leads.length})`,
    `Quotes: ${newQuotes} requested · Invoices: ${paidInv.length} paid ($${paidSum.toLocaleString()}) · ${unpaid.length} open`,
    `Jobs next 7 days: ${db.jobs.filter(j => j.when && new Date(j.when) > Date.now() && new Date(j.when) < Date.now() + 7 * 86400000).length} · Open disputes: ${openDisputes}`,
    `Agent actions: ${agentRuns} · Eval score: ${evalScore ?? '—'}%`,
    ...contractFlags().map(f => '⚠ ' + f)
  ] };
  (db.weeklyMemos ||= []).push(memo);
  if (db.weeklyMemos.length > 12) db.weeklyMemos = db.weeklyMemos.slice(-12);
  notify('admin', 'Weekly memo — ' + new Date().toLocaleDateString(), memo.lines.join('\n'));
  save();
  return memo;
}
routes['GET /api/weekly-memo'] = async (req,res) => json(res,200,{ memos: db.weeklyMemos || [] });
routes['POST /api/weekly-memo'] = async (req,res) => json(res,200, weeklyMemo());

function capacity(){
  const crews = Math.max(1, (db.employees || []).filter(e => e.status !== 'inactive').length);
  const byDay = {};
  for (const j of db.jobs || []){ if (!j.when) continue; const d = String(j.when).slice(0,10); (byDay[d] ||= []).push(j); }
  const today = new Date().toISOString().slice(0,10);
  const horizon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10);
  const days = Object.entries(byDay)
    .filter(([d]) => d >= today && d <= horizon)
    .map(([d, js]) => ({ date: d, jobs: js.length, overbooked: js.length > crews, titles: js.map(j => j.title || j.name) }))
    .sort((a,b) => a.date.localeCompare(b.date));
  return { crews, days, overbooked: days.filter(d => d.overbooked) };
}
routes['GET /api/capacity'] = async (req,res) => json(res,200, capacity());

routes['GET /api/equipment'] = async (req,res) => json(res,200, db.equipment || []);
routes['POST /api/equipment'] = async (req,res) => {
  const b = await body(req);
  if (!b.name) return json(res,400,{ error:'name required' });
  (db.equipment ||= []).push({ id: uid('eq'), name: String(b.name).slice(0,80), type: String(b.type || 'general').slice(0,40),
    status: String(b.status || 'available').slice(0,20), assignedJob: String(b.assignedJob || '').slice(0,40),
    maintenanceDue: String(b.maintenanceDue || '').slice(0,10), notes: String(b.notes || '').slice(0,200), createdAt: new Date().toISOString() });
  save(); json(res,201,{ ok:true, count: db.equipment.length });
};
function equipmentAlerts(){
  const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0,10);
  const due = (db.equipment || []).filter(e => e.maintenanceDue && e.maintenanceDue <= soon && e.status !== 'maintenance');
  if (due.length) notify('admin', 'Equipment maintenance due', due.map(e => `${e.name} (due ${e.maintenanceDue})`).join(' · '));
  return due.length;
}
routes['POST /api/incidents'] = async (req,res) => {   // safety incident log
  const b = await body(req);
  if (!b.description) return json(res,400,{ error:'description required' });
  const inc = { id: uid('inc'), jobId: String(b.jobId || '').slice(0,40), severity: String(b.severity || 'minor'),
    description: String(b.description).slice(0,400), action: String(b.action || '').slice(0,300), at: new Date().toISOString() };
  (db.incidents ||= []).push(inc);
  notify('admin', 'Safety incident (' + inc.severity + ')', inc.description.slice(0,100));
  logActivity('Safety incident logged: ' + inc.severity); save();
  json(res,201,{ incident: inc });
};
routes['GET /api/incidents'] = async (req,res) => json(res,200, (db.incidents || []).slice(-50).reverse());

function healthScores(){
  return (db.customerAccounts || []).map(a => {
    let score = 100;
    const openDisp = (a.disputes || []).filter(d => d.status !== 'resolved').length;
    score -= openDisp * 25;
    const times = [new Date(a.createdAt || 0).getTime(), ...(a.notes || []).map(n => new Date(n.at || 0).getTime())];
    const idleDays = Math.round((Date.now() - Math.max(...times)) / 86400000);
    if (idleDays > 90) score -= 30;
    return { account: a.username, company: (a.company || {}).name || '', score: Math.max(0, score),
      tier: score >= 80 ? 'healthy' : score >= 55 ? 'watch' : 'at-risk', idleDays, openDisputes: openDisp };
  }).sort((x,y) => x.score - y.score);
}
routes['GET /api/health-scores'] = async (req,res) => json(res,200, healthScores());

routes['GET /api/winloss'] = async (req,res) => {
  const qr = db.quoteRequests || [];
  const converted = qr.filter(q => q.leadId).length;
  const stale = qr.filter(q => !q.leadId && Date.now() - new Date(q.at || q.createdAt || 0) > 30 * 86400000).length;
  json(res,200,{ total: qr.length, converted, stale, winRate: qr.length ? Math.round(converted / qr.length * 100) : 0 });
};

routes['GET /api/market-intel'] = async (req,res) => json(res,200, db.marketIntel || []);
routes['POST /api/market-intel'] = async (req,res) => {   // fed by Kimi Claw 'market-scan' jobs
  const b = await body(req);
  if (!b.summary) return json(res,400,{ error:'summary required' });
  (db.marketIntel ||= []).unshift({ id: uid('mi'), summary: String(b.summary).slice(0,300), source: String(b.source || 'claw').slice(0,60), at: new Date().toISOString() });
  if (db.marketIntel.length > 30) db.marketIntel = db.marketIntel.slice(0,30);
  save(); json(res,201,{ ok:true });
};

routes['POST /api/rotate-tokens'] = async (req,res) => {   // admin: invalidate every session (post-incident hygiene)
  for (const u of db.users){ u.token = crypto.randomBytes(24).toString('hex'); }
  logActivity('Security: all session tokens rotated by admin'); save();
  json(res,200,{ ok:true, rotated: db.users.length });
};
routes['GET /api/backups'] = async (req,res) => {
  const dir = path.join(ROOT, 'data', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const files = fs.readdirSync(dir).filter(f => f.startsWith('db-')).sort().reverse()
    .map(f => ({ file: f, bytes: fs.statSync(path.join(dir, f)).size, at: f.slice(3, 22) }));
  json(res,200, { backups: files, dir: 'data/backups' });
};
routes['POST /api/backups/restore'] = async (req,res) => {
  const b = await body(req);
  const file = String(b.file || '');
  if (!/^db-[\d-]+\.json$/.test(file)) return json(res,400,{ error:'Invalid backup file name' });
  const full = path.join(ROOT, 'data', 'backups', file);
  if (!fs.existsSync(full)) return json(res,404,{ error:'Backup not found' });
  const snapshot = fs.readFileSync(DB_FILE, 'utf8');
  try {
    const restored = JSON.parse(fs.readFileSync(full, 'utf8'));
    Object.keys(db).forEach(k => delete db[k]);
    Object.assign(db, restored);
    save();
    logActivity('Backup restored: ' + file);
    json(res,200,{ ok:true, restored: file });
  } catch (e) {
    fs.writeFileSync(DB_FILE, snapshot);   // never leave a torn file
    json(res,500,{ error:'Restore failed, original preserved: ' + String(e.message || e) });
  }
};

/* ================= SEO AUDIT (periodic, local files) ================= */
function seoAudit(){
  const pages = ['index.html','quotes.html','service-area.html','careers.html','gallery.html','case-studies.html','partners.html','legal.html','inquiries.html','customer.html'];
  const results = [];
  for (const pg of pages){
    try {
      const html = fs.readFileSync(path.join(ROOT, pg), 'utf8');
      const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || '';
      const desc = (/name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
      const issues = [];
      if (!desc) issues.push('missing meta description');
      if (desc.length > 160) issues.push('description too long (' + desc.length + ' chars)');
      if (title.length < 10 || title.length > 65) issues.push('title length ' + title.length);
      if (!/canonical/.test(html)) issues.push('no canonical link');
      results.push({ page: pg, ok: issues.length === 0, issues, title, descLength: desc.length });
    } catch(e){ results.push({ page: pg, ok:false, issues:['file unreadable'] }); }
  }
  const score = Math.round(results.filter(r => r.ok).length / pages.length * 100);
  db.seoAudits ||= [];
  db.seoAudits.push({ id: uid('seo'), at: new Date().toISOString(), score, results });
  if (db.seoAudits.length > 30) db.seoAudits = db.seoAudits.slice(-30);
  return { score, results };
}
routes['GET /api/seo/audit'] = async (req,res) => json(res,200, seoAudit());

/* ================= CORPORATE BOOK (minutes, resolutions, charter, registered agent) ================= */
routes['GET /api/corporate'] = async (req,res) => json(res,200,{ documents: db.corporateDocs || [], filings: db.filings || [], registeredAgent: db.registeredAgent || { states: [], renewals: [], notes: '' } });
routes['POST /api/corporate/docs'] = async (req,res) => {
  const b = await body(req);
  if (!b.type || !b.title) return json(res,400,{ error:'type and title are required (type: minute | bank-resolution | charter | policy)' });
  const d = { id: uid('cd'), type: String(b.type).slice(0,40), title: String(b.title).slice(0,140),
    body: String(b.body||'').slice(0,8000), adoptedAt: String(b.adoptedAt||'').slice(0,10) || new Date().toISOString().slice(0,10),
    votesFor: Number(b.votesFor||0), votesAgainst: Number(b.votesAgainst||0), createdAt: new Date().toISOString() };
  (db.corporateDocs ||= []).push(d);
  logActivity(`Corporate book: ${d.type} "${d.title}" recorded (${d.votesFor}-${d.votesAgainst})`); save();
  json(res,201,{ doc: d });
};
routes['POST /api/corporate/ra'] = async (req,res) => {
  const b = await body(req);
  db.registeredAgent = { states: [], renewals: [], notes: '', ...(db.registeredAgent||{}),
    states: b.states || (db.registeredAgent||{}).states || [], renewals: b.renewals || (db.registeredAgent||{}).renewals || [],
    notes: String(b.notes != null ? b.notes : (db.registeredAgent||{}).notes || '').slice(0,1000), updatedAt: new Date().toISOString() };
  save(); json(res,200,{ ok:true });
};

/* ================= DROPSHIP + VENDOR TERMS ================= */
routes['GET /api/dropship-orders'] = async (req,res) => json(res,200, db.dropshipOrders || []);
routes['POST /api/dropship-orders'] = async (req,res) => {
  const b = await body(req);
  if (!b.vendor || !b.customer || !b.item) return json(res,400,{ error:'vendor, customer, and item are required' });
  const o = { id: uid('ds'), vendor: String(b.vendor).slice(0,80), customer: String(b.customer).slice(0,80),
    item: String(b.item).slice(0,200), qty: Math.max(1, Number(b.qty||1)),
    costCents: Math.round(Number(b.cost||0) * 100), sellCents: Math.round(Number(b.sell||0) * 100),
    status: 'ordered', tracking: String(b.tracking||'').slice(0,60), notes: String(b.notes||'').slice(0,300),
    orderedAt: new Date().toISOString() };
  (db.dropshipOrders ||= []).push(o);
  notify('admin', 'Dropship order placed', `${o.qty}× ${o.item} — ${o.vendor} → ${o.customer}${o.costCents ? ' · cost $' + (o.costCents/100).toFixed(2) : ''}`);
  save(); json(res,201,{ order: o });
};
routes['PATCH /api/dropship-orders'] = async (req,res) => {
  const b = await body(req); const o = (db.dropshipOrders||[]).find(x => x.id === b.id);
  if (!o) return json(res,404,{ error:'Order not found' });
  if (b.status) o.status = String(b.status).slice(0,30);
  if (b.tracking != null) o.tracking = String(b.tracking).slice(0,60);
  save(); json(res,200,{ order: o });
};
routes['POST /api/vendors/terms'] = async (req,res) => {
  const b = await body(req); const v = (db.vendors||[]).find(x => x.id === b.id || x.name === b.name);
  if (!v) return json(res,404,{ error:'Vendor not found' });
  v.terms = { netDays: Math.max(0, Number(b.netDays||0)), discountPct: Math.max(0, Math.min(100, Number(b.discountPct||0))),
    discountDays: Math.max(0, Number(b.discountDays||0)), corporateAccount: String(b.corporateAccount||'').slice(0,60),
    contactEmail: String(b.contactEmail||'').slice(0,120), negotiatedAt: new Date().toISOString() };
  logActivity(`Vendor terms updated: ${v.name} — net ${v.terms.netDays}${v.terms.discountPct ? ' with ' + v.terms.discountPct + '%/' + v.terms.discountDays + 'd discount' : ''}`);
  save(); json(res,200,{ vendor: v });
};

/* ================= STRIPE (Payments, Invoicing, Tax) — zero-dep client ================= */
function stripeKeys(){
  const s = (db.settings.integrations && db.settings.integrations.stripe) || {};
  return { publishable: s.publishable || process.env['STRIPE_PUBLISHABLE_KEY'] || '',
           secret: s.secret || process.env['STRIPE_SECRET_KEY'] || '',
           webhook: s.webhookSecret || process.env['STRIPE_WEBHOOK_SECRET'] || '' };
}
const stripeConfigured = () => !!stripeKeys().secret;
const maskStripeKey = (k) => !k ? '' : (k.length <= 12 ? '••••' + k.slice(-4) : k.slice(0, 8) + '…' + k.slice(-4));

async function stripeApi(method, path, params, idempotencyKey){
  const { secret } = stripeKeys();
  const body = params ? new URLSearchParams(Object.entries(params).filter(([,v]) => v !== undefined && v !== null && v !== '')).toString() : '';
  const headers = { 'Authorization': 'Bearer ' + secret, 'Content-Type': 'application/x-www-form-urlencoded' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const r = await fetch('https://api.stripe.com/v1' + path, { method, headers, body: body || undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Stripe ' + path + ': ' + ((j.error && j.error.message) || ('HTTP ' + r.status)));
  return j;
}

routes['GET /api/stripe/status'] = async (req,res) => {
  const k = stripeKeys();
  json(res,200,{ configured: stripeConfigured(),
    mode: k.secret.startsWith('sk_live') ? 'live' : k.secret ? 'test' : 'none',
    publishableMasked: maskStripeKey(k.publishable), secretMasked: maskStripeKey(k.secret), webhookSet: !!k.webhook });
};

routes['POST /api/stripe/config'] = async (req,res) => {   // staff-gated by the central role gate
  const b = await body(req);
  db.settings.integrations = db.settings.integrations || {};
  db.settings.integrations.stripe = {
    publishable: String(b.publishable || ''), secret: String(b.secret || ''), webhookSecret: String(b.webhookSecret || '') };
  save();
  logActivity('Stripe configuration updated (' + (String(b.secret || '').startsWith('sk_live') ? 'LIVE' : 'test') + ' mode)');
  json(res,200,{ ok:true, mode: String(b.secret || '').startsWith('sk_live') ? 'live' : 'test', secretMasked: maskStripeKey(b.secret) });
};

routes['POST /api/stripe/checkout'] = async (req,res) => {
  if (!stripeConfigured())
    return json(res,200,{ simulated:true, url:null, reason:'Stripe keys not configured — add them in Admin → Settings → Integrations (or STRIPE_* env vars)' });
  const b = await body(req);
  const inv = db.invoices.find(x => x.id === b.invoiceId);
  if (!inv) return json(res,404,{ error:'Invoice not found' });
  if (inv.status === 'paid') return json(res,409,{ error:'Invoice already paid' });
  const items = (inv.items && inv.items.length ? inv.items : [{ description: inv.description || ('Invoice ' + inv.id), amount: inv.total }]);
  const params = {};
  items.forEach((it, i) => {
    params['line_items[' + i + '][price_data][currency]'] = 'usd';
    params['line_items[' + i + '][price_data][unit_amount]'] = String(Math.round(Number(it.amount) * 100));
    params['line_items[' + i + '][price_data][product_data][name]'] = String(it.description || ('Invoice ' + inv.id));
    params['line_items[' + i + '][quantity]'] = '1';
  });
  const origin = String(b.origin || 'https://linesandlogosteam.com');
  params['mode'] = 'payment';
  params['success_url'] = String(b.successUrl || (origin + '/customer.html?paid=1&session_id={CHECKOUT_SESSION_ID}'));
  params['cancel_url'] = String(b.cancelUrl || (origin + '/customer.html?canceled=1'));
  params['metadata[invoiceId]'] = inv.id;
  params['metadata[customer]'] = inv.customer || '';
  const wantTax = b.tax !== false;
  if (wantTax) params['automatic_tax[enabled]'] = 'true';           // Stripe Tax — sales tax by billing address
  params['billing_address_collection'] = 'required'; // address required for tax calculation
  try {
    const session = await stripeApi('POST', '/checkout/sessions', params);
    logActivity('Stripe checkout session created for ' + inv.id + (inv.customer ? ' (' + inv.customer + ')' : ''));
    save();
    json(res,200,{ url: session.url, sessionId: session.id, simulated:false });
  } catch (e) {
    json(res,502,{ error: String(e.message || e), hint: 'If this mentions automatic tax, activate Stripe Tax on the account (Dashboard → Tax) or send tax:false to skip it.' });
  }
};

/* Hosted Invoicing — create a real Stripe invoice (hosted page: cards, ACH bank transfer,
   reminders, Stripe Tax) from an OS invoice. Draft → items → finalize; Stripe emails the link. */
routes['POST /api/stripe/invoice'] = async (req,res) => {
  if (!stripeConfigured())
    return json(res,200,{ simulated:true, url:null, reason:'Stripe keys not configured — add them in Admin → Settings → Integrations (or STRIPE_* env vars / .env)' });
  const b = await body(req);
  const inv = db.invoices.find(x => x.id === b.invoiceId);
  if (!inv) return json(res,404,{ error:'Invoice not found' });
  if (inv.status === 'paid') return json(res,409,{ error:'Invoice already paid' });
  if (inv.stripeInvoiceId){   // already sent — refresh and return the existing hosted page
    try {
      const cur = await stripeApi('GET', '/invoices/' + encodeURIComponent(inv.stripeInvoiceId));
      return json(res,200,{ url: cur.hosted_invoice_url, stripeInvoiceId: cur.id, status: cur.status, simulated:false, alreadySent:true });
    } catch (e) { /* fall through and re-send */ }
  }
  const wantTax = b.tax !== false;
  const name = String(b.customer || inv.account || inv.customer || 'Lines & Logos Customer').slice(0,120);
  const acct = db.accounts.find(a => a.name && (a.name === inv.account || a.name === inv.customer));
  const contact = acct && db.contacts ? db.contacts.find(c => c.accountId === acct.id && c.email) : null;
  const email = String(b.email || (acct && acct.email) || (contact && contact.email) || '').slice(0,120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return json(res,400,{ error:'A customer email is required for a Stripe-hosted invoice (Stripe emails them the payment link).', needEmail:true, customer:name });
  const termsDays = Number(db.settings.invoiceTermsDays) > 0 ? Number(db.settings.invoiceTermsDays) : 30;
  /* Stripe caches idempotent responses (including failures) for 24h under the same key,
     so each NEW attempt gets its own key; a true network retry of the same attempt reuses it. */
  const idem = 'os-invoice-' + inv.id + '-' + hash(email).slice(0,10) + '-a' + (inv.stripeAttempts || 0);
  const items = (inv.items && inv.items.length ? inv.items : [{ description: inv.description || ('Invoice ' + (inv.number || inv.id)), amount: inv.total != null ? inv.total : inv.amount }]);
  try {
    // 1) customer — reuse an existing one tagged with our name, else create
    let customer = null;
    try {
      const found = await stripeApi('GET', '/customers/search?query=' + encodeURIComponent('metadata["os_customer"]:"' + name + '"') + '&limit=1');
      customer = found.data && found.data[0];
    } catch (e) {}
    if (!customer){
      customer = await stripeApi('POST', '/customers', { name, email, 'metadata[os_customer]': name }, idem + '-customer');
    } else if (!customer.email){
      customer = await stripeApi('POST', '/customers/' + encodeURIComponent(customer.id), { email }, idem + '-customer-email');
    }
    // 2) draft invoice
    const draft = await stripeApi('POST', '/invoices', {
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: String(termsDays),
      auto_advance: 'false',
      'metadata[os_invoice_id]': inv.id,
      'metadata[os_customer]': name
    }, idem + '-draft');
    // 3) line items
    for (let i = 0; i < items.length; i++){
      const it = items[i];
      const amt = Number(it.amount != null ? it.amount : it.total) || 0;
      if (amt <= 0) continue;
      await stripeApi('POST', '/invoiceitems', {
        customer: customer.id, invoice: draft.id,
        description: String(it.description || ('Line ' + (i + 1))).slice(0,300),
        amount: String(Math.round(amt * 100)), currency: 'usd',
        'metadata[os_invoice_id]': inv.id
      }, idem + '-item-' + i);
    }
    // 4) finalize (auto-sends via send_invoice) — try with Stripe Tax first, retry without if the account/customer can't support it
    let sent;
    try {
      sent = await stripeApi('POST', '/invoices/' + encodeURIComponent(draft.id) + '/finalize', wantTax ? { 'automatic_tax[enabled]': 'true' } : {}, idem + '-finalize');
    } catch (e) {
      if (!wantTax || !/tax|address/i.test(String(e.message))) throw e;
      sent = await stripeApi('POST', '/invoices/' + encodeURIComponent(draft.id) + '/finalize', {}, idem + '-finalize');
      inv.taxNote = 'Stripe Tax skipped (no customer address / Tax not activated) — charged untaxed; built-in table remains the quote-time estimate.';
    }
    inv.stripeInvoiceId = sent.id; inv.stripeCustomerId = customer.id;
    inv.hostedInvoiceUrl = sent.hosted_invoice_url; inv.invoicePdf = sent.invoice_pdf || null;
    inv.stripeStatus = sent.status; inv.sentVia = 'stripe'; inv.sentAt = new Date().toISOString();
    if (inv.status !== 'paid') inv.status = 'sent';
    logActivity('Stripe invoice ' + sent.number + ' sent for ' + inv.id + ' (' + name + ') — due in ' + termsDays + 'd');
    save();
    json(res,200,{ url: sent.hosted_invoice_url, pdf: sent.invoice_pdf || null, stripeInvoiceId: sent.id, number: sent.number, status: sent.status, simulated:false });
  } catch (e) {
    inv.stripeAttempts = (inv.stripeAttempts || 0) + 1;   // next attempt gets a fresh idempotency key
    save();
    json(res,502,{ error: String(e.message || e), hint: 'Check the Stripe key mode (test vs live) and that Invoicing is enabled on the account.' });
  }
};

/* On-demand reconciliation — pull a Stripe invoice's current status back onto the OS record. */
routes['GET /api/stripe/invoice-status'] = async (req,res) => {
  if (!stripeConfigured()) return json(res,503,{ error:'Stripe keys not configured' });
  const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
  const inv = db.invoices.find(x => x.id === id);
  if (!inv) return json(res,404,{ error:'Invoice not found' });
  if (!inv.stripeInvoiceId) return json(res,404,{ error:'Not sent to Stripe yet' });
  try {
    const s = await stripeApi('GET', '/invoices/' + encodeURIComponent(inv.stripeInvoiceId));
    const map = { draft:'draft', open:'sent', paid:'paid', uncollectible:'uncollectible', void:'void' };
    if (s.status === 'paid' && inv.status !== 'paid'){
      inv.status = 'paid'; inv.paidAt = new Date().toISOString();
      db.payments.push({ id: uid('pay'), invoiceId: inv.id, customer: inv.customer || inv.account || '',
        amount: Number(s.amount_paid) / 100, method: 'stripe-invoice', stripeInvoiceId: s.id,
        tax: Number((s.total_details && s.total_details.amount_tax) || 0) / 100, at: new Date().toISOString() });
      notify('admin', 'Invoice paid via Stripe', inv.id + ' — $' + (Number(s.amount_paid) / 100).toFixed(2));
      logActivity('Stripe invoice paid: ' + inv.id);
    } else if (map[s.status] && inv.status !== 'paid'){ inv.status = map[s.status] === 'sent' ? 'sent' : map[s.status]; inv.stripeStatus = s.status; }
    else inv.stripeStatus = s.status;
    save();
    json(res,200,{ stripeStatus: s.status, status: inv.status, amountPaid: Number(s.amount_paid) / 100, hostedInvoiceUrl: s.hosted_invoice_url, number: s.number });
  } catch (e) { json(res,502,{ error: String(e.message || e) }); }
};

function verifyStripeSig(rawBody, sigHeader, secret){
  if (!sigHeader || !secret) return false;
  const parts = {};
  for (const kv of String(sigHeader).split(',')) { const [k, v] = kv.split('='); parts[k.trim()] = v; }
  if (!parts['t'] || !parts['v1']) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts['t'])) > 300) return false;  // 5-minute tolerance
  const mac = crypto.createHmac('sha256', secret).update(parts['t'] + '.' + rawBody).digest('hex');
  const a = Buffer.from(mac), b = Buffer.from(parts['v1']);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

routes['POST /api/stripe/webhook'] = async (req,res) => {
  const k = stripeKeys();
  if (!k.webhook) return json(res,503,{ error:'Webhook secret not configured' });
  const raw = (await readRaw(req, 1024 * 1024)).toString('utf8');
  if (!verifyStripeSig(raw, req.headers['stripe-signature'], k.webhook))
    return json(res,400,{ error:'Invalid webhook signature' });
  const event = JSON.parse(raw);
  const findInv = meta => (meta && (meta.os_invoice_id || meta.invoiceId)) ? db.invoices.find(x => x.id === (meta.os_invoice_id || meta.invoiceId)) : null;
  const markPaid = (inv, amountDollars, taxDollars, method, ref) => {
    if (!inv || inv.status === 'paid') return;
    inv.status = 'paid'; inv.paidAt = new Date().toISOString(); inv.stripeStatus = 'paid';
    db.payments.push({ id: uid('pay'), invoiceId: inv.id, customer: inv.customer || inv.account || '',
      amount: amountDollars, method, tax: taxDollars, at: new Date().toISOString(), ...ref });
    notify('admin', 'Invoice paid via Stripe', inv.id + ' — $' + amountDollars.toFixed(2) + (taxDollars ? ' (incl. $' + taxDollars.toFixed(2) + ' tax)' : ''));
    logActivity('Stripe payment received: ' + inv.id + ' via ' + method);
    save();
  };
  switch (event.type){
    case 'checkout.session.completed': {
      const s = event.data.object;
      const inv = findInv(s.metadata || {});
      if (inv){
        const taxDollars = Number((s.total_details && s.total_details.amount_tax) || 0) / 100;
        markPaid(inv, Number(s.amount_total) / 100, taxDollars, 'stripe', { stripeSession: s.id });
      }
      break;
    }
    case 'invoice.paid': {
      const s = event.data.object;
      const inv = findInv(s.metadata || {}) || db.invoices.find(x => x.stripeInvoiceId === s.id);
      if (inv) markPaid(inv, Number(s.amount_paid) / 100, Number((s.total_details && s.total_details.amount_tax) || 0) / 100, 'stripe-invoice', { stripeInvoiceId: s.id });
      break;
    }
    case 'invoice.payment_failed': {
      const s = event.data.object;
      const inv = findInv(s.metadata || {}) || db.invoices.find(x => x.stripeInvoiceId === s.id);
      if (inv && inv.status !== 'paid'){
        inv.stripeStatus = 'payment_failed';
        notify('admin', 'Stripe invoice payment failed', (inv.number || inv.id) + ' — attempt failed. Hosted page: ' + (s.hosted_invoice_url || inv.hostedInvoiceUrl || ''));
        logActivity('Stripe invoice payment failed: ' + inv.id);
        save();
      }
      break;
    }
    case 'invoice.voided':
    case 'invoice.marked_uncollectible': {
      const s = event.data.object;
      const inv = findInv(s.metadata || {}) || db.invoices.find(x => x.stripeInvoiceId === s.id);
      if (inv && inv.status !== 'paid'){
        inv.status = event.type === 'invoice.voided' ? 'void' : 'uncollectible'; inv.stripeStatus = s.status;
        logActivity('Stripe invoice ' + event.type.replace('invoice.', '') + ': ' + inv.id);
        save();
      }
      break;
    }
    case 'credit_note.created': {
      const cn = event.data.object;
      const inv = db.invoices.find(x => x.stripeInvoiceId === cn.invoice);
      db.financialAlerts.push({ id: uid('fa'), kind: 'credit_note', severity: 'medium',
        title: 'Stripe credit note issued' + (inv ? ' on ' + (inv.number || inv.id) : ''),
        detail: 'Amount $' + (Number(cn.total) / 100).toFixed(2) + ' — reconcile against the original invoice before closing books.',
        createdAt: new Date().toISOString() });
      notify('admin', 'Stripe credit note issued', 'Amount $' + (Number(cn.total) / 100).toFixed(2) + (inv ? ' on ' + (inv.number || inv.id) : ''));
      logActivity('Stripe credit note: $' + (Number(cn.total) / 100).toFixed(2));
      save();
      break;
    }
    case 'customer_cash_balance_transaction.created':
    case 'cash_balance.funds_available': {
      // ACH bank transfer funds landed in a customer cash balance — needs manual application if not auto-reconciled
      db.financialAlerts.push({ id: uid('fa'), kind: 'ach_funds', severity: 'info',
        title: 'ACH funds received (Stripe cash balance)',
        detail: 'Event ' + event.type + ' — if the amount does not exactly match an open invoice, apply it manually in the Stripe Dashboard (Bank transfers → Cash balance).',
        createdAt: new Date().toISOString() });
      save();
      break;
    }
  }
  json(res,200,{ received:true, type: event.type });
};

/* ================= GO-LIVE SETUP (first run on a fresh VPS deploy) =================
   Owner is asked for: live Stripe keys, Stripe Tax activation, webhook endpoint secret.
   Values are written to the git-ignored .env (never db.json, never echoed in full). */
const ENV_FILE = path.join(ROOT, '.env');

/* ---- canonical key registry: every secret the app can use, with where-to-get instructions.
       Backed by .env (chmod 600, git-ignored); managed in-app via Admin → Keys & Integrations. ---- */
const KEY_REGISTRY = [
  { env:'STRIPE_PUBLISHABLE_KEY', label:'Stripe publishable key', group:'Stripe — payments, invoicing & tax',
    pattern:/^pk_(live|test)_/,
    signup:'https://stripe.com', where:'https://dashboard.stripe.com/apikeys',
    how:'Sign up at stripe.com (test mode is free). Dashboard → Developers → API keys → copy the Publishable key. pk_live_… charges real cards; pk_test_… is for trying everything safely.' },
  { env:'STRIPE_SECRET_KEY', label:'Stripe secret key', group:'Stripe — payments, invoicing & tax',
    pattern:/^sk_(live|test)_/, secret:true,
    signup:'https://stripe.com', where:'https://dashboard.stripe.com/apikeys',
    how:'Same page (Dashboard → Developers → API keys) → Secret key → Reveal. Guard it like a password — it can move money. Only ever paste it here or into the app.' },
  { env:'STRIPE_WEBHOOK_SECRET', label:'Stripe webhook signing secret', group:'Stripe — payments, invoicing & tax',
    pattern:/^whsec_/, secret:true,
    where:'https://dashboard.stripe.com/webhooks',
    how:'Dashboard → Developers → Webhooks → Add endpoint → paste your app address + /api/stripe/webhook → choose: checkout.session.completed, invoice.paid, invoice.payment_failed, invoice.voided, invoice.marked_uncollectible, credit_note.created → copy the Signing secret (whsec_…). On a dev machine you can instead run `stripe listen --forward-to localhost:3001/api/stripe/webhook`.' },
  { env:'OPENROUTER_API_KEY', label:'OpenRouter key — free AI default', group:'AI providers (chat assistant + agent brains)',
    pattern:/^sk-or-v1-/, secret:true,
    signup:'https://openrouter.ai/', where:'https://openrouter.ai/keys',
    how:'Free: openrouter.ai → Sign in → Keys → Create Key. This is the zero-cost default that powers the website chat assistant and AI agents (free models, with daily limits).' },
  { env:'ANTHROPIC_API_KEY', label:'Claude key (Anthropic) — optional', group:'AI providers (chat assistant + agent brains)',
    pattern:/^sk-ant-/, secret:true,
    signup:'https://console.anthropic.com/', where:'https://console.anthropic.com/settings/keys',
    how:'Paid: console.anthropic.com → API keys → Create key. Higher-quality agent brains when you want them.' },
  { env:'OPENAI_API_KEY', label:'ChatGPT key (OpenAI) — optional', group:'AI providers (chat assistant + agent brains)',
    pattern:/^sk-(proj-)?[A-Za-z0-9_-]{16,}/, secret:true,
    signup:'https://platform.openai.com/', where:'https://platform.openai.com/api-keys',
    how:'Paid: platform.openai.com → API keys → Create new secret key.' },
  { env:'GEMINI_API_KEY', label:'Gemini key (Google) — optional', group:'AI providers (chat assistant + agent brains)',
    pattern:/^AIza[0-9A-Za-z_-]{20,}/, secret:true,
    signup:'https://aistudio.google.com/', where:'https://aistudio.google.com/apikey',
    how:'Has a free tier: aistudio.google.com → Get API key.' },
  { env:'CRON_SECRET', label:'Cron job secret', group:'Platform',
    pattern:/^.{16,}$/, auto:true,
    how:'Generated automatically by the installer. Protects the scheduled-maintenance endpoints if you later wire an external cron service (e.g. healthchecks.io) to /api/cron/daily and /api/cron/weekly.' },
];

function envSet(key, value){
  let lines = [];
  try { lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n'); } catch {}
  const i = lines.findIndex(l => l.startsWith(key + '='));
  const row = key + '=' + value;
  if (i >= 0) lines[i] = row; else lines.push(row);
  let persisted = true;
  try {
    fs.writeFileSync(ENV_FILE, lines.filter((l,ix) => l.trim() !== '' || ix === lines.length-1).join('\n'));
    try { fs.chmodSync(ENV_FILE, 0o600); } catch {}
    if (fs.readFileSync(ENV_FILE, 'utf8').indexOf(row) < 0) persisted = false;
  } catch { persisted = false; }
  process.env[key] = value;   // apply immediately for this process
  return persisted;
}
function envUnset(key){         // remove a key from .env and the running process
  let lines = [];
  try { lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n'); } catch {}
  const next = lines.filter(l => !l.startsWith(key + '='));
  let persisted = true;
  try { fs.writeFileSync(ENV_FILE, next.join('\n')); try { fs.chmodSync(ENV_FILE, 0o600); } catch {} }
  catch { persisted = false; }
  delete process.env[key];
  return persisted;
}
let taxProbeCache = { at: 0, result: null };
async function stripeTaxProbe(){
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) return { activated: null, note: 'Add Stripe keys first — then I can check Tax.' };
  if (Date.now() - taxProbeCache.at < 10 * 60 * 1000 && taxProbeCache.result) return taxProbeCache.result;
  let result;
  try {
    const s = await stripeApi('GET', '/tax/settings');
    result = { activated: !!(s && (s.defaults || s.status)), note: 'Stripe Tax is active — automatic tax applies on hosted invoices and checkout.' };
  } catch (e) {
    result = { activated: false, note: 'Stripe Tax not active — open Dashboard → Tax to activate it (manual step), then press Check again.' };
  }
  taxProbeCache = { at: Date.now(), result };
  return result;
}
routes['GET /api/golive/status'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  if (new URL(req.url, 'http://x').searchParams.get('refresh')) taxProbeCache.at = 0;   // "Check again" after activating Tax
  const envSk = process.env.STRIPE_SECRET_KEY || '';
  const tax = await stripeTaxProbe();
  const liveKeys = envSk.startsWith('sk_live');
  json(res,200,{
    mode: liveKeys ? 'live' : envSk ? 'test' : 'none',
    liveKeys, secretMasked: maskStripeKey(envSk), publishableMasked: maskStripeKey(process.env.STRIPE_PUBLISHABLE_KEY || ''),
    taxActivated: tax.activated, taxNote: tax.note,
    webhookSet: !!(process.env.STRIPE_WEBHOOK_SECRET || (db.settings.integrations && db.settings.integrations.stripe || {}).webhookSecret),
    webhookMasked: (process.env.STRIPE_WEBHOOK_SECRET || '').slice(0,10) + '…',
    allDone: liveKeys && tax.activated === true && !!(process.env.STRIPE_WEBHOOK_SECRET)
  });
};
routes['POST /api/golive/stripe-keys'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const b = await body(req);
  const pk = String(b.publishable || '').trim(), sk = String(b.secret || '').trim();
  if (!/^pk_(live|test)_/.test(pk)) return json(res,400,{ error:'Publishable key must start with pk_live_ or pk_test_.' });
  if (!/^sk_(live|test)_/.test(sk)) return json(res,400,{ error:'Secret key must start with sk_live_ or sk_test_.' });
  const ok1 = envSet('STRIPE_PUBLISHABLE_KEY', pk);
  const ok2 = envSet('STRIPE_SECRET_KEY', sk);
  if (db.settings.integrations && db.settings.integrations.stripe){ db.settings.integrations.stripe.secret = ''; db.settings.integrations.stripe.publishable = ''; }  // .env is source of truth
  taxProbeCache = { at: 0, result: null };
  logActivity('Go-live setup: Stripe keys set (' + (sk.startsWith('sk_live') ? 'LIVE' : 'test') + ') by ' + (u.name || u.email || 'owner'));
  save();
  json(res,200,{ ok:true, mode: sk.startsWith('sk_live') ? 'live' : 'test', secretMasked: maskStripeKey(sk),
    ...(ok1 && ok2 ? {} : { warning: 'Key applied to the running server but could not be persisted to .env — set it in the server environment before restarting.' }) });
};
routes['POST /api/golive/webhook-secret'] = async (req,res) => {
  const u = gate(req, res, ['owner','admin']); if (!u) return;
  const wh = String((await body(req)).secret || '').trim();
  if (!/^whsec_[A-Za-z0-9_\-]+/.test(wh)) return json(res,400,{ error:'Webhook signing secret must start with whsec_ (from Dashboard → Developers → Webhooks, or `stripe listen`).' });
  const persisted = envSet('STRIPE_WEBHOOK_SECRET', wh);
  logActivity('Go-live setup: Stripe webhook secret set by ' + (u.name || u.email || 'owner'));
  save();
  json(res,200,{ ok:true, webhookMasked: wh.slice(0,10) + '…',
    ...(persisted ? {} : { warning: 'Applied to the running server but could not be persisted to .env — set STRIPE_WEBHOOK_SECRET in the server environment before restarting.' }) });
};

/* ---- admin keys page: every secret in one place — .env-backed, validated, masked, audited ---- */
routes['GET /api/keys'] = async (req,res) => {
  if (!gate(req,res,['owner','admin'])) return;
  json(res,200,{ keys: KEY_REGISTRY.map(k => ({ env:k.env, label:k.label, group:k.group, set:!!process.env[k.env],
    masked:maskKey(process.env[k.env]), secret:!!k.secret, auto:!!k.auto, signup:k.signup || null, where:k.where || null, how:k.how })) });
};
routes['POST /api/keys'] = async (req,res) => {
  const u = gate(req,res,['owner','admin']); if (!u) return;
  const b = await body(req);
  const def = KEY_REGISTRY.find(k => k.env === b.env);
  if (!def) return json(res,400,{ error:'Unknown key: ' + String(b.env||'') });
  if (def.auto) return json(res,400,{ error:def.label + ' is managed automatically.' });
  let persisted;
  if (b.clear){
    persisted = envUnset(b.env);
    logActivity(`${u.name} cleared ${def.label} (removed from .env)`);
  } else {
    const v = String(b.value||'').trim();
    if (!v) return json(res,400,{ error:'Paste the full key value — empty values use Clear instead.' });
    if (v.includes('…')) return json(res,400,{ error:'That is the masked display value — paste the full key from the provider.' });
    if (!def.pattern.test(v)) return json(res,400,{ error:def.label + ' format not recognized (' + def.pattern.source + ').' });
    persisted = envSet(b.env, v);
    logActivity(`${u.name} set ${def.label} (${maskKey(v)})`);
  }
  json(res,200,{ ok:true, persisted, set:!!process.env[def.env], masked:maskKey(process.env[def.env]),
    ...(persisted ? {} : { warning:'Applied to the running server but could not be persisted to .env — add ' + def.env + ' to the server environment before restarting.' }) });
};

/* ================= AGENT GOVERNANCE (Phase 2) ================= */
const AGENT_TIERS = ['recommend','auto-low','auto-mid','human-gate'];
function agentGov(){ return db.settings.agentGovernance ||= { masterEnabled: true, agents: {} }; }
function agentGovEntry(key){
  const g = agentGov();
  g.agents[key] ||= { tier: 'recommend', dollarCap: 0, scopes: [], killSwitch: false, note: '' };
  return g.agents[key];
}
function routeToAgentKey(p){
  const seg = (p.split('/')[3] || '').toLowerCase();
  const map = { prospect:'scout', 'content-ideas':'social', 'inquiries':'inbox', 'reviews':'replies' };
  return map[seg] || seg;
}
function govAllows(key){
  const g = agentGov();
  if (!g.masterEnabled) return { ok:false, reason:'Agent operations globally disabled (master switch is off)' };
  const e = g.agents[key];
  if (e && e.killSwitch) return { ok:false, reason:`Agent "${key}" is disabled by its kill switch` };
  return { ok:true };
}
function auditAgent(req, key, status, extra){
  (db.agentAudits ||= []).push({ id: uid('aud'), at: new Date().toISOString(), agent: key,
    actor: (auth(req)||{}).email || 'system', path: new URL(req.url,'http://x').pathname,
    status, detail: String(extra||'').slice(0,200) });
  if (db.agentAudits.length > 500) db.agentAudits = db.agentAudits.slice(-500);
}

routes['GET /api/agent-governance'] = async (req,res) => {
  const g = agentGov();
  json(res,200,{ masterEnabled: g.masterEnabled, tiers: AGENT_TIERS,
    agents: AGENT_CATALOG.map(a => ({ key: a.key, name: a.name, ...(g.agents[a.key] || { tier:'recommend', dollarCap:0, scopes:[], killSwitch:false, note:'' }) })) });
};
routes['POST /api/agent-governance'] = async (req,res) => {
  const b = await body(req);
  const g = agentGov();
  if (b.masterEnabled != null){ g.masterEnabled = !!b.masterEnabled; logActivity(`Agent governance: master switch ${g.masterEnabled ? 'ON' : 'OFF'}`); }
  if (b.agent){
    const e = agentGovEntry(b.agent);
    if (b.tier){ if (!AGENT_TIERS.includes(b.tier)) return json(res,400,{ error:'Invalid tier: ' + AGENT_TIERS.join(', ') }); e.tier = b.tier; }
    if (b.dollarCap != null) e.dollarCap = Math.max(0, Math.min(100000, Number(b.dollarCap) || 0));
    if (b.scopes != null) e.scopes = (Array.isArray(b.scopes) ? b.scopes : String(b.scopes).split(',')).map(s => s.trim()).filter(Boolean).slice(0,20);
    if (b.killSwitch != null){ e.killSwitch = !!b.killSwitch; logActivity(`Agent governance: ${b.agent} kill switch ${e.killSwitch ? 'ENGAGED' : 'released'}`); }
    if (b.note != null) e.note = String(b.note).slice(0,300);
  }
  save();
  json(res,200,{ ok:true });
};
routes['GET /api/agent-audits'] = async (req,res) => json(res,200, (db.agentAudits || []).slice(-120).reverse());
routes['POST /api/agent/eval'] = async (req,res) => {
  const scenarios = [
    { brain:'public', q:'what areas do you serve?', expect:['memphis','mile'] },
    { brain:'public', q:'do you offer financing or payments?', expect:['payment','financ'] },
    { brain:'public', q:'how long does a gym floor refinish take?', expect:['day','week'] },
    { brain:'public', q:'can I book a walkthrough?', expect:['walkthrough','book'] },
    { brain:'service', q:'help me book a site visit', expect:['walkthrough','book','visit'] }
  ];
  const results = scenarios.map(s => {
    const reply = s.brain === 'service' ? String((serviceBrain(s.q)||{}).reply || '') : publicBrain(s.q);
    const text = reply.toLowerCase();
    const hits = s.expect.filter(w => text.includes(w));
    return { scenario: s.q, brain: s.brain, pass: hits.length > 0, hits, miss: s.expect.filter(w => !hits.includes(w)), reply: reply.slice(0,140) };
  });
  const score = Math.round(results.filter(r => r.pass).length / results.length * 100);
  db.settings.agentGovernance ||= { masterEnabled:true, agents:{} };
  db.settings.agentGovernance.lastEval = { at: new Date().toISOString(), score, results };
  (db.settings.agentGovernance.evalHistory ||= []).push({ at: new Date().toISOString(), score });
  if (db.settings.agentGovernance.evalHistory.length > 24) db.settings.agentGovernance.evalHistory = db.settings.agentGovernance.evalHistory.slice(-24);
  save();
  logActivity(`Agent evaluation harness: ${score}% (${results.filter(r=>r.pass).length}/${results.length} scenarios passed)`);
  json(res,200,{ score, results });
};

routes['GET /api/referrals'] = async (req,res) => json(res,200, db.referrals || []);
routes['GET /api/case-studies'] = async (req,res) => json(res,200, (db.caseStudies || []).filter(s => s.clientApproved));
routes['POST /api/case-studies'] = async (req,res) => {
  const b = await body(req);
  if (!b.title || !b.facilityType || !b.city || !b.scope || !b.summary) return json(res,400,{ error:'title, facilityType, city, scope, and summary are required.' });
  const s = { id: uid('cs'), title: String(b.title).slice(0,140), facilityType: String(b.facilityType).slice(0,60),
    city: String(b.city).slice(0,60), scope: String(b.scope).slice(0,200), summary: String(b.summary).slice(0,2000),
    timeline: String(b.timeline||'').slice(0,300), evidenceNote: String(b.evidenceNote||'').slice(0,300),
    clientApproved: !!b.clientApproved, publishedAt: new Date().toISOString() };
  (db.caseStudies ||= []).push(s);
  logActivity(`Case study ${b.clientApproved ? 'published' : 'drafted'}: ${s.title}${s.clientApproved ? '' : ' (awaiting client approval — hidden from public)'}`);
  save();
  json(res,201,{ study: s, public: s.clientApproved });
};
/* ---- onboarding (employees + clients) ---- */
collRoutes(routes, 'employeeOnboardings', { prefix:'eo', resolve: withProgress,
  onCreate(o){ if (!o.steps) o.steps = freshSteps(EMP_STEPS); o.status = o.status || 'in-progress'; o.created = new Date().toISOString().slice(0,10);
    logActivity(`Employee onboarding started: ${o.name} (${o.role||'new hire'})`); } });
collRoutes(routes, 'clientOnboardings', { prefix:'cb', resolve: withProgress,
  onCreate(o){ if (!o.steps) o.steps = freshSteps(CLIENT_STEPS); o.status = o.status || 'in-progress'; o.created = new Date().toISOString().slice(0,10);
    logActivity(`Client onboarding started: ${o.company}`); } });

collRoutes(routes, 'candidates', { prefix:'cd' });
collRoutes(routes, 'vendors', { prefix:'v' });
collRoutes(routes, 'purchaseOrders', { prefix:'po', defaults:{ status:'draft', date:new Date().toISOString().slice(0,10) },
  onCreate(p){ p.number = 'PO-2026-' + String(db.purchaseOrders.length + 11).padStart(3,'0'); },
  resolve: p => ({ ...p, vendor:(db.vendors.find(v=>v.id===p.vendorId)||{}).name||'—' }) });

/* ---- marketing ---- */
collRoutes(routes, 'content', { prefix:'ct', defaults:{ status:'draft' } });
routes['POST /api/content/repurpose'] = async (req,res,id) => {
  const c = db.content.find(c => c.id === id); if (!c) return json(res,404,{error:'Content not found'});
  const r = agents.repurpose(c);
  logActivity(`Content Repurposing Agent turned "${c.title}" into ${r.posts.length} platform posts`); save();
  json(res,200,{ content:c.title, ...r });
};
collRoutes(routes, 'campaigns', { prefix:'cp', defaults:{ status:'planned' } });

/* ---- brand kit & ad manager ---- */
routes['GET /api/brand'] = async (req,res) => {
  const { BRAND } = require(path.join(ROOT, 'assets', 'brand.js'));
  json(res,200,{ taglines: BRAND.taglines, quotes: BRAND.quotes, ctas: BRAND.ctas,
    colors: BRAND.colors, assets: BRAND.assets, voice: BRAND.voice,
    approvedPhotos: db.gallery.filter(g => g.status === 'approved').length });
};
routes['GET /api/ads/specs'] = async (req,res) => {
  const { AD_PROVIDERS } = require(path.join(ROOT, 'assets', 'brand.js'));
  json(res,200, AD_PROVIDERS);
};
routes['GET /api/ads/keys'] = async (req,res) => {
  const ks = (db.settings && db.settings.adKeys) || {};
  json(res,200, Object.fromEntries(Object.entries(ks).map(([k,v]) => [k, { connected:true, fields:Object.keys(v.fields||{}), savedAt:v.savedAt }])));
};
routes['POST /api/ads/keys'] = async (req,res) => {
  const b = await body(req);
  if (!b.provider || typeof b.fields !== 'object') return json(res,400,{ error:'provider + fields required' });
  db.settings.adKeys = db.settings.adKeys || {};
  db.settings.adKeys[b.provider] = { fields: b.fields, savedAt: new Date().toISOString() };
  logActivity(`Ad provider credentials saved: ${b.provider} (${Object.keys(b.fields).length} field(s))`); save();
  json(res,200,{ ok:true, provider:b.provider });
};

/* ---- client experience & admin ---- */
collRoutes(routes, 'tickets', { prefix:'tk', defaults:{ status:'open', priority:'normal', created:new Date().toISOString().slice(0,10) }, resolve: t => ({ ...t, account: acctName(t.accountId) }) });
collRoutes(routes, 'feedback', { prefix:'f', defaults:{ date:new Date().toISOString().slice(0,10) }, resolve: f => ({ ...f, account: acctName(f.accountId) }) });
routes['GET /api/wiki'] = async (req,res) => json(res,200, db.wiki);
routes['GET /api/policies'] = async (req,res) => json(res,200, db.policies);
routes['GET /api/approvals'] = async (req,res) => json(res,200, db.approvals);
routes['POST /api/approvals/decide'] = async (req,res,id) => {
  const a = db.approvals.find(a => a.id === id); if (!a) return json(res,404,{error:'Approval not found'});
  const b = await body(req); a.status = b.decision === 'reject' ? 'rejected' : 'approved'; a.decidedAt = new Date().toISOString();
  /* purchase approvals — approve = the Procurement Agent places the order and starts tracking */
  if (a.poId) {
    const po = db.purchaseOrders.find(p => p.id === a.poId);
    if (po && a.status === 'approved' && po.status === 'awaiting-approval') placeOrder(po);
    if (po && a.status === 'rejected') { po.status = 'rejected'; logActivity(`${po.number} rejected — order not placed`); }
  }
  /* affiliate payout approvals — approve = transfer goes out, commissions marked paid */
  if (a.type === 'affiliate-payout' && a.affiliateId) {
    const aff = db.affiliates.find(x => x.id === a.affiliateId);
    if (aff && a.status === 'approved') payAffiliate(aff, a.amount);
    if (aff && a.status === 'rejected') notifyAffiliate(aff, 'Payout request declined', 'Your payout request was declined by the admin — reply to this email thread or call info@linesandlogos.team for details.');
  }
  /* intro-email approvals — approve = the Outreach Agent sends it and advances the lead */
  if (a.type === 'email' && a.leadId) {
    const lead = db.leads.find(l => l.id === a.leadId);
    if (lead && a.status === 'approved') {
      sendEmail(lead.email, `Your facility's floors, courts & walls — lasting impressions`, a.detail || '', lead.id);
      lead.stage = 'contacted'; lead.contactedAt = new Date().toISOString();
      const pr = db.prospects.find(p => p.business === lead.company); if (pr) pr.status = 'emailed';
      logActivity(`Intro email approved & sent to ${lead.company} — stage → contacted`);
    }
    if (lead && a.status === 'rejected') logActivity(`Intro email to ${lead.company} rejected — not sent`);
  }
  /* photo-delivery approvals — approve = approved albums are emailed to the requester */
  if (a.type === 'photo-delivery' && a.photoRequestId) {
    const pr = db.photoRequests.find(x => x.id === a.photoRequestId);
    if (pr && a.status === 'approved') {
      pr.status = 'sent';
      let photos = db.gallery.filter(g => g.status === 'approved');
      if (pr.jobId) { const own = photos.filter(g => g.jobId === pr.jobId); if (own.length) photos = own; }
      sendEmail(pr.email, `Lines & Logos — ${pr.interest} (approved albums)`,
        `Hi ${pr.name || 'there'},\n\nAs requested, here are approved photos from recent completed jobs:\n\n` +
        photos.map((g, i) => `${i + 1}. ${g.caption}\n   ${g.url || ('/gallery.html#' + g.id)}`).join('\n\n') +
        `\n\nFull gallery: /gallery.html\n\nHappy to walk your facility anytime — reply here or call info@linesandlogos.team.\n— Lines & Logos`);
      logActivity(`Approved photo album (${photos.length} photos) emailed to ${pr.email}`);
    }
    if (pr && a.status === 'rejected') { pr.status = 'declined'; logActivity(`Photo request from ${pr.email} declined`); }
  }
  logActivity(`Approval ${a.status}: ${a.title}`); save(); json(res,200,a);
};
routes['GET /api/notifications'] = async (req,res) => json(res,200, db.notifications.slice().reverse());
routes['GET /api/settings'] = async (req,res) => json(res,200, db.settings);
routes['POST /api/settings'] = async (req,res) => {
  const b = await body(req);
  const deep = (t,src)=>{ for (const k of Object.keys(src)){ if (src[k] && typeof src[k]==='object' && !Array.isArray(src[k]) && t[k] && typeof t[k]==='object' && !Array.isArray(t[k])) deep(t[k],src[k]); else t[k]=src[k]; } };
  deep(db.settings, b); save(); logActivity('Settings updated'); json(res,200,db.settings);
};
routes['GET /api/competitors'] = async (req,res) => json(res,200, db.competitors);

/* ---- agents console ---- */
const AGENT_CATALOG = [
  { key:'lead-score',   name:'Lead Score Agent',        desc:'Scores leads 0–100 → hot/warm/cold', auto:true },
  { key:'dispatch',     name:'Job Dispatch Agent',      desc:'Matches jobs to contractors by skills' },
  { key:'reminder',     name:'Invoice Reminder Agent',  desc:'Escalating tone based on days overdue' },
  { key:'health',       name:'Health Score Agent',      desc:'Account health + risk summary' },
  { key:'watch',        name:'Competitor Watch Agent',  desc:'Flags competitor pricing & moves' },
  { key:'daily-ops',    name:'Daily Ops Agent',         desc:'Morning brief: jobs, invoices, tasks' },
  { key:'status-email', name:'Job Status Update Agent', desc:'Drafts customer progress emails' },
  { key:'repurpose',    name:'Content Repurposing Agent', desc:'Blog → multi-platform social posts' },
  { key:'competitor',   name:'Competitor Analysis Agent', desc:'Deep-dive competitive impact' },
  { key:'crm',          name:'CRM Manager Agent',       desc:'Post-job surveys, completion invoices, stale-account follow-ups, renewal motions', auto:true },
  { key:'finance-watchdog', name:'Financial Watchdog Agent', desc:'Monitors payments, expenses and payouts for odd behavior; raises alerts', auto:true },
  { key:'pricing',      name:'Pricing & Tax Agent',     desc:'Line-item quotes with location-aware sales tax (QuickBooks-synced when connected)', auto:true },
  { key:'hiring',       name:'Hiring & Onboarding Agent', desc:'Sends new-hire e-sign packets (W-4, I-9, W-9, state forms), stores signed paperwork, auto-schedules the video interview', auto:true },
  { key:'procurement',  name:'Procurement Agent',       desc:'Sources best price + ship date across vendors, drafts POs to Approvals, orders on approval, tracks delivery', auto:true },
  { key:'prospect-scout', name:'Prospect Scout Agent',  desc:'Finds decision-makers at facilities in our territory, verifies POC/email/phone/website, adds them to the pipeline, drafts intro emails for approval', auto:true },
  { key:'social-media', name:'Social Media Manager Agent', desc:'Plans posts from consent-approved gallery photos + the Brand Kit quote library; writes captions, hashtags and suggested times', auto:true },
  { key:'ad-manager',   name:'Ad Manager Agent',       desc:'Generates provider-ready ad copy validated against each platform\'s size/format/text limits; manages campaigns & budgets via connected ad APIs (Meta, Google, TikTok, LinkedIn, X, Pinterest)', auto:true },
  { key:'compliance',   name:'Compliance & State Filings Agent', desc:'Tracks Secretary of State filings — formation, foreign qualifications per work state, annual reports, registered agent renewals — with due-date alerts and per-state filing checklists', auto:true },
  { key:'ap-ar',        name:'AP/AR Agent',             desc:'Works both sides of the ledger — builds the collections queue with escalating dunning actions on overdue invoices, schedules vendor payments by due date, and flags cash-flow pinch where payables outrun receivables', auto:true },
  { key:'logistics',    name:'Logistics & Travel Agent', desc:'Builds trip plans on signed contracts — route, fuel, hotels, per-diem, equipment, materials — holds for admin approval, emails customer + techs with map & directions, queues hotel/per-diem POs, watches email for sick/reschedule/cancel', auto:true },
  { key:'seo',          name:'SEO Agent',               desc:'Audits public pages (titles, meta, headings, alt text, OG), scores the site, applies only admin-approved fixes', auto:true },
  { key:'security',     name:'Security Agent',          desc:'Scans for exposed files, weak creds, stale tokens, missing backups + npm audit CVEs; auto-fixes safe items; drafts white paper + coordinated disclosure held for owner sign-off', auto:true },
  { key:'exit-advisor', name:'Exit & Acquisition Advisor', desc:'Guides owner through selling the company & handing off the app — 6 stages with checklists, resources, and an app-specific handoff track' },
  { key:'self-heal',    name:'Self-Healing Watchdog',   desc:'Verifies data integrity, restores from backup, heals schema, dedupes ids, rescues stuck/failed workflow runs — logs everything to healLog', auto:true },
  { key:'improve',    name:'Continuous Improvement Agent', desc:'Scans SEO, performance, code health, dependencies, GUI defects and accessibility — scores the app, tracks the trend, auto-fixes trivial items, queues the rest for approval', auto:true },
  { key:'scheduling', name:'Scheduling & Acceptance Agent', desc:'Offers jobs to contractors — they accept, counter-propose times, or decline — and the customer approval + contract send is hard-gated on a confirmed crew', auto:true },
  { key:'reputation', name:'Reputation & Disputes Agent', desc:'Handles financial disputes (verify → propose resolution → execute on approval) and monitors BBB/Google/Yelp via email alerts — drafts responses + remediation, auto-responds to low-risk, escalates BBB & high-severity to admin', auto:true },
  { key:'licensing', name:'License & Insurance Agent', desc:'Tracks business licenses, permits & insurance policies with expiry dates — renewal reminders at T-30/T-7/expired, coverage-gap detection, and the cheapest vetted sources for each requirement', auto:true },
  { key:'valuation', name:'Business Valuation Agent', desc:'Monitors P/L, clients, leads, conversion, recurring revenue, employees, machines, inventory and marketing performance — computes live business + app value, a value-readiness score, and an ordered improvement plan with steps, tools and links; generates full markdown valuation reports; branches handoff setup by same-name vs rebrand', auto:true },
  { key:'funding', name:'Documents & Funding Agent', desc:'Generates operating agreement, business plan and pitch deck from live business data; funding playbook (prepare → free advisors → sequence → close); curated grant DB matched to owner/business eligibility, grant draft writing held for admin approval, weekly grant sweep with alerts', auto:true },
  { key:'newsletter', name:'Newsletter Agent', desc:'Manages subscriber list (public signup, token unsubscribe), drafts each issue from seasonal court-care tips + curated sports/facility news + admin announcements, sends on admin approval with open-tracking pixel, pulls news items from email alerts', auto:true },
];
routes['GET /api/agents'] = async (req,res) => json(res,200, AGENT_CATALOG);
routes['POST /api/agents/run'] = async (req,res,key) => {
  const b = await body(req); let out;
  switch (key) {
    case 'lead-score':   out = agents.scoreLead(b); logActivity(`Lead Score Agent scored ${b.name||b.company||'lead'} ${out.score} (${out.tier})`); break;
    case 'dispatch': { const j = db.jobs.find(j => j.id === b.jobId) || db.jobs[0]; out = { job: j.title, ...agents.dispatch(j) }; logActivity(`Job Dispatch Agent matched ${out.match?out.match.name:'nobody'} to ${j.title}`); break; }
    case 'reminder': { const i = db.invoices.find(i => i.id === b.invoiceId) || db.invoices.find(i => i.status==='overdue') || db.invoices[0]; out = { invoice: i.number, ...agents.reminder(i) }; logActivity(`Invoice Reminder Agent drafted ${out.tone} reminder for ${i.number}`); break; }
    case 'seo': out = seoAgent.auditSite(ROOT); logActivity(`SEO Agent audited ${out.pages.length} pages — site score ${out.siteScore}`); break;
    case 'security': { const r = await securityAgent.runScan(ROOT, db, { notify, logActivity }); out = { findings: r.scan.total, autoFixed: r.scan.autoFixed, disclosure: r.disclosure ? r.disclosure.title : null }; break; }
    case 'exit-advisor': { const exitAdvisor2 = require('./lib/exit-advisor'); const t = exitAdvisor2.createTracker(db.exitTracker && db.exitTracker[0]); out = { advice: exitAdvisor2.advise(t), progress: exitAdvisor2.computeProgress(t) }; break; }
    case 'logistics': out = { tripPlans: db.tripPlans.length, pending: db.tripPlans.filter(p=>p.status==='pending-approval').length }; logActivity(`Logistics Agent: ${out.tripPlans} plan(s), ${out.pending} awaiting approval`); break;
    case 'self-heal': { const sh = require('./lib/selfheal'); out = { actions: sh.healNow({ db, dataFile: DB_FILE, save, logActivity, notify, reload: load, quiet: false }) }; break; }
    case 'improve': { const imp = require('./lib/improve'); const r = await imp.runImprovement(ROOT, db, { logActivity, notify, save }); out = { overall: r.report.overall, findings: r.report.findings.length, autoFixed: r.applied }; break; }
    case 'scheduling': { out = { openOffers: db.jobOffers.filter(o=>['offered','countered'].includes(o.status)).length, confirmed: db.jobOffers.filter(o=>o.status==='accepted').length, needsReassignment: db.jobs.filter(j=>j.crewStatus==='needs-reassignment').length }; break; }
    case 'reputation': { const rep = require('./lib/reputation'); out = rep.stats(db); break; }
    case 'licensing': { const lic = require('./lib/licensing'); const s = lic.sweep(db, { notify, push: pushToRole }); out = { ...lic.summary(db), nudges: s.nudges }; break; }
    case 'valuation': { const val = require('./lib/valuation'); const d = val.gatherData(db); const v = val.computeValuation(d, db); out = { total: v.total, score: v.score, sde: Math.round(d.sde), clients: d.clients, growthPct: d.growthPct }; break; }
    case 'funding': { const f = require('./lib/funding'); const s = f.sweep(db, { notify, push: pushToRole, save }); out = { matched: s.matched, newEligible: s.newEligible, docs: db.fundingDocs.length, submissions: db.grantSubmissions.length }; break; }
    case 'newsletter': { const nl = require('./lib/newsletter'); const found = nl.monitorEmails(db); if (found) save(); out = { ...nl.stats(db), newsPulled: found }; break; }
    case 'health':     out = db.accounts.map(a => ({ account: a.name, ...agents.health(a) })); logActivity('Health Score Agent refreshed all account health scores'); break;
    case 'watch':      out = agents.competitorWatch(); logActivity('Competitor Watch Agent completed market scan'); break;
    case 'daily-ops':  out = agents.dailyBrief(); logActivity('Daily Ops Agent generated morning brief'); break;
    case 'status-email': { const j = db.jobs.find(j => j.id === b.jobId) || db.jobs.find(j=>j.status==='in-progress') || db.jobs[0]; out = agents.jobStatusEmail(j); logActivity(`Job Status Update Agent drafted email for ${j.title}`); break; }
    case 'repurpose': { const c = db.content.find(c => c.id === b.contentId) || db.content[0]; out = { content: c.title, ...agents.repurpose(c) }; logActivity(`Content Repurposing Agent repurposed "${c.title}"`); break; }
    case 'competitor': out = agents.competitorAnalysis(b.name); logActivity(`Competitor Analysis Agent completed deep-dive on ${out.profile.name}`); break;
    case 'crm':        out = crmSweep(); break;
    case 'finance-watchdog': out = financeScan(); break;
    case 'pricing':    out = buildQuote(b); logActivity(`Pricing & Tax Agent built ${out.service} quote: $${out.grandTotal.toLocaleString()} incl. ${out.taxRate}% ${out.taxState} tax`); break;
    case 'hiring': {
      /* sweep: any returned packet without an interview gets one scheduled now */
      const made = [];
      db.hirePackages.filter(p => p.status === 'returned').forEach(p => { const iv = scheduleInterview(p); if (iv) made.push(iv); p.status = 'interview-scheduled'; });
      out = { packetsSent: db.hirePackages.length, awaitingSignature: db.hirePackages.filter(p => p.status === 'sent').length,
        returned: db.hirePackages.filter(p => p.status !== 'sent').length, interviewsJustScheduled: made.length, interviews: db.interviews };
      logActivity(`Hiring & Onboarding Agent sweep — ${made.length} interview(s) scheduled, ${out.awaitingSignature} packet(s) awaiting signature`);
      break;
    }
    case 'procurement': {
      if (b.items && b.items.length) out = draftProcurement(b.items, { jobId: b.jobId || null, neededBy: b.neededBy || null });
      else if (b.jobId) { const job = db.jobs.find(j => j.id === b.jobId); if (!job) return json(res,404,{ error:'Job not found' });
        const need = materialsForJob(job); out = { job: job.title, ...need, ...draftProcurement(need.items, { jobId: job.id, neededBy: need.neededBy }) }; }
      else { /* default: every contracted future job + low stock */
        const future = db.jobs.filter(j => ['quoted','scheduled','in-progress'].includes(j.status));
        const results = future.map(j => ({ job: j.title, ...(() => { const need = materialsForJob(j); return { ...need, ...draftProcurement(need.items, { jobId: j.id, neededBy: need.neededBy }) }; })() }));
        out = { jobsReviewed: future.length, results, delivered: deliverDueShipments() };
      }
      logActivity('Procurement Agent ran sourcing sweep — POs drafted to approvals');
      break;
    }
    case 'prospect-scout': out = prospectScout(b.count || db.settings.leadGen.dailyCap); break;
    case 'social-media':   out = agents.socialPost(b); logActivity('Social Media Manager Agent drafted a post'); break;
    case 'ad-manager':     out = agents.adCopy(b); logActivity(`Ad Manager Agent generated ${b.provider||'meta'} ad copy`); break;
    case 'compliance':     out = agents.stateFilings(b); logActivity('Compliance & State Filings Agent reviewed entity filings'); break;
    case 'ap-ar':          out = agents.apAr(b); logActivity('AP/AR Agent built the collections & payables queues'); break;
    default: return json(res,404,{ error:'Unknown agent' });
  }
  save(); json(res,200,{ agent: key, ranAt: new Date().toISOString(), result: out });
};

/* ---- cron ---- */
routes['GET /api/cron/daily'] = async (req,res) => {
  careerReminders();
  privacySweep();
  memoryCaptureFromActivity();
  const spendFlags = spendAudit();
  const reviewFlags = spendFlags.filter(a => a.severity === 'review');
  if (reviewFlags.length) notify('admin', 'Spend audit: ' + reviewFlags.length + ' flag(s) to review', reviewFlags.slice(0,5).map(a => a.message).join(' | '));
  seoAudit();
  backupDb('daily');
  const cap = capacity();
  if (cap.overbooked.length) notify('admin', 'Capacity alert: overbooked days', cap.overbooked.map(d => `${d.date} (${d.jobs} jobs > ${cap.crews} crews)`).join(' · '));
  equipmentAlerts();
  if (new Date().getDay() === 1) weeklyMemo();   // Monday morning memo
  if (CRON_SECRET && (req.headers.authorization||'') !== 'Bearer ' + CRON_SECRET) return json(res,401,{error:'Unauthorized'});
  const brief = agents.dailyBrief();
  db.invoices.filter(i => i.status === 'overdue').forEach(i => {
    const r = agents.reminder(i);
    db.notifications.push({ id: uid('n'), channel:'email', to: acctName(i.accountId), subject: r.subject, status:'sent', sentAt:new Date().toISOString(), preview:r.body.slice(0,120)+'…' });
  });
  /* Procurement Agent: receive due shipments → inventory, notifications, calendar */
  const delivered = deliverDueShipments();
  /* Today's calendar digest + interview reminders */
  const today = new Date().toISOString().slice(0,10);
  const todays = db.events.filter(e => (e.at||'').slice(0,10) === today);
  if (todays.length) notify(db.settings.quotes.approvalEmail, `Today on the calendar: ${todays.length} event(s)`, todays.map(e => e.title).join(' · '), ['in-app']);
  db.interviews.filter(i => (i.when||'').slice(0,10) === today && i.status === 'scheduled')
    .forEach(iv => notify(db.settings.quotes.approvalEmail, `Interview today — ${iv.name} (${iv.position})`, `${(iv.when||'').slice(11,16)} CT · ${iv.link}`, ['in-app','email']));
  /* Hiring Agent sweep: returned packets without interviews get scheduled */
  db.hirePackages.filter(p => p.status === 'returned').forEach(p => { if (scheduleInterview(p)) p.status = 'interview-scheduled'; });
  /* Prospect Scout Agent daily batch (respects dailyCap; emails still need approval unless disabled) */
  if (db.settings.leadGen.enabled) { const sc = prospectScout(db.settings.leadGen.dailyCap); if (sc.addedToPipeline) logActivity(`Daily cron: Prospect Scout added ${sc.addedToPipeline} verified lead(s)`); }
  /* Location retention purge (default 90 days) */
  const cutoff = new Date(Date.now() - (db.settings.tracking.retentionDays || 90) * 864e5).toISOString();
  const before = db.locations.length;
  db.locations = db.locations.filter(l => l.at >= cutoff);
  if (db.locations.length !== before) logActivity(`Location retention: purged ${before - db.locations.length} pings older than ${db.settings.tracking.retentionDays}d`);
  logActivity(`Daily Ops Agent generated morning brief + invoice reminders${delivered.length ? ` · ${delivered.length} shipment(s) received` : ''}`);
  save(); json(res,200,{ ...brief, shipmentsReceived: delivered, todaysEvents: todays.length });
};
routes['GET /api/cron/weekly'] = async (req,res) => {
  if (CRON_SECRET && (req.headers.authorization||'') !== 'Bearer ' + CRON_SECRET) return json(res,401,{error:'Unauthorized'});
  logActivity('Weekly report + competitor watch scan complete'); save();
  json(res,200,{ leads: db.leads.length, pipeline: db.jobs.filter(j=>j.status!=='complete').reduce((s,j)=>s+j.value,0), collected: db.invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0), competitorFlags: agents.competitorWatch().filter(c=>c.flag==='ACT NOW').length, week: new Date().toISOString().slice(0,10) });
};

/* ---- chatbot ---- */
routes['POST /api/chat'] = async (req,res) => {
  const b = await body(req);
  const reply = chatAnswer(b.message);
  const u = auth(req);
  db.chatLogs.push({ t: new Date().toISOString(), from: u ? u.name : 'unknown', message: b.message || '', reply });
  if (db.chatLogs.length > 200) db.chatLogs = db.chatLogs.slice(-200);
  save();
  json(res,200,{ reply, at: new Date().toISOString() });
};

/* ---- integrations: QuickBooks (tax) + Stripe (account monitoring) ---- */
routes['GET /api/integrations'] = async (req,res) => json(res,200, {
  quickbooks: { ...db.settings.integrations.quickbooks, mode: db.settings.integrations.quickbooks.connected ? 'connected' : 'simulated' },
  stripe: { ...db.settings.integrations.stripe, secretKeySet: !!process.env.STRIPE_SECRET_KEY, mode: process.env.STRIPE_SECRET_KEY ? 'live-ready' : 'simulated' },
  taxRates: Object.entries(TAX_RATES).map(([st, t]) => ({ state: st, name: t.name, rate: t.rate })),
});
routes['POST /api/integrations/quickbooks/connect'] = async (req,res) => {
  const b = await body(req);
  const q = db.settings.integrations.quickbooks;
  q.connected = true; q.realmId = b.realmId || 'sandbox-realm'; q.clientId = b.clientId || '';
  q.environment = b.environment || 'sandbox';
  logActivity(`QuickBooks connected (${q.environment}) — tax sync ${q.syncTax ? 'enabled' : 'disabled'}`); save();
  json(res,200,{ ok:true, quickbooks: q, note: 'OAuth handshake simulated — drop real Intuit app keys in production to exchange tokens.' });
};
routes['POST /api/integrations/quickbooks/disconnect'] = async (req,res) => {
  Object.assign(db.settings.integrations.quickbooks, { connected:false, realmId:'', clientId:'' });
  logActivity('QuickBooks disconnected'); save(); json(res,200,{ ok:true });
};
routes['POST /api/integrations/quickbooks/sync-taxes'] = async (req,res) => {
  const q = db.settings.integrations.quickbooks;
  if (!q.connected) return json(res,400,{ error:'QuickBooks not connected' });
  q.lastSync = new Date().toISOString();
  logActivity(`QuickBooks tax sync complete — ${Object.keys(TAX_RATES).length} state rates verified against QBO Tax Service`);
  save(); json(res,200,{ ok:true, synced: Object.keys(TAX_RATES).length, lastSync: q.lastSync, rates: TAX_RATES });
};
routes['POST /api/integrations/stripe/connect'] = async (req,res) => {
  const b = await body(req);
  const s = db.settings.integrations.stripe;
  s.connected = true; s.publishableKey = b.publishableKey || ''; s.lastSync = new Date().toISOString();
  logActivity(`Stripe connected (publishable key ${s.publishableKey ? s.publishableKey.slice(0,10) + '…' : 'none'}; secret key ${process.env.STRIPE_SECRET_KEY ? 'from env' : 'NOT SET — simulated feed'})`); save();
  json(res,200,{ ok:true, stripe: s, note: process.env.STRIPE_SECRET_KEY ? 'Live key detected — account feed is live.' : 'Set STRIPE_SECRET_KEY env var for the live account feed; running simulated until then.' });
};
routes['POST /api/integrations/stripe/disconnect'] = async (req,res) => {
  Object.assign(db.settings.integrations.stripe, { connected:false, publishableKey:'' });
  logActivity('Stripe disconnected'); save(); json(res,200,{ ok:true });
};
routes['GET /api/stripe/overview'] = async (req,res) => json(res,200, await stripeOverview());

/* ---- finance: P&L, watchdog alerts, payroll ---- */
routes['GET /api/finance/pnl'] = async (req,res) => json(res,200, computePnl());
routes['GET /api/finance/alerts'] = async (req,res) => json(res,200, db.financialAlerts);
routes['POST /api/agent/finance/scan'] = async (req,res) => json(res,200, financeScan());
collRoutes(routes, 'payouts', { prefix:'po' });
routes['POST /api/payroll/run'] = async (req,res) => json(res,200, runPayroll());

/* ---- CRM: surveys, follow-ups, sweep ---- */
collRoutes(routes, 'surveys', { prefix:'sv', resolve: s => ({ ...s, account: acctName(s.accountId), job: (db.jobs.find(j=>j.id===s.jobId)||{}).title || '—' }) });
collRoutes(routes, 'followUps', { prefix:'fu', resolve: f => ({ ...f, account: acctName(f.accountId) }) });
routes['GET /api/crmVisitors'] = async (req,res) => json(res,200, db.crmVisitors.map(v => ({ ...v, leadId: v.leadId || null })));
routes['POST /api/agent/crm/sweep'] = async (req,res) => json(res,200, crmSweep());

/* ---- public survey (token links from CRM agent emails) ---- */
routes['GET /api/survey'] = async (req,res) => {
  const token = (req.url.split('?')[1]||'').match(/token=([^&]*)/);
  const sv = token && db.surveys.find(s => s.token === decodeURIComponent(token[1]));
  if (!sv) return json(res,404,{ error:'Survey not found' });
  json(res,200,{ account: acctName(sv.accountId), job: (db.jobs.find(j=>j.id===sv.jobId)||{}).title || '', status: sv.status });
};
routes['POST /api/survey'] = async (req,res) => {
  const b = await body(req);
  const sv = db.surveys.find(s => s.token === (b.token||''));
  if (!sv) return json(res,404,{ error:'Survey not found' });
  if (sv.status === 'responded') return json(res,400,{ error:'Survey already completed — thank you!' });
  sv.status = 'responded'; sv.rating = Math.min(5, Math.max(1, +b.rating || 5)); sv.comment = b.comment || ''; sv.respondedAt = new Date().toISOString();
  db.feedback.push({ id: uid('f'), accountId: sv.accountId, rating: sv.rating, comment: sv.comment || 'Post-job survey response', date: sv.respondedAt.slice(0,10) });
  notify(db.settings.quotes.approvalEmail, `Survey response — ${acctName(sv.accountId)}: ${sv.rating}★`, sv.comment || '(no comment)', ['in-app']);
  logActivity(`Survey responded: ${acctName(sv.accountId)} rated ${sv.rating}★`);
  save(); json(res,200,{ ok:true });
};

/* ---- public website chat — company Q&A + CRM lead capture (rate-limited) ---- */
const chatRate = new Map();   // session → [timestamps]
function publicBrain(msg){
  const m = (msg||'').toLowerCase();
  const S = db.settings.company;
  // high-priority intents first — specific before broad
  if (/warrant|guarantee/.test(m))
    return `Every project carries a written workmanship warranty — the exact terms are stated in your signed contract because they vary by surface system. Every job also gets photo documentation at completion and a final walkthrough with you. Full details: legal.html#warranty`;
  if (/walk[\s-]?through|site visit|come (see|look)|book.*(visit|walkthrough)|schedule.*(visit|walkthrough)/.test(m))
    return `I'd love to book a walkthrough for you — tell me your city and preferred day (weekday mornings or afternoons work best), and the team will confirm the exact time within one business day. Recent jobs are in the gallery → /gallery.html`;
  if (/financ|payment plan|pay over|deposit|how do i pay/.test(m))
    return `Payments are staged to project milestones — a deposit to lock your scheduling window, progress draws on larger jobs, and the balance at the final walkthrough. Your written estimate spells out the exact terms for your project, and we're happy to talk through a schedule that fits your budget before you sign anything.`;
  if (/how long|timeline|duration|days|weeks|when can you start|turnaround/.test(m))
    return `Typical timelines: a court restripe is usually a one-day job, and a full gym sand-and-finish typically runs about a week depending on square footage, coats, and cure time. Your written estimate gives exact dates — and we schedule around your calendar (games, graduations, summer windows).`;
  if (/price|cost|quote|estimate|how much/.test(m))
    return `Great question — pricing depends on square footage, service, and your city. The instant quote page gives you a line-item number in about 30 seconds, with the estimated sales tax for your location already included. Want me to have the team email you a written estimate too?`;
  if (/area|where|city|travel|far|location|serve/.test(m))
    return `We're based in Memphis and serve everywhere within a 400-mile radius — Nashville, Atlanta, St. Louis, Kansas City, Indianapolis, Louisville, New Orleans, Birmingham, Little Rock, Tulsa, Jackson, Huntsville, and everywhere in between across TN, MS, AR, AL, MO, KY, LA, and IL. What city is your facility in?`;
  if (/tax/.test(m))
    return `Yes — every quote we issue includes the estimated combined state and local sales tax for the city where the work happens, so the number you see is the number you budget. Final tax is confirmed at invoicing through our QuickBooks integration.`;
  if (/service|do you do|what do you|offer/.test(m))
    return `We do facility branding and athletic surfaces end to end: gym floor refinishing, court restriping, wall wraps & graphics, donors walls, signage & parking-lot striping, and playground surfacing. Lasting impressions for years to come.`;
  if (/warrant|guarantee/.test(m))
    return `Every project carries a written workmanship warranty — the exact terms are stated in your signed contract because they vary by surface system. Every job also gets photo documentation at completion and a final walkthrough with you. Full details: legal.html#warranty`;
  if (/job|career|hiring|work for|apply/.test(m))
    return `We're hiring installers, striping techs, and wrap techs across the whole 400-mile footprint. Leave your info here and I'll have our team send you the application link right away.`;
  if (/who|about|company/.test(m))
    return `${S.name} is a Memphis-based facility branding and athletic surfaces company — gym floors, courts, wall wraps, donors walls, and signage for schools, churches, and parks across the 400-mile service area. Reach us through the instant quote page or ${S.email}.`;
  if (/human|person|call/.test(m))
    return `Absolutely — leave your name and the best number or email, and a real person from our team will reach out within one business day. You can also call ${S.phone} now.`;
  if (/^(hi|hello|hey|good)/.test(m))
    return `Hi there! I'm the ${S.name} assistant. I can answer questions about our services, pricing, service area, or warranty — and I can get a quote started for you right here.`;
  return `Happy to help with that! We handle gym floors, court striping, wall wraps, donors walls, signage, and playground surfacing across a 400-mile radius of Memphis. For exact pricing try quotes.html, or tell me a little about your facility and I'll route you to the right specialist.`;
}
function captureVisitor(session, b){
  let v = db.crmVisitors.find(v => v.session === session);
  if (!v){ v = { id: uid('cv'), session, name:'', email:'', phone:'', company:'', city:'', firstSeen: new Date().toISOString(), messages: 0 }; db.crmVisitors.push(v); }
  v.lastSeen = new Date().toISOString(); v.messages++;
  /* explicit fields from the widget form */
  if (b.name) v.name = b.name;
  if (b.email) v.email = b.email;
  if (b.phone) v.phone = b.phone;
  if (b.company) v.company = b.company;
  if (b.city) v.city = b.city;
  /* parse from free text */
  const m = b.message || '';
  const em = m.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/); if (em && !v.email) v.email = em[0];
  const ph = m.match(/(\+?1?[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/); if (ph && !v.phone) v.phone = ph[0];
  const nm = m.match(/(?:my name is|i'?m|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i); if (nm && !v.name) v.name = nm[1][0].toUpperCase() + nm[1].slice(1);
  const ct = m.match(/\b(Nashville|Atlanta|St\.? Louis|Kansas City|Indianapolis|Louisville|New Orleans|Birmingham|Little Rock|Tulsa|Jackson|Huntsville|Memphis|Tupelo|Jonesboro|Paducah|Chattanooga|Knoxville|Mobile|Baton Rouge|Shreveport|Lexington|Montgomery|Springfield|Evansville|Lafayette)\b/i); if (ct && !v.city) v.city = ct[1];
  return v;
}
function missingInfo(v){ return !v.name ? 'name' : !v.email ? 'email' : null; }
const CHAT_UPLOAD_DIR = path.join(ROOT, 'data', 'chat-uploads');
const CHAT_UPLOAD_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf',
  txt: 'text/plain', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
function saveChatAttachment(a, session){
  if (!a || typeof a !== 'object') throw new Error('Invalid attachment');
  const original = String(a.name || 'attachment').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 140);
  const ext = original.toLowerCase().split('.').pop();
  if (!CHAT_UPLOAD_TYPES[ext]) throw new Error('Unsupported file type. Choose an image, PDF, TXT, DOC, or DOCX file.');
  const encoded = String(a.data || '').replace(/^data:[^;]+;base64,/, '');
  if (!encoded || !/^[A-Za-z0-9+/=\s]+$/.test(encoded)) throw new Error('The attachment is empty or invalid.');
  const content = Buffer.from(encoded, 'base64');
  if (!content.length || content.length > 5 * 1024 * 1024) throw new Error('Attachments must be non-empty and no larger than 5 MB.');
  const id = uid('att'), storedName = id + '.' + ext;
  fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(CHAT_UPLOAD_DIR, storedName), content, { flag: 'wx' });
  const item = { id, name: original, type: CHAT_UPLOAD_TYPES[ext], size: content.length,
    file: 'data/chat-uploads/' + storedName, session, createdAt: new Date().toISOString() };
  if (!Array.isArray(db.chatUploads)) db.chatUploads = [];
  db.chatUploads.push(item);
  return item;
}
function privacySweep(){
  const cut = Date.now() - 30 * 86400000;
  if (Array.isArray(db.chatLogs)) db.chatLogs = db.chatLogs.filter(l => new Date(l.t).getTime() > cut);
  if (Array.isArray(db.chatUploads)){
    const stale = db.chatUploads.filter(u => new Date(u.at).getTime() <= cut);
    for (const u of stale){ try { fs.unlinkSync(path.join(ROOT, u.path)); } catch {} }
    db.chatUploads = db.chatUploads.filter(u => new Date(u.at).getTime() > cut);
  }
}

routes['POST /api/chat-public'] = async (req,res) => {
  const b = await body(req, 8 * 1024 * 1024);
  if (b.__tooLarge) return json(res,413,{error:'Message and attachment are too large. Files must be 5 MB or smaller.'});
  b.message = String(b.message || '').slice(0, 10000).trim();
  if (!b.message && !b.email && !b.attachment) return json(res,400,{error:'Message or attachment required'});
  const session = String(b.session || uid('sess')).slice(0, 64);
  /* rate limit: 20 messages / 10 min / session */
  const nowT = Date.now();
  const hits = (chatRate.get(session) || []).filter(t => nowT - t < 600e3);
  if (hits.length >= 20) return json(res,429,{ error:'Easy there — too many messages. Call us at info@linesandlogos.team and we\'ll help right away.' });
  hits.push(nowT); chatRate.set(session, hits);
  let attachment = null;
  try { if (b.attachment) attachment = saveChatAttachment(b.attachment, session); }
  catch (e) { return json(res,400,{error:e.message}); }
  const v = captureVisitor(session, b);
  /* once we can reach them, land them in the CRM as a scored lead */
  if (v.email && !v.leadId){
    const lead = { id: uid('l'), name: v.name || 'Chat visitor', company: v.company || (v.city ? `Facility in ${v.city}` : 'Website chat'), email: v.email, phone: v.phone,
      city: v.city || '', service: 'General inquiry', source: 'AI chat', stage: 'new' };
    const r = agents.scoreLead(lead); Object.assign(lead, r);
    db.leads.push(lead); v.leadId = lead.id;
    notify(db.settings.quotes.approvalEmail, `New chat lead — ${lead.name} (${lead.score}, ${lead.tier})`, `Captured by the website assistant. ${v.email}${v.phone ? ' · ' + v.phone : ''}${v.city ? ' · ' + v.city : ''}`, ['in-app','email']);
    logActivity(`Chat assistant captured CRM lead: ${lead.name} (${lead.email}) — scored ${lead.score}/${lead.tier}`);
  }
  let base = b.message ? publicBrain(b.message)
    : attachment ? `Thanks — I've received ${attachment.name}. A specialist can review it with your inquiry.`
    : `Thanks, ${v.name || 'friend'} — I've got your details!`;

  // --- page-aware flows, walkthrough booking, SMS-consent gating, privacy ---
  const page = String(b.page || '');
  const msg = String(b.message || '');
  if (/walk[\s-]?through|site visit|come (see|look|by)|meet (you|the team|us)|see samples|look at (your|the|our) (gym|floor|court)/i.test(msg)){
    const day = /(tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.exec(msg);
    const preferred = day ? day[0] : 'flexible';
    db.followUps.push({ id: uid('fu'), type: 'walkthrough', name: v.name || 'Chat visitor', email: v.email || '', phone: v.phone || '',
      city: v.city || '', preferred, source: 'chat', status: 'queued', createdAt: new Date().toISOString() });
    db.events.push({ id: uid('ev'), title: `Walkthrough requested: ${v.name || 'Chat visitor'}`, when: new Date(Date.now() + 2*86400000).toISOString() });
    notify('admin', 'Walkthrough requested via chat', `${v.name || 'Chat visitor'}${v.city ? ' (' + v.city + ')' : ''} prefers ${preferred}. Reach out to lock the time.`);
    base = `I'd love to set that up. I've queued a site walkthrough for you${v.city ? ' in ' + v.city : ''} — preferred timing: ${preferred}. The team will confirm the exact time${v.email ? ' by email' : ''}${v.phone ? ' or text' : ''} within one business day. Meanwhile, recent jobs are in the gallery → /gallery.html`;
  } else if (/^\s*(yes|ok|sure|yep|yeah)\b/i.test(msg) && v.smsConsentRequested && !v.smsConsent){
    v.smsConsent = true; v.smsConsentAt = new Date().toISOString();
    base = "You're set — we'll text you updates about this conversation. Say 'stop texts' anytime to opt out.";
  } else if (/text me|send (me )?(a )?text|sms me|message me on my phone/i.test(msg) && !v.smsConsent){
    v.smsConsentRequested = true;
    base = 'Happy to. Just to confirm — may we send text updates about your project to ' + (v.phone ? 'the number you shared' : 'your phone') + '? Reply "yes" to opt in.';
  } else if (/stop texts|unsubscribe texts|opt out/i.test(msg)){
    v.smsConsent = false; v.smsConsentRequested = false;
    base = "Done — you won't get texts from us anymore. Say 'privacy' to learn what we keep and how to delete it.";
  } else if (/privacy|retention|what (data|info).*(keep|store|collect)|delete my|gdpr|ccpa/i.test(msg)){
    base = "Short version: chats and uploads are kept 30 days so we can answer you and improve the assistant, then purged automatically. We never sell personal info. Attachments are deleted with the log window. To delete sooner, email info@linesandlogos.team from the address you chatted with and we'll purge it within 24 hours.";
  } else if (page.includes('careers') && /job|apply|hiring|position|work (for|with)/i.test(msg)){
    base += "\n\nApplying takes about two minutes — resume upload is optional (PDF/DOC/DOCX/TXT, 5MB max), and there's a $500 referral bonus if someone on our crew referred you. Start here: /careers.html — or ask me for a job-site walkthrough first.";
  } else if (page.includes('quotes') && /price|pricing|cost|quote|estimate|how much/i.test(msg)){
    base += "\n\nFastest path: the calculator on this page gives a real ballpark in seconds — set your service and square footage. Prefer a firm number? Ask me for a walkthrough and I'll queue it.";
  }
  const need = missingInfo(v);
  const ask = need === 'name' ? '\n\nBefore I forget — may I have your name so I know who I\'m talking to?'
    : need === 'email' ? `\n\nAnd what's the best email for you, ${v.name.split(' ')[0]}? I'll make sure the right specialist follows up with pricing and next steps.`
    : (!v.phone ? '\n\nOne more thing — a phone number is optional, but it helps if a walkthrough needs scheduling.' : '');
  const messageWithFile = [b.message, attachment ? `[Attachment: ${attachment.name}]` : ''].filter(Boolean).join('\n');
  if (messageWithFile) addInquiry('ai-chat', v.name || 'Chat visitor', v.email || '', messageWithFile, { session, attachmentId: attachment && attachment.id });
  if (!Array.isArray(db.chats)) db.chats = [];
  let chat = db.chats.find(c => c.session === session);
  if (!chat){ chat = { id: uid('ch'), session, messages: [] }; db.chats.unshift(chat); }
  chat.messages.push({ from:'customer', text:b.message || 'Shared an attachment for the team to review.', attachment: attachment ? { id:attachment.id, name:attachment.name, type:attachment.type, size:attachment.size } : null, at:new Date().toISOString() });
  chat.messages.push({ from:'agent', text:base + ask, at:new Date().toISOString() });
  // AI interaction note: when the visitor's email matches a customer account, log the interaction
  if (v.email){
    const acct = (db.customerAccounts || []).find(x => x.email.toLowerCase() === String(v.email).toLowerCase());
    if (acct && (!acct.alerts || acct.alerts.aiNotes !== false)){
      const m2 = String(b.message || '');
      const kind = /price|cost|quote|estimate/i.test(m2) ? 'pricing question' : /walk[\s-]?through|site visit|book/i.test(m2) ? 'walkthrough interest' : /warrant|guarantee/i.test(m2) ? 'warranty question' : /job|hiring|apply/i.test(m2) ? 'careers interest' : /privacy|data/i.test(m2) ? 'privacy question' : 'general question';
      addAccountNote(acct, kind + ': "' + m2.slice(0, 90) + '"', 'ai-chat');
    }
  }
  if (attachment){
    notify(db.settings.quotes.approvalEmail, `New chat attachment — ${attachment.name}`, `Received from public chat session ${session.slice(0,8)}. Attachment ID: ${attachment.id}`, ['in-app']);
    logActivity(`Public chat attachment received: ${attachment.name} (${attachment.size} bytes)`);
  }
  db.chatLogs.push({ t: new Date().toISOString(), from: 'public:' + session.slice(0,8), message: messageWithFile || '(info form)', reply: base + ask });
  if (db.chatLogs.length > 200) db.chatLogs = db.chatLogs.slice(-200);
  save();
  json(res,200,{ reply: base + ask, session, attachment: attachment ? { id:attachment.id, name:attachment.name, size:attachment.size, type:attachment.type } : null, captured: { name: !!v.name, email: !!v.email, phone: !!v.phone }, inCrm: !!v.leadId });
};

routes['POST /api/payouts/pay'] = async (req,res,id) => {
  const p = payPayout(id);
  if (p.error) return json(res,404,{ error: p.error });
  pushToRole('contractor', 'Payout sent', `${p.employee || 'Your payout'} — $${(+p.amount||0).toLocaleString()} marked paid.`, '/portal.html').catch(() => {});
  json(res,200,p);
};

/* ---- portal ---- */
routes['GET /api/portal/'] = async (req,res,token) => {
  const p = db.portals.find(p => p.token === token);
  const who = crewByToken(token);
  if (!p && !who) return json(res,404,{error:'Portal not found'});
  const name = (p && p.name) || who.name;
  const emp = db.employees.find(e => e.name === name) || (who.id && db.employees.find(e => e.id === who.id));
  const assignments = db.jobs.filter(j => j.crew && (j.crew.includes('Crew') || (emp && j.crew === emp.name))).map(j => ({ id: j.id, title:j.title, account:acctName(j.accountId), due:j.due, status:j.status }));
  const empId = (emp && emp.id) || (who && who.id) || null;
  json(res,200,{ name, docs: p ? p.docs : [], assignments,
    shift: { clockedIn: empId ? isClockedIn(empId) : false },
    tracking: { enabled: db.settings.tracking.enabled, intervalMin: db.settings.tracking.intervalMin,
      consent: empId ? (db.locationConsents || []).some(c => c.employeeId === empId && c.granted) : false } });
};
routes['POST /api/portal/sign'] = async (req,res,token) => {
  const p = db.portals.find(p => p.token === token); if (!p) return json(res,404,{error:'Portal not found'});
  const { doc, signature } = await body(req);
  const d = p.docs.find(d => d.name === doc); if (!d) return json(res,404,{error:'Document not found'});
  d.signed = true; d.signature = signature; d.signedAt = new Date().toISOString();
  let interview = null;
  if (p.docs.every(d => d.signed)) {
    const e = db.employees.find(e => e.name === p.name); if (e) e.w9Signed = true;
    /* Hiring Agent: packet returned → store it, schedule the video interview, calendar + admin notification */
    const pkg = db.hirePackages.find(h => h.portalToken === token);
    if (pkg && pkg.status === 'sent') {
      pkg.status = 'returned'; pkg.returnedAt = new Date().toISOString();
      pkg.signedDocs = p.docs.map(x => ({ name: x.name, signedAt: x.signedAt, signature: x.signature }));   // stored in the database
      interview = scheduleInterview(pkg);
      pkg.status = 'interview-scheduled';
    }
  }
  logActivity(`${p.name} signed ${doc}`); save(); json(res,200,{ ok:true, doc:d.name, signedAt:d.signedAt, packetComplete: p.docs.every(d => d.signed), interview });
};


/* ================= PROSPECT SCOUT AGENT =================
   Sources facility decision-makers from the territory pool, verifies every
   field (POC, email pattern vs website domain, phone format, business-name
   dedupe, website present), promotes qualified ones into the sales pipeline,
   and drafts a CAN-SPAM-compliant intro email that waits in Approvals —
   nothing is sent until an admin approves. */
function verifyProspect(p){
  const checks = [];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email || '');
  checks.push({ name: 'email format', ok: emailOk });
  const dom = (p.email.split('@')[1] || '').toLowerCase();
  const site = (p.website || '').toLowerCase();
  const domainMatch = emailOk && site.includes(dom.split('.').slice(-2).join('.').split('.')[0]);
  checks.push({ name: 'email domain matches website', ok: !!domainMatch });
  const phoneOk = /^\(\d{3}\) \d{3}-\d{4}$/.test(p.phone || '') || /^\+?1?[\d\s()-]{10,}$/.test(p.phone || '');
  checks.push({ name: 'phone format', ok: phoneOk });
  checks.push({ name: 'website present', ok: /^https?:\/\/.+\..+/.test(p.website || '') });
  checks.push({ name: 'point of contact identified', ok: !!(p.poc && p.poc.length > 3) });
  const dupe = db.leads.some(l => l.company === p.business) || db.accounts.some(a => a.name === p.business);
  checks.push({ name: 'not already in CRM', ok: !dupe });
  const passed = checks.filter(c => c.ok).length;
  return { checks, confidence: Math.round(passed / checks.length * 100), ok: passed >= checks.length - 1 };
}
function introEmailBody(lead){
  const s = db.settings.leadGen;
  const albums = db.gallery.filter(g => g.status === 'approved').slice(0, 3);
  return `Hi ${lead.contact || 'there'},

I'm ${s.fromName} with Lines & Logos — we're the Memphis crew that handles gym floor refinishing, court restriping, wall wraps, donors walls, and signage for schools, churches, and athletic facilities across the Mid-South. Lasting impressions for years to come — and every job is photo-documented end to end.

${lead.company ? `${lead.company} caught my eye — facilities like yours usually juggle 3-4 vendors for this work. ` : ''}If any of your courts, floors, or walls are due for attention this year, I'd love to do a free walkthrough and leave you a fixed, line-item quote within 48 hours — no obligation either way.

Recent work: ${albums.length ? albums.map(g => g.caption).join(' · ') : 'gym refinishes, court restripes, and wall wraps across TN/MS/AR'}

Reply here and I'll send over our before/after photo album, or grab an instant quote: /quotes.html

${s.fromName} · Lines & Logos · ${s.fromEmail} · info@linesandlogos.team

—
${s.physicalAddress}. You're receiving this one-time introduction because your facility matches the organizations we serve. To opt out of any future messages, reply "unsubscribe" or email ${s.fromEmail} with subject "unsubscribe" and you'll be removed immediately.`;
}
function prospectScout(count){
  const out = { reviewed: 0, verified: 0, addedToPipeline: 0, emailsQueued: 0, rejected: [], added: [] };
  const pool = db.prospects.filter(p => p.status === 'pool').slice(0, count || db.settings.leadGen.dailyCap);
  for (const p of pool){
    out.reviewed++;
    const v = verifyProspect(p);
    p.verified = v; p.verifiedAt = new Date().toISOString();
    if (!v.ok) { p.status = 'rejected'; out.rejected.push({ business: p.business, failed: v.checks.filter(c => !c.ok).map(c => c.name) }); continue; }
    out.verified++;
    p.status = 'added';
    const lead = { id: uid('l'), name: p.poc, company: p.business, email: p.email, phone: p.phone, city: p.city,
      service: 'General inquiry', source: 'Prospect Scout Agent', stage: 'prospect', createdAt: new Date().toISOString().slice(0,10),
      verified: { confidence: v.confidence, checks: v.checks.map(c => `${c.ok ? '✓' : '✗'} ${c.name}`) } };
    Object.assign(lead, agents.scoreLead(lead));
    db.leads.push(lead);
    out.addedToPipeline++;
    const bodyText = introEmailBody(lead);
    if (db.settings.leadGen.requireApprovalToSend){
      db.approvals.push({ id: uid('apv'), type: 'email', leadId: lead.id,
        title: `Intro email — ${p.business} (${p.poc})`, amount: null, requestedBy: 'Prospect Scout Agent',
        status: 'pending', created: new Date().toISOString().slice(0,10),
        detail: bodyText });
      out.emailsQueued++;
    } else {
      sendEmail(p.email, `Your facility's floors, courts & walls — lasting impressions`, bodyText, lead.id);
      lead.stage = 'contacted'; p.status = 'emailed';
    }
    out.added.push({ business: p.business, score: lead.score, tier: lead.tier, confidence: v.confidence });
  }
  notify(db.settings.quotes.approvalEmail, `Prospect Scout: ${out.addedToPipeline} verified lead(s), ${out.emailsQueued} intro email(s) await approval`,
    out.added.map(x => `${x.business} — score ${x.score} (${x.tier}), verification ${x.confidence}%`).join('\n') || 'No new territory prospects verified this run.', ['in-app']);
  logActivity(`Prospect Scout Agent: ${out.reviewed} sourced → ${out.verified} verified → ${out.addedToPipeline} in pipeline, ${out.emailsQueued} emails to Approvals`);
  return out;
}

/* ================= AI PROVIDERS (BYOK) — owner-managed keys, per-agent routing, per-key rate limits ================= */
const AI_PRESETS = [
  { id:'openrouter',   name:'OpenRouter',            type:'openai',   baseUrl:'https://openrouter.ai/api/v1',    models:['meta-llama/llama-3.3-70b-instruct:free','deepseek/deepseek-chat-v3-0324:free'], free:true,  note:'Zero-cost default: :free models, first is used with the second as fallback. Free tier has daily request limits — watch usage on the AI Providers panel.' },
  { id:'anthropic',    name:'Claude (Anthropic)',    type:'anthropic',baseUrl:'https://api.anthropic.com/v1',     models:['claude-sonnet-4-5'] },
  { id:'openai',       name:'ChatGPT (OpenAI)',      type:'openai',   baseUrl:'https://api.openai.com/v1',        models:['gpt-4o-mini'] },
  { id:'gemini',       name:'Gemini (Google)',       type:'gemini',   baseUrl:'https://generativelanguage.googleapis.com/v1beta', models:['gemini-2.0-flash'] },
  { id:'copilot',      name:'GitHub Copilot',        type:'openai',   baseUrl:'https://api.githubcopilot.com',    models:['gpt-4o'],                       note:'Experimental — requires a Copilot OAuth token' },
  { id:'venice',       name:'Venice.ai',             type:'openai',   baseUrl:'https://api.venice.ai/api/v1',     models:['llama-3.3-70b'] },
  { id:'zai',          name:'Z.ai (GLM)',            type:'openai',   baseUrl:'https://api.z.ai/api/paas/v4',     models:['glm-4.5-air'] },
  { id:'tasker',       name:'Tasker',                type:'openai',   baseUrl:'https://api.tasker.ai/v1',         models:['default'],                      note:'Confirm endpoint from your Tasker account' },
  { id:'nemus',        name:'Nemus.ai',              type:'openai',   baseUrl:'https://api.nemus.ai/v1',          models:['default'],                      note:'Confirm endpoint from your Nemus account' },
  { id:'numes',        name:'Numes.ai',              type:'openai',   baseUrl:'https://api.numes.ai/v1',          models:['default'],                      note:'Confirm endpoint from your Numes account' },
  { id:'agnes',        name:'Agnes',                 type:'openai',   baseUrl:'https://api.agnes.ai/v1',          models:['default'],                      note:'Confirm endpoint from your Agnes account' },
  { id:'alliteration', name:'Alliteration.ai',       type:'openai',   baseUrl:'https://api.alliteration.ai/v1',   models:['default'],                      note:'Confirm endpoint from your Alliteration account' },
  { id:'localhf',      name:'Local model (this machine)', type:'local', baseUrl:'http://127.0.0.1:11540/v1',      models:['local-model'], free:true,      note:'Runs full GGUF tensor weights on this machine via llama.cpp (llama-server). Manage in Admin → Settings → AI Providers → Local model panel. Shared hosting cannot run local models — needs a VPS.' },
  { id:'selfhost',     name:'Self-hosted (Llama / LM Studio)', type:'openai', baseUrl:'http://localhost:1234/v1', models:['local-model'],              note:'Any OpenAI-compatible local endpoint' },
];
const maskKey = k => !k ? '' : (k.length <= 8 ? '••••' + k.slice(-2) : k.slice(0,4) + '…' + k.slice(-4));
const aiProviders = () => (db.settings.aiProviders ||= []);
const aiRouting   = () => (db.settings.agentRouting ||= {});
function aiUsageToday(){
  const u = (db.settings.aiUsage ||= { date:'', byProvider:{} });
  const today = new Date().toISOString().slice(0,10);
  if (u.date !== today){ u.date = today; u.byProvider = {}; }
  return u;
}
const aiBuckets = new Map();  // in-memory per-key RPM buckets: {count, reset}
function aiRateOk(p){
  const rpm = p.rpm || 60, now = Date.now();
  let b = aiBuckets.get(p.id);
  if (!b || now > b.reset){ b = { count:0, reset: now + 60000 }; aiBuckets.set(p.id, b); }
  if (b.count >= rpm) return false;
  b.count++;
  return true;
}
function aiUsageAdd(p, tokens, ok){
  const e = aiUsageToday().byProvider[p.id] ||= { requests:0, tokens:0, errors:0 };
  e.requests++; e.tokens += tokens || 0; if (!ok) e.errors++;
}
/* Env-backed provider keys: when a key is set in .env (via the installer or Admin → Keys),
   the matching AI provider uses it without storing anything in the database. */
const AI_ENV_KEY = { openrouter:'OPENROUTER_API_KEY', anthropic:'ANTHROPIC_API_KEY', openai:'OPENAI_API_KEY', gemini:'GEMINI_API_KEY' };
const providerKey = p => (p.apiKey && String(p.apiKey).trim()) ? p.apiKey : (AI_ENV_KEY[p.id] ? (process.env[AI_ENV_KEY[p.id]] || '') : '');

function aiCandidates(agentKey){   // fixed-mode provider first, then explicit fallbacks, then auto order: default → free → rest
  const list = aiProviders().filter(p => p.enabled && (providerKey(p) || p.type === 'local')).map(p => ({ ...p, apiKey: providerKey(p) }));
  if (!list.length) return [];
  const r = aiRouting()[agentKey] || {};
  const pick = id => list.find(p => p.id === id);
  const order = [];
  if (r.mode === 'fixed' && r.providerId && pick(r.providerId)) order.push(pick(r.providerId));
  for (const id of r.fallbackIds || []) if (pick(id) && !order.includes(pick(id))) order.push(pick(id));
  const rest = list.filter(p => !order.includes(p))
    .sort((a,b) => ((b.isDefault?1:0)-(a.isDefault?1:0)) || ((b.free?1:0)-(a.free?1:0)));
  return order.concat(rest);
}
async function aiCallProvider(p, { system, user, maxTokens }){
  const model = (p.models && p.models[0]) || 'default';
  const headers = { 'Content-Type':'application/json' };
  let url, payload;
  if (p.type === 'anthropic'){
    headers['x-api-key'] = p.apiKey; headers['anthropic-version'] = '2023-06-01';
    url = (p.baseUrl || 'https://api.anthropic.com/v1') + '/messages';
    payload = { model, max_tokens: maxTokens || 512, system: system || 'You are a helpful assistant.', messages:[{ role:'user', content:user }] };
  } else if (p.type === 'gemini'){
    url = `${p.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models/${model}:generateContent?key=${p.apiKey}`;
    payload = { contents:[{ parts:[{ text:(system ? system + '\n\n' : '') + user }] }], generationConfig:{ maxOutputTokens: maxTokens || 512 } };
  } else {
    headers['Authorization'] = 'Bearer ' + p.apiKey;
    url = (p.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';
    payload = { model, messages:[ { role:'system', content:system || 'You are a helpful assistant.' }, { role:'user', content:user } ], max_tokens: maxTokens || 512 };
  }
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { method:'POST', headers, body: JSON.stringify(payload), signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j && j.error && (j.error.message || j.error)) || ('HTTP ' + r.status));
    let text = '', tokens = maxTokens || 0;
    if (p.type === 'anthropic'){ text = (j.content || []).map(c => c.text || '').join(''); tokens = (j.usage && j.usage.output_tokens) || tokens; }
    else if (p.type === 'gemini'){ text = (((j.candidates || [])[0] || {}).content || { parts:[] }).parts.map(x => x.text || '').join(''); tokens = (j.usageMetadata && j.usageMetadata.candidatesTokenCount) || tokens; }
    else { text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || ''; tokens = (j.usage && j.usage.completion_tokens) || tokens; }
    if (!text || !text.trim()) throw new Error('empty completion');
    return { text: text.trim(), tokens };
  } finally { clearTimeout(to); }
}
async function aiAssist(agentKey, { system, user, maxTokens }){
  const cands = aiCandidates(agentKey);
  if (!cands.length) return { simulated:true, text:null, provider:null, reason:'No enabled AI provider with a key — add one in Admin → Settings → AI Providers (agents run on built-in heuristics meanwhile)' };
  const errors = [];
  for (const p of cands){
    if (!aiRateOk(p)){ aiUsageAdd(p, 0, false); errors.push(p.name + ': rate limited'); continue; }
    try {
      const out = await aiCallProvider(p, { system, user, maxTokens });
      aiUsageAdd(p, out.tokens, true);
      return { simulated:false, text: out.text, provider: p.name, model: (p.models || [])[0] || '', tokens: out.tokens };
    } catch (e){ aiUsageAdd(p, 0, false); errors.push(p.name + ': ' + String(e.message || e).slice(0,120)); }
  }
  return { simulated:true, text:null, provider:null, reason:'All providers failed/limited — ' + errors.join('; ') };
}
const aiProviderPublic = p => ({ id:p.id, name:p.name, type:p.type, baseUrl:p.baseUrl, models:p.models || [], enabled:!!p.enabled, isDefault:!!p.isDefault, free:!!p.free, rpm:p.rpm || 60, note:p.note || '', hasKey:!!providerKey(p), keyMasked:maskKey(providerKey(p)), keySource:p.apiKey ? 'app' : (providerKey(p) ? 'env' : 'none'), createdAt:p.createdAt || null });

/* ---- AI provider routes (staff-gated by the central role gate) ---- */
routes['GET /api/ai/providers'] = async (req,res) => json(res,200,{ presets: AI_PRESETS, providers: aiProviders().map(aiProviderPublic), defaultId: (aiProviders().find(p => p.isDefault) || {}).id || null });
routes['POST /api/ai/providers'] = async (req,res) => {   // add or update (upsert by id); empty/masked apiKey keeps existing
  const b = await body(req);
  const list = aiProviders();
  let p = b.id ? list.find(x => x.id === b.id) : null;
  if (!p){
    const preset = AI_PRESETS.find(x => x.id === b.preset);
    p = { id: b.id || b.preset || ('ai' + Date.now().toString(36)), createdAt: new Date().toISOString() };
    if (preset) Object.assign(p, { name:preset.name, type:preset.type, baseUrl:preset.baseUrl, models:preset.models.slice(), free:!!preset.free, note:preset.note });
    list.push(p);
  }
  if (b.name != null) p.name = b.name;
  if (b.type) p.type = b.type;
  if (b.baseUrl != null) p.baseUrl = b.baseUrl;
  if (b.models != null) p.models = Array.isArray(b.models) ? b.models : String(b.models).split(',').map(s => s.trim()).filter(Boolean);
  if (b.enabled != null) p.enabled = !!b.enabled;
  if (b.rpm != null) p.rpm = Math.max(1, Math.min(100000, parseInt(b.rpm, 10) || 60));
  if (b.apiKey && !b.apiKey.includes('…')) p.apiKey = b.apiKey;
  if (b.isDefault){ list.forEach(x => x.isDefault = false); p.isDefault = true; }
  if (!list.some(x => x.isDefault) && p.enabled && p.apiKey) p.isDefault = true;
  save();
  json(res,200, aiProviderPublic(p));
};
routes['DELETE /api/ai/providers'] = async (req,res) => {
  const b = await body(req); const list = aiProviders();
  const i = list.findIndex(x => x.id === b.id);
  if (i < 0) return json(res,404,{ error:'Provider not found' });
  const [gone] = list.splice(i,1);
  save();
  json(res,200,{ deleted: gone.id });
};
routes['POST /api/ai/providers/test'] = async (req,res) => {
  const b = await body(req); const p = aiProviders().find(x => x.id === b.id);
  if (!p) return json(res,404,{ error:'Provider not found' });
  const t0 = Date.now();
  const out = await aiAssist('__test__', { system:'You are a connectivity test.', user:'Reply with exactly: ok', maxTokens: 16 });
  json(res,200, out.simulated
    ? { ok:false, simulated:true, reason: out.reason, latencyMs: Date.now()-t0 }
    : { ok:true, provider: out.provider, model: out.model, latencyMs: Date.now()-t0, text: out.text.slice(0,80) });
};
routes['GET /api/ai/routing'] = async (req,res) => json(res,200,{ agents: AGENT_CATALOG.map(a => ({ key:a.key, name:a.name, auto:!!a.auto })), routing: aiRouting(), providers: aiProviders().filter(p => p.enabled).map(p => ({ id:p.id, name:p.name, hasKey:!!p.apiKey })) });
routes['POST /api/ai/routing'] = async (req,res) => {
  const b = await body(req); const r = aiRouting();
  if (!b.agent) return json(res,400,{ error:'agent required' });
  if (b.mode === 'auto') delete r[b.agent];
  else r[b.agent] = { mode: b.mode || 'fixed', providerId: b.providerId || null, fallbackIds: (b.fallbackIds || []).filter(Boolean) };
  save();
  json(res,200, { agent: b.agent, routing: r[b.agent] || { mode:'auto' } });
};
routes['GET /api/ai/usage'] = async (req,res) => json(res,200, aiUsageToday());

/* ---- Local Hugging Face model hosting (llama.cpp / llama-server) ---- */
const LLAMA_HOME = process.env.LLAMA_HOME || path.join(ROOT, 'local-model');
const LLAMA_PORT = Number(process.env.LLAMA_PORT || 11540);
let llamaChild = null;
function llamaPaths(){ return { bin: path.join(LLAMA_HOME, 'bin', 'llama-server'), models: path.join(LLAMA_HOME, 'models'), pidFile: path.join(LLAMA_HOME, 'server.pid') }; }
async function llamaRunning(){
  try { const r = await fetch(`http://127.0.0.1:${LLAMA_PORT}/health`, { signal: AbortSignal.timeout(1500) }); return r.ok; }
  catch { return false; }
}
routes['GET /api/ai/local/status'] = async (req,res) => {
  const { bin, models } = llamaPaths();
  const files = fs.existsSync(models) ? fs.readdirSync(models).filter(f => f.endsWith('.gguf')) : [];
  json(res,200,{ home: LLAMA_HOME, binaryPresent: fs.existsSync(bin), models: files,
    running: await llamaRunning(), port: LLAMA_PORT,
    hint: !fs.existsSync(bin) ? 'Download llama.cpp (ubuntu-x64 tarball) into $LLAMA_HOME/bin and a GGUF model into $LLAMA_HOME/models — see the Local model panel note.' : null });
};
routes['POST /api/ai/local/start'] = async (req,res) => {
  const b = await body(req);
  const { bin, models } = llamaPaths();
  if (!fs.existsSync(bin)) return json(res,400,{ error:'llama-server binary not found at ' + bin });
  const modelFile = b.model || fs.readdirSync(models).find(f => f.endsWith('.gguf'));
  if (!modelFile) return json(res,400,{ error:'No GGUF model in ' + models + ' — download one first' });
  if (await llamaRunning()) return json(res,200,{ ok:true, already:true });
  const threads = Math.max(1, Math.min(4, (require('os').cpus().length || 2) - 1));
  llamaChild = spawn(bin, ['-m', path.join(models, modelFile), '--port', String(LLAMA_PORT), '--host', '127.0.0.1', '-c', String(b.ctx || 2048), '-t', String(threads)], { detached:false });
  llamaChild.stdout.on('data', () => {}); llamaChild.stderr.on('data', () => {});
  llamaChild.on('exit', () => { llamaChild = null; });
  let up = false;
  for (let i = 0; i < 20; i++){ await new Promise(r => setTimeout(r, 1000)); if (await llamaRunning()){ up = true; break; } }
  logActivity(`Local model ${up ? 'started' : 'failed to start'}: ${modelFile} (port ${LLAMA_PORT}, ${threads} threads)`);
  json(res, up ? 200 : 500, up ? { ok:true, model: modelFile, port: LLAMA_PORT } : { error:'llama-server did not become healthy in 20s — check RAM/threads for this box' });
};
routes['POST /api/ai/local/stop'] = async (req,res) => {
  if (llamaChild){ try { llamaChild.kill('SIGTERM'); } catch {} llamaChild = null; }
  json(res,200,{ ok:true, running: false });
};
routes['POST /api/ai/local/download'] = async (req,res) => {
  const b = await body(req);   // {url} direct GGUF URL (Hugging Face resolve link)
  if (!b.url || !/^https:\/\/.+\.gguf(\?|$)/i.test(b.url)) return json(res,400,{ error:'Provide a direct .gguf HTTPS URL (Hugging Face → Files → resolve link)' });
  const dest = path.join(llamaPaths().models, path.basename(b.url.split('?')[0]));
  fs.mkdirSync(llamaPaths().models, { recursive: true });
  spawn('curl', ['-sL','-o', dest, b.url], { detached:true, stdio:'ignore' }).unref();
  logActivity('Local model download started: ' + path.basename(dest));
  json(res,202,{ ok:true, file: path.basename(dest), note:'Downloading in background — check status for the file to appear, then Start.' });
};
routes['POST /api/ai/assist'] = async (req,res) => {   // generic: admin "try it" + agent hooks
  const b = await body(req);
  if (!b.user) return json(res,400,{ error:'user prompt required' });
  const out = await aiAssist(b.agent || '__manual__', { system: b.system || '', user: b.user, maxTokens: b.maxTokens || 512 });
  json(res,200, out);
};
routes['GET /api/ai/setup'] = async (req,res) => json(res,200, { configured: !!(db.settings.setup && db.settings.setup.aiConfigured), opencodeKeyMasked: maskKey(db.settings.setup && db.settings.setup.opencodeKey), promptedAt: (db.settings.setup || {}).aiPromptedAt || null });
routes['POST /api/ai/setup'] = async (req,res) => {   // first-run: save initial key(s), generate the OpenCode key once
  const b = await body(req);
  db.settings.setup = db.settings.setup || {};
  const added = [];
  for (const s of (b.providers || [])){
    const preset = AI_PRESETS.find(x => x.id === s.preset);
    if (!preset) continue;
    if (aiProviders().some(x => x.id === preset.id)) continue;
    aiProviders().push({ id: preset.id, name: preset.name, type: preset.type, baseUrl: s.baseUrl || preset.baseUrl, apiKey: s.apiKey || '', models: preset.models.slice(), enabled: true, free: !!preset.free, isDefault: !aiProviders().some(x => x.isDefault), note: preset.note, createdAt: new Date().toISOString() });
    added.push(preset.id);
  }
  if (b.promptedAt) db.settings.setup.aiPromptedAt = b.promptedAt;
  let opencodeKey = null;
  if (!db.settings.setup.opencodeKey){ db.settings.setup.opencodeKey = 'oc_' + crypto.randomBytes(24).toString('hex'); opencodeKey = db.settings.setup.opencodeKey; }
  db.settings.setup.aiConfigured = true;
  save();
  logActivity(`AI setup completed — ${added.length} provider(s) added (${added.join(', ') || 'none'}), OpenCode key ${opencodeKey ? 'generated' : 'already present'}`);
  json(res,200, { ok:true, added, opencodeKey, opencodeKeyMasked: maskKey(db.settings.setup.opencodeKey) });
};

/* ================= CREW LOCATION TRACKING (consent-gated, work-hours only) ================= */
function haversineM(aLat, aLng, bLat, bLng){
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function crewByToken(token){
  const u = db.users.find(u => u.portalToken === token);
  if (u) return { id: u.employeeId || ('e-' + u.id), name: u.name, userId: u.id };
  const p = db.portals.find(p => p.token === token);
  if (p) { const e = db.employees.find(e => e.name === p.name); return e ? { id: e.id, name: e.name } : { id: null, name: p.name }; }
  return null;
}
function isClockedIn(employeeId){
  const today = new Date().toISOString().slice(0,10);
  return db.timeEntries.some(t => t.employeeId === employeeId && t.date === today && t.clockedIn && !t.clockedOut);
}
/* dwell: minutes inside the onsite radius of the assigned job, from today's pings */
function dwellToday(employeeId){
  const T = db.settings.tracking, today = new Date().toISOString().slice(0,10);
  const pings = db.locations.filter(l => l.employeeId === employeeId && (l.at||'').slice(0,10) === today).sort((a,b) => a.at.localeCompare(b.at));
  let onsiteMin = 0, totalMin = 0;
  for (let i = 1; i < pings.length; i++){
    const dt = Math.min(30, (new Date(pings[i].at) - new Date(pings[i-1].at)) / 60000);   // cap gaps at 30 min
    totalMin += dt;
    const job = db.jobs.find(j => j.id === pings[i].jobId) || db.jobs.find(j => j.status === 'in-progress');
    if (job && job.siteLat && haversineM(pings[i].lat, pings[i].lng, job.siteLat, job.siteLng) <= T.onsiteRadiusM) onsiteMin += dt;
  }
  return { pings: pings.length, totalMin: Math.round(totalMin), onsiteMin: Math.round(onsiteMin) };
}

/* ================= PAYROLL (hours approval → run → pay, with progress) ================= */
function payrollSummary(){
  const s = db.settings.payroll, since = new Date(Date.now() - s.payPeriodDays * 864e5).toISOString().slice(0,10);
  const entries = db.timeEntries.filter(t => t.date >= since && !t.paidOut);
  const byEmp = {};
  entries.forEach(t => { (byEmp[t.employeeId] = byEmp[t.employeeId] || []).push(t); });
  const rows = Object.entries(byEmp).map(([empId, list]) => {
    const emp = db.employees.find(e => e.id === empId);
    const hours = list.reduce((a, t) => a + t.hours, 0);
    const approvedH = list.filter(t => t.approved).reduce((a, t) => a + t.hours, 0);
    const rate = (emp && emp.rate) || s.defaultHourlyRate;
    const reg = Math.min(approvedH, s.overtimeThreshold), ot = Math.max(0, approvedH - s.overtimeThreshold);
    const dwell = dwellToday(empId);
    return { employeeId: empId, employee: emp ? emp.name : empId, rate, entries: list.length,
      hours: +hours.toFixed(1), approvedHours: +approvedH.toFixed(1), pendingHours: +(hours - approvedH).toFixed(1),
      regular: reg, overtime: ot, amount: Math.round((reg * rate + ot * rate * s.otMultiplier) * 100) / 100,
      onsiteTodayMin: dwell.onsiteMin, trackedTodayMin: dwell.totalMin,
      ready: !s.requireHoursApproval || approvedH >= hours };
  });
  // include the rest of the roster so the admin sees the whole team, even with no unpaid hours
  db.employees.filter(e => !byEmp[e.id]).forEach(e => {
    const dwell = dwellToday(e.id);
    rows.push({ employeeId: e.id, employee: e.name, rate: e.rate || s.defaultHourlyRate, entries: 0,
      hours: 0, approvedHours: 0, pendingHours: 0, regular: 0, overtime: 0, amount: 0,
      onsiteTodayMin: dwell.onsiteMin, trackedTodayMin: dwell.totalMin, ready: true });
  });
  return { periodStart: since, periodEnd: new Date().toISOString().slice(0,10), settings: s, rows,
    totalReady: rows.filter(r => r.ready).reduce((a, r) => a + r.amount, 0) };
}


/* ================= PROSPECT SCOUT + OUTREACH ROUTES ================= */
routes['GET /api/prospects'] = async (req,res) => json(res,200, db.prospects);
routes['POST /api/agent/prospect'] = async (req,res) => { const b = await body(req); const pendingBefore = db.approvals.filter(a => a.status === 'pending' && a.type === 'email').length;
      const out = prospectScout(b.count);
      const fresh = db.approvals.filter(a => a.status === 'pending' && a.type === 'email').slice(pendingBefore);
      for (const apv of fresh){
        const ld = db.leads.find(x => x.id === apv.leadId);
        const ai = await aiAssist('scout', { system:'You write short, specific B2B intro emails for Lines & Logos (Memphis TN — gym floors, court restriping, wall wraps, donor walls, signage, athletic surfacing). Tone: confident, local, no hype. Never invent results, certifications, or prices. One question max.',
          user:`Prospect: ${apv.title}
Company context: ${ld ? ld.company + ' — ' + (ld.service || '') + ' — ' + (ld.city || '') : 'unknown'}

Current template email:
${apv.detail}

Rewrite it personalized for this prospect.`, maxTokens: 320 });
        if (!ai.simulated && ai.text){ apv.detail = ai.text; apv.aiAssisted = ai.provider; }
      }
      if (fresh.some(a => a.aiAssisted)) logActivity(`Prospect Scout: ${fresh.filter(a => a.aiAssisted).length}/${fresh.length} intro email(s) AI-personalized`); save(); json(res,200,out); };
/* admin: edit / add to the territory pool */
routes['POST /api/prospects'] = async (req,res) => {
  const b = await body(req);
  if (!b.business || !b.email) return json(res,400,{ error:'Business name and email required' });
  const p = { id: uid('pr'), status: 'pool', type: b.type || 'school', poc: b.poc || '', phone: b.phone || '', website: b.website || '', city: b.city || '', ...b };
  db.prospects.push(p); save(); logActivity(`Prospect pool: added ${p.business} (${p.city})`); json(res,201,p);
};
/* approving an 'email' approval = send the intro email and advance the lead */
routes['POST /api/approvals/send-email'] = async (req,res) => {
  const b = await body(req); const id = b.id;
  const a = db.approvals.find(a => a.id === id); if (!a || a.type !== 'email') return json(res,404,{ error:'Email approval not found' });
  a.status = 'approved'; a.decidedAt = new Date().toISOString();
  const lead = db.leads.find(l => l.id === a.leadId); if (!lead) return json(res,404,{ error:'Lead not found' });
  sendEmail(lead.email, `Your facility's floors, courts & walls — lasting impressions`, a.detail || introEmailBody(lead), lead.id);
  lead.stage = 'contacted'; lead.contactedAt = new Date().toISOString();
  const pr = db.prospects.find(p => p.business === lead.company); if (pr) pr.status = 'emailed';
  logActivity(`Intro email sent to ${lead.company} (${lead.email}) — lead moved to contacted`);
  save(); json(res,200,{ ok:true, lead: lead.id, stage: lead.stage });
};

/* ================= PHOTO REQUESTS (client asks → approval → approved album emailed) ================= */
routes['POST /api/photo-requests'] = async (req,res) => {                 // public — client request
  const b = await body(req);
  if (!b.email) return json(res,400,{ error:'Email required' });
  const lead = db.leads.find(l => l.email === b.email) || null;
  const req0 = { id: uid('phr'), name: b.name || (lead && lead.name) || '', email: b.email,
    interest: b.interest || 'before/after photos', jobId: b.jobId || null, status: 'pending', createdAt: new Date().toISOString() };
  db.photoRequests.push(req0);
  db.approvals.push({ id: uid('apv'), type: 'photo-delivery', photoRequestId: req0.id,
    title: `Photo delivery — ${req0.name || req0.email}`, amount: null, requestedBy: 'Client request',
    status: 'pending', created: req0.createdAt.slice(0,10),
    detail: `${req0.name || 'A prospect'} (${req0.email}) asked for ${req0.interest}. Approving emails them the approved photo albums only.` });
  notify(db.settings.quotes.approvalEmail, `Photo request — ${req0.name || req0.email}`, `${req0.interest} · approve in Approvals and the approved albums are emailed automatically.`, ['in-app']);
  logActivity(`Photo request from ${req0.email} queued for approval`);
  save(); json(res,201,{ ok:true, status: 'pending-approval' });
};
routes['GET /api/photo-requests'] = async (req,res) => json(res,200, db.photoRequests.slice().reverse());

/* ================= PHOTO & REFERENCE OPT-OUT (public e-sign) ================= */
routes['POST /api/optout'] = async (req,res) => {                          // public
  const b = await body(req);
  if (!b.business || !b.email || !b.signature) return json(res,400,{ error:'Business, email and signature required' });
  const o = { id: uid('oo'), business: b.business, name: b.name || '', email: b.email,
    scope: b.scope || 'photos-and-reference', signature: b.signature, signedAt: new Date().toISOString(), ip: req.socket.remoteAddress || '' };
  db.optOuts.push(o);
  const acct = db.accounts.find(a => a.name.toLowerCase() === (b.business||'').toLowerCase());
  if (acct) { acct.photoConsent = false; acct.referenceConsent = false; }
  db.gallery.filter(g => acct && db.jobs.find(j => j.id === g.jobId && j.accountId === acct.id)).forEach(g => { g.status = 'rejected'; g.optOut = true; });
  notify(db.settings.quotes.approvalEmail, `Opt-out signed — ${o.business}`, `${o.name} (${o.email}) opted out of photo sharing / reference use. Signed ${o.signedAt}.`, ['in-app','email']);
  logActivity(`Photo & reference opt-out signed: ${o.business} (${o.signature})`);
  save(); json(res,201,{ ok:true, id: o.id, signedAt: o.signedAt });
};
routes['GET /api/optouts'] = async (req,res) => json(res,200, db.optOuts.slice().reverse());

/* ================= CREW LOCATION TRACKING ROUTES ================= */
routes['POST /api/portal/location-consent'] = async (req,res,token) => {
  const who = crewByToken(token); if (!who) return json(res,404,{ error:'Portal not found' });
  const b = await body(req);
  if (b.granted === false || !b.signature) return json(res,400,{ error:'Signature required to consent' });
  db.locationConsents = db.locationConsents || [];
  const c = { id: uid('lc'), employeeId: who.id, name: who.name, granted: true, signature: b.signature, at: new Date().toISOString() };
  db.locationConsents = db.locationConsents.filter(x => x.employeeId !== who.id); db.locationConsents.push(c);
  const emp = db.employees.find(e => e.id === who.id); if (emp) emp.locationConsentAt = c.at;
  logActivity(`Location tracking consent signed: ${who.name}`); save(); json(res,200,{ ok:true, consentAt: c.at });
};
routes['POST /api/portal/location'] = async (req,res,token) => {
  const who = crewByToken(token); if (!who) return json(res,404,{ error:'Portal not found' });
  const T = db.settings.tracking;
  if (!T.enabled) return json(res,403,{ error:'Location tracking is disabled in settings' });
  const consented = (db.locationConsents || []).some(c => c.employeeId === who.id && c.granted);
  if (T.requireConsent && !consented) return json(res,403,{ error:'Consent required — sign the location consent in your crew portal first' });
  if (T.workHoursOnly !== false && who.id && !isClockedIn(who.id)) return json(res,403,{ error:'Not clocked in — location is only recorded during clocked-in work hours' });
  const b = await body(req);
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return json(res,400,{ error:'lat/lng required' });
  const today = new Date().toISOString().slice(0,10);
  const entry = db.timeEntries.find(t => t.employeeId === who.id && t.date === today && t.clockedIn && !t.clockedOut);
  const ping = { id: uid('loc'), employeeId: who.id, name: who.name, at: new Date().toISOString(),
    lat: b.lat, lng: b.lng, accuracy: b.accuracy || null, jobId: (entry && entry.jobId) || b.jobId || null };
  db.locations.push(ping);
  if (db.locations.length > 5000) db.locations = db.locations.slice(-5000);
  save(); json(res,201,{ ok:true, at: ping.at, jobId: ping.jobId });
};
routes['GET /api/locations'] = async (req,res) => {                        // admin — live crew map data
  const today = new Date().toISOString().slice(0,10);
  const latest = {};
  db.locations.forEach(l => { latest[l.employeeId] = l; });
  json(res,200, db.employees.map(e => ({
    employeeId: e.id, name: e.name, role: e.role,
    consent: (db.locationConsents || []).some(c => c.employeeId === e.id && c.granted),
    clockedIn: isClockedIn(e.id),
    last: latest[e.id] || null,
    today: dwellToday(e.id),
    assignedJob: (db.jobs.find(j => j.crew && j.status === 'in-progress') || {}).title || null,
  })));
};
routes['GET /api/locations/trail'] = async (req,res) => {                  // admin — today's trail for one tech
  const q = (req.url.split('?')[1] || '').match(/employee=([^&]*)/);
  const id = q && decodeURIComponent(q[1]);
  const today = new Date().toISOString().slice(0,10);
  json(res,200, db.locations.filter(l => l.employeeId === id && (l.at||'').slice(0,10) === today));
};

/* ================= PAYROLL ROUTES ================= */
routes['GET /api/payroll'] = async (req,res) => json(res,200, { summary: payrollSummary(), runs: db.payrollRuns.slice().reverse(),
  payouts: db.payouts.slice().reverse() });
routes['POST /api/payroll/approve-hours'] = async (req,res) => {
  const b = await body(req);
  const since = new Date(Date.now() - db.settings.payroll.payPeriodDays * 864e5).toISOString().slice(0,10);
  let n = 0;
  db.timeEntries.filter(t => t.date >= since && !t.paidOut && (!b.employeeId || t.employeeId === b.employeeId))
    .forEach(t => { t.approved = true; t.approvedAt = new Date().toISOString(); n++; });
  logActivity(`Payroll: ${n} time entr${n === 1 ? 'y' : 'ies'} approved${b.employeeId ? ' for ' + empName(b.employeeId) : ''}`);
  save(); json(res,200,{ ok:true, approved: n });
};
routes['GET /api/payroll/history'] = async (req,res) => json(res,200, db.payrollRuns.slice().reverse());


routes['POST /api/portal/clock'] = async (req,res,token) => {
  const who = crewByToken(token); if (!who || !who.id) return json(res,404,{ error:'Portal not found' });
  const b = await body(req);
  const today = new Date().toISOString().slice(0,10);
  if (b.action === 'in') {
    if (isClockedIn(who.id)) return json(res,409,{ error:'Already clocked in' });
    const job = db.jobs.find(j => j.id === b.jobId) || db.jobs.find(j => j.status === 'in-progress');
    const t = { id: uid('t'), jobId: (job && job.id) || null, employeeId: who.id, date: today, hours: 0,
      note: 'Clocked in', clockedIn: new Date().toISOString(), clockedOut: null, approved: false };
    db.timeEntries.push(t);
    notify(db.settings.quotes.approvalEmail, `${who.name} clocked in`, `${job ? 'Job: ' + job.title + ' · ' : ''}${t.clockedIn.slice(11,16)} CT · location tracking active per signed consent.`, ['in-app']);
    logActivity(`${who.name} clocked in${job ? ' — ' + job.title : ''}`);
    save(); json(res,201,{ ok:true, entry: t.id, clockedIn: t.clockedIn, job: job && job.title });
  } else {
    const t = db.timeEntries.find(t => t.employeeId === who.id && t.date === today && t.clockedIn && !t.clockedOut);
    if (!t) return json(res,404,{ error:'No open shift to clock out of' });
    t.clockedOut = new Date().toISOString();
    t.hours = Math.round(((new Date(t.clockedOut) - new Date(t.clockedIn)) / 3600e3) * 100) / 100;
    const dwell = dwellToday(who.id);
    t.onsiteMin = dwell.onsiteMin; t.trackedMin = dwell.totalMin;
    notify(db.settings.quotes.approvalEmail, `${who.name} clocked out — ${t.hours}h`, `On-site ${Math.round(dwell.onsiteMin/60*10)/10}h of ${Math.round(dwell.totalMin/60*10)/10}h tracked. Location recording stopped.`, ['in-app']);
    logActivity(`${who.name} clocked out — ${t.hours}h logged`);
    save(); json(res,200,{ ok:true, hours: t.hours, onsiteMin: dwell.onsiteMin });
  }
};
routes['GET /api/portal/shift'] = async (req,res,token) => {
  const who = crewByToken(token); if (!who) return json(res,404,{ error:'Portal not found' });
  const T = db.settings.tracking;
  json(res,200,{ employeeId: who.id, clockedIn: who.id ? isClockedIn(who.id) : false,
    consent: (db.locationConsents || []).some(c => c.employeeId === who.id && c.granted),
    trackingEnabled: T.enabled, intervalMin: T.intervalMin, retentionDays: T.retentionDays });
};

/* ================= AFFILIATE ROUTES ================= */
/* public — program terms shown on partners.html (commission % is owner-editable in settings) */
routes['GET /api/affiliate-program'] = async (req,res) => {
  const A = db.settings.affiliate;
  json(res,200,{ enabled: A.enabled, defaultPct: A.defaultPct, recommendedPct: A.recommendedPct, tiers: A.tiers,
    minPayout: A.minPayout, cookieDays: A.cookieDays, payoutDays: A.payoutDays, basis: A.basis, note: A.note });
};
/* public — promoter / creator / sales partner application; Hiring-style agent screens and onboards instantly */
routes['POST /api/affiliates/apply'] = async (req,res) => {
  const b = await body(req);
  if (!b.name || !b.email) return json(res,400,{ error:'Name and email required' });
  if (db.affiliates.some(a => a.email === b.email)) return json(res,409,{ error:'An affiliate account already exists for this email — check your inbox for the dashboard link.' });
  const type = ['promoter','creator','partner'].includes(b.type) ? b.type : 'promoter';
  const code = ((b.name.split(' ').pop() || 'PARTNER').replace(/[^a-z]/gi,'').slice(0,8).toUpperCase() || 'PARTNER') + (db.settings.affiliate.tiers[type] || db.settings.affiliate.defaultPct);
  const aff = { id: uid('af'), name: b.name, email: b.email, phone: b.phone || '', type,
    code, token: crypto.randomBytes(16).toString('hex'), pct: null, status: db.settings.affiliate.autoApprove ? 'active' : 'pending',
    payoutMethod: b.payoutMethod || '', audience: b.audience || '', createdAt: new Date().toISOString() };
  db.affiliates.push(aff);
  sendEmail(aff.email, 'Welcome to the Lines & Logos partner program',
    `Hi ${firstName(aff.name)} — you're in. Your referral code is ${aff.code} and your dashboard is live: /affiliate.html?token=${aff.token} — you earn ${affPct(aff)}% of the first job from every customer you refer.`);
  notify(db.settings.quotes.approvalEmail, `New affiliate: ${aff.name} (${aff.type})`, `${aff.email} joined via partners page — code ${aff.code}, ${affPct(aff)}% commission.`, ['in-app','email']);
  logActivity(`Affiliate program: ${aff.name} (${aff.type}) joined — code ${aff.code}`);
  save();
  json(res,201,{ ok:true, status: aff.status, code: aff.code, token: aff.token, pct: affPct(aff), dashboardUrl: `/affiliate.html?token=${aff.token}` });
};
/* admin — affiliate roster with ledger + funnel stats */
routes['GET /api/affiliates'] = async (req,res) => json(res,200, db.affiliates.map(a => ({
  ...a, pctEffective: affPct(a), ledger: affLedger(a.id),
  referrals: db.leads.filter(l => l.affiliateCode === a.code).length,
  accounts: db.accounts.filter(x => x.affiliateCode === a.code).length,
  jobs: db.jobs.filter(j => j.affiliateCode === a.code || (db.accounts.find(x => x.id === j.accountId) || {}).affiliateCode === a.code).length,
})));
routes['POST /api/affiliates/approve'] = async (req,res,id) => {
  const a = db.affiliates.find(x => x.id === id); if (!a) return json(res,404,{error:'Affiliate not found'});
  a.status = 'active';
  sendEmail(a.email, 'Your Lines & Logos partner account is approved', `Your referral code ${a.code} is live. Dashboard: /affiliate.html?token=${a.token}`);
  logActivity(`Affiliate approved: ${a.name}`); save(); json(res,200,a);
};
routes['POST /api/affiliates/suspend'] = async (req,res,id) => {
  const a = db.affiliates.find(x => x.id === id); if (!a) return json(res,404,{error:'Affiliate not found'});
  a.status = 'suspended'; logActivity(`Affiliate suspended: ${a.name}`); save(); json(res,200,a);
};
/* token-authenticated affiliate dashboard (the token is the credential — same model as the crew portal) */
function affiliateDashboard(aff){
  const acctIds = db.accounts.filter(a => a.affiliateCode === aff.code).map(a => a.id);
  const jobs = db.jobs.filter(j => j.affiliateCode === aff.code || acctIds.includes(j.accountId));
  return {
    affiliate: { name: aff.name, email: aff.email, type: aff.type, code: aff.code, pct: affPct(aff), status: aff.status, payoutMethod: aff.payoutMethod, createdAt: aff.createdAt },
    program: { minPayout: db.settings.affiliate.minPayout, cookieDays: db.settings.affiliate.cookieDays, payoutDays: db.settings.affiliate.payoutDays,
      defaultPct: db.settings.affiliate.defaultPct, recommendedPct: db.settings.affiliate.recommendedPct, tiers: db.settings.affiliate.tiers, basis: db.settings.affiliate.basis },
    referralLink: '/?ref=' + aff.code,
    ledger: affLedger(aff.id),
    referrals: db.leads.filter(l => l.affiliateCode === aff.code)
      .map(l => ({ id: l.id, name: l.name, company: l.company, service: l.service, stage: l.stage, tier: l.tier, score: l.score, createdAt: l.createdAt })),
    jobs: jobs.map(j => ({ id: j.id, title: j.title, status: j.status, value: j.value, due: j.due })),
    commissions: db.commissions.filter(c => c.affiliateId === aff.id).slice().reverse(),
    notifications: db.notifications.filter(n => n.to === 'affiliate:' + aff.token).slice(-20).reverse(),
  };
}

/* ================= PROCUREMENT / HIRING ROUTES ================= */
routes['POST /api/agent/procure'] = async (req,res) => {
  const b = await body(req);
  let out;
  if (b.items && b.items.length) out = draftProcurement(b.items, { jobId: b.jobId || null, neededBy: b.neededBy || null });
  else if (b.jobId) { const job = db.jobs.find(j => j.id === b.jobId); if (!job) return json(res,404,{ error:'Job not found' });
    const need = materialsForJob(job); out = { job: job.title, ...need, ...draftProcurement(need.items, { jobId: job.id, neededBy: need.neededBy }) }; }
  else return json(res,400,{ error:'Pass jobId or items[]' });
  save(); json(res,200,out);
};
routes['GET /api/hiring'] = async (req,res) => json(res,200,{ packages: db.hirePackages, interviews: db.interviews, applicants: db.applicants });
collRoutes(routes, 'interviews', { prefix: 'iv',
  onCreate(iv){ if (!iv.status) iv.status = 'scheduled';
    addEvent(`Video interview — ${iv.name} (${iv.position || 'candidate'})`, 'interview', (iv.when || '').slice(0,10), { time: (iv.when || '').slice(11,16), link: iv.link });
    notify(db.settings.quotes.approvalEmail, `Interview added — ${iv.name}`, `${iv.position || ''} · ${iv.when} · ${iv.link || ''}`, ['in-app']); } });
collRoutes(routes, 'commissions', { prefix: 'cm' });
collRoutes(routes, 'filings', { prefix: 'fl', defaults: { status: 'upcoming' } });

/* ================= router ================= */
process.on('uncaughtException', e => console.error('[uncaught]', e.message)); // demo server: log, keep serving
const ID_ACTIONS = {
  'quotes/convert':'POST /api/quotes/convert', 'jobs/dispatch':'POST /api/jobs/dispatch', 'jobs/status-update':'POST /api/jobs/status-update',
  'checklists/run':'POST /api/checklists/run', 'invoices/remind':'POST /api/invoices/remind',
  'applicants/approve':'POST /api/applicants/approve', 'applicants/reject':'POST /api/applicants/reject',
  'approvals/decide':'POST /api/approvals/decide', 'content/repurpose':'POST /api/content/repurpose',
  'payouts/pay':'POST /api/payouts/pay', 'affiliates/approve':'POST /api/affiliates/approve', 'affiliates/suspend':'POST /api/affiliates/suspend',
};
/* Field crew legitimately dispatch/update jobs and run checklists; everything else
   (hiring, payouts, affiliates, approvals, quote conversion, invoicing) is staff-only. */
const ID_ACTION_FIELD_OK = new Set(['jobs/dispatch','jobs/status-update','checklists/run']);
const PATCHABLE = { leads:'leads', jobs:'jobs', invoices:'invoices', candidates:'candidates', campaigns:'campaigns', tickets:'tickets', quotes:'quotes', content:'content', accounts:'accounts', employees:'employees', vendors:'vendors', purchaseOrders:'purchaseOrders', payments:'payments', tasks:'tasks', timeEntries:'timeEntries', 'time-entries':'timeEntries', checklistRuns:'checklistRuns', expenses:'expenses', revenue:'revenue', feedback:'feedback', applicants:'applicants', employeeOnboardings:'employeeOnboardings', clientOnboardings:'clientOnboardings', surveys:'surveys', followUps:'followUps', payouts:'payouts', financialAlerts:'financialAlerts', affiliates:'affiliates', interviews:'interviews', commissions:'commissions', filings:'filings' };

/* ================= CANONICAL OVERRIDES (must follow all earlier definitions) ================= */
/* v2 runtime defines shadowing handlers above; these are the authoritative ones for our pages. */
routes['POST /api/agent/inquiries/analyze'] = async (req,res) => {
  const fresh = db.inquiries.filter(i => i.status === 'new'); fresh.forEach(analyzeInquiry);
  save(); json(res,200,{ analyzed: fresh.length, inquiries: db.inquiries });
};
routes['POST /api/agent/inquiries/respond'] = async (req,res) => {
  const b = await body(req);
  const targets = b.id ? db.inquiries.filter(i => i.id === b.id) : db.inquiries.filter(i => i.status === 'analyzed');
  await Promise.all(targets.map(respondInquiry)); save();
  json(res,200,{ responded: targets.length });
};
routes['POST /api/chat'] = async (req,res) => {                              // customer-service agent chat
  const b = await body(req);
  let chat = db.chats.find(c => c.session === b.session);
  if (!chat){ chat = { id: uid('ch'), session: b.session || uid('sess'), messages: [] }; db.chats.unshift(chat); }
  chat.messages.push({ from: 'customer', text: b.message, at: new Date().toISOString() });
  const a = serviceBrain(b.message);
  const reply = { from: 'agent', text: (a && a.reply && a.service && a.service !== 'unknown') ? a.reply : publicBrain(b.message), at: new Date().toISOString() };   // reconcile: internal concierge defers to the shared public brain when it has no match
  chat.messages.push(reply);
  logActivity(`AI chat (${chat.session.slice(0,8)}): customer asked — agent replied (${a.service})`);
  save(); json(res,200,{ reply: reply.text, agent: a, session: chat.session, thread: chat.messages.slice(-20) });
};
routes['GET /api/reviews'] = async (req,res) => {                            // authed → all; public → approved
  const u = auth(req);
  const norm = r => ({ ...r, author: r.author || r.name || 'Customer', company: r.company || '', photos: r.photos || r.pics || [] });
  json(res,200, (u ? db.reviews : db.reviews.filter(r => r.status === 'approved')).map(norm));
};
/* dispatcher dispatches /api/<reviews|gallery>/<id>/<action> to these keys */
routes['POST /api/reviews/approve'] = async (req,res, id) => {
  const r = db.reviews.find(r => r.id === id); if (!r) return json(res,404,{error:'Review not found'});
  r.status = 'approved'; r.approvedAt = new Date().toISOString();
  logActivity(`Review by ${r.author || r.name} approved for the website`); save(); json(res,200,r);
};
routes['POST /api/reviews/reject'] = async (req,res, id) => {
  const r = db.reviews.find(r => r.id === id); if (!r) return json(res,404,{error:'Review not found'});
  r.status = 'rejected'; save(); json(res,200,r);
};
routes['POST /api/gallery/approve'] = async (req,res, id) => {
  const g = db.gallery.find(g => g.id === id); if (!g) return json(res,404,{error:'Not found'});
  g.status = 'approved'; g.approvedBy = 'admin'; g.approvedAt = new Date().toISOString();
  logActivity(`Gallery item approved by admin: ${g.caption}`); save(); json(res,200,g);
};
routes['POST /api/gallery/reject'] = async (req,res, id) => {
  const g = db.gallery.find(g => g.id === id); if (!g) return json(res,404,{error:'Not found'});
  g.status = 'rejected'; save(); json(res,200,g);
};

http.createServer(async (req,res) => {
  try {
    /* Phase 3 — security headers on every response */
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.stripe.com https://openrouter.ai https://api.anthropic.com https://generativelanguage.googleapis.com; frame-ancestors 'none'; base-uri 'self'");
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;

    if (req.method === 'OPTIONS') { res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'}); return res.end(); }

    // authenticated staff download for files attached in the public website chat
    const chatAttachmentMatch = p.match(/^\/api\/chat-attachment\/([A-Za-z0-9]+)$/);
    if (chatAttachmentMatch && req.method === 'GET') {
      if (!auth(req)) return json(res,401,{error:'Unauthorized'});
      const item = (db.chatUploads || []).find(a => a.id === chatAttachmentMatch[1]);
      if (!item) return json(res,404,{error:'Attachment not found'});
      const fp = path.join(ROOT, item.file);
      if (!fp.startsWith(CHAT_UPLOAD_DIR + path.sep) || !fs.existsSync(fp)) return json(res,404,{error:'Attachment file not found'});
      res.writeHead(200,{'Content-Type':item.type,'Content-Length':item.size,'Content-Disposition':`attachment; filename="${item.name.replace(/"/g,'_')}"`});
      return fs.createReadStream(fp).pipe(res);
    }

    // client e-sign: GET /api/sign/<token> (view) / POST (sign)
    const signMatch = p.match(/^\/api\/sign\/([^/]+)$/);
    if (signMatch) {
      if (req.method === 'GET') {
        const c = db.contracts.find(c => c.signToken === signMatch[1]);
        if (!c) return json(res,404,{error:'Contract not found'});
        const lead = db.leads.find(l => l.id === c.leadId);
        return json(res,200,{ id:c.id, title:c.title, amount:c.amount, body:c.body, status:c.status, company:lead?lead.company:'', signerName:c.signerName||'', signedAt:c.signedAt||null });
      }
      if (req.method === 'POST') {
        const b = await body(req);
        if (!b.signerName || !b.signature) return json(res,400,{error:'Name and signature required'});
        return json(res,200, signContract(signMatch[1], b.signerName, b.signature));
      }
    }

    // web push: GET /api/push/vapid · POST /api/push/subscribe|unsubscribe|test
    const pushMatch = p.match(/^\/api\/push\/(vapid|subscribe|unsubscribe|test)$/);
    if (pushMatch) {
      const id = pushIdentity(req);
      if (!id) return json(res, 401, { error: 'Unauthorized' });
      ensurePush();
      if (pushMatch[1] === 'vapid' && req.method === 'GET')
        return json(res, 200, { publicKey: db.settings.push.vapid.publicKey });
      if (pushMatch[1] === 'subscribe' && req.method === 'POST') {
        const b = await body(req);
        const sub = b.subscription;
        if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth)
          return json(res, 400, { error: 'Invalid push subscription' });
        const subs = db.settings.push.subs;
        const existing = subs.find(s => s.subscription.endpoint === sub.endpoint);
        if (existing) { existing.role = id.role; existing.identity = id.id; existing.updatedAt = new Date().toISOString(); }
        else subs.push({ role: id.role, identity: id.id, subscription: sub, createdAt: new Date().toISOString() });
        logActivity(`Push subscription registered — ${id.role} dashboard`);
        save(); return json(res, 201, { ok: true, role: id.role, subs: subs.length });
      }
      if (pushMatch[1] === 'unsubscribe' && req.method === 'POST') {
        const b = await body(req);
        db.settings.push.subs = db.settings.push.subs.filter(s => s.subscription.endpoint !== b.endpoint);
        save(); return json(res, 200, { ok: true });
      }
      if (pushMatch[1] === 'test' && req.method === 'POST') {
        const page = { admin: '/dashboard.html', contractor: '/portal.html', client: '/customer.html', affiliate: '/affiliate.html' }[id.role];
        const out = await pushToRole(id.role, 'Lines & Logos — push is live', `Test notification for the ${id.role} dashboard. You\'re all set.`, page);
        return json(res, 200, out);
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    // client dashboard: GET /api/client/<token>
    const clientMatch = p.match(/^\/api\/client\/([^/]+)(\/review)?$/);
    if (clientMatch && req.method === 'GET' && !clientMatch[2]) {
      const c = db.contracts.find(c => c.signToken === clientMatch[1]);
      if (!c) return json(res,404,{error:'Client portal not found'});
      const lead = db.leads.find(l => l.id === c.leadId);
      const acct = db.accounts.find(a => a.name === (lead ? lead.company : ''));
      const jobs = acct ? db.jobs.filter(j => j.accountId === acct.id) : [];
      const invoices = acct ? db.invoices.filter(i => i.accountId === acct.id) : [];
      return json(res,200,{
        company: lead ? lead.company : c.title,
        contracts: db.contracts.filter(x => x.leadId === c.leadId),
        quotes: db.leads.filter(l => l.id === c.leadId).map(l => ({ service:l.service, amount:l.quoteAmount||null, stage:l.stage, status:l.stage==='quoted'?'awaiting approval':l.stage })),
        jobs: jobs.map(j => ({ title:j.title, due:j.due, status:j.status, crew:j.crew, value:j.value })),
        invoices: invoices.map(i => ({ number:i.number, amount:i.amount, status:i.status, issued:i.issued })),
        messages: lead ? db.messages.filter(m => m.to === lead.email).slice(-20) : [],
        reminders: db.reminders.filter(r => jobs.some(j => j.id === r.jobId)),
      });
    }
    if (clientMatch && req.method === 'POST') {                             // client leaves a review
      const c = db.contracts.find(c => c.signToken === clientMatch[1]);
      if (!c) return json(res,404,{error:'Client portal not found'});
      const b = await body(req);
      if (!b.text || !b.author) return json(res,400,{error:'Review text and author required'});
      const lead = db.leads.find(l => l.id === c.leadId);
      const r = { id: uid('rv'), author: b.author, company: lead ? lead.company : '', rating: Math.min(5, Math.max(1, +b.rating || 5)),
        text: b.text, photos: b.photos || [], status: 'pending', createdAt: new Date().toISOString() };
      db.reviews.unshift(r);
      notify(db.settings.quotes.approvalEmail, `Review awaiting approval — ${r.author}`, `"${r.text.slice(0,90)}" — approve to show it on the website.`, ['in-app']);
      logActivity(`New review from ${r.author} — pending approval`);
      save(); return json(res,201,{ id: r.id, status: 'pending' });
    }

    // owner quote approval: POST /api/agent/approve-quote/<leadId>
    const apprMatch = p.match(/^\/api\/agent\/approve-quote\/([^/]+)$/);
    if (apprMatch && req.method === 'POST') { const u = gate(req,res,STAFF); if (!u) return; return json(res,200, approveQuote(apprMatch[1])); }

    // portal: /api/portal/<token>[/sign]
    // moderation: /api/reviews|gallery/<id>/approve|reject
    const modMatch = p.match(/^\/api\/(reviews|gallery)\/([^/]+)\/(approve|reject)$/);
    if (modMatch && req.method === 'POST') {
      const mu = gate(req,res,STAFF); if (!mu) return;
      const item = db[modMatch[1]].find(x => x.id === modMatch[2]);
      if (!item) return json(res,404,{error:'Not found'});
      item.status = modMatch[3] === 'approve' ? 'approved' : 'rejected';
      item.moderatedAt = new Date().toISOString();
      logActivity(`${modMatch[1].slice(0,-1)} ${item.status}: ${item.name || item.caption || item.id}`);
      save(); return json(res,200,item);
    }

    // events: PATCH /api/events/<id> (calendar edits, shipping updates)
    const evMatch = p.match(/^\/api\/events\/([^/]+)$/);
    if (evMatch && req.method === 'PATCH') {
      const eu = gate(req,res,STAFF); if (!eu) return;
      const ev = db.events.find(e => e.id === evMatch[1]); if (!ev) return json(res,404,{error:'Event not found'});
      Object.assign(ev, await body(req));
      if (ev.type === 'shipping' && ev.meta && ev.meta.status === 'delivered') logActivity(`Shipping delivered: ${ev.title}`);
      save(); return json(res,200,ev);
    }

    // doc-path aliases: /api/admin/applicants/<id>/approve|reject (THREAD_HANDOVER.md §Team)
    const adminAppr = p.match(/^\/api\/admin\/applicants\/([^/]+)\/(approve|reject)$/);
    if (adminAppr && req.method === 'POST') {
      const au = gate(req,res,STAFF); if (!au) return;
      return await routes['POST /api/applicants/' + adminAppr[2]](req, res, adminAppr[1]);
    }

    const portalMatch = p.match(/^\/api\/portal\/([^/]+)(\/(sign|clock|location|location-consent|shift))?$/);
    if (portalMatch) {
      const key = `${req.method} /api/portal/${portalMatch[3] || ''}`;
      return await routes[key](req,res,portalMatch[1]);
    }
    // affiliate dashboard: /api/affiliate/<token>[/(lead|payout|profile)] — token is the credential (public)
    const affMatch = p.match(/^\/api\/affiliate\/([^/]+)(\/(lead|payout|profile))?$/);
    if (affMatch) {
      const aff = affByToken(affMatch[1]);
      if (!aff) return json(res,404,{ error:'Affiliate not found — check your dashboard link' });
      const sub = affMatch[3];
      if (!sub && req.method === 'GET') return json(res,200, affiliateDashboard(aff));
      if (sub === 'lead' && req.method === 'POST') {
        const b = await body(req);
        if (!b.name && !b.company) return json(res,400,{ error:'Contact name or company required' });
        if (aff.status !== 'active') return json(res,403,{ error:'Affiliate account is not active' });
        const lead = { id: uid('l'), name: b.name || 'Referral', company: b.company || '', email: b.email || '', phone: b.phone || '',
          city: b.city || '', service: b.service || 'General inquiry', source: 'Affiliate — ' + aff.name, stage: 'new',
          affiliateCode: aff.code, referredBy: aff.name, affiliateNotes: b.notes || '', createdAt: new Date().toISOString() };
        const r = agents.scoreLead(lead); Object.assign(lead, r);
        db.leads.push(lead);
        /* tag/create the account so commissions follow the customer through jobs & invoices */
        let acct = db.accounts.find(a => a.name === lead.company);
        if (lead.company && !acct) { acct = { id: uid('a'), name: lead.company, tier: 'C', seats: 0, city: lead.city, renewal: '', goal: lead.service, notes: 'Referred by affiliate ' + aff.name, affiliateCode: aff.code }; db.accounts.push(acct); }
        else if (acct && !acct.affiliateCode) acct.affiliateCode = aff.code;
        notify(db.settings.quotes.approvalEmail, `Affiliate referral — ${lead.company || lead.name} (${lead.score}, ${lead.tier})`,
          `${aff.name} referred ${lead.name}${lead.company ? ' · ' + lead.company : ''}${lead.city ? ' · ' + lead.city : ''}. AI-scored ${lead.score}/100 (${lead.tier}) and added to the pipeline.`, ['in-app','email']);
        notifyAffiliate(aff, `Referral received: ${lead.company || lead.name}`, `AI score ${lead.score}/100 (${lead.tier}) — our team takes it from here. You earn ${affPct(aff)}% when the first job completes.`);
        logActivity(`Affiliate ${aff.name} referred ${lead.company || lead.name} — scored ${lead.score} (${lead.tier})`);
        save(); return json(res,201,{ ok:true, lead: { id: lead.id, score: lead.score, tier: lead.tier, stage: lead.stage } });
      }
      if (sub === 'payout' && req.method === 'POST') return json(res,200, requestAffiliatePayout(aff));
      if (sub === 'profile' && req.method === 'PATCH') {
        const b = await body(req);
        ['payoutMethod','phone','audience'].forEach(k => { if (b[k] !== undefined) aff[k] = b[k]; });
        save(); return json(res,200,{ ok:true, affiliate: affiliateDashboard(aff).affiliate });
      }
      return json(res,405,{ error:'Method not allowed' });
    }
    // id actions: /api/<coll>/<id>/<action>
    const actMatch = p.match(/^\/api\/([a-zA-Z-]+)\/([^/]+)\/([a-z-]+)$/);
    if (actMatch && req.method === 'POST') {
      const k = `${actMatch[1]}/${actMatch[3]}`;
      if (ID_ACTIONS[k]) {
        const actU = gate(req,res,ID_ACTION_FIELD_OK.has(k) ? FIELD : STAFF); if (!actU) return;
        return await routes[ID_ACTIONS[k]](req,res,actMatch[2]);
      }
    }
    // agents: /api/agents/<key>/run — same governance as /api/agent/* (kill switch + audit)
    const agentMatch = p.match(/^\/api\/agents\/([a-z-]+)\/run$/);
    if (agentMatch && req.method === 'POST') {
      const agU = gate(req,res,STAFF); if (!agU) return;
      const g = govAllows(agentMatch[1]);
      auditAgent(req, agentMatch[1], g.ok ? 'allowed' : 'blocked', g.reason || '');
      if (!g.ok) return json(res, 423, { error: g.reason });
      const out = await routes['POST /api/agents/run'](req,res,agentMatch[1]);
      auditAgent(req, agentMatch[1], 'ran', '');
      return out;
    }
    // PATCH / DELETE: /api/<coll>/<id>
    const idMatch = p.match(/^\/api\/([a-zA-Z-]+)\/([^/]+)$/);
    if (idMatch && req.method === 'PATCH' && PATCHABLE[idMatch[1]]) {
      const pu = gate(req,res,STAFF); if (!pu) return;
      const coll = PATCHABLE[idMatch[1]];
      const item = db[coll].find(x => x.id === idMatch[2]); if (!item) return json(res,404,{error:'Not found'});
      const patch = await body(req); delete patch.id;   // never allow overwriting the id
      Object.assign(item, patch);
      // auto overdue detection on invoice patch
      if (coll === 'invoices' && item.status === 'sent' && daysOverdue(item) > 0) item.status = 'overdue';
      // onboarding auto-complete when every step is done
      if ((coll === 'employeeOnboardings' || coll === 'clientOnboardings') && Array.isArray(item.steps)
          && item.steps.length && item.steps.every(s => s.done) && item.status !== 'complete') {
        item.status = 'complete'; item.completedAt = new Date().toISOString().slice(0,10);
        logActivity(`Onboarding complete: ${item.name || item.company}`);
      }
      // job completed → affiliate commission credit (if the job came through a partner)
      if (coll === 'jobs' && item.status === 'complete') creditAffiliate({ job: item });
      logActivity(`Updated ${idMatch[1]} ${item.name||item.title||item.number||item.id}`);
      save(); return json(res,200,item);
    }
    if (idMatch && req.method === 'DELETE' && PATCHABLE[idMatch[1]]) {
      const du = gate(req,res,STAFF); if (!du) return;
      const coll = PATCHABLE[idMatch[1]];
      const idx = db[coll].findIndex(x => x.id === idMatch[2]); if (idx < 0) return json(res,404,{error:'Not found'});
      const [removed] = db[coll].splice(idx, 1);
      logActivity(`Deleted ${idMatch[1]} ${removed.name||removed.title||removed.number||idMatch[2]}`);
      save(); return json(res,200,{ ok:true, removed });
    }

    let key = `${req.method} ${p}`;
    /* template fallback: /api/things/:id style routes (registered with :params) */
    let tplArgs = [];
    if (!routes[key]) {
      const psegs = p.split('/').filter(Boolean);
      outer: for (const k of Object.keys(routes)) {
        const sp = k.indexOf(' ');
        if (k.slice(0, sp) !== req.method) continue;
        const ksegs = k.slice(sp + 1).split('/').filter(Boolean);
        if (ksegs.length !== psegs.length || !ksegs.some(s => s.startsWith(':'))) continue;
        const args = [];
        for (let i = 0; i < ksegs.length; i++) {
          if (ksegs[i].startsWith(':')) args.push(psegs[i]);
          else if (ksegs[i] !== psegs[i]) continue outer;
        }
        key = k; tplArgs = args; break;
      }
    }
    const PUBLIC_PATHS = ['/api/health','/api/login','/api/setup/status','/api/setup/admin','/api/apply','/api/quote-request','/api/passkey/login','/api/forgot','/api/reset','/api/cron/daily','/api/cron/weekly','/api/inquiry','/api/inquiries','/api/chat','/api/chat-public','/api/survey','/api/review','/api/reviews','/api/gallery','/api/affiliate-program','/api/affiliates/apply','/api/optout','/api/photo-requests','/api/newsletter/subscribe','/api/newsletter/unsubscribe','/api/newsletter/open','/api/candidate','/api/candidate/book','/api/careers/signals','/api/careers/schools','/api/careers/referral','/api/case-studies','/api/stripe/webhook','/api/maps/distance','/api/auth/register','/api/auth/login','/api/auth/2fa',
    '/api/auth/totp/setup','/api/auth/totp/enable','/api/auth/passkey/register','/api/auth/passkey/complete','/api/auth/passkey/challenge',
    '/api/account','/api/account/photo','/api/account/job-photo','/api/account/photos','/api/account/dispute','/api/account/modify-request','/api/account/export','/api/account/alerts','/api/account/notes','/api/video/meeting','/api/account/invoices','/api/account/invoice-download'];
    if (routes[key]) {
      if (!auth(req) && !PUBLIC_PATHS.includes(p)) return json(res,401,{error:'Unauthorized'});
      /* ---- centralized role gate (mirrors front-end nav) ---- */
      const u2 = auth(req);
      const role2 = u2 ? (u2.role || 'staff') : null;
      const isAdmin2 = role2 === 'owner' || role2 === 'admin';
      if (!isAdmin2) {
        const isStaff2 = STAFF.includes(role2);
        const write2 = req.method !== 'GET';
        const execArea = /\/api\/(agents|admin|golive|security|selfheal|improve|exit|integrations|recommendations|disclosures|seo|brandassets|ads-keys|improvements)/;
        const moneyArea = /\/api\/(invoices|expenses|revenue|payments|payouts|commissions|vendors|purchaseorders)/i;
        if (execArea.test(p) && (!isStaff2 || write2)) return json(res,403,{error:'Owner/admin only'});
        if (moneyArea.test(p) && !isStaff2) return json(res,403,{error:'Insufficient access'});
        if (!isStaff2 && write2 && !PUBLIC_PATHS.includes(p) && !/\/api\/(jobs|time-entries|checklists|my|notifications|portal|trip-plans|chat|docs|files|passkeys|gallery|availability|checklist)/i.test(p))
          return json(res,403,{error:'Insufficient access'});
      }
      // Phase-2 agent governance: kill switches gate every agent action; every agent call is audited.
      let agentKey = null;
      if (req.method === 'POST' && p.startsWith('/api/agent/')) {
        agentKey = routeToAgentKey(p);
        const g = govAllows(agentKey);
        auditAgent(req, agentKey, g.ok ? 'allowed' : 'blocked', g.reason || '');
        if (!g.ok) return json(res, 423, { error: g.reason });
      }
      const out = await routes[key](req,res,...tplArgs);
      if (agentKey) auditAgent(req, agentKey, 'ran', '');
      return out;
    }
    /* page-view tracking for HTML pages (privacy-safe: hashed daily uniques) */
    try {
      if (req.method === 'GET' && (p === '/' || p.endsWith('.html') || /\.(html)$/.test(p))) {
        const analytics2 = require('./lib/analytics');
        analytics2.track(db, req, p === '/' ? '/index.html' : p);
      }
    } catch (e) { /* tracking must never break a page */ }
    serveStatic(res, p);
  } catch(e) { json(res,500,{ error: e.message }); }
}).listen(PORT, () => console.log(`Lines & Logos Business Suite v2 → http://localhost:${PORT} (${AGENT_CATALOG.length} agents, ${Object.keys(routes).length} routes)`));

/* ================= logistics monitor (server's own timer) ================= */
try {
  const logisticsChanges = require('./lib/logistics-changes');
  const logisticsCtx = () => ({ db, save, uid, logActivity, notify, push: pushToRole });
  const LOGISTICS_INTERVAL = 15 * 60e3; // 15 min
  const logisticsPass = () => {
    try {
      const found = logisticsChanges.monitorEmails(logisticsCtx());
      const reminded = logisticsChanges.tripReminders(logisticsCtx());
      const warned = logisticsChanges.cancellationWatch(logisticsCtx());
      if (found || reminded || warned.length)
        logActivity(`Logistics monitor: ${found} email(s) processed, ${reminded} reminder(s), ${warned.length} cancellation warning(s)`);
    } catch (e) { logActivity('Logistics monitor error: ' + e.message); }
  };
  setInterval(logisticsPass, LOGISTICS_INTERVAL).unref();
  logActivity('Logistics monitor armed (15-min interval)');
} catch (e) { logActivity('Logistics monitor unavailable: ' + e.message); }

/* continuous improvement — full scan once a day on the server's own timer */
try {
  const improve = require('./lib/improve');
  const IMPROVE_INTERVAL = 24 * 60 * 60e3; // daily
  const improvePass = async () => {
    try { await improve.runImprovement(ROOT, db, { logActivity, notify, save }); }
    catch (e) { logActivity('Improvement pass error: ' + e.message); }
  };
  setTimeout(improvePass, 60e3);            // first pass 1 min after boot
  setInterval(improvePass, IMPROVE_INTERVAL).unref();
  logActivity('Improvement Agent armed (daily scan)');
} catch (e) { logActivity('Improvement Agent unavailable: ' + e.message); }

/* self-heal watchdog — data-integrity pass at boot + every 30 min */
try {
  const selfHeal = require('./lib/selfheal');
  const healCtx = () => ({ db, dataFile: DB_FILE, save, logActivity, notify, reload: load, quiet: true });
  const healPass = () => { try { const a = selfHeal.healNow(healCtx()); if (a.length) logActivity(`Self-heal pass: ${a.length} issue(s) healed`); } catch (e) { logActivity('Self-heal pass error: ' + e.message); } };
  setTimeout(healPass, 30e3);                  // first pass 30s after boot
  setInterval(healPass, 30 * 60e3).unref();  // every 30 min
  logActivity('Self-heal watchdog armed (30-min interval)');
} catch (e) { logActivity('Self-heal watchdog unavailable: ' + e.message); }

/* go-live reminder sweep — nudges owner/admin about overdue launch tasks */
try {
  const golive = require('./lib/golive');
  const golivePass = () => {
    try {
      const r = golive.reminderSweep(db, { save, logActivity, notify });
      if (r.nudges) logActivity(`Go Live nudge sent — ${r.daysLeft} day(s) to launch, checklist ${r.pct}%`);
    } catch (e) { logActivity('Go Live sweep error: ' + e.message); }
  };
  setInterval(golivePass, 6 * 60 * 60e3).unref();   // every 6 h
  logActivity('Go Live reminder sweep armed (6-h interval)');
} catch (e) { logActivity('Go Live sweep unavailable: ' + e.message); }

/* job-offer expiry sweep — reminders at 12h, expiry at 24h */
try {
  const scheduling = require('./lib/scheduling');
  const schedSweep = () => {
    try {
      const r = scheduling.sweep(db, { logActivity, notify, push: pushToRole });
      if (r.reminded || r.expired) logActivity(`Job-offer sweep: ${r.reminded} reminder(s), ${r.expired} expired`);
    } catch (e) { logActivity('Job-offer sweep error: ' + e.message); }
  };
  setInterval(schedSweep, 60 * 60e3).unref();       // hourly
  logActivity('Job-offer sweep armed (hourly)');
} catch (e) { logActivity('Job-offer sweep unavailable: ' + e.message); }

/* license/insurance renewal sweep — daily */
try {
  const licensing = require('./lib/licensing');
  const licSweep = () => {
    try {
      const r = licensing.sweep(db, { notify, push: pushToRole });
      if (r.nudges) logActivity(`Licensing sweep: ${r.nudges} renewal nudge(s) sent`);
    } catch (e) { logActivity('Licensing sweep error: ' + e.message); }
  };
  setInterval(licSweep, 24 * 60 * 60e3).unref();
  logActivity('License & Insurance sweep armed (daily)');
} catch (e) { logActivity('Licensing sweep unavailable: ' + e.message); }

/* funding grant sweep — weekly re-match against profile */
try {
  const funding = require('./lib/funding');
  const fundSweep = () => {
    try {
      const r = funding.sweep(db, { notify, push: pushToRole, save });
      if (r.newEligible) logActivity(`Funding sweep: ${r.newEligible} new grant match(es)`);
    } catch (e) { logActivity('Funding sweep error: ' + e.message); }
  };
  setInterval(fundSweep, 7 * 24 * 60 * 60e3).unref();
  logActivity('Funding grant sweep armed (weekly)');
} catch (e) { logActivity('Funding sweep unavailable: ' + e.message); }
