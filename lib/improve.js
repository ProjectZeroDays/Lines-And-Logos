/* Lines & Logos — Continuous Improvement Agent.
 * Periodically scans the app for optimization opportunities across six axes:
 *   SEO · performance/compute · code health · dependencies · GUI defects · a11y
 * Scores the app overall, tracks the trend over time, auto-fixes only trivial
 * items, and queues everything else as owner-approvable recommendations.
 * Zero-dependency. Pure Node fs + regex heuristics.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PUBLIC_PAGES = ['index.html','partners.html','quotes.html','careers.html','gallery.html','legal.html','customer.html','login.html','dashboard.html'];

/* ---------- helpers ---------- */
function read(rootDir, rel) { try { return fs.readFileSync(path.join(rootDir, rel), 'utf8'); } catch { return null; } }
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'data' || e.name === 'pkg' || e.name === 'lib') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|js|css)$/.test(e.name)) out.push(p);
  }
  return out;
}
const now = () => new Date().toISOString();

/* ---------- per-axis analyzers (each returns findings[] + axis score 0-100) ---------- */
function seo(rootDir) {
  const findings = [];
  for (const p of PUBLIC_PAGES) {
    const html = read(rootDir, p); if (!html) continue;
    if (!/<meta\s+name="description"/i.test(html)) findings.push({ sev: 'med', axis: 'seo', target: p, issue: 'Missing meta description', fix: 'Add a 150–160 char description.' });
    if (!/<meta\s+property="og:title"/i.test(html)) findings.push({ sev: 'low', axis: 'seo', target: p, issue: 'No Open Graph tags', fix: 'Add og:title/description/image.' });
    if ((html.match(/<h1[\s>]/gi) || []).length > 1) findings.push({ sev: 'low', axis: 'seo', target: p, issue: 'Multiple H1 tags', fix: 'Keep one H1 per page.' });
    if (!/<html[^>]*lang=/i.test(html)) findings.push({ sev: 'med', axis: 'seo', target: p, issue: 'Missing <html lang>', fix: 'Add lang="en".' });
  }
  return { axis: 'SEO', findings, score: Math.max(0, 100 - findings.reduce((s, f) => s + (f.sev === 'med' ? 8 : 3), 0)) };
}

function performance(rootDir) {
  const findings = [];
  for (const p of PUBLIC_PAGES) {
    const html = read(rootDir, p); if (!html) continue;
    const scripts = (html.match(/<script(?![^>]*defer)(?![^>]*async)[^>]*src=/gi) || []).length;
    if (scripts) findings.push({ sev: 'med', axis: 'performance', target: p, issue: `${scripts} render-blocking <script>`, fix: 'Add defer to non-critical scripts.' });
    if (!/<link rel="preconnect"/i.test(html)) findings.push({ sev: 'low', axis: 'performance', target: p, issue: 'No preconnect for font CDN', fix: 'Add <link rel="preconnect" href="https://fonts.googleapis.com">.' });
    const imgs = html.match(/<img[^>]*>/g) || [];
    const noLazy = imgs.filter(i => !/loading=/.test(i)).length;
    if (imgs.length && noLazy === imgs.length) findings.push({ sev: 'low', axis: 'performance', target: p, issue: `${imgs.length} image(s) without loading attribute`, fix: 'Add loading="lazy" to below-fold images.' });
  }
  // asset weight
  for (const asset of ['assets/os.js', 'assets/theme.js']) {
    const fp = path.join(rootDir, asset);
    if (fs.existsSync(fp)) {
      const kb = Math.round(fs.statSync(fp).size / 1024);
      if (kb > 200) findings.push({ sev: 'high', axis: 'performance', target: asset, issue: `Large file ${kb}KB`, fix: 'Split or minify.' });
    }
  }
  return { axis: 'Performance', findings, score: Math.max(0, 100 - findings.reduce((s, f) => s + ({ high: 20, med: 8, low: 3 }[f.sev]), 0)) };
}

function codeHealth(rootDir) {
  const findings = [];
  const files = walk(rootDir);
  let consoleLogs = 0, todos = 0, dupes = 0;
  const seenLines = new Map();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(rootDir, f);
    const logs = (src.match(/console\.log\(/g) || []).length;
    if (logs && !/demo|demoData|demoAgents/.test(rel)) { consoleLogs += logs; if (logs > 2) findings.push({ sev: 'low', axis: 'code', target: rel, issue: `${logs} console.log calls`, fix: 'Remove or gate behind debug flag.' }); }
    const t = (src.match(/TODO|FIXME|HACK/g) || []).length; todos += t;
    if (t > 3) findings.push({ sev: 'low', axis: 'code', target: rel, issue: `${t} TODO/FIXME markers`, fix: 'Triage and resolve.' });
    // crude duplication: repeated 4-line windows
    const lines = src.split('\n');
    for (let i = 0; i < lines.length - 4; i += 4) {
      const key = lines.slice(i, i + 4).join('\n').trim();
      if (key.length < 40 || /^\s*[{})\]]*\s*$/.test(key)) continue;
      if (seenLines.has(key)) { dupes++; if (dupes <= 3) findings.push({ sev: 'med', axis: 'code', target: rel, issue: `Duplicated block also in ${seenLines.get(key)}`, fix: 'Extract to a shared function.' }); }
      else seenLines.set(key, rel);
    }
  }
  return { axis: 'Code health', findings: findings.slice(0, 12), score: Math.max(0, 100 - consoleLogs * 2 - todos - dupes * 5) };
}

function dependencies(rootDir) {
  const findings = [];
  return new Promise(resolve => {
    const pkgPath = path.join(rootDir, 'package.json');
    if (!fs.existsSync(pkgPath)) return resolve({ axis: 'Dependencies', findings, score: 90 });
    execFile('npm', ['outdated', '--json'], { cwd: rootDir, timeout: 30e3 }, (err, stdout) => {
      try {
        const j = JSON.parse(stdout || '{}');
        for (const [name, v] of Object.entries(j)) {
          findings.push({ sev: 'med', axis: 'dependencies', target: name, issue: `${name}: ${v.current} → ${v.latest}`, fix: `npm install ${name}@${v.latest} (test first)` });
        }
      } catch (e) { /* none outdated or parse fail */ }
      resolve({ axis: 'Dependencies', findings: findings.slice(0, 10), score: Math.max(0, 100 - findings.length * 10) });
    });
  });
}

function guiDefects(rootDir) {
  const findings = [];
  const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));
  const ids = new Set();
  for (const f of htmlFiles) {
    const html = read(rootDir, f); if (!html) continue;
    // broken internal links
    for (const m of html.matchAll(/href="([^"#]+\.html)#/g)) { /* anchors — fine */ }
    for (const m of html.matchAll(/(?:href|src)="([^"#]+?\.html)"/g)) {
      const target = m[1].split('#')[0];
      if (target && !fs.existsSync(path.join(rootDir, target)) && !target.startsWith('http'))
        findings.push({ sev: 'high', axis: 'gui', target: f, issue: `Broken link → ${target}`, fix: 'Fix or remove the link.' });
    }
    // duplicate element IDs
    const found = new Set();
    for (const m of html.matchAll(/id="([^"]+)"/g)) {
      if (found.has(m[1]) && !/^(ll-|kc-|tp-|te-)/.test(m[1])) findings.push({ sev: 'med', axis: 'gui', target: f, issue: `Duplicate id "${m[1]}"`, fix: 'Rename one instance.' });
      found.add(m[1]);
    }
    // unclosed tag heuristic
    const opens = (html.match(/<div[\s>]/g) || []).length, closes = (html.match(/<\/div>/g) || []).length;
    if (Math.abs(opens - closes) > 2) findings.push({ sev: 'high', axis: 'gui', target: f, issue: `div balance off by ${opens - closes}`, fix: 'Check for unclosed tags (GUI layout defects).' });
    // missing favicon
    if (!/rel="icon"/.test(html)) findings.push({ sev: 'low', axis: 'gui', target: f, issue: 'No favicon link', fix: 'Add <link rel="icon" href="icons/favicon-32.png">.' });
  }
  return { axis: 'GUI defects', findings, score: Math.max(0, 100 - findings.reduce((s, f) => s + ({ high: 20, med: 8, low: 3 }[f.sev]), 0)) };
}

function accessibility(rootDir) {
  const findings = [];
  for (const p of PUBLIC_PAGES) {
    const html = read(rootDir, p); if (!html) continue;
    const imgs = (html.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
    if (imgs) findings.push({ sev: 'med', axis: 'a11y', target: p, issue: `${imgs} image(s) missing alt`, fix: 'Add descriptive alt text.' });
    if (!/aria-label|aria-labelledby/.test(html)) findings.push({ sev: 'low', axis: 'a11y', target: p, issue: 'No ARIA labels', fix: 'Add aria-label to icon buttons.' });
    if (!/<meta\s+name="viewport"/i.test(html)) findings.push({ sev: 'high', axis: 'a11y', target: p, issue: 'Missing viewport', fix: 'Add viewport meta.' });
  }
  return { axis: 'Accessibility', findings, score: Math.max(0, 100 - findings.reduce((s, f) => s + ({ high: 20, med: 8, low: 3 }[f.sev]), 0)) };
}

/* ---------- orchestrator ---------- */
async function analyze(rootDir) {
  const [deps] = [await dependencies(rootDir)];
  const axes = [seo(rootDir), performance(rootDir), codeHealth(rootDir), guiDefects(rootDir), accessibility(rootDir), deps];
  const all = axes.flatMap(a => a.findings);
  const overall = Math.round(axes.reduce((s, a) => s + a.score, 0) / axes.length);
  return { at: now(), overall, axes: axes.map(a => ({ axis: a.axis, score: a.score, findings: a.findings.length })), findings: all };
}

/* trivial, provably-safe auto-fixes */
function applyTrivialFixes(rootDir, findings) {
  const applied = [];
  for (const f of findings) {
    if (f.axis === 'a11y' && f.issue.includes('missing alt')) continue; // needs human text
    if (f.axis === 'performance' && f.issue.includes('render-blocking') && f.target.endsWith('.html')) {
      const fp = path.join(rootDir, f.target);
      let html = fs.readFileSync(fp, 'utf8');
      if (!/<script(?![^>]*defer)[^>]*src=/i.test(html)) continue;
      html = html.replace(/<script(?![^>]*defer)(?![^>]*async)([^>]*src=[^>]*)>/gi, '<script defer$1>');
      fs.writeFileSync(fp, html);
      applied.push(`added defer in ${f.target}`);
    }
    if (f.axis === 'gui' && f.issue === 'No favicon link' && f.target.endsWith('.html')) {
      const fp = path.join(rootDir, f.target);
      const html = fs.readFileSync(fp, 'utf8');
      if (/<\/head>/i.test(html) && !/rel="icon"/.test(html)) {
        fs.writeFileSync(fp, html.replace(/<\/head>/i, '<link rel="icon" type="image/png" href="icons/favicon-32.png">\n</head>'));
        applied.push(`added favicon in ${f.target}`);
      }
    }
  }
  return applied;
}

/* record trend + queue recommendations; returns summary for dashboard */
async function runImprovement(rootDir, db, ctx) {
  const report = await analyze(rootDir);
  const applied = applyTrivialFixes(rootDir, report.findings);
  db.improvements = db.improvements || [];
  db.improvements.unshift({ id: 'imp' + Date.now(), at: report.at, overall: report.overall, axes: report.axes });
  db.improvements = db.improvements.slice(0, 60);
  // queue owner-approvable recommendations (dedupe by target+issue)
  db.recommendations = db.recommendations || [];
  const seen = new Set(db.recommendations.map(r => r.target + r.issue));
  for (const f of report.findings.filter(f => f.sev !== 'low')) {
    if (seen.has(f.target + f.issue)) continue;
    db.recommendations.unshift({ id: 'rec' + Date.now() + Math.random().toString(36).slice(2, 5),
      at: report.at, sev: f.sev, axis: f.axis, target: f.target, issue: f.issue, fix: f.fix, status: 'open' });
  }
  db.recommendations = db.recommendations.slice(0, 200);
  ctx.logActivity(`Improvement Agent: overall ${report.overall}/100 — ${report.findings.length} finding(s), ${applied.length} auto-fixed, trend tracked`);
  if (applied.length) ctx.notify(db.settings.quotes.approvalEmail, 'Improvement Agent auto-fixes applied', applied.join('; '), ['in-app']);
  ctx.save && ctx.save();
  return { report, applied };
}

module.exports = { analyze, runImprovement, applyTrivialFixes };
