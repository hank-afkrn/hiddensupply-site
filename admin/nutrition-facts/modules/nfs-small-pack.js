/**
 * NFS Small Pack Format Converter — nfs-small-pack.js
 * Version: 1.0.0
 *
 * Adds FDA-compliant small-package reflow rendering to Nutrition Facts Studio.
 * Supports: Standard Vertical, Tabular (intermediate), Linear (small/very small), Split Designer Panels.
 *
 * FDA reference: 21 CFR 101.9(j)(13) — small or intermediate packages
 * Tabular format: allowed when package lacks sufficient continuous vertical space.
 * Linear format: allowed when package surface area is too small for tabular.
 *
 * Architecture:
 *  - spcInit()      → entry point, called by nfsNav('small-pack')
 *  - spcUpdate()    → re-render preview from current form state
 *  - spcRender*()   → individual format renderers
 *  - spcExport*()   → export handlers
 *  - spcGetData()   → extract current project data for rendering
 */

// ── State ───────────────────────────────────────────────────────────────────
let _spcZoom   = 1;
let _spcFormat = 'vertical';

// ── Format descriptions ──────────────────────────────────────────────────────
const SPC_FORMAT_DESC = {
  vertical:  '▌ Standard Vertical — Full FDA Nutrition Facts label. Use when you have ≥2" width and ≥4" height. Best for most back panels, stand-up pouches, and boxes.',
  tabular:   '▬ Small Tabular — FDA-allowed intermediate-package format. Nutrients run in columns across a horizontal band. Use when you have width but limited height (tray sleeves, narrow wraps, blister card tops). FDA §101.9(j)(13)(ii)(A).',
  linear:    '▬▬ Small Linear — FDA-allowed very-small-package format. All nutrients in a single continuous text line. Use only when tabular will not fit (very narrow strips, tube wraps, fruit-shaped packs). FDA §101.9(j)(13)(ii)(B).',
  split:     '◫ Split Designer Panels — Breaks the label into 4 independent movable blocks: ① Nutrition Facts box ② Ingredients/allergens ③ Barcode ④ Distributor/origin. Each exports as a separate clean asset. Use for irregular shapes where no single panel can contain everything.',
};

// ── Shape descriptions ───────────────────────────────────────────────────────
const SPC_SHAPE_NOTE = {
  rectangle:     '',
  'narrow-strip':'⚠ Narrow strips typically require Linear format. Tabular may not fit — check compliance status.',
  'blister-card':'ℹ Blister cards use Split mode. Nutrition box goes on the card face or back top. Ingredients go in a narrow side column. Barcode and distributor go bottom or back side.',
  curved:        '⚠ Curved/irregular surfaces require Split mode. Assign each panel to a flat zone on the package.',
  'fruit-shaped':'⚠ Fruit-shaped die-cut packs (PeelPals style) require Split mode. Nutrition box in top flat zone; ingredients in the bottom margin; barcode near the peg hole; distributor on the back flat.',
};

// ── Unit conversion to px (96dpi screen) ────────────────────────────────────
function spcToPx(val, unit) {
  val = parseFloat(val) || 0;
  switch (unit) {
    case 'in': return val * 96;
    case 'mm': return val * 3.7795;
    case 'cm': return val * 37.795;
    case 'px':
    default:   return val;
  }
}
function spcToPt(val, unit) {
  // 1in = 72pt, 1mm = 2.8346pt, 1px = 0.75pt
  val = parseFloat(val) || 0;
  switch (unit) {
    case 'in': return val * 72;
    case 'mm': return val * 2.8346;
    case 'cm': return val * 28.346;
    case 'px': return val * 0.75;
    default:   return val;
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
function spcInit() {
  // Show/hide based on whether a project is open
  const hasProject = !!window.nfsCurrent;
  document.getElementById('spc-no-project').style.display  = hasProject ? 'none' : 'block';
  document.getElementById('spc-main').style.display        = hasProject ? 'block' : 'none';
  if (!hasProject) return;

  // Restore format from project if available
  const fmt = window.nfsCurrent?.spcFormat || 'vertical';
  const fmtEl = document.getElementById('spc-format');
  if (fmtEl) fmtEl.value = fmt;

  spcUpdate();
}

// ── Main update ──────────────────────────────────────────────────────────────
function spcUpdate() {
  const format   = document.getElementById('spc-format')?.value || 'vertical';
  const unit     = document.getElementById('spc-unit')?.value || 'in';
  const wRaw     = parseFloat(document.getElementById('spc-w')?.value) || 0;
  const hRaw     = parseFloat(document.getElementById('spc-h')?.value) || 0;
  const shape    = document.getElementById('spc-shape')?.value || 'rectangle';
  const minFont  = parseFloat(document.getElementById('spc-min-font')?.value) || 6;

  _spcFormat = format;

  // Sync unit label
  const unitLabel2 = document.getElementById('spc-unit-label2');
  if (unitLabel2) unitLabel2.textContent = unit;

  // Format description
  const descEl = document.getElementById('spc-format-desc');
  if (descEl) descEl.textContent = SPC_FORMAT_DESC[format] || '';

  // Split panel controls visibility
  const splitCtrl = document.getElementById('spc-split-controls');
  if (splitCtrl) splitCtrl.style.display = format === 'split' ? 'block' : 'none';

  // Placement preview (blister/fruit/curved/split)
  const placementPrev = document.getElementById('spc-placement-preview');
  if (placementPrev) {
    placementPrev.style.display = (format === 'split' || ['blister-card','curved','fruit-shaped'].includes(shape)) ? 'block' : 'none';
  }

  // Compliance check
  spcUpdateCompliance(format, wRaw, hRaw, unit, shape, minFont);

  // Render preview
  const data = spcGetData();
  if (!data) return;

  let html = '';
  switch (format) {
    case 'tabular':  html = spcRenderTabular(data, wRaw, hRaw, unit, minFont); break;
    case 'linear':   html = spcRenderLinear(data, wRaw, hRaw, unit, minFont); break;
    case 'split':    html = spcRenderSplit(data, wRaw, hRaw, unit, minFont); break;
    default:         html = spcRenderVertical(data, wRaw, hRaw, unit, minFont); break;
  }

  const inner = document.getElementById('spc-preview-inner');
  if (inner) {
    inner.innerHTML = html;
    inner.style.transform = `scale(${_spcZoom})`;
  }

  // Badge
  const badge = document.getElementById('spc-preview-badge');
  if (badge) {
    const labels = { vertical:'VERTICAL', tabular:'TABULAR', linear:'LINEAR', split:'SPLIT' };
    const colors = { vertical:'var(--blue)', tabular:'var(--green)', linear:'var(--orange)', split:'#a78bfa' };
    badge.textContent = labels[format] || format.toUpperCase();
    badge.style.background = (colors[format] || 'var(--accent)') + '22';
    badge.style.color = colors[format] || 'var(--accent)';
  }

  // Placement preview render
  if (format === 'split' || ['blister-card','curved','fruit-shaped'].includes(shape)) {
    spcRenderPlacementPreview(data, shape, format);
  }
}

// ── Compliance check ─────────────────────────────────────────────────────────
function spcUpdateCompliance(format, w, h, unit, shape, minFont) {
  const el = document.getElementById('spc-compliance-body');
  if (!el) return;

  const wPt = spcToPt(w, unit);
  const hPt = spcToPt(h, unit);
  const wIn = w && unit === 'in' ? w : (unit === 'mm' ? w/25.4 : unit === 'cm' ? w/2.54 : w/96);
  const hIn = h && unit === 'in' ? h : (unit === 'mm' ? h/25.4 : unit === 'cm' ? h/2.54 : h/96);

  const issues = [];
  const passes = [];
  const infos  = [];

  if (!w || !h) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);">Enter width and height to see compliance status.</div>';
    return;
  }

  // FDA minimum font: 6pt for small packages
  if (minFont < 6) {
    issues.push(`Font guard set to ${minFont}pt — FDA requires minimum 6pt for small package formats.`);
  } else {
    passes.push(`Font guard ${minFont}pt ≥ 6pt FDA minimum ✓`);
  }

  // Format-width checks
  if (format === 'vertical') {
    if (wIn < 1.75) issues.push(`Width ${w}${unit} (${wIn.toFixed(2)}in) is narrow for vertical format. Consider Tabular or Linear.`);
    else if (wIn < 2.25) infos.push(`Width is tight for vertical. Tabular may render more cleanly.`);
    else passes.push(`Width sufficient for vertical format ✓`);
    if (hIn < 3) issues.push(`Height ${h}${unit} (${hIn.toFixed(2)}in) may truncate vertical label. FDA label requires ≈3–4" minimum height.`);
    else passes.push(`Height sufficient for vertical format ✓`);
  }

  if (format === 'tabular') {
    if (wIn < 3.5) issues.push(`Tabular format works best at ≥3.5" wide. At ${wIn.toFixed(2)}in, columns may be too tight.`);
    else passes.push(`Width sufficient for tabular format ✓`);
    if (hIn > 1.5) infos.push(`Height ${hIn.toFixed(2)}in — vertical format may be preferable when height is not the constraint.`);
    passes.push(`Tabular: FDA §101.9(j)(13)(ii)(A) — allowed when no sufficient continuous vertical space ✓`);
  }

  if (format === 'linear') {
    if (wIn > 2 && hIn > 2) infos.push(`Package is ${wIn.toFixed(2)}"×${hIn.toFixed(2)}". Linear is typically used only when tabular will not fit. Verify package qualifies under §101.9(j)(13)(ii)(B).`);
    else passes.push(`Linear format appropriate for very-small/narrow package ✓`);
    passes.push(`Linear: FDA §101.9(j)(13)(ii)(B) — allowed for very small packages ✓`);
  }

  if (format === 'split') {
    passes.push(`Split mode: each zone is independently sized. No single-panel dimension constraint. ✓`);
    infos.push(`Ensure each exported panel meets minimum 6pt font in its final placed size.`);
  }

  // Shape notes
  const shapeNote = SPC_SHAPE_NOTE[shape];
  if (shapeNote) infos.push(shapeNote.replace(/^[⚠ℹ]\s*/,''));

  // Surface area for label type
  const areaSqIn = wIn * hIn;
  if (areaSqIn < 5) infos.push(`Total area ${areaSqIn.toFixed(1)} sq in — qualifies for FDA small package formats.`);
  else if (areaSqIn < 12) infos.push(`Total area ${areaSqIn.toFixed(1)} sq in — intermediate package range. Tabular or vertical both valid.`);

  // Build HTML
  let html = '';
  if (issues.length) {
    html += issues.map(i => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:11px;color:var(--orange);margin-bottom:5px;"><span style="flex-shrink:0;">⚠</span><span>${i}</span></div>`).join('');
  }
  if (infos.length) {
    html += infos.map(i => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:11px;color:var(--dim);margin-bottom:5px;"><span style="flex-shrink:0;">ℹ</span><span>${i}</span></div>`).join('');
  }
  if (passes.length) {
    html += passes.map(p => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:11px;color:var(--green);margin-bottom:5px;"><span style="flex-shrink:0;">✓</span><span>${p}</span></div>`).join('');
  }
  el.innerHTML = html || '<div style="font-size:11px;color:var(--muted);">No issues detected.</div>';
}

// ── Data extraction from current project ────────────────────────────────────
// Nutrient key map: project key → { label, unit, dvKey }
const SPC_NUTRIENT_MAP = [
  { key:'tf',  dvKey:'tf',  label:'Total Fat',           unit:'g',   bold:true,  indent:0,  hasPct:true  },
  { key:'sf',  dvKey:'sf',  label:'Saturated Fat',       unit:'g',   bold:false, indent:10, hasPct:true  },
  { key:'xf',  dvKey:null,  label:'Trans Fat',           unit:'g',   bold:false, indent:10, hasPct:false },
  { key:'ch',  dvKey:'ch',  label:'Cholesterol',         unit:'mg',  bold:true,  indent:0,  hasPct:true  },
  { key:'na',  dvKey:'na',  label:'Sodium',              unit:'mg',  bold:true,  indent:0,  hasPct:true  },
  { key:'tc',  dvKey:'tc',  label:'Total Carbohydrate',  unit:'g',   bold:true,  indent:0,  hasPct:true  },
  { key:'df',  dvKey:'df',  label:'Dietary Fiber',       unit:'g',   bold:false, indent:10, hasPct:true  },
  { key:'su',  dvKey:null,  label:'Total Sugars',        unit:'g',   bold:false, indent:10, hasPct:false },
  { key:'as_', dvKey:'as_', label:'Incl. Added Sugars',  unit:'g',   bold:false, indent:20, hasPct:true  },
  { key:'pr',  dvKey:null,  label:'Protein',             unit:'g',   bold:true,  indent:0,  hasPct:false },
];
const SPC_MICRO_MAP = [
  { key:'vd', dvKey:'vd', label:'Vit. D',    unit:'mcg' },
  { key:'ca', dvKey:'ca', label:'Calcium',   unit:'mg'  },
  { key:'fe', dvKey:'fe', label:'Iron',      unit:'mg'  },
  { key:'k',  dvKey:'k',  label:'Potassium', unit:'mg'  },
];

function spcGetData() {
  const p = window.nfsCurrent;
  if (!p) return null;

  // Read from nfsCurrent.nutrients (declared) and nfsCurrent.dv
  const N  = p.nutrients || {};
  const DV = p.dv || {};

  // Also try to read live form values as fallback (editor may not have saved yet)
  const formVal = (id) => {
    const el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  };

  const nVal = (key, formId) => {
    const stored = N[key]?.declared;
    if (stored !== '' && stored !== undefined && stored !== null) return String(stored);
    if (formId) { const fv = formVal(formId); if (fv) return fv; }
    return '0';
  };
  const dvVal = (key, formId) => {
    const stored = DV[key];
    if (stored !== '' && stored !== undefined && stored !== null) return String(stored);
    if (formId) { const fv = formVal(formId); if (fv) return fv; }
    return '0';
  };

  // Build nutrient objects
  function buildNr(def) {
    return {
      val:    nVal(def.key,  'n-' + (def.key === 'as_' ? 'as' : def.key)),
      pct:    def.hasPct ? dvVal(def.dvKey, 'p-' + (def.dvKey === 'as_' ? 'as' : def.dvKey)) : null,
      label:  def.label,
      unit:   def.unit,
      bold:   def.bold,
      indent: def.indent,
    };
  }

  const nutrients = {};
  SPC_NUTRIENT_MAP.forEach(def => { nutrients[def.key] = buildNr(def); });
  const micros    = {};
  SPC_MICRO_MAP.forEach(def => { micros[def.key] = buildNr({...def, bold:false, indent:0, hasPct:true}); });

  // Barcode
  const bc = p.barcode || {};
  const hasBarcode = bc.include && bc.mode === 'real' && bc.code;

  // Build distributor text
  const rawDist   = (p.distributor || formVal('e-dist')).trim();
  const rawOrigin = (p.origin || formVal('e-origin')).trim();
  const distLines = rawDist.split(/[\n|]/).map(l => l.trim()).filter(Boolean);

  // Net weight
  const oz = p.netOz || formVal('e-oz');
  const g  = p.netG  || formVal('e-g');
  const netWt = (oz || g) ? `NET WT ${oz ? oz + ' OZ' : ''}${oz && g ? ' (' : ''}${g ? g + 'g' : ''}${oz && g ? ')' : ''}`.trim() : '';

  // Ingredients + allergens
  const ingRaw = (p.ingredients || formVal('e-ing')).trim();
  const allergenCustom = (p.allergenCustom || formVal('e-al-custom')).trim();
  const allergens = p.allergens || [];
  const allergenText = allergenCustom || (allergens.length ? 'Contains: ' + allergens.join(', ') + '.' : '');

  // Calories
  const calories = nVal('cal', 'n-cal');

  return {
    name:               p.name || 'Label',
    servingSize:        p.servingSize || formVal('e-ss'),
    servingPerContainer:p.servingsPerContainer || formVal('e-spc'),
    calories,
    nutrients,   // SPC_NUTRIENT_MAP keys
    micros,      // SPC_MICRO_MAP keys
    ingredients:   ingRaw,
    allergenText:  allergenText,
    distLines:     distLines,
    origin:        rawOrigin,
    netWt:         netWt,
    hasBarcode:    hasBarcode,
    barcodeCode:   bc.code || '',
    barcodeType:   bc.type || 'UPC-A',
    warning:       (p.warning || formVal('e-warn')).trim(),
  };
}

// ── RENDERER: Standard Vertical ─────────────────────────────────────────────
function spcRenderVertical(d, w, h, unit, minFont) {
  const wPx = w ? spcToPx(w, unit) : 280;
  const fs  = Math.max(minFont, 6);
  const baseSize = Math.max(fs, Math.min(10, wPx / 28));

  return `<div class="nf-label preset-small-package" style="width:${Math.max(160, wPx)}px;font-size:${baseSize}px;border:2px solid #000;padding:5px 6px;box-sizing:border-box;background:#fff;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;line-height:1.2;">
  ${spcNFPanelHTML(d, baseSize, 'vertical')}
  ${spcSupportBlockHTML(d, baseSize)}
</div>`;
}

// ── RENDERER: Tabular ────────────────────────────────────────────────────────
function spcRenderTabular(d, w, h, unit, minFont) {
  const wPx    = w ? spcToPx(w, unit) : 400;
  const fs     = Math.max(minFont, 6);
  const colFs  = Math.max(fs - 1, 5.5);

  // FDA Tabular: "Nutrition Facts" header on left, nutrients in columns to the right
  const nr = d.nutrients;
  const mc = d.micros;

  // Column 1: Fat group
  const col1 = [
    { label: 'Total Fat',    val: (nr.tf?.val||'0')  + 'g',  pct: (nr.tf?.pct||'0')  + '%', sub: false },
    { label: 'Sat. Fat',     val: (nr.sf?.val||'0')  + 'g',  pct: (nr.sf?.pct||'0')  + '%', sub: true  },
    { label: 'Trans Fat',    val: (nr.xf?.val||'0')  + 'g',  pct: null,                      sub: true  },
    { label: 'Cholesterol',  val: (nr.ch?.val||'0')  + 'mg', pct: (nr.ch?.pct||'0')  + '%', sub: false },
    { label: 'Sodium',       val: (nr.na?.val||'0')  + 'mg', pct: (nr.na?.pct||'0')  + '%', sub: false },
  ];
  // Column 2: Carb group
  const col2 = [
    { label: 'Total Carb.',        val: (nr.tc?.val||'0')  + 'g', pct: (nr.tc?.pct||'0')  + '%', sub: false },
    { label: 'Dietary Fiber',      val: (nr.df?.val||'0')  + 'g', pct: (nr.df?.pct||'0')  + '%', sub: true  },
    { label: 'Total Sugars',       val: (nr.su?.val||'0')  + 'g', pct: null,                      sub: true  },
    { label: 'Incl. Added Sugars', val: (nr['as_']?.val||'0') + 'g', pct: (nr['as_']?.pct||'0') + '%', sub: true },
    { label: 'Protein',            val: (nr.pr?.val||'0')  + 'g', pct: null,                      sub: false },
  ];
  // Column 3: Micros
  const col3 = [
    { label: 'Vit. D',    val: (mc.vd?.val||'0') + 'mcg', pct: (mc.vd?.pct||'0') + '%' },
    { label: 'Calcium',   val: (mc.ca?.val||'0') + 'mg',  pct: (mc.ca?.pct||'0') + '%' },
    { label: 'Iron',      val: (mc.fe?.val||'0') + 'mg',  pct: (mc.fe?.pct||'0') + '%' },
    { label: 'Potassium', val: (mc.k?.val||'0')  + 'mg',  pct: (mc.k?.pct||'0')  + '%' },
  ];

  const nrRow = (row) => `<tr style="border-bottom:0.5px solid #bbb;">
    <td style="font-size:${colFs}px;padding:1px 2px;${row.sub ? 'padding-left:8px;font-weight:400;' : 'font-weight:700;'}">${row.label}</td>
    <td style="font-size:${colFs}px;padding:1px 2px;text-align:right;white-space:nowrap;">${row.val}${row.pct ? ` <b>${row.pct}</b>` : ''}</td>
  </tr>`;

  const microRow = (row) => `<tr>
    <td style="font-size:${colFs}px;padding:1px 3px;">${row.label}</td>
    <td style="font-size:${colFs}px;padding:1px 3px;text-align:right;white-space:nowrap;">${row.val} <b>${row.pct}</b></td>
  </tr>`;

  return `<div style="background:#fff;border:2px solid #000;padding:5px;box-sizing:border-box;width:${Math.max(280, wPx)}px;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;">
  <!-- TABULAR HEADER ROW -->
  <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:0;border-bottom:6px solid #000;margin-bottom:3px;padding-bottom:3px;align-items:stretch;">

    <!-- Cell A: Header, serving, calories -->
    <div style="padding-right:8px;border-right:0.75px solid #000;min-width:90px;">
      <div style="font-size:${Math.max(fs+2, 14)}px;font-weight:900;line-height:0.95;letter-spacing:-0.5px;">Nutrition<br>Facts</div>
      ${d.servingPerContainer ? `<div style="font-size:${fs}px;line-height:1.3;margin-top:2px;">${d.servingPerContainer} servings per container</div>` : ''}
      ${d.servingSize ? `<div style="font-size:${fs}px;font-weight:700;line-height:1.3;">Serving size ${d.servingSize}</div>` : ''}
      <div style="margin-top:3px;">
        <span style="font-size:${fs}px;font-weight:900;">Calories</span>
        <span style="font-size:${Math.max(fs+4, 18)}px;font-weight:900;letter-spacing:-1px;margin-left:4px;">${d.calories}</span>
      </div>
    </div>

    <!-- Cell B: Fat + Carb columns -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding:0 6px;border-right:0.75px solid #000;">
      <div>
        <div style="font-size:${fs - 0.5}px;font-weight:700;border-bottom:0.5px solid #000;padding-bottom:1px;margin-bottom:1px;text-align:right;">Amount/serving &nbsp; %DV*</div>
        <table style="width:100%;border-collapse:collapse;">${col1.map(nrRow).join('')}</table>
      </div>
      <div style="padding-left:6px;">
        <div style="font-size:${fs - 0.5}px;font-weight:700;border-bottom:0.5px solid #000;padding-bottom:1px;margin-bottom:1px;text-align:right;">Amount/serving &nbsp; %DV*</div>
        <table style="width:100%;border-collapse:collapse;">${col2.map(nrRow).join('')}</table>
      </div>
    </div>

    <!-- Cell C: Micros -->
    <div style="padding-left:6px;">
      <div style="font-size:${fs - 0.5}px;font-weight:700;border-bottom:0.5px solid #000;padding-bottom:1px;margin-bottom:1px;text-align:right;">%DV*</div>
      <table style="width:100%;border-collapse:collapse;">${col3.map(microRow).join('')}</table>
    </div>

  </div>
  <!-- FOOTNOTE -->
  <div style="font-size:${Math.max(fs-1, 5.5)}px;color:#000;line-height:1.3;margin-bottom:4px;">
    *The % Daily Value tells you how much a nutrient in a serving contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.
  </div>
</div>
<!-- SUPPORT BLOCK - standalone, outside NF box -->
${spcSupportBlockHTML(d, fs)}`;
}

// ── RENDERER: Linear ─────────────────────────────────────────────────────────
function spcRenderLinear(d, w, h, unit, minFont) {
  const wPx = w ? spcToPx(w, unit) : 500;
  const fs  = Math.max(minFont, 6);
  const nr  = d.nutrients;
  const mc  = d.micros;
  const v   = k => nr[k]?.val || '0';
  const p   = k => nr[k]?.pct || mc[k]?.pct || '0';
  const mv  = k => mc[k]?.val || '0';
  const mp  = k => mc[k]?.pct || '0';

  // FDA Linear: one continuous text line with all required nutrients
  const parts = [
    `<b>Nutrition Facts</b>`,
    d.servingPerContainer ? `${d.servingPerContainer} servings per container` : null,
    d.servingSize ? `Serving size ${d.servingSize}` : null,
    `Calories <b>${d.calories}</b>`,
    `Total Fat <b>${v('tf')}g ${p('tf')}%DV</b>`,
    `Saturated Fat <b>${v('sf')}g ${p('sf')}%DV</b>`,
    `<i>Trans</i> Fat <b>${v('xf')}g</b>`,
    `Cholesterol <b>${v('ch')}mg ${p('ch')}%DV</b>`,
    `Sodium <b>${v('na')}mg ${p('na')}%DV</b>`,
    `Total Carbohydrate <b>${v('tc')}g ${p('tc')}%DV</b>`,
    `Dietary Fiber <b>${v('df')}g ${p('df')}%DV</b>`,
    `Total Sugars <b>${v('su')}g</b>`,
    `Incl. ${v('as_')}g Added Sugars <b>${p('as_')}%DV</b>`,
    `Protein <b>${v('pr')}g</b>`,
    `Vit. D <b>${mv('vd')}mcg ${mp('vd')}%DV</b>`,
    `Calcium <b>${mv('ca')}mg ${mp('ca')}%DV</b>`,
    `Iron <b>${mv('fe')}mg ${mp('fe')}%DV</b>`,
    `Potassium <b>${mv('k')}mg ${mp('k')}%DV</b>`,
  ].filter(Boolean);

  return `<div style="background:#fff;border:2px solid #000;padding:4px 6px;box-sizing:border-box;width:${Math.max(200, wPx)}px;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;font-size:${fs}px;color:#000;line-height:1.5;">
  ${parts.join(' / ')}
  <div style="font-size:${Math.max(fs-1, 5)}px;margin-top:3px;line-height:1.3;">*%DV = % Daily Value. 2,000 cal/day used for general nutrition advice.</div>
</div>
<!-- SUPPORT BLOCK - standalone, outside NF box -->
${spcSupportBlockHTML(d, fs)}`;
}

// ── RENDERER: Split Panels ───────────────────────────────────────────────────
function spcRenderSplit(d, w, h, unit, minFont) {
  const wPx = w ? spcToPx(w, unit) : 280;
  const fs  = Math.max(minFont, 6);

  const showNutrition   = document.getElementById('spc-show-nutrition')?.checked  !== false;
  const showIngredients = document.getElementById('spc-show-ingredients')?.checked !== false;
  const showBarcode     = document.getElementById('spc-show-barcode')?.checked     !== false;
  const showDist        = document.getElementById('spc-show-dist')?.checked        !== false;

  const panels = [];

  if (showNutrition) {
    panels.push(`<div style="margin-bottom:12px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:4px;">① Nutrition Facts Panel</div>
      <div style="border:2px solid #000;padding:5px 6px;background:#fff;box-sizing:border-box;display:inline-block;min-width:150px;max-width:${Math.max(160,wPx)}px;">
        ${spcNFPanelHTML(d, fs, 'vertical')}
      </div>
    </div>`);
  }

  if (showIngredients) {
    panels.push(`<div style="margin-bottom:12px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:4px;">② Ingredients / Allergen Panel</div>
      <div style="border:1.5px solid #000;padding:5px 6px;background:#fff;box-sizing:border-box;display:inline-block;max-width:${Math.max(160,wPx)}px;">
        ${spcIngBlockHTML(d, fs)}
      </div>
    </div>`);
  }

  if (showBarcode) {
    panels.push(`<div style="margin-bottom:12px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:4px;">③ Barcode Panel</div>
      <div style="border:1.5px solid #000;padding:8px 10px;background:#fff;box-sizing:border-box;display:inline-block;text-align:center;min-width:120px;">
        ${spcBarcodeBlockHTML(d, fs)}
      </div>
    </div>`);
  }

  if (showDist) {
    panels.push(`<div style="margin-bottom:12px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:4px;">④ Distributor / Origin Panel</div>
      <div style="border:1.5px solid #000;padding:5px 6px;background:#fff;box-sizing:border-box;display:inline-block;max-width:${Math.max(160,wPx)}px;">
        ${spcDistBlockHTML(d, fs)}
      </div>
    </div>`);
  }

  return `<div style="font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#000;">
    <div style="font-size:10px;color:#888;margin-bottom:12px;font-style:italic;">Each block is a separate export asset. Place independently on your packaging.</div>
    ${panels.join('')}
  </div>`;
}

// ── HTML sub-blocks ──────────────────────────────────────────────────────────

function spcNFPanelHTML(d, fs, mode) {
  const nr  = d.nutrients;
  const mc  = d.micros;
  const titleSize = Math.max(fs * 2.8, 18);
  const calSize   = Math.max(fs * 2.5, 16);
  const nrSize    = Math.max(fs, 6);
  const mfs       = Math.max(fs - 0.5, 5.5);

  // Safe accessor — check nutrients first, then micros
  const nv = (k) => (nr[k]?.val !== undefined ? nr[k]?.val : mc[k]?.val) || '0';
  const np = (k) => {
    const v = nr[k]?.pct !== undefined ? nr[k]?.pct : mc[k]?.pct;
    return (v !== undefined && v !== null) ? v : null;
  };

  function nRow(label, val, valUnit, pctVal, bold, indent, extraBorder) {
    const pctHTML = pctVal !== null && pctVal !== undefined ? `<span style="font-weight:700;">${pctVal}%</span>` : '';
    return `<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:${nrSize}px;padding:1.5px 0;border-bottom:${extraBorder || '0.75px solid #000'};${indent ? 'padding-left:'+indent+'px;' : ''}${bold ? 'font-weight:700;' : 'font-weight:400;'}">
      <span>${label}</span>
      <span style="white-space:nowrap;padding-left:4px;">${val}${valUnit} ${pctHTML}</span>
    </div>`;
  }

  return `
  <div style="font-size:${titleSize}px;font-weight:900;line-height:0.92;letter-spacing:-0.5px;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:3px;">Nutrition<br>Facts</div>
  ${d.servingPerContainer ? `<div style="font-size:${nrSize}px;line-height:1.3;">${d.servingPerContainer} servings per container</div>` : ''}
  ${d.servingSize ? `<div style="font-size:${nrSize}px;font-weight:700;line-height:1.3;margin-bottom:2px;">Serving size ${d.servingSize}</div>` : ''}
  <div style="border-top:8px solid #000;padding-top:2px;">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:4px solid #000;padding-bottom:2px;margin-bottom:2px;">
      <div style="font-size:${Math.max(fs,8)}px;font-weight:900;line-height:1;">Calories</div>
      <div style="font-size:${calSize}px;font-weight:900;line-height:1;letter-spacing:-1px;">${d.calories}</div>
    </div>
    <div style="text-align:right;font-size:${Math.max(fs-1,5)}px;font-weight:700;border-bottom:1px solid #000;padding:1px 0;margin-bottom:1px;">% Daily Value*</div>
    ${nRow('Total Fat',           nv('tf'),  'g',   np('tf'),  true,  0   )}
    ${nRow('Saturated Fat',       nv('sf'),  'g',   np('sf'),  false, 10  )}
    ${nRow('<i>Trans</i> Fat',    nv('xf'),  'g',   null,      false, 10  )}
    ${nRow('Cholesterol',         nv('ch'),  'mg',  np('ch'),  true,  0   )}
    ${nRow('Sodium',              nv('na'),  'mg',  np('na'),  true,  0   )}
    ${nRow('Total Carbohydrate',  nv('tc'),  'g',   np('tc'),  true,  0   )}
    ${nRow('Dietary Fiber',       nv('df'),  'g',   np('df'),  false, 10  )}
    ${nRow('Total Sugars',        nv('su'),  'g',   null,      false, 10  )}
    ${nRow('Incl. '+nv('as_')+'g Added Sugars', '', '', np('as_'), false, 20)}
    ${nRow('Protein',             nv('pr'),  'g',   null,      true,  0, '8px solid #000')}
    <!-- Micronutrients -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #000;padding:1.5px 0;">
      <div style="font-size:${mfs}px;padding:0 4px 0 0;border-right:0.5px solid #000;">Vit. D ${nv('vd')}mcg <b>${np('vd')||'0'}%</b></div>
      <div style="font-size:${mfs}px;padding:0 0 0 4px;">Calcium ${nv('ca')}mg <b>${np('ca')||'0'}%</b></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding:1.5px 0;">
      <div style="font-size:${mfs}px;padding:0 4px 0 0;border-right:0.5px solid #000;">Iron ${nv('fe')}mg <b>${np('fe')||'0'}%</b></div>
      <div style="font-size:${mfs}px;padding:0 0 0 4px;">Potassium ${nv('k')}mg <b>${np('k')||'0'}%</b></div>
    </div>
    <div style="font-size:${Math.max(fs-1,5)}px;border-top:1px solid #000;padding-top:3px;line-height:1.4;margin-top:2px;">*The % Daily Value tells you how much a nutrient in a serving contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.</div>
  </div>`;
}

function spcIngBlockHTML(d, fs) {
  if (!d.ingredients && !d.allergenText) {
    return `<div style="font-size:${fs}px;color:#888;font-style:italic;">No ingredient data.</div>`;
  }
  let html = '';
  if (d.ingredients) {
    const ingEsc = d.ingredients.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += `<div style="font-size:${Math.max(fs,6)}px;line-height:1.55;color:#000;"><strong>INGREDIENTS:</strong> ${ingEsc}</div>`;
  }
  if (d.allergenText) {
    html += `<div style="font-size:${Math.max(fs,6)}px;font-weight:700;margin-top:4px;color:#000;">${d.allergenText}</div>`;
  }
  return html;
}

function spcBarcodeBlockHTML(d, fs) {
  if (!d.hasBarcode) {
    return `<div style="font-size:${fs}px;color:#aaa;font-style:italic;text-align:center;">No barcode configured.<br>Enable in Barcode Module.</div>`;
  }
  // Render a simple CSS barcode placeholder (real barcode is in the barcode module)
  const code = d.barcodeCode || '';
  return `<div style="display:inline-flex;flex-direction:column;align-items:center;">
    <div style="display:flex;gap:1px;height:50px;align-items:flex-end;margin-bottom:3px;">
      ${Array.from(code).map((c,i) => {
        const w = (i % 3 === 0) ? 2 : 1;
        const h = (i % 5 === 0) ? 50 : i % 3 === 0 ? 45 : 50;
        return `<div style="width:${w}px;height:${h}px;background:#000;flex-shrink:0;"></div>`;
      }).join('')}
    </div>
    <div style="font-size:${Math.max(fs-1,5)}px;font-family:'Courier New',monospace;letter-spacing:1px;">${code}</div>
    <div style="font-size:${Math.max(fs-2,4.5)}px;color:#666;">${d.barcodeType}</div>
  </div>`;
}

function spcDistBlockHTML(d, fs) {
  if (!d.distLines.length && !d.origin && !d.netWt) {
    return `<div style="font-size:${fs}px;color:#888;font-style:italic;">No distributor/origin data.</div>`;
  }
  let html = '';
  d.distLines.forEach((part, i) => {
    const isWebsite = /^https?:\/\//i.test(part) || /^www\./i.test(part) ||
      (/^[^\s@]+\.(co|com|net|io|org|us|ca|shop|store)(\b|$)/i.test(part) && !part.includes(' '));
    if (i === 0) {
      const label = part.replace(/^distributed\s+by\s*:?\s*/i, '');
      html += `<div style="font-size:${Math.max(fs,6)}px;line-height:1.6;color:#000;"><strong>DISTRIBUTED BY:</strong> ${label}</div>`;
    } else if (isWebsite) {
      html += `<div style="font-size:${Math.max(fs,6)}px;line-height:1.6;color:#000;">${part.replace(/^https?:\/\//i,'').toUpperCase()}</div>`;
    } else {
      html += `<div style="font-size:${Math.max(fs,6)}px;line-height:1.6;color:#000;">${part}</div>`;
    }
  });
  if (d.origin) {
    const origin = d.origin.trim()
      .replace(/^manufactured\s+in\s*/i, 'PRODUCT OF ')
      .replace(/^made\s+in\s*/i, 'PRODUCT OF ')
      .toUpperCase();
    html += `<div style="font-size:${Math.max(fs,6)}px;font-weight:700;line-height:1.6;color:#000;">${origin}</div>`;
  }
  if (d.netWt) {
    html += `<div style="font-size:${Math.max(fs,6)}px;font-weight:700;line-height:1.6;color:#000;margin-top:2px;">${d.netWt}</div>`;
  }
  if (d.warning) {
    html += `<div style="font-size:${Math.max(fs,6)}px;font-weight:700;line-height:1.6;color:#000;margin-top:2px;">${d.warning}</div>`;
  }
  return html;
}

function spcSupportBlockHTML(d, fs) {
  const ing    = spcIngBlockHTML(d, fs);
  const dist   = spcDistBlockHTML(d, fs);
  const bc     = d.hasBarcode ? spcBarcodeBlockHTML(d, fs) : '';
  return `<div style="margin-top:6px;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;background:#fff;">
    ${ing}
    ${bc ? `<div style="margin-top:6px;">${bc}</div>` : ''}
    ${d.distLines.length || d.origin ? `<div style="margin-top:6px;">${dist}</div>` : ''}
  </div>`;
}

// ── Placement Preview (blister card / fruit-shaped schematic) ────────────────
function spcRenderPlacementPreview(d, shape, format) {
  const el = document.getElementById('spc-placement-inner');
  if (!el) return;

  let shapeHTML = '';

  if (shape === 'fruit-shaped' || shape === 'blister-card') {
    // Fruit / blister card schematic
    shapeHTML = `
      <div style="position:relative;width:260px;height:320px;">
        <!-- Fruit outline (peach/grape shaped) -->
        <svg viewBox="0 0 260 320" width="260" height="320" style="position:absolute;top:0;left:0;">
          <ellipse cx="130" cy="165" rx="110" ry="130" fill="#f0d6a0" stroke="#bbb" stroke-width="2"/>
          <ellipse cx="130" cy="38" rx="20" ry="30" fill="#a0d6a0" stroke="#8bc" stroke-width="1.5"/>
          <!-- peg hole -->
          <circle cx="130" cy="18" r="8" fill="#fff" stroke="#bbb" stroke-width="1.5"/>
          <!-- Label zones -->
          <!-- Zone 1: Nutrition -->
          <rect x="22" y="60" width="90" height="110" rx="3" fill="rgba(100,160,255,0.18)" stroke="#4fa3ff" stroke-width="1.5" stroke-dasharray="4 2"/>
          <!-- Zone 2: Ingredients -->
          <rect x="122" y="60" width="116" height="65" rx="3" fill="rgba(100,220,150,0.18)" stroke="#3dca80" stroke-width="1.5" stroke-dasharray="4 2"/>
          <!-- Zone 3: Barcode -->
          <rect x="122" y="135" width="116" height="40" rx="3" fill="rgba(255,200,80,0.18)" stroke="#e0a020" stroke-width="1.5" stroke-dasharray="4 2"/>
          <!-- Zone 4: Dist/Origin -->
          <rect x="22" y="185" width="216" height="35" rx="3" fill="rgba(200,150,255,0.18)" stroke="#a060e0" stroke-width="1.5" stroke-dasharray="4 2"/>
        </svg>
        <!-- Zone labels -->
        <div style="position:absolute;top:97px;left:30px;font-size:8px;color:#2255aa;font-weight:700;line-height:1.2;">① NF<br>Panel</div>
        <div style="position:absolute;top:75px;left:128px;font-size:8px;color:#1a7a40;font-weight:700;line-height:1.2;">② Ingredients<br>+ Allergens</div>
        <div style="position:absolute;top:148px;left:128px;font-size:8px;color:#8a6010;font-weight:700;">③ Barcode</div>
        <div style="position:absolute;top:192px;left:70px;font-size:8px;color:#6030a0;font-weight:700;">④ Distributor / Origin / Net Weight</div>
      </div>`;
  } else if (shape === 'narrow-strip') {
    shapeHTML = `
      <div style="position:relative;width:300px;height:100px;">
        <svg viewBox="0 0 300 100" width="300" height="100" style="position:absolute;top:0;left:0;">
          <rect x="1" y="1" width="298" height="98" rx="4" fill="#f5f5f0" stroke="#bbb" stroke-width="1.5"/>
          <rect x="5"   y="5" width="85" height="90" rx="2" fill="rgba(100,160,255,0.18)" stroke="#4fa3ff" stroke-width="1.5" stroke-dasharray="4 2"/>
          <rect x="97"  y="5" width="100" height="90" rx="2" fill="rgba(100,220,150,0.18)" stroke="#3dca80" stroke-width="1.5" stroke-dasharray="4 2"/>
          <rect x="204" y="5" width="55" height="90" rx="2" fill="rgba(255,200,80,0.18)" stroke="#e0a020" stroke-width="1.5" stroke-dasharray="4 2"/>
          <rect x="266" y="5" width="30" height="90" rx="2" fill="rgba(200,150,255,0.18)" stroke="#a060e0" stroke-width="1.5" stroke-dasharray="4 2"/>
        </svg>
        <div style="position:absolute;top:38px;left:10px;font-size:7px;color:#2255aa;font-weight:700;line-height:1.2;">① NF<br>Linear</div>
        <div style="position:absolute;top:38px;left:103px;font-size:7px;color:#1a7a40;font-weight:700;">② Ingredients</div>
        <div style="position:absolute;top:38px;left:208px;font-size:7px;color:#8a6010;font-weight:700;">③ BC</div>
        <div style="position:absolute;top:38px;left:268px;font-size:7px;color:#6030a0;font-weight:700;">④</div>
      </div>`;
  } else if (shape === 'curved') {
    shapeHTML = `
      <div style="position:relative;width:220px;height:260px;">
        <svg viewBox="0 0 220 260" width="220" height="260" style="position:absolute;top:0;left:0;">
          <path d="M20,10 Q110,0 200,10 L210,250 Q110,260 10,250 Z" fill="#e8e8f0" stroke="#bbb" stroke-width="2"/>
          <rect x="20" y="20" width="80" height="100" rx="3" fill="rgba(100,160,255,0.18)" stroke="#4fa3ff" stroke-width="1.5" stroke-dasharray="4 2"/>
          <rect x="112" y="20" width="88" height="60" rx="3" fill="rgba(100,220,150,0.18)" stroke="#3dca80" stroke-width="1.5" stroke-dasharray="4 2"/>
          <rect x="112" y="90" width="88" height="35" rx="3" fill="rgba(255,200,80,0.18)" stroke="#e0a020" stroke-width="1.5" stroke-dasharray="4 2"/>
          <rect x="20"  y="135" width="180" height="30" rx="3" fill="rgba(200,150,255,0.18)" stroke="#a060e0" stroke-width="1.5" stroke-dasharray="4 2"/>
        </svg>
        <div style="position:absolute;top:62px;left:28px;font-size:8px;color:#2255aa;font-weight:700;line-height:1.2;">① NF<br>Panel</div>
        <div style="position:absolute;top:38px;left:118px;font-size:8px;color:#1a7a40;font-weight:700;">② Ingredients</div>
        <div style="position:absolute;top:103px;left:118px;font-size:8px;color:#8a6010;font-weight:700;">③ Barcode</div>
        <div style="position:absolute;top:143px;left:80px;font-size:8px;color:#6030a0;font-weight:700;">④ Distributor / Origin</div>
      </div>`;
  }

  el.innerHTML = shapeHTML
    ? `${shapeHTML}
       <div style="display:flex;flex-direction:column;gap:6px;align-self:center;">
         <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#eee;"><div style="width:16px;height:10px;background:rgba(100,160,255,0.4);border:1.5px solid #4fa3ff;border-radius:2px;flex-shrink:0;"></div>① Nutrition Facts Panel</div>
         <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#eee;"><div style="width:16px;height:10px;background:rgba(100,220,150,0.4);border:1.5px solid #3dca80;border-radius:2px;flex-shrink:0;"></div>② Ingredients / Allergens</div>
         <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#eee;"><div style="width:16px;height:10px;background:rgba(255,200,80,0.4);border:1.5px solid #e0a020;border-radius:2px;flex-shrink:0;"></div>③ Barcode</div>
         <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#eee;"><div style="width:16px;height:10px;background:rgba(200,150,255,0.4);border:1.5px solid #a060e0;border-radius:2px;flex-shrink:0;"></div>④ Distributor / Origin</div>
       </div>`
    : '<div style="font-size:11px;color:#666;font-style:italic;">Placement preview available for blister card, fruit-shaped, curved, and narrow strip shapes.</div>';
}

// ── Zoom ─────────────────────────────────────────────────────────────────────
function spcZoom(dir) {
  const steps = [0.5, 0.625, 0.75, 1, 1.25, 1.5, 2];
  const idx = steps.indexOf(_spcZoom);
  const next = Math.max(0, Math.min(steps.length - 1, idx + dir));
  _spcZoom = steps[next] || 1;
  const inner = document.getElementById('spc-preview-inner');
  if (inner) inner.style.transform = `scale(${_spcZoom})`;
  const lbl = document.getElementById('spc-zoom-label');
  if (lbl) lbl.textContent = Math.round(_spcZoom * 100) + '%';
}

// ── Export utilities ─────────────────────────────────────────────────────────
function spcBuildExportHTML(title, bodyHTML, wRaw, hRaw, unit) {
  const wIn = wRaw ? (unit === 'in' ? wRaw : unit === 'mm' ? wRaw/25.4 : unit === 'cm' ? wRaw/2.54 : wRaw/96) : 3;
  const hIn = hRaw ? (unit === 'in' ? hRaw : unit === 'mm' ? hRaw/25.4 : unit === 'cm' ? hRaw/2.54 : hRaw/96) : 4;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { size: ${wIn.toFixed(3)}in ${hIn.toFixed(3)}in; margin: 4mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>${bodyHTML}</body>
</html>`;
}

function spcDownloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

function spcExportPanel(type) {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Project', 'Open a label first.'); return; }

  const unit  = document.getElementById('spc-unit')?.value || 'in';
  const wRaw  = parseFloat(document.getElementById('spc-w')?.value) || 3;
  const hRaw  = parseFloat(document.getElementById('spc-h')?.value) || 4;
  const fs    = parseFloat(document.getElementById('spc-min-font')?.value) || 6;
  const name  = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g,'-');

  let bodyHTML = '', filename = '', title = '';

  switch (type) {
    case 'nutrition':
      title    = `Nutrition Facts Panel — ${d.name}`;
      filename = `nf_${name}_nutrition_panel.html`;
      bodyHTML = `<div style="display:inline-block;border:2px solid #000;padding:5px 6px;background:#fff;">${spcNFPanelHTML(d, Math.max(fs,6), 'vertical')}</div>`;
      break;
    case 'ingredients':
      title    = `Ingredients Panel — ${d.name}`;
      filename = `nf_${name}_ingredients_panel.html`;
      bodyHTML = `<div style="display:inline-block;border:1.5px solid #000;padding:5px 8px;background:#fff;">${spcIngBlockHTML(d, Math.max(fs,6))}</div>`;
      break;
    case 'barcode':
      title    = `Barcode Panel — ${d.name}`;
      filename = `nf_${name}_barcode_panel.html`;
      bodyHTML = `<div style="display:inline-block;border:1.5px solid #000;padding:8px 12px;background:#fff;text-align:center;">${spcBarcodeBlockHTML(d, Math.max(fs,6))}</div>`;
      break;
    case 'distributor':
      title    = `Distributor / Origin Panel — ${d.name}`;
      filename = `nf_${name}_distributor_panel.html`;
      bodyHTML = `<div style="display:inline-block;border:1.5px solid #000;padding:5px 8px;background:#fff;">${spcDistBlockHTML(d, Math.max(fs,6))}</div>`;
      break;
  }

  spcDownloadHTML(spcBuildExportHTML(title, bodyHTML, wRaw, hRaw, unit), filename);
  if (typeof toast === 'function') toast('Exported', filename);
  if (typeof trackExport === 'function') trackExport('small-pack-' + type, d.name);
}

function spcExportFullPack() {
  const d = spcGetData();
  if (!d) { if (typeof toast === 'function') toast('No Project', 'Open a label first.'); return; }

  const unit   = document.getElementById('spc-unit')?.value || 'in';
  const wRaw   = parseFloat(document.getElementById('spc-w')?.value) || 3;
  const hRaw   = parseFloat(document.getElementById('spc-h')?.value) || 4;
  const fs     = Math.max(parseFloat(document.getElementById('spc-min-font')?.value) || 6, 6);
  const format = document.getElementById('spc-format')?.value || 'vertical';
  const name   = (d.name || 'label').toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const delay  = 500;

  // 1: Nutrition panel
  spcExportPanel('nutrition');

  // 2: Ingredients
  setTimeout(() => spcExportPanel('ingredients'), delay);

  // 3: Barcode
  setTimeout(() => spcExportPanel('barcode'), delay * 2);

  // 4: Distributor
  setTimeout(() => spcExportPanel('distributor'), delay * 3);

  // 5: Combined preview
  setTimeout(() => {
    let combinedHTML;
    switch (format) {
      case 'tabular': combinedHTML = spcRenderTabular(d, wRaw, hRaw, unit, fs); break;
      case 'linear':  combinedHTML = spcRenderLinear(d, wRaw, hRaw, unit, fs);  break;
      case 'split':   combinedHTML = spcRenderSplit(d, wRaw, hRaw, unit, fs);   break;
      default:        combinedHTML = spcRenderVertical(d, wRaw, hRaw, unit, fs); break;
    }
    const title    = `Small Pack Preview — ${d.name}`;
    const filename = `nf_${name}_small_pack_preview.html`;
    spcDownloadHTML(spcBuildExportHTML(title, `
      <div style="padding:12px;">
        <div style="font-size:10px;color:#888;margin-bottom:12px;font-family:Arial;">
          <strong>${d.name}</strong> · Format: ${format.toUpperCase()} · ${wRaw}${unit} × ${hRaw}${unit} · Min font: ${fs}pt<br>
          Generated ${new Date().toLocaleString()} · Hidden Supply Nutrition Facts Studio
        </div>
        ${combinedHTML}
      </div>`, wRaw * 1.1, hRaw * 1.1, unit), filename);

    if (typeof toast === 'function') toast('Export Pack Complete', '5 files downloaded.');
    if (typeof trackExport === 'function') trackExport('small-pack-full', d.name);
  }, delay * 4);
}
