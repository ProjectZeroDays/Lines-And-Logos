/* Lines & Logos — Integrations & Plugins registry.
 * Admins add integrations from the dashboard; agents use them to push
 * bugs/recommended changes and to ship app updates. Zero-dependency —
 * GitHub adapter uses the built-in fetch (Node 18+).
 *
 * Registry pattern: each integration declares its config fields and
 * capabilities; agents call INTEGRATIONS[key].run(action, payload, config).
 */
'use strict';

if (typeof fetch === 'undefined') {
  // Node 18+ ships global fetch; give a clear error otherwise.
  global.fetch = (...a) => import('node:https').then(() => Promise.reject(new Error('Node 18+ required for integrations')));
}

/* ------------------------------ helpers ------------------------------ */
async function gh(pathname, token, opts = {}) {
  const r = await fetch('https://api.github.com' + pathname, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'lines-and-logos-os',
      ...(opts.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${body.message || r.statusText}`);
  return body;
}
async function postJSON(url, payload, headers = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload || {}) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`POST ${url} → ${r.status}`);
  return body;
}

/* ------------------------------ registry ------------------------------ */
const INTEGRATIONS = {
  github: {
    key: 'github', name: 'GitHub',
    blurb: 'Agents push bugs and recommended changes as issues; open PRs; tag releases to trigger app updates.',
    fields: [
      { key: 'token', label: 'Personal access token (repo scope)', secret: true, required: true },
      { key: 'owner', label: 'Repository owner', required: true },
      { key: 'repo', label: 'Repository name', required: true },
      { key: 'branch', label: 'Default branch', default: 'main' },
    ],
    capabilities: ['push-bug', 'push-change', 'open-pr', 'release'],
    async test(cfg) {
      const me = await gh('/user', cfg.token);
      const repo = await gh(`/repos/${cfg.owner}/${cfg.repo}`, cfg.token);
      return { ok: true, detail: `Connected as @${me.login} → ${repo.full_name} (★${repo.stargazers_count})` };
    },
    async run(action, payload, cfg, ctx) {
      const repo = `${cfg.owner}/${cfg.repo}`;
      const base = { owner: cfg.owner, repo: cfg.repo };
      const body = (payload.body || '') + '\n\n— filed automatically by Lines & Logos OS';
      if (action === 'push-bug') {
        const issue = await gh(`/repos/${repo}/issues`, cfg.token, { method: 'POST', body: JSON.stringify({
          title: `[bug] ${payload.title}`, body, labels: ['bug', 'agent-filed'] }) });
        return { ok: true, url: issue.html_url, id: issue.number };
      }
      if (action === 'push-change') {
        const issue = await gh(`/repos/${repo}/issues`, cfg.token, { method: 'POST', body: JSON.stringify({
          title: `[agent] ${payload.title}`, body, labels: ['enhancement', 'agent-filed'] }) });
        return { ok: true, url: issue.html_url, id: issue.number };
      }
      if (action === 'open-pr') {
        const head = `${cfg.owner}:${payload.branch}`;
        const pr = await gh(`/repos/${repo}/pulls`, cfg.token, { method: 'POST', body: JSON.stringify({
          title: payload.title, head, base: cfg.branch || 'main', body }) });
        return { ok: true, url: pr.html_url, id: pr.number };
      }
      if (action === 'release') {
        const rel = await gh(`/repos/${repo}/releases`, cfg.token, { method: 'POST', body: JSON.stringify({
          tag_name: payload.tag, name: payload.name || payload.tag, body: payload.body || '' }) });
        return { ok: true, url: rel.html_url, id: rel.id };
      }
      throw new Error(`GitHub adapter: unknown action '${action}'`);
    },
  },

  slack: {
    key: 'slack', name: 'Slack',
    blurb: 'Route agent notifications and security disclosures to a channel.',
    fields: [{ key: 'webhook', label: 'Incoming webhook URL', secret: true, required: true }],
    capabilities: ['notify'],
    async test(cfg) { await postJSON(cfg.webhook, { text: 'Lines & Logos OS — integration test OK' }); return { ok: true, detail: 'Webhook accepted the test message' }; },
    async run(action, payload, cfg) {
      if (action !== 'notify') throw new Error(`Slack adapter: unknown action '${action}'`);
      await postJSON(cfg.webhook, { text: payload.text || '(empty)' });
      return { ok: true };
    },
  },

  webhook: {
    key: 'webhook', name: 'Custom Webhook',
    blurb: 'POST any agent event to your own endpoint — wire the OS into Zapier/Make/n8n.',
    fields: [{ key: 'url', label: 'Endpoint URL', required: true }, { key: 'secret', label: 'Shared secret (sent as X-LL-Secret)', secret: true }],
    capabilities: ['notify'],
    async test(cfg) {
      if (!/^https?:\/\//.test(cfg.url)) throw new Error('URL must start with http(s)://');
      return { ok: true, detail: 'URL format valid' };
    },
    async run(action, payload, cfg) {
      const headers = cfg.secret ? { 'X-LL-Secret': cfg.secret } : {};
      await postJSON(cfg.url, { event: action, payload, at: new Date().toISOString() }, headers);
      return { ok: true };
    },
  },
};

/* ------------------------------ manager ------------------------------ */
function listConfigured(db) {
  const cfgs = (db.settings.integrations) || {};
  return Object.keys(INTEGRATIONS).map(k => ({
    key: k, name: INTEGRATIONS[k].name, blurb: INTEGRATIONS[k].blurb,
    configured: !!cfgs[k], capabilities: INTEGRATIONS[k].capabilities,
    fields: INTEGRATIONS[k].fields.map(f => ({ key: f.key, label: f.label, required: !!f.required, secret: !!f.secret })),
  }));
}
function getConfig(db, key) { return ((db.settings.integrations) || {})[key] || null; }

function setConfig(db, key, cfg) {
  db.settings.integrations = db.settings.integrations || {};
  const def = INTEGRATIONS[key]; if (!def) throw new Error('Unknown integration: ' + key);
  for (const f of def.fields) if (f.required && !cfg[f.key]) throw new Error(`Missing required field: ${f.label}`);
  const prev = db.settings.integrations[key] || {};
  const merged = {};
  for (const f of def.fields) merged[f.key] = (cfg[f.key] === '' || cfg[f.key] == null) ? (f.secret ? (prev[f.key] || '') : (cfg[f.key] ?? def.fields.find(x => x.key === f.key).default ?? '')) : cfg[f.key];
  db.settings.integrations[key] = merged;
  return merged;
}

async function test(db, key) {
  const cfg = getConfig(db, key); if (!cfg) throw new Error(key + ' is not configured');
  return INTEGRATIONS[key].test(cfg);
}

/* dispatch an agent action to a configured integration; failures are
 * non-fatal (logged) so agents never crash on a missing/broken integration */
async function dispatch(db, key, action, payload, ctx) {
  const cfg = getConfig(db, key);
  if (!cfg) return { ok: false, skipped: true, reason: key + ' not configured' };
  try {
    const out = await INTEGRATIONS[key].run(action, payload, cfg, ctx);
    ctx.logActivity(`Integration ${key}.${action} → ${out.url || 'ok'}`);
    return { ok: true, ...out };
  } catch (e) {
    ctx.logActivity(`Integration ${key}.${action} FAILED: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

module.exports = { INTEGRATIONS, listConfigured, getConfig, setConfig, test, dispatch };
