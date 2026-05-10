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
  const hasProject = !!window.nfsCurrent;
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
  spcDownload(spcWrapHTML(`${d.name} — Mini FDA + Ingredients`, body, bg), `${name}_mini_nutrition_ingredients.html`);
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
  spcDownload(spcWrapHTML(title, body, bg), filename);
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
function spcWrapHTML(title, bodyHTML, bg) {
  const bodyBg = bg === 'transparent' ? 'transparent' : '#fff';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { margin: 4mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: ${bodyBg}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif; color: #000; padding: 4mm; }
    @media print { body { padding: 0; } }
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
  const p = window.nfsCurrent;
  if (!p) return null;

  const N  = p.nutrients || {};
  const DV = p.dv || {};

  // Fallback to live form values when project hasn't been saved mid-edit
  const fv = (id) => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  const nd = (key, fid) => { const s = N[key]?.declared; return (s !== '' && s != null) ? String(s) : (fid ? fv(fid) || '0' : '0'); };
  const dv = (key, fid) => { const s = DV[key]; return (s !== '' && s != null) ? String(s) : (fid ? fv(fid) || '0' : '0'); };

  // Helper: safe accessor
  const nr = (key, dvKey, formNId, formPId) => ({
    val: nd(key,   formNId),
    pct: dvKey ? dv(dvKey, formPId) : null,
  });

  const bc = p.barcode || {};
  const rawDist = (p.distributor || fv('e-dist')).trim();
  const distLines = rawDist.split(/[\n|]/).map(l => l.trim()).filter(Boolean);
  const oz = p.netOz || fv('e-oz');
  const g  = p.netG  || fv('e-g');
  const netWt = (oz || g)
    ? `NET WT ${oz ? oz + ' OZ' : ''}${oz && g ? ' (' : ''}${g ? g + 'g' : ''}${oz && g ? ')' : ''}`.trim()
    : '';
  const ing   = (p.ingredients   || fv('e-ing')).trim();
  const alCus = (p.allergenCustom || fv('e-al-custom')).trim();
  const allergenText = alCus || ((p.allergens || []).length ? 'Contains: ' + p.allergens.join(', ') + '.' : '');

  return {
    name:               p.name || 'Label',
    servingSize:        p.servingSize || fv('e-ss'),
    servingPerContainer:p.servingsPerContainer || fv('e-spc'),
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
    origin:        (p.origin || fv('e-origin')).trim(),
    netWt:         netWt,
    warning:       (p.warning || fv('e-warn')).trim(),
    hasBarcode:    !!(bc.include && bc.mode === 'real' && bc.code),
    barcodeCode:   bc.code || '',
    barcodeType:   bc.type || 'UPC-A',
  };
}

// ── Atom renderers ────────────────────────────────────────────────────────────

// Compact FDA nutrition facts box — tight, no support copy
function spcNFBoxHTML(d, fs) {
  const ts  = Math.max(fs * 2.8, 16); // title size
  const cs  = Math.max(fs * 2.4, 14); // calorie number size
  const nrs = Math.max(fs, 6);        // nutrient row size
  const mfs = Math.max(fs - 0.5, 5.5);// micro size

  const v  = k => d[k]?.val || '0';
  const p  = k => d[k]?.pct;
  const pct = k => { const x = p(k); return (x != null && x !== '0') ? `<b>${x}%</b>` : ''; };

  const row = (label, val, unit, dvKey, bold, indent, heavyBot) =>
    `<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:${nrs}px;padding:1.5px 0;border-bottom:${heavyBot ? '8px' : '0.75px'} solid #000;${indent ? `padding-left:${indent}px;` : ''}${bold ? 'font-weight:700;' : ''}">
      <span>${label}</span>
      <span style="white-space:nowrap;padding-left:3px;">${val}${unit} ${dvKey ? pct(dvKey) : ''}</span>
    </div>`;

  return `<div style="font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;border:2.5px solid #000;padding:5px 6px;display:inline-block;min-width:150px;box-sizing:border-box;background:#fff;">
  <div style="font-size:${ts}px;font-weight:900;line-height:0.92;letter-spacing:-0.5px;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:2px;white-space:nowrap;">Nutrition<br>Facts</div>
  ${d.servingPerContainer ? `<div style="font-size:${nrs}px;line-height:1.3;">${d.servingPerContainer} servings per container</div>` : ''}
  ${d.servingSize ? `<div style="font-size:${nrs}px;font-weight:700;line-height:1.3;margin-bottom:1px;">Serving size ${d.servingSize}</div>` : ''}
  <div style="border-top:8px solid #000;padding-top:2px;">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:4px solid #000;padding-bottom:2px;margin-bottom:1px;">
      <span style="font-size:${Math.max(fs,8)}px;font-weight:900;">Calories</span>
      <span style="font-size:${cs}px;font-weight:900;letter-spacing:-1px;">${d.calories}</span>
    </div>
    <div style="text-align:right;font-size:${Math.max(fs-1,5)}px;font-weight:700;border-bottom:1px solid #000;padding:1px 0;margin-bottom:1px;">% Daily Value*</div>
    ${row('Total Fat',           v('tf'),  'g',  'tf',  true,  0)}
    ${row('Saturated Fat',       v('sf'),  'g',  'sf',  false, 10)}
    ${row('<i>Trans</i> Fat',    v('xf'),  'g',  null,  false, 10)}
    ${row('Cholesterol',         v('ch'),  'mg', 'ch',  true,  0)}
    ${row('Sodium',              v('na'),  'mg', 'na',  true,  0)}
    ${row('Total Carbohydrate',  v('tc'),  'g',  'tc',  true,  0)}
    ${row('Dietary Fiber',       v('df'),  'g',  'df',  false, 10)}
    ${row('Total Sugars',        v('su'),  'g',  null,  false, 10)}
    ${row(`Incl. ${v('as_')}g Added Sugars`, '', '', 'as_', false, 20)}
    ${row('Protein',             v('pr'),  'g',  null,  true,  0, true)}
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;padding:1.5px 0;">
      <div style="font-size:${mfs}px;padding-right:3px;border-right:0.5px solid #000;">Vit. D ${v('vd')}mcg <b>${pct('vd')}</b></div>
      <div style="font-size:${mfs}px;padding-left:3px;">Calcium ${v('ca')}mg <b>${pct('ca')}</b></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;padding:1.5px 0;">
      <div style="font-size:${mfs}px;padding-right:3px;border-right:0.5px solid #000;">Iron ${v('fe')}mg <b>${pct('fe')}</b></div>
      <div style="font-size:${mfs}px;padding-left:3px;">Potassium ${v('k')}mg <b>${pct('k')}</b></div>
    </div>
    <div style="font-size:${Math.max(fs-1,5)}px;border-top:1px solid #000;padding-top:2px;line-height:1.35;margin-top:2px;color:#000;">*The % Daily Value tells you how much a nutrient in a serving contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.</div>
  </div>
</div>`;
}

// Ingredients atom — standalone block, tight
function spcIngAtomHTML(d, fs) {
  if (!d.ingredients && !d.allergenText) {
    return `<div style="font-size:${Math.max(fs,6)}px;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#888;font-style:italic;">No ingredient data.</div>`;
  }
  const ingEsc = (d.ingredients || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<div style="font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;line-height:1.55;max-width:280px;">
    ${ingEsc ? `<div style="font-size:${Math.max(fs,6)}px;"><strong>INGREDIENTS:</strong> ${ingEsc}</div>` : ''}
    ${d.allergenText ? `<div style="font-size:${Math.max(fs,6)}px;font-weight:700;margin-top:3px;">${d.allergenText}</div>` : ''}
  </div>`;
}

// Barcode atom
function spcBarcodeAtomHTML(d, fs) {
  if (!d.hasBarcode) {
    return `<div style="font-size:${Math.max(fs,6)}px;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#aaa;font-style:italic;text-align:center;">No barcode configured.<br><span style="font-size:10px;">Enable in Barcode Module.</span></div>`;
  }
  const code = d.barcodeCode || '';
  // CSS bar pattern from the digit string
  const bars = Array.from(code).map((c, i) => {
    const w = (parseInt(c) % 3 === 0) ? 2 : 1;
    const h = (i % 5 === 0) ? 50 : 45;
    return `<div style="width:${w}px;height:${h}px;background:#000;flex-shrink:0;"></div>`;
  }).join('');
  return `<div style="font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;text-align:center;display:inline-block;">
    <div style="display:flex;gap:1px;height:52px;align-items:flex-end;margin-bottom:3px;justify-content:center;">${bars}</div>
    <div style="font-size:${Math.max(fs,6)}px;font-family:'Courier New',monospace;letter-spacing:1.5px;">${code}</div>
    <div style="font-size:${Math.max(fs-1,5)}px;color:#666;">${d.barcodeType}</div>
  </div>`;
}

// Distributor / origin atom
function spcDistAtomHTML(d, fs) {
  const parts = [];
  d.distLines.forEach((part, i) => {
    const isWeb = /^https?:\/\//i.test(part) || /^www\./i.test(part) ||
      (/^[^\s@]+\.(co|com|net|io|org|us|ca|shop|store)(\b|$)/i.test(part) && !part.includes(' '));
    if (i === 0) {
      parts.push(`<div style="font-size:${Math.max(fs,6)}px;line-height:1.6;"><strong>DISTRIBUTED BY:</strong> ${part.replace(/^distributed\s+by\s*:?\s*/i,'')}</div>`);
    } else if (isWeb) {
      parts.push(`<div style="font-size:${Math.max(fs,6)}px;line-height:1.6;">${part.replace(/^https?:\/\//i,'').toUpperCase()}</div>`);
    } else {
      parts.push(`<div style="font-size:${Math.max(fs,6)}px;line-height:1.6;">${part}</div>`);
    }
  });
  if (d.origin) {
    const o = d.origin.replace(/^manufactured\s+in\s*/i,'PRODUCT OF ').replace(/^made\s+in\s*/i,'PRODUCT OF ').toUpperCase();
    parts.push(`<div style="font-size:${Math.max(fs,6)}px;font-weight:700;line-height:1.6;">${o}</div>`);
  }
  if (d.netWt) {
    parts.push(`<div style="font-size:${Math.max(fs,6)}px;font-weight:700;line-height:1.6;margin-top:2px;">${d.netWt}</div>`);
  }
  if (d.warning) {
    parts.push(`<div style="font-size:${Math.max(fs,6)}px;font-weight:700;line-height:1.6;margin-top:2px;">${d.warning}</div>`);
  }
  if (!parts.length) return `<div style="font-size:${Math.max(fs,6)}px;color:#888;font-style:italic;">No distributor data.</div>`;
  return `<div style="font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;max-width:220px;">${parts.join('')}</div>`;
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
