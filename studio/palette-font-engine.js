'use strict';
/**
 * Line & Logo Studio — Palette & Font Pairing Engine
 * ----------------------------------------------------------------
 * Deterministic generators (seeded PRNG) for:
 *   - harmonious color palettes (complementary, analogous, triadic,
 *     split-complementary, monochrome) with WCAG contrast pairing
 *   - Google Font pairings (display + text) filtered by brand tone
 *   - naming + role assignment (primary, secondary, accent, neutral,
 *     surface, on-surface)
 * Zero network calls — all pairings are curated static data.
 */

/* Seeded PRNG (mulberry32) — deterministic per seed string */
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- color math ---------------- */

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
function hexToHsl(hex) {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: ((h % 360) + 360) % 360, s: s * 100, l: l * 100 };
}
function relativeLuminance(hex) {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const f = (i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4);
}
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1), l2 = relativeLuminance(hex2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------------- palettes ---------------- */

const HARMONIES = ['complementary', 'analogous', 'triadic', 'split-complementary', 'monochrome'];

function generatePalette(seed, options = {}) {
  const rand = mulberry32(hashSeed(String(seed)));
  const harmony = options.harmony && HARMONIES.includes(options.harmony)
    ? options.harmony
    : HARMONIES[Math.floor(rand() * HARMONIES.length)];
  const baseHue = options.baseHue !== undefined ? options.baseHue : Math.floor(rand() * 360);
  const baseSat = 55 + Math.floor(rand() * 30); // 55–85%
  const baseLight = 45 + Math.floor(rand() * 15); // 45–60%

  const hues = [baseHue];
  switch (harmony) {
    case 'complementary': hues.push((baseHue + 180) % 360); break;
    case 'analogous': hues.push((baseHue + 30) % 360, (baseHue + 330) % 360); break;
    case 'triadic': hues.push((baseHue + 120) % 360, (baseHue + 240) % 360); break;
    case 'split-complementary': hues.push((baseHue + 150) % 360, (baseHue + 210) % 360); break;
    case 'monochrome': hues.push(baseHue, baseHue); break;
  }

  const primary = hslToHex(hues[0], baseSat, baseLight);
  const secondary = hslToHex(hues[1 % hues.length], baseSat, Math.min(90, baseLight + 12));
  const accent = hslToHex(hues[2 % hues.length], Math.min(95, baseSat + 10), Math.max(30, baseLight - 8));

  const neutralL = 12 + Math.floor(rand() * 8);
  const surfaceL = 96 + Math.floor(rand() * 4);
  const neutral = hslToHex(hues[0], 8 + Math.floor(rand() * 10), neutralL);
  const surface = hslToHex(hues[0], 6, surfaceL);

  // pick text-on-primary from neutral/surface by contrast
  const onPrimary = contrastRatio(primary, surface) >= contrastRatio(primary, neutral) ? surface : neutral;
  const onSurface = contrastRatio(surface, neutral) >= 4.5 ? neutral : hslToHex(hues[0], 10, 25);

  return {
    harmony,
    baseHue,
    colors: [
      { role: 'primary', hex: primary, usage: 'Primary brand color — logo mark, key actions' },
      { role: 'secondary', hex: secondary, usage: 'Secondary brand color — supporting elements' },
      { role: 'accent', hex: accent, usage: 'Accent — highlights, CTAs, badges' },
      { role: 'neutral', hex: neutral, usage: 'Neutral dark — text, dark surfaces' },
      { role: 'surface', hex: surface, usage: 'Surface light — backgrounds, cards' },
      { role: 'on-primary', hex: onPrimary, usage: 'Text/icons on primary color' },
      { role: 'on-surface', hex: onSurface, usage: 'Text/icons on surface color' },
    ],
    accessibility: {
      primaryOnSurface: round2(contrastRatio(primary, surface)),
      onPrimaryOnPrimary: round2(contrastRatio(onPrimary, primary)),
      onSurfaceOnSurface: round2(contrastRatio(onSurface, surface)),
      wcagAA: contrastRatio(primary, surface) >= 4.5 && contrastRatio(onSurface, surface) >= 4.5,
    },
  };
}
function round2(v) { return Math.round(v * 100) / 100; }

/* ---------------- font pairings ---------------- */

const FONT_PAIRS = [
  { tone: 'modern-tech', display: { family: 'Space Grotesk', weight: 700 }, text: { family: 'Inter', weight: 400 }, tags: ['tech', 'startup', 'saas'] },
  { tone: 'editorial-luxury', display: { family: 'Playfair Display', weight: 700 }, text: { family: 'Source Sans 3', weight: 400 }, tags: ['luxury', 'fashion', 'editorial'] },
  { tone: 'geometric-minimal', display: { family: 'Poppins', weight: 600 }, text: { family: 'Nunito Sans', weight: 400 }, tags: ['minimal', 'clean', 'geometric'] },
  { tone: 'industrial-bold', display: { family: 'Archivo Black', weight: 400 }, text: { family: 'Roboto', weight: 400 }, tags: ['industrial', 'bold', 'construction'] },
  { tone: 'friendly-rounded', display: { family: 'Quicksand', weight: 700 }, text: { family: 'Open Sans', weight: 400 }, tags: ['friendly', 'rounded', 'consumer'] },
  { tone: 'heritage-classic', display: { family: 'Cormorant Garamond', weight: 700 }, text: { family: 'Lato', weight: 400 }, tags: ['classic', 'heritage', 'law', 'finance'] },
  { tone: 'mono-technical', display: { family: 'JetBrains Mono', weight: 700 }, text: { family: 'IBM Plex Sans', weight: 400 }, tags: ['developer', 'technical', 'data'] },
  { tone: 'organic-handcrafted', display: { family: 'Fraunces', weight: 600 }, text: { family: 'Work Sans', weight: 400 }, tags: ['organic', 'craft', 'food'] },
];

function suggestFontPairing(seed, tone) {
  const rand = mulberry32(hashSeed(String(seed)));
  let pool = FONT_PAIRS;
  if (tone) {
    const t = String(tone).toLowerCase();
    const filtered = FONT_PAIRS.filter((p) => p.tone.includes(t) || p.tags.some((tag) => t.includes(tag) || tag.includes(t)));
    if (filtered.length > 0) pool = filtered;
  }
  const pick = pool[Math.floor(rand() * pool.length)];
  return {
    tone: pick.tone,
    display: { ...pick.display, role: 'display / wordmark' },
    text: { ...pick.text, role: 'body / supporting text' },
    googleFontsUrl: `https://fonts.googleapis.com/css2?family=${pick.display.family.replace(/ /g, '+')}:wght@${pick.display.weight}&family=${pick.text.family.replace(/ /g, '+')}:wght@${pick.text.weight}&display=swap`,
  };
}

module.exports = { generatePalette, suggestFontPairing, contrastRatio, relativeLuminance, hslToHex, hexToHsl, HARMONIES };
