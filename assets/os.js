/* Lines & Logos — Business OS shared runtime (data layer + layout + demo agents)
 * Live mode: talks to server.js API. Demo mode: full local dataset persisted to
 * localStorage, with client-side versions of the 9 agent heuristics.
 */
window.OS = (() => {
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt = (n) => '$' + (+n || 0).toLocaleString();
const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - new Date(t)) / 60000)); return m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m/60) + 'h ago' : Math.round(m/1440) + 'd ago'; };
const today = () => new Date().toISOString().slice(0,10);
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0,10);

/* onboarding step templates (mirror server) */
const EMP_STEPS = [
  { key:'offer', label:'Offer letter signed' }, { key:'w9', label:'W-9 collected' },
  { key:'i9', label:'ID / I-9 verification' }, { key:'safety', label:'Safety & PPE training' },
  { key:'gear', label:'Tools & gear issued' }, { key:'portal', label:'Crew portal account activated' },
  { key:'shadow', label:'First job shadow scheduled' },
];
const CLIENT_STEPS = [
  { key:'kickoff', label:'Kickoff call completed' }, { key:'contract', label:'Contract / MSA signed' },
  { key:'deposit', label:'Deposit invoice sent' }, { key:'walkthrough', label:'Site walkthrough & measurements' },
  { key:'portal', label:'Client portal access granted' }, { key:'welcome', label:'Welcome packet delivered' },
];
const freshSteps = (tpl) => tpl.map(s => ({ ...s, done:false }));
const withProgress = (o) => { const t = (o.steps||[]).length, dn = (o.steps||[]).filter(s => s.done).length;
  return { ...o, progress: t ? Math.round(dn / t * 100) : 0, stepsDone: dn, stepsTotal: t }; };

const TOKEN = localStorage.getItem('ll_token') || '';
const USER = JSON.parse(localStorage.getItem('ll_user') || '{"name":"Trey Smith","role":"owner"}');
/* Demo mode: explicit ?demo=1 / ll_demo=1, or a file:// preview. When the live
   /api/me check fails later in boot() we also flip this on so the OS keeps
   working as a browser demo instead of redirecting to login. */
let DEMO_OK = new URLSearchParams(location.search).has('demo')
  || localStorage.getItem('ll_demo') === '1'
  || location.protocol === 'file:';
const BASE=(location.protocol==='file:')?'http://localhost:3001':'';
const IS_CLIENT = new URLSearchParams(location.search).get('view') === 'client' || USER.role === 'client';

/* ================= DEMO SEED (mirrors server seed) ================= */
function demoSeed(){
  return {
    accounts:[
      {id:'a1',name:'Memphis-Shelby County Schools',tier:'A',seats:213,city:'Memphis, TN',renewal:addDays(74),goal:'Full-facility contract — 12 gyms',notes:'District-wide vendor registration complete.'},
      {id:'a2',name:'DeSoto County School District',tier:'A',seats:42,city:'Southaven, MS',renewal:addDays(41),goal:'Gym refresh x3 + court restripes',notes:'Board approval cycle ~3 weeks.'},
      {id:'a3',name:'Bellevue Baptist Church',tier:'B',seats:0,city:'Cordova, TN',renewal:addDays(120),goal:'Donors wall + lobby wraps',notes:'Facilities committee meets monthly.'},
      {id:'a4',name:'University of Memphis — Rec Center',tier:'B',seats:0,city:'Memphis, TN',renewal:addDays(200),goal:'Annual lot striping + court surfacing',notes:'Paid first invoice same week.'},
    ],
    contacts:[
      {id:'c1',accountId:'a1',name:'Dr. Roderick Richmond',role:'Superintendent',email:'richmond@scsk12.org',phone:'901-555-0140',decisionMaker:true},
      {id:'c2',accountId:'a1',name:'Felicia Grant',role:'Facilities Director',email:'grant@scsk12.org',phone:'901-555-0148',decisionMaker:false},
      {id:'c3',accountId:'a2',name:'Angela Porter',role:'Athletic Director',email:'aporter@desotocountyschools.org',phone:'662-555-0182',decisionMaker:true},
      {id:'c4',accountId:'a3',name:'Marcus Bell',role:'Facilities Manager',email:'mbell@bellevue.org',phone:'901-555-0127',decisionMaker:true},
      {id:'c5',accountId:'a4',name:'Tasha Reed',role:'Rec Center Ops',email:'treed@memphis.edu',phone:'901-555-0190',decisionMaker:false},
    ],
    leads:[
      {id:'l1',name:'Dr. Roderick Richmond',company:'Memphis-Shelby County Schools',score:92,tier:'hot',stage:'contacted',service:'Full Facility',source:'Referral',nextStep:'Send full-facility proposal'},
      {id:'l2',name:'Angela Porter',company:'DeSoto County School District',score:87,tier:'hot',stage:'quoted',service:'Gym Refresh x3',source:'Outbound',nextStep:'Follow up on quote'},
      {id:'l3',name:'Marcus Bell',company:'Bellevue Baptist Church',score:74,tier:'warm',stage:'contacted',service:'Donors Wall + Wraps',source:'Website',nextStep:'Schedule walkthrough'},
      {id:'l4',name:'Dana Whitfield',company:'City of Little Rock Parks',score:68,tier:'warm',stage:'new',service:'Outdoor Courts (6)',source:'Website',nextStep:'Qualify budget'},
      {id:'l5',name:'Coach Reggie Sanders',company:'Huntsville HS',score:55,tier:'cold',stage:'new',service:'Court Restripe',source:'Cold call',nextStep:'Send battle card'},
    ],
    quotes:[
      {id:'q1',number:'Q-2026-001',accountId:'a2',title:'DeSoto — Court Restripe x2',amount:18900,status:'sent',sent:addDays(-8),validUntil:addDays(22)},
      {id:'q2',number:'Q-2026-002',accountId:'a1',title:'MSCS — Full Facility Proposal',amount:148000,status:'draft',sent:null,validUntil:addDays(30)},
      {id:'q3',number:'Q-2026-003',accountId:'a3',title:'Bellevue — Donors Wall Design',amount:24000,status:'sent',sent:addDays(-3),validUntil:addDays(27)},
      {id:'q4',number:'Q-2026-004',accountId:'a4',title:'U of M — Lot Striping',amount:12750,status:'accepted',sent:addDays(-25),validUntil:addDays(-10)},
    ],
    jobs:[
      {id:'j1',title:'MSCS — Gym Refresh (3 gyms)',accountId:'a1',status:'in-progress',crew:'Crew A',value:86500,due:addDays(9),progress:55,notes:'Gym 1 sanded; Gym 2 base coat.',siteLat:35.1295,siteLng:-89.9590},
      {id:'j2',title:'DeSoto — Court Restripe x2',accountId:'a2',status:'quoted',crew:'Crew B',value:18900,due:addDays(21),progress:0,notes:'Awaiting PO from district.',siteLat:34.9626,siteLng:-89.9934},
      {id:'j3',title:'Bellevue — Donors Wall Design',accountId:'a3',status:'lead',crew:null,value:24000,due:addDays(30),progress:0,notes:'Design mockup in review.',siteLat:35.1067,siteLng:-89.8731},
      {id:'j4',title:'U of M — Parking Lot Striping',accountId:'a4',status:'complete',crew:'Crew A',value:12750,due:addDays(-12),progress:100,notes:'Completed ahead of schedule.',siteLat:35.1186,siteLng:-89.9375},
    ],
    timeEntries:[
      {id:'t1',jobId:'j1',employeeId:'e1',date:addDays(-2),hours:8,note:'Gym 1 sanding complete'},
      {id:'t2',jobId:'j1',employeeId:'e2',date:addDays(-2),hours:7.5,note:'Base coat prep'},
      {id:'t3',jobId:'j1',employeeId:'e1',date:addDays(-1),hours:8,note:'Gym 2 base coat'},
      {id:'t4',jobId:'j4',employeeId:'e3',date:addDays(-13),hours:6,note:'Lot layout + striping'},
    ],
    checklists:[
      {id:'k1',name:'Gym Floor Refinishing — Safety',type:'safety',items:['Ventilation verified','Dust containment sealed','PPE on all crew','Exit paths clear','Finish batch logged']},
      {id:'k2',name:'Court Restripe — Install',type:'install',items:['Surface cleaned & taped','Game lines measured to spec','Paint cured 24h','Photos captured','Client walkthrough signed']},
    ],
    checklistRuns:[{id:'kr1',checklistId:'k1',jobId:'j1',employeeId:'e1',date:addDays(-2),completed:[true,true,true,true,false]}],
    invoices:[
      {id:'i1',number:'L&L-2026-001',accountId:'a4',amount:12750,status:'paid',issued:addDays(-20),dueDate:addDays(-6),paidDate:addDays(-8),reminders:0},
      {id:'i2',number:'L&L-2026-002',accountId:'a2',amount:9450,status:'sent',issued:addDays(-6),dueDate:addDays(24),reminders:0},
      {id:'i3',number:'L&L-2026-003',accountId:'a1',amount:43250,status:'sent',issued:addDays(-2),dueDate:addDays(28),reminders:0},
      {id:'i4',number:'L&L-2026-004',accountId:'a3',amount:6000,status:'overdue',issued:addDays(-19),dueDate:addDays(-5),reminders:1},
    ],
    expenses:[
      {id:'x1',date:addDays(-15),category:'Materials',vendor:'Sherwin-Williams Pro',amount:3240,note:'Gym finish + sealer'},
      {id:'x2',date:addDays(-11),category:'Equipment',vendor:'Sunbelt Rentals',amount:1180,note:'Sander rental (2 wks)'},
      {id:'x3',date:addDays(-7),category:'Fuel & Travel',vendor:null,amount:410,note:'Crew travel — Southaven'},
      {id:'x4',date:addDays(-4),category:'Insurance',vendor:'Next Insurance',amount:890,note:'GL policy monthly'},
      {id:'x5',date:addDays(-2),category:'Materials',vendor:'Beacon Athletics',amount:2260,note:'Court paint + tape'},
      {id:'x6',date:addDays(-1),category:'Materials',vendor:'Unknown Vendor — card ending 4471',amount:14800,note:'Bulk coating order, no PO attached'},
    ],
    payments:[
      {id:'pay1',date:addDays(-8),invoiceId:'i1',amount:12750,method:'ACH',note:'L&L-2026-001 paid in full'},
      {id:'pay2',date:addDays(-30),invoiceId:'i2',amount:2000,method:'card',note:'Deposit on L&L-2026-002'},
    ],
    revenue:[
      {id:'r1',date:addDays(-8),source:'U of M — Lot Striping',amount:12750,note:'Invoice L&L-2026-001 paid'},
      {id:'r2',date:addDays(-31),source:'DeSoto — Deposit',amount:9450,note:'Restripe deposit'},
    ],
    employees:[
      {id:'e1',name:'James Carter',role:'Floor Installer',type:'1099',w9Signed:true,rating:4.9,skills:['hardwood','sanding','finish','gym'],availability:'full-time'},
      {id:'e2',name:'Miguel Torres',role:'Vinyl / Wrap Tech',type:'1099',w9Signed:true,rating:4.7,skills:['vinyl','wraps','donors wall','signage'],availability:'full-time'},
      {id:'e3',name:'Andre Boone',role:'Striping Lead',type:'1099',w9Signed:false,rating:4.5,skills:['striping','court','paint','parking lot'],availability:'part-time'},
    ],
    applicants:[
      {id:'ap1',firstName:'Darius',lastName:'Hall',email:'dhall@example.com',phone:'901-555-0163',position:'Floor Installer',experience:'5',skills:'hardwood, sanding, finish',availability:'full-time',hasTransport:true,hasInsurance:true,coverLetter:'5 yrs gym floor refinishing across Shelby County.',references:'Sam Ortiz, 901-234-5678',aiScore:95,recommendation:'strong',status:'new',applied:addDays(-2)},
      {id:'ap2',firstName:'Kayla',lastName:'Wright',email:'kwright@example.com',phone:'901-555-0177',position:'Vinyl / Wrap Tech',experience:'2',skills:'vinyl, signage',availability:'part-time',hasTransport:true,hasInsurance:false,coverLetter:'2 yrs sign shop vinyl work.',references:'Lee Amos, 901-555-0111',aiScore:70,recommendation:'maybe',status:'new',applied:addDays(-1)},
    ],
    candidates:[
      {id:'cd1',name:'Darius Hall',position:'Floor Installer',stage:'screen',score:95,source:'Website apply'},
      {id:'cd2',name:'Kayla Wright',position:'Vinyl / Wrap Tech',stage:'applied',score:70,source:'Website apply'},
      {id:'cd3',name:'Terrence Cole',position:'Striping Tech',stage:'interview',score:82,source:'Referral'},
    ],
    vendors:[
      {id:'v1',name:'Sherwin-Williams Pro',category:'Coatings',rating:4.8,preferred:true,lastOrder:addDays(-15)},
      {id:'v2',name:'Beacon Athletics',category:'Court materials',rating:4.6,preferred:true,lastOrder:addDays(-2)},
      {id:'v3',name:'Sunbelt Rentals',category:'Equipment',rating:4.2,preferred:false,lastOrder:addDays(-11)},
      {id:'v4',name:'FastSigns Memphis',category:'Signage overflow',rating:4.0,preferred:false,lastOrder:addDays(-60)},
    ],
    purchaseOrders:[
      {id:'po1',number:'PO-2026-011',vendorId:'v2',amount:2260,status:'received',date:addDays(-2),item:'Court paint + tape'},
      {id:'po2',number:'PO-2026-012',vendorId:'v1',amount:3450,status:'sent',date:addDays(-1),item:'Gym finish (Gym 3)'},
    ],
    content:[
      {id:'ct1',title:'Gym Floor Refinishing: 5 Signs It Is Time',type:'blog',status:'published',channel:'website',date:addDays(-14),body:'A refinished gym floor is the centerpiece of a school athletic brand. Watch for finish wear, slippery spots, faded game lines, water damage, and board cupping. Lines & Logos restores floors to competition spec — lasting impressions for years to come.'},
      {id:'ct2',title:'MSCS Gym Refresh — Before/After',type:'case-study',status:'draft',channel:'website',date:addDays(3),body:'Three Memphis gyms refreshed in nine days: sanding, base coat, game lines, and a final walkthrough with facilities staff.'},
      {id:'ct3',title:'Donors Walls That Actually Raise Money',type:'blog',status:'scheduled',channel:'website',date:addDays(6),body:'Recognition walls turn donors into repeat donors. Materials, layouts, and naming-tier strategies that work for churches and schools.'},
    ],
    campaigns:[
      {id:'cp1',name:'MSCS Full-Facility Push',channel:'email',status:'active',start:addDays(-10),budget:1200,results:'Proposal drafted; 2 meetings booked'},
      {id:'cp2',name:'Summer Install Window',channel:'social',status:'planned',start:addDays(20),budget:800,results:'—'},
      {id:'cp3',name:'Church Facilities Outreach',channel:'email',status:'active',start:addDays(-5),budget:400,results:'11 replies / 60 sent'},
    ],
    tickets:[
      {id:'tk1',accountId:'a3',subject:'Donors wall color proof question',status:'open',priority:'high',created:addDays(-1)},
      {id:'tk2',accountId:'a1',subject:'Gym 2 humidity during cure',status:'in-progress',priority:'high',created:addDays(-2)},
      {id:'tk3',accountId:'a4',subject:'Stripe reflectivity spec',status:'resolved',priority:'normal',created:addDays(-20)},
    ],
    feedback:[
      {id:'f1',accountId:'a4',rating:5,comment:'Lot looks fantastic — ahead of schedule.',date:addDays(-10)},
      {id:'f2',accountId:'a1',rating:4,comment:'Great progress; want daily photo updates.',date:addDays(-3)},
    ],
    wiki:[
      {id:'w1',title:'Gym Floor Refinishing SOP',category:'Operations',body:'1. Walkthrough & moisture test. 2. Seal & contain dust. 3. Drum-sand to bare wood (36→60→100 grit). 4. Tack & vacuum. 5. Base coat, abrade, finish coats. 6. Game lines to NFHS spec. 7. Cure 72h before play. 8. Client walkthrough & sign-off.'},
      {id:'w2',title:'Court Restripe SOP',category:'Operations',body:'1. Clean & degrease surface. 2. Chalk-line layout to governing-body spec. 3. Tape lines. 4. Two coats acrylic striping paint. 5. Pull tape wet. 6. Cure 24h. 7. Photo documentation.'},
      {id:'w3',title:'Invoice & Dunning Policy',category:'Finance',body:'Net-30 standard. Friendly reminder at 1–7 days overdue, firm at 8–14, final at 15+. Escalate to phone call at day 10. Offer payment plans only with owner approval.'},
      {id:'w4',title:'1099 Contractor Onboarding SOP',category:'HR',body:'Apply → AI screen → owner approve → portal link issued → W-9, 1099 acknowledgment, scope of work, safety agreement, offer letter signed → dispatchable.'},
    ],
    policies:[
      {id:'p1',name:'Safety & PPE Policy',version:'1.2',updated:addDays(-30),owner:'Trey Smith'},
      {id:'p2',name:'Data & Privacy Policy',version:'1.0',updated:addDays(-60),owner:'Trey Smith'},
      {id:'p3',name:'Subcontractor Agreement Policy',version:'2.0',updated:addDays(-15),owner:'Trey Smith'},
    ],
    approvals:[
      {id:'apv1',type:'purchase',title:'PO-2026-012 — Sherwin-Williams gym finish',amount:3450,requestedBy:'James Carter',status:'pending',created:addDays(-1)},
      {id:'apv2',type:'discount',title:'Bellevue — 10% nonprofit discount on donors wall',amount:2400,requestedBy:'Trey Smith',status:'pending',created:addDays(-2)},
    ],
    notifications:[
      {id:'n1',channel:'email',to:'mbell@bellevue.org',subject:'Friendly reminder: Invoice L&L-2026-004',status:'sent',sentAt:new Date(Date.now()-7200e3).toISOString(),preview:'Hi Marcus — a friendly note that invoice L&L-2026-004 ($6,000) is past due…'},
    ],
    affiliates:[
      {id:'af1',name:'Coach Mike Ramsey',email:'mramsey@example.com',phone:'901-555-0188',code:'RAMSEY10',token:'demo-affiliate-token',type:'promoter',pct:10,status:'active',audience:'High-school & club coaches across West TN',joined:addDays(-96),payoutMethod:'Venmo @mike-ramsey'},
    ],
    commissions:[
      {id:'cm1',affiliateId:'af1',affiliate:'Coach Mike Ramsey',jobId:'j4',job:'Bellevue Baptist — Lobby Wraps',amount:1275,pct:10,status:'paid',created:addDays(-38),paidOn:addDays(-30)},
      {id:'cm2',affiliateId:'af1',affiliate:'Coach Mike Ramsey',jobId:'j1',job:'UofM Rec Center — Court Resurface',amount:8650,pct:10,status:'pending',created:addDays(-6)},
    ],
    interviews:[
      {id:'iv1',applicant:'Terrence Cole',applicantId:'ap3',position:'Floor Installer',when:addDays(2)+'T10:00:00',link:'https://meet.linesandlogos.com/iv-terrence-cole',status:'scheduled',packetId:'hp-demo'},
    ],
    hirePackages:[],
    filings:[
      {id:'fl1',name:'TN Annual Report — LLC',state:'TN',agency:'TN Secretary of State — Business Services',dueDate:'2027-04-01',fee:300,status:'upcoming',filedDate:null,notes:'Due by the 1st day of the 4th month after fiscal-year end (Apr 1 for calendar-year LLCs). $50/member, $300 minimum.'},
      {id:'fl2',name:'MS Annual Report — Foreign LLC',state:'MS',agency:'MS Secretary of State',dueDate:'2027-04-15',fee:0,status:'upcoming',filedDate:null,notes:'Foreign qualification active. Annual report window Jan 1 – Apr 15; no fee for LLCs.'},
      {id:'fl3',name:'Registered Agent Review',state:'TN',agency:'TN Secretary of State — registered agent on file',dueDate:addDays(58),fee:0,status:'upcoming',filedDate:null,notes:'Self-appointed agent — confirm the address on file is current; update via SoS change-of-agent form if moved.'},
      {id:'fl4',name:'AR Foreign Qualification',state:'AR',agency:'AR Secretary of State — Business & Commercial Services',dueDate:addDays(21),fee:300,status:'recommended',filedDate:null,notes:'Jobs booked inside Arkansas — file the Application for Certificate of Authority before work commences. Unregistered foreign LLCs cannot maintain a suit in AR courts.'},
      {id:'fl5',name:'Shelby County Business Tax License',state:'TN',agency:'Shelby County Clerk',dueDate:'2027-01-31',fee:15,status:'filed',filedDate:addDays(-320),notes:'Minimal business license — renews annually with the TN business tax return.'},
    ],
    tripPlans:[
      {id:'tp-demo1',title:'Nashville Christian Academy — Full Court',contractId:'ct-demo1',contract:'NCA Court Install',origin:'2847 New Broadway St, Memphis, TN 38109',destination:'Nashville Christian Academy, Nashville, TN',miles:212,roundMiles:466,driveHours:4,totalDays:4,nights:3,rooms:2,crew:3,status:'pending-approval',total:3860,createdAt:addDays(-1),lineItems:[
        {k:'fuel-mileage',label:'Fuel (466 mi ÷ 14 mpg × $3.60)',amount:520},{k:'lodging',label:'Hotels — 3 nights × 2 rooms × $120+14%',amount:820},{k:'perdiem',label:'Per-diem meals (3 crew × 4 days × $45)',amount:540},{k:'tolls',label:'Tolls & parking',amount:84},{k:'equipment',label:'Machinery transport + fuel',amount:630},{k:'materials',label:'Materials staging',amount:720},{k:'labor',label:'Crew labor (3 × 4 × $350)',amount:4200}],maps:{directions:'https://www.google.com/maps/dir/?api=1&origin=Memphis,+TN&destination=Nashville+Christian+Academy',staticMap:'https://staticmap.openstreetmap.de/staticmap.php?center=36.1627,-86.7816&zoom=12&size=600x300&markers=36.1627,-86.7816,red-pushpin'},events:[]},
      {id:'tp-demo2',title:'Oxford High School — Gym Resurface',contractId:'ct-demo2',contract:'Oxford HS Resurface',destination:'Oxford High School, Oxford, MS',miles:75,roundMiles:165,totalDays:3,nights:2,rooms:1,crew:2,status:'approved',total:2210,createdAt:addDays(-4),approvedBy:'admin@linesandlogos.com',approvedAt:addDays(-3),emailedTo:['ad@oxfordhs.org','tech1@linesandlogos.com'],maps:{directions:'https://www.google.com/maps/dir/?api=1&origin=Memphis,+TN&destination=Oxford+High+School,+MS'},lineItems:[],events:[{id:'te1',kind:'sick',source:'tech2@linesandlogos.com',at:addDays(-2),summary:'Re: Oxford HS crew',action:'notified-admin-with-replacements',replacementSuggestions:[{email:'tech3@linesandlogos.com',name:'Ray Dukes'}]}]},
    ],
    travelEvents:[
      {id:'te-demo1',planId:'tp-demo2',kind:'sick',source:'tech2@linesandlogos.com',at:addDays(-2),summary:'Re: Oxford HS crew',action:'notified-admin-with-replacements'},
      {id:'te-demo2',planId:'tp-demo2',kind:'reschedule',source:'ad@oxfordhs.org',at:addDays(-1),summary:'Move start to next Monday',action:'approval-queued-for-delta',requestedDate:'next Monday',deltaCost:310},
    ],
    demoGoLive:{ status:'setup', launchDate:null, erasedDemo:false },
    licenses:[
      {id:'lic-demo1',name:'General Liability Insurance',type:'insurance',provider:'NEXT Insurance',policyNumber:'GL-2026-4401',cost:720,expiresAt:addDays(200).slice(0,10),renewsEveryMonths:12,status:'active',createdAt:addDays(-160),reminded:{}},
      {id:'lic-demo2',name:'Workers\' Compensation',type:'insurance',provider:'The Hartford',policyNumber:'WC-88-2210',cost:3400,expiresAt:addDays(22).slice(0,10),renewsEveryMonths:12,status:'active',createdAt:addDays(-343),reminded:{}},
      {id:'lic-demo3',name:'TN Business License (Shelby County)',type:'license',provider:'Shelby County Clerk',policyNumber:'BL-2018-99281',cost:25,expiresAt:addDays(-6).slice(0,10),renewsEveryMonths:12,status:'active',createdAt:addDays(-371),reminded:{}},
    ],
    demoGaps:['TN Sales Tax Permit','Commercial Auto'],
    demoRequirements:[
      {key:'ein',type:'license',name:'EIN (Federal Tax ID)',authority:'IRS — irs.gov',needed:true,cost:'Free (apply online in ~10 min)',applyUrl:'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',note:'Required before opening a business bank account or hiring.',cheapest:{best:'IRS — irs.gov',options:[]}},
      {key:'llc',type:'license',name:'LLC Formation (TN)',authority:'TN Secretary of State',needed:true,cost:'~$300 state filing fee; ~$50/member/yr annual report (est)',applyUrl:'https://tnbear.tn.gov/',note:'Separates personal assets from business liability.',cheapest:{best:'TN Secretary of State (file direct — skip formation services)',options:[]}},
      {key:'business-license',type:'license',name:'Local Business License',authority:'Shelby County / Memphis clerk',needed:true,cost:'~$15–30/yr (est)',applyUrl:'https://www.shelbycountytn.gov/',note:'Required in each city/county you operate in.',cheapest:{best:'Shelby County Clerk (direct)',options:[]}},
      {key:'sales-tax',type:'license',name:'TN Sales Tax Permit',authority:'TN Dept. of Revenue',needed:true,cost:'Free',applyUrl:'https://www.tn.gov/revenue/businesses/new-business.html',note:'Register before collecting sales tax.',cheapest:{best:'TN Dept. of Revenue (direct)',options:[]}},
      {key:'contractor-license',type:'license',name:'TN Contractor License',authority:'TN Board for Licensing Contractors',needed:'conditional',cost:'~$250–500 exam + fees (est)',applyUrl:'https://www.tn.gov/commerce/regulatory-boards/contractor-licensing.html',note:'ONLY for projects ≥ $25,000.',cheapest:{best:'TN Board for Licensing Contractors (direct)',options:[]}},
      {key:'gl',type:'insurance',name:'General Liability',authority:'private insurers',needed:true,cost:'~$400–900/yr for $1M (est)',options:['NEXT Insurance','Thimble (from ~$17/mo)','biBERK','Hiscox'],note:'Schools require a COI before you work on site.',cheapest:{best:'Thimble — lowest entry price',options:['NEXT Insurance','Thimble','biBERK','Hiscox']}},
      {key:'workers-comp',type:'insurance',name:'Workers\' Compensation',authority:'private insurers (TN has no state fund)',needed:'conditional',cost:'~2–5% of payroll for painting trades (est)',options:['The Hartford','NEXT Insurance','Progressive Commercial','CoverWallet'],note:'Required at 5+ employees in TN. Collect COIs from subs.',cheapest:{best:'CoverWallet — compares carriers',options:['The Hartford','NEXT Insurance','Progressive Commercial','CoverWallet']}},
      {key:'commercial-auto',type:'insurance',name:'Commercial Auto',authority:'private insurers',needed:'conditional',cost:'~$1,200–2,500/yr per vehicle (est)',options:['Progressive Commercial','GEICO Commercial','The Hartford'],note:'Required once vehicles are business-titled.',cheapest:{best:'GEICO Commercial — usually lowest for clean records',options:['Progressive Commercial','GEICO Commercial','The Hartford']}},
      {key:'umbrella',type:'insurance',name:'Umbrella Liability',authority:'private insurers',needed:false,cost:'~$300–600/yr per $1M (est)',options:['biBERK','The Hartford'],note:'School districts often require it.',cheapest:{best:'biBERK — low-cost umbrella',options:['biBERK','The Hartford']}},
    ],
    launchTasks:[
      {id:'lt1',phase:'foundation',phaseName:'Foundation & Legal',text:'Confirm business entity & EIN are registered',done:true,due:null,order:0},
      {id:'lt2',phase:'foundation',phaseName:'Foundation & Legal',text:'Bind general liability + workers\' comp insurance',done:true,due:null,order:1},
      {id:'lt3',phase:'foundation',phaseName:'Foundation & Legal',text:'Open business bank account',done:false,due:null,order:2},
      {id:'lt4',phase:'foundation',phaseName:'Foundation & Legal',text:'Verify payment processing with a test transaction',done:false,due:null,order:3},
      {id:'lt5',phase:'foundation',phaseName:'Foundation & Legal',text:'Set up accounting (chart of accounts, invoicing)',done:false,due:null,order:4},
      {id:'lt6',phase:'brand',phaseName:'Brand & Web Presence',text:'Connect your domain & confirm SSL is live',done:true,due:null,order:5},
      {id:'lt7',phase:'brand',phaseName:'Brand & Web Presence',text:'Claim & verify Google Business Profile',done:false,due:null,order:6},
      {id:'lt8',phase:'brand',phaseName:'Brand & Web Presence',text:'Replace demo gallery photos with real project photos',done:false,due:null,order:7},
      {id:'lt9',phase:'ops',phaseName:'Operations',text:'Finalize pricing sheets & quote templates',done:false,due:null,order:8},
      {id:'lt10',phase:'launch',phaseName:'Launch Day',text:'Press GO — set the app live',done:false,due:null,order:9},
    ],
    settings:{
      companyName:'Lines & Logos',adminEmail:'admin@linesandlogos.com',fromEmail:'noreply@linesandlogos.com',
      invoiceTermsDays:30,reminderCadence:'friendly ≤7d · firm 8–14d · final 15d+',dailyCron:'07:00 America/Chicago',weeklyCron:'Mon 08:00 America/Chicago',
      pricing:{crewDayRate:350,mileageRate:0.90,hotelNightly:120,perDiemPerPersonDay:45,truckCapacity:3},
      quotes:{marginPct:35,validityDays:30,approvalEmail:'admin@linesandlogos.com'},
      notifications:{inApp:true,email:true,sms:false},
      tax:{enabled:true,disclaimer:'Estimated combined state + local rate. Final tax is calculated by QuickBooks at invoicing.'},
      affiliate:{enabled:true,defaultPct:10,recommendedPct:10,minPayout:50,cookieDays:90,autoApprove:true,payoutDays:'1st & 15th of the month',tiers:{promoter:10,creator:12,partner:15},basis:'completed job value (first job per referred account)'},
      integrations:{quickbooks:{connected:false,realmId:'',environment:'sandbox',syncTax:true,lastSync:null},stripe:{connected:false,publishableKey:'',lastSync:null,mode:'simulated'}},
      entity:{legalName:'Lines & Logos LLC',entityType:'LLC',formationState:'TN',formationDate:'2025-03-12',einLast4:'4821',registeredAgent:{name:'Trey Smith (self-appointed)',feePerYear:0},operatingStates:['TN','MS','AR','MO','AL','KY','LA','OK'],foreignQualified:['MS']},
      crm:{followUpDays:14,renewalWindowDays:60,autoSurvey:true,autoInvoiceOnComplete:true},
      payroll:{defaultHourlyRate:22,payoutDay:'Friday'},
      aiProviders:[],agentRouting:{},aiUsage:{date:'',byProvider:{}},
      setup:{aiConfigured:false,aiPromptedAt:null,opencodeKey:''}
    },
    surveys:[{id:'sv1',token:'demo-survey-token',accountId:'a4',jobId:'j4',sentAt:new Date(Date.now()-9*864e5).toISOString(),status:'responded',rating:5,comment:'Striping is crisp and the crew was in and out in a day.',respondedAt:new Date(Date.now()-8*864e5).toISOString()}],
    followUps:[{id:'fu1',accountId:'a3',type:'survey',status:'open',note:'No survey response from Bellevue — nudge Marcus Bell',due:addDays(2),createdAt:new Date().toISOString()}],
    payouts:[],
    financialAlerts:[],
    crmVisitors:[],
    competitors:[
      {id:'co1',name:'Hussey / GameDay Surfaces',focus:'National gym floor franchise',pricingNote:'Premium pricing, 10–15% above regional',lastMove:'Running fall refinishing promo in TN districts',moveDate:addDays(-6),threat:'high'},
      {id:'co2',name:'Mid-South Court Co.',focus:'Regional court striping',pricingNote:'Budget pricing, limited design services',lastMove:'Hired 2 striping techs (job posts)',moveDate:addDays(-12),threat:'medium'},
      {id:'co3',name:'Signarama Memphis',focus:'Signage & wraps only',pricingNote:'Comparable on wraps; no athletic surfaces',lastMove:'Launched school-spirit wrap package',moveDate:addDays(-20),threat:'medium'},
    ],
    employeeOnboardings:[
      {id:'eo1',name:'Andre Boone',role:'Striping Lead',email:'aboone@example.com',phone:'901-555-0143',type:'1099',availability:'part-time',startDate:addDays(3),status:'in-progress',
        steps:EMP_STEPS.map(s=>({...s,done:['offer','portal'].includes(s.key)})),notes:'Promoted from applicant pool — strong references.',created:addDays(-4)},
      {id:'eo2',name:'Darius Hall',role:'Floor Installer',email:'dhall@example.com',phone:'901-555-0163',type:'1099',availability:'full-time',startDate:addDays(7),status:'not-started',
        steps:freshSteps(EMP_STEPS),notes:'AI screen 95 — approved, awaiting paperwork.',created:addDays(-1)},
    ],
    clientOnboardings:[
      {id:'cb1',company:'DeSoto County School District',contact:'Angela Porter',email:'aporter@desotocountyschools.org',phone:'662-555-0182',service:'Gym Refresh x3 + restripes',value:18900,startDate:addDays(14),status:'in-progress',
        steps:CLIENT_STEPS.map(s=>({...s,done:['kickoff','contract','deposit'].includes(s.key)})),notes:'Board-approved PO expected before walkthrough.',created:addDays(-6)},
      {id:'cb2',company:'City of Little Rock Parks',contact:'Dana Whitfield',email:'dwhitfield@littlerock.gov',phone:'501-555-0122',service:'Outdoor Courts (6)',value:41000,startDate:addDays(21),status:'not-started',
        steps:freshSteps(CLIENT_STEPS),notes:'Budget qualified — waiting on council sign-off.',created:addDays(-2)},
    ],
    chatLogs:[],
    activity:[
      {t:new Date(Date.now()-3600e3).toISOString(),msg:'Lead Score Agent scored Angela Porter 87 (hot)'},
      {t:new Date(Date.now()-7200e3).toISOString(),msg:'Invoice Reminder Agent sent friendly reminder for L&L-2026-004'},
      {t:new Date(Date.now()-10800e3).toISOString(),msg:'Job Dispatch Agent matched Crew B to DeSoto restripe'},
      {t:new Date(Date.now()-86400e3).toISOString(),msg:'Competitor Watch Agent flagged Hussey fall promo in TN districts'},
      {t:new Date(Date.now()-90000e3).toISOString(),msg:'Daily Ops Agent generated morning brief'},
    ],
  };
}

/* ================= DATA LAYER ================= */
let LIVE = false;
let D; // demo db
try { D = JSON.parse(localStorage.getItem('ll_demo_db') || 'null'); } catch { D = null; }
if (!D || !D.settings) { D = demoSeed(); persistDemo(); }
else { const fresh = demoSeed(); for (const k of Object.keys(fresh)) if (D[k] === undefined) D[k] = fresh[k];
  for (const sk of Object.keys(fresh.settings)) { const fv = fresh.settings[sk], cv = D.settings[sk];   // deep-merge settings sections
    if (fv && typeof fv === 'object' && !Array.isArray(fv)) D.settings[sk] = Object.assign({}, fv, (cv && typeof cv === 'object' && !Array.isArray(cv)) ? cv : {});
    else if (cv === undefined || typeof cv !== typeof fv) D.settings[sk] = fv; }
  persistDemo(); } // merge new collections into existing demo db
function persistDemo(){ localStorage.setItem('ll_demo_db', JSON.stringify(D)); }
const uid = (p) => p + Math.random().toString(16).slice(2, 10);

async function raw(path, opts){
  const r = await fetch(BASE + path, { ...opts, headers: { 'Content-Type':'application/json', Authorization:'Bearer ' + TOKEN, ...((opts&&opts.headers)||{}) } });
  if (!r.ok) throw new Error((await r.json().catch(()=>({}))).error || r.statusText);
  return r.json();
}
const acctName = (id, db) => { const rows = db || (LIVE ? (state.accounts || []) : D.accounts); const a = rows.find(a => a.id === id); return a ? a.name : '—'; };
const empName  = (id, db) => { const rows = db || (LIVE ? (state.employees || []) : D.employees); const e = rows.find(e => e.id === id); return e ? e.name : '—'; };
const daysOverdue = (i) => Math.floor((Date.now() - new Date(i.dueDate || i.issued)) / 864e5);

/* demo tax engine (mirrors server TAX_RATES — estimated combined state+local) */
const TAX_RATES = { TN:{rate:9.55,name:'Tennessee'}, MS:{rate:7.07,name:'Mississippi'}, AR:{rate:9.45,name:'Arkansas'},
  AL:{rate:9.24,name:'Alabama'}, MO:{rate:8.36,name:'Missouri'}, KY:{rate:6.00,name:'Kentucky'}, LA:{rate:9.55,name:'Louisiana'},
  IL:{rate:8.82,name:'Illinois'}, GA:{rate:7.35,name:'Georgia'}, IN:{rate:7.00,name:'Indiana'}, OK:{rate:8.98,name:'Oklahoma'},
  TX:{rate:8.20,name:'Texas'}, OH:{rate:7.24,name:'Ohio'}, KS:{rate:8.70,name:'Kansas'}, IA:{rate:6.94,name:'Iowa'}, FL:{rate:7.02,name:'Florida'} };
function taxFor(city){
  const c = (city || '').toLowerCase().trim();
  const m = c.match(/,\s*([a-z]{2})$/);
  const st = (m && TAX_RATES[m[1].toUpperCase()]) ? m[1].toUpperCase() : 'TN';
  const t = TAX_RATES[st];
  const qb = D.settings.integrations && D.settings.integrations.quickbooks;
  return { state: st, stateName: t.name, rate: t.rate, source: (qb && qb.connected && qb.syncTax) ? 'quickbooks' : 'builtin-table' };
}
const DEMO_SERVICES = {   // pricing agent catalog (mirrors server)
  refinish:{label:'Gym Floor Refinish',materialPerSqft:2.25,crew:4,prodPerDay:2500,minDays:2},
  restripe:{label:'Court Restripe',materialPerSqft:0.35,crew:2,prodPerDay:12000,minDays:0.5},
  wallwrap:{label:'Wall Wrap / Graphics',materialPerSqft:3.40,crew:2,prodPerDay:600,minDays:1},
  donorswall:{label:'Donors Wall',materialPerSqft:4.50,crew:3,prodPerDay:80,minDays:3,flatMaterials:900},
  signage:{label:'Signage & Parking Striping',materialPerSqft:0.10,crew:2,prodPerDay:20000,minDays:1,flatMaterials:800},
  playground:{label:'Playground Surfacing',materialPerSqft:2.80,crew:3,prodPerDay:1500,minDays:1},
};
function demoBuildQuote(input){
  const P = D.settings.pricing, Q = D.settings.quotes;
  const svc = DEMO_SERVICES[input.service] || DEMO_SERVICES.refinish;
  const sqft = Math.max(200, +input.sqft || 8000), miles = Math.max(0, +input.miles || 0);
  const days = Math.max(svc.minDays, Math.ceil(sqft / svc.prodPerDay)), crew = svc.crew;
  const trucks = Math.ceil(crew / P.truckCapacity);
  const labor = crew * days * P.crewDayRate;
  const materials = Math.round(sqft * svc.materialPerSqft + (svc.flatMaterials || 0));
  const travel = Math.round(miles * 2 * P.mileageRate * trucks);
  const nights = miles > 60 ? days : 0;
  const hotel = nights * crew * P.hotelNightly;
  const perDiem = days * crew * P.perDiemPerPersonDay;
  const subtotal = labor + materials + travel + hotel + perDiem;
  const margin = Math.round(subtotal * (Q.marginPct || 35) / 100);
  const total = subtotal + margin;
  const t = taxFor(input.city || 'Memphis, TN');
  const taxAmount = D.settings.tax.enabled ? Math.round(total * t.rate / 100) : 0;
  return { service: svc.label, sqft, miles, days, crew, trucks, nights,
    lineItems: [
      { label:`Labor — ${crew} crew × ${days} day(s) × $${P.crewDayRate}/day`, amount: labor },
      { label:`Materials — ${sqft.toLocaleString()} sq ft`, amount: materials },
      { label:`Travel — ${miles} mi one-way`, amount: travel },
      ...(nights ? [{ label:`Hotel — ${nights} night(s) × ${crew} rooms`, amount: hotel }] : []),
      { label:`Per diem`, amount: perDiem },
      { label:`Margin (${Q.marginPct || 35}%)`, amount: margin },
      ...(taxAmount ? [{ label:`Estimated sales tax — ${t.stateName} (${t.rate}% combined)`, amount: taxAmount, tax: true }] : []),
    ],
    subtotal, margin, total, taxState: t.state, taxStateName: t.stateName, taxRate: t.rate, taxAmount,
    grandTotal: total + taxAmount, taxSource: t.source, taxDisclaimer: D.settings.tax.disclaimer };
}

/* demo agent heuristics (mirror server) */
const demoAgents = {
  scoreLead(l){
    let s = 50;
    if (/school|district|university|college|academy/i.test(l.company||'')) s += 20;
    if (/church|park|city|municipal/i.test(l.company||'')) s += 8;
    if (/full|facility|campus/i.test(l.service||'')) s += 15;
    if (/gym|court|stripe|wrap|donor/i.test(l.service||'')) s += 6;
    if (l.source === 'Referral') s += 10;
    s = Math.max(0, Math.min(100, s + Math.min(10, (l.company||'').length % 11)));
    const tier = s >= 80 ? 'hot' : s >= 60 ? 'warm' : 'cold';
    return { score: s, tier, nextStep: tier === 'hot' ? 'Send proposal within 24h' : /walk|donor|wrap/i.test(l.service||'') ? 'Schedule walkthrough' : tier === 'warm' ? 'Qualify budget & timeline' : 'Send battle card + nurture' };
  },
  dispatch(job){
    const text = (job.title + ' ' + (job.notes||'')).toLowerCase();
    const ranked = D.employees.filter(e => e.w9Signed).map(e => {
      const hits = (e.skills||[]).filter(k => text.includes(k)).length;
      const load = D.timeEntries.filter(t => t.employeeId === e.id).reduce((s,t) => s + t.hours, 0);
      return { employee: e, score: hits * 25 + e.rating * 6 + (e.availability === 'full-time' ? 8 : 0) - load * 0.2 };
    }).sort((a,b) => b.score - a.score);
    if (!ranked.length) return { match: null, rationale: 'No dispatchable contractors (W-9 pending).' };
    const best = ranked[0];
    return { match: { id: best.employee.id, name: best.employee.name, role: best.employee.role },
      rationale: `${best.employee.name} — ${best.employee.role}, rating ${best.employee.rating}${ranked[1] ? `; runner-up ${ranked[1].employee.name}` : ''}.`,
      ranked: ranked.map(r => ({ name: r.employee.name, score: Math.round(r.score) })) };
  },
  reminder(inv){
    const days = daysOverdue(inv), tone = days <= 7 ? 'friendly' : days <= 14 ? 'firm' : 'final';
    const acct = acctName(inv.accountId);
    const bodies = {
      friendly: `Hi ${acct.split(' ')[0]} team — a friendly note that invoice ${inv.number} for ${fmt(inv.amount)} came due ${inv.dueDate}. If payment is already on its way, thank you!`,
      firm: `Hello ${acct} — invoice ${inv.number} (${fmt(inv.amount)}) is now ${days} days past due. Please remit this week or contact us to arrange a plan.`,
      final: `FINAL NOTICE — ${acct}: invoice ${inv.number} (${fmt(inv.amount)}) is ${days} days past due. Please remit immediately or call us today.`,
    };
    return { tone, days, subject: `${tone === 'final' ? 'FINAL NOTICE' : tone === 'firm' ? 'Payment reminder' : 'Friendly reminder'}: Invoice ${inv.number}`, body: bodies[tone] };
  },
  health(a){
    const notes = []; let level = 'green';
    const od = D.invoices.filter(i => i.accountId === a.id && i.status === 'overdue');
    if (od.length) { level = 'red'; notes.push(`${od.length} overdue invoice(s): ${od.map(i=>i.number).join(', ')}`); }
    const dr = a.renewal ? Math.floor((new Date(a.renewal) - Date.now()) / 864e5) : null;
    if (dr !== null && dr < 45) { if (level === 'green') level = 'yellow'; notes.push(`Renewal in ${dr} days — start renewal motion now`); }
    const tks = D.tickets.filter(t => t.accountId === a.id && t.status !== 'resolved').length;
    if (tks) { if (level === 'green') level = 'yellow'; notes.push(`${tks} open support ticket(s)`); }
    if (!notes.length) notes.push('Healthy — no overdue invoices, tickets, or renewal risk');
    return { level, notes };
  },
  watch(){
    return D.competitors.map(c => ({ ...c, daysAgo: Math.floor((Date.now() - new Date(c.moveDate)) / 864e5) })).sort((a,b) => a.daysAgo - b.daysAgo)
      .map(c => ({ name: c.name, threat: c.threat, move: c.lastMove, pricing: c.pricingNote, daysAgo: c.daysAgo, flag: c.daysAgo <= 7 && c.threat === 'high' ? 'ACT NOW' : c.daysAgo <= 14 ? 'watch' : 'logged' }));
  },
  dailyBrief(){
    const overdue = D.invoices.filter(i => i.status === 'overdue');
    return { date: today(),
      jobsToday: D.jobs.filter(j => j.status === 'in-progress'),
      openQuotes: D.quotes.filter(q => q.status === 'sent').map(q => ({ number: q.number, account: acctName(q.accountId), amount: q.amount })),
      overdueInvoices: overdue.map(i => ({ number: i.number, account: acctName(i.accountId), amount: i.amount, days: daysOverdue(i), tone: demoAgents.reminder(i).tone })),
      hotLeads: D.leads.filter(l => l.tier === 'hot'),
      pendingApprovals: D.approvals.filter(a => a.status === 'pending').length,
      accountHealth: D.accounts.map(a => ({ name: a.name, health: demoAgents.health(a).level })),
      generatedAt: new Date().toISOString() };
  },
  jobStatusEmail(job){
    const acct = acctName(job.accountId);
    const pct = job.progress ?? 0;
    return { to: acct, subject: `Update: ${job.title} — ${job.status === 'complete' ? 'complete' : pct + '% complete'}`,
      body: job.status === 'complete'
        ? `Hi ${acct} team — great news: ${job.title} is complete. ${job.notes||''} Thank you for trusting Lines & Logos.`
        : `Hi ${acct} team — ${job.title} is ${pct}% complete, on track for ${job.due}. ${job.notes||''} — Lines & Logos` };
  },
  repurpose(item){
    const hook = item.body.split('.')[0] + '.';
    const tag = '#LinesAndLogos #FacilityBranding #AthleticSurfaces #Memphis';
    return { posts: [
      { channel:'LinkedIn', text:`${hook}\n\n${item.body.split('.').slice(1,3).join('.').trim()}.\n\nLasting Impressions For Years to Come\n${tag}` },
      { channel:'Instagram', text:`${hook} 🏀✨ Swipe for the transformation.\n${tag}` },
      { channel:'Facebook', text:`${hook}\n\n${item.title} — read more on the Lines & Logos blog. Serving schools, churches & parks across the Mid-South.` },
      { channel:'X', text:`${hook} ${tag}` },
    ]};
  },
  competitorAnalysis(name){
    const c = D.competitors.find(x => x.name.toLowerCase().includes((name||'').toLowerCase())) || D.competitors[0];
    const counters = { high:['Counter within 72h with bundled one-contract pricing','Arm sales with battle card — local crew & response time','Offer multi-facility discount to in-flight prospects'],
      medium:['Monitor weekly','Differentiate on design services they lack','Capture case studies from shared accounts'], low:['Log and monitor quarterly'] };
    return { profile: c, impact: c.threat === 'high' ? 'Direct overlap on district bids — expect head-to-head on MSCS-scale deals.' : c.threat === 'medium' ? 'Partial overlap — undercuts on price but cannot bundle surfaces + branding.' : 'Minimal overlap with current pipeline.', counters: counters[c.threat] || counters.low };
  },
  /* CRM Manager — survey + invoice on completion, stale-touch & renewal follow-ups (demo mirror) */
  crmSweep(){
    const out = { surveysSent: 0, invoicesSent: 0, followUpsCreated: 0, details: [] };
    const now = Date.now();
    for (const job of D.jobs.filter(j => j.status === 'complete')){
      if (D.settings.crm.autoSurvey && !D.surveys.some(s => s.jobId === job.id)){
        D.surveys.push({ id: uid('sv'), token: 'demo-' + uid(''), accountId: job.accountId, jobId: job.id, sentAt: new Date().toISOString(), status: 'sent', rating: null, comment: '' });
        out.surveysSent++; out.details.push(`Survey sent — ${job.title}`);
      }
      if (D.settings.crm.autoInvoiceOnComplete && !D.invoices.some(i => i.jobId === job.id) && job.value){
        const acct = D.accounts.find(a => a.id === job.accountId);
        const t = taxFor(acct ? acct.city : 'Memphis, TN');
        const taxAmount = D.settings.tax.enabled ? Math.round(job.value * t.rate / 100) : 0;
        const inv = { id: uid('i'), number: 'L&L-2026-' + String(D.invoices.length + 1).padStart(3,'0'), accountId: job.accountId, jobId: job.id,
          amount: job.value + taxAmount, subtotal: job.value, taxState: t.state, taxRate: t.rate, taxAmount,
          status: 'sent', issued: today(), dueDate: addDays(D.settings.invoiceTermsDays || 30), reminders: 0 };
        D.invoices.push(inv);
        out.invoicesSent++; out.details.push(`Invoice ${inv.number} sent — ${job.title} (${fmt(inv.amount)} incl. ${t.rate}% ${t.state} tax)`);
      }
    }
    const staleAfter = D.settings.crm.followUpDays * 864e5;
    for (const acct of D.accounts){
      const lastTouch = Math.max(0, ...D.feedback.filter(f => f.accountId === acct.id).map(f => new Date(f.date).getTime()));
      const renewalDays = acct.renewal ? Math.floor((new Date(acct.renewal) - now) / 864e5) : null;
      const open = D.followUps.find(f => f.accountId === acct.id && f.status === 'open');
      if (!open && renewalDays !== null && renewalDays <= D.settings.crm.renewalWindowDays){
        D.followUps.push({ id: uid('fu'), accountId: acct.id, type: 'renewal', status: 'open', note: `Renewal in ${renewalDays} days — ${acct.goal || 'start renewal motion'}`, due: addDays(3), createdAt: new Date().toISOString() });
        out.followUpsCreated++; out.details.push(`Renewal follow-up — ${acct.name} (${renewalDays}d)`);
      } else if (!open && lastTouch && (now - lastTouch) > staleAfter){
        D.followUps.push({ id: uid('fu'), accountId: acct.id, type: 'touchbase', status: 'open', note: `No contact in ${Math.floor((now - lastTouch)/864e5)} days — check in`, due: addDays(2), createdAt: new Date().toISOString() });
        out.followUpsCreated++; out.details.push(`Follow-up queued — ${acct.name}`);
      }
    }
    logActivity(`CRM Agent sweep: ${out.surveysSent} survey(s), ${out.invoicesSent} invoice(s), ${out.followUpsCreated} follow-up(s)`);
    persistDemo(); return out;
  },
  /* Financial Watchdog — odd-behavior scan (demo mirror) */
  financeScan(){
    const alerts = [];
    const push = (severity, kind, title, detail) => {
      if (D.financialAlerts.some(a => a.title === title && a.status === 'open')) return;
      D.financialAlerts.unshift({ id: uid('fa'), severity, kind, title, detail, status: 'open', at: new Date().toISOString() });
      alerts.push(title);
    };
    const pays = D.payments ? D.payments.map(p => p.amount).sort((a,b) => a-b) : [];
    const median = pays.length ? pays[Math.floor(pays.length/2)] : 0;
    (D.payments||[]).forEach(p => { if (median && p.amount > median * 2.5) push('high','charge',`Unusually large payment — ${fmt(p.amount)}`,`${(p.amount/median).toFixed(1)}× the median payment (${fmt(median)}). Verify with the bank feed.`); });
    const cats = {}; D.expenses.forEach(x => (cats[x.category] = cats[x.category] || []).push(x.amount));
    D.expenses.forEach(x => { const arr = cats[x.category]; const avg = arr.reduce((s,v)=>s+v,0)/arr.length;
      if (arr.length >= 2 && x.amount > avg * 2) push('medium','expense',`Expense spike — ${x.category} ${fmt(x.amount)}`,`${x.vendor || 'Unknown vendor'}: "${x.note || '—'}" is ${(x.amount/avg).toFixed(1)}× the ${x.category} average (${fmt(Math.round(avg))}).`); });
    D.payouts.filter(p => p.status === 'pending').forEach(p => { if (Date.now() - new Date(p.createdAt).getTime() > 5*864e5) push('medium','payout',`Contractor payout stalled — ${p.employee}`,`${fmt(p.amount)} pending since ${p.createdAt.slice(0,10)}.`); });
    D.invoices.filter(i => i.status === 'overdue' && daysOverdue(i) > 15).forEach(i => push('high','collections',`Collections risk — ${i.number} (${daysOverdue(i)}d overdue)`,`${fmt(i.amount)} from ${acctName(i.accountId)} is 15+ days past due. Final-notice cadence is due.`));
    logActivity(`Financial Watchdog scan: ${alerts.length} new alert(s)`);
    persistDemo(); return { newAlerts: alerts.length, alerts: D.financialAlerts.filter(a => a.status === 'open'), openTotal: D.financialAlerts.filter(a => a.status === 'open').length };
  },
  /* Compliance & State Filings (demo mirror) */
  stateFilings(){
    const ent = D.settings.entity || {};
    const filings = (D.filings||[]).map(f => ({ ...f, daysLeft: Math.ceil((new Date(f.dueDate) - Date.now())/864e5) }));
    const open = filings.filter(f => f.status !== 'filed');
    const overdue  = open.filter(f => f.daysLeft < 0).sort((a,b) => a.daysLeft - b.daysLeft);
    const dueSoon  = open.filter(f => f.daysLeft >= 0 && f.daysLeft <= 45).sort((a,b) => a.daysLeft - b.daysLeft);
    const upcoming = open.filter(f => f.daysLeft > 45).sort((a,b) => a.daysLeft - b.daysLeft);
    const qualified = new Set([ent.formationState, ...(ent.foreignQualified||[])].filter(Boolean));
    const gaps = (ent.operatingStates||[]).filter(s => !qualified.has(s));
    const recommendations = [];
    if (overdue.length) recommendations.push({ priority:'critical', text:`${overdue.length} filing(s) overdue — file immediately. Unregistered operation can mean treble back-fees (TN T.C.A. §48-25-102), per-state penalties, and loss of good standing.` });
    gaps.forEach(s => recommendations.push({ priority:'high', text:`Foreign-qualify in ${s}: jobs are booked there but the LLC is not registered with the ${s} Secretary of State. File before work commences — most states bar unregistered foreign LLCs from enforcing contracts in their courts.` }));
    if (dueSoon.length) recommendations.push({ priority:'medium', text:`${dueSoon.length} filing(s) due within 45 days — calendar them and stage the fees now.` });
    if (ent.registeredAgent) recommendations.push({ priority:'low', text:`Registered agent (${ent.registeredAgent.name}) — confirm the address on file is current in every state of qualification; a lapsed agent means missed service of process and default-judgment risk.` });
    recommendations.push({ priority:'low', text:'Considering Wyoming formation while operating from TN? You would still need TN foreign qualification ($300 min/yr) plus WY annual license tax (min $60) and a WY registered agent (~$125/yr) — double the upkeep unless privacy or asset-protection is the specific goal.' });
    const checklist = open.sort((a,b) => a.daysLeft - b.daysLeft).map(f => `${f.name} (${f.state}) — due ${f.dueDate} · est. fee $${f.fee} · ${f.agency}`);
    return { entity:{ legalName:ent.legalName, type:ent.entityType, formationState:ent.formationState, formationDate:ent.formationDate, qualified:[...qualified], operatingStates:ent.operatingStates||[] },
      counts:{ overdue:overdue.length, dueSoon:dueSoon.length, upcoming:upcoming.length, filed:filings.length - open.length },
      overdue, dueSoon, upcoming, recommendations, checklist };
  },
  /* AP/AR Agent (demo mirror) */
  apAr(){
    const ar = D.invoices.filter(i => i.status !== 'paid').map(i => {
      const d = Math.floor((Date.now() - new Date(i.dueDate || i.issued)) / 864e5);
      const tone = d < 0 ? 'current' : d <= 7 ? 'friendly' : d <= 14 ? 'firm' : 'final';
      const nextAction = tone === 'current' ? `Due in ${-d}d — no action yet`
        : tone === 'friendly' ? 'Send friendly reminder (Invoice Reminder Agent)'
        : tone === 'firm' ? 'Firm follow-up email + phone call to the facilities director'
        : 'Final notice — escalate: call + final-notice language, hold future scheduling';
      return { number: i.number, account: acctName(i.accountId), amount: i.amount, dueDate: i.dueDate,
        daysOverdue: Math.max(0, d), reminders: i.reminders || 0, tone, nextAction };
    }).sort((a,b) => b.daysOverdue - a.daysOverdue);
    const ap = (D.purchaseOrders||[]).filter(p => p.status !== 'received').map(p => {
      const assumedDue = new Date(new Date(p.date).getTime() + 30 * 864e5).toISOString().slice(0,10);
      const daysLeft = Math.ceil((new Date(assumedDue) - Date.now()) / 864e5);
      const vendor = p.vendor || ((D.vendors.find(v => v.id === p.vendorId) || {}).name) || '—';
      return { number: p.number, vendor, item: p.item, amount: p.amount, status: p.status, assumedDue, daysLeft,
        nextAction: p.status === 'awaiting-approval' ? 'Needs owner approval before the agent can place the order'
          : daysLeft < 0 ? 'Vendor invoice likely waiting — verify receipt & pay'
          : `Pay within ${daysLeft}d (net-30)` };
    }).sort((a,b) => a.daysLeft - b.daysLeft);
    const totals = {
      receivable: ar.reduce((s,i) => s + i.amount, 0),
      overdueAR: ar.filter(i => i.daysOverdue > 0).reduce((s,i) => s + i.amount, 0),
      payable: ap.reduce((s,p) => s + p.amount, 0),
      payableNext30: ap.filter(p => p.daysLeft <= 30).reduce((s,p) => s + p.amount, 0),
    };
    const notes = [];
    if (totals.overdueAR) notes.push(`$${totals.overdueAR.toLocaleString()} is past due across ${ar.filter(i=>i.daysOverdue>0).length} invoice(s) — the dunning cadence (friendly ≤7d · firm 8–14d · final 15d+) should be running; every week of delay costs ~2% collectability.`);
    if (totals.payableNext30 > totals.receivable) notes.push(`Cash pinch ahead: $${totals.payableNext30.toLocaleString()} of payables come due within 30 days but open receivables total $${totals.receivable.toLocaleString()} — prioritize collections on the largest overdue invoice before scheduling vendor payments.`);
    if (ap.some(p => p.status === 'awaiting-approval')) notes.push(`${ap.filter(p=>p.status==='awaiting-approval').length} PO(s) sit in awaiting-approval — approving them lets the Procurement Agent lock vendor pricing and ship dates.`);
    if (!notes.length) notes.push('Books are clean — receivables outpace near-term payables and nothing is past due.');
    return { ar, ap, totals, notes };
  },
  computePnl(){
    const paid = D.invoices.filter(i => i.status === 'paid');
    const revenueTotal = D.revenue.reduce((s,r) => s + r.amount, 0) + paid.reduce((s,i) => s + i.amount, 0);
    const contractorLabor = D.payouts.filter(p => p.status === 'paid').reduce((s,p) => s + p.amount, 0);
    const byCat = {}; D.expenses.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + x.amount);
    /* paid payouts are already in byCat as Payroll expense rows — do not double count */
    const expensesTotal = Object.values(byCat).reduce((s,v) => s + v, 0);
    const cogs = (byCat['Materials'] || 0) + (byCat['Equipment'] || 0) + contractorLabor;
    const months = [];
    for (let k = 5; k >= 0; k--){ const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - k);
      const key = dt.toISOString().slice(0,7);
      const rev = D.revenue.filter(r => (r.date||'').startsWith(key)).reduce((s,r) => s + r.amount, 0) + paid.filter(i => (i.paidDate||'').startsWith(key)).reduce((s,i) => s + i.amount, 0);
      const exp = D.expenses.filter(x => (x.date||'').startsWith(key)).reduce((s,x) => s + x.amount, 0) + D.payouts.filter(p => p.status === 'paid' && (p.paidAt||'').startsWith(key)).reduce((s,p) => s + p.amount, 0);
      months.push({ month: key, revenue: rev, expenses: exp, net: rev - exp }); }
    return { revenueTotal, expensesTotal, contractorLabor, cogs, grossProfit: revenueTotal - cogs, netProfit: revenueTotal - expensesTotal,
      marginPct: revenueTotal ? Math.round((revenueTotal - expensesTotal) / revenueTotal * 100) : 0,
      grossMarginPct: revenueTotal ? Math.round((revenueTotal - cogs) / revenueTotal * 100) : 0,
      byCategory: byCat, months,
      openAR: D.invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + i.amount, 0),
      openPayouts: D.payouts.filter(p => p.status === 'pending').reduce((s,p) => s + p.amount, 0) };
  },
  runPayroll(){
    const rate = D.settings.payroll.defaultHourlyRate;
    const since = addDays(-14);
    const byEmp = {};
    D.timeEntries.filter(t => t.date >= since && !t.paidOut).forEach(t => (byEmp[t.employeeId] = byEmp[t.employeeId] || []).push(t));
    const made = [];
    for (const empId of Object.keys(byEmp)){
      const hours = byEmp[empId].reduce((s,t) => s + t.hours, 0);
      const p = { id: uid('po'), employeeId: empId, employee: empName(empId), hours, rate, amount: Math.round(hours * rate),
        periodStart: since, periodEnd: today(), status: 'pending', createdAt: new Date().toISOString(), method: 'Stripe transfer (simulated)' };
      D.payouts.push(p); byEmp[empId].forEach(t => t.paidOut = p.id); made.push(p);
      logActivity(`Payroll: ${p.employee} — ${hours}h × $${rate} = ${fmt(p.amount)} (pending)`);
    }
    persistDemo(); return { created: made.length, payouts: made };
  },
  payPayout(id){
    const p = D.payouts.find(p => p.id === id); if (!p) return { error: 'Payout not found' };
    if (p.status === 'paid') return { error: 'Already paid' };
    p.status = 'paid'; p.paidAt = new Date().toISOString(); p.transferRef = 'tr_sim_' + uid('');
    D.expenses.push({ id: uid('x'), date: today(), category: 'Payroll', vendor: p.employee, amount: p.amount, note: `Contractor payout ${p.id} (${p.hours}h)` });
    logActivity(`Payout paid: ${p.employee} ${fmt(p.amount)} (${p.transferRef})`);
    persistDemo(); return p;
  },
};
function logActivity(msg){ (LIVE ? null : D.activity.push({ t: new Date().toISOString(), msg })); if (!LIVE) persistDemo(); }

/* collection map: state key ↔ REST path */
const COLL = { stats:'stats', leads:'leads', accounts:'accounts', contacts:'contacts', quotes:'quotes', jobs:'jobs',
  timeEntries:'timeEntries', checklists:'checklists', checklistRuns:'checklistRuns', invoices:'invoices',
  expenses:'expenses', revenue:'revenue', employees:'employees', applicants:'applicants', candidates:'candidates',
  vendors:'vendors', purchaseOrders:'purchaseOrders', content:'content', campaigns:'campaigns',
  tickets:'tickets', feedback:'feedback', wiki:'wiki', policies:'policies', approvals:'approvals',
  notifications:'notifications', competitors:'competitors', activity:'activity', settings:'settings',
  employeeOnboardings:'employeeOnboardings', clientOnboardings:'clientOnboardings',
  surveys:'surveys', followUps:'followUps', payouts:'payouts', financialAlerts:'finance/alerts', crmVisitors:'crmVisitors', payments:'payments', affiliates:'affiliates', commissions:'commissions', interviews:'interviews', hirePackages:'hirePackages', filings:'filings',
  tripPlans:'trip-plans', travelEvents:'travel-events', golive:'golive', launchTasks:'launch-tasks', licenses:'licensing' };
const WRITABLE = new Set(['leads','accounts','contacts','quotes','jobs','timeEntries','checklists','checklistRuns','invoices','expenses','revenue','employees','candidates','vendors','purchaseOrders','content','campaigns','tickets','feedback','employeeOnboardings','clientOnboardings','surveys','followUps','payouts','financialAlerts','payments','filings','travelEvents']);

const state = {}; // in-memory cache of live data
function cur(coll){ return LIVE ? (state[coll] || []) : D[coll]; }

async function get(coll, force){
  if (LIVE) { if (force || !state[coll]) state[coll] = await raw('/api/' + COLL[coll]); return state[coll]; }
  return D[coll];
}
function decorate(coll, rows){
  const list = rows || [];
  if (coll === 'accounts' && !LIVE) return list.map(a => { const h = demoAgents.health(a); return { ...a, health: h.level, healthNotes: h.notes }; });
  if (coll === 'jobs') return list.map(j => j.account ? j : { ...j, account: acctName(j.accountId) });
  if (coll === 'invoices') return list.map(i => i.account ? i : { ...i, account: acctName(i.accountId) });
  if (coll === 'quotes') return list.map(q => q.account ? q : { ...q, account: acctName(q.accountId) });
  if (coll === 'contacts') return list.map(c => c.account ? c : { ...c, account: acctName(c.accountId) });
  if (coll === 'tickets' || coll === 'feedback') return list.map(t => t.account ? t : { ...t, account: acctName(t.accountId) });
  if (coll === 'timeEntries') return list.map(t => t.job ? t : { ...t, job: (D.jobs.find(j=>j.id===t.jobId)||{}).title || '—', employee: empName(t.employeeId) });
  if (coll === 'purchaseOrders') return list.map(p => p.vendor ? p : { ...p, vendor: (D.vendors.find(v=>v.id===p.vendorId)||{}).name || '—' });
  if (coll === 'checklistRuns') return list.map(r => r.checklist ? r : { ...r, checklist: (D.checklists.find(k=>k.id===r.checklistId)||{}).name || '—', job: (D.jobs.find(j=>j.id===r.jobId)||{}).title || '—', employee: empName(r.employeeId) });
  if (coll === 'employeeOnboardings' || coll === 'clientOnboardings') return list.map(o => o.progress !== undefined ? o : withProgress(o));
  if (coll === 'surveys') return list.map(s => s.account ? s : { ...s, account: acctName(s.accountId), job: ((LIVE ? (state.jobs||[]) : D.jobs).find(j=>j.id===s.jobId)||{}).title || '—' });
  if (coll === 'followUps') return list.map(f => f.account ? f : { ...f, account: acctName(f.accountId) });
  return list;
}
async function list(coll){ return decorate(coll, await get(coll)); }

async function create(coll, item){
  if (LIVE) { const r = await raw('/api/' + COLL[coll], { method:'POST', body: JSON.stringify(item) }); state[coll] = null; return r; }
  if (coll === 'leads') Object.assign(item, demoAgents.scoreLead(item));
  if (coll === 'quotes') item.number = 'Q-2026-' + String(D.quotes.length + 1).padStart(3,'0');
  if (coll === 'invoices') { item.number = 'L&L-2026-' + String(D.invoices.length + 1).padStart(3,'0'); item.issued = today(); item.dueDate = addDays(D.settings.invoiceTermsDays || 30); }
  if (coll === 'purchaseOrders') item.number = 'PO-2026-' + String(D.purchaseOrders.length + 11).padStart(3,'0');
  if (coll === 'employeeOnboardings' || coll === 'clientOnboardings') {
    if (!item.steps) item.steps = freshSteps(coll === 'employeeOnboardings' ? EMP_STEPS : CLIENT_STEPS);
    item.status = 'in-progress'; item.created = today();
    logActivity(`Onboarding started: ${item.name || item.company}`);
  }
  const row = { id: uid(coll.slice(0,2)), ...item };
  D[coll].push(row);
  if (coll === 'leads') logActivity(`Lead Score Agent scored ${row.name || row.company} ${row.score} (${row.tier})`);
  persistDemo(); return row;
}
async function patch(coll, id, changes){
  if (LIVE) { const r = await raw(`/api/${COLL[coll]}/${id}`, { method:'PATCH', body: JSON.stringify(changes) }); state[coll] = null; return r; }
  const row = D[coll].find(x => x.id === id); if (row) Object.assign(row, changes);
  if (row && (coll === 'employeeOnboardings' || coll === 'clientOnboardings') && Array.isArray(row.steps)
      && row.steps.length && row.steps.every(s => s.done) && row.status !== 'complete') {
    row.status = 'complete'; row.completedAt = today();
    logActivity(`Onboarding complete: ${row.name || row.company}`);
  }
  persistDemo(); return row;
}

/* domain actions (live → API action routes, demo → local heuristics) */
async function dispatchJob(id){
  if (LIVE) { const r = await raw(`/api/jobs/${id}/dispatch`, { method:'POST' }); state.jobs = state.activity = null; return r; }
  const j = D.jobs.find(j => j.id === id); const r = demoAgents.dispatch(j);
  if (r.match) { j.crew = r.match.name; if (j.status === 'lead') j.status = 'quoted'; logActivity(`Job Dispatch Agent matched ${r.match.name} to ${j.title}`); }
  persistDemo(); return { job: j, ...r };
}
async function remindInvoice(id){
  if (LIVE) { const r = await raw(`/api/invoices/${id}/remind`, { method:'POST' }); ['invoices','notifications','activity'].forEach(k => state[k] = null); return r; }
  const i = D.invoices.find(i => i.id === id); const r = demoAgents.reminder(i);
  i.reminders = (i.reminders||0) + 1; i.lastReminderTone = r.tone;
  D.notifications.unshift({ id: uid('n'), channel:'email', to: acctName(i.accountId), subject: r.subject, status:'sent', sentAt: new Date().toISOString(), preview: r.body.slice(0,120) + '…' });
  logActivity(`Invoice Reminder Agent sent ${r.tone} reminder for ${i.number}`);
  persistDemo(); return { invoice: i, ...r };
}
async function convertQuote(id){
  if (LIVE) { const r = await raw(`/api/quotes/${id}/convert`, { method:'POST' }); ['quotes','jobs','activity'].forEach(k => state[k] = null); return r; }
  const q = D.quotes.find(q => q.id === id); q.status = 'accepted';
  const job = { id: uid('j'), title: q.title, accountId: q.accountId, status:'quoted', crew:null, value: q.amount, due: addDays(30), progress: 0, notes: `Converted from ${q.number}` };
  D.jobs.push(job); logActivity(`Quote ${q.number} accepted → job created: ${job.title}`); persistDemo(); return { quote: q, job };
}
async function approveApplicant(id){
  if (LIVE) { const r = await raw(`/api/applicants/${id}/approve`, { method:'POST' }); ['applicants','employees','activity'].forEach(k => state[k] = null); return r; }
  const a = D.applicants.find(a => a.id === id); a.status = 'approved';
  const emp = { id: uid('e'), name: `${a.firstName} ${a.lastName}`, role: a.position, type:'1099', w9Signed:false, rating:4.0, skills:(a.skills||'').split(/,\s*/), availability: a.availability || 'part-time' };
  D.employees.push(emp); logActivity(`Onboarding: ${emp.name} approved → portal link issued`); persistDemo();
  return { employee: emp, portalToken: 'demo-' + emp.id, portalUrl: '/portal.html?token=demo-crew-token' };
}
async function rejectApplicant(id, reason){
  if (LIVE) { const r = await raw(`/api/applicants/${id}/reject`, { method:'POST', body: JSON.stringify({ reason }) }); state.applicants = null; return r; }
  const a = D.applicants.find(a => a.id === id); a.status = 'rejected'; a.rejectReason = reason || ''; persistDemo(); return { ok:true };
}
async function decideApproval(id, decision){
  if (LIVE) { const r = await raw(`/api/approvals/${id}/decide`, { method:'POST', body: JSON.stringify({ decision }) }); ['approvals','activity'].forEach(k => state[k] = null); return r; }
  const a = D.approvals.find(a => a.id === id); a.status = decision === 'reject' ? 'rejected' : 'approved'; logActivity(`Approval ${a.status}: ${a.title}`); persistDemo(); return a;
}
async function repurposeContent(id){
  if (LIVE) { const r = await raw(`/api/content/${id}/repurpose`, { method:'POST' }); state.activity = null; return r; }
  const c = D.content.find(c => c.id === id); const r = demoAgents.repurpose(c); logActivity(`Content Repurposing Agent repurposed "${c.title}"`); return { content: c.title, ...r };
}
async function runChecklist(id, jobId){
  if (LIVE) { const r = await raw(`/api/checklists/${id}/run`, { method:'POST', body: JSON.stringify({ jobId }) }); state.checklistRuns = null; return r; }
  const k = D.checklists.find(k => k.id === id);
  const run = { id: uid('kr'), checklistId: id, jobId: jobId || null, employeeId: 'e1', date: today(), completed: k.items.map(() => true) };
  D.checklistRuns.push(run); logActivity(`Checklist run logged: ${k.name}`); persistDemo(); return run;
}
async function runAgent(key, payload){
  if (LIVE) { const r = await raw(`/api/agents/${key}/run`, { method:'POST', body: JSON.stringify(payload || {}) }); state.activity = null; return r; }
  let result;
  switch (key) {
    case 'lead-score': result = demoAgents.scoreLead(payload || {}); break;
    case 'dispatch': { const j = D.jobs.find(j => j.id === (payload||{}).jobId) || D.jobs[0]; result = { job: j.title, ...demoAgents.dispatch(j) }; break; }
    case 'reminder': { const i = D.invoices.find(i => i.id === (payload||{}).invoiceId) || D.invoices.find(i => i.status === 'overdue') || D.invoices[0]; result = { invoice: i.number, ...demoAgents.reminder(i) }; break; }
    case 'health': result = D.accounts.map(a => ({ account: a.name, ...demoAgents.health(a) })); break;
    case 'watch': result = demoAgents.watch(); break;
    case 'daily-ops': result = demoAgents.dailyBrief(); break;
    case 'status-email': { const j = D.jobs.find(j => j.id === (payload||{}).jobId) || D.jobs.find(j => j.status === 'in-progress') || D.jobs[0]; result = demoAgents.jobStatusEmail(j); break; }
    case 'repurpose': { const c = D.content.find(c => c.id === (payload||{}).contentId) || D.content[0]; result = { content: c.title, ...demoAgents.repurpose(c) }; break; }
    case 'competitor': result = demoAgents.competitorAnalysis((payload||{}).name); break;
    case 'crm': result = demoAgents.crmSweep(); break;
    case 'finance-watchdog': result = demoAgents.financeScan(); break;
    case 'pricing': result = demoBuildQuote(payload || {}); break;
    case 'hiring': { const pk=D.hirePackages||[]; const ret=pk.filter(p=>p.status==='returned');
      result={packetsSent:pk.length,awaitingSignature:pk.filter(p=>p.status==='sent').length,returned:ret.length,interviewsJustScheduled:ret.length,interviews:D.interviews||[]}; break; }
    case 'procurement': { result={pos:[],comparisons:[],jobsReviewed:0}; break; }
    case 'compliance': result = demoAgents.stateFilings(); break;
    case 'ap-ar': result = demoAgents.apAr(); break;
  }
  logActivity(`Agent run: ${key}`); return { agent: key, ranAt: new Date().toISOString(), result };
}
async function cron(path){
  if (LIVE) { const r = await raw('/api/cron/' + path); state.activity = state.notifications = null; return r; }
  return demoAgents.dailyBrief();
}
/* finance / CRM / payroll actions (live → API, demo → local mirrors) */
async function financeScanNow(){ if (LIVE) { const r = await raw('/api/agent/finance/scan', { method:'POST' }); ['financialAlerts','activity','notifications'].forEach(k => state[k] = null); return r; } return demoAgents.financeScan(); }
async function crmSweepNow(){ if (LIVE) { const r = await raw('/api/agent/crm/sweep', { method:'POST' }); ['surveys','followUps','invoices','activity'].forEach(k => state[k] = null); return r; } return demoAgents.crmSweep(); }
async function runPayrollNow(){ if (LIVE) { const r = await raw('/api/payroll/run', { method:'POST' }); ['payouts','timeEntries','activity'].forEach(k => state[k] = null); return r; } return demoAgents.runPayroll(); }
async function payPayoutNow(id){ if (LIVE) { const r = await raw(`/api/payouts/${id}/pay`, { method:'POST' }); ['payouts','expenses','activity','notifications'].forEach(k => state[k] = null); return r; } return demoAgents.payPayout(id); }
async function getPnl(){ if (LIVE) return raw('/api/finance/pnl'); return demoAgents.computePnl(); }
async function getIntegrations(){ if (LIVE) return raw('/api/integrations');
  return { quickbooks: { ...D.settings.integrations.quickbooks, mode: D.settings.integrations.quickbooks.connected ? 'connected' : 'simulated' },
    stripe: { ...D.settings.integrations.stripe, secretKeySet: false, mode: 'simulated' },
    taxRates: Object.entries(TAX_RATES).map(([st, t]) => ({ state: st, name: t.name, rate: t.rate })) }; }
async function integrationAction(kind, action, payload){   // kind: quickbooks|stripe, action: connect|disconnect|sync-taxes
  if (LIVE) return raw(`/api/integrations/${kind}/${action}`, { method:'POST', body: JSON.stringify(payload || {}) });
  const itg = D.settings.integrations[kind];
  if (action === 'connect'){ itg.connected = true; itg.lastSync = new Date().toISOString(); if (kind === 'quickbooks') itg.environment = (payload||{}).environment || 'sandbox'; }
  if (action === 'disconnect') itg.connected = false;
  if (action === 'sync-taxes'){ itg.lastSync = new Date().toISOString(); persistDemo(); return { ok: true, synced: Object.keys(TAX_RATES).length, lastSync: itg.lastSync, rates: TAX_RATES }; }
  logActivity(`${kind === 'quickbooks' ? 'QuickBooks' : 'Stripe'} ${action}`); persistDemo();
  return { ok: true, [kind]: itg };
}
async function stripeOverview(){
  if (LIVE) return raw('/api/stripe/overview');
  const payments = D.payments || [];
  const collected = payments.reduce((s,p) => s + p.amount, 0);
  const paidOut = D.payouts.filter(p => p.status === 'paid').reduce((s,p) => s + p.amount, 0);
  return { source: 'simulated',
    balance: { available: collected - paidOut, pending: D.invoices.filter(i => i.status === 'sent').reduce((s,i) => s + i.amount, 0), currency: 'usd' },
    charges: payments.slice().reverse().slice(0,10).map(p => ({ id: p.id, amount: p.amount, status: 'succeeded', method: p.method, created: p.date, invoice: (D.invoices.find(i => i.id === p.invoiceId)||{}).number || '—' })),
    payouts: D.payouts.slice().reverse().slice(0,10), disputes: [],
    note: 'Simulated from local books — set STRIPE_SECRET_KEY to switch to the live Stripe account feed.' };
}
async function saveSettings(s){
  if (LIVE) return raw('/api/settings', { method:'POST', body: JSON.stringify(s) });
  const deep=(t,src)=>{ for (const k of Object.keys(src)){ if (src[k] && typeof src[k]==='object' && !Array.isArray(src[k]) && t[k] && typeof t[k]==='object' && !Array.isArray(t[k])) deep(t[k],src[k]); else t[k]=src[k]; } };
  deep(D.settings, s); persistDemo(); return D.settings;
}

/* ================= AI PROVIDERS API (BYOK) ================= */
const AI_PRESETS_DEMO = [
  { id:'openrouter', name:'OpenRouter', type:'openai', baseUrl:'https://openrouter.ai/api/v1', models:['meta-llama/llama-3.3-70b-instruct:free','deepseek/deepseek-chat-v3-0324:free'], free:true, note:'Zero-cost default: :free models, first is used with the second as fallback. Free tier has daily request limits — watch usage on the AI Providers panel.' },
  { id:'anthropic', name:'Claude (Anthropic)', type:'anthropic', baseUrl:'https://api.anthropic.com/v1', models:['claude-sonnet-4-5'] },
  { id:'openai', name:'ChatGPT (OpenAI)', type:'openai', baseUrl:'https://api.openai.com/v1', models:['gpt-4o-mini'] },
  { id:'gemini', name:'Gemini (Google)', type:'gemini', baseUrl:'https://generativelanguage.googleapis.com/v1beta', models:['gemini-2.0-flash'] },
  { id:'copilot', name:'GitHub Copilot', type:'openai', baseUrl:'https://api.githubcopilot.com', models:['gpt-4o'], note:'Experimental — requires a Copilot OAuth token' },
  { id:'venice', name:'Venice.ai', type:'openai', baseUrl:'https://api.venice.ai/api/v1', models:['llama-3.3-70b'] },
  { id:'zai', name:'Z.ai (GLM)', type:'openai', baseUrl:'https://api.z.ai/api/paas/v4', models:['glm-4.5-air'] },
  { id:'tasker', name:'Tasker', type:'openai', baseUrl:'https://api.tasker.ai/v1', models:['default'], note:'Confirm endpoint from your Tasker account' },
  { id:'nemus', name:'Nemus.ai', type:'openai', baseUrl:'https://api.nemus.ai/v1', models:['default'], note:'Confirm endpoint from your Nemus account' },
  { id:'numes', name:'Numes.ai', type:'openai', baseUrl:'https://api.numes.ai/v1', models:['default'], note:'Confirm endpoint from your Numes account' },
  { id:'agnes', name:'Agnes', type:'openai', baseUrl:'https://api.agnes.ai/v1', models:['default'], note:'Confirm endpoint from your Agnes account' },
  { id:'alliteration', name:'Alliteration.ai', type:'openai', baseUrl:'https://api.alliteration.ai/v1', models:['default'], note:'Confirm endpoint from your Alliteration account' },
  { id:'selfhost', name:'Self-hosted (Llama / LM Studio)', type:'openai', baseUrl:'http://localhost:1234/v1', models:['local-model'], note:'Any OpenAI-compatible local endpoint' },
];
async function aiApi(path, opts){
  if (LIVE) return raw('/api/ai/' + path, opts || {});
  opts = opts || {};
  D.settings.aiProviders = D.settings.aiProviders || [];
  D.settings.agentRouting = D.settings.agentRouting || {};
  const pub = p => { const o = Object.assign({}, p); delete o.apiKey; o.hasKey = !!p.apiKey; o.keyMasked = p.apiKey ? '••••' + p.apiKey.slice(-4) : ''; return o; };
  if (!opts.method || opts.method === 'GET'){
    if (path === 'providers') return { presets: AI_PRESETS_DEMO, providers: D.settings.aiProviders.map(pub), defaultId: (D.settings.aiProviders.find(p => p.isDefault) || {}).id || null };
    if (path === 'routing') return { agents: D.agents.map(a => ({ key: a.id, name: a.name, auto: a.auto !== false })), routing: D.settings.agentRouting, providers: D.settings.aiProviders.filter(p => p.enabled).map(p => ({ id: p.id, name: p.name, hasKey: !!p.apiKey })) };
    if (path === 'usage') return D.settings.aiUsage && D.settings.aiUsage.date ? D.settings.aiUsage : { date: new Date().toISOString().slice(0,10), byProvider: {} };
    if (path === 'setup') return { configured: !!(D.settings.setup && D.settings.setup.aiConfigured), opencodeKeyMasked: (D.settings.setup && D.settings.setup.opencodeKey) ? 'oc_…' + D.settings.setup.opencodeKey.slice(-4) : '', promptedAt: (D.settings.setup || {}).aiPromptedAt || null };
    if (path === 'ai/local/status') return { home: 'demo', binaryPresent: false, models: [], running: false, port: 11540, hint: 'Demo mode — local model hosting runs in the live build.' };
    if (path.indexOf('ai/local/') === 0) return { ok: true, demo: true };
  }
  const b = JSON.parse(opts.body || '{}');
  if (path === 'providers' && opts.method === 'POST'){
    let p = b.id ? D.settings.aiProviders.find(x => x.id === b.id) : null;
    if (!p){ const pre = AI_PRESETS_DEMO.find(x => x.id === (b.preset || b.id)) || {}; p = Object.assign({ id: b.preset || b.id || ('ai' + Date.now().toString(36)), createdAt: new Date().toISOString() }, pre); D.settings.aiProviders.push(p); }
    if (b.apiKey && !b.apiKey.includes('…')) p.apiKey = b.apiKey;
    ['name','type','baseUrl','enabled','rpm','note'].forEach(k => { if (b[k] != null) p[k] = b[k]; });
    if (b.models != null) p.models = Array.isArray(b.models) ? b.models : String(b.models).split(',').map(x => x.trim()).filter(Boolean);
    if (b.isDefault){ D.settings.aiProviders.forEach(x => x.isDefault = false); p.isDefault = true; }
    persistDemo();
    return pub(p);
  }
  if (path === 'providers' && opts.method === 'DELETE'){ const i = D.settings.aiProviders.findIndex(x => x.id === b.id); if (i >= 0) D.settings.aiProviders.splice(i, 1); persistDemo(); return { deleted: b.id }; }
  if (path === 'providers/test') return { ok: false, simulated: true, reason: 'Demo mode — add a key in the live build to test', latencyMs: 4 };
  if (path === 'routing' && opts.method === 'POST'){ const r = D.settings.agentRouting; if (b.mode === 'auto') delete r[b.agent]; else r[b.agent] = { mode: b.mode || 'fixed', providerId: b.providerId || null, fallbackIds: (b.fallbackIds || []).filter(Boolean) }; persistDemo(); return { agent: b.agent, routing: r[b.agent] || { mode: 'auto' } }; }
  if (path === 'assist') return { simulated: true, text: null, provider: null, reason: 'Demo mode — no live provider configured' };
  if (path === 'setup' && opts.method === 'POST'){ D.settings.setup = D.settings.setup || {}; let oc = null; if (!D.settings.setup.opencodeKey){ D.settings.setup.opencodeKey = 'oc_demo_' + Math.random().toString(36).slice(2, 14); oc = D.settings.setup.opencodeKey; } D.settings.setup.aiConfigured = true; persistDemo(); return { ok: true, added: [], opencodeKey: oc, opencodeKeyMasked: 'oc_…' + D.settings.setup.opencodeKey.slice(-4) }; }
  return { ok: false, error: 'demo: unsupported ai op ' + path };
}

/* ================= LAYOUT ================= */
/* Role-based access. Groups: office = desk staff, ops = desk + field crew,
   exec = owner/admin only. owner & admin pass every gate (can() short-circuits). */
const ROLE_GROUPS = {
  office: ['owner','admin','manager','staff'],
  ops:    ['owner','admin','manager','staff','contractor','tech','crew'],
  exec:   ['owner','admin'],
};
function can(role, g){
  if (role === 'owner' || role === 'admin') return true;
  return (ROLE_GROUPS[g] || ROLE_GROUPS.office).includes(role);
}
/* Non-staff roles land on their portal, never the dashboard */
const ROLE_HOME = { client:'customer.html', partner:'affiliate.html', affiliate:'affiliate.html',
  contractor:'portal.html', tech:'portal.html', crew:'portal.html' };

const NAV = [
  { page:'dashboard.html', key:'overview',  label:'Overview',   g:'office', icon:'<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>' },
  { page:'sales.html',     key:'sales',     label:'Sales',      g:'office', icon:'<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>', badge:'leads' },
  { page:'ops.html',       key:'ops',       label:'Operations', g:'ops', icon:'<path d="M14 6l-8.5 8.5a2.1 2.1 0 003 3L17 9"/><path d="M15 5l4 4"/><path d="M4 20l4-1-3-3z"/>', badge:'jobs' },
  { page:'finance.html',   key:'finance',   label:'Finance',    g:'office', icon:'<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/>', badge:'invoices' },
  { page:'team.html',      key:'team',      label:'Team & HR',  g:'office', icon:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.8.2 4.7 2 5.5 5.4"/>', badge:'applicants' },
  { page:'onboarding.html', key:'onboarding', label:'Onboarding', g:'office', icon:'<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.8-3.4 3.4-5.4 6.5-5.4s5.7 2 6.5 5.4"/><path d="M18 4.5v6M21 7.5h-6"/>', badge:'onboarding' },
  { page:'marketing.html', key:'marketing', label:'Marketing',  g:'office', icon:'<path d="M3 11l18-7-7 18-2.5-7.5z"/>' },
  { page:'brand.html',     key:'brand',     label:'Brand Kit',  g:'exec', icon:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>' },
  { page:'studio.html',    key:'studio',    label:'Studio',     g:'exec', icon:'<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>' },
  { page:'ads.html',       key:'ads',       label:'Ad Manager', g:'office', icon:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l3-6 2.5 4L14 10l3 5z"/><circle cx="8" cy="8.5" r="1"/>' },
  { page:'compliance.html', key:'compliance', label:'Compliance', g:'office', icon:'<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>' },
  { page:'admin.html',     key:'admin',     label:'Agents & Admin', g:'exec', icon:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>', badge:'approvals' },
  { page:'inquiries.html', key:'inquiries', label:'Inquiries',  g:'office', icon:'<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>', badge:'inquiries' },
  { page:'calendar.html',  key:'calendar',  label:'Calendar',   g:'ops', icon:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', badge:'events' },
  { page:'trips.html',     key:'trips',     label:'Trip Plans', g:'office', icon:'<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>' },
  { page:'golive.html',    key:'golive',    label:'Go Live',   g:'exec', icon:'<path d="M12 2c1 4-2 5-2 8a2 2 0 004 0c0-1-.5-1.5-.5-2.5C16 9 17.5 11 17.5 14a5.5 5.5 0 11-11 0C6.5 9 10 6 12 2z"/>' },
  { page:'keys.html',    key:'keys',    label:'Keys & Integrations', g:'exec', icon:'<circle cx="8" cy="15" r="4.5"/><path d="M11.5 11.5L21 2M15.5 7.5l3 3M18.5 4.5l2 2"/>' },
  { page:'licensing.html', key:'licensing', label:'License & Insurance', g:'office', icon:'<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>' },
  { page:'valuation.html', key:'valuation', label:'Valuation', g:'exec', icon:'<path d="M3 20h18M6 16v-5M11 16V8M16 16v-8M21 16V5"/>' },
  { page:'funding.html', key:'funding', label:'Documents & Funding', g:'exec', icon:'<path d="M7 3h8l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M15 3v5h5"/><path d="M9 13h6M9 17h4"/>' },
  { page:'newsletter.html', key:'newsletter', label:'Newsletter & Visitors', g:'office', icon:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>' },
];
const PAGE_GROUP = Object.fromEntries(NAV.map(n => [n.key, n.g]));
function sidebar(active){
  const badges = { leads: cur('leads').length, jobs: cur('jobs').filter(j => j.status !== 'complete').length,
    invoices: cur('invoices').filter(i => i.status === 'overdue').length || '',
    applicants: cur('applicants').filter(a => a.status === 'new').length || '',
    approvals: cur('approvals').filter(a => a.status === 'pending').length || '',
    onboarding: (cur('employeeOnboardings').filter(o => o.status !== 'complete').length
               + cur('clientOnboardings').filter(o => o.status !== 'complete').length) || '' };
  const items = NAV.filter(n => can(USER.role, n.g)).map(n => `<a class="sb-item ${n.key === active ? 'active' : ''}" href="${n.page}"><svg viewBox="0 0 24 24">${n.icon}</svg>${n.label}${n.badge && badges[n.badge] ? `<span class="pill">${badges[n.badge]}</span>` : ''}</a>`).join('');
  const initials = (USER.name || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return `<a class="sb-logo" href="dashboard.html"><img src="logo-hero.png" alt="Lines &amp; Logos"><div><b class="chrome">LINES &amp; LOGOS</b><small>BUSINESS SUITE</small></div></a>
    ${items}
    <div class="sb-sec">Portals</div>
    <a class="sb-item" href="portal.html"><svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/></svg>Crew Portal</a>
    <a class="sb-item" href="index.html"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 4 5.7 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.7-4-9s1.5-6.4 4-9z"/></svg>Website</a>
    <div class="sb-foot"><div class="sb-user"><div class="av">${initials}</div><div><b>${esc(USER.name || 'User')}</b><small>${USER.role === 'client' ? 'Client portal' : USER.role === 'owner' ? 'Owner' : 'Contractor'}</small></div><button onclick="OS.logout()">Log out</button></div>
    <span class="badge-demo" id="modeBadge" style="display:${LIVE ? 'none' : 'block'}">DEMO MODE</span></div>`;
}
function mobileNav(active){
  return `<nav class="m-nav"><img src="logo-hero.png" alt="L&L">${NAV.filter(n => can(USER.role, n.g)).map(n => `<a class="${n.key === active ? 'active' : ''}" href="${n.page}">${n.label}</a>`).join('')}<a href="portal.html">Portal</a><a href="index.html">Site</a></nav>`;
}
function logout(){ localStorage.removeItem('ll_token'); localStorage.removeItem('ll_user'); location.href = 'login.html'; }

/* ================= UI HELPERS ================= */
function toast(m){ let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
function openModal(title, fieldsHtml){
  let bg = $('#modalBg');
  if (!bg) { bg = document.createElement('div'); bg.className = 'modal-bg'; bg.id = 'modalBg';
    bg.innerHTML = '<div class="modal"><h2 class="chrome" id="modalTitle"></h2><div id="modalFields"></div><div class="actions"><button class="btn" id="modalSave">Save</button><button class="btn btn-ghost" onclick="OS.closeModal()">Cancel</button></div></div>';
    document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }
  $('#modalTitle').textContent = title; $('#modalFields').innerHTML = fieldsHtml;
  bg.classList.add('open'); const f = $('#modalFields input, #modalFields select, #modalFields textarea'); if (f) f.focus();
}
function closeModal(){ const bg = $('#modalBg'); if (bg) bg.classList.remove('open'); }
function onModalSave(fn){ $('#modalSave').onclick = fn; }
function field(id){ const el = $('#' + id); return el ? el.value.trim() : ''; }

const TIER = t => ({ hot:'t-hot', warm:'t-warm', cold:'t-cold' }[t] || 't-grey');
const INV  = s => ({ paid:'t-green', sent:'t-blue', overdue:'t-red', draft:'t-grey' }[s] || 't-grey');
const JOBS = s => ({ 'in-progress':'t-lime', quoted:'t-blue', lead:'t-yellow', complete:'t-green', dispatched:'t-blue', pending:'t-orange' }[s] || 't-grey');
const GEN  = s => ({ active:'t-lime', planned:'t-yellow', paused:'t-grey', done:'t-green', complete:'t-green', draft:'t-grey', sent:'t-blue', published:'t-green', scheduled:'t-blue', accepted:'t-green', declined:'t-red', open:'t-orange', resolved:'t-green', pending:'t-yellow', approved:'t-green', rejected:'t-red', new:'t-blue', received:'t-green', high:'t-red', normal:'t-blue', low:'t-grey', medium:'t-yellow', applied:'t-grey', screen:'t-blue', interview:'t-volley', offer:'t-yellow', hired:'t-green', strong:'t-green', maybe:'t-yellow', weak:'t-red', 'ACT NOW':'t-red', watch:'t-yellow', logged:'t-grey', 'in-progress':'t-blue', 'not-started':'t-grey', suspended:'t-red', completed:'t-green', cancelled:'t-red', returned:'t-yellow', 'interview-scheduled':'t-lime' }[s] || 't-grey');

/* ================= DOCKED CHATBOT ================= */
const CB_ICON = {
  download: '<path d="M12 3v11"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  minus:    '<path d="M5 12h14"/>',
  close:    '<path d="M6 6l12 12M18 6L6 18"/>',
  clip:     '<path d="M20 11.5l-8.6 8.6a5.2 5.2 0 01-7.4-7.4l8.6-8.6a3.4 3.4 0 014.9 4.9l-8.6 8.6a1.7 1.7 0 01-2.5-2.5l7.4-7.4"/>',
  send:     '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  chat:     '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 9h8M8 13h5"/>',
};
const cbSvg = (k) => `<svg viewBox="0 0 24 24">${CB_ICON[k]}</svg>`;

/* demo-mode reply heuristic (mirrors server chatAnswer, reads demo db) */
function demoChatReply(msg){
  const m = (msg || '').toLowerCase();
  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(m))
    return 'Hey — I\'m the Lines & Logos assistant (demo data). Ask me about overdue invoices, hot leads, jobs, onboarding status, open quotes, or say "brief".';
  if (/onboard/.test(m)) {
    const e = D.employeeOnboardings, c = D.clientOnboardings;
    const line = o => `  • ${o.name || o.company} — ${o.steps.filter(s=>s.done).length}/${o.steps.length} steps (${o.status})`;
    return [`Employee onboarding (${e.filter(o=>o.status!=='complete').length} active):`, ...e.filter(o=>o.status!=='complete').map(line),
      `Client onboarding (${c.filter(o=>o.status!=='complete').length} active):`, ...c.filter(o=>o.status!=='complete').map(line),
      'Open the Onboarding page to advance steps or start a new intake.'].join('\n');
  }
  if (/overdue|invoice|payment|owe/.test(m)) {
    const od = D.invoices.filter(i => i.status === 'overdue');
    if (!od.length) return 'No overdue invoices right now.';
    return `${od.length} overdue invoice(s):\n` + od.map(i => `  • ${i.number} — ${acctName(i.accountId)}, ${fmt(i.amount)}, ${daysOverdue(i)} days late`).join('\n')
      + `\nTotal outstanding: ${fmt(D.invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+i.amount,0))}.`;
  }
  if (/lead|prospect|pipeline|sales/.test(m)) {
    const hot = D.leads.filter(l => l.tier === 'hot');
    return `Pipeline: ${D.leads.length} leads, ${hot.length} hot.\n` + hot.map(l => `  • ${l.name} (${l.company}) — ${l.score}, next: ${l.nextStep}`).join('\n');
  }
  if (/job|schedule|crew|today|dispatch/.test(m)) {
    const act = D.jobs.filter(j => j.status === 'in-progress');
    return act.length ? 'Jobs in progress:\n' + act.map(j => `  • ${j.title} — ${j.crew || 'unassigned'}, due ${j.due}, ${j.progress}%`).join('\n') : 'No jobs in progress right now.';
  }
  if (/quote|proposal/.test(m)) {
    const open = D.quotes.filter(q => q.status === 'sent');
    return open.length ? 'Open quotes awaiting decision:\n' + open.map(q => `  • ${q.number} — ${q.title}, ${fmt(q.amount)}, valid until ${q.validUntil}`).join('\n') : 'No open quotes out for decision.';
  }
  if (/approval|approve/.test(m)) {
    const p = D.approvals.filter(a => a.status === 'pending');
    return p.length ? `${p.length} pending approval(s):\n` + p.map(a => `  • ${a.title} (${fmt(a.amount)}, requested by ${a.requestedBy})`).join('\n') : 'Nothing waiting on approval.';
  }
  if (/brief|summary|report|morning/.test(m)) {
    const b = demoAgents.dailyBrief();
    return `Daily brief for ${b.date}:\n  • ${b.jobsToday.length} job(s) in progress\n  • ${b.openQuotes.length} open quote(s)\n  • ${b.overdueInvoices.length} overdue invoice(s)\n  • ${b.hotLeads.length} hot lead(s)\n  • ${b.pendingApprovals} pending approval(s)`;
  }
  if (/profit|loss|p&l|margin|spending|spend/.test(m)) {
    const p = demoAgents.computePnl();
    return `P&L snapshot:\n  • Revenue: ${fmt(p.revenueTotal)}\n  • Expenses: ${fmt(p.expensesTotal)} (incl. contractor labor ${fmt(p.contractorLabor)})\n  • Net profit: ${fmt(p.netProfit)} (${p.marginPct}% margin, gross ${p.grossMarginPct}%)\n  • Open A/R: ${fmt(p.openAR)} · open contractor payouts: ${fmt(p.openPayouts)}\nFinance → P&L has the 6-month series.`;
  }
  if (/stripe|payout|anomal|fraud|suspicious|alert|odd|unusual/.test(m)) {
    const open = D.financialAlerts.filter(a => a.status === 'open');
    const pend = D.payouts.filter(p => p.status === 'pending');
    return `Financial Watchdog: ${open.length} open alert(s)${open.length ? ' — ' + open.slice(0,3).map(a => a.title).join('; ') : ''}.\nContractor payouts pending: ${pend.length} (${fmt(pend.reduce((s,p)=>s+p.amount,0))}). Say "run scan" to sweep the accounts again.`;
  }
  if (/run scan|scan financ|watchdog/.test(m)) { const r = demoAgents.financeScan(); return `Watchdog scan complete — ${r.newAlerts} new alert(s), ${r.openTotal} open total. Finance → Watchdog has the details.`; }
  if (/run crm|crm sweep/.test(m)) { const r = demoAgents.crmSweep(); return `CRM sweep complete — ${r.surveysSent} survey(s), ${r.invoicesSent} invoice(s), ${r.followUpsCreated} follow-up(s) queued.`; }
  if (/tax/.test(m)) {
    const qb = D.settings.integrations.quickbooks;
    return `Quotes include estimated combined state + local sales tax for the job's city — e.g. TN 9.55%, AR 9.45%, MS 7.07%, KY 6%. QuickBooks is ${qb.connected ? 'connected — tax sync on' : 'not connected yet (built-in rate table in use)'}. Admin → Integrations manages it.`;
  }
  if (/survey|follow.?up|crm|customer/.test(m)) {
    const sv = D.surveys, fu = D.followUps.filter(f => f.status === 'open');
    const rated = sv.filter(s => s.status === 'responded');
    const avg = rated.length ? (rated.reduce((s,x) => s + x.rating, 0) / rated.length).toFixed(1) : '—';
    return `CRM: ${sv.length} survey(s) out (${rated.length} responded, avg ${avg}★), ${fu.length} open follow-up(s), ${D.crmVisitors.length} website visitor(s) captured. Say "run crm" to sweep for surveys, invoices, and renewals.`;
  }
  if (/payroll|pay crew|contractor pay/.test(m)) {
    const pend = D.payouts.filter(p => p.status === 'pending');
    return `Contractor payroll: ${pend.length} pending payout(s) totaling ${fmt(pend.reduce((s,p)=>s+p.amount,0))}. Finance → Payouts can run payroll and pay out via the Stripe rail (simulated until keys are set).`;
  }
  if (/help|what can you|command/.test(m))
    return 'I can answer from company data. Try:\n  • "overdue invoices"\n  • "hot leads"\n  • "jobs today"\n  • "onboarding status"\n  • "open quotes"\n  • "pending approvals"\n  • "daily brief"\n  • "profit & loss" · "stripe alerts" · "tax rates"\n  • "crm status" · "payroll" · "run scan" · "run crm"';
  return `Here's where things stand: ${D.leads.filter(l=>l.tier==='hot').length} hot leads, ${D.jobs.filter(j=>j.status==='in-progress').length} active jobs, ${D.invoices.filter(i=>i.status==='overdue').length} overdue invoices, ${D.employeeOnboardings.length + D.clientOnboardings.length} onboarding tracks. Ask about any of those — or say "help".`;
}

function mountChatbot(){
  if ($('#cbRoot')) return;
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem('ll_chat_hist') || '[]'); } catch {}
  let st = localStorage.getItem('ll_chat_state') || 'open';
  if (st === 'closed') st = 'open';
  const root = document.createElement('div');
  root.id = 'cbRoot';
  root.innerHTML = `
    <section id="cbWin" role="dialog" aria-label="Lines &amp; Logos assistant">
      <header id="cbHead">
        <div class="cb-title"><span class="cb-dot"></span><div><b>L&amp;L Assistant</b><small>${LIVE ? 'Live company data' : 'Demo data'}</small></div></div>
        <div class="cb-icons">
          <button id="cbDl" title="Download transcript" aria-label="Download transcript">${cbSvg('download')}</button>
          <button id="cbMin" title="Minimize" aria-label="Minimize chat">${cbSvg('minus')}</button>
        </div>
      </header>
      <div id="cbMsgs" aria-live="polite"></div>
      <footer id="cbFoot">
        <button id="cbAttach" title="Attach a file" aria-label="Attach a file">${cbSvg('clip')}</button>
        <input type="file" id="cbFile" hidden>
        <input id="cbInput" type="text" placeholder="Ask about invoices, leads, jobs…" autocomplete="off" aria-label="Message the assistant">
        <button id="cbSend" title="Send message" aria-label="Send message">${cbSvg('send')}</button>
      </footer>
    </section>`;
  document.body.appendChild(root);

  const win = $('#cbWin'), msgs = $('#cbMsgs'), input = $('#cbInput');
  const persistHist = () => localStorage.setItem('ll_chat_hist', JSON.stringify(hist.slice(-100)));
  const setState = (s) => {
    st = s; localStorage.setItem('ll_chat_state', s);
    root.dataset.state = s;
    if (s === 'open') { renderMsgs(); setTimeout(() => input.focus(), 60); }
  };
  const bubbleHtml = (m) => `<div class="cb-row ${m.who}"><div class="cb-bub">${m.file ? `<span class="cb-file">${cbSvg('clip')}${esc(m.file)}</span>` : ''}${m.text ? esc(m.text) : ''}<span class="cb-time">${m.t || ''}</span></div></div>`;
  function renderMsgs(){
    msgs.innerHTML = hist.map(bubbleHtml).join('');
    msgs.scrollTop = msgs.scrollHeight;
  }
  const nowTime = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function pushMsg(m){ m.t = nowTime(); hist.push(m); persistHist(); renderMsgs(); }

  async function send(text, file){
    if (!text && !file) return;
    pushMsg({ who: 'user', text, file });
    msgs.insertAdjacentHTML('beforeend', '<div class="cb-row bot" id="cbTyping"><div class="cb-bub typing"><i></i><i></i><i></i></div></div>');
    msgs.scrollTop = msgs.scrollHeight;
    let reply;
    try {
      if (file && !text) text = '';
      if (LIVE) reply = (await raw('/api/chat', { method: 'POST', body: JSON.stringify({ message: text || `Attached file: ${file}` }) })).reply;
      else { await new Promise(r => setTimeout(r, 450)); reply = demoChatReply(text); }
      if (file) reply = `I've logged "${file}" with your message.` + (text ? '\n\n' + reply : ' File storage is not wired up in this build, so the attachment is noted by name only.');
    } catch (e) { reply = 'Sorry — I could not reach the assistant backend just now. Try again in a moment.'; }
    $('#cbTyping')?.remove();
    pushMsg({ who: 'bot', text: reply });
  }

  $('#cbMin').onclick = () => setState(st === 'min' ? 'open' : 'min');
  $('#cbHead').ondblclick = () => setState(st === 'min' ? 'open' : 'min');
  $('#cbDl').onclick = () => {
    if (!hist.length) { toast('No chat history to download yet'); return; }
    const lines = ['Lines & Logos — Assistant transcript', 'Exported ' + new Date().toLocaleString(), ''];
    hist.forEach(m => lines.push(`[${m.t}] ${m.who === 'user' ? (USER.name || 'You') : 'Assistant'}: ${m.file ? '[attachment: ' + m.file + '] ' : ''}${m.text}`));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    a.download = 'll-chat-transcript-' + today() + '.txt';
    a.click(); URL.revokeObjectURL(a.href);
    toast('Transcript downloaded');
  };
  $('#cbAttach').onclick = () => $('#cbFile').click();
  $('#cbFile').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB';
    const note = input.value.trim();
    input.value = '';
    send(note, `${f.name} (${size})`);
    e.target.value = '';
  };
  const doSend = () => { const v = input.value.trim(); if (!v) return; input.value = ''; send(v); };
  $('#cbSend').onclick = doSend;
  input.onkeydown = (e) => { if (e.key === 'Enter') doSend(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st === 'open') setState('closed'); });

  setState(st === 'min' ? 'min' : st === 'open' ? 'open' : 'closed');
  if (!hist.length) {
    hist.push({ who: 'bot', t: nowTime(), text: 'Welcome to Lines & Logos. I can pull live answers on invoices, leads, jobs, quotes, approvals, and onboarding — try "daily brief" or "onboarding status".' });
    persistHist(); if (st === 'open') renderMsgs();
  }
}

/* push notifications: every admin OS dashboard opts in as role "admin".
   pwa.js picks up data-perms="notifications" for the branded pre-prompt;
   push.js then registers the subscription with the server. Marketing pages
   never load os.js, so they are never prompted. */
try {
  if (document.body) {
    document.body.setAttribute('data-push-role', 'admin');
    const dp = document.body.getAttribute('data-perms') || '';
    if (!dp.includes('notifications')) document.body.setAttribute('data-perms', (dp + ' notifications').trim());
    const ps = document.createElement('script'); ps.src = 'assets/push.js?v=1'; ps.defer = true; document.head.appendChild(ps);
  }
} catch {}

/* boot: detect live mode, mount sidebar, run page init */
async function preloadNav(){ if (LIVE) await Promise.all(['leads','jobs','invoices','applicants','approvals','employeeOnboardings','clientOnboardings'].map(c => get(c).catch(() => null))); }
async function boot(activePage, pageTitle, initFn){
  if (TOKEN) try {
    const r = await fetch(BASE + '/api/me', { headers: { Authorization: 'Bearer ' + TOKEN } });
    if (r.ok) { LIVE = true; const me = await r.json(); Object.assign(USER, me); }
  } catch { /* offline preview — fall through to demo mode below */ }
  if (!TOKEN && !LIVE) {
    /* Probe the server once: if it's genuinely unreachable (file preview, static
       host, laptop offline), run as browser demo rather than bouncing to a login
       page that can't authenticate anyway. A reachable server keeps the login gate. */
    try {
      const ping = await fetch(BASE + '/api/health', { cache: 'no-store' });
      if (!ping.ok) throw new Error('down');
    } catch {
      /* In-memory only, never persisted: a later visit to a live server must
         still face the normal login gate. */
      DEMO_OK = true;
    }
  }
  document.title = pageTitle + ' — Lines & Logos';
  /* role-based access: backend pages are unreachable for non-staff roles.
     Client/partner/crew accounts are redirected to their own portal. */
  const gate = PAGE_GROUP[activePage];
  if (gate && !can(USER.role, gate)) {
    location.replace(ROLE_HOME[USER.role] || 'login.html');
    return;
  }
  if (!TOKEN && !DEMO_OK && activePage !== 'admin') {
    const pub = ['dashboard','sales','ops','finance','team','onboarding','marketing','brand','studio','ads','compliance','admin','inquiries','calendar','trips'];
    if (pub.includes(activePage)) { location.replace('login.html'); return; }
  }
  const sb = document.createElement('aside'); sb.innerHTML = sidebar(activePage); sb.removeAttribute('id');
  document.body.prepend(sb);
  document.body.insertAdjacentHTML('afterbegin', mobileNav(activePage));
  if (IS_CLIENT) { const b = document.createElement('div'); b.className = 'banner info'; b.textContent = 'Client view — quotes, jobs, and invoices for your facility. Contact your Lines & Logos rep to make changes.'; const m = $('main'); if (m) m.prepend(b); }
  await initFn();
  await preloadNav();
  sb.innerHTML = sidebar(activePage); // refresh badges after data loads
  mountChatbot(); // docked assistant on every OS page
}


return { boot, get, list, create, patch, cur, preloadNav, raw, state: () => state, demoAgents,
  dispatchJob, remindInvoice, convertQuote, approveApplicant, rejectApplicant, decideApproval, repurposeContent, runChecklist, runAgent, cron, saveSettings, aiApi,
  financeScanNow, crmSweepNow, runPayrollNow, payPayoutNow, getPnl, getIntegrations, integrationAction, stripeOverview, demoBuildQuote, taxFor, TAX_RATES,
  sidebar, logout, toast, openModal, closeModal, onModalSave, field,
  fmt, ago, today, addDays, esc, acctName, empName, daysOverdue, logActivity, persistDemo,
  TIER, INV, JOBS, GEN, $, $$, USER, TOKEN, BASE, isLive: () => LIVE, IS_CLIENT, uid,
  EMP_STEPS, CLIENT_STEPS, freshSteps, withProgress };
})();
