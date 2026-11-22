'use strict';
/**
 * Line & Logo Studio — Brand Kit Export Engine
 * ----------------------------------------------------------------
 * Deterministic, zero-dependency brand-kit bundler:
 *   - clean normalized SVG (via svg-sanitizer)
 *   - transparent PNG @1x/@2x/@4x (via svg-rasterizer + png-encoder)
 *   - favicon bundle (16/32/180/192/512 + ICO)
 *   - brand-tokens.json (colors, typography, spacing, logo usage)
 *   - single .zip bundle (deterministic bytes via zip-writer)
 *
 * Everything is pure function of (project, svg, options) — no clock,
 * no randomness — so re-exports of unchanged inputs are byte-identical
 * and cache-friendly.
 */

const { sanitizeSvg } = require('./svg-sanitizer');
const { renderSvgToPng } = require('./svg-rasterizer');
const { buildZip } = require('./zip-writer');

const SIZES = Object.freeze([1, 2, 4]);

/* ------------------------------------------------------------------ */
/* brand-tokens.json                                                   */
/* ------------------------------------------------------------------ */

function buildBrandTokens(project, svg, palette) {
  const tokens = {
    $schema: 'https://lineandlogosteam.kimi.com/schemas/brand-tokens@v1',
    name: project.name,
    version: project.version || 1,
    generatedWith: 'line-and-logo-studio/1.0.0',
    color: {},
    typography: {},
    logo: {
      clearSpace: Math.round(project.clearSpace || 24),
      minSize: { width: 24, height: 24 },
      formats: ['svg', 'png@1x', 'png@2x', 'png@4x', 'ico', 'favicon-png'],
    },
    layout: { grid: 8, artboard: project.artboard || { width: 240, height: 240 } },
  };

  for (const p of palette || []) {
    tokens.color[p.role] = {
      value: p.hex,
      rgb: hexToRgbTriple(p.hex),
      usage: p.usage || '',
    };
  }

  if (project.typography) {
    for (const [role, t] of Object.entries(project.typography)) {
      tokens.typography[role] = {
        family: t.family,
        weight: t.weight || 400,
        tracking: t.tracking || 0,
        source: t.source || 'google-fonts',
      };
    }
  }
  return tokens;
}

function hexToRgbTriple(hex) {
  const m = String(hex).replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/* ------------------------------------------------------------------ */
/* ICO writer (PNG-embedded ICO, valid for favicon.ico)                */
/* ------------------------------------------------------------------ */

function buildIco(pngBuffers) {
  // ICO header: reserved(2) type(2)=1 count(2)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngBuffers.length, 4);

  const entries = [];
  let offset = 6 + 16 * pngBuffers.length;
  for (const png of pngBuffers) {
    // parse PNG dims from IHDR
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const e = Buffer.alloc(16);
    e.writeUInt8(w >= 256 ? 0 : w, 0);
    e.writeUInt8(h >= 256 ? 0 : h, 1);
    e.writeUInt8(0, 2);  // color palette
    e.writeUInt8(0, 3);  // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

/* ------------------------------------------------------------------ */
/* main export                                                         */
/* ------------------------------------------------------------------ */

/**
 * Build a complete brand kit for one logo SVG.
 *
 * @param {object} input
 * @param {string} input.name        project/brand name (kebab-cased for filenames)
 * @param {string} input.svg         raw SVG string (will be sanitized)
 * @param {Array}  [input.palette]   [{role, hex, usage}]
 * @param {object} [input.typography] {primary:{family,weight,...}, ...}
 * @param {object} [input.artboard]  {width, height}
 * @param {number} [input.baseSize]  base export edge in px (default 512)
 * @param {boolean}[input.zip]       return zip bundle (default true)
 * @returns {object} { svg, pngs: { '1x': Buffer, ... }, favicon: {...},
 *                     tokens: object, files: [{name, data}], zip: Buffer }
 */
function exportBrandKit(input) {
  if (!input || typeof input.svg !== 'string') {
    throw new Error('exportBrandKit: input.svg is required');
  }
  const baseSize = input.baseSize || 512;
  if (!Number.isInteger(baseSize) || baseSize < 16 || baseSize > 8192) {
    throw new Error('exportBrandKit: baseSize must be an integer 16..8192');
  }

  // 1. sanitize + normalize
  const clean = sanitizeSvg(input.svg);
  if (!clean.ok) {
    const e = new Error(clean.error.message);
    e.code = clean.error.code;
    e.details = clean;
    throw e;
  }
  const svg = clean.svg;

  // 2. derive square-ish canvas from viewBox
  const vbMatch = svg.match(/viewBox="([^"]+)"/);
  let vw = 1, vh = 1;
  if (vbMatch) {
    const p = vbMatch[1].split(/[\s,]+/).map(Number);
    vw = p[2] || 1; vh = p[3] || 1;
  }
  const scaleTo = (edge) => {
    const s = edge / Math.max(vw, vh);
    return [Math.max(1, Math.round(vw * s)), Math.max(1, Math.round(vh * s))];
  };

  // 3. PNGs
  const pngs = {};
  for (const m of SIZES) {
    const [w, h] = scaleTo(baseSize * m);
    pngs[`${m}x`] = renderSvgToPng(svg, w, h, { background: null });
  }

  // 4. favicon set
  const faviconSizes = [16, 32, 180, 192, 512];
  const faviconPngs = faviconSizes.map((s) => {
    const [w, h] = scaleTo(s);
    return { size: s, png: renderSvgToPng(svg, w, h, { background: null }) };
  });
  const ico = buildIco(faviconPngs.filter((f) => f.size <= 64).map((f) => f.png));

  // 5. tokens
  const tokens = buildBrandTokens(
    { name: input.name || 'brand', version: input.version, typography: input.typography,
      artboard: input.artboard, clearSpace: input.clearSpace },
    svg, input.palette || []
  );

  // 6. file manifest
  const slug = slugify(input.name || 'brand');
  const files = [
    { name: `${slug}/logo.svg`, data: svg },
    ...SIZES.map((m) => ({ name: `${slug}/png/logo@${m}x.png`, data: pngs[`${m}x`] })),
    { name: `${slug}/favicon.ico`, data: ico },
    ...faviconPngs.map((f) => ({ name: `${slug}/favicon-${f.size}.png`, data: f.png })),
    { name: `${slug}/brand-tokens.json`, data: Buffer.from(JSON.stringify(tokens, null, 2), 'utf8') },
    { name: `${slug}/README.txt`, data: Buffer.from(readmeText(slug), 'utf8') },
  ];

  const zip = buildZip(files);

  return {
    svg,
    pngs,
    favicon: { ico, pngs: faviconPngs },
    tokens,
    files,
    zip,
    stats: {
      svgBytes: Buffer.byteLength(svg),
      zipBytes: zip.length,
      sanitizedDropped: clean.dropped.length,
      viewBox: clean.stats.viewBox,
    },
  };
}

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'brand';
}

function readmeText(slug) {
  return [
    `${slug} — Brand Kit (generated by Line & Logo Studio)`,
    '',
    'Contents:',
    `  ${slug}/logo.svg          Clean, sanitized master vector`,
    `  ${slug}/png/logo@1x.png   ${''}Raster export, 1x`,
    `  ${slug}/png/logo@2x.png   Raster export, 2x`,
    `  ${slug}/png/logo@4x.png   Raster export, 4x`,
    `  ${slug}/favicon.ico       Multi-resolution ICO (16/32)`,
    `  ${slug}/favicon-*.png     PNG favicons (16/32/180/192/512)`,
    `  ${slug}/brand-tokens.json Design tokens (colors, type, layout)`,
    '',
    'Usage notes:',
    '- Always scale from the SVG master; PNGs are convenience exports.',
    '- Preserve clear space equal to the logo mark height on all sides.',
    '- Do not recolor outside the approved palette in brand-tokens.json.',
    '',
  ].join('\n');
}

module.exports = { exportBrandKit, buildBrandTokens, buildIco, SIZES };
