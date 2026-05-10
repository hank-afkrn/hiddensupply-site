/**
 * nfs-small-pack.js — Small Pack Asset Generator v3.0
 *
 * Generates production-ready design atoms for constrained packaging.
 * Target: 6"×5" shaped blister cards, die-cut packs, narrow strips.
 *
 * Renderer modes:
 *  micro  — competitor-style, single-line title, linear nutrients, squat horizontal (DEFAULT for split)
 *  mini   — compact vertical, still tight, for slightly larger panels
 *
 * Export:
 *  ZIP containing: nutrition.svg, nutrition.png, ingredients.svg, ingredients.png,
 *                  barcode.svg, barcode.png, distributor.svg, distributor.png,
 *                  preview.svg
 *
 * No HTML-only files. Every atom is SVG-first, PNG second.
 *
 * FDA ref: 21 CFR 101.9(j)(13) — small/intermediate packages
 * Competitor ref: inline linear layout, single-line title, ~0.35 h/w ratio
 */

// ── State ────────────────────────────────────────────────────────────────────
let _spcType   = 'single';
let _spcZoom   = 1;
let _spcRender = 'micro'; // 'micro' | 'mini'

// ── JSZip loader ─────────────────────────────────────────────────────────────
let _jsZipReady = false;
function _loadJSZip(cb) {
  if (window.JSZip) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  s.onload = () => { _jsZipReady = true; cb(); };
  s.onerror = () => { if (typeof toast === 'function') toast('JSZip unavailable', 'Check internet connection.'); };
  document.head.appendChild(s);
}

// ── Init ─────────────────────────────────────────────────────────────────────
function spcInit() {
  const d = spcGetData();
  const hasProject = !!d;
  const noEl = document.getElementById('spc-no-project');
  const mainEl = document.getElementById('spc-main');
  if (noEl) noEl.style.display = hasProject ? 'none' : 'block';
  if (mainEl) mainEl.style.display = hasProject ? 'block' : 'none';
  if (!hasProject) return;
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
  const splitOpts = document.getElementById('spc-split-options');
  if (splitOpts) splitOpts.style.display = type === 'split' ? 'block' : 'none';
  const btn = document.getElementById('spc-export-btn');
  if (btn) {
    const labels = {
      single:    '📄 Export Single PDF',
      mini:      '📦 Export Mini FDA Panel',
      'mini-ing':'📦 Export Mini FDA + Ingredients',
      split:     '📦 Export Designer Split Pack (.zip)',
    };
    btn.innerHTML = labels[type] || '📄 Generate Export';
  }
  const title = document.getElementById('spc-preview-title');
  if (title) {
    const titles = {
      single:    'Preview — Full Label',
      mini:      'Preview — Mini FDA Panel',
      'mini-ing':'Preview — Mini FDA + Ingredients',
      split:     'Preview — Split Pack Atoms',
    };
    title.textContent = titles[type] || 'Preview';
  }
  if (!silent) spcRenderPreview();
}

// ── Render preview ────────────────────────────────────────────────────────────
function spcRenderPreview() {
  const d = spcGetData();
  const inner = document.getElementById('spc-preview-inner');
  if (!inner) return;
  if (!d) {
    inner.innerHTML = '<div style="font-size:12px;color:#999;text-align:center;padding:40px;">No project data.</div>';
    return;
  }
  const mode = (document.getElementById('spc-render-mode')?.value) || 'micro';
  _spcRender = mode;

  let html = '';
  switch (_spcType) {
    case 'mini':
      html = spcSVGtoImg(spcNFMicroSVG(d)) + '<div style="margin-top:8px;">' + spcSVGtoImg(spcIngSVG(d)) + '</div>';
      break;
    case 'mini-ing':
      html = spcSVGtoImg(spcNFMicroSVG(d)) + '<div style="margin-top:6px;">' + spcSVGtoImg(spcIngSVG(d)) + '</div>';
      break;
    case 'split': {
      const incN = document.getElementById('spc-inc-nutrition')?.checked !== false;
      const incI = document.getElementById('spc-inc-ingredients')?.checked !== false;
      const incB = document.getElementById('spc-inc-barcode')?.checked !== false;
      const incD = document.getElementById('spc-inc-dist')?.checked;
      const atoms = [];
      if (incN) atoms.push(spcPreviewAtom('① Nutrition',   spcSVGtoImg(spcNFMicroSVG(d))));
      if (incI) atoms.push(spcPreviewAtom('② Ingredients', spcSVGtoImg(spcIngSVG(d))));
      if (incB) atoms.push(spcPreviewAtom('③ Barcode',     spcSVGtoImg(spcBarcodeSVG(d))));
      if (incD) atoms.push(spcPreviewAtom('④ Distributor', spcSVGtoImg(spcDistSVG(d))));
      html = `<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;">${atoms.join('')}</div>`;
      break;
    }
    default:
      html = spcSVGtoImg(spcNFMicroSVG(d));
      break;
  }
  inner.innerHTML = html;
  inner.style.transform = `scale(${_spcZoom})`;
  inner.style.transformOrigin = 'top left';
}

function spcPreviewAtom(label, imgHtml) {
  return `<div>
    <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-bottom:4px;">${label}</div>
    ${imgHtml}
  </div>`;
}

// Inline SVG → <img> for preview (avoids foreignObject issues)
function spcSVGtoImg(svgStr) {
  const encoded = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  return `<img src="${encoded}" style="display:block;max-width:100%;border:1px solid #e2e8f0;background:#fff;">`;
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

// ── Main export dispatcher ───────────────────────────────────────────────────
function spcDoExport() {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Project', 'Open a label first.'); return; }
  const name = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const setStatus = msg => { const el = document.getElementById('spc-export-status'); if (el) el.textContent = msg; };

  switch (_spcType) {
    case 'mini':
    case 'mini-ing':
      spcExportZip(d, name, true, _spcType === 'mini-ing', false, false, false);
      setStatus('✓ ZIP downloaded');
      break;
    case 'split': {
      const incN = document.getElementById('spc-inc-nutrition')?.checked !== false;
      const incI = document.getElementById('spc-inc-ingredients')?.checked !== false;
      const incB = document.getElementById('spc-inc-barcode')?.checked !== false;
      const incD = document.getElementById('spc-inc-dist')?.checked;
      spcExportZip(d, name, incN, incI, incB, incD, true);
      setStatus('✓ ZIP downloaded — open SVGs in Illustrator/Figma');
      break;
    }
    default:
      // Single: fall back to HTML print
      spcExportSingleHTML(d, name);
      setStatus('✓ HTML exported — open in browser → Print → Save as PDF');
      break;
  }
  if (typeof trackExport === 'function') trackExport('small-pack-' + _spcType, d.name);
}

// ── Quick export (from rail / Export Center) ──────────────────────────────────
function spcQuickExport(type) {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Label Data', 'Open and edit a label first.'); return; }
  const name = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  switch (type) {
    case 'mini':
      spcExportZip(d, name, true, false, false, false, false);
      break;
    case 'mini-ing':
      spcExportZip(d, name, true, true, false, false, false);
      break;
    case 'split':
      spcExportZip(d, name, true, true, true, !!(d.distLines.length || d.origin), true);
      break;
  }
  if (typeof trackExport === 'function') trackExport('small-pack-quick-' + type, d.name);
}

// ── ZIP export ────────────────────────────────────────────────────────────────
function spcExportZip(d, name, incN, incI, incB, incD, incPreview) {
  if (typeof toast === 'function') toast('Building ZIP…', 'Generating SVG atoms…', 3000);
  _loadJSZip(() => {
    const zip = new JSZip();
    const folder = zip.folder(name + '_split_pack');

    const adds = [];
    if (incN) {
      const svg = spcNFMicroSVG(d);
      folder.file('micro_nutrition_panel.svg', svg);
      adds.push(spcSVGtoPNGBlob(svg).then(b => { if (b) folder.file('micro_nutrition_panel.png', b); }));
    }
    if (incI) {
      const svg = spcIngSVG(d);
      folder.file('ingredients_panel.svg', svg);
      adds.push(spcSVGtoPNGBlob(svg).then(b => { if (b) folder.file('ingredients_panel.png', b); }));
    }
    if (incB) {
      const svg = spcBarcodeSVG(d);
      folder.file('barcode_panel.svg', svg);
      adds.push(spcSVGtoPNGBlob(svg).then(b => { if (b) folder.file('barcode_panel.png', b); }));
    }
    if (incD) {
      const svg = spcDistSVG(d);
      folder.file('distributor_panel.svg', svg);
      adds.push(spcSVGtoPNGBlob(svg).then(b => { if (b) folder.file('distributor_panel.png', b); }));
    }
    if (incPreview) {
      folder.file('combined_preview.svg', spcCombinedPreviewSVG(d, incN, incI, incB, incD));
    }

    // README
    folder.file('README.txt', [
      `${d.name} — Designer Split Pack`,
      `Generated: ${new Date().toLocaleString()}`,
      `Hidden Supply NFS v3.0`,
      '',
      'FILES:',
      incN ? '  micro_nutrition_panel.svg / .png — FDA-compliant micro NF panel' : '',
      incI ? '  ingredients_panel.svg / .png     — Ingredients + allergens' : '',
      incB ? '  barcode_panel.svg / .png         — UPC barcode (vector)' : '',
      incD ? '  distributor_panel.svg / .png     — Distributor / origin / net wt' : '',
      incPreview ? '  combined_preview.svg             — All atoms side by side' : '',
      '',
      'USAGE:',
      '  Open SVG files directly in Illustrator or Figma.',
      '  PNG files are @3x (288ppi) for press-ready placement.',
      '  All fonts are embedded as SVG text paths — no font dependencies.',
      '',
      'FDA NOTE:',
      '  Micro panel follows 21 CFR 101.9(j)(13) small-package provisions.',
      '  Minimum 6pt text maintained throughout.',
    ].filter(l => l !== '').join('\n'));

    Promise.all(adds).then(() => {
      zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name + '_split_pack.zip';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
        if (typeof toast === 'function') toast('ZIP Downloaded', `${name}_split_pack.zip`);
      });
    });
  });
}

// SVG → PNG Blob at 3x resolution
function spcSVGtoPNGBlob(svgStr) {
  return new Promise(resolve => {
    try {
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const img  = new Image();
      img.onload = () => {
        const scale = 3;
        const w = img.naturalWidth  || 300;
        const h = img.naturalHeight || 200;
        const canvas = document.createElement('canvas');
        canvas.width  = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(b => resolve(b), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch(e) { resolve(null); }
  });
}

// ── Single HTML fallback ──────────────────────────────────────────────────────
function spcExportSingleHTML(d, name) {
  const svgN = spcNFMicroSVG(d);
  const svgI = spcIngSVG(d);
  const body = `<div style="display:inline-block;">${svgN}<br>${svgI}</div>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${d.name}</title>
<style>@page{margin:3mm;size:auto;}html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;display:inline-block;}</style>
</head><body>${body}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = name + '_label_full.html';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 600);
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
// All sizes in SVG user units (px at 96dpi).
// 1pt = 1.333px. FDA min = 6pt = 8px.
// Target micro width: ~216px = 2.25" — fits a 6"×5" blister back panel easily.

const M_W   = 216;   // micro panel width px
const M_PAD = 5;     // inner padding
const M_FNT = 7.5;   // base font px (≈5.6pt — border legal, matches competitor density)
const M_TTL = 11;    // title font
const M_CAL = 13;    // calorie number
const M_LH  = 10;    // line height

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// SVG text element helper
function svgT(x, y, txt, opts) {
  const bold   = opts?.bold   ? 'font-weight="700"' : '';
  const italic = opts?.italic ? 'font-style="italic"' : '';
  const size   = opts?.size   ? `font-size="${opts.size}"` : `font-size="${M_FNT}"`;
  const anchor = opts?.anchor ? `text-anchor="${opts.anchor}"` : '';
  const fill   = opts?.fill   ? `fill="${opts.fill}"` : 'fill="#000"';
  const family = `font-family="'Helvetica Neue',Arial,Helvetica,sans-serif"`;
  return `<text x="${x}" y="${y}" ${family} ${size} ${bold} ${italic} ${anchor} ${fill}>${esc(txt)}</text>`;
}

// SVG line helper
function svgL(x1, y1, x2, y2, stroke, width) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke||'#000'}" stroke-width="${width||0.5}"/>`;
}

// SVG rect helper
function svgR(x, y, w, h, fill) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill||'#000'}"/>`;
}

// Wrap SVG into root element with viewBox
function svgRoot(content, w, h, extra) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${extra||''}>
  <rect width="${w}" height="${h}" fill="#fff"/>
  ${content}
</svg>`;
}

// ── MICRO NF PANEL SVG ────────────────────────────────────────────────────────
// Competitor-style: single-line title, inline linear nutrients, squat.
// Layout:
//   [border]
//   NUTRITION FACTS   |  [servings] Serving size [x]
//   ────────────────────────────────────────────────
//   Calories [N]     [thick rule]
//   % Daily Value*
//   Total Fat [x]g [x]%  Sat. Fat [x]g [x]%  Trans Fat [x]g
//   Cholesterol [x]mg [x]%  Sodium [x]mg [x]%
//   Total Carb. [x]g [x]%  Dietary Fiber [x]g [x]%  Total Sugars [x]g  Incl. [x]g Added Sugars [x]%
//   Protein [x]g
//   Vit. D [x]mcg [x]%  Calcium [x]mg [x]%  Iron [x]mg [x]%  Potassium [x]mg [x]%
//   ────────────────────────────────────────────────
//   *footnote (abbreviated)
//   [border]

function spcNFMicroSVG(d) {
  const W   = M_W;
  const P   = M_PAD;
  const iW  = W - P * 2;   // inner width
  const fs  = M_FNT;
  const lh  = M_LH;

  const v   = k => d[k]?.val || '0';
  const pv  = (k, suffix) => { const x = d[k]?.pct; return (x && x !== '0') ? ` ${x}%` : ''; };

  let y = P + 1;
  let els = '';

  // Outer border
  // (drawn last with exact height)

  // ── Title row ────────────────────────────────────────────────────────────
  const titleY = y + M_TTL;
  els += `<text x="${P+1}" y="${titleY}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${M_TTL}" font-weight="900" fill="#000">NUTRITION FACTS</text>`;

  // Serving info right-aligned on same baseline
  const srvText = [
    d.servingPerContainer ? `${d.servingPerContainer} servings` : '',
    d.servingSize ? `Serving size ${d.servingSize}` : '',
  ].filter(Boolean).join('  ');
  if (srvText) {
    els += `<text x="${W - P - 1}" y="${titleY}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" fill="#000" text-anchor="end">${esc(srvText)}</text>`;
  }
  y = titleY + 3;

  // ── Divider ────────────────────────────────────────────────────────────────
  els += svgR(P, y, iW, 4, '#000');
  y += 6;

  // ── Calories row ────────────────────────────────────────────────────────────
  els += `<text x="${P+1}" y="${y + M_CAL - 2}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${M_CAL - 1}" font-weight="900" fill="#000">Calories</text>`;
  els += `<text x="${W - P - 1}" y="${y + M_CAL - 1}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${M_CAL}" font-weight="900" fill="#000" text-anchor="end">${esc(d.calories)}</text>`;
  y += M_CAL + 1;

  // Thin rule
  els += svgL(P, y, W - P, y, '#000', 2.5);
  y += 4;

  // ── % DV header ────────────────────────────────────────────────────────────
  els += `<text x="${W - P - 1}" y="${y + fs}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs - 0.5}" font-weight="700" fill="#000" text-anchor="end">% Daily Value*</text>`;
  y += lh;

  // ── Nutrient lines (inline / linear) ────────────────────────────────────────
  // Each call: addLine(segments) → renders as one wrapped line
  // segments: [{label, val, bold}]

  const addLine = (parts) => {
    els += svgL(P, y, W - P, y, '#000', 0.4);
    y += 1;
    const textParts = parts.map(seg => {
      const w = seg.bold ? 'font-weight="700"' : '';
      return `<tspan ${w}>${esc(seg.text)}</tspan>`;
    }).join(`<tspan fill="#555"> · </tspan>`);
    els += `<text x="${P+1}" y="${y + fs}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" fill="#000">${textParts}</text>`;
    y += lh + 0.5;
  };

  const seg = (label, k, unit) => {
    const val = v(k);
    const pct = d[k]?.pct;
    const dvStr = (pct && pct !== '0') ? ` ${pct}%` : '';
    return { text: `${label} ${val}${unit}${dvStr}`, bold: false };
  };
  const segBold = (label, k, unit) => ({ ...seg(label, k, unit), bold: true });

  // Row 1: Fats
  addLine([
    segBold('Total Fat',  'tf', 'g'),
    seg('Sat. Fat',       'sf', 'g'),
    seg('Trans Fat',      'xf', 'g'),
  ]);

  // Row 2: Cholesterol + Sodium
  addLine([
    segBold('Cholesterol', 'ch', 'mg'),
    segBold('Sodium',      'na', 'mg'),
  ]);

  // Row 3: Carbs + Fiber + Sugars
  const asV = v('as_');
  const asPct = d['as_']?.pct;
  const asDvStr = (asPct && asPct !== '0') ? ` ${asPct}%` : '';
  addLine([
    segBold('Total Carb.',   'tc', 'g'),
    seg('Dietary Fiber',     'df', 'g'),
    seg('Total Sugars',      'su', 'g'),
    { text: `Incl. ${asV}g Added Sugars${asDvStr}`, bold: false },
  ]);

  // Row 4: Protein
  addLine([
    segBold('Protein', 'pr', 'g'),
  ]);

  // Thick rule before micros
  els += svgR(P, y, iW, 3.5, '#000');
  y += 5;

  // Row 5: Micros inline
  const microParts = [
    seg('Vit. D',    'vd', 'mcg'),
    seg('Calcium',   'ca', 'mg'),
    seg('Iron',      'fe', 'mg'),
    seg('Potassium', 'k',  'mg'),
  ];
  const microLine = microParts.map(s => `<tspan>${esc(s.text)}</tspan>`).join(`<tspan fill="#555">  </tspan>`);
  els += `<text x="${P+1}" y="${y + fs}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs - 0.5}" fill="#000">${microLine}</text>`;
  y += lh + 1;

  // ── Thin rule ────────────────────────────────────────────────────────────────
  els += svgL(P, y, W - P, y, '#000', 0.5);
  y += 2;

  // ── Footnote (abbreviated for micro) ─────────────────────────────────────────
  const fnote = '*%DV based on a 2,000 cal/day diet.';
  els += `<text x="${P+1}" y="${y + fs - 1}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs - 1}" fill="#000">${esc(fnote)}</text>`;
  y += lh - 1;

  // Final border rect
  const H = y + P - 1;
  const border = `<rect x="${P/2}" y="${P/2}" width="${W - P}" height="${H - P/2}" fill="none" stroke="#000" stroke-width="1"/>`;

  return svgRoot(border + els, W, H);
}

// ── INGREDIENTS SVG ───────────────────────────────────────────────────────────
function spcIngSVG(d) {
  const W  = M_W;
  const P  = M_PAD;
  const fs = M_FNT;
  const lh = M_LH;
  const iW = W - P * 2;

  // Wrap ingredient text into lines
  const rawIng = d.ingredients || '';
  const rawAl  = d.allergenText || '';

  const wrapText = (text, maxW, fsize) => {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    const approxCharW = fsize * 0.52;
    const maxChars = Math.floor(maxW / approxCharW);
    words.forEach(w => {
      if ((cur + ' ' + w).trim().length > maxChars && cur) {
        lines.push(cur.trim());
        cur = w;
      } else {
        cur = (cur + ' ' + w).trim();
      }
    });
    if (cur) lines.push(cur.trim());
    return lines;
  };

  let y = P + fs;
  let els = '';

  if (rawIng) {
    const ingLabel = 'INGREDIENTS: ' + rawIng;
    const lines = wrapText(ingLabel, iW, fs);
    lines.forEach((ln, i) => {
      const bold = i === 0 ? 'font-weight="700"' : '';
      // bold only the INGREDIENTS: prefix on first line
      if (i === 0) {
        const colonIdx = ln.indexOf(':');
        if (colonIdx > -1) {
          const prefix = ln.slice(0, colonIdx + 1);
          const rest   = ln.slice(colonIdx + 1);
          els += `<text x="${P}" y="${y}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" fill="#000">` +
            `<tspan font-weight="700">${esc(prefix)}</tspan><tspan>${esc(rest)}</tspan></text>`;
        } else {
          els += `<text x="${P}" y="${y}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="700" fill="#000">${esc(ln)}</text>`;
        }
      } else {
        els += `<text x="${P}" y="${y}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" fill="#000">${esc(ln)}</text>`;
      }
      y += lh;
    });
  }

  if (rawAl) {
    y += 2;
    const alLines = wrapText(rawAl, iW, fs);
    alLines.forEach((ln, i) => {
      els += `<text x="${P}" y="${y}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" font-weight="700" fill="#000">${esc(ln)}</text>`;
      y += lh;
    });
  }

  if (!rawIng && !rawAl) {
    els += `<text x="${P}" y="${y}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" fill="#999" font-style="italic">No ingredient data.</text>`;
    y += lh;
  }

  const H = y + P;
  return svgRoot(els, W, H);
}

// ── BARCODE SVG ───────────────────────────────────────────────────────────────
function spcBarcodeSVG(d) {
  const UPC_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const UPC_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  const G_OUT = '101', G_MID = '01010';

  const code = (d.barcodeCode || '000000000000').replace(/\D/g,'').padEnd(12,'0').slice(0,12);
  let seq = G_OUT;
  for (let i = 0; i < 6; i++) seq += UPC_L[parseInt(code[i])||0];
  seq += G_MID;
  for (let i = 6; i < 12; i++) seq += UPC_R[parseInt(code[i])||0];
  seq += G_OUT;

  const UNIT = 1.5, BAR_H = 40, GUARD_H = 46, QZ = 8, TOP = 4, BTM = 12;
  const barW = seq.length * UNIT;
  const W = barW + QZ * 2, H = TOP + GUARD_H + BTM;

  if (!d.hasBarcode) {
    // Placeholder bars
    return svgRoot(
      `<rect x="4" y="4" width="${W-8}" height="${H-8}" fill="none" stroke="#ccc" stroke-dasharray="3,2"/>` +
      `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-family="Arial" font-size="7" fill="#aaa">No barcode configured</text>`,
      W, H
    );
  }

  let bars = '';
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === '1') {
      const isGuard = i < 3 || i >= seq.length - 3 || (i >= 45 && i <= 49);
      const h = isGuard ? GUARD_H : BAR_H;
      bars += svgR((QZ + i * UNIT).toFixed(1), TOP, UNIT, h, '#000');
    }
  }

  const digits = `<text x="${QZ + barW / 2}" y="${H - 2}" text-anchor="middle" font-family="'Courier New',monospace" font-size="7" fill="#000">${code.slice(0,6)} ${code.slice(6)}</text>`;

  return svgRoot(bars + digits, W.toFixed(0), H);
}

// ── DISTRIBUTOR SVG ───────────────────────────────────────────────────────────
function spcDistSVG(d) {
  const W  = M_W;
  const P  = M_PAD;
  const fs = M_FNT;
  const lh = M_LH;

  let y = P + fs;
  let els = '';

  const addLine = (txt, bold) => {
    els += `<text x="${P}" y="${y}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="${fs}" ${bold?'font-weight="700"':''} fill="#000">${esc(txt)}</text>`;
    y += lh;
  };

  d.distLines.forEach((ln, i) => {
    const clean = ln.replace(/^distributed\s+by\s*:?\s*/i, '');
    addLine(i === 0 ? `DISTRIBUTED BY: ${clean}` : clean, i === 0);
  });

  if (d.origin) {
    const o = d.origin.replace(/^manufactured\s+in\s*/i,'PRODUCT OF ').replace(/^made\s+in\s*/i,'PRODUCT OF ').toUpperCase();
    addLine(o, true);
  }
  if (d.netWt) addLine(d.netWt, true);
  if (d.warning) { y += 2; addLine(d.warning, true); }

  if (!d.distLines.length && !d.origin && !d.netWt) {
    addLine('No distributor data.', false);
  }

  const H = y + P;
  return svgRoot(els, W, H);
}

// ── COMBINED PREVIEW SVG ──────────────────────────────────────────────────────
function spcCombinedPreviewSVG(d, incN, incI, incB, incD) {
  const GAP = 16, LABEL_H = 12, PAD = 12;
  // We'll place atoms left-to-right with labels above

  // Build each atom SVG string
  const atoms = [];
  if (incN) atoms.push({ label: 'Nutrition Facts Panel', svg: spcNFMicroSVG(d) });
  if (incI) atoms.push({ label: 'Ingredients',           svg: spcIngSVG(d) });
  if (incB) atoms.push({ label: 'Barcode',               svg: spcBarcodeSVG(d) });
  if (incD) atoms.push({ label: 'Distributor / Origin',  svg: spcDistSVG(d) });

  // Parse width/height from each SVG's viewBox
  const dims = atoms.map(a => {
    const m = a.svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    return { w: m ? parseFloat(m[1]) : 220, h: m ? parseFloat(m[2]) : 100 };
  });

  const maxH = Math.max(...dims.map(d => d.h));
  const totalW = dims.reduce((s, d) => s + d.w, 0) + GAP * (atoms.length - 1) + PAD * 2;
  const totalH = maxH + LABEL_H + GAP + PAD * 2 + 20; // +20 for header

  let els = '';
  let x = PAD;

  // Header
  els += `<text x="${PAD}" y="${PAD + 9}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="8" font-weight="700" fill="#666" letter-spacing="0.5">${esc(d.name)} — Designer Split Pack  ·  ${new Date().toLocaleDateString()}  ·  Hidden Supply NFS</text>`;

  const atomY = PAD + 18;

  atoms.forEach((atom, i) => {
    const dim = dims[i];
    // Label
    els += `<text x="${x}" y="${atomY + LABEL_H - 2}" font-family="'Helvetica Neue',Arial,Helvetica,sans-serif" font-size="7" font-weight="700" fill="#888" letter-spacing="0.4">${esc(atom.label.toUpperCase())}</text>`;
    // Embed inner SVG content via <use> — inline the SVG group
    // Strip outer SVG wrapper and embed as <g>
    const inner = atom.svg
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '')
      .replace(/<rect width="[^"]*" height="[^"]*" fill="#fff"\/>/, ''); // remove bg rect
    els += `<g transform="translate(${x},${atomY + LABEL_H})">${inner}</g>`;
    // Border
    els += `<rect x="${x}" y="${atomY + LABEL_H}" width="${dim.w}" height="${dim.h}" fill="none" stroke="#ddd" stroke-width="0.5"/>`;
    x += dim.w + GAP;
  });

  return svgRoot(els, totalW.toFixed(0), totalH.toFixed(0));
}

// ── Data extraction ───────────────────────────────────────────────────────────
function spcGetData() {
  const p = (typeof window.nfsGetCurrent === 'function') ? window.nfsGetCurrent() : null;
  const fv = (id) => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  const hasFormData = !!fv('e-ss') || !!fv('n-cal') || !!fv('e-ing');
  if (!p && !hasFormData) return null;

  const N  = p?.nutrients || {};
  const DV = p?.dv || {};

  const nd = (key, fid) => { const s = N[key]?.declared; return (s !== '' && s != null) ? String(s) : (fid ? fv(fid) || '0' : '0'); };
  const dv = (key, fid) => { const s = DV[key]; return (s !== '' && s != null) ? String(s) : (fid ? fv(fid) || '0' : '0'); };

  const nr = (key, dvKey, formNId, formPId) => ({
    val: nd(key, formNId),
    pct: dvKey ? dv(dvKey, formPId) : null,
  });

  const bc = p?.barcode || {};
  const rawDist = (p?.distributor || fv('e-dist')).trim();
  const distLines = rawDist.split(/[\n|]/).map(l => l.trim()).filter(Boolean);
  const oz = p?.netOz || fv('e-oz');
  const g  = p?.netG  || fv('e-g');
  const netWt = (oz || g)
    ? `NET WT ${oz ? oz + ' OZ' : ''}${oz && g ? ' (' : ''}${g ? g + 'g' : ''}${oz && g ? ')' : ''}`.trim()
    : '';
  const ing    = (p?.ingredients    || fv('e-ing')).trim();
  const alCus  = (p?.allergenCustom || fv('e-al-custom')).trim();
  const allergenText = alCus || ((p?.allergens || []).length ? 'Contains: ' + p.allergens.join(', ') + '.' : '');

  return {
    name:               p?.name || fv('nl-name') || 'Label',
    servingSize:        p?.servingSize || fv('e-ss'),
    servingPerContainer:p?.servingsPerContainer || fv('e-spc'),
    calories:           nd('cal', 'n-cal'),
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
    origin:        (p?.origin || fv('e-origin')).trim(),
    netWt:         netWt,
    warning:       (p?.warning || fv('e-warn')).trim(),
    hasBarcode:    !!(bc.include && bc.mode === 'real' && bc.code),
    barcodeCode:   bc.code || '',
    barcodeType:   bc.type || 'UPC-A',
  };
}

// Hook into editorUpdate so preview refreshes when label data changes
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
