/**
 * nfs-small-pack.js — Small Pack Asset Generator v3.3
 *
 * Single renderer path for both preview and export.
 * Generates: nutrition_panel.svg/.png, ingredients_panel.svg/.png, barcode_panel.svg/.png
 * Nothing else. No preview files, no README, no distributor atom.
 *
 * Export types:
 *   split      — full micro NF panel + ingredients + barcode (separate files per zone)
 *   simplified — Simplified NF format for ≤40 sq in packages (2"×2" blister zones)
 *                FDA 21 CFR 101.9(j)(13): only Calories, Fat, Sodium, Carbs, Sugars,
 *                Added Sugars (with % DV), Protein. No micros, no full % DV column.
 *
 * Split pack size presets (spcSize):
 *   standard   — 252px / 2.625"  — standard blister card (default)
 *   compact    — 192px / 2.0"    — 2"×2" tight zone (new)
 *   micro      — 144px / 1.5"    — absolute minimum FDA-legible
 */

// ── Constants ─────────────────────────────────────────────────────────────────
// Base width — overridden by _spcSize at render time
const SPC_W_PRESETS = {
  standard: 252,  // 2.625" at 96dpi — standard blister
  compact:  192,  // 2.0"  at 96dpi — 2"×2" blister zone
  micro:    144,  // 1.5"  at 96dpi — absolute minimum
};
let   SPC_W     = 252;   // active panel width (updated by spcSetSize)
const SPC_PX    = 5;     // outer padding
let   SPC_IW    = SPC_W - SPC_PX * 2;  // inner width (recomputed in spcSetSize)

// Typography scale (SVG px; 1pt = 1.333px; FDA min 6pt = 8px)
const T_TITLE   = 13;    // "NUTRITION FACTS" — large, bold, own line
const T_SERV    = 7.5;   // serving info
const T_CAL_LBL = 9.5;   // "Calories" label
const T_CAL_NUM = 16;    // calorie number — dominant
const T_NUT     = 7.5;   // nutrient row text
const T_DV_HDR  = 6.5;   // "% Daily Value*" header
const T_MICRO   = 6.5;   // vitamins/minerals row
const T_FOOT    = 6;     // footnote

// Rhythm — intentional whitespace between zones
const R_AFTER_TITLE  = 2;   // gap after title block to thick rule
const R_AFTER_CAL    = 3;   // gap after calories to thin rule
const R_ROW_GAP      = 8;   // line height for nutrient rows
const R_MICRO_GAP    = 7;   // line height for micro rows
const R_AFTER_NUTRIENTS = 2; // gap before thick rule before micros
const R_AFTER_MICROS = 1;   // gap before footnote rule

// ── State ─────────────────────────────────────────────────────────────────────
let _spcType = 'split';
let _spcZoom = 1;
let _spcSize = 'standard';  // size preset for split pack export

// ── JSZip loader ─────────────────────────────────────────────────────────────
function _loadJSZip(cb) {
  if (window.JSZip) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  s.onload = cb;
  s.onerror = () => { if (typeof toast === 'function') toast('JSZip unavailable', 'Check internet connection.'); };
  document.head.appendChild(s);
}

// ── Init ─────────────────────────────────────────────────────────────────────
function spcInit() {
  const d = spcGetData();
  const has = !!d;
  const noEl   = document.getElementById('spc-no-project');
  const mainEl = document.getElementById('spc-main');
  if (noEl)   noEl.style.display   = has ? 'none' : 'block';
  if (mainEl) mainEl.style.display = has ? 'block' : 'none';
  if (!has) return;
  const savedSize = localStorage.getItem('spc_last_size') || 'standard';
  spcSetSize(savedSize, true);
  const savedType = localStorage.getItem('spc_last_type') || 'split';
  spcSelectType(savedType, true);
  spcRenderPreview();
}

// ── Size preset ───────────────────────────────────────────────────────────────
function spcSetSize(size, silent) {
  _spcSize = size || 'standard';
  localStorage.setItem('spc_last_size', _spcSize);
  SPC_W  = SPC_W_PRESETS[_spcSize] || 252;
  SPC_IW = SPC_W - SPC_PX * 2;
  // Update ALL size button sets (quick export sidebar + export center + small pack view)
  const prefixes = ['qs-size-', 'spc-size-', 'spc-sp-size-'];
  ['standard','compact','micro'].forEach(s => {
    prefixes.forEach(pfx => {
      const btn = document.getElementById(pfx + s);
      if (!btn) return;
      btn.style.background   = s === _spcSize ? 'var(--accent)' : 'var(--surface)';
      btn.style.color        = s === _spcSize ? '#fff'          : 'var(--text)';
      btn.style.borderColor  = s === _spcSize ? 'var(--accent)' : 'var(--border)';
      btn.style.fontWeight   = s === _spcSize ? '700'           : '400';
    });
  });
  if (!silent) spcRenderPreview();
}

// ── Type selection ────────────────────────────────────────────────────────────
function spcSelectType(type, silent) {
  _spcType = type;
  localStorage.setItem('spc_last_type', type);
  const radio = document.querySelector(`input[name="spc-type"][value="${type}"]`);
  if (radio) radio.checked = true;
  ['single','mini','mini-ing','split','simplified','tabular','linear'].forEach(t => {
    const lbl = document.getElementById('spc-type-' + t + '-lbl');
    if (!lbl) return;
    lbl.style.borderColor = t === type ? 'var(--accent)' : 'var(--border)';
    lbl.style.background  = t === type ? 'var(--accent-bg)' : '';
  });
  // Show/hide size toggle — relevant for split, simplified, tabular, and linear
  const sizeToggle = document.getElementById('spc-size-toggle');
  if (sizeToggle) sizeToggle.style.display = (type === 'split' || type === 'simplified' || type === 'tabular' || type === 'linear') ? 'block' : 'none';
  // Show/hide split options
  const splitOpts = document.getElementById('spc-split-options');
  if (splitOpts) splitOpts.style.display = type === 'split' ? 'block' : 'none';
  const btn = document.getElementById('spc-export-btn');
  if (btn) {
    if (type === 'split')           btn.innerHTML = '📦 Export Split Pack (.zip)';
    else if (type === 'simplified') btn.innerHTML = '📄 Export Simplified NF (.zip)';
    else if (type === 'tabular')    btn.innerHTML = '📄 Export Compact Tabular (.zip)';
    else if (type === 'linear')     btn.innerHTML = '📄 Export Linear NF (.zip)';
    else                            btn.innerHTML = '📄 Export';
  }
  if (!silent) spcRenderPreview();
}

// ── Zoom ─────────────────────────────────────────────────────────────────────
function spcZoom(dir) {
  const steps = [0.5, 0.67, 0.75, 1, 1.25, 1.5, 2];
  let idx = steps.findIndex(s => Math.abs(s - _spcZoom) < 0.01);
  if (idx < 0) idx = 3;
  idx = Math.max(0, Math.min(steps.length - 1, idx + dir));
  _spcZoom = steps[idx];
  const inner = document.getElementById('spc-preview-inner');
  if (inner) { inner.style.transform = `scale(${_spcZoom})`; inner.style.transformOrigin = 'top left'; }
  const lbl = document.getElementById('spc-zoom-label');
  if (lbl) lbl.textContent = Math.round(_spcZoom * 100) + '%';
}

// ── Preview ───────────────────────────────────────────────────────────────────
// Single renderer path — preview uses exact same SVGs as export.
function spcRenderPreview() {
  const inner = document.getElementById('spc-preview-inner');
  if (!inner) return;
  const d = spcGetData();
  if (!d) {
    inner.innerHTML = '<div style="font-size:12px;color:#999;padding:32px;text-align:center;">Open a label to preview.</div>';
    return;
  }

  // Sync size before rendering
  SPC_W  = SPC_W_PRESETS[_spcSize] || 252;
  SPC_IW = SPC_W - SPC_PX * 2;

  const card = (label, svg, badge) =>
    `<div style="display:inline-block;vertical-align:top;margin-right:12px;margin-bottom:12px;">
      <div style="font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#888;margin-bottom:4px;">${label}${badge ? ` <span style="background:rgba(139,92,246,.18);color:#a78bfa;padding:1px 5px;border-radius:3px;font-size:7px;">${badge}</span>` : ''}</div>
      <img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"
           style="display:block;border:1px solid #dde;background:#fff;max-width:320px;">
    </div>`;

  if (_spcType === 'simplified') {
    const svgN = spcNFSimplifiedSVG(d);
    const svgI = spcIngSVG(d);
    inner.innerHTML =
      card('Simplified Nutrition Facts', svgN, '≤40 sq in') +
      card('Ingredients', svgI);
    inner.style.transform = `scale(${_spcZoom})`;
    inner.style.transformOrigin = 'top left';
    return;
  }

  if (_spcType === 'tabular') {
    const svgT = spcNFTabularSVG(d);
    inner.innerHTML = card('Compact Tabular NF', svgT, 'blister card');
    inner.style.transform = `scale(${_spcZoom})`;
    inner.style.transformOrigin = 'top left';
    return;
  }

  if (_spcType === 'linear') {
    const svgL = spcNFLinearSVG(d);
    inner.innerHTML = card('Linear NF', svgL, 'most compact');
    inner.style.transform = `scale(${_spcZoom})`;
    inner.style.transformOrigin = 'top left';
    return;
  }

  const svgN = spcNFMicroSVG(d);
  const svgI = spcIngSVG(d);
  const svgL = spcNFLinearSVG(d);

  // Show nutrition + ingredients + linear immediately; barcode loads async
  inner.innerHTML =
    card('Nutrition Panel', svgN) +
    card('Ingredients', svgI) +
    `<div id="spc-bc-preview-slot" style="display:inline-block;vertical-align:top;margin-bottom:12px;">
      <div style="font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#888;margin-bottom:4px;">Barcode</div>
      <div style="font-size:10px;color:#aaa;padding:8px;">Loading…</div>
    </div>` +
    card('Linear Panel', svgL, 'linear');

  inner.style.transform = `scale(${_spcZoom})`;
  inner.style.transformOrigin = 'top left';

  spcBarcodeSVG(d).then(svgB => {
    const slot = document.getElementById('spc-bc-preview-slot');
    if (slot) slot.outerHTML = card('Barcode', svgB);
  });
}

// ── Export dispatcher ─────────────────────────────────────────────────────────
function spcDoExport() {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Project', 'Open a label first.'); return; }
  // Sync size
  SPC_W  = SPC_W_PRESETS[_spcSize] || 252;
  SPC_IW = SPC_W - SPC_PX * 2;
  const name = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (_spcType === 'simplified') {
    spcExportSimplifiedZip(d, name);
    if (typeof trackExport === 'function') trackExport('small-pack-simplified', d.name);
  } else if (_spcType === 'tabular') {
    spcExportTabularZip(d, name);
    if (typeof trackExport === 'function') trackExport('small-pack-tabular', d.name);
  } else if (_spcType === 'linear') {
    spcExportLinearZip(d, name);
    if (typeof trackExport === 'function') trackExport('small-pack-linear', d.name);
  } else {
    spcExportZip(d, name);
    if (typeof trackExport === 'function') trackExport('small-pack-split', d.name);
  }
}

function spcQuickExport(type) {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Label Data', 'Open and edit a label first.'); return; }
  SPC_W  = SPC_W_PRESETS[_spcSize] || 252;
  SPC_IW = SPC_W - SPC_PX * 2;
  const name = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (type === 'simplified') {
    spcExportSimplifiedZip(d, name);
    if (typeof trackExport === 'function') trackExport('small-pack-quick-simplified', d.name);
  } else if (type === 'tabular') {
    spcExportTabularZip(d, name);
    if (typeof trackExport === 'function') trackExport('small-pack-quick-tabular', d.name);
  } else if (type === 'linear') {
    spcExportLinearZip(d, name);
    if (typeof trackExport === 'function') trackExport('small-pack-quick-linear', d.name);
  } else {
    spcExportZip(d, name);
    if (typeof trackExport === 'function') trackExport('small-pack-quick-' + type, d.name);
  }
}

// ── ZIP: 8 files (+ linear panel) ────────────────────────────────────────────
function spcExportZip(d, name) {
  if (typeof toast === 'function') toast('Building ZIP…', 'Rendering panels…', 4000);
  Promise.all([
    Promise.resolve(spcNFMicroSVG(d)),
    Promise.resolve(spcIngSVG(d)),
    spcBarcodeSVG(d),
    Promise.resolve(spcNFLinearSVG(d)),
  ]).then(([svgN, svgI, svgB, svgL]) => {
    _loadJSZip(() => {
      const zip    = new JSZip();
      const folder = zip.folder(name + '_split_pack');

      folder.file('nutrition_panel.svg',        svgN);
      folder.file('ingredients_panel.svg',      svgI);
      folder.file('barcode_panel.svg',          svgB);
      folder.file('nutrition_panel_linear.svg', svgL);

      Promise.all([
        spcSVGtoPNGBlob(svgN).then(b => { if (b) folder.file('nutrition_panel.png',        b); }),
        spcSVGtoPNGBlob(svgI).then(b => { if (b) folder.file('ingredients_panel.png',      b); }),
        spcSVGtoPNGBlob(svgB).then(b => { if (b) folder.file('barcode_panel.png',          b); }),
        spcSVGtoPNGBlob(svgL).then(b => { if (b) folder.file('nutrition_panel_linear.png', b); }),
      ]).then(() => {
        zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(blob => {
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href = url;
          a.download = name + '_split_pack.zip';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
          if (typeof toast === 'function') toast('ZIP Downloaded', `${name}_split_pack.zip — 8 files (+ linear panel)`);
          const st = document.getElementById('spc-export-status');
          if (st) st.textContent = '✓ ZIP: nutrition, ingredients, barcode, linear panel (SVG + PNG each)';
        });
      });
    });
  });
}

// ── SIMPLIFIED NF ZIP export ──────────────────────────────────────────────────
// For ≤40 sq in packages. Exports: simplified_nf.svg/.png + ingredients.svg/.png
function spcExportSimplifiedZip(d, name) {
  if (typeof toast === 'function') toast('Building ZIP…', 'Generating simplified FDA panel…', 3000);
  const svgN = spcNFSimplifiedSVG(d);
  const svgI = spcIngSVG(d);
  _loadJSZip(() => {
    const zip    = new JSZip();
    const folder = zip.folder(name + '_simplified_nf');
    folder.file('simplified_nf.svg',   svgN);
    folder.file('ingredients.svg',     svgI);
    Promise.all([
      spcSVGtoPNGBlob(svgN).then(b => { if (b) folder.file('simplified_nf.png',  b); }),
      spcSVGtoPNGBlob(svgI).then(b => { if (b) folder.file('ingredients.png', b); }),
    ]).then(() => {
      zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url;
        a.download = name + '_simplified_nf.zip';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
        if (typeof toast === 'function') toast('ZIP Downloaded', `${name}_simplified_nf.zip — 4 files (SVG + PNG each)`);
        const st = document.getElementById('spc-export-status');
        if (st) st.textContent = '✓ ZIP: simplified_nf + ingredients (SVG + PNG each)';
      });
    });
  });
}

// ── COMPACT TABULAR ZIP export ────────────────────────────────────────────────
// Standalone tabular panel export — 2 files: compact_tabular_nf.svg + compact_tabular_nf.png
function spcExportTabularZip(d, name) {
  if (typeof toast === 'function') toast('Building ZIP…', 'Generating compact tabular NF panel…', 3000);
  const svgT = spcNFTabularSVG(d);
  _loadJSZip(() => {
    const zip    = new JSZip();
    const folder = zip.folder(name + '_compact_tabular');
    folder.file('compact_tabular_nf.svg', svgT);
    spcSVGtoPNGBlob(svgT).then(b => {
      if (b) folder.file('compact_tabular_nf.png', b);
      zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url;
        a.download = name + '_compact_tabular.zip';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
        if (typeof toast === 'function') toast('ZIP Downloaded', `${name}_compact_tabular.zip — SVG + PNG`);
        const st = document.getElementById('spc-export-status');
        if (st) st.textContent = '✓ ZIP: compact_tabular_nf (SVG + PNG)';
      });
    });
  });
}

// ── LINEAR NF ZIP export ──────────────────────────────────────────────────────
// Standalone linear panel export — 2 files: linear_nf.svg + linear_nf.png
function spcExportLinearZip(d, name) {
  if (typeof toast === 'function') toast('Building ZIP…', 'Generating linear NF panel…', 3000);
  const svgL = spcNFLinearSVG(d);
  _loadJSZip(() => {
    const zip    = new JSZip();
    const folder = zip.folder(name + '_linear_nf');
    folder.file('linear_nf.svg', svgL);
    spcSVGtoPNGBlob(svgL).then(b => {
      if (b) folder.file('linear_nf.png', b);
      zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url;
        a.download = name + '_linear_nf.zip';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
        if (typeof toast === 'function') toast('ZIP Downloaded', `${name}_linear_nf.zip — SVG + PNG`);
        const st = document.getElementById('spc-export-status');
        if (st) st.textContent = '✓ ZIP: linear_nf (SVG + PNG)';
      });
    });
  });
}

// SVG → PNG Blob @3x (288 ppi press-ready)
function spcSVGtoPNGBlob(svgStr) {
  return new Promise(resolve => {
    try {
      const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        const scale = 3;
        const w = img.naturalWidth  || 252;
        const h = img.naturalHeight || 150;
        const c = document.createElement('canvas');
        c.width  = w * scale;
        c.height = h * scale;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(b => resolve(b), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch(e) { resolve(null); }
  });
}

// ── SVG primitives ────────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function svgRect(x, y, w, h, fill) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill||'#000'}"/>`;
}

function svgLine(x1, y1, x2, y2, sw, color) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color||'#000'}" stroke-width="${sw||0.5}"/>`;
}

// Root SVG wrapper — transparent bg option
function svgRoot(content, w, h, transparent) {
  const bg = transparent ? '' : `<rect width="${w}" height="${h}" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${bg}\n${content}\n</svg>`;
}

// Base text node builder
function tx(x, y, content, size, weight, anchor, fill) {
  return `<text x="${x}" y="${y}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight||400}" text-anchor="${anchor||'start'}" fill="${fill||'#000'}">${content}</text>`;
}

// ── MICRO NF PANEL SVG ────────────────────────────────────────────────────────
//
// Layout (zones, top to bottom):
//
// ┌─────────────────────────────────────────┐  ← border
// │  NUTRITION FACTS        [bold, large]   │  ← zone 1: title (own row)
// │  [spc] servings  Serving size [x]       │  ← zone 2: serving info (own row)
// │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← thick rule
// │  Calories                          [N]  │  ← zone 3: calories (dominant)
// │─────────────────────────────────────────│  ← medium rule
// │                        % Daily Value*   │  ← DV header
// │  Total Fat [x]g [x]% · Sat Fat [x]g    │  ← zone 4: nutrient rows (inline)
// │  Cholesterol [x]mg [x]% · Sodium [x]mg │
// │  Total Carb. [x]g [x]% · Fiber [x]g   │
// │    Sugars [x]g · Added Sugars [x]g [x]%│
// │  Protein [x]g                           │
// │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← thick rule
// │  Vit D · Calcium · Iron · Potassium    │  ← zone 5: micros (single line)
// │─────────────────────────────────────────│  ← thin rule
// │  *footnote abbreviated                  │  ← zone 6: footnote
// └─────────────────────────────────────────┘  ← border
//
function spcNFMicroSVG(d) {
  const W  = SPC_W;
  const P  = SPC_PX;
  const iW = SPC_IW;
  let y    = 0;
  let els  = '';

  // Accessors
  const v   = k => String(d[k]?.val || '0');
  const pct = k => { const x = d[k]?.pct; return (x && x !== '0') ? `\u00a0${x}%` : ''; };

  // ── ZONE 1: Title ────────────────────────────────────────────────────────
  y += P + T_TITLE;
  els += tx(P + 1, y, 'NUTRITION FACTS', T_TITLE, 900);
  y += R_AFTER_TITLE;

  // ── ZONE 2: Serving info (own row, smaller) ───────────────────────────────
  const srvParts = [];
  if (d.servingPerContainer) srvParts.push(`${esc(d.servingPerContainer)} servings per container`);
  if (d.servingSize)         srvParts.push(`Serving size ${esc(d.servingSize)}`);
  if (srvParts.length) {
    y += T_SERV + 1;
    els += tx(P + 1, y, srvParts.join('  ·  '), T_SERV, 400);
    y += 2;
  }

  // ── Thick rule ────────────────────────────────────────────────────────────
  y += 1;
  els += svgRect(P, y, iW, 4, '#000');
  y += 6;

  // ── ZONE 3: Calories (dominant) ──────────────────────────────────────────
  els += tx(P + 1, y + T_CAL_LBL - 1, 'Calories', T_CAL_LBL, 900);
  els += tx(W - P - 1, y + T_CAL_NUM - 2, esc(d.calories), T_CAL_NUM, 900, 'end');
  y += T_CAL_NUM + R_AFTER_CAL;

  // ── Medium rule ───────────────────────────────────────────────────────────
  els += svgLine(P, y, W - P, y, 2, '#000');
  y += 3;

  // ── % DV header ──────────────────────────────────────────────────────────
  els += tx(W - P - 1, y + T_DV_HDR, '% Daily Value*', T_DV_HDR, 700, 'end');
  y += T_DV_HDR + 2;

  // ── ZONE 4: Nutrient rows ────────────────────────────────────────────────
  // Helper: renders one inline row with a thin rule above
  const nutRow = (segments) => {
    els += svgLine(P, y, W - P, y, 0.4, '#000');
    y += 1;
    // Build tspan chain
    const parts = segments.map((seg, i) => {
      const sep = i > 0 ? `<tspan fill="#888"> · </tspan>` : '';
      const bold = seg.bold ? ' font-weight="700"' : '';
      return `${sep}<tspan${bold}>${seg.text}</tspan>`;
    }).join('');
    els += `<text x="${P+2}" y="${y + T_NUT}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${T_NUT}" fill="#000">${parts}</text>`;
    y += R_ROW_GAP;
  };

  // Segment builder
  const seg  = (label, k, unit, bold) => ({
    text: `${label}\u00a0${esc(v(k))}${unit}${pct(k)}`,
    bold: !!bold,
  });

  // Row 1 — Fats
  nutRow([
    seg('Total Fat',    'tf', 'g',  true),
    seg('Saturated Fat','sf', 'g',  false),
    { text: `\u202fTrans Fat\u00a0${esc(v('xf'))}g`, bold: false },
  ]);

  // Row 2 — Cholesterol + Sodium
  nutRow([
    seg('Cholesterol', 'ch', 'mg', true),
    seg('Sodium',      'na', 'mg', true),
  ]);

  // Row 3 — Carbs + Fiber
  nutRow([
    seg('Total Carb.',   'tc', 'g', true),
    seg('Dietary Fiber', 'df', 'g', false),
  ]);

  // Row 4 — Sugars (indented feel via label text)
  const asV   = esc(v('as_'));
  const asPct = d['as_']?.pct;
  const asDV  = (asPct && asPct !== '0') ? `\u00a0${asPct}%` : '';
  nutRow([
    { text: `Total Sugars\u00a0${esc(v('su'))}g`, bold: false },
    { text: `Incl.\u00a0${asV}g Added Sugars${asDV}`, bold: false },
  ]);

  // Row 5 — Protein (heavy bottom rule)
  els += svgLine(P, y, W - P, y, 0.4, '#000');
  y += 1;
  els += `<text x="${P+2}" y="${y + T_NUT}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${T_NUT}" font-weight="700" fill="#000">Protein\u00a0${esc(v('pr'))}g</text>`;
  y += R_ROW_GAP;

  // ── Thick rule before micros ──────────────────────────────────────────────
  y += R_AFTER_NUTRIENTS;
  els += svgRect(P, y, iW, 3, '#000');
  y += 5;

  // ── ZONE 5: Micros — single compact line ─────────────────────────────────
  const microSegs = [
    `Vit. D\u00a0${esc(v('vd'))}mcg${pct('vd')}`,
    `Calcium\u00a0${esc(v('ca'))}mg${pct('ca')}`,
    `Iron\u00a0${esc(v('fe'))}mg${pct('fe')}`,
    `Potassium\u00a0${esc(v('k'))}mg${pct('k')}`,
  ].map((s, i) => (i > 0 ? `<tspan fill="#888">  </tspan><tspan>${s}</tspan>` : `<tspan>${s}</tspan>`)).join('');
  els += `<text x="${P+2}" y="${y + T_MICRO}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${T_MICRO}" fill="#000">${microSegs}</text>`;
  y += R_MICRO_GAP + R_AFTER_MICROS;

  // ── Thin rule ─────────────────────────────────────────────────────────────
  els += svgLine(P, y, W - P, y, 0.5, '#000');
  y += 2;

  // ── ZONE 6: Footnote ─────────────────────────────────────────────────────
  els += tx(P + 1, y + T_FOOT, '*%DV based on a 2,000 calorie/day diet.', T_FOOT, 400);
  y += T_FOOT + P - 1;

  // Outer border
  const H = y;
  const border = `<rect x="${P/2}" y="${P/2}" width="${W - P}" height="${H - P/2}" fill="none" stroke="#000" stroke-width="1.2"/>`;

  return svgRoot(border + els, W, H);
}

// ── SIMPLIFIED NUTRITION FACTS SVG ───────────────────────────────────────────
//
// FDA 21 CFR 101.9(j)(13) — Simplified format for packages with
// ≤40 sq in of total label surface area.
//
// Required nutrients ONLY:
//   Calories, Total Fat (g), Sodium (mg), Total Carbohydrate (g),
//   Total Sugars (g), Added Sugars (g + % DV), Protein (g)
//
// % DV required ONLY for Added Sugars (and any nutrients with claims).
// Vitamins/minerals: omitted entirely (permitted when ≤40 sq in).
// Footnote: abbreviated — "% DV based on 2,000 cal diet."
//
// Layout:
// ┌────────────────────────────────┐
// │ Nutrition Facts                │  ← title (bold, large)
// │ [N] servings · Serving [x]     │  ← serving line
// │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← thick rule
// │ Calories               [N]     │  ← calories dominant
// │────────────────────────────────│  ← medium rule
// │ Total Fat [x]g                 │  ← simplified nutrient block
// │ Sodium [x]mg                   │    (no % DV except added sugars)
// │ Total Carb. [x]g               │
// │   Total Sugars [x]g            │
// │   Incl. [x]g Added Sugars [x]% │  ← % DV required here
// │ Protein [x]g                   │
// │────────────────────────────────│  ← thin rule
// │ *%DV based on 2,000 cal diet.  │  ← short footnote
// └────────────────────────────────┘
//
function spcNFSimplifiedSVG(d) {
  const W  = SPC_W;
  const P  = SPC_PX;
  const iW = SPC_IW;

  // Scale typography to panel width (proportional to 192px base)
  const scale = W / 192;
  const sc = v => Math.round(v * scale * 10) / 10;

  const TS_TITLE  = sc(12);   // "Nutrition Facts"
  const TS_SERV   = sc(7);    // serving line
  const TS_CAL_L  = sc(9);    // "Calories" label
  const TS_CAL_N  = sc(15);   // calorie number
  const TS_NUT    = sc(7.5);  // nutrient rows
  const TS_FOOT   = sc(6);    // footnote (FDA min 6pt)
  const RG_NUT    = sc(9);    // row gap for nutrients

  let y   = 0;
  let els = '';

  const v   = k => String(d[k]?.val || '0');
  const pct = k => { const x = d[k]?.pct; return (x && x !== '0') ? ` ${x}%` : ''; };

  // ── Title ────────────────────────────────────────────────────────────────
  y += P + TS_TITLE;
  els += tx(P + 1, y, 'Nutrition Facts', TS_TITLE, 900);
  y += 2;

  // ── Serving line ─────────────────────────────────────────────────────────
  const srvParts = [];
  if (d.servingPerContainer) srvParts.push(`${esc(d.servingPerContainer)} servings`);
  if (d.servingSize)         srvParts.push(`Serving ${esc(d.servingSize)}`);
  if (srvParts.length) {
    y += TS_SERV + 1;
    els += tx(P + 1, y, srvParts.join('  ·  '), TS_SERV, 400);
    y += 2;
  }

  // ── Thick rule ───────────────────────────────────────────────────────────
  y += 1;
  els += svgRect(P, y, iW, sc(4), '#000');
  y += sc(4) + 2;

  // ── Calories (dominant) ──────────────────────────────────────────────────
  const calTop = y;
  els += tx(P + 1, calTop + TS_CAL_L, 'Calories', TS_CAL_L, 700);
  els += tx(W - P - 1, calTop + TS_CAL_N, esc(d.calories), TS_CAL_N, 900, 'end');
  y = calTop + TS_CAL_N + 3;

  // ── Medium rule ──────────────────────────────────────────────────────────
  els += svgLine(P, y, W - P, y, 1.5, '#000');
  y += 3;

  // ── Simplified nutrient rows (no % DV column except Added Sugars) ────────
  const nutSimple = (label, val, unit, bold, indent) => {
    els += svgLine(P, y, W - P, y, 0.4, '#000');
    y += 1;
    const xPos = P + 2 + (indent ? sc(10) : 0);
    const bw   = bold ? '700' : '400';
    els += `<text x="${xPos}" y="${y + TS_NUT}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${TS_NUT}" font-weight="${bw}" fill="#000">${esc(label)}\u00a0<tspan font-weight="700">${esc(val)}${esc(unit)}</tspan></text>`;
    y += RG_NUT;
  };

  // Total Fat — no % DV (simplified format omits unless nutrients have claims)
  nutSimple('Total Fat', v('tf'), 'g', true, false);
  // Sodium
  nutSimple('Sodium', v('na'), 'mg', true, false);
  // Total Carb
  nutSimple('Total Carb.', v('tc'), 'g', true, false);
  // Total Sugars (indented)
  nutSimple('Total Sugars', v('su'), 'g', false, true);
  // Added Sugars — % DV IS REQUIRED here even in simplified format
  {
    els += svgLine(P, y, W - P, y, 0.4, '#000');
    y += 1;
    const asV   = esc(v('as_'));
    const asPct = d['as_']?.pct;
    const asDV  = (asPct && asPct !== '0') ? `\u00a0${asPct}% DV` : '';
    els += `<text x="${P + 2 + sc(10)}" y="${y + TS_NUT}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${TS_NUT}" fill="#000">Incl.\u00a0<tspan font-weight="700">${asV}g</tspan> Added Sugars<tspan font-weight="700">${asDV}</tspan></text>`;
    y += RG_NUT;
  }
  // Protein
  nutSimple('Protein', v('pr'), 'g', true, false);

  // ── Thin rule ────────────────────────────────────────────────────────────
  els += svgLine(P, y, W - P, y, 0.5, '#000');
  y += 2;

  // ── Footnote (abbreviated — full footnote not required for simplified) ───
  els += tx(P + 1, y + TS_FOOT, `*%DV based on a 2,000 calorie diet.`, TS_FOOT, 400);
  y += TS_FOOT + P;

  const H = y;
  const border = `<rect x="${P/2}" y="${P/2}" width="${W - P}" height="${H - P/2}" fill="none" stroke="#000" stroke-width="1.2"/>`;
  return svgRoot(border + els, W, H);
}

// ── COMPACT TABULAR NF PANEL SVG ─────────────────────────────────────────────
//
// FDA 21 CFR 101.9(j)(13)(ii)(A) — Tabular display for small/intermediate packages.
// Square-ish layout: two-column (Amount | %DV), Calories prominent, nutrients in tight rows.
// Micronutrients in compact bullet line at bottom.
//
// Layout:
// ┌────────────────────────────────┐
// │ NUTRITION FACTS                │  ← bold title
// │ 3 servings per container       │  ← servings line
// │ Serving size  1/3 piece (28g)  │  ← serving size line
// │████████████████████████████████│  ← thick rule (4px)
// │ Calories              160      │  ← large calories
// │────────────────────────────────│  ← thin rule
// │              Amount  %DV       │  ← column headers (right-aligned)
// │ Total Fat    0g       0%       │
// │  Sat. Fat    0g       0%       │
// │  Trans Fat   0g                │
// │ Cholesterol  0mg      0%       │
// │ Sodium       32mg     1%       │
// │ Total Carb.  37g      14%      │
// │  Dietary Fiber 0g     0%       │
// │  Total Sugars  37g             │
// │   Incl. 14g Added Sugars  75%  │
// │ Protein      2g               │
// │████████████████████████████████│  ← thick rule
// │ Vit.D 0mcg · Calcium 0mg ···  │  ← micro line
// │────────────────────────────────│  ← thin rule
// │ *The %DV tells you… 2,000 cal  │  ← footnote
// └────────────────────────────────┘
//
function spcNFTabularSVG(d) {
  const W       = SPC_W;
  const P       = 5;
  const BORDER  = 3;
  const iW      = W - P * 2;

  // Typography
  const FS_TITLE = 11;   // "NUTRITION FACTS"
  const FS_SERV  = 7.5;  // servings / serving size lines
  const FS_CAL_L = 8;    // "Calories" label
  const FS_CAL_N = 16;   // calorie number (large)
  const FS_HDR   = 6.5;  // column header "Amount per serving / %DV"
  const FS_NUT   = 7.5;  // nutrient rows
  const FS_MICRO = 6.5;  // micronutrient bullet line
  const FS_FOOT  = 6.5;  // footnote

  const LH_SERV  = 9.5;
  const LH_NUT   = 9;
  const LH_CAL   = 20;   // calories row height (big number)

  const v   = k => String(d[k]?.val  || '0');
  const pct = k => { const x = d[k]?.pct; return (x && x !== '0') ? x + '%' : '0%'; };
  const hasPct = k => { const x = d[k]?.pct; return !!(x && x !== '0'); };

  // Column layout — right edges
  // | label ... | amount right=xAmt | %DV right=xDV |
  const xDV  = W - P - 1;         // %DV column right edge
  const xAmt = xDV - 26;          // Amount column right edge (26px for "0%" + space)
  const xLbl = P + 2;             // label left edge

  let y   = P;
  let els = '';

  const txt = (x, yy, content, fs, fw, anchor) =>
    `<text x="${x}" y="${yy}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="${fw||400}" text-anchor="${anchor||'start'}" fill="#000">${content}</text>`;

  const rule = (yy, sw) =>
    `<line x1="${P}" y1="${yy}" x2="${W-P}" y2="${yy}" stroke="#000" stroke-width="${sw}"/>`;

  // ── Title ──────────────────────────────────────────────────────────────────
  y += FS_TITLE + 4;
  els += txt(xLbl, y, 'NUTRITION FACTS', FS_TITLE, 900);

  // ── Servings ───────────────────────────────────────────────────────────────
  if (d.servingPerContainer) {
    y += LH_SERV;
    els += txt(xLbl, y, esc(`${d.servingPerContainer} servings per container`), FS_SERV, 700);
  }
  if (d.servingSize) {
    y += LH_SERV;
    els += txt(xLbl, y, `<tspan font-weight="900">Serving size</tspan><tspan font-weight="400">  ${esc(d.servingSize)}</tspan>`, FS_SERV, 400);
  }

  // ── Thick rule ─────────────────────────────────────────────────────────────
  y += 5;
  els += rule(y, 4);
  y += 4;

  // ── Calories ───────────────────────────────────────────────────────────────
  y += LH_CAL - 2;
  els += txt(xLbl, y, '<tspan font-size="8" font-weight="900">Calories</tspan>', FS_CAL_L, 400);
  els += txt(xDV, y, esc(String(d.calories || '0')), FS_CAL_N, 900, 'end');

  // ── Thin rule ──────────────────────────────────────────────────────────────
  y += 4;
  els += rule(y, 0.5);
  y += 2;

  // ── Column header ──────────────────────────────────────────────────────────
  y += FS_HDR + 1;
  els += txt(xAmt, y, 'Amount', FS_HDR, 700, 'end');
  els += txt(xDV,  y, '%DV*',   FS_HDR, 700, 'end');

  // ── Thin rule ──────────────────────────────────────────────────────────────
  y += 3;
  els += rule(y, 0.5);

  // ── Nutrient row helper ────────────────────────────────────────────────────
  // indent: extra left indent in px (for sub-rows)
  const nutRow = (label, amtText, dvText, bold, indent) => {
    y += LH_NUT;
    const fw  = bold ? 900 : 700;
    const lx  = xLbl + (indent || 0);
    els += rule(y + 1.5, 0.5);  // thin rule below each row
    els += txt(lx,   y, esc(label),  FS_NUT, fw);
    els += txt(xAmt, y, esc(amtText), FS_NUT, 400, 'end');
    if (dvText) els += txt(xDV, y, esc(dvText), FS_NUT, 700, 'end');
  };

  nutRow('Total Fat',       `${v('tf')}g`,  pct('tf'), true,  0);
  if (v('sf') !== '0') nutRow('Sat. Fat',   `${v('sf')}g`, pct('sf'), false, 6);
  if (v('xf') !== '0') nutRow('Trans Fat',  `${v('xf')}g`, '',        false, 6);
  nutRow('Cholesterol',     `${v('ch')}mg`, pct('ch'), true,  0);
  nutRow('Sodium',          `${v('na')}mg`, pct('na'), true,  0);
  nutRow('Total Carb.',     `${v('tc')}g`,  pct('tc'), true,  0);
  if (v('df') !== '0') nutRow('Dietary Fiber', `${v('df')}g`, pct('df'), false, 6);
  nutRow('Total Sugars',    `${v('su')}g`,  '',        false, 6);

  // Added Sugars sub-row
  {
    const asV   = v('as_');
    const asDV  = hasPct('as_') ? pct('as_') : '';
    y += LH_NUT;
    els += rule(y + 1.5, 0.5);
    els += txt(xLbl + 10, y, esc(`Incl. ${asV}g Added Sugars`), FS_NUT, 400);
    if (asDV) els += txt(xDV, y, esc(asDV), FS_NUT, 700, 'end');
  }

  nutRow('Protein', `${v('pr')}g`, '', true, 0);

  // ── Thick rule ─────────────────────────────────────────────────────────────
  y += 5;
  els += rule(y, 3);
  y += 3;

  // ── Micronutrient bullet line ──────────────────────────────────────────────
  const micros = [];
  const addMicro = (label, key, unit) => {
    const val = v(key);
    const dv  = hasPct(key) ? ' ' + pct(key) : '';
    micros.push(`${label} ${val}${unit}${dv}`);
  };
  addMicro('Vit. D',   'vd', 'mcg');
  addMicro('Calcium',  'ca', 'mg');
  addMicro('Iron',     'fe', 'mg');
  addMicro('Potassium','k',  'mg');

  y += FS_MICRO + 3;
  const microLine = micros.join(' \u2022 ');
  els += txt(xLbl, y, esc(microLine), FS_MICRO, 400);

  // ── Thin rule + footnote ───────────────────────────────────────────────────
  y += 4;
  els += rule(y, 0.5);
  y += FS_FOOT + 3;
  els += txt(xLbl, y, '*%DV = % Daily Value. 2,000 cal/day used for general advice.', FS_FOOT, 400);

  y += P + 2;
  const H      = y;
  const border = `<rect x="${BORDER/2}" y="${BORDER/2}" width="${W-BORDER}" height="${H-BORDER}" fill="none" stroke="#000" stroke-width="${BORDER}"/>`;
  return svgRoot(border + els, W, H);
}

// ── LINEAR NF PANEL SVG ───────────────────────────────────────────────────────
//
// FDA 21 CFR 101.9(j)(13)(ii)(B) — Linear display format.
// Allowed when total label surface area ≤40 sq in.
//
// Layout: paragraph-style prose, nutrients run inline with commas.
// %DV inline in parens after each value. Bold on key nutrient names.
//
// Key rules:
//  - "Nutrition Facts" flows inline with serving info — all one paragraph
//  - Each "NutrientName value unit (%DV)," is an ATOMIC chunk — never splits
//  - Line breaks happen between chunks only
//  - Bold: Nutrition Facts, Calories, Total Fat, Cholesterol, Sodium, Total Carb., Protein
//
// Width is set by SPC_W (uses same presets as split/simplified).
// Height auto-adjusts to content.
//
function spcNFLinearSVG(d) {
  // ── Typography ────────────────────────────────────────────────────────────
  // Competitor style: bold labels, normal-weight values, huge Calories number.
  // FDA min = 6pt = 8px. All sizes in SVG px.
  const P        = SPC_PX;   // outer padding
  const BORDER   = 3;        // box border — thick like competitor

  // Token types and their visual properties
  // type: 'title' | 'lbl' | 'val' | 'cal-lbl' | 'cal-num' | 'foot'
  const STYLE = {
    title:   { fs: 12,   fw: 900, cw: 0.61 },  // "Nutrition Facts" — large bold title
    lbl:     { fs: 8.5,  fw: 900, cw: 0.60 },  // nutrient labels — bold
    val:     { fs: 8.5,  fw: 400, cw: 0.51 },  // nutrient values — normal weight
    'cal-lbl': { fs: 8.5, fw: 900, cw: 0.60 }, // "Calories " label — bold, same size as lbl
    'cal-num': { fs: 16, fw: 900, cw: 0.61 },  // "160," — ~1.9× body, not gigantic
    foot:    { fs: 7.5,  fw: 700, cw: 0.52 },  // footnote
  };

  const tw = (text, type) => text.length * STYLE[type].cw * STYLE[type].fs;

  const v   = k => String(d[k]?.val || '0');
  const pct = k => { const x = d[k]?.pct; return (x && x !== '0') ? ` (${x}% DV)` : ''; };

  // ── Token builder ─────────────────────────────────────────────────────────
  // A "chunk" is an array of tokens that must stay on the same line.
  // A "token" is { text, type }.
  const chunks = [];

  // Header line: "Nutrition Facts" (title) + "Servings: 5," (val)
  // Pack them together so they always appear on the same first line
  {
    const headerTokens = [{ text: 'Nutrition Facts', type: 'title' }];
    if (d.servingPerContainer) headerTokens.push({ text: ` Servings: `, type: 'lbl' }, { text: `${d.servingPerContainer},`, type: 'val' });
    chunks.push(headerTokens);
  }

  // Serv. size — own line (bold label, normal value)
  if (d.servingSize) {
    chunks.push([
      { text: 'Serv. size: ', type: 'lbl' },
      { text: `${d.servingSize},`,  type: 'val' },
    ]);
  }

  // "Amount per serving:" — bold, FORCED to its own line (never shares with serv. size)
  // We mark it with a lineBreak flag so the wrap loop always starts a new line before it.
  chunks.push([{ text: 'Amount per serving:', type: 'lbl', forceNewLine: true }]);

  // Calories — own line, nothing else shares it
  chunks.push([
    { text: 'Calories ', type: 'cal-lbl', forceNewLine: true, forceOwnLine: true },
    { text: `${d.calories},`, type: 'cal-num' },
  ]);

  // Nutrient helper: bold label + normal value, atomic chunk
  const nc = (label, val) => chunks.push([
    { text: label, type: 'lbl' },
    { text: val,   type: 'val' },
  ]);

  nc('Total Fat ',   `${v('tf')}g${pct('tf')},`);
  if (v('sf') !== '0') nc('Saturated Fat ', `${v('sf')}g${pct('sf')},`);
  if (v('xf') !== '0') nc('Trans Fat ',     `${v('xf')}g,`);
  nc('Cholesterol ', `${v('ch')}mg${pct('ch')},`);
  nc('Sodium ',      `${v('na')}mg${pct('na')},`);
  nc('Total Carb. ', `${v('tc')}g${pct('tc')},`);
  if (v('df') !== '0') nc('Dietary Fiber ', `${v('df')}g${pct('df')},`);

  // Total Sugars — label normal (competitor style), split Added Sugars onto own chunk if needed
  const asV  = v('as_');
  const asPct = d['as_']?.pct;
  const asDV  = (asPct && asPct !== '0') ? `, ${asPct}% DV` : '';
  nc('Total Sugars ', `${v('su')}g`);
  chunks.push([{ text: `(Incl. ${asV}g Added Sugars${asDV}),`, type: 'val' }]);

  nc('Protein ', `${v('pr')}g.`);

  // ── Word-wrap onto lines ──────────────────────────────────────────────────
  // Wrap at SPC_IW; box width then shrinks to widest rendered line.
  const chunkW  = ch => ch.reduce((s, t) => s + tw(t.text, t.type), 0);
  const SPACE_W = STYLE.val.fs * 0.51 * 0.8;   // inter-chunk space width estimate
  const wrapAt  = SPC_IW - 4;

  const lines  = [];
  let curLine  = [];
  let curLineW = 0;

  const flushLine = () => {
    if (curLine.length) { lines.push({ chunks: curLine, w: curLineW }); curLine = []; curLineW = 0; }
  };

  for (const ch of chunks) {
    const cw_ch     = chunkW(ch);
    const forceBreak = ch[0]?.forceNewLine;
    const forceEnd   = ch[0]?.forceOwnLine; // flush after as well

    if (forceBreak) flushLine();

    const needed = curLine.length > 0 ? SPACE_W + cw_ch : cw_ch;
    if (curLine.length > 0 && curLineW + needed > wrapAt) {
      flushLine();
    }
    const isFirst = curLine.length === 0;
    curLine.push(ch);
    curLineW += isFirst ? cw_ch : SPACE_W + cw_ch;

    if (forceEnd) flushLine();
  }
  flushLine();

  // Auto-fit box width to content (no dead whitespace)
  const footText = '*%DV based on a 2,000 calorie/day diet.';
  const footW    = tw(footText, 'foot');
  const contentW = Math.max(...lines.map(l => l.w), footW);
  const W        = Math.ceil(contentW + P * 2 + 8);

  // ── Render SVG ────────────────────────────────────────────────────────────
  let y   = P;
  let els = '';

  for (const { chunks: lineChunks } of lines) {
    // Line height: use the tallest token's font size + small gap
    const maxFS = Math.max(...lineChunks.flatMap(ch => ch.map(t => STYLE[t.type].fs)));
    y += maxFS + 3;   // font size + 3px gap

    let tspans = '';
    lineChunks.forEach((ch, ci) => {
      if (ci > 0) {
        // inter-chunk space at base val size
        tspans += `<tspan font-size="${STYLE.val.fs}" font-weight="400"> </tspan>`;
      }
      ch.forEach(tok => {
        const { fs, fw } = STYLE[tok.type];
        tspans += `<tspan font-size="${fs}" font-weight="${fw}">${esc(tok.text)}</tspan>`;
      });
    });
    els += `<text x="${P + 3}" y="${y}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" dominant-baseline="auto" fill="#000">${tspans}</text>`;
  }

  // Footnote rule + text
  y += 5;
  els += svgLine(P, y, W - P, y, 1, '#000');
  y += 3;
  const { fs: ffs, fw: ffw } = STYLE.foot;
  els += `<text x="${P + 3}" y="${y + ffs}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${ffs}" font-weight="${ffw}" fill="#000">${esc(footText)}</text>`;
  y += ffs + P;

  const H      = y;
  const border = `<rect x="${BORDER / 2}" y="${BORDER / 2}" width="${W - BORDER}" height="${H - BORDER}" fill="none" stroke="#000" stroke-width="${BORDER}"/>`;
  return svgRoot(border + els, W, H);
}

// ── INGREDIENTS SVG ───────────────────────────────────────────────────────────
function spcIngSVG(d) {
  const W    = SPC_W;
  const P    = SPC_PX;
  const fs   = T_NUT;
  const lh   = R_ROW_GAP + 1;
  // Approximate chars per line at this font size and width
  const maxCh = Math.floor(SPC_IW / (fs * 0.52));

  const wrapLine = (text) => {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (next.length > maxCh && cur) { lines.push(cur); cur = w; }
      else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  let y   = P;
  let els = '';

  const rawIng = (d.ingredients || '').trim();
  const rawAl  = (d.allergenText || '').trim();

  if (rawIng) {
    // Strip any existing "Ingredients:" / "INGREDIENTS:" prefix the form may have saved
    const ingClean = rawIng.replace(/^ingredients\s*:\s*/i, '').trim();
    const lines = wrapLine('INGREDIENTS: ' + ingClean);
    lines.forEach((ln, i) => {
      y += fs;
      if (i === 0) {
        // Bold the "INGREDIENTS:" prefix, normal weight for the rest
        const colon = ln.indexOf(':') + 1;
        const pre   = esc(ln.slice(0, colon));
        const rest  = esc(ln.slice(colon));
        els += `<text x="${P}" y="${y}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" fill="#000"><tspan font-weight="700">${pre}</tspan><tspan>${rest}</tspan></text>`;
      } else {
        els += tx(P, y, esc(ln), fs, 400);
      }
      y += lh - fs;
    });
  }

  if (rawAl) {
    y += 3;
    const lines = wrapLine(rawAl);
    lines.forEach(ln => {
      y += fs;
      els += tx(P, y, esc(ln), fs, 700);
      y += lh - fs;
    });
  }

  if (!rawIng && !rawAl) {
    y += fs + 4;
    els += tx(P, y, 'No ingredient data.', fs, 400, 'start', '#aaa');
    y += 4;
  }

  const H = y + P + 2;
  return svgRoot(els, W, H);
}

// ── BARCODE SVG ───────────────────────────────────────────────────────────────
// Uses JsBarcode (same library as the main label system) rendered into a
// detached SVG element, then serialized. This guarantees identical geometry,
// module widths, quiet zones, and guard bar proportions to the working barcode.
// Falls back to a placeholder rect when no barcode is configured.

function spcBarcodeSVG(d, cb) {
  // Always returns a Promise<string> — caller must await it.
  return new Promise(resolve => {
    if (!d.hasBarcode) {
      const W = SPC_W, H = 64;
      resolve(svgRoot(
        `<rect x="4" y="4" width="${W-8}" height="${H-12}" fill="none" stroke="#ccc" stroke-dasharray="3,2" rx="2"/>` +
        `<text x="${W/2}" y="${H/2+4}" text-anchor="middle" font-family="Arial" font-size="8" fill="#bbb">No barcode configured</text>`,
        W, H
      ));
      return;
    }

    const code = (d.barcodeCode || '').replace(/\D/g,'').padEnd(12,'0').slice(0,12);
    const format = (d.barcodeType || 'UPC-A').replace('-','') === 'EAN13' ? 'EAN13' : 'UPC';

    const doRender = () => {
      try {
        // Create a detached SVG element — JsBarcode writes into it in-place
        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        JsBarcode(svgEl, code, {
          format,
          width:        1.6,   // module width (matches main label: 1.5)
          height:       50,    // bar height (matches main label: 50)
          displayValue: true,
          fontSize:     10,
          margin:       8,     // quiet zone (matches main label margin: 4 + extra for export)
          background:   '#ffffff',
          lineColor:    '#000000',
          textMargin:   2,
          fontOptions:  '',
          font:         'monospace',
        });

        // Serialize the rendered SVG
        const serialized = new XMLSerializer().serializeToString(svgEl);
        resolve(serialized);
      } catch(e) {
        // Render error fallback
        const W = SPC_W, H = 64;
        resolve(svgRoot(
          `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-family="Arial" font-size="8" fill="#c00">Barcode render error: ${esc(e.message)}</text>`,
          W, H
        ));
      }
    };

    // Load JsBarcode if not already available (same CDN as main label)
    if (window.JsBarcode) {
      doRender();
    } else {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js';
      s.onload  = doRender;
      s.onerror = () => {
        const W = SPC_W, H = 64;
        resolve(svgRoot(
          `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-family="Arial" font-size="8" fill="#c00">JsBarcode unavailable</text>`,
          W, H
        ));
      };
      document.head.appendChild(s);
    }
  });
}

// ── Data extraction ───────────────────────────────────────────────────────────
function spcGetData() {
  const p  = (typeof window.nfsGetCurrent === 'function') ? window.nfsGetCurrent() : null;
  const fv = id => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  if (!p && !fv('n-cal') && !fv('e-ss') && !fv('e-ing')) return null;

  const N  = p?.nutrients || {};
  const DV = p?.dv || {};

  const nd = (key, fid) => {
    const s = N[key]?.declared;
    return (s !== '' && s != null) ? String(s) : (fid ? fv(fid) || '0' : '0');
  };
  const dv = (key, fid) => {
    const s = DV[key];
    return (s !== '' && s != null) ? String(s) : (fid ? fv(fid) || '0' : '0');
  };
  const nr = (key, dvKey, nf, pf) => ({ val: nd(key, nf), pct: dvKey ? dv(dvKey, pf) : null });

  const bc       = p?.barcode || {};
  const rawDist  = (p?.distributor || fv('e-dist')).trim();
  const distLines = rawDist.split(/[\n|]/).map(l => l.trim()).filter(Boolean);
  const oz = p?.netOz || fv('e-oz');
  const g  = p?.netG  || fv('e-g');
  const netWt = (oz || g)
    ? `NET WT ${oz ? oz + ' OZ' : ''}${oz && g ? ' (' : ''}${g ? g + 'g' : ''}${oz && g ? ')' : ''}`.trim()
    : '';
  const ing  = (p?.ingredients    || fv('e-ing')).trim();
  const alCu = (p?.allergenCustom || fv('e-al-custom')).trim();
  const allergenText = alCu || ((p?.allergens || []).length ? 'Contains: ' + p.allergens.join(', ') + '.' : '');

  return {
    name:                p?.name || fv('nl-name') || 'Label',
    servingSize:         p?.servingSize         || fv('e-ss'),
    servingPerContainer: p?.servingsPerContainer || fv('e-spc'),
    calories:            nd('cal', 'n-cal'),
    tf:  nr('tf',  'tf',  'n-tf',  'p-tf'),
    sf:  nr('sf',  'sf',  'n-sf',  'p-sf'),
    xf:  nr('xf',  null,  'n-xf',  null),
    ch:  nr('ch',  'ch',  'n-ch',  'p-ch'),
    na:  nr('na',  'na',  'n-na',  'p-na'),
    tc:  nr('tc',  'tc',  'n-tc',  'p-tc'),
    df:  nr('df',  'df',  'n-df',  'p-df'),
    su:  nr('su',  null,  'n-su',  null),
    as_: nr('as_', 'as_', 'n-as',  'p-as'),
    pr:  nr('pr',  null,  'n-pr',  null),
    vd:  nr('vd',  'vd',  'n-vd',  'p-vd'),
    ca:  nr('ca',  'ca',  'n-ca',  'p-ca'),
    fe:  nr('fe',  'fe',  'n-fe',  'p-fe'),
    k:   nr('k',   'k',   'n-k',   'p-k'),
    ingredients:   ing,
    allergenText:  allergenText,
    distLines:     distLines,
    origin:        (p?.origin  || fv('e-origin')).trim(),
    netWt:         netWt,
    warning:       (p?.warning || fv('e-warn')).trim(),
    hasBarcode:    !!(bc.include && bc.mode === 'real' && bc.code),
    barcodeCode:   bc.code || '',
    barcodeType:   bc.type || 'UPC-A',
  };
}

// Hook: refresh preview when editor updates
(function() {
  const orig = window.editorUpdate;
  if (typeof orig === 'function') {
    window.editorUpdate = function() {
      orig.apply(this, arguments);
      const sp = document.getElementById('view-small-pack');
      if (sp && sp.classList.contains('active')) spcRenderPreview();
    };
  }
})();
