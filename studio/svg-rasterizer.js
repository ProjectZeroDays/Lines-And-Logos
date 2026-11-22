'use strict';
/**
 * Line & Logo Studio — Deterministic SVG Software Rasterizer
 * ----------------------------------------------------------------
 * Zero-dependency scanline rasterizer for the sanitized SVG subset
 * produced by svg-sanitizer.js. Supports:
 *   - shapes: path (all commands), rect, circle, ellipse, line,
 *     polygon, polyline
 *   - transforms: matrix, translate, scale, rotate, skewX/Y (nested)
 *   - fills: flat colors (hex/rgb(a)/hsl(a)/keywords/none), linear &
 *     radial gradients, evenodd/nonzero winding
 *   - strokes: flat color, width, linecap/linejoin (miter), dasharray
 *   - text: system-metric sans-serif glyphs (deterministic built-in
 *     vector stroke font — no external font files)
 *   - opacity, fill-opacity, stroke-opacity, group opacity (flattened)
 *
 * Output: RGBA pixel buffer -> feeds png-encoder.js.
 * Everything is fixed-point friendly and deterministic: no Date, no
 * Math.random, stable iteration order.
 */

const { encodePng } = require('./png-encoder');

/* ---------------- color parsing ---------------- */

const NAMED_COLORS = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0],
  blue: [0, 0, 255], yellow: [255, 255, 0], cyan: [0, 255, 255], aqua: [0, 255, 255],
  magenta: [255, 0, 255], fuchsia: [255, 0, 255], gray: [128, 128, 128],
  grey: [128, 128, 128], silver: [192, 192, 192], maroon: [128, 0, 0],
  olive: [128, 128, 0], navy: [0, 0, 128], purple: [128, 0, 128], teal: [0, 128, 128],
  lime: [0, 255, 0], orange: [255, 165, 0], indigo: [75, 0, 130],
  violet: [238, 130, 238], pink: [255, 192, 203], brown: [165, 42, 42],
  gold: [255, 215, 0], coral: [255, 127, 80], crimson: [220, 20, 60],
  salmon: [250, 128, 114], khaki: [240, 230, 140], turquoise: [64, 224, 208],
  slategray: [112, 128, 144], slateblue: [106, 90, 205], steelblue: [70, 130, 180],
  rebeccapurple: [102, 51, 153], hotpink: [255, 105, 180], skyblue: [135, 206, 235],
};

function parseColor(value, opacity = 1) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return null;
  let rgb = null;
  let m;
  if ((m = v.match(/^#([0-9a-f]{3})$/))) {
    rgb = m[1].split('').map((c) => parseInt(c + c, 16));
  } else if ((m = v.match(/^#([0-9a-f]{4})$/))) {
    rgb = m[1].split('').map((c) => parseInt(c + c, 16));
    opacity *= rgb[3] / 255; rgb = rgb.slice(0, 3);
  } else if ((m = v.match(/^#([0-9a-f]{6})$/))) {
    rgb = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  } else if ((m = v.match(/^#([0-9a-f]{8})$/))) {
    rgb = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    opacity *= parseInt(m[1].slice(6, 8), 16) / 255;
  } else if ((m = v.match(/^rgba?\(([^)]+)\)$/))) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    rgb = parts.slice(0, 3).map((p) => (p.endsWith('%') ? Math.round(parseFloat(p) * 2.55) : parseInt(p, 10)));
    if (parts[3] !== undefined) opacity *= parseFloat(parts[3]);
  } else if ((m = v.match(/^hsla?\(([^)]+)\)$/))) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    const h = parseFloat(parts[0]) % 360, s = parseFloat(parts[1]) / 100, l = parseFloat(parts[2]) / 100;
    rgb = hslToRgb(h, s, l);
    if (parts[3] !== undefined) opacity *= parseFloat(parts[3]);
  } else if (NAMED_COLORS[v]) {
    rgb = NAMED_COLORS[v];
  } else if (v === 'currentcolor') {
    return { special: 'currentColor', opacity };
  }
  if (!rgb) return null;
  return { r: clamp8(rgb[0]), g: clamp8(rgb[1]), b: clamp8(rgb[2]), a: clamp01(opacity) };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/* ---------------- matrix math (2x3 affine) ---------------- */

// [a c e; b d f; 0 0 1]
function matMul(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}
function matApply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
const IDENTITY = [1, 0, 0, 1, 0, 0];

function parseTransform(str) {
  if (!str) return IDENTITY;
  let m = IDENTITY;
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let match;
  while ((match = re.exec(str)) !== null) {
    const name = match[1];
    const args = match[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let t = IDENTITY;
    switch (name) {
      case 'matrix': t = [args[0], args[1], args[2], args[3], args[4], args[5]]; break;
      case 'translate': t = [1, 0, 0, 1, args[0] || 0, args[1] || 0]; break;
      case 'scale': t = [args[0], 0, 0, args.length > 1 ? args[1] : args[0], 0, 0]; break;
      case 'rotate': {
        const rad = (args[0] || 0) * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        if (args.length > 2) {
          t = matMul([1, 0, 0, 1, args[1], args[2]],
            matMul([cos, sin, -sin, cos, 0, 0], [1, 0, 0, 1, -args[1], -args[2]]));
        } else t = [cos, sin, -sin, cos, 0, 0];
        break;
      }
      case 'skewX': t = [1, 0, Math.tan((args[0] || 0) * Math.PI / 180), 1, 0, 0]; break;
      case 'skewY': t = [1, Math.tan((args[0] || 0) * Math.PI / 180), 0, 1, 0, 0]; break;
    }
    m = matMul(m, t);
  }
  return m;
}

/* ---------------- path parsing ---------------- */

function tokenizePath(d) {
  const tokens = [];
  const re = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1];
    const nums = (m[2].match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) || []).map(Number);
    tokens.push({ cmd, nums });
  }
  return tokens;
}

/**
 * Flatten path data to polygon subpaths (arrays of [x,y]).
 * Curves are subdivided adaptively (fixed 16 segments — deterministic).
 */
function pathToSubpaths(d) {
  const subpaths = [];
  let current = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let prevCtrl = null; // for S/T reflection
  let prevQCtrl = null;

  const flush = () => { if (current.length > 1) subpaths.push(current); current = []; };

  for (const { cmd, nums } of tokenizePath(d)) {
    let i = 0;
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    const px = () => (rel ? cx : 0);
    const py = () => (rel ? cy : 0);

    switch (up) {
      case 'M': {
        const x = nums[i++] + px(), y = nums[i++] + py();
        flush(); current = [[x, y]]; cx = x; cy = y; sx = x; sy = y;
        // subsequent implicit pairs are LineTo
        while (i + 1 < nums.length + 1 && i + 1 <= nums.length) {
          const lx = nums[i] + px(), ly = nums[i + 1] + py();
          current.push([lx, ly]); cx = lx; cy = ly; i += 2;
        }
        prevCtrl = null; prevQCtrl = null;
        break;
      }
      case 'L': {
        while (i + 1 < nums.length + 1 && i + 1 <= nums.length) {
          const x = nums[i] + px(), y = nums[i + 1] + py();
          current.push([x, y]); cx = x; cy = y; i += 2;
        }
        prevCtrl = null; prevQCtrl = null;
        break;
      }
      case 'H': {
        while (i < nums.length) {
          const x = nums[i++] + px();
          current.push([x, cy]); cx = x;
        }
        prevCtrl = null; prevQCtrl = null;
        break;
      }
      case 'V': {
        while (i < nums.length) {
          const y = nums[i++] + py();
          current.push([cx, y]); cy = y;
        }
        prevCtrl = null; prevQCtrl = null;
        break;
      }
      case 'C': {
        while (i + 5 < nums.length + 1 && i + 5 <= nums.length) {
          const x1 = nums[i] + px(), y1 = nums[i + 1] + py();
          const x2 = nums[i + 2] + px(), y2 = nums[i + 3] + py();
          const x = nums[i + 4] + px(), y = nums[i + 5] + py();
          cubicTo(current, cx, cy, x1, y1, x2, y2, x, y);
          prevCtrl = [x2, y2]; prevQCtrl = null;
          cx = x; cy = y; i += 6;
        }
        break;
      }
      case 'S': {
        while (i + 3 < nums.length + 1 && i + 3 <= nums.length) {
          const x1 = prevCtrl ? 2 * cx - prevCtrl[0] : cx;
          const y1 = prevCtrl ? 2 * cy - prevCtrl[1] : cy;
          const x2 = nums[i] + px(), y2 = nums[i + 1] + py();
          const x = nums[i + 2] + px(), y = nums[i + 3] + py();
          cubicTo(current, cx, cy, x1, y1, x2, y2, x, y);
          prevCtrl = [x2, y2]; prevQCtrl = null;
          cx = x; cy = y; i += 4;
        }
        break;
      }
      case 'Q': {
        while (i + 3 < nums.length + 1 && i + 3 <= nums.length) {
          const qx = nums[i] + px(), qy = nums[i + 1] + py();
          const x = nums[i + 2] + px(), y = nums[i + 3] + py();
          quadTo(current, cx, cy, qx, qy, x, y);
          prevQCtrl = [qx, qy]; prevCtrl = null;
          cx = x; cy = y; i += 4;
        }
        break;
      }
      case 'T': {
        while (i + 1 < nums.length + 1 && i + 1 <= nums.length) {
          const qx = prevQCtrl ? 2 * cx - prevQCtrl[0] : cx;
          const qy = prevQCtrl ? 2 * cy - prevQCtrl[1] : cy;
          const x = nums[i] + px(), y = nums[i + 1] + py();
          quadTo(current, cx, cy, qx, qy, x, y);
          prevQCtrl = [qx, qy]; prevCtrl = null;
          cx = x; cy = y; i += 2;
        }
        break;
      }
      case 'A': {
        while (i + 6 < nums.length + 1 && i + 6 <= nums.length) {
          const rx = Math.abs(nums[i]), ry = Math.abs(nums[i + 1]);
          const rot = nums[i + 2];
          const laf = nums[i + 3], sf = nums[i + 4];
          const x = nums[i + 5] + px(), y = nums[i + 6] + py();
          arcTo(current, cx, cy, rx, ry, rot, laf, sf, x, y);
          cx = x; cy = y; i += 7;
          prevCtrl = null; prevQCtrl = null;
        }
        break;
      }
      case 'Z': {
        if (current.length > 0) current.push([sx, sy]);
        flush();
        cx = sx; cy = sy;
        prevCtrl = null; prevQCtrl = null;
        break;
      }
    }
  }
  flush();
  return subpaths;
}

const CURVE_SEGMENTS = 16;
function cubicTo(pts, x0, y0, x1, y1, x2, y2, x3, y3) {
  for (let s = 1; s <= CURVE_SEGMENTS; s++) {
    const t = s / CURVE_SEGMENTS, u = 1 - t;
    pts.push([
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ]);
  }
}
function quadTo(pts, x0, y0, qx, qy, x1, y1) {
  for (let s = 1; s <= CURVE_SEGMENTS; s++) {
    const t = s / CURVE_SEGMENTS, u = 1 - t;
    pts.push([
      u * u * x0 + 2 * u * t * qx + t * t * x1,
      u * u * y0 + 2 * u * t * qy + t * t * y1,
    ]);
  }
}
function arcTo(pts, x0, y0, rx, ry, phi, laf, sf, x1, y1) {
  if (rx === 0 || ry === 0) { pts.push([x1, y1]); return; }
  const rad = phi * Math.PI / 180;
  const cosP = Math.cos(rad), sinP = Math.sin(rad);
  const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
  let x1p = cosP * dx + sinP * dy;
  let y1p = -sinP * dx + cosP * dy;
  let rxs = rx * rx, rys = ry * ry;
  const x1ps = x1p * x1p, y1ps = y1p * y1p;
  let lambda = x1ps / rxs + y1ps / rys;
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; rxs = rx * rx; rys = ry * ry; }
  let sign = laf === sf ? -1 : 1;
  let num = rxs * rys - rxs * y1ps - rys * x1ps;
  let den = rxs * y1ps + rys * x1p * x1p;
  let co = sign * Math.sqrt(Math.max(0, num / den));
  let cxp = co * (rx * y1p / ry);
  let cyp = -co * (ry * x1p / rx);
  const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
  const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;
  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const th1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (sf === 0 && dth > 0) dth -= 2 * Math.PI;
  if (sf === 1 && dth < 0) dth += 2 * Math.PI;
  const segs = Math.max(4, Math.ceil(Math.abs(dth) / (Math.PI / 16)));
  for (let s = 1; s <= segs; s++) {
    const t = th1 + dth * (s / segs);
    const x = cosP * rx * Math.cos(t) - sinP * ry * Math.sin(t) + cx;
    const y = sinP * rx * Math.cos(t) + cosP * ry * Math.sin(t) + cy;
    pts.push([x, y]);
  }
}

/* ---------------- shape -> subpaths ---------------- */

function shapeToSubpaths(node) {
  const a = (n, d) => { const at = node.attrs.find((x) => x.name === n); return at ? parseFloat(at.value) : d; };
  switch (node.tag) {
    case 'path': {
      const d = node.attrs.find((x) => x.name === 'd');
      return d ? pathToSubpaths(d.value) : [];
    }
    case 'rect': {
      const x = a('x', 0), y = a('y', 0), w = a('width', 0), h = a('height', 0);
      if (w <= 0 || h <= 0) return [];
      return [[
        [x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y],
      ]];
    }
    case 'circle': case 'ellipse': {
      const cx = a('cx', 0), cy = a('cy', 0);
      const rx = node.tag === 'circle' ? a('r', 0) : a('rx', 0);
      const ry = node.tag === 'circle' ? a('r', 0) : a('ry', 0);
      if (rx <= 0 || ry <= 0) return [];
      const pts = [];
      const N = 64;
      for (let i = 0; i <= N; i++) {
        const t = i / N * 2 * Math.PI;
        pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
      }
      return [pts];
    }
    case 'line': {
      return [[[a('x1', 0), a('y1', 0)], [a('x2', 0), a('y2', 0)]]];
    }
    case 'polygon': case 'polyline': {
      const p = node.attrs.find((x) => x.name === 'points');
      if (!p) return [];
      const nums = p.value.split(/[\s,]+/).filter(Boolean).map(Number);
      const pts = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      if (node.tag === 'polygon' && pts.length > 0) pts.push(pts[0]);
      return [pts];
    }
  }
  return [];
}

/* ---------------- scanline fill ---------------- */

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function windingNumber(x, y, poly) {
  let wn = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yj <= y) {
      if (yi > y && isLeft(xj, yj, xi, yi, x, y) > 0) wn++;
    } else {
      if (yi <= y && isLeft(xj, yj, xi, yi, x, y) < 0) wn--;
    }
  }
  return wn;
}
function isLeft(x0, y0, x1, y1, x, y) {
  return (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0);
}

/* ---------------- stroke flattening ---------------- */

function strokeSubpaths(subpaths, width, linecap) {
  // Build stroked outline polygons for each subpath (miter join, butt/round cap)
  const half = width / 2;
  const out = [];
  for (const sp of subpaths) {
    if (sp.length < 2) continue;
    const left = [], right = [];
    for (let i = 0; i < sp.length; i++) {
      const p0 = sp[Math.max(0, i - 1)];
      const p1 = sp[i];
      const p2 = sp[Math.min(sp.length - 1, i + 1)];
      let dx1 = p1[0] - p0[0], dy1 = p1[1] - p0[1];
      let dx2 = p2[0] - p1[0], dy2 = p2[1] - p1[1];
      const l1 = Math.hypot(dx1, dy1) || 1, l2 = Math.hypot(dx2, dy2) || 1;
      dx1 /= l1; dy1 /= l1; dx2 /= l2; dy2 /= l2;
      // average normal
      let nx = -(dy1 + dy2) / 2, ny = (dx1 + dx2) / 2;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      // miter limit clamp
      const dot = nx * -dy1 + ny * dx1;
      const scale = Math.min(half / Math.max(0.2, Math.abs(dot)), half * 4);
      left.push([p1[0] + nx * scale, p1[1] + ny * scale]);
      right.push([p1[0] - nx * scale, p1[1] - ny * scale]);
    }
    if (linecap === 'round' && sp.length >= 2) {
      // round caps: approximate with half-circles
      const cap = (center, dirIn, dirOut) => {
        const pts = [];
        const base = Math.atan2(dirIn[1], dirIn[0]);
        for (let s = 0; s <= 8; s++) {
          const t = base + Math.PI * (s / 8);
          pts.push([center[0] + half * Math.cos(t), center[1] + half * Math.sin(t)]);
        }
        return pts;
      };
      const d0 = [sp[1][0] - sp[0][0], sp[1][1] - sp[0][1]];
      const dl = Math.hypot(d0[0], d0[1]) || 1;
      const startCap = cap(sp[0], [d0[0] / dl, d0[1] / dl], null);
      const de = [sp[sp.length - 1][0] - sp[sp.length - 2][0], sp[sp.length - 1][1] - sp[sp.length - 2][1]];
      const dle = Math.hypot(de[0], de[1]) || 1;
      const endCap = cap(sp[sp.length - 1], [de[0] / dle, de[1] / dle], null);
      out.push([...startCap, ...left, ...endCap, ...right.slice().reverse(), startCap[0]]);
    } else {
      out.push([...left, ...right.slice().reverse(), left[0]]);
    }
  }
  return out;
}

/* ---------------- gradients ---------------- */

function buildGradient(node, defs, userSpace) {
  // returns {kind:'linear'|'radial', stops:[[offset,r,g,b,a]], ...coords in userSpaceOnUse or bbox}
  const stops = [];
  for (const c of node.children) {
    if (c.tag !== 'stop') continue;
    const offAttr = c.attrs.find((a) => a.name === 'offset');
    let offset = offAttr ? parseFloat(offAttr.value) : 0;
    if (offAttr && offAttr.value.trim().endsWith('%')) offset = parseFloat(offAttr.value) / 100;
    let color = { r: 0, g: 0, b: 0, a: 1 };
    const style = c.attrs.find((a) => a.name === 'style');
    let stopColor = c.attrs.find((a) => a.name === 'stop-color');
    let stopOpacity = c.attrs.find((a) => a.name === 'stop-opacity');
    if (style) {
      const m1 = style.value.match(/stop-color\s*:\s*([^;]+)/);
      if (m1) stopColor = { value: m1[1].trim() };
      const m2 = style.value.match(/stop-opacity\s*:\s*([^;]+)/);
      if (m2) stopOpacity = { value: m2[1].trim() };
    }
    if (stopColor) { const p = parseColor(stopColor.value, 1); if (p) color = p; }
    if (stopOpacity) color.a = clamp01(parseFloat(stopOpacity.value));
    stops.push([clamp01(offset), color.r, color.g, color.b, color.a]);
  }
  stops.sort((a, b) => a[0] - b[0]);
  if (stops.length === 0) stops.push([0, 0, 0, 0, 1], [1, 0, 0, 0, 1]);

  const a = (n, d) => { const at = node.attrs.find((x) => x.name === n); return at ? parseFloat(at.value) : d; };
  const href = node.attrs.find((x) => x.name === 'href' || x.name === 'xlink:href');
  let base = null;
  if (href && href.value.startsWith('#')) base = defs.get(href.value.slice(1));

  const units = node.attrs.find((x) => x.name === 'gradientUnits');
  const bbox = !units || units.value !== 'userSpaceOnUse';

  const common = { stops, bbox, transform: IDENTITY };
  const tr = node.attrs.find((x) => x.name === 'gradientTransform');
  if (tr) common.transform = parseTransform(tr.value);

  if (node.tag === 'linearGradient') {
    return {
      kind: 'linear',
      x1: a('x1', base && base.x1 !== undefined ? base.x1 : 0),
      y1: a('y1', base && base.y1 !== undefined ? base.y1 : 0),
      x2: a('x2', base && base.x2 !== undefined ? base.x2 : 1),
      y2: a('y2', base && base.y2 !== undefined ? base.y2 : 0),
      ...common,
    };
  }
  return {
    kind: 'radial',
    cx: a('cx', base && base.cx !== undefined ? base.cx : 0.5),
    cy: a('cy', base && base.cy !== undefined ? base.cy : 0.5),
    r: a('r', base && base.r !== undefined ? base.r : 0.5),
    fx: a('fx', base && base.fx !== undefined ? base.fx : a('cx', 0.5)),
    fy: a('fy', base && base.fy !== undefined ? base.fy : a('cy', 0.5)),
    ...common,
  };
}

function sampleGradient(grad, x, y, bbox) {
  let gx = x, gy = y;
  if (grad.bbox && bbox) {
    gx = (x - bbox[0]) / Math.max(1e-9, bbox[2] - bbox[0]);
    gy = (y - bbox[1]) / Math.max(1e-9, bbox[3] - bbox[1]);
  }
  if (grad.transform !== IDENTITY) {
    const inv = invertAffine(grad.transform);
    if (inv) [gx, gy] = matApply(inv, gx, gy);
  }
  let t;
  if (grad.kind === 'linear') {
    const dx = grad.x2 - grad.x1, dy = grad.y2 - grad.y1;
    const len2 = dx * dx + dy * dy || 1e-9;
    t = ((gx - grad.x1) * dx + (gy - grad.y1) * dy) / len2;
  } else {
    const dx = gx - grad.cx, dy = gy - grad.cy;
    t = Math.sqrt(dx * dx + dy * dy) / Math.max(1e-9, grad.r);
  }
  t = clamp01(t);
  const stops = grad.stops;
  if (t <= stops[0][0]) return stops[0].slice(1);
  if (t >= stops[stops.length - 1][0]) return stops[stops.length - 1].slice(1);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [o0, r0, g0, b0, a0] = stops[i - 1];
      const [o1, r1, g1, b1, a1] = stops[i];
      const f = (t - o0) / Math.max(1e-9, o1 - o0);
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f, a0 + (a1 - a0) * f];
    }
  }
  return stops[stops.length - 1].slice(1);
}

function invertAffine(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

/* ---------------- text (built-in stroke font) ---------------- */

// Deterministic 5x7 pixel font rendered as filled rects per glyph.
const GLYPH_W = 5, GLYPH_H = 7, GLYPH_ADV = 6;
const FONT = {
  'A': [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11], 'B': [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  'C': [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e], 'D': [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  'E': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f], 'F': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  'G': [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f], 'H': [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  'I': [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e], 'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], 'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  'M': [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11], 'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  'O': [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], 'P': [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  'Q': [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d], 'R': [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  'S': [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e], 'T': [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], 'V': [0x11, 0x11, 0x11, 0x11, 0x0a, 0x0a, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11], 'X': [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04], 'Z': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e], '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f], '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02], '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e], '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e], '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0], '-': [0, 0, 0, 0x1f, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08], ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d], '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10], "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04], '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02], ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '@': [0x0e, 0x11, 0x17, 0x15, 0x17, 0x10, 0x0e], '#': [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  '*': [0x04, 0x15, 0x0e, 0x1f, 0x0e, 0x15, 0x04], '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
  '_': [0, 0, 0, 0, 0, 0, 0x1f], '%': [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02], '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0], ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
};

function textSubpaths(str, x, y, fontSize, letterSpacing) {
  const scale = fontSize / GLYPH_H;
  const advance = (GLYPH_ADV * scale) + letterSpacing;
  const subpaths = [];
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const glyph = FONT[ch] || FONT['?'];
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < GLYPH_W; col++) {
        if (glyph[row] & (1 << (GLYPH_W - 1 - col))) {
          const rx = cx + col * scale, ry = y + row * scale;
          subpaths.push([
            [rx, ry], [rx + scale, ry], [rx + scale, ry + scale], [rx, ry + scale], [rx, ry],
          ]);
        }
      }
    }
    cx += advance;
  }
  return subpaths;
}

/* ---------------- main render ---------------- */

function renderSvgToRgba(svgString, width, height, opts = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('renderSvgToRgba: invalid dimensions');
  }
  if (width * height > 64 * 1024 * 1024) {
    throw new Error('renderSvgToRgba: canvas too large');
  }
  const { sanitizeSvg } = require('./svg-sanitizer');
  const sanitized = sanitizeSvg(svgString);
  if (!sanitized.ok) {
    const e = new Error(sanitized.error.message);
    e.code = sanitized.error.code;
    throw e;
  }
  const svgNode = parseSvgLite(sanitized.svg);

  const pixels = new Uint8Array(width * height * 4);
  // background
  const bg = opts.background ? parseColor(opts.background, 1) : null;
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 0] = bg ? bg.r : 0;
    pixels[i * 4 + 1] = bg ? bg.g : 0;
    pixels[i * 4 + 2] = bg ? bg.b : 0;
    pixels[i * 4 + 3] = bg ? clamp8(bg.a * 255) : 0;
  }

  const viewBoxAttr = svgNode.attrs.find((a) => a.name === 'viewBox');
  let vb = [0, 0, 1, 1];
  if (viewBoxAttr) {
    const p = viewBoxAttr.value.split(/[\s,]+/).filter(Boolean).map(Number);
    if (p.length === 4) vb = p;
  } else {
    const w = getNum(svgNode, 'width', 1), h = getNum(svgNode, 'height', 1);
    vb = [0, 0, w, h];
  }
  const scaleX = width / (vb[2] || 1);
  const scaleY = height / (vb[3] || 1);
  const viewMat = [scaleX, 0, 0, scaleY, -vb[0] * scaleX, -vb[1] * scaleY];

  const defs = collectDefs(svgNode);
  const ctx = {
    pixels, width, height, defs,
    defaultFill: parseColor('black', 1),
  };

  renderChildren(svgNode.children, viewMat, {
    fill: ctx.defaultFill, stroke: null, strokeWidth: 1,
    opacity: 1, fillRule: 'nonzero', linecap: 'butt',
    fontSize: 16, fontFamily: 'sans-serif', letterSpacing: 0,
  }, ctx);

  return pixels;
}

function getNum(node, name, d) {
  const a = node.attrs.find((x) => x.name === name);
  return a ? parseFloat(a.value) : d;
}

/* Minimal re-parse of the sanitized SVG into the node shape used here.
   The sanitizer output is trusted (it passed the allowlist), so this
   parser is intentionally small but still strict about quoting. */
function parseSvgLite(svg) {
  const root = { tag: null, attrs: [], children: [] };
  const stack = [root];
  const re = /<([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>(?:([^<]*)<\/\1>)?|<([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)\/>|([^<]+)/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const top = stack[stack.length - 1];
    if (m[6] !== undefined) {
      if (m[6].trim() !== '') top.children.push({ type: 'text', value: m[6] });
      continue;
    }
    if (m[4] !== undefined) { // self-closing
      top.children.push({ tag: m[4], attrs: parseAttrsLite(m[5] || ''), children: [] });
      continue;
    }
    const node = { tag: m[1], attrs: parseAttrsLite(m[2] || ''), children: [] };
    top.children.push(node);
    if (m[3] !== undefined) {
      if (m[3] !== '') node.children.push({ type: 'text', value: m[3] });
    } else {
      stack.push(node);
    }
  }
  // unwind
  while (stack.length > 1) stack.pop();
  return root.children.find((c) => c.tag === 'svg') || root;
}

function parseAttrsLite(s) {
  const attrs = [];
  const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    attrs.push({ name: m[1], value: m[3] !== undefined ? m[3] : m[4] });
  }
  return attrs;
}

function collectDefs(node, defs = new Map()) {
  for (const c of node.children) {
    if (c.type === 'text') continue;
    const id = c.attrs.find((a) => a.name === 'id');
    if (id && ['linearGradient', 'radialGradient', 'filter', 'clipPath', 'mask', 'pattern', 'symbol', 'marker'].includes(c.tag)) {
      defs.set(id.value, c);
    }
    collectDefs(c, defs);
  }
  return defs;
}

function attr(node, name) {
  return node.attrs.find((a) => a.name === name);
}

function resolvePaint(value, defs) {
  if (!value) return null;
  const m = String(value).match(/^url\s*\(\s*['"]?#([\w:.-]+)['"]?\s*\)$/);
  if (m) {
    const def = defs.get(m[1]);
    if (def && (def.tag === 'linearGradient' || def.tag === 'radialGradient')) {
      return { gradient: buildGradient(def, defs) };
    }
    return null;
  }
  return { color: parseColor(value, 1) };
}

function renderChildren(children, mat, style, ctx) {
  for (const node of children) {
    if (node.type === 'text') continue;
    renderNode(node, mat, style, ctx);
  }
}

function renderNode(node, parentMat, parentStyle, ctx) {
  let style = { ...parentStyle };
  const a = (n) => attr(node, n);

  const opacity = a('opacity');
  if (opacity) style.opacity *= clamp01(parseFloat(opacity.value));

  const display = a('display');
  if (display && display.value === 'none') return;
  const visibility = a('visibility');
  if (visibility && visibility.value === 'hidden') return;

  let fillSet = false, strokeSet = false;
  if (a('fill')) { style.fill = resolvePaint(a('fill').value, ctx.defs); fillSet = true; }
  if (a('stroke')) { style.stroke = resolvePaint(a('stroke').value, ctx.defs); strokeSet = true; }
  if (a('stroke-width')) style.strokeWidth = parseFloat(a('stroke-width').value);
  if (a('fill-opacity')) style.fillOpacity = clamp01(parseFloat(a('fill-opacity').value));
  if (a('stroke-opacity')) style.strokeOpacity = clamp01(parseFloat(a('stroke-opacity').value));
  if (a('fill-rule')) style.fillRule = a('fill-rule').value;
  if (a('stroke-linecap')) style.linecap = a('stroke-linecap').value;
  if (a('font-size')) style.fontSize = parseFloat(a('font-size').value);
  if (a('letter-spacing')) style.letterSpacing = parseFloat(a('letter-spacing').value) || 0;
  const st = a('style');
  if (st) {
    const fillM = st.value.match(/fill\s*:\s*([^;]+)/);
    if (fillM) { style.fill = resolvePaint(fillM[1].trim(), ctx.defs); fillSet = true; }
    const strokeM = st.value.match(/stroke\s*:\s*([^;]+)/);
    if (strokeM) { style.stroke = resolvePaint(strokeM[1].trim(), ctx.defs); strokeSet = true; }
    const swM = st.value.match(/stroke-width\s*:\s*([^;]+)/);
    if (swM) style.strokeWidth = parseFloat(swM[1]);
  }

  let mat = parentMat;
  const tr = a('transform');
  if (tr) mat = matMul(parentMat, parseTransform(tr.value));

  const tag = node.tag;
  if (tag === 'g' || tag === 'svg' || tag === 'defs' || tag === 'symbol' || tag === 'title' || tag === 'desc' || tag === 'metadata') {
    if (tag === 'defs' || tag === 'title' || tag === 'desc' || tag === 'metadata') return;
    renderChildren(node.children, mat, style, ctx);
    return;
  }
  if (tag === 'use') {
    const href = a('href') || a('xlink:href');
    if (href && href.value.startsWith('#')) {
      const target = ctx.defs.get(href.value.slice(1));
      if (target) renderNode(target, mat, style, ctx);
    }
    return;
  }
  if (tag === 'linearGradient' || tag === 'radialGradient' || tag === 'stop' || tag === 'filter' ||
      tag === 'clipPath' || tag === 'mask' || tag === 'pattern' || tag === 'marker') {
    return; // handled via defs
  }
  if (tag === 'text' || tag === 'tspan') {
    const x = getNum(node, 'x', 0), y = getNum(node, 'y', 0);
    let text = '';
    for (const c of node.children) if (c.type === 'text') text += c.value;
    if (tag === 'tspan') {
      for (const c of node.children) if (c.type !== 'text') renderNode(c, mat, style, ctx);
    }
    if (text.trim() !== '') {
      const [tx, ty] = matApply(mat, x, y);
      const scale = Math.sqrt(Math.abs(mat[0] * mat[3] - mat[1] * mat[2])) || 1;
      const sub = textSubpaths(text, tx, ty - style.fontSize * scale, style.fontSize * scale, style.letterSpacing * scale);
      paintSubpaths(sub, mat, style, ctx, true);
    }
    if (tag === 'text') {
      for (const c of node.children) if (c.type !== 'text') renderNode(c, mat, style, ctx);
    }
    return;
  }

  // shape
  const local = shapeToSubpaths(node);
  if (local.length === 0) return;
  paintSubpaths(local, mat, style, ctx, false, node);
}

function paintSubpaths(localSubpaths, mat, style, ctx, isText, node) {
  // transform to device space
  const device = localSubpaths.map((sp) => sp.map(([x, y]) => matApply(mat, x, y)));

  const fill = style.fill || (isText ? { color: { r: 0, g: 0, b: 0, a: 1 } } : ctx.defaultFill);
  const stroke = style.stroke;
  const strokeWidth = (style.strokeWidth || 1) * (Math.sqrt(Math.abs(mat[0] * mat[3] - mat[1] * mat[2])) || 1);

  if (fill) {
    const alpha = style.opacity * (style.fillOpacity !== undefined ? style.fillOpacity : 1);
    fillSubpaths(device, fill, alpha, style.fillRule || 'nonzero', ctx, isText);
  }
  if (stroke && strokeWidth > 0) {
    const alpha = style.opacity * (style.strokeOpacity !== undefined ? style.strokeOpacity : 1);
    const stroked = strokeSubpaths(device, strokeWidth, style.linecap || 'butt');
    fillSubpaths(stroked, stroke, alpha, 'nonzero', ctx, false);
  }
}

function fillSubpaths(subpaths, paint, alpha, fillRule, ctx, isText) {
  if (!paint) return;
  if (alpha <= 0) return;
  const { pixels, width, height } = ctx;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const sp of subpaths) {
    for (const [x, y] of sp) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const x0 = Math.max(0, Math.floor(minX) - 1);
  const y0 = Math.max(0, Math.floor(minY) - 1);
  const x1 = Math.min(width - 1, Math.ceil(maxX) + 1);
  const y1 = Math.min(height - 1, Math.ceil(maxY) + 1);
  if (x1 < x0 || y1 < y0) return;

  const bbox = [minX, minY, maxX, maxY];
  const evenodd = fillRule === 'evenodd';

  for (let py = y0; py <= y1; py++) {
    const cy = py + 0.5;
    for (let px = x0; px <= x1; px++) {
      const cx = px + 0.5;
      let covered;
      if (evenodd) {
        let ins = false;
        for (const sp of subpaths) if (pointInPolygon(cx, cy, sp)) ins = !ins;
        covered = ins;
      } else {
        let wn = 0;
        for (const sp of subpaths) {
          if (sp.length > 2) wn += windingNumber(cx, cy, sp);
        }
        covered = wn !== 0;
      }
      if (!covered) continue;

      let r, g, b, a;
      if (paint.gradient) {
        [r, g, b, a] = sampleGradient(paint.gradient, cx, cy, bbox);
      } else if (paint.color) {
        ({ r, g, b, a } = paint.color);
      } else continue;

      a *= alpha;
      if (a <= 0) continue;
      const idx = (py * width + px) * 4;
      const da = a; // source-over with straight alpha, dst already premultiplied-free
      const sa = da;
      const inv = 1 - sa;
      pixels[idx + 0] = clamp8(r * sa + pixels[idx + 0] * inv);
      pixels[idx + 1] = clamp8(g * sa + pixels[idx + 1] * inv);
      pixels[idx + 2] = clamp8(b * sa + pixels[idx + 2] * inv);
      pixels[idx + 3] = clamp8((sa + (pixels[idx + 3] / 255) * inv) * 255);
    }
  }
}

/** Render SVG string directly to PNG buffer at the given pixel size. */
function renderSvgToPng(svgString, width, height, opts = {}) {
  const rgba = renderSvgToRgba(svgString, width, height, opts);
  return encodePng(width, height, rgba);
}

module.exports = { renderSvgToRgba, renderSvgToPng, parseColor, hslToRgb };
