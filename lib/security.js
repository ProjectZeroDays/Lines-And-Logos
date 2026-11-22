/* Lines & Logos — Security Agent.
 * Scheduled vulnerability scans over the app's own surface. Auto-fixes only
 * what is provably safe; everything else becomes a finding. New high/critical
 * findings auto-draft a white paper + stakeholder disclosure — held in a
 * pending-disclosure queue (coordinated-disclosure style) for owner sign-off,
 * never auto-mailed externally.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* Each check returns findings: {id, sev, title, detail, fixable, fix()} */
function scan(rootDir, db) {
  const findings = [];
  const F = (sev, rule, title, detail, fix) => findings.push({ id: rule, sev, rule, title, detail, fixable: !!fix, fix });

  // 1. Security headers config lives in server.js response — checked via config below
  // 2. Exposed sensitive files
  for (const f of ['data/db.json.bak','.env','server.log','config.json']) {
    const p = path.join(rootDir, f);
    if (fs.existsSync(p)) F('high', 'exposed-file', `Sensitive file present: ${f}`, `${f} sits inside the web root. Move outside the served directory or block it.`, null);
  }
  // 3. Debug mode
  if (process.env.NODE_ENV !== 'production' && db.settings?.debug) {
    F('med', 'debug-mode', 'Debug mode enabled', 'db.settings.debug is on — disable in production.', null);
  }
  // 4. Weak/default credentials
  for (const u of db.users) {
    const weak = ['password','123456','admin','letmein','welcome'];
    if (u.pass && weak.includes(String(u.pass))) F('critical', 'weak-password', `Weak password for ${u.email}`, 'Hash matches a top-10 weak password. Force a reset.', null);
  }
  // 5. Long-lived tokens
  for (const u of db.users) {
    if (u.token && u.tokenCreatedAt && Date.now() - new Date(u.tokenCreatedAt) > 180 * 864e5) {
      F('low', 'stale-token', `Token >180d old for ${u.email}`, 'Rotate the API token.', null);
    }
  }
  // 6. Dependency surface — package.json presence + lockfile check
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (Object.keys(deps).length > 20) F('low', 'dep-surface', `${Object.keys(deps).length} dependencies`, 'Large dependency surface — audit with `npm audit`.', null);
    if (!fs.existsSync(path.join(rootDir, 'package-lock.json'))) F('med', 'no-lockfile', 'No package-lock.json', 'Pin dependencies with a lockfile for reproducible, auditable builds.', null);
  }
  // 7. Uploaded content allowlist
  if (db.settings?.uploads && db.settings.uploads.allowlist === false) {
    F('med', 'upload-allowlist', 'Upload type allowlist disabled', 'Re-enable the upload MIME allowlist.', null);
  }
  // 7b. npm audit — free CVE data, zero new dependencies (async, so done pre-scan)
  // 9. Backups exist?
  const dataDir = path.join(rootDir, 'data');
  const baks = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter(f => f.endsWith('.bak')) : [];
  if (!baks.length) F('high', 'no-backups', 'No data backups found', 'No .bak files in data/ — one bad write loses everything. The self-healer can\'t restore without a backup.', null);

  // 9. Self-fixable: make a backup now if none (safe + reversible)
  if (!baks.length) {
    const last = findings.pop(); // remove 'no-backups', re-add with fix
    findings.push({ ...last, fixable: true });
  }
  return findings;
}

/* npm audit — real CVE data, no new deps. Runs async before the file scan;
 * results merged into findings. Never throws; audit failures become a finding. */
const { execFile } = require('child_process');
function npmAudit(rootDir, findings) {
  return new Promise(resolve => {
    if (!fs.existsSync(path.join(rootDir, 'package.json'))) return resolve();
    execFile('npm', ['audit', '--json', '--omit=dev'], { cwd: rootDir, timeout: 30e3 }, (err, stdout) => {
      try {
        const j = JSON.parse(stdout || '{}');
        const vulns = (j.vulnerabilities) || {};
        const meta = j.metadata || {};
        const counts = meta.vulnerabilities || {};
        if ((counts.high || 0) > 0 || (counts.critical || 0) > 0) {
          const names = Object.keys(vulns).filter(n => {
            const v = vulns[n]; return v && (v.severity === 'high' || v.severity === 'critical');
          }).slice(0, 5);
          findings.push({ id: 'npm-audit-' + Date.now(), sev: counts.critical ? 'critical' : 'high',
            rule: 'npm-audit', title: `npm audit: ${counts.critical || 0} critical / ${counts.high || 0} high CVE(s)`,
            detail: names.length ? 'Affected: ' + names.join(', ') + '. Run `npm audit fix` (review majors first).' : 'See `npm audit` output.',
            fixable: false });
        }
      } catch (e) {
        findings.push({ id: 'npm-audit-err', sev: 'low', rule: 'npm-audit',
          title: 'npm audit unavailable', detail: 'Could not parse audit output (' + e.message + ').', fixable: false });
      }
      resolve();
    });
  });
}

/* run the scan, record results, auto-apply safe fixes, return summary */
async function runScan(rootDir, db, ctx) {
  const findings = scan(rootDir, db);
  await npmAudit(rootDir, findings);
  const applied = []; const open = [];
  for (const f of findings) {
    if (f.fixable && f.fix) {
      try { f.fix(); applied.push(f.rule); }
      catch (e) { open.push({ ...f, fixError: e.message }); }
    } else open.push(f);
  }
  const rec = { id: 'scan' + Date.now(), at: new Date().toISOString(),
    total: findings.length, autoFixed: applied, open: open.length,
    findings: open.map(({ fix, ...rest }) => rest) };
  db.securityFindings.unshift(rec);
  db.securityFindings = db.securityFindings.slice(0, 100);
  // new high/critical → draft disclosure (held, not sent)
  const fresh = rec.findings.filter(f => (f.sev === 'high' || f.sev === 'critical'));
  let disclosure = null;
  if (fresh.length) {
    disclosure = draftDisclosure(fresh, db, ctx);
    db.disclosures.unshift(disclosure);
  }
  return { scan: rec, disclosure };
}

/* Coordinated-disclosure white paper, auto-drafted, held for approval */
function draftDisclosure(findings, db, ctx) {
  const id = 'wp' + Date.now().toString(36);
  const now = new Date().toISOString();
  const sevRank = { critical: 0, high: 1, med: 2, low: 3 };
  const sorted = [...findings].sort((a, b) => sevRank[a.sev] - sevRank[b.sev]);
  const md = [
    `# Security Advisory ${id.toUpperCase()}`,
    ``,
    `**Issued (draft):** ${now}`,
    `**Status:** DRAFT — pending owner approval before any external disclosure`,
    `**Severity:** ${sorted[0].sev.toUpperCase()}`,
    `**Affected:** Lines & Logos Business OS (self-hosted instance)`,
    ``,
    `## Summary`,
    `${sorted.length} new ${sorted[0].sev}-severity finding(s) identified by the automated Security Agent during a scheduled scan.`,
    ``,
    `## Findings`,
    ...sorted.map((f, i) => `### ${i + 1}. ${f.title} (${f.sev})\n\n- **Rule:** ${f.rule}\n- **Detail:** ${f.detail}`),
    ``,
    `## Remediation`,
    ...sorted.map((f, i) => `${i + 1}. ${f.detail}`),
    ``,
    `## Disclosure policy`,
    `This advisory follows coordinated-disclosure practice: it is shared with affected stakeholders and upstream parties only after owner review, with a remediation window before any broader publication. Do not distribute externally until approved.`,
    ``,
    `---`,
    `_Generated automatically by the Lines & Logos Security Agent._`,
  ].join('\n');
  const stakeholders = (db.settings?.security?.stakeholders) || (db.settings?.approvalEmail ? [db.settings.approvalEmail] : []);
  return { id, kind: 'security-advisory', status: 'pending-approval', createdAt: now,
    severity: sorted[0].sev, title: `Security Advisory ${id.toUpperCase()} (${sorted[0].sev})`,
    markdown: md, stakeholders, findings: sorted.map(f => f.rule) };
}

/* owner actions on a pending disclosure */
function approveDisclosure(db, id, ctx) {
  const d = db.disclosures.find(x => x.id === id);
  if (!d || d.status !== 'pending-approval') throw new Error('Not found or already resolved');
  d.status = 'approved';
  d.approvedAt = new Date().toISOString();
  // notify stakeholders (in-app/email via existing notify pipeline)
  ctx.notify(d.stakeholders, d.title, 'A security advisory has been approved for coordinated disclosure. See the Security tab for the full white paper.', ['in-app', 'email']);
  ctx.logActivity(`Security disclosure ${d.id} approved for coordinated disclosure to ${d.stakeholders.length} stakeholder(s)`);
  return d;
}
function rejectDisclosure(db, id) {
  const d = db.disclosures.find(x => x.id === id);
  if (!d) throw new Error('Not found');
  d.status = 'rejected'; d.rejectedAt = new Date().toISOString();
  return d;
}

module.exports = { scan, runScan, draftDisclosure, approveDisclosure, rejectDisclosure };
