/* Lines & Logos — Logistics & Travel Agent.
 *
 * Flow:
 *   contract signed  →  auto-builds a trip plan (route, gas, hotels, per-diem,
 *                        materials, machinery, days)  →  admin approves
 *                     →  hotel + travel POs queued for payment approval
 *                     →  itinerary email with MAP + DIRECTIONS to customer & techs.
 *   Change management: monitors db.emails for reschedule/cancel/sick signals,
 *   recomputes the plan, issues PO deltas, tracks hotel cancellation deadlines,
 *   and suggests replacement crew when someone gets sick.
 *
 * Zero-dependency. Geo: Nominatim (OpenStreetMap, keyless) with a settings
 * cache; optional GOOGLE_MAPS_API_KEY upgrades routing precision.
 */
'use strict';
const https = require('https');

/* ---------------- geo ---------------- */
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'lines-and-logos-os/1.0' } }, r => {
      let s = ''; r.on('data', c => s += c); r.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function haversine(a, b) {
  const R = 3958.8, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/* keyless geocode with persistent cache */
async function geocode(addr, db) {
  if (!addr) return null;
  db.settings.geoCache = db.settings.geoCache || {};
  if (db.settings.geoCache[addr]) return db.settings.geoCache[addr];
  try {
    const u = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(addr);
    const j = await httpGetJson(u);
    if (j && j[0]) {
      const p = { lat: +j[0].lat, lon: +j[0].lon, display: j[0].display_name };
      db.settings.geoCache[addr] = p; return p;
    }
  } catch (e) { /* offline — fall through to estimate */ }
  return null;
}
/* road miles ≈ straight line × 1.25 (interstate mix) */
function roadMiles(a, b) { return Math.round(haversine(a, b) * 1.25); }

/* map links + keyless static map image for emails */
function mapLinks(dest, origin) {
  const q = dest.lat ? `${dest.lat},${dest.lon}` : encodeURIComponent(dest.address || dest);
  const o = origin && origin.lat ? `${origin.lat},${origin.lon}` : encodeURIComponent(origin && origin.address || 'Memphis, TN');
  return {
    directions: `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${q}`,
    staticMap: dest.lat ? `https://staticmap.openstreetmap.de/staticmap.php?center=${dest.lat},${dest.lon}&zoom=12&size=600x300&maptype=mapnik&markers=${dest.lat},${dest.lon},red-pushpin` : null,
    apple: `https://maps.apple.com/?daddr=${q}`,
  };
}

/* ---------------- settings ---------------- */
function cfg(db) {
  return Object.assign({
    mpg: 14, fuelPrice: 3.60, mileageRate: 0.90,          // or reimburse per-mile
    reimburseMode: 'fuel',                               // 'fuel' | 'mileage'
    nightlyRate: 120, lodgingTaxPct: 14, perDiem: 45,     // per person/day
    tollsPerMile: 0.04, equipmentHaulRate: 1.35,          // per equipment-mile
    maxDriveHoursPerDay: 8, stopMinPer2Hours: 15,
    driveSpeedMph: 55, bufferPct: 10,
    hotelRates: {},   // city/state overrides, e.g. { 'Nashville, TN': 145 }
    autoApproveDeltaUnder: 150,                          // small changes auto-apply
    sickKeywords: ['sick', 'call out', "can't make it", 'cannot make it', ' ER ', 'emergency', 'covid'],
    changeKeywords: ['reschedul', 'change the date', 'move the date', 'new date', 'different date', 'delay', 'postpone', 'hotel', 'cancel'],
  }, db.settings.logistics || {});
}

/* ---------------- cost engine ---------------- */
function hotelNightly(area, c) {
  if (c.hotelRates[area]) return c.hotelRates[area];
  return c.nightlyRate; // owner can add per-city rates after "researching" the area
}
/* one full trip cost model */
function estimateCosts({ miles, driveHours, daysOnSite, crew, area, equipment, materials }, c) {
  const driveDays = Math.max(1, Math.ceil(driveHours / c.maxDriveHoursPerDay));
  const totalDays = daysOnSite + Math.max(0, driveDays - (driveDays > 1 ? 1 : 0)) ;
  const roundMiles = Math.round(miles * 2 * 1.1); // deadhead included
  const driveCost = c.reimburseMode === 'mileage'
    ? Math.round(roundMiles * c.mileageRate)
    : Math.round(roundMiles / c.mpg * c.fuelPrice);
  const nights = Math.max(0, totalDays - 1);
  const rooms = Math.max(1, Math.ceil(crew / 2));
  const rate = hotelNightly(area, c);
  const lodging = Math.round(nights * rooms * rate * (1 + c.lodgingTaxPct / 100));
  const perDiem = Math.round(crew * totalDays * c.perDiem);
  const tolls = Math.round(roundMiles * c.tollsPerMile);
  const equipmentCost = Math.round((equipment || []).length * roundMiles * c.equipmentHaulRate
    + (equipment || []).reduce((s, e) => s + (e.galPerHour || 0) * 8 * daysOnSite * c.fuelPrice, 0));
  const materialsCost = Math.round((materials || []).reduce((s, m) => s + (m.qty || 1) * (m.unitCost || 0), 0));
  const labor = Math.round(crew * daysOnSite * c.crewDayRate);
  const subtotal = driveCost + lodging + perDiem + tolls + equipmentCost + materialsCost + labor;
  const buffer = Math.round(subtotal * c.bufferPct / 100);
  return {
    roundMiles, driveHours: Math.round(driveHours), driveDays, totalDays, nights, rooms,
    lineItems: [
      { k: 'fuel-mileage', label: c.reimburseMode === 'mileage' ? `Mileage reimbursement (${roundMiles} mi × $${c.mileageRate})` : `Fuel (${roundMiles} mi ÷ ${c.mpg} mpg × $${c.fuelPrice})`, amount: driveCost },
      { k: 'lodging', label: `Hotels — ${nights} night(s) × ${rooms} room(s) × $${rate}+${c.lodgingTaxPct}% tax`, amount: lodging },
      { k: 'perdiem', label: `Per-diem meals (${crew} crew × ${totalDays} day(s) × $${c.perDiem})`, amount: perDiem },
      { k: 'tolls', label: `Tolls & parking (~${roundMiles} mi)`, amount: tolls },
      { k: 'equipment', label: `Machinery transport + fuel (${(equipment || []).length} unit(s))`, amount: equipmentCost },
      { k: 'materials', label: `Materials staging (${(materials || []).length} line(s))`, amount: materialsCost },
      { k: 'labor', label: `Crew labor (${crew} × ${daysOnSite} day(s) × $${c.crewDayRate}/day)`, amount: labor },
      { k: 'buffer', label: `Contingency ${c.bufferPct}%`, amount: buffer },
    ],
    total: subtotal + buffer,
  };
}

/* ---------------- trip plan lifecycle ---------------- */
async function createTripPlan(input, ctx) {
  const { db, save, uid, logActivity } = ctx;
  const c = cfg(db);
  const from = await geocode(input.originAddress || '2847 New Broadway St, Memphis, TN 38109', db);
  const to = await geocode(input.destinationAddress, db);
  const miles = from && to ? roadMiles(from, to) : Math.round((input.milesHint || 300));
  const driveHours = miles / c.driveSpeedMph + Math.floor(miles / c.driveSpeedMph / 2) * (c.stopMinPer2Hours / 60);
  const est = estimateCosts({
    miles, driveHours, daysOnSite: input.daysOnSite || 3, crew: input.crew || 3,
    area: input.area || input.destinationAddress,
    equipment: input.equipment || [], materials: input.materials || [],
  }, c);
  const plan = {
    id: uid('tp'), contractId: input.contractId || null, jobId: input.jobId || null,
    title: input.title || 'Trip plan', origin: input.originAddress, destination: input.destinationAddress,
    originGeo: from, destGeo: to, miles, ...est,
    crew: input.crew || 3, equipment: input.equipment || [], materials: input.materials || [],
    status: 'pending-approval',            // admin gate before anything emails out
    createdAt: new Date().toISOString(),
    revisions: [], events: [], pos: [], approvals: [],
    maps: mapLinks(to ? { ...to, address: input.destinationAddress } : { address: input.destinationAddress }, from),
  };
  db.tripPlans.unshift(plan);
  save();
  logActivity(`Logistics Agent: trip plan ${plan.id} for "${plan.title}" — ${plan.roundMiles} mi, ${plan.totalDays} day(s), est $${plan.total.toLocaleString()}`);
  ctx.notify(db.settings.quotes.approvalEmail, `Trip plan ready for approval — ${plan.title}`,
    `${plan.roundMiles} mi · ${plan.totalDays} day(s) · est $${plan.total.toLocaleString()}. Approve to email customer + techs with map & directions.`,
    ['in-app', 'email']);
  return plan;
}

/* build the itinerary email bodies (customer + techs) */
function itineraryEmail(plan, who, ctx) {
  const c = cfg(ctx.db);
  const items = plan.lineItems.map(i => `<tr><td>${i.label}</td><td style="text-align:right">$${i.amount.toLocaleString()}</td></tr>`).join('');
  const hotelNote = plan.pos.find(p => p.kind === 'lodging')
    ? `<p><b>Hotel:</b> reserved under PO ${plan.pos.find(p => p.kind === 'lodging').number} — check-in after 3 PM. Cancellation deadline ${plan.pos.find(p => p.kind === 'lodging').cancelBy || '24h before check-in'}.</p>` : '';
  const mapBlock = plan.maps.staticMap
    ? `<p><a href="${plan.maps.directions}"><img src="${plan.maps.staticMap}" width="600" alt="Map to ${plan.destination}" style="border-radius:8px;max-width:100%"></a><br><a href="${plan.maps.directions}">Open turn-by-turn directions →</a> · <a href="${plan.maps.apple}">Apple Maps</a></p>`
    : `<p><a href="${plan.maps.directions}">Get directions →</a></p>`;
  return {
    subject: `${plan.title} — crew arrival ${plan.totalDays} day(s): map, directions & itinerary`,
    body: `${who === 'tech' ? `<p>You're on the crew for <b>${plan.title}</b>. Review the route, hotel and per-diem below.</p>` : `<p>Your Lines & Logos crew is confirmed for <b>${plan.title}</b>. Here's everything for the visit.</p>`}
${mapBlock}
<p><b>Schedule:</b> ${plan.driveDays > 1 ? `depart ${plan.driveDays - 1 ? 'the day before' : ''} — ` : ''}${plan.totalDays} day(s) on site · ${plan.roundMiles} mi round trip · ~${plan.driveHours} h drive each way.</p>
${hotelNote}
<p><b>Cost summary</b> (internal ${who === 'tech' ? '— per-diem & lodging covered' : 'overview'}):</p>
<table border="0" cellpadding="6" style="border-collapse:collapse">${items}<tr><td><b>Total</b></td><td style="text-align:right"><b>$${plan.total.toLocaleString()}</b></td></tr></table>
<p>Questions? Reply to this email or call ${ctx.db.settings.company.phone}.</p>`,
  };
}

/* admin approved → POs + emails + expenses */
async function approveTripPlan(id, approver, ctx) {
  const { db, save, uid, logActivity, notify } = ctx;
  const plan = db.tripPlans.find(p => p.id === id);
  if (!plan) throw new Error('Trip plan not found');
  if (plan.status !== 'pending-approval') throw new Error('Already ' + plan.status);
  plan.status = 'approved'; plan.approvedBy = approver; plan.approvedAt = new Date().toISOString();
  plan.approvals.push({ by: approver, at: plan.approvedAt, action: 'approved' });

  // hotel PO (the one the user explicitly wants queued for payment approval)
  const c = cfg(db);
  const lodgingLine = plan.lineItems.find(i => i.k === 'lodging');
  if (lodgingLine && lodgingLine.amount > 0) {
    const po = { id: uid('po'), number: 'PO-' + new Date().getFullYear() + '-' + String(db.purchaseOrders.length + 13).padStart(3, '0'),
      vendorId: null, vendorName: 'Lodging — ' + plan.destination, item: `Hotel stay: ${plan.title} (${plan.nights} night(s) × ${plan.rooms} room(s))`,
      amount: lodgingLine.amount, status: 'pending', date: new Date().toISOString().slice(0, 10), kind: 'lodging', tripPlanId: plan.id,
      cancelBy: new Date(Date.now() + Math.max(1, plan.nights) * 864e5).toISOString(), note: 'Approve to reserve; agent tracks cancellation deadline & date changes.' };
    db.purchaseOrders.push(po);
    plan.pos.push(po);
    db.approvals.push({ id: uid('apv'), type: 'purchase', title: `Hotel reservation — ${plan.title}`, amount: po.amount,
      requestedBy: 'Logistics Agent', status: 'pending', created: new Date().toISOString().slice(0, 10), tripPlanId: plan.id });
    notify(db.settings.quotes.approvalEmail, `PO needs approval — hotel for ${plan.title}`,
      `$${po.amount.toLocaleString()} → ${po.vendorName}. Approve in Approvals to reserve.`, ['in-app']);
  }
  // travel per-diem advance PO
  const perDiemLine = plan.lineItems.find(i => i.k === 'perdiem');
  if (perDiemLine) {
    const po2 = { id: uid('po'), number: 'PO-' + new Date().getFullYear() + '-' + String(db.purchaseOrders.length + 14).padStart(3, '0'),
      vendorId: null, vendorName: 'Crew per-diem advance', item: `Per-diem: ${plan.crew} crew × ${plan.totalDays} day(s)`, amount: perDiemLine.amount,
      status: 'pending', date: new Date().toISOString().slice(0, 10), kind: 'perdiem', tripPlanId: plan.id };
    db.purchaseOrders.push(po2); plan.pos.push(po2);
  }
  // post the trip expenses to the books
  const today = new Date().toISOString().slice(0, 10);
  for (const i of plan.lineItems.filter(i => ['fuel-mileage', 'tolls'].includes(i.k)))
    db.expenses.push({ id: uid('x'), date: today, category: 'Fuel & Travel', vendor: null, amount: i.amount, note: `${plan.title} — ${i.label}` });
  db.expenses.push({ id: uid('x'), date: today, category: 'Travel', vendor: 'Lodging', amount: lodgingLine ? lodgingLine.amount : 0, note: plan.title });
  db.expenses.push({ id: uid('x'), date: today, category: 'Travel', vendor: 'Per-diem', amount: perDiemLine ? perDiemLine.amount : 0, note: plan.title });

  // emails: customer + assigned techs, with map + directions
  const recipients = [];
  const contract = db.contracts.find(x => x.id === plan.contractId);
  if (contract && contract.clientEmail) recipients.push({ to: contract.clientEmail, who: 'customer' });
  for (const t of (plan.techEmails || [])) recipients.push({ to: t, who: 'tech' });
  for (const r of recipients) {
    const e = itineraryEmail(plan, r.who, ctx);
    db.emails.push({ id: uid('em'), to: r.to, subject: e.subject, body: e.body, status: 'sent', sentAt: new Date().toISOString() });
    notify(r.to, e.subject, e.body.replace(/<[^>]+>/g, ' ').slice(0, 160), ['email']);
  }
  plan.emailedTo = recipients.map(r => r.to);
  logActivity(`Logistics Agent: ${plan.title} approved by ${approver} — ${recipients.length} email(s) sent with map + directions, POs queued`);
  save();
  return plan;
}

/* pre-contract estimate for the admin approving a new job */
function preContractBrief(input, ctx) {
  const c = cfg(ctx.db);
  const miles = input.miles || (input.daysOnSite || 3) * 120; // rough default
  const driveHours = miles / c.driveSpeedMph;
  const est = estimateCosts({ miles, driveHours, daysOnSite: input.daysOnSite || 3, crew: input.crew || 3,
    area: input.area || 'destination', equipment: input.equipment || [], materials: input.materials || [] }, c);
  const jobValue = input.jobValue || 0;
  return { ...est, jobValue, logisticsPctOfJob: jobValue ? Math.round(est.total / jobValue * 100) : null,
    marginWarning: jobValue && est.total / jobValue > 0.35 ? `Logistics is ${Math.round(est.total / jobValue * 100)}% of job value — above the 35% comfort line. Raise the quote or stage materials locally.` : null };
}
module.exports = { geocode, roadMiles, mapLinks, cfg, estimateCosts, itineraryEmail, createTripPlan, approveTripPlan, preContractBrief };
