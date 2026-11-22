'use strict';
/**
 * Tests: svg-sanitizer.js — security + normalization
 * Run: node --test studio/tests/sanitizer.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeSvg, sanitizeSvgOrThrow } = require('../svg-sanitizer');

const CLEAN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#3366ff"/></svg>';

test('passes a clean svg through unchanged semantically', () => {
  const r = sanitizeSvg(CLEAN);
  assert.equal(r.ok, true);
  assert.match(r.svg, /<circle/);
  assert.match(r.svg, /viewBox="0 0 100 100"/);
  assert.equal(r.dropped.length, 0);
});

test('strips <script> with subtree', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><script>alert(1)</script><rect width="5" height="5"/></svg>');
  assert.equal(r.ok, true);
  assert.ok(!r.svg.includes('script'));
  assert.ok(r.dropped.some((d) => d.reason === 'script-element'));
  assert.match(r.svg, /<rect/);
});

test('strips event handler attributes', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5" onload="alert(1)" onclick="x()"/></svg>');
  assert.equal(r.ok, true);
  assert.ok(!r.svg.includes('onload'));
  assert.ok(!r.svg.includes('onclick'));
});

test('strips javascript: href', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><a href="javascript:alert(1)"><rect width="5" height="5"/></a></svg>');
  assert.equal(r.ok, true);
  assert.ok(!r.svg.includes('javascript:'));
});

test('strips foreignObject', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>x()</script></body></foreignObject></svg>');
  assert.equal(r.ok, true);
  assert.ok(!r.svg.toLowerCase().includes('foreignobject'));
  assert.ok(r.dropped.some((d) => d.reason === 'foreignobject-embedding'));
});

test('rejects DOCTYPE / entity declarations (XXE, billion laughs)', () => {
  const r = sanitizeSvg('<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg viewBox="0 0 10 10"><text>&xxe;</text></svg>');
  assert.equal(r.ok, false);
  assert.ok(['DOCTYPE_FORBIDDEN', 'ENTITY_DECLARATION_FORBIDDEN'].includes(r.error.code));
});

test('rejects oversized input', () => {
  const big = '<svg viewBox="0 0 10 10">' + '<rect width="1" height="1"/>'.repeat(200000) + '</svg>';
  const r = sanitizeSvg(big);
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'INPUT_TOO_LARGE');
});

test('rejects malformed unescaped markup', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5"></svg> stray < text');
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'MALFORMED_XML');
});

test('normalizes viewBox number formatting', () => {
  const r = sanitizeSvg('<svg viewBox="0.0000 0.5000 100.0000 100.1234567"><rect width="5" height="5"/></svg>');
  assert.equal(r.ok, true);
  assert.match(r.svg, /viewBox="0 0.5 100 100.123"/);
});

test('synthesizes viewBox from width/height when missing', () => {
  const r = sanitizeSvg('<svg width="240" height="240"><rect width="5" height="5"/></svg>');
  assert.equal(r.ok, true);
  assert.match(r.svg, /viewBox="0 0 240 240"/);
});

test('strips px from root width/height', () => {
  const r = sanitizeSvg('<svg width="240px" height="240px" viewBox="0 0 240 240"><rect width="5" height="5"/></svg>');
  assert.equal(r.ok, true);
  assert.match(r.svg, /width="240"/);
});

test('blocks <style> raw css blocks', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><style>rect { fill: red; }</style><rect width="5" height="5"/></svg>');
  assert.equal(r.ok, true);
  assert.ok(!r.svg.includes('<style'));
});

test('sanitizes inline style attributes (blocks expression/url)', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5" style="fill:red;behavior:url(x.htc);width:expression(alert(1))"/></svg>');
  assert.equal(r.ok, true);
  assert.match(r.svg, /fill:red/);
  assert.ok(!r.svg.includes('expression'));
  assert.ok(!r.svg.includes('behavior'));
});

test('blocks unsafe url() in fill', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5" fill="url(https://evil.example/x.svg#p)"/></svg>');
  assert.equal(r.ok, true);
  assert.ok(!r.svg.includes('evil.example'));
});

test('allows same-document fragment url() in fill', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect width="5" height="5" fill="url(#g)"/></svg>');
  assert.equal(r.ok, true);
  assert.match(r.svg, /fill="url\(#g\)"/);
});

test('validates path data alphabet', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><path d="M0 0 L10 10"/><path d="M0 0 inject"/></svg>');
  assert.equal(r.ok, true);
  assert.match(r.svg, /d="M0 0 L10 10"/);
  assert.ok(!r.svg.includes('inject'));
});

test('sanitizeSvgOrThrow throws with code on hard failures', () => {
  assert.throws(() => sanitizeSvgOrThrow('<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg> trailing junk'), /text outside root/);
  assert.throws(() => sanitizeSvgOrThrow('<svg viewBox="0 0 10 10">' + '<g>'.repeat(300) + '</g>'.repeat(300) + '</svg>'), /nesting depth limit/);
});

test('preserves gradients, groups, transforms', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 100 100"><defs><radialGradient id="rg" cx="0.5" cy="0.5"><stop offset="0" stop-color="#fff" stop-opacity="1"/></radialGradient></defs><g transform="translate(10 10) rotate(45)"><ellipse cx="50" cy="50" rx="20" ry="10" fill="url(#rg)"/></g></svg>');
  assert.equal(r.ok, true);
  assert.match(r.svg, /radialGradient/);
  assert.match(r.svg, /transform="translate\(10 10\) rotate\(45\)"/);
});

test('drops unknown tags with audit entry', () => {
  const r = sanitizeSvg('<svg viewBox="0 0 10 10"><blink><rect width="5" height="5"/></blink></svg>');
  assert.equal(r.ok, true);
  assert.ok(r.dropped.some((d) => d.tag === 'blink'));
});

test('enforces nesting depth limit', () => {
  const many = '<svg viewBox="0 0 10 10">' + '<g>'.repeat(300) + '</g>'.repeat(300) + '</svg>';
  const r = sanitizeSvg(many);
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'DEPTH_LIMIT_EXCEEDED');
});
