/**
 * nfs-small-pack.js — Small Pack Asset Generator
 * Version: 2.0.0
 *
 * Production-first workflow. Select type → click export → receive files.
 *
 * Export types:
 *  single    → full label PDF (existing flow, enhanced)
 *  mini      → nutrition panel only, tightly cropped
 *  mini-ing  → nutrition panel + ingredients block
 *  split     → 4 separate files (NF panel, ingredients, barcode, distributor) + optional preview
 *
 * FDA reference: 21 CFR 101.9(j)(13) — small/intermediate packages
 */

// ── State ────────────────────────────────────────────────────────────────────
let _spcType = 'single';
let _spcZoom = 1;

// ── Init ─────────────────────────────────────────────────────────────────────
function spcInit() {
  const d = spcGetData();
  const hasProject = !!d;
  document.getElementById('spc-no-project').style.display = hasProject ? 'none'  : 'block';
  document.getElementById('spc-main').style.display       = hasProject ? 'block' : 'none';
  if (!hasProject) return;

  // Restore last used type
  const saved = localStorage.getItem('spc_last_type') || 'single';
  spcSelectType(saved, true);
}

// ── Type selection ────────────────────────────────────────────────────────────
function spcSelectType(type, silent) {
  _spcType = type;
  localStorage.setItem('spc_last_type', type);

  // Update radio
  const radio = document.querySelector(`input[name="spc-type"][value="${type}"]`);
  if (radio) radio.checked = true;

  // Update border highlights
  ['single','mini','mini-ing','split'].forEach(t => {
    const lbl = document.getElementById('spc-type-' + t + '-lbl');
    if (!lbl) return;
    if (t === type) {
      lbl.style.borderColor = 'var(--accent)';
      lbl.style.background  = 'var(--accent-bg)';
    } else {
      lbl.style.borderColor = 'var(--border)';
      lbl.style.background  = '';
    }
  });

  // Show/hide split options
  const splitOpts = document.getElementById('spc-split-options');
  if (splitOpts) splitOpts.style.display = type === 'split' ? 'block' : 'none';

  // Update button label
  const btn = document.getElementById('spc-export-btn');
  if (btn) {
    const labels = {
      single:    '📄 Export Single PDF',
      mini:      '📦 Export Mini FDA Panel',
      'mini-ing':'📦 Export Mini FDA + Ingredients',
      split:     '📦 Export Designer Split Pack',
    };
    btn.innerHTML = labels[type] || '📄 Generate Export';
  }

  // Update preview title
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

  // Font warning
  const fs = parseFloat(document.getElementById('spc-min-font')?.value) || 6;
  const warn = document.getElementById('spc-font-warn');
  if (warn) warn.style.display = fs < 6 ? 'flex' : 'none';

  if (!silent) spcRenderPreview();
}

// ── Render preview ────────────────────────────────────────────────────────────
function spcRenderPreview() {
  const d   = spcGetData();
  const inner = document.getElementById('spc-preview-inner');
  if (!inner) return;
  if (!d) {
    inner.innerHTML = '<div style="font-size:12px;color:#999;text-align:center;padding:40px;">No project data.</div>';
    return;
  }

  const fs  = Math.max(parseFloat(document.getElementById('spc-min-font')?.value) || 6, 5);
  const bg  = document.getElementById('spc-bg')?.value || 'white';
  const bgCss = bg === 'transparent' ? 'transparent' : '#fff';

  let html = '';

  switch (_spcType) {
    case 'mini':
      html = `<div style="background:${bgCss};display:inline-block;padding:0;">${spcNFBoxHTML(d, fs)}</div>`;
      break;

    case 'mini-ing':
      html = `<div style="background:${bgCss};display:inline-block;">
        ${spcNFBoxHTML(d, fs)}
        <div style="margin-top:6px;">${spcIngAtomHTML(d, fs)}</div>
      </div>`;
      break;

    case 'split':
      const incNutrition   = document.getElementById('spc-inc-nutrition')?.checked !== false;
      const incIngredients = document.getElementById('spc-inc-ingredients')?.checked !== false;
      const incBarcode     = document.getElementById('spc-inc-barcode')?.checked !== false;
      const incDist        = document.getElementById('spc-inc-dist')?.checked;

      const atoms = [];
      if (incNutrition)   atoms.push(spcAtomCard('① Nutrition Facts',       spcNFBoxHTML(d, fs),       bgCss));
      if (incIngredients) atoms.push(spcAtomCard('② Ingredients',           spcIngAtomHTML(d, fs),     bgCss));
      if (incBarcode)     atoms.push(spcAtomCard('③ Barcode',               spcBarcodeAtomHTML(d, fs), bgCss));
      if (incDist)        atoms.push(spcAtomCard('④ Distributor / Origin',  spcDistAtomHTML(d, fs),    bgCss));

      html = `<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;">${atoms.join('')}</div>`;
      break;

    default: // single
      html = `<div style="background:${bgCss};display:inline-block;padding:0;">
        ${spcNFBoxHTML(d, fs)}
        <div style="margin-top:6px;">${spcIngAtomHTML(d, fs)}</div>
        ${d.hasBarcode ? `<div style="margin-top:4px;">${spcBarcodeAtomHTML(d, fs)}</div>` : ''}
        ${(d.distLines.length || d.origin) ? `<div style="margin-top:4px;">${spcDistAtomHTML(d, fs)}</div>` : ''}
      </div>`;
      break;
  }

  inner.innerHTML = html;
  inner.style.transform = `scale(${_spcZoom})`;

  // Status line
  const status = document.getElementById('spc-export-status');
  if (status) status.textContent = '';
}

// ── Atom card wrapper (preview only) ─────────────────────────────────────────
function spcAtomCard(label, innerHtml, bg) {
  return `<div>
    <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:5px;">${label}</div>
    <div style="background:${bg};display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.12);">${innerHtml}</div>
  </div>`;
}

// ── Zoom ─────────────────────────────────────────────────────────────────────
function spcZoom(dir) {
  const steps = [0.5, 0.67, 0.75, 1, 1.25, 1.5, 2];
  let idx = steps.findIndex(s => Math.abs(s - _spcZoom) < 0.01);
  if (idx < 0) idx = 3;
  idx = Math.max(0, Math.min(steps.length - 1, idx + dir));
  _spcZoom = steps[idx];
  const inner = document.getElementById('spc-preview-inner');
  if (inner) inner.style.transform = `scale(${_spcZoom})`;
  const lbl = document.getElementById('spc-zoom-label');
  if (lbl) lbl.textContent = Math.round(_spcZoom * 100) + '%';
}

// ── Main export dispatcher ───────────────────────────────────────────────────
function spcDoExport() {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Project', 'Open a label first.'); return; }

  const fs   = Math.max(parseFloat(document.getElementById('spc-min-font')?.value) || 6, 5);
  const bg   = document.getElementById('spc-bg')?.value || 'white';
  const name = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const setStatus = (msg) => {
    const el = document.getElementById('spc-export-status');
    if (el) el.textContent = msg;
  };

  switch (_spcType) {
    case 'mini':
      spcExportAtom('nutrition', d, fs, bg, name);
      setStatus('✓ mini_nutrition_panel.html exported — open in browser → Print → Save as PDF');
      if (typeof toast === 'function') toast('Exported', 'mini_nutrition_panel.html');
      break;

    case 'mini-ing':
      spcExportMiniWithIng(d, fs, bg, name);
      setStatus('✓ mini_nutrition_ingredients.html exported');
      if (typeof toast === 'function') toast('Exported', 'mini_nutrition_ingredients.html');
      break;

    case 'split':
      spcExportSplitPack(d, fs, bg, name);
      break;

    default: // single
      spcExportSingle(d, fs, bg, name);
      setStatus('✓ label_full.html exported — open in browser → Print → Save as PDF');
      if (typeof toast === 'function') toast('Exported', name + '_label_full.html');
      break;
  }

  if (typeof trackExport === 'function') trackExport('small-pack-' + _spcType, d.name);
}

// ── Export: Single PDF ────────────────────────────────────────────────────────
function spcExportSingle(d, fs, bg, name) {
  const bgCss = bg === 'transparent' ? 'transparent' : '#fff';
  const body  = `<div style="display:inline-block;background:${bgCss};padding:0;">
    ${spcNFBoxHTML(d, fs)}
    <div style="margin-top:6px;">${spcIngAtomHTML(d, fs)}</div>
    ${d.hasBarcode ? `<div style="margin-top:4px;">${spcBarcodeAtomHTML(d, fs)}</div>` : ''}
    ${(d.distLines.length || d.origin) ? `<div style="margin-top:4px;">${spcDistAtomHTML(d, fs)}</div>` : ''}
  </div>`;
  spcDownload(spcWrapHTML(`${d.name} — Full Label`, body, bg), `${name}_label_full.html`);
}

// ── Export: Mini FDA + Ingredients ───────────────────────────────────────────
function spcExportMiniWithIng(d, fs, bg, name) {
  const bgCss = bg === 'transparent' ? 'transparent' : '#fff';
  const body  = `<div style="display:inline-block;background:${bgCss};">
    ${spcNFBoxHTML(d, fs)}
    <div style="margin-top:6px;">${spcIngAtomHTML(d, fs)}</div>
  </div>`;
  spcDownload(spcWrapHTML(`${d.name} — Mini FDA + Ingredients`, body, bg, true), `${name}_mini_nutrition_ingredients.html`);
}

// ── Export: Designer Split Pack ───────────────────────────────────────────────
function spcExportSplitPack(d, fs, bg, name) {
  const incNutrition   = document.getElementById('spc-inc-nutrition')?.checked !== false;
  const incIngredients = document.getElementById('spc-inc-ingredients')?.checked !== false;
  const incBarcode     = document.getElementById('spc-inc-barcode')?.checked !== false;
  const incDist        = document.getElementById('spc-inc-dist')?.checked;
  const incPreview     = document.getElementById('spc-inc-preview')?.checked !== false;

  const delay = 450;
  let i = 0;
  const files = [];

  if (incNutrition) {
    files.push({ delay: delay * i++, fn: () => spcExportAtom('nutrition',   d, fs, bg, name) });
  }
  if (incIngredients) {
    files.push({ delay: delay * i++, fn: () => spcExportAtom('ingredients', d, fs, bg, name) });
  }
  if (incBarcode) {
    files.push({ delay: delay * i++, fn: () => spcExportAtom('barcode',     d, fs, bg, name) });
  }
  if (incDist) {
    files.push({ delay: delay * i++, fn: () => spcExportAtom('distributor', d, fs, bg, name) });
  }
  if (incPreview) {
    files.push({ delay: delay * i++, fn: () => spcExportCombinedPreview(d, fs, bg, name, incNutrition, incIngredients, incBarcode, incDist) });
  }

  files.forEach(f => setTimeout(f.fn, f.delay));

  const total = files.length;
  const setStatus = (msg) => {
    const el = document.getElementById('spc-export-status');
    if (el) el.textContent = msg;
  };
  setStatus(`Generating ${total} file${total !== 1 ? 's' : ''}…`);
  setTimeout(() => {
    setStatus(`✓ ${total} files exported — open each in browser → Print → Save as PDF`);
    if (typeof toast === 'function') toast('Split Pack Exported', `${total} files`);
  }, delay * (i + 0.5));
}

// ── Export a single atom ─────────────────────────────────────────────────────
function spcExportAtom(type, d, fs, bg, name) {
  let body, filename, title;
  const bgCss = bg === 'transparent' ? 'transparent' : '#fff';

  switch (type) {
    case 'nutrition':
      title    = `${d.name} — Nutrition Facts Panel`;
      filename = `${name}_mini_nutrition_panel.html`;
      body     = `<div style="display:inline-block;background:${bgCss};">${spcNFBoxHTML(d, fs)}</div>`;
      break;
    case 'ingredients':
      title    = `${d.name} — Ingredients`;
      filename = `${name}_ingredients_panel.html`;
      body     = `<div style="display:inline-block;background:${bgCss};">${spcIngAtomHTML(d, fs)}</div>`;
      break;
    case 'barcode':
      title    = `${d.name} — Barcode`;
      filename = `${name}_barcode_panel.html`;
      body     = `<div style="display:inline-block;background:${bgCss};padding:8px 12px;text-align:center;">${spcBarcodeAtomHTML(d, fs)}</div>`;
      break;
    case 'distributor':
      title    = `${d.name} — Distributor / Origin`;
      filename = `${name}_distributor_panel.html`;
      body     = `<div style="display:inline-block;background:${bgCss};">${spcDistAtomHTML(d, fs)}</div>`;
      break;
  }
  spcDownload(spcWrapHTML(title, body, bg, true), filename); // tight: crops to content
}

// ── Export combined preview ───────────────────────────────────────────────────
function spcExportCombinedPreview(d, fs, bg, name, incN, incI, incB, incD) {
  const bgCss = bg === 'transparent' ? 'transparent' : '#fff';
  const atoms = [];
  if (incN) atoms.push(spcAtomCardExport('Nutrition Facts Panel',     spcNFBoxHTML(d, fs),       bgCss));
  if (incI) atoms.push(spcAtomCardExport('Ingredients',               spcIngAtomHTML(d, fs),     bgCss));
  if (incB) atoms.push(spcAtomCardExport('Barcode',                   spcBarcodeAtomHTML(d, fs), bgCss));
  if (incD) atoms.push(spcAtomCardExport('Distributor / Origin',      spcDistAtomHTML(d, fs),    bgCss));

  const body = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;padding:16px;">
    <div style="font-size:10px;color:#888;margin-bottom:16px;">
      <strong>${d.name}</strong> · Designer Split Pack Preview · ${new Date().toLocaleDateString()} · Hidden Supply NFS
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;">${atoms.join('')}</div>
    <div style="margin-top:20px;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:10px;">
      Each panel above is a separate exported file. Open each file individually, then Print → Save as PDF for press-ready output.
    </div>
  </div>`;

  spcDownload(spcWrapHTML(`${d.name} — Designer Split Pack Preview`, body, 'white'), `${name}_split_pack_preview.html`);
}

function spcAtomCardExport(label, innerHtml, bg) {
  return `<div>
    <div style="font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#888;margin-bottom:4px;">${label}</div>
    <div style="background:${bg};display:inline-block;border:1px solid #ddd;">${innerHtml}</div>
  </div>`;
}

// ── HTML page wrapper ─────────────────────────────────────────────────────────
// tight=true: page shrinks to content (atom export). tight=false: normal padding (preview/combined).
function spcWrapHTML(title, bodyHTML, bg, tight) {
  const bodyBg = bg === 'transparent' ? 'transparent' : '#fff';
  const pad = tight ? '0' : '8mm';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { margin: ${tight ? '3mm' : '6mm'}; size: auto; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: ${bodyBg}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif; color: #000; padding: ${pad}; display: ${tight ? 'inline-block' : 'block'}; }
    @media print { body { padding: 0; } }
    b { font-weight: 700; }
    strong { font-weight: 700; }
  </style>
</head>
<body>${bodyHTML}</body>
</html>`;
}

// ── Download ─────────────────────────────────────────────────────────────────
function spcDownload(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 600);
}

// ── Data extraction ───────────────────────────────────────────────────────────
function spcGetData() {
  // nfsGetCurrent() is exposed by the monolith — always returns the live nfsCurrent let binding
  const p = (typeof window.nfsGetCurrent === 'function') ? window.nfsGetCurrent() : null;

  // If no saved project, try to synthesize from live form values
  const fvDirect = (id) => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  const hasFormData = !!fvDirect('e-ss') || !!fvDirect('n-cal') || !!fvDirect('e-ing');

  if (!p && !hasFormData) return null;

  const N  = p?.nutrients || {};
  const DV = p?.dv || {};

  // Fallback to live form values when project hasn't been saved mid-edit
  const fv = (id) => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  const nd = (key, fid) => { const s = N[key]?.declared; return (s !== '' && s != null) ? String(s) : (fid ? fv(fid) || '0' : '0'); };
  const dv = (key, fid) => { const s = DV[key]; return (s !== '' && s != null) ? String(s) : (fid ? fv(fid) || '0' : '0'); };

  // Helper: safe accessor
  const nr = (key, dvKey, formNId, formPId) => ({
    val: nd(key,   formNId),
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
  const ing   = (p?.ingredients   || fv('e-ing')).trim();
  const alCus = (p?.allergenCustom || fv('e-al-custom')).trim();
  const allergenText = alCus || ((p?.allergens || []).length ? 'Contains: ' + p.allergens.join(', ') + '.' : '');

  return {
    name:               p?.name || fv('nl-name') || 'Label',
    servingSize:        p?.servingSize || fv('e-ss'),
    servingPerContainer:p?.servingsPerContainer || fv('e-spc'),
    calories: nd('cal', 'n-cal'),
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

// ── Atom renderers ────────────────────────────────────────────────────────────
// All sizes in CSS px where 1pt = 1.333px
// FDA §101.9(j)(13): minimum 6pt = 8px for small packages
// Width target: ~144px (≈1.5") which is a common constrained-panel width

const SPC_MIN_PX = 8;   // 6pt minimum per FDA
const SPC_BOX_W  = 144; // target box width in px at 96dpi (1.5")

// Compact FDA nutrition facts box — tight, physically correct, print-ready
function spcNFBoxHTML(d, fs) {
  // fs is the user's min font (pt). Convert to px.
  const minPx  = Math.max(fs * 1.333, SPC_MIN_PX);
  const rowPx  = minPx;            // nutrient row text
  const microPx = Math.max(minPx - 1, SPC_MIN_PX - 1); // micros row
  const footPx  = Math.max(minPx - 1, 6);  // footnote
  const dvHdrPx = Math.max(minPx - 1, 6);
  const calNumPx = Math.round(minPx * 2.8); // "160" numeral
  const calLblPx = Math.round(minPx * 1.2); // "Calories" label
  const titlePx  = Math.round(minPx * 2.2); // "Nutrition Facts" stacked

  const v   = k => d[k]?.val || '0';
  const pct = k => { const x = d[k]?.pct; return (x && x !== '0') ? ` <b>${x}%</b>` : ''; };

  // row(label, valueHtml, bold, indentPx, heavyBottom)
  const row = (label, valueHtml, bold, indentPx, heavyBottom) =>
    `<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:${rowPx}px;line-height:1.2;padding:1px 0;border-bottom:${heavyBottom ? '6px' : '0.5px'} solid #000;${indentPx ? `padding-left:${indentPx}px;` : ''}${bold ? 'font-weight:700;' : ''}white-space:nowrap;">` +
    `<span style="white-space:normal;">${label}</span>` +
    `<span style="white-space:nowrap;padding-left:2px;flex-shrink:0;">${valueHtml}</span>` +
    `</div>`;

  return `<div style="font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;border:2px solid #000;padding:4px 5px;display:inline-block;width:${SPC_BOX_W}px;box-sizing:border-box;background:#fff;line-height:1;">
  <div style="font-size:${titlePx}px;font-weight:900;line-height:0.9;letter-spacing:-0.3px;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:2px;">Nutrition<br>Facts</div>
  ${d.servingPerContainer ? `<div style="font-size:${rowPx}px;line-height:1.3;">${d.servingPerContainer} servings per container</div>` : ''}
  ${d.servingSize ? `<div style="font-size:${rowPx}px;font-weight:700;line-height:1.3;margin-bottom:2px;">Serving size ${d.servingSize}</div>` : ''}
  <div style="border-top:7px solid #000;padding-top:2px;">
    <div style="display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px solid #000;padding-bottom:2px;margin-bottom:1px;">
      <span style="font-size:${calLblPx}px;font-weight:900;line-height:1;">Calories</span>
      <span style="font-size:${calNumPx}px;font-weight:900;line-height:1;letter-spacing:-0.5px;">${d.calories}</span>
    </div>
    <div style="text-align:right;font-size:${dvHdrPx}px;font-weight:700;border-bottom:0.5px solid #000;padding:1px 0;margin-bottom:1px;">% Daily Value*</div>
    ${row(`<b>Total Fat</b> ${v('tf')}g`,                        pct('tf'),  false, 0)}
    ${row(`Saturated Fat ${v('sf')}g`,                           pct('sf'),  false, 8)}
    ${row(`<i>Trans</i> Fat ${v('xf')}g`,                       '',          false, 8)}
    ${row(`<b>Cholesterol</b> ${v('ch')}mg`,                     pct('ch'),  false, 0)}
    ${row(`<b>Sodium</b> ${v('na')}mg`,                          pct('na'),  false, 0)}
    ${row(`<b>Total Carbohydrate</b> ${v('tc')}g`,               pct('tc'),  false, 0)}
    ${row(`Dietary Fiber ${v('df')}g`,                           pct('df'),  false, 8)}
    ${row(`Total Sugars ${v('su')}g`,                            '',          false, 8)}
    ${row(`Includes ${v('as_')}g Added Sugars`,                  pct('as_'), false, 16)}
    ${row(`<b>Protein</b> ${v('pr')}g`,                          '',          false, 0, true)}
    <div style="display:flex;justify-content:space-between;font-size:${microPx}px;border-bottom:0.5px solid #000;padding:1px 0;">
      <span>Vitamin D ${v('vd')}mcg${pct('vd')}</span>
      <span style="border-left:0.5px solid #000;padding-left:4px;">Calcium ${v('ca')}mg${pct('ca')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:${microPx}px;padding:1px 0;border-bottom:0.5px solid #000;">
      <span>Iron ${v('fe')}mg${pct('fe')}</span>
      <span style="border-left:0.5px solid #000;padding-left:4px;">Potassium ${v('k')}mg${pct('k')}</span>
    </div>
    <div style="font-size:${footPx}px;border-top:0.5px solid #000;padding-top:2px;line-height:1.3;margin-top:1px;">*The % Daily Value (DV) tells you how much a nutrient in a serving contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.</div>
  </div>
</div>`;
}

// Ingredients + allergens atom — matches NF box width, tight
function spcIngAtomHTML(d, fs) {
  const minPx = Math.max(fs * 1.333, SPC_MIN_PX);
  if (!d.ingredients && !d.allergenText) {
    return `<div style="font-size:${minPx}px;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#888;font-style:italic;width:${SPC_BOX_W}px;">No ingredient data.</div>`;
  }
  const ingEsc = (d.ingredients || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<div style="font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;line-height:1.4;width:${SPC_BOX_W}px;box-sizing:border-box;">
    ${ingEsc ? `<div style="font-size:${minPx}px;"><strong>INGREDIENTS:</strong> ${ingEsc}</div>` : ''}
    ${d.allergenText ? `<div style="font-size:${minPx}px;font-weight:700;margin-top:3px;">${d.allergenText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>` : ''}
  </div>`;
}

// UPC barcode atom — uses proper UPC-A bar encoding
function spcBarcodeAtomHTML(d, fs) {
  const minPx = Math.max(fs * 1.333, SPC_MIN_PX);
  if (!d.hasBarcode) {
    return `<div style="font-size:${minPx}px;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#aaa;font-style:italic;text-align:center;width:${SPC_BOX_W}px;">No barcode configured.<br><small>Enable barcode in Barcode Module.</small></div>`;
  }

  // UPC-A L/R encoding tables (7 bars per digit)
  const UPC_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const UPC_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  const GUARD_OUTER = '101';
  const GUARD_MID   = '01010';

  const code = (d.barcodeCode || '').replace(/\D/g,'').padEnd(12,'0').slice(0,12);
  let bars = '';
  const BAR_H = 42, BAR_LONG = 50, BAR_UNIT = 1.2; // px per module

  // Build bar sequence
  let seq = GUARD_OUTER;
  for (let i = 0; i < 6; i++) seq += UPC_L[parseInt(code[i]) || 0];
  seq += GUARD_MID;
  for (let i = 6; i < 12; i++) seq += UPC_R[parseInt(code[i]) || 0];
  seq += GUARD_OUTER;

  // Render as SVG for accuracy
  const totalW = seq.length * BAR_UNIT;
  let svgBars = '';
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === '1') {
      // Guard bars are taller
      const isGuard = i < 3 || i >= seq.length - 3 || (i >= 45 && i <= 49);
      const h = isGuard ? BAR_LONG : BAR_H;
      const y = 0;
      svgBars += `<rect x="${(i * BAR_UNIT).toFixed(1)}" y="${y}" width="${BAR_UNIT}" height="${h}" fill="#000"/>`;
    }
  }

  const svgH = BAR_LONG + 12;
  const svgW = totalW + 12; // side margins for quiet zone

  return `<div style="font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;text-align:center;display:inline-block;background:#fff;padding:4px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgW.toFixed(0)}" height="${svgH}" viewBox="0 0 ${svgW.toFixed(1)} ${svgH}" style="display:block;margin:0 auto;">
      <rect width="${svgW.toFixed(1)}" height="${svgH}" fill="#fff"/>
      <g transform="translate(6,0)">${svgBars}</g>
      <text x="${(svgW/2).toFixed(1)}" y="${svgH - 1}" text-anchor="middle" font-family="monospace" font-size="${Math.max(minPx - 1, 6)}" fill="#000">${code.slice(0,6)} ${code.slice(6)}</text>
    </svg>
    <div style="font-size:${Math.max(minPx - 1, 6)}px;color:#555;margin-top:1px;">${d.barcodeType}</div>
  </div>`;
}

// Distributor / origin / net weight atom
function spcDistAtomHTML(d, fs) {
  const minPx = Math.max(fs * 1.333, SPC_MIN_PX);
  const parts = [];
  d.distLines.forEach((part, i) => {
    const clean = part.replace(/^distributed\s+by\s*:?\s*/i,'');
    if (i === 0) {
      parts.push(`<span><strong>DISTRIBUTED BY:</strong> ${clean}</span>`);
    } else {
      parts.push(`<span>${clean}</span>`);
    }
  });
  if (d.origin) {
    const o = d.origin.replace(/^manufactured\s+in\s*/i,'PRODUCT OF ').replace(/^made\s+in\s*/i,'PRODUCT OF ').toUpperCase();
    parts.push(`<strong>${o}</strong>`);
  }
  if (d.netWt) parts.push(`<strong>${d.netWt}</strong>`);
  if (d.warning) parts.push(`<strong>${d.warning}</strong>`);

  if (!parts.length) return `<div style="font-size:${minPx}px;color:#888;font-style:italic;">No distributor data.</div>`;

  return `<div style="font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;font-size:${minPx}px;line-height:1.5;width:${SPC_BOX_W}px;box-sizing:border-box;">
    ${parts.join('<br>')}
  </div>`;
}

// ── Quick export — callable directly from Export Center without nav change ────
function spcQuickExport(type) {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Label Data', 'Open and edit a label first, then export.'); return; }
  const fs   = 6; // FDA minimum
  const bg   = 'white';
  const name = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  switch (type) {
    case 'mini':
      spcExportAtom('nutrition', d, fs, bg, name);
      if (typeof toast === 'function') toast('Exported', name + '_mini_nutrition_panel.html');
      break;
    case 'mini-ing':
      spcExportMiniWithIng(d, fs, bg, name);
      if (typeof toast === 'function') toast('Exported', name + '_mini_nutrition_ingredients.html');
      break;
    case 'split':
      // Export all 4 atoms + preview
      spcExportAtom('nutrition',   d, fs, bg, name);
      setTimeout(() => spcExportAtom('ingredients', d, fs, bg, name), 450);
      setTimeout(() => spcExportAtom('barcode',     d, fs, bg, name), 900);
      setTimeout(() => {
        if (d.distLines.length || d.origin) spcExportAtom('distributor', d, fs, bg, name);
      }, 1350);
      setTimeout(() => spcExportCombinedPreview(d, fs, bg, name, true, true, true, !!(d.distLines.length || d.origin)), 1800);
      if (typeof toast === 'function') setTimeout(() => toast('Split Pack Exported', '4–5 files downloaded'), 2200);
      break;
  }
  if (typeof trackExport === 'function') trackExport('small-pack-quick-' + type, d.name);
}

// Hook into editorUpdate so preview refreshes when label data changes
(function() {
  const orig = window.editorUpdate;
  if (typeof orig === 'function') {
    window.editorUpdate = function() {
      orig.apply(this, arguments);
      // Refresh small pack preview if that view is active
      const sp = document.getElementById('view-small-pack');
      if (sp && sp.classList.contains('active')) {
        spcRenderPreview();
      }
    };
  }
})();
