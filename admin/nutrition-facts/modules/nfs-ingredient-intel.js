/**
 * nfs-ingredient-intel.js — NFS v5.5 Ingredient Intelligence Module
 * Exposes: window.NFSIngredientIntel
 *
 * Owns ingredient normalization, MFG → U.S. label translation,
 * and structured output for downstream rendering.
 *
 * No AI calls. Pure text processing + dictionary lookup.
 *
 * API:
 *   NFSIngredientIntel.init()                — boot
 *   NFSIngredientIntel.normalize(text)       — clean raw text
 *   NFSIngredientIntel.translateToUS(text)   — apply MFG→US dictionary
 *   NFSIngredientIntel.getMappings(text)     — return full structured result
 */

(function () {
  'use strict';

  // ── MFG → U.S. Translation Dictionary ──────────────────────────────────────
  // Keys: common manufacturer / import terms (case-insensitive match).
  // Values: FDA-preferred U.S. equivalent.
  //
  // Extend this table — do NOT inline ad-hoc replacements elsewhere.
  const TRANSLATION_MAP = [
    // Sugars / Sweeteners
    { mfg: 'glucose syrup',           us: 'corn syrup' },
    { mfg: 'glucose-fructose syrup',  us: 'high fructose corn syrup' },
    { mfg: 'invert sugar syrup',      us: 'invert sugar' },
    { mfg: 'cane sugar',              us: 'sugar' },
    { mfg: 'beet sugar',              us: 'sugar' },
    { mfg: 'dextrose monohydrate',    us: 'dextrose' },
    { mfg: 'isomalt',                 us: 'isomalt' }, // same — included for completeness

    // Fats / Oils
    { mfg: 'palm fat',                us: 'palm oil' },
    { mfg: 'vegetable fat',           us: 'vegetable oil' },
    { mfg: 'hydrogenated vegetable fat', us: 'hydrogenated vegetable oil' },
    { mfg: 'cocoa butter substitute', us: 'cocoa butter equivalent (CBE)' },

    // Starches / Thickeners
    { mfg: 'modified starch',         us: 'modified food starch' },
    { mfg: 'corn starch',             us: 'cornstarch' },
    { mfg: 'maize starch',            us: 'cornstarch' },
    { mfg: 'tapioca starch',          us: 'tapioca starch' }, // same
    { mfg: 'pectin (e440)',           us: 'pectin' },
    { mfg: 'e440',                    us: 'pectin' },

    // Colorants — E-numbers to FDA names
    { mfg: 'e102',  us: 'FD&C Yellow No. 5 (Tartrazine)' },
    { mfg: 'e110',  us: 'FD&C Yellow No. 6' },
    { mfg: 'e120',  us: 'carmine' },
    { mfg: 'e122',  us: 'carmoisine (not FDA approved — FLAG)' },
    { mfg: 'e124',  us: 'ponceau 4R (not FDA approved — FLAG)' },
    { mfg: 'e127',  us: 'FD&C Red No. 3' },
    { mfg: 'e129',  us: 'FD&C Red No. 40' },
    { mfg: 'e131',  us: 'FD&C Blue No. 1' },
    { mfg: 'e132',  us: 'FD&C Blue No. 2' },
    { mfg: 'e133',  us: 'FD&C Blue No. 1' },
    { mfg: 'e141',  us: 'chlorophyllin (copper complex)' },
    { mfg: 'e150a', us: 'caramel color' },
    { mfg: 'e160a', us: 'beta-carotene' },
    { mfg: 'e160c', us: 'paprika extract' },
    { mfg: 'e161b', us: 'lutein' },
    { mfg: 'e162',  us: 'beet juice (color)' },
    { mfg: 'e163',  us: 'anthocyanins' },
    { mfg: 'e171',  us: 'titanium dioxide (FLAG — FDA banned 2024)' },
    { mfg: 'e172',  us: 'iron oxide' },

    // Preservatives / Acids
    { mfg: 'e202',  us: 'potassium sorbate' },
    { mfg: 'e211',  us: 'sodium benzoate' },
    { mfg: 'e220',  us: 'sulfur dioxide' },
    { mfg: 'e330',  us: 'citric acid' },
    { mfg: 'e331',  us: 'sodium citrate' },
    { mfg: 'e334',  us: 'tartaric acid' },
    { mfg: 'e338',  us: 'phosphoric acid' },

    // Emulsifiers
    { mfg: 'e322',  us: 'lecithin' },
    { mfg: 'e471',  us: 'mono and diglycerides' },
    { mfg: 'e472e', us: 'DATEM' },

    // Flavour → Flavor spelling
    { mfg: 'natural flavour',         us: 'natural flavor' },
    { mfg: 'artificial flavour',      us: 'artificial flavor' },
    { mfg: 'natural flavours',        us: 'natural flavors' },
    { mfg: 'artificial flavours',     us: 'artificial flavors' },

    // Units / formatting
    { mfg: 'colour',    us: 'color' },
    { mfg: 'colours',   us: 'colors' },
  ];

  // ── Structured output builder ───────────────────────────────────────────────
  /**
   * @typedef {Object} IngredientResult
   * @property {string}   raw       - original input, untouched
   * @property {string}   cleaned   - whitespace/encoding normalized
   * @property {string}   usDraft   - translated US-label version
   * @property {Array}    mappings  - [{mfg, us, found}] — what was found + replaced
   * @property {Array}    warnings  - flagged ingredients needing human review
   */

  // ── Internal helpers ────────────────────────────────────────────────────────

  function _normalize(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .trim();
  }

  function _translate(text) {
    let result = text;
    const mappings = [];
    const warnings = [];

    TRANSLATION_MAP.forEach(({ mfg, us }) => {
      const regex = new RegExp('\\b' + mfg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      if (regex.test(result)) {
        result = result.replace(regex, us);
        mappings.push({ mfg, us, found: true });
        if (us.includes('FLAG')) warnings.push(`Review required: "${us}" — ${mfg}`);
      }
    });

    return { translated: result, mappings, warnings };
  }

  // ── State ───────────────────────────────────────────────────────────────────
  let _initialized = false;

  // ── Public API ──────────────────────────────────────────────────────────────

  function init() {
    if (_initialized) return;
    _initialized = true;
    console.log('[NFSIngredientIntel] init — translation map entries:', TRANSLATION_MAP.length);
  }

  /**
   * normalize(text) → string
   * Cleans whitespace, encoding, and punctuation. No translation.
   */
  function normalize(text) {
    return _normalize(text);
  }

  /**
   * translateToUS(text) → string
   * Returns translated text only (no metadata).
   */
  function translateToUS(text) {
    const cleaned = _normalize(text);
    return _translate(cleaned).translated;
  }

  /**
   * getMappings(rawText) → IngredientResult
   * Returns full structured result with raw, cleaned, usDraft, mappings, warnings.
   */
  function getMappings(rawText) {
    const raw = rawText || '';
    const cleaned = _normalize(raw);
    const { translated, mappings, warnings } = _translate(cleaned);
    return { raw, cleaned, usDraft: translated, mappings, warnings };
  }

  /**
   * getTranslationMap() → Array
   * Exposes the dictionary for inspection / UI rendering.
   */
  function getTranslationMap() {
    return TRANSLATION_MAP.slice(); // return copy
  }

  // ── Expose global ───────────────────────────────────────────────────────────
  window.NFSIngredientIntel = { init, normalize, translateToUS, getMappings, getTranslationMap };

})();
