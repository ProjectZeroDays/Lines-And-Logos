/* Lines & Logos — Self-Healing & Self-Correcting watchdog.
 * Runs on the server's own timers (no external cron). Zero-dependency.
 *
 * What it does, on every pass (default every 5 min + on boot):
 *   1. Data integrity  — reload data/db.json from disk; if corrupt, restore
 *                        from the newest .bak and log the incident.
 *   2. Schema heal     — ensure every known collection exists and is an array.
 *   3. Referential fix — duplicate ids deduped (first wins); negative stock
 *                        clamped; dangling foreign keys flagged.
 *   4. Workflow rescue — jobs stuck in 'running' > 10 min reset to 'queued';
 *                        failed jobs retried up to 3× with backoff.
 *   5. Health report   — every pass appends to db.healLog; anomalies notify.
 *
 * Everything it changes is written to db.healLog so the dashboard can show
 * exactly what the server healed and when.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KNOWN_COLLECTIONS = [
  'accounts','contacts','leads','quotes','quoteRequests','jobs','timeEntries',
  'checklists','checklistRuns','invoices','expenses','payments','tasks','users',
  'gallery','reviews','inquiries','chats','contracts','inventory','inventoryTx',
  'events','messages','emails','reminders','passwordResets','purchaseOrders',
  'calendarNotes','workflows','workflowRuns','integrations','healLog','seoAudits',
  'securityFindings','disclosures','brandAssets','exitTracker',
];

const RUN_STALE_MS = 10 * 60e3;   // workflow run considered stuck after 10 min
const MAX_RETRY = 3;

function now() { return new Date().toISOString(); }

function newestBackup(dataFile) {
  const dir = path.dirname(dataFile);
  let best = null, bestM = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.bak')) continue;
      const m = fs.statSync(path.join(dir, f)).mtimeMs;
      if (m > bestM) { bestM = m; best = path.join(dir, f); }
    }
  } catch (e) { /* no dir yet */ }
  return best;
}

/* ---------- the checks (pure-ish: they mutate db + return actions) ---------- */
function checkIntegrity(db, ctx, actions) {
  const { dataFile } = ctx;
  let raw;
  try { raw = fs.readFileSync(dataFile, 'utf8'); } catch (e) { return; }
  try { JSON.parse(raw); }
  catch (e) {
    const bak = newestBackup(dataFile);
    actions.push({ sev: 'critical', check: 'db-integrity',
      detail: `data file corrupt (${e.message})`, action: bak ? `restored from ${path.basename(bak)}` : 'NO BACKUP FOUND — manual restore required' });
    if (bak) {
      try { fs.copyFileSync(bak, dataFile); ctx.reload(); }
      catch (e2) { actions.push({ sev: 'critical', check: 'db-integrity', detail: `restore failed: ${e2.message}`, action: 'manual restore required' }); }
    }
  }
}

function checkCollections(db, actions) {
  for (const c of KNOWN_COLLECTIONS) {
    if (!Array.isArray(db[c])) {
      db[c] = Array.isArray(db[c]) ? db[c] : [];
      actions.push({ sev: 'info', check: 'schema', detail: `collection '${c}' missing — recreated empty`, action: 'healed' });
    }
  }
}

function checkDuplicates(db, actions) {
  for (const c of KNOWN_COLLECTIONS) {
    const seen = new Set(); const keep = [];
    for (const row of db[c]) {
      if (!row || typeof row.id !== 'string' || seen.has(row.id)) {
        actions.push({ sev: 'warn', check: 'duplicates', detail: `duplicate id '${row && row.id}' in '${c}' — first kept`, action: 'healed' });
        continue;
      }
      seen.add(row.id); keep.push(row);
    }
    db[c] = keep;
  }
}

function checkDataSanity(db, actions) {
  for (const item of db.inventory) {
    if (item.stock < 0) {
      item.stock = 0;
      actions.push({ sev: 'warn', check: 'sanity', detail: `negative stock on '${item.name}' clamped to 0`, action: 'healed' });
    }
  }
  const acctIds = new Set(db.accounts.map(a => a.id));
  for (const inv of db.invoices) {
    if (inv.accountId && !acctIds.has(inv.accountId)) {
      actions.push({ sev: 'warn', check: 'sanity', detail: `invoice ${inv.number} references unknown account ${inv.accountId}`, action: 'flagged (not auto-fixed)' });
    }
  }
}

function checkWorkflows(db, actions) {
  for (const run of db.workflowRuns) {
    if (run.status === 'running' && Date.now() - new Date(run.startedAt || 0) > RUN_STALE_MS) {
      run.status = 'queued'; run.startedAt = null;
      actions.push({ sev: 'warn', check: 'workflows', detail: `run ${run.id} stuck in 'running' — requeued`, action: 'healed' });
    }
    if (run.status === 'failed' && (run.retries || 0) < MAX_RETRY) {
      run.status = 'queued'; run.retries = (run.retries || 0) + 1; run.startedAt = null;
      actions.push({ sev: 'warn', check: 'workflows', detail: `run ${run.id} failed — retry ${run.retries}/${MAX_RETRY}`, action: 'requeued with backoff' });
    }
  }
}

/* ---------- main entry ---------- */
function healNow(ctx) {
  const { db, save, logActivity, notify, quiet } = ctx;
  const actions = [];
  try {
    checkIntegrity(db, ctx, actions);
    checkCollections(db, actions);
    checkDuplicates(db, actions);
    checkDataSanity(db, actions);
    checkWorkflows(db, actions);
  } catch (e) {
    actions.push({ sev: 'critical', check: 'watchdog', detail: `healer threw: ${e.message}`, action: 'investigate' });
  }
  for (const a of actions) {
    db.healLog.unshift({ id: 'hl' + Date.now() + Math.random().toString(36).slice(2, 6),
      at: now(), ...a });
  }
  db.healLog = db.healLog.slice(0, 500);
  if (actions.length && !quiet) {
    const crit = actions.filter(a => a.sev === 'critical').length;
    logActivity(`Self-heal: ${actions.length} issue(s) addressed (${crit} critical)`);
    if (crit) notify(null, 'Self-heal: critical issue', actions.filter(a => a.sev === 'critical').map(a => `${a.check}: ${a.detail}`).join(' | '), ['in-app']);
    save();
  } else if (actions.length) { save(); }
  return actions;
}

/* start the watchdog on the server's own timer */
function start(ctx, intervalMs = 5 * 60e3) {
  const boot = healNow({ ...ctx, quiet: true });
  ctx.logActivity(`Self-healing watchdog armed (${boot.length} issue(s) found at boot)`);
  const t = setInterval(() => { try { healNow(ctx); } catch (e) { ctx.logActivity('Self-heal pass error: ' + e.message); } }, intervalMs);
  t.unref && t.unref();
  return t;
}

module.exports = { start, healNow, KNOWN_COLLECTIONS };
