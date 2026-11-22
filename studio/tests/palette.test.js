'use strict';
/**
 * Tests: palette-font-engine.js
 * Run: node --test studio/tests/palette.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePalette, suggestFontPairing, contrastRatio, hslToHex, hexToHsl, HARMONIES } = require('../palette-font-engine');

test('palette generation is deterministic per seed', () => {
  const a = generatePalette('acme-brand');
  const b = generatePalette('acme-brand');
  assert.deepEqual(a, b);
});

test('different seeds produce different palettes (overwhelmingly likely)', () => {
  const a = generatePalette('seed-one');
  const b = generatePalette('seed-two');
  assert.notEqual(a.colors[0].hex, b.colors[0].hex);
});

test('all harmonies are reachable and valid', () => {
  for (const h of HARMONIES) {
    const p = generatePalette('test', { harmony: h, baseHue: 200 });
    assert.equal(p.harmony, h);
    assert.equal(p.colors.length, 7);
    for (const c of p.colors) assert.match(c.hex, /^#[0-9a-f]{6}$/);
  }
});

test('hex <-> hsl roundtrip is stable', () => {
  const hex = hslToHex(210, 70, 50);
  const hsl = hexToHsl(hex);
  assert.equal(Math.round(hsl.h), 210);
  assert.equal(Math.round(hsl.s), 70);
  assert.equal(Math.round(hsl.l), 50);
});

test('contrast ratio: black on white = 21', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
});

test('contrast ratio: identical colors = 1', () => {
  assert.equal(contrastRatio('#3366ff', '#3366ff'), 1);
});

test('palette reports accessibility with AA flag', () => {
  const p = generatePalette('accessible-test');
  assert.ok(p.accessibility.primaryOnSurface > 1);
  assert.ok(p.accessibility.onSurfaceOnSurface > 1);
  assert.equal(typeof p.accessibility.wcagAA, 'boolean');
});

test('font pairing is deterministic per seed', () => {
  const a = suggestFontPairing('acme');
  const b = suggestFontPairing('acme');
  assert.deepEqual(a, b);
});

test('font pairing tone filter works', () => {
  const p = suggestFontPairing('x', 'luxury');
  assert.ok(p.tone.includes('luxury') || p.tags.some((t) => ['luxury', 'fashion', 'editorial'].includes(t)));
});

test('font pairing returns google fonts url', () => {
  const p = suggestFontPairing('acme');
  assert.match(p.googleFontsUrl, /^https:\/\/fonts\.googleapis\.com\/css2\?family=/);
});
