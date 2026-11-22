'use strict';
/**
 * Tests: brand-kit-export.js + zip-writer.js + png-encoder.js + rasterizer
 * Run: node --test studio/tests/export.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { exportBrandKit } = require('../brand-kit-export');
const { buildZip } = require('../zip-writer');
const { encodePng } = require('../png-encoder');
const { renderSvgToPng } = require('../svg-rasterizer');

const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">' +
  '<rect x="20" y="20" width="200" height="200" rx="24" fill="#3366ff"/>' +
  '<circle cx="120" cy="120" r="60" fill="#ffffff"/>' +
  '<path d="M90 120 L110 140 L150 100" stroke="#3366ff" stroke-width="12" fill="none" stroke-linecap="round"/>' +
  '</svg>';

test('exportBrandKit produces all expected artifacts', () => {
  const kit = exportBrandKit({
    name: 'Acme Corp',
    svg: LOGO,
    palette: [{ role: 'primary', hex: '#3366ff', usage: 'main' }],
    typography: { primary: { family: 'Inter', weight: 400 } },
  });
  assert.ok(kit.svg.includes('<svg'));
  assert.ok(kit.pngs['1x'] && kit.pngs['2x'] && kit.pngs['4x']);
  assert.ok(kit.favicon.ico.length > 0);
  assert.equal(kit.favicon.pngs.length, 5);
  assert.equal(kit.tokens.color.primary.value, '#3366ff');
  assert.equal(kit.tokens.typography.primary.family, 'Inter');
  assert.ok(kit.zip.length > 100);
  const names = kit.files.map((f) => f.name);
  assert.ok(names.includes('acme-corp/logo.svg'));
  assert.ok(names.includes('acme-corp/png/logo@1x.png'));
  assert.ok(names.includes('acme-corp/brand-tokens.json'));
  assert.ok(names.includes('acme-corp/favicon.ico'));
});

test('export is deterministic (byte-identical zip for identical input)', () => {
  const opts = { name: 'Acme', svg: LOGO };
  const a = exportBrandKit(opts);
  const b = exportBrandKit(opts);
  assert.deepEqual(a.zip, b.zip);
  assert.deepEqual(a.pngs['2x'], b.pngs['2x']);
});

test('export sanitizes malicious svg input (script stripped, export succeeds)', () => {
  const kit = exportBrandKit({
    name: 'Bad',
    svg: '<svg viewBox="0 0 10 10"><script>alert(1)</script><rect width="5" height="5" fill="#f00"/></svg>',
  });
  assert.ok(!kit.svg.includes('script'));
  assert.match(kit.svg, /<rect/);
});

test('export validates baseSize bounds', () => {
  assert.throws(() => exportBrandKit({ name: 'X', svg: LOGO, baseSize: 2 }), /baseSize/);
  assert.throws(() => exportBrandKit({ name: 'X', svg: LOGO, baseSize: 99999 }), /baseSize/);
});

test('PNG output has valid signature and IHDR dims', () => {
  const png = renderSvgToPng(LOGO, 128, 128);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) assert.equal(png[i], sig[i]);
  // IHDR chunk: length(4)@8, type(4)@12, data starts @16
  assert.equal(png.readUInt32BE(8), 13);          // IHDR length
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 128);        // width
  assert.equal(png.readUInt32BE(20), 128);        // height
  assert.equal(png[24], 8);                       // bit depth
  assert.equal(png[25], 6);                       // color type RGBA
});

test('rasterizer renders expected pixel colors', () => {
  // 100x100 svg: red rect covering full canvas
  const svg = '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#ff0000"/></svg>';
  const { renderSvgToRgba } = require('../svg-rasterizer');
  const px = renderSvgToRgba(svg, 50, 50);
  const idx = (25 * 50 + 25) * 4;
  assert.equal(px[idx], 255);
  assert.equal(px[idx + 1], 0);
  assert.equal(px[idx + 2], 0);
  assert.equal(px[idx + 3], 255);
});

test('rasterizer renders circle with transparent corners', () => {
  const svg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#0000ff"/></svg>';
  const { renderSvgToRgba } = require('../svg-rasterizer');
  const px = renderSvgToRgba(svg, 100, 100);
  const center = (50 * 100 + 50) * 4;
  const corner = (2 * 100 + 2) * 4;
  assert.equal(px[center + 2], 255);   // center blue
  assert.equal(px[corner + 3], 0);   // corner transparent
});

test('rasterizer honors transforms', () => {
  const svg = '<svg viewBox="0 0 100 100"><g transform="translate(50 0)"><rect width="50" height="100" fill="#00ff00"/></g></svg>';
  const { renderSvgToRgba } = require('../svg-rasterizer');
  const px = renderSvgToRgba(svg, 100, 100);
  const left = (50 * 100 + 10) * 4;
  const right = (50 * 100 + 90) * 4;
  assert.equal(px[left + 3], 0);       // left side transparent
  assert.equal(px[right + 1], 255);  // right side green
});

test('buildZip creates valid archive structure', () => {
  const zip = buildZip([
    { name: 'a.txt', data: 'hello' },
    { name: 'dir/b.txt', data: Buffer.from('world') },
  ]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50); // local file header sig
  // find EOCD
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd > 0);
  assert.equal(zip.readUInt16LE(eocd + 10), 2); // entry count
});

test('buildZip rejects path traversal names', () => {
  assert.throws(() => buildZip([{ name: '../evil.txt', data: 'x' }]), /unsafe/);
  assert.throws(() => buildZip([{ name: '/abs.txt', data: 'x' }]), /unsafe/);
  assert.throws(() => buildZip([{ name: 'a\\b.txt', data: 'x' }]), /unsafe/);
  assert.throws(() => buildZip([{ name: 'dup.txt', data: 'x' }, { name: 'dup.txt', data: 'y' }]), /duplicate/);
});

test('encodePng validates dimensions and buffer size', () => {
  assert.throws(() => encodePng(0, 10, new Uint8Array(0)), /dimensions/);
  assert.throws(() => encodePng(10, 10, new Uint8Array(10)), /expected/);
});
