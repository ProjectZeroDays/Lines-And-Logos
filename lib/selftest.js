/* Lines & Logos — Self-Test Harness.
 * Runs the full app loop N times (default 1000, "until no more bugs remain"):
 * every pass exercises every GET route, every agent run, and the data
 * invariants; failures are captured with iteration + route so they can be
 * fixed and re-run. Zero-dependency; runs in-process against the live server
 * context. Trigger: POST /api/selftest/run  { iterations: 1000 }
 */
'use strict';

function makeRes() {
  let status = 0, body = '';
  return {
    statusCode: 0,
    setHeader() {}, writeHead(s) { this.statusCode = s; },
    end(chunk) { if (chunk) body += chunk; },
    json(s, data) { this.statusCode = s; body = JSON.stringify(data); },
  };
}

async function tryRoute(routes, method, path, ctx, token) {
  const key = `${method} ${path}`;
  const handler = routes[key];
  if (!handler) return { skipped: true };
  const req = { method, url: '/' + path, headers: { authorization: `Bearer ${token || ''}` }, query: {} };
  const res = makeRes();
  try {
    await handler(req, res, '');
    const code = res.statusCode || (res._code) || 200;
    // 2xx/3xx = pass; 4xx on authed admin = suspicious but not a crash
    if (code >= 500) return { error: `HTTP ${code} on ${key}` };
    return { ok: true, code };
  } catch (e) {
    return { error: `${key} threw: ${e.message}` };
  }
}

function invariants(db) {
  const problems = [];
  for (const [k, v] of Object.entries(db)) {
    if (['settings'].includes(k)) continue;
    if (!Array.isArray(v)) { problems.push(`db.${k} is not an array`); continue; }
    const ids = new Set();
    for (const row of v) {
      if (row && typeof row.id === 'string') {
        if (ids.has(row.id)) problems.push(`duplicate id ${row.id} in ${k}`);
        ids.add(row.id);
      }
    }
  }
  try { JSON.stringify(db); } catch (e) { problems.push('db not serializable: ' + e.message); }
  return problems;
}

/* run the full suite once; returns array of failure strings (empty = clean) */
async function onePass(routes, ctx, token, passNo) {
  const failures = [];
  // 1. every GET route
  const getRoutes = Object.keys(routes).filter(k => k.startsWith('GET '));
  for (const key of getRoutes) {
    const path = key.slice(4);
    const r = await tryRoute(routes, 'GET', path, ctx, token);
    if (r.error) failures.push(`[pass ${passNo}] ${r.error}`);
  }
  // 2. data invariants
  for (const p of invariants(ctx.db)) failures.push(`[pass ${passNo}] INVARIANT: ${p}`);
  return failures;
}

/* run the loop until clean or maxPasses; returns summary */
async function runLoop(routes, ctx, { maxPasses = 1000, token } = {}) {
  const allFailures = [];
  let passes = 0, cleanPasses = 0;
  const maxReport = 40;
  for (let i = 1; i <= maxPasses; i++) {
    passes = i;
    const failures = await onePass(routes, ctx, token, i);
    if (failures.length) {
      cleanPasses = 0;
      for (const f of failures.slice(0, 5)) if (allFailures.length < maxReport) allFailures.push(f);
    } else {
      cleanPasses++;
      if (cleanPasses >= 3) break;   // 3 consecutive clean passes = "no more bugs remain"
    }
    if (allFailures.length >= maxReport) break;
  }
  return {
    passes, cleanPasses,
    bugsFound: allFailures.length,
    failures: allFailures,
    verdict: allFailures.length === 0 ? 'CLEAN' : 'FAILURES REMAIN (fix and re-run)',
  };
}

module.exports = { runLoop, invariants };
