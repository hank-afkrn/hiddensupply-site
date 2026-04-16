/**
 * nfs-ingredient-intel.js — NFS v5.5 Ingredient Intelligence Module
 * Exposes: window.NFSIngredientIntel
 *
 * Behaves as a U.S. ingredient declaration engine, not a text cleaner.
 * Pipeline: extract tokens → strip percentages → flatten groups →
 *           map to US names → flag review items → dedupe → title-case → assemble.
 *
 * No AI calls. Pure text processing + dictionary lookup.
 *
 * API:
 *   NFSIngredientIntel.init()
 *   NFSIngredientIntel.normalize(text)       — lightweight whitespace clean only
 *   NFSIngredientIntel.translateToUS(text)   — returns usDraft string only
 *   NFSIngredientIntel.getMappings(text)     — returns full IngredientResult
 *   NFSIngredientIntel.getTranslationMap()   — returns dictionary copy
 */

(function () {
  'use strict';

  // ── Translation dictionary ──────────────────────────────────────────────────
  // Each entry: { mfg, us, flag? }
  //   mfg   — source term (matched case-insensitively, full token or phrase)
  //   us    — U.S. label equivalent
  //   flag  — if true: include in warnings AND keep mapped name (not silently drop)
  //   review — if true: flag for human review, keep as-is in output
  //
  // SORT ORDER: longer phrases first so they match before substrings.
  const DICT = [
    // ── Sugars ────────────────────────────────────────────────────────────────
    { mfg: 'white granulated sugar',      us: 'Sugar' },
    { mfg: 'white sugar',                 us: 'Sugar' },
    { mfg: 'cane sugar',                  us: 'Sugar' },
    { mfg: 'beet sugar',                  us: 'Sugar' },
    { mfg: 'granulated sugar',            us: 'Sugar' },
    { mfg: 'glucose-fructose syrup',      us: 'High Fructose Corn Syrup' },
    { mfg: 'glucose syrup',               us: 'Glucose Syrup' },   // kept as-is; corn syrup only if from corn
    { mfg: 'invert sugar syrup',          us: 'Invert Sugar' },
    { mfg: 'dextrose monohydrate',        us: 'Dextrose' },

    // ── Waxes ─────────────────────────────────────────────────────────────────
    { mfg: 'food-grade microcrystalline wax', us: 'Microcrystalline Wax' },
    { mfg: 'food grade microcrystalline wax', us: 'Microcrystalline Wax' },
    { mfg: 'microcrystalline wax',            us: 'Microcrystalline Wax' },
    { mfg: 'carnauba wax',                    us: 'Carnauba Wax' },
    { mfg: 'beeswax',                         us: 'Beeswax' },

    // ── Acids ─────────────────────────────────────────────────────────────────
    { mfg: 'dl-malic acid',               us: 'Malic Acid' },
    { mfg: 'dl malic acid',               us: 'Malic Acid' },
    { mfg: 'l-malic acid',                us: 'Malic Acid' },
    { mfg: 'malic acid',                  us: 'Malic Acid' },
    { mfg: 'citric acid',                 us: 'Citric Acid' },
    { mfg: 'tartaric acid',               us: 'Tartaric Acid' },
    { mfg: 'fumaric acid',                us: 'Fumaric Acid' },
    { mfg: 'lactic acid',                 us: 'Lactic Acid' },
    { mfg: 'acetic acid',                 us: 'Acetic Acid' },
    { mfg: 'phosphoric acid',             us: 'Phosphoric Acid' },
    { mfg: 'e330',                        us: 'Citric Acid' },
    { mfg: 'e296',                        us: 'Malic Acid' },
    { mfg: 'e334',                        us: 'Tartaric Acid' },
    { mfg: 'e338',                        us: 'Phosphoric Acid' },

    // ── Salts / Regulators ────────────────────────────────────────────────────
    { mfg: 'sodium citrate',              us: 'Sodium Citrate' },
    { mfg: 'potassium citrate',           us: 'Potassium Citrate' },
    { mfg: 'sodium benzoate',             us: 'Sodium Benzoate' },
    { mfg: 'potassium sorbate',           us: 'Potassium Sorbate' },
    { mfg: 'e202',                        us: 'Potassium Sorbate' },
    { mfg: 'e211',                        us: 'Sodium Benzoate' },
    { mfg: 'e220',                        us: 'Sulfur Dioxide' },
    { mfg: 'e331',                        us: 'Sodium Citrate' },

    // ── Thickeners / Stabilisers ──────────────────────────────────────────────
    { mfg: 'pectin (e440)',               us: 'Pectin' },
    { mfg: 'e440',                        us: 'Pectin' },
    { mfg: 'pectin',                      us: 'Pectin' },
    { mfg: 'carrageenan',                 us: 'Carrageenan' },
    { mfg: 'modified starch',             us: 'Modified Food Starch' },
    { mfg: 'maize starch',                us: 'Cornstarch' },
    { mfg: 'corn starch',                 us: 'Cornstarch' },
    { mfg: 'tapioca starch',              us: 'Tapioca Starch' },
    { mfg: 'gelatin',                     us: 'Gelatin' },
    { mfg: 'gelatine',                    us: 'Gelatin' },
    { mfg: 'agar',                        us: 'Agar' },
    { mfg: 'guar gum',                    us: 'Guar Gum' },
    { mfg: 'xanthan gum',                 us: 'Xanthan Gum' },
    { mfg: 'locust bean gum',             us: 'Locust Bean Gum' },
    { mfg: 'carob bean gum',              us: 'Locust Bean Gum' },
    { mfg: 'long-starch gum',             us: null, review: true,
      reviewNote: 'Ambiguous: "long-starch gum" has no FDA standard name — verify with supplier' },

    // ── Fats / Oils ───────────────────────────────────────────────────────────
    { mfg: 'palm fat',                    us: 'Palm Oil' },
    { mfg: 'vegetable fat',               us: 'Vegetable Oil' },
    { mfg: 'hydrogenated vegetable fat',  us: 'Hydrogenated Vegetable Oil' },
    { mfg: 'cocoa butter substitute',     us: 'Cocoa Butter Equivalent (CBE)' },

    // ── Flavors ───────────────────────────────────────────────────────────────
    { mfg: 'edible flavoring',            us: 'Artificial Flavors' },
    { mfg: 'edible flavours',             us: 'Artificial Flavors' },
    { mfg: 'food flavoring',              us: 'Artificial Flavors' },
    { mfg: 'artificial flavouring',       us: 'Artificial Flavors' },
    { mfg: 'artificial flavoring',        us: 'Artificial Flavors' },
    { mfg: 'artificial flavour',          us: 'Artificial Flavors' },
    { mfg: 'artificial flavor',           us: 'Artificial Flavors' },
    { mfg: 'natural flavouring',          us: 'Natural Flavors' },
    { mfg: 'natural flavoring',           us: 'Natural Flavors' },
    { mfg: 'natural flavour',             us: 'Natural Flavors' },
    { mfg: 'natural flavor',              us: 'Natural Flavors' },
    { mfg: 'flavouring',                  us: 'Artificial Flavors' },
    { mfg: 'flavoring',                   us: 'Artificial Flavors' },
    { mfg: 'flavour',                     us: 'Artificial Flavors' },

    // ── Colorants — descriptive / trade names ─────────────────────────────────
    { mfg: 'lemon yellow',                us: 'Yellow 5' },
    { mfg: 'tartrazine',                  us: 'Yellow 5' },
    { mfg: 'sunset yellow',               us: 'Yellow 6' },
    { mfg: 'tinted red',                  us: 'Red 40' },
    { mfg: 'allura red',                  us: 'Red 40' },
    { mfg: 'bright blue',                 us: 'Blue 1' },
    { mfg: 'brilliant blue',              us: 'Blue 1' },
    { mfg: 'fast green',                  us: 'Green 3' },
    { mfg: 'erythrosine',                 us: 'Red 3' },
    // Carmine: must flag — do NOT silently map to Red 40
    { mfg: 'carmine',                     us: 'Carmine', flag: true,
      flagNote: 'Carmine is an animal-derived colorant (cochineal). Verify with supplier and check allergen/vegan requirements before use.' },
    { mfg: 'cochineal',                   us: 'Carmine', flag: true,
      flagNote: 'Cochineal extract = Carmine. Animal-derived. Verify supplier and check allergen requirements.' },
    { mfg: 'annatto',                     us: 'Annatto Extract (Color)' },
    { mfg: 'caramel coloring',            us: 'Caramel Color' },
    { mfg: 'caramel colouring',           us: 'Caramel Color' },
    { mfg: 'caramel colour',              us: 'Caramel Color' },
    { mfg: 'caramel color',               us: 'Caramel Color' },

    // ── Colorants — E-numbers ─────────────────────────────────────────────────
    { mfg: 'e102',                        us: 'Yellow 5' },
    { mfg: 'e110',                        us: 'Yellow 6' },
    { mfg: 'e120',                        us: 'Carmine', flag: true,
      flagNote: 'E120 = Carmine (cochineal). Animal-derived. Verify before use.' },
    { mfg: 'e122',                        us: null, flag: true,
      flagNote: 'E122 (Carmoisine/Azorubine) is NOT FDA approved for use in the U.S. — remove or substitute.' },
    { mfg: 'e124',                        us: null, flag: true,
      flagNote: 'E124 (Ponceau 4R) is NOT FDA approved for use in the U.S. — remove or substitute.' },
    { mfg: 'e127',                        us: 'Red 3' },
    { mfg: 'e129',                        us: 'Red 40' },
    { mfg: 'e131',                        us: 'Blue 1' },
    { mfg: 'e132',                        us: 'Blue 2' },
    { mfg: 'e133',                        us: 'Blue 1' },
    { mfg: 'e141',                        us: 'Chlorophyllin (Copper Complex)' },
    { mfg: 'e150a',                       us: 'Caramel Color' },
    { mfg: 'e160a',                       us: 'Beta-Carotene' },
    { mfg: 'e160c',                       us: 'Paprika Extract' },
    { mfg: 'e161b',                       us: 'Lutein' },
    { mfg: 'e162',                        us: 'Beet Juice (Color)' },
    { mfg: 'e163',                        us: 'Anthocyanins' },
    { mfg: 'e171',                        us: null, flag: true,
      flagNote: 'E171 (Titanium Dioxide) is banned by FDA (2024) — remove from formulation.' },
    { mfg: 'e172',                        us: 'Iron Oxides and Hydroxides' },

    // ── Emulsifiers ───────────────────────────────────────────────────────────
    { mfg: 'soy lecithin',                us: 'Soy Lecithin' },
    { mfg: 'sunflower lecithin',          us: 'Sunflower Lecithin' },
    { mfg: 'lecithin',                    us: 'Lecithin' },
    { mfg: 'e322',                        us: 'Lecithin' },
    { mfg: 'e471',                        us: 'Mono and Diglycerides' },
    { mfg: 'e472e',                       us: 'DATEM' },

    // ── Juice / Fruit ─────────────────────────────────────────────────────────
    { mfg: 'concentrated apple juice',    us: 'Concentrated Apple Juice' },
    { mfg: 'apple juice concentrate',     us: 'Concentrated Apple Juice' },

    // ── Misc ──────────────────────────────────────────────────────────────────
    { mfg: 'water',                       us: 'Water' },
    { mfg: 'salt',                        us: 'Salt' },
    { mfg: 'colour',                      us: 'Color' },
    { mfg: 'colours',                     us: 'Colors' },
  ];

  // ── Pipeline ────────────────────────────────────────────────────────────────

  /**
   * Step 1: Pre-clean — strip encoding artifacts, normalize whitespace.
   */
  function _preclean(text) {
    return (text || '')
      .replace(/\r\n|\r/g, '\n')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/≥|≤|>/g, '')      // strip comparison operators (e.g. "≥ 5%")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Step 2: Extract all ingredient tokens from raw text.
   *
   * Handles:
   *  - Multiple "Ingredients:" blocks → merged
   *  - Bracketed additive groups [a, b, c] → flattened inline
   *  - Parenthetical sub-lists (a, b) → flattened inline
   *  - Percentage stripping: "55% glucose syrup" → "glucose syrup"
   *  - Separator variants: comma, semicolon, slash, newline
   */
  // Structural label phrases that appear before ingredient lists — not ingredients themselves.
  // Stripped before tokenization.
  const STRUCTURAL_LABELS = [
    /food\s+additives?\s*[:\-]?/gi,
    /food\s+colou?ring\s*[:\-]?/gi,
    /contains\s*[:\-]?/gi,
    /ingredients?\s*[:\-]?/gi,
    /made\s+with\s*[:\-]?/gi,
  ];

  function _extractTokens(text) {
    let working = text;

    // Strip structural labels (must be done BEFORE bracket flatten so "Food additives [...]" works)
    STRUCTURAL_LABELS.forEach(re => { working = working.replace(re, ' '); });

    // Flatten bracketed additive groups: [a, b, c] → , a, b, c
    // Also handle unclosed brackets where ] appears alone
    working = working.replace(/\[([^\]]*)\]/g, (_, inner) => ', ' + inner + ',');
    working = working.replace(/\[([^\]]*)/g,   (_, inner) => ', ' + inner);   // unclosed [
    working = working.replace(/\]/g, ',');                                      // orphaned ]

    // Flatten parenthetical sub-lists that contain commas (ingredient sub-groups)
    working = working.replace(/\(([^)]+,[^)]+)\)/g, (_, inner) => ', ' + inner);

    // Strip percentage values: "55% ", "0.41% ", "≥ 5% "
    working = working.replace(/\d+\.?\d*\s*%\s*/g, '');

    // Strip dangling qualifiers left after percent removal
    working = working.replace(/\bwith\s+added\b/gi, '');
    working = working.replace(/\badded\b/gi, '');

    // Normalize separators to comma
    working = working.replace(/[;\/]/g, ',');
    working = working.replace(/\.\s*(?=[A-Za-z])/g, ', '); // period before letter = separator

    // Collapse multiple commas / spaces
    working = working.replace(/,\s*,+/g, ',');
    working = working.replace(/\s{2,}/g, ' ');

    // Split into tokens
    const tokens = working
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 1);  // drop single chars / noise

    return tokens;
  }

  /**
   * Step 3: Map a single token through the dictionary.
   * Returns { original, resolved, usName, flag, flagNote, review, reviewNote, mapped }
   */
  function _mapToken(token) {
    const lower = token.toLowerCase().trim();

    // Try longest match first (DICT is sorted longest-first within categories)
    for (const entry of DICT) {
      const mfgLower = entry.mfg.toLowerCase();
      // Full string match OR token contains this phrase as a standalone chunk
      if (lower === mfgLower || lower.includes(mfgLower)) {
        return {
          original:   token,
          resolved:   entry.us || _titleCase(token),  // if us===null, title-case original
          usName:     entry.us,
          flag:       !!entry.flag,
          flagNote:   entry.flagNote || null,
          review:     !!entry.review,
          reviewNote: entry.reviewNote || null,
          mapped:     true,
          dictEntry:  entry.mfg,
        };
      }
    }

    // No match — title-case it and pass through
    return {
      original:  token,
      resolved:  _titleCase(token),
      usName:    null,
      flag:      false,
      review:    false,
      mapped:    false,
      dictEntry: null,
    };
  }

  /**
   * Step 4: Title-case a string (each word capitalised).
   */
  function _titleCase(str) {
    return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  /**
   * Step 5: Deduplicate resolved names, case-insensitively.
   * Keeps first occurrence. Flags are preserved.
   */
  function _dedupe(mappedTokens) {
    const seen = new Set();
    return mappedTokens.filter(t => {
      const key = (t.resolved || t.original).toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ── State ───────────────────────────────────────────────────────────────────
  let _initialized = false;

  // ── Public API ──────────────────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;
    console.log('[NFSIngredientIntel] init — dictionary entries:', DICT.length);
  }

  /**
   * normalize(text) → string
   * Lightweight whitespace/encoding clean only. No translation.
   */
  function normalize(text) {
    return _preclean(text);
  }

  /**
   * getMappings(rawText) → IngredientResult
   *
   * Full pipeline: extract → map → dedupe → assemble.
   *
   * @returns {{
   *   raw:      string,   — original input untouched
   *   cleaned:  string,   — pre-cleaned (whitespace/encoding)
   *   usDraft:  string,   — final U.S. ingredient declaration line
   *   mappings: Array,    — [{original, resolved, dictEntry}] for each mapped token
   *   warnings: Array,    — [{text, note}] flagged items needing review
   *   tokens:   Array,    — all extracted + mapped token objects (debug)
   * }}
   */
  function getMappings(rawText) {
    const raw     = rawText || '';
    const cleaned = _preclean(raw);
    const tokens  = _extractTokens(cleaned);
    const mapped  = tokens.map(_mapToken);
    const deduped = _dedupe(mapped);

    const mappings  = [];
    const warnings  = [];
    const finalParts = [];

    deduped.forEach(t => {
      // Collect warnings (flags + reviews)
      if (t.flag) {
        warnings.push({
          text:  `⚠ ${t.original} → ${t.resolved}`,
          note:  t.flagNote || `"${t.original}" requires review before U.S. label use.`,
          type:  'flag',
        });
      }
      if (t.review) {
        warnings.push({
          text:  `⚠ Ambiguous: "${t.original}"`,
          note:  t.reviewNote || `"${t.original}" has no clear U.S. equivalent — verify with supplier.`,
          type:  'review',
        });
      }

      // Collect mappings (only where we actually changed something)
      if (t.mapped && t.dictEntry && t.usName && t.usName.toLowerCase() !== t.original.toLowerCase()) {
        mappings.push({ original: t.original, resolved: t.resolved, dictEntry: t.dictEntry });
      }

      // Add to final output:
      //   - if us===null (banned/unapproved): include flagged name in output with marker
      //   - if review: include original with [VERIFY] marker
      //   - otherwise: use resolved name
      if (t.usName === null && (t.flag || t.review)) {
        // Null us with flag = banned ingredient — show as [VERIFY: original]
        finalParts.push(`[VERIFY: ${_titleCase(t.original)}]`);
      } else {
        finalParts.push(t.resolved);
      }
    });

    const usDraft = finalParts.join(', ') + (finalParts.length ? '.' : '');

    return { raw, cleaned, usDraft, mappings, warnings, tokens: deduped };
  }

  /**
   * translateToUS(text) → string
   * Convenience: returns usDraft string only.
   */
  function translateToUS(text) {
    return getMappings(text).usDraft;
  }

  /**
   * getTranslationMap() → Array  (dictionary copy for inspection)
   */
  function getTranslationMap() {
    return DICT.slice();
  }

  // ── Expose global ───────────────────────────────────────────────────────────
  window.NFSIngredientIntel = { init, normalize, translateToUS, getMappings, getTranslationMap };

})();
