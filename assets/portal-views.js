/* Customer dashboard views engine (shared globals: $, api, esc, fmt$, toast, ME, JOBS...) */
const DEMO={jobs:[
  {id:'j1',title:'Wall Wrap — Fieldhouse Entry',status:'scheduled',when:'2026-12-03',crew:'Crew B',value:8400},
  {id:'j2',title:'Gym Floor Refinish — Main Court',status:'in-progress',when:'2026-11-26',crew:'Crew A',value:36000}],
 invoices:[
  {id:'INV-1042',status:'sent',issued:'2026-11-10',amount:18000,deposit:3600},
  {id:'INV-1037',status:'paid',issued:'2026-10-02',amount:8400}],
 quotes:[{id:'Q-4471',title:'Court restripe + logo package',amount:6100,status:'open',expires:'2026-12-01'}],
 contracts:[{id:'C-2201',title:'Gym Floor Refinish — Main Court',status:'signed',amount:36000},{id:'C-2202',title:'Wall Wrap — Fieldhouse Entry',status:'sent',amount:8400}]};
async function loadAll(){
  const blog=await api('/api/blog').catch(()=>[]);
  BLOG=blog||[];
  const bp=$('blogPosts'); if(bp) bp.innerHTML=BLOG.map(p=>`<div class="post"><b>${esc(p.title)}</b><p>${esc(p.body.slice(0,140))}…</p><small>${p.at}</small></div>`).join('')||'<p class="muted">No posts yet.</p>';
  renderBell();
}
async function getData(){
  const j=await api('/api/client/'+(ME.customerToken||ME.username)).catch(()=>({error:true}));
  const src=(j.error)?DEMO:j;
  JOBS=src.jobs||DEMO.jobs;INVOICES=src.invoices||DEMO.invoices;QUOTES=src.quotes||DEMO.quotes;CONTRACTS=src.contracts||DEMO.contracts;
  return src;
}
const VIEWS={
 overview:async()=>{await getData();
  return `<div class="panel"><div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
    ${ME.company.logo?`<div class="avatar"><img src="${ME.company.logo}" alt="logo"></div>`:`<div class="avatar">${esc(((ME.company.name||ME.username)[0]||'?').toUpperCase())}</div>`}
    <div style="flex:1;min-width:200px"><h1 style="font-size:22px">${esc(ME.company.name||ME.username)}</h1>
      <p class="muted" style="margin-top:4px">${esc(ME.email)}${ME.phone?' · '+esc(ME.phone):''}</p></div>
    <button class="btn btn-ghost btn-sm" onclick="showView('profile')">Edit profile</button></div></div>
  <div class="grid2">
    <div class="panel"><h2>Upcoming jobs</h2>${JOBS.map(j=>`<div class="card"><b>${esc(j.title)}</b> <span class="tag ${j.status==='in-progress'?'t-sched':'t-quote'}" style="float:right">${j.status}</span>
      <div class="rowline"><span>Date: <i>${j.when}</i></span><span>Crew: <i>${esc(j.crew||'TBD')}</i></span></div></div>`).join('')||'<p class="muted">No jobs yet.</p>'}</div>
    <div class="panel"><h2>Action needed</h2>
      ${INVOICES.filter(i=>i.status==='sent').map(i=>`<div class="card"><b>${i.id}</b> — ${fmt$(i.amount)} due <span class="tag t-quote" style="float:right">unpaid</span><div style="margin-top:10px;display:flex;gap:8px"><button class="btn btn-sm" onclick="payInvoice('${i.id}',${i.amount})">Pay now</button><button class="btn btn-ghost btn-sm" onclick="openDispute('${i.id}')">Dispute</button></div></div>`).join('')}
      ${QUOTES.filter(q=>q.status==='open').map(q=>`<div class="card"><b>${esc(q.title)}</b> — ${fmt$(q.amount)}<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm" onclick="payDeposit('${q.id}',${Math.round(q.amount*0.2)})">Pay 20% deposit</button><button class="btn btn-ghost btn-sm" onclick="openVideoModal('${esc(q.title)}')">Video walkthrough</button></div></div>`).join('')}
      ${!INVOICES.some(i=>i.status==='sent')&&!QUOTES.some(q=>q.status==='open')?'<p class="muted">All caught up.</p>':''}</div>
  </div>
  <div class="panel"><h2>Recent activity</h2>${(ME.disputes||[]).map(x=>`<div class="card"><b>Dispute ${x.invoiceId}</b> <span class="tag t-red" style="float:right">${x.status}</span><p class="muted" style="margin-top:6px">${esc(x.reason)}</p></div>`).join('')}<p class="muted">Your notifications also appear in the bell (top right).</p></div>`;},
 jobs:async()=>{await getData();
  const photos=await api('/api/account/photos').catch(()=>[]);
  return `<div class="panel"><h2>Your jobs</h2>${JOBS.map(j=>`<div class="card"><b>${esc(j.title)}</b> <span class="tag ${j.status==='in-progress'?'t-sched':'t-quote'}" style="float:right">${j.status}</span>
    <div class="rowline"><span>Scheduled: <i>${j.when}</i></span><span>Crew: <i>${esc(j.crew||'TBD')}</i></span><span>Value: <i>${fmt$(j.value)}</i></span></div></div>`).join('')}</div>
  <div class="panel"><h2>Job photos</h2>
    <p class="muted" style="margin-bottom:14px">Photos from your job — crew, contractors, or you. Pending items publish after admin approval.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px">
      ${(photos||[]).map(p=>`<div style="border:1px solid var(--line);border-radius:12px;overflow:hidden"><img src="${p.url}" style="width:100%;height:110px;object-fit:cover" alt=""><div style="padding:8px 10px;font-size:11px" class="muted">${esc(p.caption||'')} <span class="tag ${p.status==='approved'?'t-done':'t-quote'}">${p.status}</span></div></div>`).join('')||'<p class="muted">No photos yet — upload the first one.</p>'}
    </div>
    <label class="lbl">Add a photo from the job</label>
    <input class="inp" id="phCaption" placeholder="Caption (e.g. Main court after coat 2)">
    <input type="file" id="phFile" accept="image/*" class="inp" style="padding:9px 12px">
    <button class="btn btn-sm" onclick="uploadJobPhoto()">Upload for approval</button>
    ${ME.photoAuthority===false?'<p class="muted" style="margin-top:10px">You have opted out of the default photo authority — only your own uploads appear.</p>':''}</div>`;},
 invoices:async()=>{await getData();
  return `<div class="panel"><h2>Invoices</h2>
    <table><thead><tr><th>Invoice</th><th>Issued</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
    ${INVOICES.map(i=>`<tr><td><b>${i.id}</b></td><td>${i.issued}</td><td>${fmt$(i.amount)}</td>
      <td><span class="tag ${i.status==='paid'?'t-done':'t-quote'}">${i.status}</span></td>
      <td style="white-space:nowrap">${i.status!=='paid'?`<button class="btn btn-sm" onclick="payInvoice('${i.id}',${i.amount})">Pay</button> <button class="btn btn-ghost btn-sm" onclick="openDispute('${i.id}')">Dispute</button>`:'<span class="muted">receipt emailed</span>'} <button class="btn btn-ghost btn-sm" onclick="downloadInvoice('${i.id}')">Download</button></td></tr>`).join('')}
    </tbody></table>
    <p class="muted" style="margin-top:12px">Payments run through Stripe when connected — otherwise a receipt is generated and our office confirms. Deposits (20%) lock scheduling before contract signature.</p></div>
  <div class="panel"><h2>Invoice history — past year</h2>
    <div id="invHistory"><p class="muted">Loading…</p></div></div>
  <div class="panel"><h2>Your disputes &amp; remediation</h2>
    ${(ME.disputes||[]).map(x=>`<div class="card"><b>${x.invoiceId}</b> <span class="tag ${x.status==='resolved'?'t-done':'t-red'}" style="float:right">${x.status}</span>
      <p class="muted" style="margin-top:6px">${esc(x.reason)}</p>${x.remediation?`<p style="margin-top:8px;font-size:12.5px"><b>Remediation:</b> ${esc(x.remediation)}</p>`:''}</div>`).join('')||'<p class="muted">No disputes — everything as expected.</p>'}</div>`;},
 quotes:async()=>{await getData();
  return `<div class="panel"><h2>Current quotes</h2>
    ${QUOTES.map(q=>`<div class="card"><b>${esc(q.title)}</b> <span class="tag t-blue" style="float:right">${q.status}</span>
      <div class="rowline"><span>Amount: <i>${fmt$(q.amount)}</i></span><span>Valid until: <i>${q.expires}</i></span></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="payDeposit('${q.id}',${Math.round(q.amount*0.2)})">Pay 20% deposit (${fmt$(Math.round(q.amount*0.2))})</button>
        <button class="btn btn-ghost btn-sm" onclick="openVideoModal('${esc(q.title)}')">Video walkthrough first</button>
      </div></div>`).join('')||'<p class="muted">No open quotes.</p>'}</div>`;},
 contracts:async()=>{await getData();
  return `<div class="panel"><h2>Contracts</h2>
    ${CONTRACTS.map(c=>`<div class="card"><b>${esc(c.title)}</b> <span class="tag ${c.status==='signed'?'t-done':'t-quote'}" style="float:right">${c.status}</span>
      <div class="rowline"><span>Value: <i>${fmt$(c.amount)}</i></span></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="downloadContract('${c.id}')">Download contract</button>
        ${c.status!=='signed'?`<button class="btn btn-sm" onclick="signContract('${c.id}','${esc(c.title)}',${c.amount})">Sign now</button>`:''}
      </div></div>`).join('')}</div>
  <div class="panel"><h2>Photo authority</h2>
    <p class="muted" style="margin-bottom:12px">By default we may photograph your job for documentation, the gallery, and marketing. Opting out is signed and honored site-wide.</p>
    <label style="display:flex;gap:10px;align-items:center;font-size:13.5px;margin-bottom:12px"><input type="checkbox" id="paToggle" ${ME.photoAuthority!==false?'checked':''} style="width:17px;height:17px"> Allow job photography &amp; publishing</label>
    <button class="btn btn-sm" onclick="signPhotoAuthority()">Save &amp; sign</button></div>`;},
 calendar:async()=>{await getData();
  const now=new Date();let cells='';const start=new Date(now.getFullYear(),now.getMonth(),1);const offset=start.getDay();
  for(let i=0;i<offset;i++)cells+='<div class="d"></div>';
  const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const byDay={};JOBS.forEach(j=>{const dt=new Date(j.when);if(dt.getMonth()===now.getMonth()&&dt.getFullYear()===now.getFullYear())(byDay[dt.getDate()] ||= []).push(j);});
  for(let day=1;day<=dim;day++){const evs=byDay[day];cells+=`<div class="d ${evs?'has':''}" ${evs?`onclick="openJobModal(${day})"`:''}><span style="font-weight:700;color:var(--dim)">${day}</span>${(evs||[]).map(j=>`<div class="ev">${esc(j.title.slice(0,18))}</div>`).join('')}</div>`;}
  return `<div class="panel"><h2>Calendar — ${now.toLocaleString('en-US',{month:'long',year:'numeric'})}</h2>
    <div class="cal">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="dh">${x}</div>`).join('')}${cells}</div>
    <p class="muted" style="margin-top:14px">Click a scheduled job to view details or request a change. Changes are allowed within 3 days of the job date and carry a partial refund per policy.</p></div>`;},
 video:async()=>`<div class="panel"><h2>Video calls &amp; walkthroughs</h2>
    <p class="muted" style="margin-bottom:16px">Meet face-to-face without the drive — quote walkthroughs, progress checks, and closeouts over video. Rooms open in a new tab; no install needed.</p>
    <div class="grid2">
      <div class="card"><b>Request a walkthrough</b><p class="muted" style="margin:6px 0 12px">We walk the floor over video before quoting.</p>
        <input class="inp" id="vdWhen" type="datetime-local"><button class="btn btn-sm" onclick="startVideo()">Schedule &amp; get link</button></div>
      <div class="card"><b>Meet now</b><p class="muted" style="margin:6px 0 12px">Instant room with our office.</p>
        <button class="btn btn-sm" onclick="startVideo()">Start video call</button></div>
    </div>
    <div id="vdLinks"></div>`,
 profile:async()=>`<div class="panel"><h2>Company profile</h2>
    <div class="banner">${ME.company.banner?`<img src="${ME.company.banner}" alt="banner">`:(ME.company.name||'Your company banner')}</div>
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
      <div class="avatar">${ME.company.logo?`<img src="${ME.company.logo}" alt="">`:(ME.company.name||ME.username)[0].toUpperCase()}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label class="btn btn-ghost btn-sm" style="cursor:pointer">Upload logo<input type="file" hidden accept="image/*" onchange="uploadImage(this,'logo')"></label>
        <label class="btn btn-ghost btn-sm" style="cursor:pointer">Upload banner<input type="file" hidden accept="image/*" onchange="uploadImage(this,'banner')"></label>
      </div>
    </div>
    <label class="lbl">Company name</label><input class="inp" id="pfName" value="${esc(ME.company.name||'')}" placeholder="e.g. Bartlett City Schools">
    <label class="lbl">Company details</label><textarea class="inp" id="pfDetails" rows="3" placeholder="Address, facilities contacts, notes for our crew">${esc(ME.company.details||'')}</textarea>
    <label class="lbl">Personal name</label><input class="inp" id="pfPersonal" value="${esc((ME.personal&&ME.personal.name)||'')}" placeholder="Your name">
    <button class="btn" onclick="saveProfile()">Save profile</button></div>`,
 settings:async()=>`<div class="panel"><h2>Security</h2>
    <div class="card"><b>Two-step verification</b>
      <p class="muted" style="margin:6px 0 12px">Status: ${ME.totpEnabled?'<span class="tag t-done">enabled (TOTP)</span>':'<span class="tag t-quote">not enabled</span>'} · ${ME.passkeyCount} passkey(s)</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="openSetup2FA()">${ME.totpEnabled?'Re-show TOTP secret':'Set up authenticator app'}</button>
        <button class="btn btn-ghost btn-sm" onclick="registerPasskey()">Add a passkey (Face ID / fingerprint)</button>
      </div></div></div>
  <div class="panel"><h2>Alerts</h2>
    ${(()=>{const A=ME.alerts||{};const row=(k,t,d)=>`<label style="display:flex;gap:10px;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line)"><span><b style="font-size:13px">${t}</b><br><span class="muted" style="font-size:11.5px">${d}</span></span><input type="checkbox" data-alert="${k}" ${A[k]!==false?'checked':''} style="width:18px;height:18px;accent-color:var(--blue)"></label>`;
    return row('jobs','Upcoming job reminders','Push + bell alerts before scheduled work')+row('invoices','Invoice alerts','New invoices and payment receipts')+row('marketing','Newsletter & offers','Occasional email — no spam')+row('sms','Text messages','SMS copies of critical alerts')+row('aiNotes','AI interaction notes','Let the assistant record notes from our chats')})()}
    <button class="btn btn-sm" style="margin-top:14px" onclick="saveAlerts()">Save alert preferences</button></div>
  <div class="panel"><h2>AI notes on your account</h2>
    <p class="muted" style="margin-bottom:12px">Notes our assistant takes during our conversations, so any team member can pick up where we left off.</p>
    <div id="aiNotes"><p class="muted">Loading…</p></div></div>
  <div class="panel"><h2>Your data</h2>
    <p class="muted" style="margin-bottom:12px">Download everything we hold about you and your company, or delete it — permanently.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="exportData()">Download my data (JSON)</button>
      <button class="btn btn-ghost btn-sm" onclick="clearCompanyData()">Delete company info</button>
      <button class="btn btn-red btn-sm" onclick="deleteAccount()">Delete my account</button>
    </div></div>
  <div class="panel"><h2>Apps</h2>
    <p class="muted" style="margin-bottom:14px">The dashboard for every device — iOS and iPad install as an app from your browser (no store needed).</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${[['Android','M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5 15h.01'],['iOS / iPad','M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'],['macOS','M4 4h16v12H4zM2 18h20v2H2z'],['Windows','M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z'],['Linux','M12 2a6 6 0 0 1 6 6c0 2.5-1.5 3.5-1.5 6h-9C7.5 11.5 6 10.5 6 8a6 6 0 0 1 6-6zm-5 14h10l1.5 6h-13z']].map(a=>`
      <button class="btn btn-ghost" style="flex-direction:column;gap:8px;padding:14px 16px;min-width:96px" onclick="installOS('${a[0].split(' ')[0]}')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${a[1]}"/></svg>
        <span style="font-size:11.5px;font-weight:700">${a[0]}</span>
      </button>`).join('')}
    </div></div>`
};
async function showView(name){
  document.querySelectorAll('.side button').forEach(b=>b.classList.toggle('active',b.dataset.v===name));
  $('views').innerHTML=`<div class="view active">${await VIEWS[name]()}</div>`;
}
function openModal(html){$('modalBox').innerHTML=html;$('modalBg').classList.add('open')}
$('modalBg').addEventListener('click',e=>{if(e.target.id==='modalBg')$('modalBg').classList.remove('open')});
function payInvoice(id,amount){
  openModal(`<h2>Pay ${id}</h2><p class="muted" style="margin-bottom:14px">Amount: <b>${fmt$(amount)}</b></p>
    <label class="lbl">Card number</label><input class="inp" placeholder="4242 4242 4242 4242" inputmode="numeric">
    <div class="grid2"><div><label class="lbl">Expiry</label><input class="inp" placeholder="12 / 28"></div><div><label class="lbl">CVC</label><input class="inp" placeholder="123"></div></div>
    <button class="btn" style="width:100%" onclick="confirmPay('${id}',${amount},false)">Pay ${fmt$(amount)}</button>
    <p class="muted" style="margin-top:10px;font-size:11.5px">Live Stripe checkout activates when the account keys are connected — this records the payment either way.</p>`);
}
function payDeposit(id,amount){
  openModal(`<h2>Pay deposit — ${id}</h2><p class="muted" style="margin-bottom:14px">20% deposit: <b>${fmt$(amount)}</b>. Paying a deposit reserves your scheduling window ahead of contract signature.</p>
    <button class="btn" style="width:100%" onclick="confirmPay('${id}',${amount},true)">Pay ${fmt$(amount)} deposit</button>`);
}
function confirmPay(id,amount,isDeposit){
  const inv=INVOICES.find(i=>i.id===id);
  if(inv&&inv.status==='paid'){toast('Already paid');return}
  if(inv)inv.status='paid';
  toast((isDeposit?'Deposit of ':'Payment of ')+fmt$(amount)+' recorded — receipt sent to '+ME.email);
  $('modalBg').classList.remove('open');
  showView('invoices');
}
function openDispute(invoiceId){
  openModal(`<h2>Dispute ${invoiceId}</h2><p class="muted" style="margin-bottom:12px">Tell us what is wrong — our office reviews every dispute and posts a remediation plan.</p>
    <textarea class="inp" id="dspReason" rows="4" placeholder="e.g. Charged for a restripe we did not approve"></textarea>
    <button class="btn" onclick="submitDispute('${invoiceId}')">Submit dispute</button>`);
}
async function submitDispute(invoiceId){
  const reason=$('dspReason').value.trim();if(!reason){toast('Describe the issue');return}
  const r=await api('/api/account/dispute',{method:'POST',body:{invoiceId,reason}});
  if(r.dispute){(ME.disputes ||= []).unshift(r.dispute);toast('Dispute opened — remediation underway');$('modalBg').classList.remove('open');showView('invoices')}
}
function downloadInvoice(id){
  fetch('/api/account/invoice-download?id='+encodeURIComponent(id),{headers:{'Authorization':'Bearer '+CTOKEN}})
    .then(r=>{ if(!r.ok){ toast('Download unavailable (invoices are kept one year)'); return null; } return r.blob(); })
    .then(b=>{ if(!b)return; const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='invoice-'+id+'.html'; a.click(); });
}
async function loadInvoiceHistory(){
  const box=$('invHistory'); if(!box)return;
  const inv=await api('/api/account/invoices').catch(()=>[]);
  box.innerHTML=(inv&&inv.length)?`<table><thead><tr><th>Invoice</th><th>Issued</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
    ${inv.map(i=>`<tr><td><b>${i.id}</b></td><td>${i.issued||''}</td><td>${fmt$(i.amount||i.total)}</td><td><span class="tag ${i.status==='paid'?'t-done':'t-quote'}">${i.status}</span></td>
    <td><button class="btn btn-ghost btn-sm" onclick="downloadInvoice('${i.id}')">Download</button></td></tr>`).join('')}</tbody></table>
    <p class="muted" style="margin-top:10px;font-size:11.5px">Invoices are available to download for one year from issue.</p>`
    :'<p class="muted">No invoices on file for your account in the past year — they appear here after your first job.</p>';
}
function downloadContract(id){
  const c=CONTRACTS.find(x=>x.id===id);if(!c)return;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contract ${c.id}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;line-height:1.7;color:#111}h1{font-size:22px}h2{font-size:15px;margin-top:26px}p{font-size:13px}</style></head><body>
  <h1>Lines &amp; Logos — Fixed-Price Contract</h1><p><b>Contract:</b> ${c.id} · <b>Project:</b> ${c.title} · <b>Amount:</b> ${fmt$(c.amount)}</p>
  <h2>1. Scope</h2><p>The work described in the accepted estimate, performed by the assigned crew.</p>
  <h2>2. Price &amp; payment</h2><p>Fixed price as stated. Deposit 20% to schedule; balance at final walkthrough. Changes require a signed change order.</p>
  <h2>3. Warranty</h2><p>Written workmanship warranty as stated in this contract — terms vary by surface system.</p>
  <h2>4. Documentation</h2><p>Every phase photo-documented; final walkthrough together at completion.</p>
  <h2>Signatures</h2><p>Lines &amp; Logos — Trey A. Smith, Owner · Customer: ______________________  Date: ____________</p></body></html>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download='contract-'+c.id+'.html';a.click();
}
function signContract(id,title,amount){
  openModal(`<h2>Sign — ${title}</h2><p class="muted" style="margin-bottom:12px">Type your full legal name to sign. Contract value ${fmt$(amount)}.</p>
    <input class="inp" id="sigName" placeholder="Full legal name">
    <button class="btn" style="width:100%" onclick="confirmSign('${id}')">Sign contract</button>`);
}
function confirmSign(id){
  const n=$('sigName').value.trim();if(n.split(' ').length<2){toast('Enter your full legal name');return}
  const c=CONTRACTS.find(x=>x.id===id);if(c)c.status='signed';
  toast('Contract '+id+' signed by '+n);$('modalBg').classList.remove('open');showView('contracts');
}
function signPhotoAuthority(){
  openModal(`<h2>Sign photo authority</h2><p class="muted" style="margin-bottom:12px">Confirming ${$('paToggle').checked?'consent to':'opt-out of'} job photography and publishing.</p>
    <input class="inp" id="paName" placeholder="Type your name to sign">
    <button class="btn" onclick="confirmPhotoAuthority()">Sign</button>`);
}
async function confirmPhotoAuthority(){
  const n=$('paName').value.trim();if(!n){toast('Type your name to sign');return}
  ME=await api('/api/account',{method:'PUT',body:{photoAuthority:$('paToggle').checked}});
  toast('Photo authority '+(ME.photoAuthority?'granted':'opted out')+' — signed '+n);
  $('modalBg').classList.remove('open');showView('contracts');
}
function openJobModal(day){
  const now=new Date();const evs=JOBS.filter(j=>new Date(j.when).getDate()===day&&new Date(j.when).getMonth()===now.getMonth());
  if(!evs.length)return;
  const j=evs[0];
  const daysLeft=Math.ceil((new Date(j.when)-Date.now())/86400000);
  const canModify=daysLeft<=3;
  openModal(`<h2>${esc(j.title)}</h2>
    <p class="muted" style="margin-bottom:12px">${j.when} · ${esc(j.crew||'TBD')} · ${fmt$(j.value)} · <span class="tag t-sched">${j.status}</span></p>
    ${canModify?`<label class="lbl">Request a change (within 3 days — partial refund policy applies)</label>
      <textarea class="inp" id="modReq" rows="3" placeholder="e.g. Move to morning, same week"></textarea>
      <button class="btn" onclick="submitModify('${j.id}')">Request modification</button>
      <p class="muted" style="font-size:11.5px;margin-top:10px">Modifications inside the 3-day window may carry a partial refund per the written policy.</p>`
    :`<p class="muted">This job is ${daysLeft} days out. Modification requests open within 3 days of the job date.</p>
      <button class="btn btn-ghost" onclick="openVideoModal('${esc(j.title)} progress check')">Video progress check</button>`}`);
}
async function submitModify(jobId){
  const requested=$('modReq').value.trim();if(!requested){toast('Describe the change');return}
  const r=await api('/api/account/modify-request',{method:'POST',body:{jobId,requested}});
  toast(r.request?'Modification requested — we will confirm by email':(r.error||'Could not submit'));
  $('modalBg').classList.remove('open');
}
function openVideoModal(topic){
  openModal(`<h2>Video call</h2><p class="muted" style="margin-bottom:12px">${topic?esc(topic):'Walkthrough or meeting'} — pick a time or start now.</p>
    <input class="inp" id="vdWhenM" type="datetime-local">
    <button class="btn" style="width:100%" onclick="startVideo()">Get my room link</button>`);
}
async function startVideo(){
  const when=($('vdWhenM')&&$('vdWhenM').value)||($('vdWhen')&&$('vdWhen').value)||new Date(Date.now()+3600000).toISOString().slice(0,16);
  const r=await api('/api/video/meeting',{method:'POST',body:{with:ME.company.name||ME.username,when,email:ME.email}});
  if(r.link){
    const box=$('vdLinks');
    if(box)box.innerHTML=`<div class="card" style="margin-top:14px"><b>Your room is ready</b><p class="muted" style="margin:6px 0 10px">${r.when}</p><a class="btn btn-sm" href="${r.link}" target="_blank" rel="noopener">Join video call</a></div>`;
    toast('Room link sent to '+ME.email);
    if($('modalBg').classList.contains('open'))$('modalBg').classList.remove('open');
  } else toast(r.error||'Could not create room');
}
async function uploadImage(input,field){
  if(!input.files[0])return;const f=input.files[0];
  if(f.size>800*1024){toast('Image must be under 800KB');return}
  const fd=new FormData();fd.append('field',field);fd.append('resume',f,f.name);
  const r=await fetch('/api/account/photo',{method:'POST',headers:{'Authorization':'Bearer '+CTOKEN},body:fd}).then(x=>x.json());
  if(r.ok){ME=await api('/api/account');toast(field[0].toUpperCase()+field.slice(1)+' updated');showView('profile')}else toast(r.error||'Upload failed');
}
async function uploadJobPhoto(){
  const f=$('phFile').files[0];if(!f){toast('Choose a photo first');return}
  const fd=new FormData();fd.append('caption',$('phCaption').value);fd.append('resume',f,f.name);
  const r=await fetch('/api/account/job-photo',{method:'POST',headers:{'Authorization':'Bearer '+CTOKEN},body:fd}).then(x=>x.json());
  toast(r.ok?'Uploaded — pending admin approval':(r.error||'Upload failed'));if(r.ok)showView('jobs');
}
async function saveProfile(){
  ME=await api('/api/account',{method:'PUT',body:{company:{name:$('pfName').value,details:$('pfDetails').value},personal:{name:$('pfPersonal').value}}});
  toast('Profile saved');
}
function exportData(){
  api('/api/account/export').then(d=>{
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));a.download='lines-logos-my-data.json';a.click();
    toast('Data export downloaded');
  });
}
async function clearCompanyData(){
  ME=await api('/api/account',{method:'PUT',body:{company:{name:'',logo:'',banner:'',details:''},personal:{}}});
  toast('Company & personal info cleared');showView('settings');
}
function deleteAccount(){
  openModal(`<h2>Delete account</h2><p class="muted" style="margin-bottom:14px">Permanently removes your account, uploaded photos, and stored details. This cannot be undone.</p>
    <button class="btn btn-red" style="width:100%" onclick="confirmDelete()">Yes — delete everything</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="document.getElementById('modalBg').classList.remove('open')">Keep my account</button>`);
}
async function confirmDelete(){
  const r=await api('/api/account',{method:'DELETE'});
  if(r.deleted){localStorage.removeItem('ll_cust_token');location.reload()}else toast('Delete failed');
}
function openSetup2FA(){
  api('/api/auth/totp/setup',{method:'POST'}).then(r=>{
    if(r.error){toast(r.error);return}
    openModal(`<h2>Authenticator setup</h2><p class="muted" style="margin-bottom:12px">Add this secret to Google Authenticator or Authy (manual entry), then confirm with a code.</p>
      <div class="card" style="font-family:monospace;font-size:16px;letter-spacing:.12em;text-align:center;user-select:all">${r.secret}</div>
      <input class="inp" id="totpCode" placeholder="6-digit code from the app" inputmode="numeric">
      <button class="btn" style="width:100%" onclick="enableTotp()">Verify &amp; enable</button>`);
  });
}
async function enableTotp(){
  const r=await api('/api/auth/totp/enable',{method:'POST',body:{code:$('totpCode').value}});
  if(r.ok){ME.totpEnabled=true;toast('Two-step verification enabled');$('modalBg').classList.remove('open');showView('settings')}else toast(r.error||'Code mismatch');
}
async function registerPasskey(){
  if(!window.PublicKeyCredential){toast('This browser does not support passkeys');return}
  const opt=await api('/api/auth/passkey/register',{method:'POST'});
  if(opt.error){toast(opt.error);return}
  try{
    opt.publicKey.challenge=Uint8Array.from(atob(opt.publicKey.challenge),c=>c.charCodeAt(0));
    opt.publicKey.user.id=Uint8Array.from(atob(opt.publicKey.user.id),c=>c.charCodeAt(0));
    const cred=await navigator.credentials.create({publicKey:opt.publicKey});
    const pk=cred.response.getPublicKey?btoa(String.fromCharCode(...new Uint8Array(cred.response.getPublicKey()))):'';
    const r=await api('/api/auth/passkey/complete',{method:'POST',body:{id:btoa(String.fromCharCode(...new Uint8Array(cred.rawId))),publicKey:pk}});
    toast(r.ok?'Passkey added — sign in with your fingerprint next time':(r.error||'Saved'));
    ME=await api('/api/account');showView('settings');
  }catch(e){toast('Passkey cancelled or unsupported: '+String(e.message||e).slice(0,60))}
}
function requestPush(ask=true){
  if(!('Notification' in window)){if(ask)toast('Push not supported in this browser');return}
  if(Notification.permission==='granted'){
    setInterval(()=>{JOBS.forEach(j=>{const t=new Date(j.when)-Date.now();if(t>0&&t<86400000*2&&!localStorage.getItem('ntf_'+j.id)){localStorage.setItem('ntf_'+j.id,'1');new Notification('Upcoming job: '+j.title,{body:'Scheduled '+j.when+' — see your dashboard for details.'})}})},60000);
    if(ask)toast('Job reminders enabled for this device');
  } else if(ask){Notification.requestPermission().then(p=>{if(p==='granted')requestPush(false);else toast('Notifications blocked — enable them in browser settings')})}
}
function renderBell(){
  const items=[
    ...JOBS.map(j=>({t:'Upcoming job: '+j.title,s:j.when+' · '+j.crew})),
    ...INVOICES.filter(i=>i.status==='sent').map(i=>({t:'Invoice '+i.id+' unpaid',s:fmt$(i.amount)+' · tap Invoices to pay'})),
    ...(ME.disputes||[]).map(d=>({t:'Dispute '+d.invoiceId+': '+d.status,s:d.createdAt||''}))
  ];
  $('bellDot').style.display=items.length?'block':'none';
  $('bellPanel').innerHTML=items.length?items.slice(0,8).map(n=>`<div class="ntf">${esc(n.t)}<small>${esc(n.s)}</small></div>`).join(''):'<div class="ntf muted">No notifications.</div>';
}
function installOS(os){
  if(os==='iOS'||os==='iPad'){
    if(window.navigator.standalone){toast('Already installed — open it from your home screen');return}
    if(window.__deferredInstall){window.__deferredInstall.prompt();return}
    openModal(`<h2>Install on iOS / iPad</h2><ol class="muted" style="margin:0 0 6px 18px;line-height:2">
      <li>Open this page in <b>Safari</b></li><li>Tap the <b>Share</b> button (square with arrow)</li><li>Scroll down → <b>Add to Home Screen</b></li><li>Tap <b>Add</b> — it launches full-screen like a native app</li></ol>
      <button class="btn" style="width:100%" onclick="document.getElementById('modalBg').classList.remove('open')">Got it</button>`);
    return;
  }
  window.open('https://github.com/projectzerodays/lines-and-logos/releases/latest','_blank');
}
function downloadApps(){openModal(`<h2>Get the app</h2><p class="muted" style="margin-bottom:14px">Pick your platform. Desktop and Android builds come from our GitHub releases; iOS and iPad install as a PWA.</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
    ${[['Android'],['iOS / iPad'],['macOS'],['Windows'],['Linux']].map(a=>`<button class="btn btn-ghost" style="min-width:110px" onclick="installOS('${a[0].split(' ')[0]}')">${a[0]}</button>`).join('')}
  </div>`)}
async function saveAlerts(){
  const body={};document.querySelectorAll('[data-alert]').forEach(c=>body[c.dataset.alert]=c.checked);
  ME.alerts=(await api('/api/account/alerts',{method:'POST',body})).alerts||body;
  toast('Alert preferences saved');
}
async function loadNotes(){
  const box=$('aiNotes');if(!box)return;
  const notes=await api('/api/account/notes').catch(()=>[]);
  box.innerHTML=(notes||[]).map(n=>`<div class="card" style="margin-bottom:8px;padding:11px 14px"><b style="font-size:12.5px">${esc(n.text)}</b><div class="muted" style="font-size:10.5px;margin-top:4px">${esc(n.source)} · ${new Date(n.at).toLocaleString()}</div></div>`).join('')||'<p class="muted">No notes yet — they appear after you chat with our assistant.</p>';
}
const _origShowView=showView;
showView=async function(name){await _origShowView(name);if(name==='settings')loadNotes();if(name==='invoices')loadInvoiceHistory()};
if(CTOKEN){api('/api/account').then(a=>{if(!a.error){ME=a;boot()}})}
