/* Lines & Logos — SEO Agent.
 * Audits the static HTML pages, scores them, writes recommendations, and
 * applies ONLY what the owner approves. Zero-dependency.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGES = ['index.html','partners.html','quotes.html','careers.html','gallery.html','legal.html','customer.html'];

function analyzeHtml(file, html, url) {
  const issues = []; const scores = {};
  const push = (sev, rule, msg, fix) => issues.push({ sev, rule, msg, fix });

  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '';
  const canon = /<link\s+rel="canonical"/i.test(html);
  const og = /<meta\s+property="og:title"/i.test(html);
  const h1count = (html.match(/<h1[\s>]/gi) || []).length;
  const imgTotal = (html.match(/<img[\s>]/gi) || []).length;
  const imgNoAlt = (html.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
  const viewport = /<meta\s+name="viewport"/i.test(html);
  const manifest = /<link\s+rel="manifest"/i.test(html);

  scores.title = !title ? 0 : title.length < 30 ? 60 : title.length <= 60 ? 100 : 70;
  if (!title) push('high', 'title', 'Missing <title> tag', 'Add a unique title (50–60 chars).');
  else if (title.length > 60) push('med', 'title-length', `Title is ${title.length} chars (>60 may truncate)`, 'Trim to 50–60 characters.');
  if (!desc) push('high', 'meta-description', 'Missing meta description', 'Add a 150–160 char description with the primary keyword.');
  else if (desc.length < 70) push('med', 'meta-description-short', `Description only ${desc.length} chars`, 'Expand to 150–160 characters.');
  if (desc.length > 160) push('med', 'meta-description-long', `Description ${desc.length} chars (>160 truncates)`, 'Trim to ≤160 characters.');
  if (!canon) push('low', 'canonical', 'No canonical link', 'Add <link rel="canonical" href="…">.');
  if (!og) push('low', 'open-graph', 'No Open Graph tags', 'Add og:title / og:description / og:image for social sharing.');
  if (h1count === 0) push('high', 'h1', 'No <h1> on page', 'Add one descriptive H1 with the primary keyword.');
  if (h1count > 1) push('med', 'h1-multiple', `${h1count} H1 tags on one page`, 'Keep exactly one H1 per page.');
  if (imgNoAlt) push('med', 'alt-text', `${imgNoAlt}/${imgTotal} images missing alt text`, 'Add descriptive alt attributes.');
  if (!viewport) push('high', 'viewport', 'Missing viewport meta', 'Add <meta name="viewport" content="width=device-width,initial-scale=1">.');
  if (!manifest) push('low', 'manifest', 'No PWA manifest linked', 'Link manifest.webmanifest for installability.');

  const high = issues.filter(i => i.sev === 'high').length;
  const med = issues.filter(i => i.sev === 'med').length;
  const score = Math.max(0, 100 - high * 15 - med * 6);
  return { page: file, url, title, description: desc, score, issues };
}

function auditSite(rootDir) {
  const results = [];
  for (const p of PAGES) {
    const fp = path.join(rootDir, p);
    if (!fs.existsSync(fp)) continue;
    try { results.push(analyzeHtml(p, fs.readFileSync(fp, 'utf8'), '/' + p)); }
    catch (e) { results.push({ page: p, url: '/' + p, score: 0, error: e.message, issues: [] }); }
  }
  const avg = Math.round(results.reduce((n, r) => n + r.score, 0) / Math.max(1, results.length));
  return { auditedAt: new Date().toISOString(), pages: results, siteScore: avg };
}

/* Apply an approved fix. Only a small safe set of edits is auto-applicable;
 * anything structural goes back as "manual". */
function applyFix(rootDir, page, issue) {
  const fp = path.join(rootDir, page);
  if (!fs.existsSync(fp)) return { ok: false, reason: 'page not found' };
  let html = fs.readFileSync(fp, 'utf8');
  const rule = issue.rule;

  if (rule === 'title' && issue.newTitle) {
    if (/<title>[^<]*<\/title>/i.test(html)) html = html.replace(/<title>[^<]*<\/title>/i, `<title>${issue.newTitle.replace(/</g,'&lt;')}</title>`);
    else html = html.replace(/<\/head>/i, `<title>${issue.newTitle.replace(/</g,'&lt;')}</title>\n</head>`);
  } else if (rule === 'meta-description' && issue.newDescription) {
    const tag = `<meta name="description" content="${issue.newDescription.replace(/"/g,'&quot;')}">`;
    if (/<meta\s+name="description"[^>]*>/i.test(html)) html = html.replace(/<meta\s+name="description"[^>]*>/i, tag);
    else html = html.replace(/<\/head>/i, tag + '\n</head>');
  } else if (rule === 'canonical' && issue.canonicalUrl) {
    if (!/<link\s+rel="canonical"/i.test(html)) html = html.replace(/<\/head>/i, `<link rel="canonical" href="${issue.canonicalUrl}">\n</head>`);
  } else if (rule === 'viewport') {
    if (!/<meta\s+name="viewport"/i.test(html)) html = html.replace(/<\/head>/i, '<meta name="viewport" content="width=device-width,initial-scale=1">\n</head>');
  } else {
    return { ok: false, reason: 'This fix needs manual editing — not auto-applied' };
  }
  fs.writeFileSync(fp, html);
  return { ok: true, applied: rule };
}

module.exports = { PAGES, auditSite, applyFix };
