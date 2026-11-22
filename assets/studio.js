/* Lines & Logos — Studio engine: SVG sanitizer + brand kit export + canvas runtime.
   Zero-dependency. Shared by studio.html. Works offline (demo mode). */
(function () {
  'use strict';

  /* ============================== SVG SANITIZER ============================== */
  /* Parses an SVG string, strips active content, returns clean SVG + audit. */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';

  const DROP_TAGS = new Set(['script', 'foreignobject', 'iframe', 'embed', 'object',
    'audio', 'video', 'source', 'track', 'link', 'meta', 'base', 'applet', 'frame',
    'frameset', 'portal', 'fencedframe']);

  function isSafeImageDataUri(v) {
    return /^data:image\/(png|gif|jpe?g|webp|svg\+xml);/i.test(v);
  }

  function sanitizeUrl(v, attrName) {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const low = s.replace(/[\s-]+/g, '').toLowerCase();
    if (low.startsWith('javascript:') || low.startsWith('vbscript:') || low.startsWith('livescript:')) return null;
    if (low.startsWith('data:')) return isSafeImageDataUri(s) ? s : null;
    if (/^https?:\/\//i.test(s)) return null;           // external refs -> strip
    if (low.startsWith('//')) return null;              // protocol-relative
    if (low.startsWith('file:')) return null;
    return s;                                            // fragment (#id), relative path OK
  }

  function sanitizeStyle(styleVal) {
    /* drop url(http...), url(//...), url(javascript...), behavior, binding, -moz-binding */
    if (!styleVal) return null;
    let s = String(styleVal);
    s = s.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, q, u) => {
      const ok = sanitizeUrl(u, 'style-url');
      return ok ? `url("${ok}")` : 'none';
    });
    s = s.replace(/(behavior|binding|-moz-binding)\s*:[^;}]*/gi, '');
    if (/expression\s*\(/i.test(s)) return null;
    return s.trim() || null;
  }

  function sanitizeSvg(svgText) {
    const report = { removed: [], warnings: [], ok: false };
    let doc;
    try {
      doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    } catch (e) {
      report.warnings.push('Parse failure: ' + e.message);
      return { svg: null, report };
    }
    if (doc.querySelector('parsererror')) {
      report.warnings.push('Malformed SVG — parser error.');
      return { svg: null, report };
    }
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg') {
      report.warnings.push('Root element is not <svg>.');
      return { svg: null, report };
    }

    const walk = (node) => {
      for (const child of Array.from(node.children)) {
        const tag = child.nodeName.toLowerCase();
        if (DROP_TAGS.has(tag)) {
          report.removed.push(`<${tag}> element removed`);
          child.remove();
          continue;
        }
        // attributes
        for (const attr of Array.from(child.attributes)) {
          const name = attr.name.toLowerCase();
          const val = attr.value;
          if (name.startsWith('on')) {
            report.removed.push(`on* handler "${attr.name}" removed from <${tag}>`);
            child.removeAttribute(attr.name);
            continue;
          }
          if (name === 'style') {
            const clean = sanitizeStyle(val);
            if (clean == null) { report.removed.push(`unsafe style removed from <${tag}>`); child.removeAttribute(attr.name); }
            else if (clean !== val) { child.setAttribute(attr.name, clean); report.warnings.push(`style trimmed on <${tag}>`); }
            continue;
          }
          if (['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'poster'].includes(name)) {
            const clean = sanitizeUrl(val, name);
            if (clean == null) {
              report.removed.push(`unsafe ${attr.name}="${val.slice(0, 60)}" removed from <${tag}>`);
              child.removeAttribute(attr.name);
            } else if (clean !== val) child.setAttribute(attr.name, clean);
            continue;
          }
          if (name === 'target' && !['_blank', '_self'].includes(val)) child.setAttribute(attr.name, '_blank');
          if (name === 'rel' && child.getAttribute('target') === '_blank') child.setAttribute(attr.name, 'noopener noreferrer');
        }
        walk(child);
      }
    };
    walk(root);

    // root-level attributes
    for (const attr of Array.from(root.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) { report.removed.push(`on* handler "${attr.name}" removed from <svg>`); root.removeAttribute(attr.name); }
    }
    if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', SVG_NS);

    // serialize
    let out = new XMLSerializer().serializeToString(root);
    // final belt-and-suspenders: no script tags, no javascript: anywhere
    if (/<script[\s>]/i.test(out) || /javascript\s*:/i.test(out.replace(/data:image\/svg\+xml[^"']*/gi, ''))) {
      report.warnings.push('Residual active content detected — output blocked.');
      return { svg: null, report };
    }
    report.ok = true;
    report.bytesIn = svgText.length;
    report.bytesOut = out.length;
    return { svg: out, report };
  }

  /* ============================== BRAND EXPORT ============================== */
  /* Build downloadable brand-kit files from the BRAND data object. */

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }
  function slug(s) { return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  const exporters = {
    json(brand) {
      return {
        mime: 'application/json', ext: 'json', name: 'brand-kit.json',
        body: JSON.stringify({
          brand: brand.name, exportedAt: new Date().toISOString(),
          taglines: brand.taglines, colors: brand.colors, fonts: brand.fonts,
          voice: brand.voice, assets: brand.assets.map(a => ({ file: a.file, label: a.label, kind: a.kind })),
        }, null, 2),
      };
    },
    css(brand) {
      const lines = [':root {'];
      brand.colors.forEach(c => {
        const [r, g, b] = hexToRgb(c.hex);
        lines.push(`  --ll-${slug(c.name)}: ${c.hex}; /* ${c.role} */`);
        lines.push(`  --ll-${slug(c.name)}-rgb: ${r}, ${g}, ${b};`);
      });
      lines.push('}');
      lines.push('');
      brand.fonts.forEach(f => lines.push(`.font-${slug(f.name)} { font-family: ${f.stack}; } /* ${f.role} */`));
      return { mime: 'text/css', ext: 'css', name: 'lines-logos-tokens.css', body: lines.join('\n') + '\n' };
    },
    scss(brand) {
      const lines = ['// Lines & Logos brand tokens'];
      brand.colors.forEach(c => {
        const [r, g, b] = hexToRgb(c.hex);
        lines.push(`$${slug(c.name).replace(/-/g, '_')}: ${c.hex}; // ${c.role}`);
        lines.push(`$${slug(c.name).replace(/-/g, '_')}_rgb: ${r}, ${g}, ${b};`);
      });
      lines.push('');
      brand.fonts.forEach(f => lines.push(`$font_${slug(f.name).replace(/-/g, '_')}: ${f.stack}; // ${f.role}`));
      return { mime: 'text/x-scss', ext: 'scss', name: 'lines-logos-tokens.scss', body: lines.join('\n') + '\n' };
    },
    tailwind(brand) {
      const colors = brand.colors.map(c => `        '${slug(c.name)}': '${c.hex}',`).join('\n');
      const fontFamily = brand.fonts.map(f => `        ${JSON.stringify(slug(f.name))}: [${f.stack.split(',').map(s => s.trim()).map(s => s.startsWith("'") ? s : JSON.stringify(s)).join(', ')}],`).join('\n');
      const body = `/** Lines & Logos — Tailwind config snippet (merge into tailwind.config.js) */
module.exports = {
  theme: {
    extend: {
      colors: {
${colors}
      },
      fontFamily: {
${fontFamily}
      },
    },
  },
};
`;
      return { mime: 'text/javascript', ext: 'js', name: 'tailwind.brand.js', body };
    },
    gpl(brand) {
      const lines = ['GIMP Palette', 'Name: Lines & Logos', 'Columns: 4', '#'];
      brand.colors.forEach(c => {
        const [r, g, b] = hexToRgb(c.hex);
        lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}   ${c.name}`);
      });
      return { mime: 'text/plain', ext: 'gpl', name: 'lines-logos.gpl', body: lines.join('\n') + '\n' };
    },
    svgSheet(brand) {
      const sw = 220, sh = 150, cols = 4;
      const rows = Math.ceil(brand.colors.length / cols);
      let rects = '';
      brand.colors.forEach((c, i) => {
        const x = (i % cols) * sw, y = Math.floor(i / cols) * sh;
        rects += `<rect x="${x}" y="${y}" width="${sw}" height="${sh}" fill="${c.hex}"/>`;
        rects += `<text x="${x + 12}" y="${y + sh - 34}" font-family="monospace" font-size="15" fill="${isLight(c.hex) ? '#04060d' : '#ffffff'}">${c.name}</text>`;
        rects += `<text x="${x + 12}" y="${y + sh - 14}" font-family="monospace" font-size="13" fill="${isLight(c.hex) ? '#04060d' : '#ffffff'}">${c.hex}</text>`;
      });
      const body = `<svg xmlns="${SVG_NS}" width="${cols * sw}" height="${rows * sh}" viewBox="0 0 ${cols * sw} ${rows * sh}"><rect width="100%" height="100%" fill="#0a1533"/>${rects}</svg>`;
      return { mime: 'image/svg+xml', ext: 'svg', name: 'lines-logos-swatches.svg', body };
    },
  };

  function isLight(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
  }

  function exportBrand(brand, format) {
    const fn = exporters[format];
    if (!fn) throw new Error('Unknown export format: ' + format);
    return fn(brand);
  }

  function download(file) {
    const blob = new Blob([file.body], { type: file.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ============================== CANVAS RUNTIME ============================== */
  /* Layered artboard: pan/zoom, drag from library, select, move, resize, inspect. */

  function createStudio(canvas, opts) {
    const ctx = canvas.getContext('2d');
    const state = {
      layers: [],            // {id,type:'image'|'svg'|'color'|'text',x,y,w,h,rot,opacity,src,name,meta}
      selected: null,
      zoom: 1, panX: 0, panY: 0,
      dragging: null,        // {mode:'move'|'resize'|'pan', ...}
      background: '#0a1533',
      onChange: opts.onChange || (() => {}),
      onSelect: opts.onSelect || (() => {}),
      grid: true,
    };
    let idc = 1;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      canvas.width = r.width * DPR; canvas.height = r.height * DPR;
      canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
      draw();
    }
    window.addEventListener('resize', resize);

    function toWorld(mx, my) { return { x: (mx - state.panX) / state.zoom, y: (my - state.panY) / state.zoom }; }

    function draw() {
      const w = canvas.width / DPR, h = canvas.height / DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = '#04060d';
      ctx.fillRect(0, 0, w, h);
      ctx.translate(state.panX, state.panY);
      ctx.scale(state.zoom, state.zoom);
      // artboard
      ctx.fillStyle = state.background;
      ctx.fillRect(0, 0, 1200, 800);
      if (state.grid) {
        ctx.strokeStyle = 'rgba(141,168,255,.08)'; ctx.lineWidth = 1 / state.zoom;
        for (let x = 0; x <= 1200; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 800); ctx.stroke(); }
        for (let y = 0; y <= 800; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke(); }
      }
      ctx.strokeStyle = 'rgba(141,168,255,.35)'; ctx.lineWidth = 1.5 / state.zoom;
      ctx.strokeRect(0, 0, 1200, 800);

      for (const L of state.layers) {
        ctx.save();
        ctx.globalAlpha = L.opacity;
        ctx.translate(L.x + L.w / 2, L.y + L.h / 2);
        ctx.rotate(L.rot * Math.PI / 180);
        ctx.translate(-L.w / 2, -L.h / 2);
        if (L.type === 'color') {
          ctx.fillStyle = L.src;
          ctx.fillRect(0, 0, L.w, L.h);
          ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1 / state.zoom;
          ctx.strokeRect(0, 0, L.w, L.h);
        } else if (L.type === 'text') {
          ctx.fillStyle = L.meta.color || '#ffffff';
          ctx.font = `${L.meta.weight || 700} ${L.h * 0.62}px ${L.meta.stack || 'sans-serif'}`;
          ctx.textBaseline = 'middle';
          ctx.fillText(L.src, 0, L.h / 2);
        } else if (L.img && L.img.complete && L.img.naturalWidth > 0) {
          ctx.drawImage(L.img, 0, 0, L.w, L.h);
        }
        ctx.restore();
        if (L === state.selected) {
          ctx.save();
          ctx.translate(L.x + L.w / 2, L.y + L.h / 2); ctx.rotate(L.rot * Math.PI / 180); ctx.translate(-L.w / 2, -L.h / 2);
          ctx.strokeStyle = '#57C7FF'; ctx.lineWidth = 1.5 / state.zoom;
          ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
          ctx.strokeRect(-4, -4, L.w + 8, L.h + 8);
          ctx.setLineDash([]);
          // resize handle
          ctx.fillStyle = '#57C7FF';
          ctx.fillRect(L.w - 4, L.h - 4, 8, 8);
          ctx.restore();
        }
      }
    }

    function hit(mx, my) {
      const p = toWorld(mx, my);
      for (let i = state.layers.length - 1; i >= 0; i--) {
        const L = state.layers[i];
        if (p.x >= L.x && p.x <= L.x + L.w && p.y >= L.y && p.y <= L.y + L.h) return L;
      }
      return null;
    }

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }

    function down(e) {
      const p = pos(e);
      const L = hit(p.x, p.y);
      if (L) {
        const w = toWorld(p.x, p.y);
        const onHandle = state.selected === L && w.x >= L.x + L.w - 10 && w.y >= L.y + L.h - 10;
        state.dragging = onHandle
          ? { mode: 'resize', L, sx: w.x, sy: w.y, sw: L.w, sh: L.h }
          : { mode: 'move', L, dx: w.x - L.x, dy: w.y - L.y };
        select(L);
      } else {
        state.dragging = { mode: 'pan', sx: p.x, sy: p.y, px: state.panX, py: state.panY };
        select(null);
      }
      e.preventDefault();
    }
    function move(e) {
      if (!state.dragging) return;
      const p = pos(e);
      const d = state.dragging;
      if (d.mode === 'pan') {
        state.panX = d.px + (p.x - d.sx);
        state.panY = d.py + (p.y - d.sy);
      } else {
        const w = toWorld(p.x, p.y);
        if (d.mode === 'move') { d.L.x = w.x - d.dx; d.L.y = w.y - d.dy; }
        else {
          d.L.w = Math.max(12, d.sw + (w.x - d.sx));
          d.L.h = Math.max(12, d.sh + (w.y - d.sy));
        }
        state.onChange();
      }
      draw();
      e.preventDefault();
    }
    function up() { state.dragging = null; }

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const nz = Math.min(4, Math.max(0.15, state.zoom * factor));
      state.panX = p.x - (p.x - state.panX) * (nz / state.zoom);
      state.panY = p.y - (p.y - state.panY) * (nz / state.zoom);
      state.zoom = nz;
      draw();
    }, { passive: false });

    function select(L) {
      state.selected = L;
      state.onSelect(L);
      draw();
    }

    const api = {
      state,
      resize, draw, select,
      addLayer(spec) {
        const L = Object.assign({ id: idc++, x: 80, y: 80, w: 200, h: 200, rot: 0, opacity: 1, meta: {} }, spec);
        if (L.type === 'image' || L.type === 'svg') {
          const img = new Image();
          /* same-origin assets — no crossOrigin needed, and adding it would
             require CORS headers on the server or canvas.toBlob() taints. */
          img.onload = () => { if (!spec.w && !spec.h) { const s = Math.min(400 / img.width, 400 / img.height, 1); L.w = img.width * s; L.h = img.height * s; } draw(); };
          img.src = L.src;
          L.img = img;
        }
        state.layers.push(L);
        select(L);
        state.onChange();
        return L;
      },
      addImage(src, name) { return api.addLayer({ type: 'image', src, name: name || src.split('/').pop() }); },
      addSvg(svgText, name) {
        /* base64 data URI — the app CSP is img-src 'self' data:, so blob: URLs
           would be blocked; data: URIs render fine and don't taint the canvas. */
        const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
        const L = api.addLayer({ type: 'svg', src: url, name: name || 'sanitized.svg', meta: { svgText } });
        return L;
      },
      addColor(hex, name) { return api.addLayer({ type: 'color', src: hex, name: name || hex, w: 160, h: 110 }); },
      addText(text, meta) { return api.addLayer({ type: 'text', src: text, name: 'Text', w: Math.max(120, text.length * (meta.size || 28) * 0.62), h: (meta.size || 28) * 1.3, meta: meta || {} }); },
      remove(id) {
        const i = state.layers.findIndex(l => l.id === id);
        if (i >= 0) { if (state.layers[i].revoke) state.layers[i].revoke(); state.layers.splice(i, 1); }
        if (state.selected && state.selected.id === id) select(null);
        state.onChange();
      },
      clear() { state.layers.forEach(l => l.revoke && l.revoke()); state.layers = []; select(null); state.onChange(); },
      update(id, patch) {
        const L = state.layers.find(l => l.id === id);
        if (L) { Object.assign(L, patch); draw(); state.onChange(); }
      },
      zoom(f) { state.zoom = Math.min(4, Math.max(0.15, state.zoom * f)); draw(); },
      resetView() { state.zoom = 1; state.panX = 40; state.panY = 40; draw(); },
      /* Render current artboard (1200x800) to a raster file. */
      render(format, quality) {
        const off = document.createElement('canvas');
        off.width = 1200; off.height = 800;
        const c = off.getContext('2d');
        c.fillStyle = state.background; c.fillRect(0, 0, 1200, 800);
        const jobs = state.layers.map(L => new Promise(res => {
          if (L.type === 'color') { c.fillStyle = L.src; c.fillRect(L.x, L.y, L.w, L.h); return res(); }
          if (L.type === 'text') {
            c.save(); c.globalAlpha = L.opacity; c.fillStyle = L.meta.color || '#fff';
            c.font = `${L.meta.weight || 700} ${L.h * 0.62}px ${L.meta.stack || 'sans-serif'}`;
            c.textBaseline = 'middle'; c.fillText(L.src, L.x, L.y + L.h / 2); c.restore();
            return res();
          }
          const drawImg = (img) => { c.save(); c.globalAlpha = L.opacity; c.drawImage(img, L.x, L.y, L.w, L.h); c.restore(); res(); };
          if (L.img && L.img.complete && L.img.naturalWidth > 0) { drawImg(L.img); return; }
          const img = new Image();
          img.onload = () => drawImg(img);
          img.onerror = () => res();
          img.src = L.src;
        }));
        return Promise.all(jobs).then(() => new Promise(res => {
          off.toBlob(b => res(b), format === 'jpg' ? 'image/jpeg' : 'image/png', quality || 0.92);
        }));
      },
    };
    resize();
    api.resetView();
    return api;
  }

  window.Studio = { sanitizeSvg, exportBrand, download, createStudio, hexToRgb, rgbToHsl, slug };
})();
