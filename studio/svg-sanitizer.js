'use strict';
/**
 * Line & Logo Studio — SVG Sanitizer & Normalizer
 * ---------------------------------------------------------------
 * Zero-dependency, deterministic server-side SVG sanitizer.
 *
 * Threat model (defense-in-depth):
 *  - XXE / external entities        -> we do NOT use a streaming XML parser
 *    that resolves entities at all; input is tokenized with a strict,
 *    non-validating lexer that expands NO external entities and rejects
 *    any entity that is not one of the five predefined XML entities.
 *  - Billion-laughs / entity expansion -> hard caps on input size, entity
 *    count, entity expansion depth, and total expanded output size.
 *  - XSS (script / event handlers / javascript: URIs / foreignObject /
 *    data-URI abuse / CSS expression) -> allowlist-based tag & attribute
 *    filtering; every URI is scheme-checked; style attributes are parsed
 *    and property-filtered.
 *  - Malformed XML / parser differentials -> strict tokenization, tag
 *    balancing, attribute quoting requirements, no DOCTYPE processing.
 *
 * Normalization:
 *  - viewBox is parsed, validated, and rewritten to canonical form.
 *  - width/height are normalized against the viewBox when present.
 *  - path data is NOT rewritten (path math is lossy); instead path data
 *    is validated to contain only the command alphabet and numbers.
 *  - Unknown / unsafe elements are dropped (with their subtree) and the
 *    drop is reported in the result's `dropped` list for auditability.
 *
 * Usage:
 *   const { sanitizeSvg } = require('./svg-sanitizer');
 *   const result = sanitizeSvg(dirtySvgString);
 *   if (!result.ok) throw new Error(result.error.code);
 *   result.svg;      // safe, normalized SVG string
 *   result.dropped;  // [{tag, reason}] audit trail
 *   result.stats;    // { inputBytes, outputBytes, elements, entities }
 */

const LIMITS = Object.freeze({
  maxInputBytes: 2 * 1024 * 1024,      // 2 MB raw input
  maxOutputBytes: 4 * 1024 * 1024,     // 4 MB serialized output
  maxEntityCount: 64,                  // custom entities per document
  maxEntityExpansionDepth: 4,
  maxEntityExpansionBytes: 256 * 1024, // total expanded entity payload
  maxElementCount: 20000,
  maxAttributeCountPerElement: 256,
  maxAttributeValueLength: 8192,
  maxDepth: 128,
  maxStyleDeclarations: 128,
});

/* ------------------------------------------------------------------ */
/* Tag allowlist                                                       */
/* ------------------------------------------------------------------ */

// Structural / container
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'marker', 'mask', 'clipPath', 'pattern',
  'linearGradient', 'radialGradient', 'stop', 'title', 'desc', 'metadata',
]);
// Shapes
['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text',
 'tspan', 'textPath'].forEach((t) => ALLOWED_TAGS.add(t));
// Filters (static only; filter primitives cannot execute script)
['filter', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite',
 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight',
 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology',
 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile',
 'feTurbulence'].forEach((t) => ALLOWED_TAGS.add(t));

// Explicitly dangerous tags (reported with reason when encountered)
const KNOWN_DANGEROUS = new Map([
  ['script', 'script-element'],
  ['foreignobject', 'foreignobject-embedding'],
  ['iframe', 'embedded-document'],
  ['object', 'embedded-document'],
  ['embed', 'embedded-document'],
  ['applet', 'embedded-document'],
  ['frame', 'embedded-document'],
  ['frameset', 'embedded-document'],
  ['audio', 'media-element'],
  ['video', 'media-element'],
  ['canvas', 'scriptable-surface'],
  ['link', 'external-resource'],
  ['meta', 'document-metadata'],
  ['base', 'document-metadata'],
  ['style', 'raw-css-block'],
  ['animate', 'smil-animation'],
  ['animatetransform', 'smil-animation'],
  ['animatemotion', 'smil-animation'],
  ['set', 'smil-animation'],
  ['handler', 'svg-handler'],
  ['listener', 'svg-listener'],
  ['cursor', 'external-resource'],
]);

/* ------------------------------------------------------------------ */
/* Attribute allowlist                                                 */
/* ------------------------------------------------------------------ */

const GLOBAL_ATTRS = new Set([
  'id', 'class', 'role', 'tabindex', 'lang', 'xml:lang', 'xml:space',
  'data-name', 'data-layer', 'aria-label', 'aria-hidden', 'aria-labelledby',
]);

const PRESENTATION_ATTRS = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
  'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'visibility',
  'display', 'color', 'color-interpolation', 'color-rendering',
  'shape-rendering', 'text-rendering', 'vector-effect', 'clip-path',
  'clip-rule', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end',
  'transform', 'transform-origin', 'paint-order', 'mix-blend-mode',
  'isolation', 'stop-color', 'stop-opacity', 'offset', 'x', 'y', 'x1', 'y1',
  'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'width', 'height',
  'viewBox', 'preserveAspectRatio', 'd', 'pathLength', 'text-anchor',
  'text-decoration', 'font-family', 'font-size', 'font-weight', 'font-style',
  'font-stretch', 'font-variant', 'letter-spacing', 'word-spacing',
  'dominant-baseline', 'baseline-shift', 'rotate', 'startOffset', 'method',
  'spacing', 'href', 'xlink:href', 'gradientUnits', 'gradientTransform',
  'spreadMethod', 'fr', 'fx', 'fy', 'patternUnits', 'patternContentUnits',
  'patternTransform', 'markerWidth', 'markerHeight', 'markerUnits',
  'orient', 'refX', 'refY', 'kernelMatrix', 'kernelUnitLength', 'order',
  'preserveAlpha', 'radius', 'stdDeviation', 'dx', 'dy', 'in', 'in2',
  'mode', 'values', 'type', 'slope', 'intercept', 'amplitude', 'exponent',
  'tableValues', 'operator', 'k1', 'k2', 'k3', 'k4', 'scale', 'xChannelSelector',
  'yChannelSelector', 'result', 'azimuth', 'elevation', 'limitingConeAngle',
  'pointsAtX', 'pointsAtY', 'pointsAtZ', 'specularConstant', 'specularExponent',
  'surfaceScale', 'diffuseConstant', 'baseFrequency', 'numOctaves', 'seed',
  'stitchTiles', 'bias', 'divisor', 'edgeMode', 'kernelUnitLength', 'targetX',
  'targetY', 'lengthAdjust', 'media', 'xmlns', 'xmlns:xlink',
]);

const ALLOWED_ATTRS = new Set([...GLOBAL_ATTRS, ...PRESENTATION_ATTRS]);

// Attributes that are never allowed regardless of allowlist (belt & braces)
const HARD_BLOCKED_ATTRS = new Set([
  'onabort', 'onactivate', 'onbegin', 'onclick', 'onend', 'onerror',
  'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove',
  'onmouseout', 'onmouseover', 'onmouseup', 'onrepeat', 'onresize',
  'onscroll', 'onunload', 'onzoom',
  // note: 'style' is NOT hard-blocked — it is parsed and filtered separately
]);

/* ------------------------------------------------------------------ */
/* URL scheme policy                                                   */
/* ------------------------------------------------------------------ */

const URL_ATTRS = new Set(['href', 'xlink:href']);
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto']);
const ALLOWED_FRAGMENT = /^#[A-Za-z_][\w:.-]*$/; // internal references only

function isSafeUrl(value) {
  const v = String(value).trim();
  if (v === '') return false;
  if (ALLOWED_FRAGMENT.test(v)) return true; // #id same-document reference
  const schemeMatch = v.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) return false; // scheme-relative //host or bare path -> reject
  return SAFE_SCHEMES.has(schemeMatch[1].toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Style attribute policy                                              */
/* ------------------------------------------------------------------ */

const ALLOWED_STYLE_PROPS = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
  'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'visibility', 'display',
  'color', 'mix-blend-mode', 'isolation', 'paint-order', 'transform',
  'transform-origin', 'clip-path', 'mask', 'filter', 'stop-color',
  'stop-opacity', 'font-family', 'font-size', 'font-weight', 'font-style',
  'letter-spacing', 'word-spacing', 'text-anchor', 'text-decoration',
  'dominant-baseline', 'baseline-shift', 'vector-effect', 'shape-rendering',
  'color-interpolation',
]);

const DANGEROUS_STYLE_VALUE = /(expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding|@import|url\s*\(\s*['"]?\s*(https?:)?\/\/)/i;

function sanitizeStyle(styleValue, report) {
  const out = [];
  let declCount = 0;
  // split on ; not inside parens or quotes
  const decls = String(styleValue).match(/(?:[^;(]|\([^)]*\))+/g) || [];
  for (const raw of decls) {
    if (++declCount > LIMITS.maxStyleDeclarations) {
      report.push({ kind: 'style', reason: 'too-many-declarations' });
      break;
    }
    const idx = raw.indexOf(':');
    if (idx <= 0) continue;
    const prop = raw.slice(0, idx).trim().toLowerCase();
    const val = raw.slice(idx + 1).trim();
    if (!prop || !val) continue;
    if (!ALLOWED_STYLE_PROPS.has(prop)) {
      report.push({ kind: 'style', reason: `blocked-property:${prop}` });
      continue;
    }
    if (DANGEROUS_STYLE_VALUE.test(val)) {
      report.push({ kind: 'style', reason: `blocked-value:${prop}` });
      continue;
    }
    // url() inside an allowed property must be a same-document fragment
    const urlMatch = val.match(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    if (urlMatch && !ALLOWED_FRAGMENT.test(urlMatch[1].trim())) {
      report.push({ kind: 'style', reason: `blocked-url:${prop}` });
      continue;
    }
    out.push(`${prop}:${val}`);
  }
  return out.join(';');
}

/* ------------------------------------------------------------------ */
/* Value validators                                                    */
/* ------------------------------------------------------------------ */

const NUMBER_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const PATH_RE = /^[MmZzLlHhVvCcSsQqTtAa0-9\s,.\-]+$/;
const POINTS_RE = /^[\d\s,.\-]+$/;

function validateAttrValue(tag, attr, value) {
  if (typeof value !== 'string') return false;
  if (value.length > LIMITS.maxAttributeValueLength) return false;
  const v = value.trim();
  if (v === '') return false;

  if (URL_ATTRS.has(attr)) return isSafeUrl(v);

  // Numeric geometry attributes must be numeric (single value)
  const NUMERIC = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r',
    'rx', 'ry', 'width', 'height', 'stroke-width', 'opacity', 'fill-opacity',
    'stroke-opacity', 'font-size', 'letter-spacing', 'stdDeviation', 'fr',
    'offset', 'stop-opacity', 'stroke-miterlimit', 'stroke-dashoffset',
    'pathLength', 'startOffset']);
  if (NUMERIC.has(attr)) {
    // allow single number, or number with unit for font-size etc.
    return /^-?\d+(\.\d+)?([eE][+-]?\d+)?(px|pt|em|rem|%)?$/.test(v);
  }

  if (attr === 'd') return PATH_RE.test(v) && v.length <= LIMITS.maxAttributeValueLength;
  if (attr === 'points') return POINTS_RE.test(v);

  if (attr === 'viewBox') {
    const parts = v.split(/[\s,]+/).filter(Boolean);
    if (parts.length !== 4) return false;
    return parts.every((p) => NUMBER_RE.test(p));
  }

  if (attr === 'transform' || attr === 'gradientTransform' || attr === 'patternTransform') {
    return /^[a-zA-Z]+\s*\([\d\s,.\-eE]+\)(\s+[a-zA-Z]+\s*\([\d\s,.\-eE]+\))*$/.test(v);
  }

  // paint values: color keywords, hex, rgb(a), hsl(a), none, currentColor, url(#id)
  if (['fill', 'stroke', 'stop-color', 'color'].includes(attr)) {
    if (/^(none|currentColor|transparent|inherit|context-fill|context-stroke)$/i.test(v)) return true;
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return true;
    if (/^(rgb|rgba|hsl|hsla)\([\d\s.,%\-]+\)$/.test(v)) return true;
    const urlRef = v.match(/^url\s*\(\s*['"]?(#[\w:.-]+)['"]?\s*\)$/);
    if (urlRef) return ALLOWED_FRAGMENT.test(urlRef[1]);
    return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(v); // CSS color keyword
  }

  // id / class sanity
  if (attr === 'id' || attr === 'class') return /^[\w:.-]+$/.test(v);

  // default: reject control chars except tab/newline that could break parsing
  return !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
}

/* ------------------------------------------------------------------ */
/* Strict tokenizer (no entity expansion beyond the 5 predefined)      */
/* ------------------------------------------------------------------ */

const PREDEFINED_ENTITIES = Object.freeze({
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
});

function decodeEntities(text, counters) {
  // Only the 5 predefined entities are ever expanded. Any other &...;
  // sequence is left verbatim (it will fail downstream validation if it
  // lands in an attribute value) and counted for audit.
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][\w.-]*);/g, (m, body) => {
    if (m in PREDEFINED_ENTITIES) return PREDEFINED_ENTITIES[m];
    counters.entities += 1;
    if (counters.entities > LIMITS.maxEntityCount) {
      throw new SanitizerError('ENTITY_LIMIT_EXCEEDED', 'custom entity reference limit exceeded');
    }
    return m; // unknown entity: keep raw, validators will reject if unsafe
  });
}

class SanitizerError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const TOKEN_RE = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<\?[\s\S]*?\?>|<\/([A-Za-z][\w:.-]*)\s*>|<([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)/g;

function tokenize(input) {
  const tokens = [];
  let lastIndex = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(input)) !== null) {
    if (m.index !== lastIndex) {
      const gap = input.slice(lastIndex, m.index);
      if (gap.trim() !== '') {
        throw new SanitizerError('MALFORMED_XML', 'unescaped markup in text content');
      }
    }
    lastIndex = TOKEN_RE.lastIndex;
    if (m[0].startsWith('<!--')) continue;               // comment
    if (m[0].startsWith('<![CDATA[')) {                  // CDATA text
      tokens.push({ type: 'text', value: m[1] });
      continue;
    }
    if (m[0].startsWith('<!DOCTYPE')) {
      throw new SanitizerError('DOCTYPE_FORBIDDEN', 'DOCTYPE declarations are not allowed');
    }
    if (m[0].startsWith('<?')) continue;                 // PI
    if (m[2] !== undefined) { tokens.push({ type: 'close', tag: m[2] }); continue; }
    if (m[3] !== undefined) {
      tokens.push({ type: 'open', tag: m[3], rawAttrs: m[4] || '' });
      continue;
    }
    tokens.push({ type: 'text', value: m[5] });
  }
  if (lastIndex !== input.length) {
    const tail = input.slice(lastIndex);
    if (tail.trim() !== '') throw new SanitizerError('MALFORMED_XML', 'trailing unescaped markup');
  }
  return tokens;
}

function parseAttrs(rawAttrs, counters) {
  const attrs = [];
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(rawAttrs)) !== null) {
    if (attrs.length >= LIMITS.maxAttributeCountPerElement) {
      throw new SanitizerError('ATTR_LIMIT_EXCEEDED', 'too many attributes on one element');
    }
    const value = decodeEntities(m[3] !== undefined ? m[3] : m[4], counters);
    attrs.push({ name: m[1], value });
  }
  // any leftover non-whitespace (other than the self-closing slash) is malformed
  const leftover = rawAttrs.replace(re, '').replace(/\//g, '').trim();
  if (leftover !== '') throw new SanitizerError('MALFORMED_ATTR', `malformed attribute syntax near "${leftover.slice(0, 32)}"`);
  return attrs;
}

/* ------------------------------------------------------------------ */
/* Tree build + sanitize                                               */
/* ------------------------------------------------------------------ */

function buildTree(tokens, counters) {
  const root = { tag: null, attrs: [], children: [], parent: null };
  let current = root;
  let depth = 0;
  let elementCount = 0;
  for (const tok of tokens) {
    if (tok.type === 'text') {
      // text is only allowed inside <text>, <tspan>, <title>, <desc>, <metadata>
      const host = current.tag ? current.tag.toLowerCase() : null;
      if (host && ['text', 'tspan', 'title', 'desc', 'metadata'].includes(host)) {
        current.children.push({ type: 'text', value: tok.value });
      } else if (tok.value.trim() !== '') {
        // non-whitespace text outside the root <svg> element is malformed
        if (host === null) {
          throw new SanitizerError('MALFORMED_XML', 'text outside root <svg> element');
        }
        // stray text inside other elements is dropped (whitespace kept for structure)
        current.children.push({ type: 'text', value: tok.value.replace(/[^\s]/g, '') });
      }
      continue;
    }
    if (tok.type === 'open') {
      if (++elementCount > LIMITS.maxElementCount) {
        throw new SanitizerError('ELEMENT_LIMIT_EXCEEDED', 'element count limit exceeded');
      }
      if (++depth > LIMITS.maxDepth) {
        throw new SanitizerError('DEPTH_LIMIT_EXCEEDED', 'nesting depth limit exceeded');
      }
      const node = { tag: tok.tag, attrs: parseAttrs(tok.rawAttrs, counters), children: [], parent: current };
      current.children.push(node);
      current = node; // assume container; serializer re-checks void-ness
      continue;
    }
    if (tok.type === 'close') {
      // find matching open tag walking up; if none, ignore stray close
      let node = current;
      while (node && node.tag !== tok.tag) node = node.parent;
      if (node && node.parent) {
        current = node.parent;
        depth = Math.max(0, depth - 1);
      }
    }
  }
  return { root, elementCount };
}

const VOID_TAGS = new Set(['circle', 'ellipse', 'line', 'path', 'polygon', 'polyline',
  'rect', 'stop', 'use', 'feBlend', 'feColorMatrix', 'feComposite', 'feConvolveMatrix',
  'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feDropShadow', 'feFlood',
  'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight',
  'feTile', 'feTurbulence']);

function sanitizeNode(node, ctx) {
  // returns sanitized node or null (dropped)
  const tagLower = node.tag.toLowerCase();
  const tag = node.tag; // preserve original case for output fidelity

  if (KNOWN_DANGEROUS.has(tagLower)) {
    ctx.dropped.push({ tag, reason: KNOWN_DANGEROUS.get(tagLower) });
    return null;
  }
  if (!ALLOWED_TAGS.has(tag)) {
    ctx.dropped.push({ tag, reason: 'tag-not-allowlisted' });
    return null;
  }

  const out = { tag, attrs: [], children: [] };
  for (const { name, value } of node.attrs) {
    const attrLower = name.toLowerCase();
    if (HARD_BLOCKED_ATTRS.has(attrLower)) {
      ctx.dropped.push({ tag, attr: name, reason: 'hard-blocked-attribute' });
      continue;
    }
    if (attrLower === 'style') {
      const cleaned = sanitizeStyle(value, ctx.styleReport);
      if (cleaned) out.attrs.push({ name: 'style', value: cleaned });
      continue;
    }
    if (!ALLOWED_ATTRS.has(name) && !ALLOWED_ATTRS.has(attrLower)) {
      ctx.dropped.push({ tag, attr: name, reason: 'attribute-not-allowlisted' });
      continue;
    }
    if (!validateAttrValue(tag, name, value)) {
      ctx.dropped.push({ tag, attr: name, reason: 'invalid-or-unsafe-value' });
      continue;
    }
    out.attrs.push({ name, value: value.trim() });
  }

  for (const child of node.children) {
    if (child.type === 'text') {
      // only allow text under text-ish containers
      if (['text', 'tspan', 'title', 'desc', 'metadata'].includes(tagLower)) {
        out.children.push({ type: 'text', value: child.value });
      }
      continue;
    }
    const cleanChild = sanitizeNode(child, ctx);
    if (cleanChild) out.children.push(cleanChild);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

function normalizeSvg(svg, ctx) {
  if (!svg || svg.tag !== 'svg') {
    throw new SanitizerError('NO_SVG_ROOT', 'document has no <svg> root element');
  }

  // viewBox canonicalization
  let viewBox = svg.attrs.find((a) => a.name === 'viewBox');
  if (viewBox) {
    const parts = viewBox.value.split(/[\s,]+/).filter(Boolean).map(Number);
    const canonical = parts.map((n) => {
      const r = Math.round(n * 1000) / 1000;
      return Object.is(r, -0) ? 0 : r;
    }).join(' ');
    viewBox.value = canonical;
    ctx.stats.viewBox = canonical;
  } else {
    // synthesize viewBox from width/height if both numeric
    const w = svg.attrs.find((a) => a.name === 'width');
    const h = svg.attrs.find((a) => a.name === 'height');
    const wn = w && /^-?\d+(\.\d+)?$/.test(w.value) ? Number(w.value) : null;
    const hn = h && /^-?\d+(\.\d+)?$/.test(h.value) ? Number(h.value) : null;
    if (wn && hn && wn > 0 && hn > 0) {
      svg.attrs.push({ name: 'viewBox', value: `0 0 ${wn} ${hn}` });
      ctx.stats.viewBox = `0 0 ${wn} ${hn}`;
    }
  }

  // strip pixel units from root width/height (keep numeric) for scaling freedom
  for (const a of svg.attrs) {
    if ((a.name === 'width' || a.name === 'height') && /^-?\d+(\.\d+)?(px)$/.test(a.value)) {
      a.value = a.value.replace(/px$/, '');
    }
  }

  // ensure xmlns
  if (!svg.attrs.some((a) => a.name === 'xmlns')) {
    svg.attrs.unshift({ name: 'xmlns', value: 'http://www.w3.org/2000/svg' });
  }
  return svg;
}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function serialize(node, buf) {
  if (node.type === 'text') { buf.push(escapeText(node.value)); return; }
  buf.push('<', node.tag);
  for (const a of node.attrs) buf.push(' ', a.name, '="', escapeAttr(a.value), '"');
  if (node.children.length === 0 && VOID_TAGS.has(node.tag)) { buf.push('/>'); return; }
  buf.push('>');
  for (const c of node.children) serialize(c, buf);
  buf.push('</', node.tag, '>');
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function sanitizeSvg(input) {
  const stats = { inputBytes: 0, outputBytes: 0, elements: 0, entities: 0, viewBox: null };
  try {
    if (typeof input !== 'string') {
      throw new SanitizerError('INVALID_INPUT', 'input must be a string');
    }
    stats.inputBytes = Buffer.byteLength(input, 'utf8');
    if (stats.inputBytes > LIMITS.maxInputBytes) {
      throw new SanitizerError('INPUT_TOO_LARGE', `input exceeds ${LIMITS.maxInputBytes} bytes`);
    }
    // reject anything that smells like entity definitions outright
    if (/<!ENTITY|<!ELEMENT|<!ATTLIST/i.test(input)) {
      throw new SanitizerError('ENTITY_DECLARATION_FORBIDDEN', 'entity declarations are not allowed');
    }

    const counters = { entities: 0 };
    const tokens = tokenize(input);
    const { root, elementCount } = buildTree(tokens, counters);
    stats.elements = elementCount;

    const ctx = { dropped: [], styleReport: [], stats };
    // The wrapper root is synthetic (tag: null); sanitize each top-level
    // child and locate the <svg> document element among the survivors.
    const sanitizedChildren = [];
    for (const child of root.children) {
      if (child.type === 'text') {
        if (child.value.trim() !== '') {
          throw new SanitizerError('MALFORMED_XML', 'text outside root <svg> element');
        }
        continue;
      }
      const clean = sanitizeNode(child, ctx);
      if (clean) sanitizedChildren.push(clean);
    }
    const svg = sanitizedChildren.find((c) => c.tag === 'svg');
    if (!svg) throw new SanitizerError('NO_SVG_ROOT', 'document has no <svg> root element');
    normalizeSvg(svg, ctx);

    const buf = [];
    serialize(svg, buf);
    let out = buf.join('');
    if (Buffer.byteLength(out, 'utf8') > LIMITS.maxOutputBytes) {
      throw new SanitizerError('OUTPUT_TOO_LARGE', 'serialized output exceeds limit');
    }
    stats.outputBytes = Buffer.byteLength(out, 'utf8');

    return {
      ok: true,
      svg: out,
      dropped: ctx.dropped,
      styleReport: ctx.styleReport,
      stats,
    };
  } catch (err) {
    if (err instanceof SanitizerError) {
      return { ok: false, error: { code: err.code, message: err.message }, stats };
    }
    return { ok: false, error: { code: 'INTERNAL', message: String(err && err.message || err) }, stats };
  }
}

/** Convenience: throw on failure. */
function sanitizeSvgOrThrow(input) {
  const r = sanitizeSvg(input);
  if (!r.ok) {
    const e = new Error(r.error.message);
    e.code = r.error.code;
    e.details = r;
    throw e;
  }
  return r.svg;
}

module.exports = {
  sanitizeSvg,
  sanitizeSvgOrThrow,
  LIMITS,
  ALLOWED_TAGS,
  ALLOWED_ATTRS,
};
