#!/usr/bin/env node
/* Lines & Logos OS launcher.
 * Usage:
 *   npx lines-and-logos-os            -> starts the server on the default port
 *   npx lines-and-logos-os start --port 8080 --data /path/to/data
 *   npx lines-and-logos-os doctor     -> prints environment check
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SERVER = path.join(__dirname, '..', 'server.js');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
function hasFlag(name) { return process.argv.includes('--' + name); }

const cmd = process.argv[2] || 'start';

if (cmd === 'doctor') {
  const checks = [
    ['node', process.version, parseInt(process.version.slice(1)) >= 18],
    ['server.js', SERVER, fs.existsSync(SERVER)],
    ['writable data dir', process.cwd(), (() => { try { fs.accessSync(process.cwd(), fs.constants.W_OK); return true; } catch { return false; } })()],
    ['memory', '>= 512MB free recommended', (os.totalmem() / 1e9) >= 0.5]
  ];
  let ok = true;
  for (const [label, value, pass] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${value}`);
    if (!pass) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

if (cmd === 'start') {
  if (!fs.existsSync(SERVER)) {
    console.error('server.js not found at', SERVER);
    process.exit(1);
  }
  const args = [SERVER];
  const port = arg('port', process.env.PORT || '8080');
  const data = arg('data', process.env.LL_DATA || path.join(process.cwd(), 'data'));
  args.push('--port', String(port));
  args.push('--data', data);
  if (hasFlag('dev')) args.push('--dev');
  console.log(`Lines & Logos OS starting on http://localhost:${port} (data: ${data})`);
  const child = spawn(process.execPath, args, { stdio: 'inherit', cwd: path.dirname(SERVER) });
  child.on('exit', code => process.exit(code || 0));
} else {
  console.log('Usage: lines-and-logos [start|doctor] [--port N] [--data DIR] [--dev]');
}
