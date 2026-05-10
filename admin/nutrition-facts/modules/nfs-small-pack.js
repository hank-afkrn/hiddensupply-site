/**
 * nfs-small-pack.js — Small Pack Asset Generator v3.1
 *
 * Single renderer path for both preview and export.
 * Generates: nutrition_panel.svg/.png, ingredients_panel.svg/.png, barcode_panel.svg/.png
 * Nothing else. No preview files, no README, no distributor atom.
 *
 * Micro NF panel design:
 *   - "NUTRITION FACTS" title has its own row (protected zone)
 *   - Serving info on second line below title
 *   - Calories row dominant
 *   - Nutrients inline/linear — compact but intentional
 *   - Width: 252px (≈2.625") — fits 6"×5" blister easily
 *   - Art-directed spacing, not HTML-squeeze
 */

// ── Constants ─────────────────────────────────────────────────────────────────
const SPC_W     = 252;   // panel width px (2.625" at 96dpi)
const SPC_PX    = 5;     // outer padding
const SPC_IW    = SPC_W - SPC_PX * 2;  // inner width

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
const R_AFTER_TITLE  = 3;   // gap after title block to thick rule
const R_AFTER_CAL    = 4;   // gap after calories to thin rule
const R_ROW_GAP      = 9;   // line height for nutrient rows
const R_MICRO_GAP    = 8;   // line height for micro rows
const R_AFTER_NUTRIENTS = 3; // gap before thick rule before micros
const R_AFTER_MICROS = 2;   // gap before footnote rule

// ── State ─────────────────────────────────────────────────────────────────────
let _spcType = 'split';
let _spcZoom = 1;

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
  const saved = localStorage.getItem('spc_last_type') || 'split';
  spcSelectType(saved, true);
}

// ── Type selection ────────────────────────────────────────────────────────────
function spcSelectType(type, silent) {
  _spcType = type;
  localStorage.setItem('spc_last_type', type);
  const radio = document.querySelector(`input[name="spc-type"][value="${type}"]`);
  if (radio) radio.checked = true;
  ['single','mini','mini-ing','split'].forEach(t => {
    const lbl = document.getElementById('spc-type-' + t + '-lbl');
    if (!lbl) return;
    lbl.style.borderColor = t === type ? 'var(--accent)' : 'var(--border)';
    lbl.style.background  = t === type ? 'var(--accent-bg)' : '';
  });
  const btn = document.getElementById('spc-export-btn');
  if (btn) btn.innerHTML = type === 'split' ? '📦 Export Split Pack (.zip)' : '📄 Export';
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

  // Always render all 3 atoms side by side in preview
  const svgN = spcNFMicroSVG(d);
  const svgI = spcIngSVG(d);
  const svgB = spcBarcodeSVG(d);

  const card = (label, svg) =>
    `<div style="display:inline-block;vertical-align:top;margin-right:12px;">
      <div style="font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#888;margin-bottom:4px;">${label}</div>
      <img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"
           style="display:block;border:1px solid #dde;background:#fff;max-width:300px;">
    </div>`;

  inner.innerHTML =
    card('Nutrition Panel', svgN) +
    card('Ingredients', svgI) +
    card('Barcode', svgB);

  inner.style.transform = `scale(${_spcZoom})`;
  inner.style.transformOrigin = 'top left';
}

// ── Export dispatcher ─────────────────────────────────────────────────────────
function spcDoExport() {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Project', 'Open a label first.'); return; }
  const name = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  spcExportZip(d, name);
  if (typeof trackExport === 'function') trackExport('small-pack-split', d.name);
}

function spcQuickExport(type) {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Label Data', 'Open and edit a label first.'); return; }
  const name = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  spcExportZip(d, name);
  if (typeof trackExport === 'function') trackExport('small-pack-quick-' + type, d.name);
}

// ── ZIP: exactly 6 files ──────────────────────────────────────────────────────
function spcExportZip(d, name) {
  if (typeof toast === 'function') toast('Building ZIP…', 'Generating SVG atoms…', 3500);
  _loadJSZip(() => {
    const zip    = new JSZip();
    const folder = zip.folder(name + '_split_pack');

    const svgN = spcNFMicroSVG(d);
    const svgI = spcIngSVG(d);
    const svgB = spcBarcodeSVG(d);

    folder.file('nutrition_panel.svg',  svgN);
    folder.file('ingredients_panel.svg', svgI);
    folder.file('barcode_panel.svg',    svgB);

    Promise.all([
      spcSVGtoPNGBlob(svgN).then(b => { if (b) folder.file('nutrition_panel.png',  b); }),
      spcSVGtoPNGBlob(svgI).then(b => { if (b) folder.file('ingredients_panel.png', b); }),
      spcSVGtoPNGBlob(svgB).then(b => { if (b) folder.file('barcode_panel.png',    b); }),
    ]).then(() => {
      zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url;
        a.download = name + '_split_pack.zip';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
        if (typeof toast === 'function') toast('ZIP Downloaded', `${name}_split_pack.zip — 6 files`);
        const st = document.getElementById('spc-export-status');
        if (st) st.textContent = '✓ ZIP: nutrition, ingredients, barcode  (SVG + PNG each)';
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
  els += svgRect(P, y, iW, 5, '#000');
  y += 8;

  // ── ZONE 3: Calories (dominant) ──────────────────────────────────────────
  els += tx(P + 1, y + T_CAL_LBL - 1, 'Calories', T_CAL_LBL, 900);
  els += tx(W - P - 1, y + T_CAL_NUM - 1, esc(d.calories), T_CAL_NUM, 900, 'end');
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
  els += svgRect(P, y, iW, 4, '#000');
  y += 7;

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
  y += T_FOOT + P + 1;

  // Outer border
  const H = y;
  const border = `<rect x="${P/2}" y="${P/2}" width="${W - P}" height="${H - P/2}" fill="none" stroke="#000" stroke-width="1.2"/>`;

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
    const lines = wrapLine('INGREDIENTS: ' + rawIng);
    lines.forEach((ln, i) => {
      y += fs;
      if (i === 0 && ln.startsWith('INGREDIENTS:')) {
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
function spcBarcodeSVG(d) {
  // UPC-A encoding tables
  const UPC_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const UPC_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  const G_OUT = '101', G_MID = '01010';

  if (!d.hasBarcode) {
    const W = SPC_W, H = 60;
    const content = `<rect x="4" y="4" width="${W-8}" height="${H-12}" fill="none" stroke="#ccc" stroke-dasharray="3,2" rx="2"/>` +
      `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-family="Arial" font-size="8" fill="#bbb">No barcode configured</text>`;
    return svgRoot(content, W, H);
  }

  const code = (d.barcodeCode || '').replace(/\D/g,'').padEnd(12,'0').slice(0,12);
  let seq = G_OUT;
  for (let i = 0; i < 6; i++)  seq += UPC_L[parseInt(code[i]) || 0];
  seq += G_MID;
  for (let i = 6; i < 12; i++) seq += UPC_R[parseInt(code[i]) || 0];
  seq += G_OUT;

  const UNIT     = 1.8;  // module width px
  const BAR_H    = 48;   // normal bar height
  const GUARD_H  = 56;   // guard bar height
  const QZ       = 10;   // quiet zone
  const TOP      = 4;
  const DIGIT_H  = 10;

  const barW = seq.length * UNIT;
  const W    = Math.ceil(barW + QZ * 2);
  const H    = TOP + GUARD_H + DIGIT_H + 2;

  let bars = '';
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === '1') {
      const isGuard = i < 3 || i >= seq.length - 3 || (i >= 45 && i <= 49);
      const bh = isGuard ? GUARD_H : BAR_H;
      bars += svgRect((QZ + i * UNIT).toFixed(1), TOP, UNIT.toFixed(1), bh, '#000');
    }
  }

  const digits = `<text x="${W/2}" y="${H - 2}" text-anchor="middle" ` +
    `font-family="'Courier New',Courier,monospace" font-size="8" fill="#000">${code.slice(0,6)}\u2009${code.slice(6)}</text>`;

  return svgRoot(bars + digits, W, H);
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
