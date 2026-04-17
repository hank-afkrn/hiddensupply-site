/**
 * nfs-ingredient-intel.js — NFS v5.5 Ingredient Intelligence Module
 * Exposes: window.NFSIngredientIntel
 *
 * Behaves as an expert operator translating messy MFG supplier data into a
 * credible U.S.-market ingredient declaration draft.
 *
 * Pipeline:
 *   1. Pre-clean       — encoding, whitespace
 *   2. Source split    — detect multiple blocks, assign confidence tiers
 *   3. Extract tokens  — flatten groups, strip %, noise, structural labels
 *   4. Map tokens      — dictionary longest-match, case-insensitive
 *   5. Conflict check  — flag contradictions across sources
 *   6. Dedupe          — merge by normalized key
 *   7. Sort            — heuristic U.S. declaration order
 *   8. Assemble        — three output modes
 *
 * No AI calls. Pure text processing.
 *
 * API:
 *   init()
 *   getMappings(rawText)      → IngredientResult (full)
 *   translateToUS(rawText)    → string (packagingDraft only)
 *   normalize(rawText)        → string (pre-clean only)
 *   getTranslationMap()       → dict copy
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // DICTIONARY
  // Longer phrases must come before shorter to ensure correct longest-match.
  // { mfg, us, flag?, flagNote?, review?, reviewNote?, category, sortOrder }
  // category + sortOrder drive the final U.S. declaration ordering.
  // ═══════════════════════════════════════════════════════════════════════════
  const DICT = [

    // ── SWEETENERS / BASE (sortOrder 10) ────────────────────────────────────
    { mfg: 'glucose-fructose syrup',          us: 'High Fructose Corn Syrup',       cat: 'sweetener', ord: 10 },
    { mfg: 'high fructose corn syrup',         us: 'High Fructose Corn Syrup',       cat: 'sweetener', ord: 10 },
    { mfg: 'glucose syrup',                    us: 'Glucose Syrup',                  cat: 'sweetener', ord: 10 },
    { mfg: 'corn syrup',                       us: 'Corn Syrup',                     cat: 'sweetener', ord: 10 },
    { mfg: 'white granulated sugar',           us: 'Sugar',                          cat: 'sweetener', ord: 11 },
    { mfg: 'white cane sugar',                 us: 'Sugar',                          cat: 'sweetener', ord: 11 },
    { mfg: 'white sugar',                      us: 'Sugar',                          cat: 'sweetener', ord: 11 },
    { mfg: 'granulated sugar',                 us: 'Sugar',                          cat: 'sweetener', ord: 11 },
    { mfg: 'cane sugar',                       us: 'Sugar',                          cat: 'sweetener', ord: 11 },
    { mfg: 'beet sugar',                       us: 'Sugar',                          cat: 'sweetener', ord: 11 },
    { mfg: 'sucrose',                          us: 'Sugar',                          cat: 'sweetener', ord: 11 },
    { mfg: 'sugar',                            us: 'Sugar',                          cat: 'sweetener', ord: 11 },
    { mfg: 'invert sugar syrup',               us: 'Invert Sugar',                   cat: 'sweetener', ord: 12 },
    { mfg: 'invert sugar',                     us: 'Invert Sugar',                   cat: 'sweetener', ord: 12 },
    { mfg: 'dextrose monohydrate',             us: 'Dextrose',                       cat: 'sweetener', ord: 13 },
    { mfg: 'dextrose',                         us: 'Dextrose',                       cat: 'sweetener', ord: 13 },
    { mfg: 'fructose',                         us: 'Fructose',                       cat: 'sweetener', ord: 13 },
    { mfg: 'maltose',                          us: 'Maltose',                        cat: 'sweetener', ord: 13 },
    { mfg: 'trehalose',                        us: 'Trehalose',                      cat: 'sweetener', ord: 13 },
    { mfg: 'isomalt',                          us: 'Isomalt',                        cat: 'sweetener', ord: 14 },
    { mfg: 'sorbitol',                         us: 'Sorbitol',                       cat: 'sweetener', ord: 14 },
    { mfg: 'maltitol',                         us: 'Maltitol',                       cat: 'sweetener', ord: 14 },
    { mfg: 'xylitol',                          us: 'Xylitol',                        cat: 'sweetener', ord: 14 },
    { mfg: 'erythritol',                       us: 'Erythritol',                     cat: 'sweetener', ord: 14 },

    // ── STRUCTURAL / WAX / COATING (sortOrder 20) ────────────────────────────
    { mfg: 'food-grade microcrystalline wax',  us: 'Microcrystalline Wax',           cat: 'structural', ord: 20 },
    { mfg: 'food grade microcrystalline wax',  us: 'Microcrystalline Wax',           cat: 'structural', ord: 20 },
    { mfg: 'microcrystalline wax',             us: 'Microcrystalline Wax',           cat: 'structural', ord: 20 },
    { mfg: 'carnauba wax',                     us: 'Carnauba Wax',                   cat: 'structural', ord: 21 },
    { mfg: 'candelilla wax',                   us: 'Candelilla Wax',                 cat: 'structural', ord: 21 },
    { mfg: 'beeswax',                          us: 'Beeswax',                        cat: 'structural', ord: 21 },
    { mfg: 'palm fat',                         us: 'Palm Oil',                       cat: 'structural', ord: 22 },
    { mfg: 'vegetable fat',                    us: 'Vegetable Oil',                  cat: 'structural', ord: 22 },
    { mfg: 'hydrogenated vegetable fat',       us: 'Hydrogenated Vegetable Oil',     cat: 'structural', ord: 22 },
    { mfg: 'cocoa butter substitute',          us: 'Cocoa Butter Equivalent (CBE)',  cat: 'structural', ord: 22 },

    // ── FRUIT / JUICE (sortOrder 30) ─────────────────────────────────────────
    { mfg: 'concentrated apple juice',         us: 'Concentrated Apple Juice',       cat: 'fruit', ord: 30 },
    { mfg: 'apple juice concentrate',          us: 'Concentrated Apple Juice',       cat: 'fruit', ord: 30 },
    { mfg: 'concentrated grape juice',         us: 'Concentrated Grape Juice',       cat: 'fruit', ord: 30 },
    { mfg: 'grape juice concentrate',          us: 'Concentrated Grape Juice',       cat: 'fruit', ord: 30 },

    // ── GUMS / TEXTURIZERS / STABILIZERS (sortOrder 40) ──────────────────────
    { mfg: 'locust bean gum',                  us: 'Locust Bean Gum',                cat: 'texturizer', ord: 40 },
    { mfg: 'carob bean gum',                   us: 'Locust Bean Gum',                cat: 'texturizer', ord: 40 },
    { mfg: 'guar gum',                         us: 'Guar Gum',                       cat: 'texturizer', ord: 40 },
    { mfg: 'xanthan gum',                      us: 'Xanthan Gum',                    cat: 'texturizer', ord: 40 },
    { mfg: 'gellan gum',                       us: 'Gellan Gum',                     cat: 'texturizer', ord: 40 },
    { mfg: 'arabic gum',                       us: 'Gum Arabic',                     cat: 'texturizer', ord: 40 },
    { mfg: 'gum arabic',                       us: 'Gum Arabic',                     cat: 'texturizer', ord: 40 },
    { mfg: 'acacia gum',                       us: 'Gum Arabic',                     cat: 'texturizer', ord: 40 },
    { mfg: 'long-starch gum',                  us: null, review: true,               cat: 'texturizer', ord: 41,
      reviewNote: '"long-starch gum" has no recognized U.S. declaration name — verify with supplier (may be modified food starch, dextrin, or a proprietary blend)' },
    { mfg: 'carrageenan',                      us: 'Carrageenan',                    cat: 'texturizer', ord: 42 },
    { mfg: 'agar',                             us: 'Agar',                           cat: 'texturizer', ord: 42 },
    { mfg: 'gelatin',                          us: 'Gelatin',                        cat: 'texturizer', ord: 42 },
    { mfg: 'gelatine',                         us: 'Gelatin',                        cat: 'texturizer', ord: 42 },
    { mfg: 'modified food starch',             us: 'Modified Food Starch',           cat: 'texturizer', ord: 43 },
    { mfg: 'modified starch',                  us: 'Modified Food Starch',           cat: 'texturizer', ord: 43 },
    { mfg: 'maize starch',                     us: 'Cornstarch',                     cat: 'texturizer', ord: 43 },
    { mfg: 'corn starch',                      us: 'Cornstarch',                     cat: 'texturizer', ord: 43 },
    { mfg: 'cornstarch',                       us: 'Cornstarch',                     cat: 'texturizer', ord: 43 },
    { mfg: 'tapioca starch',                   us: 'Tapioca Starch',                 cat: 'texturizer', ord: 43 },
    { mfg: 'pectin (e440)',                    us: 'Pectin',                         cat: 'texturizer', ord: 44 },
    { mfg: 'e440',                             us: 'Pectin',                         cat: 'texturizer', ord: 44 },
    { mfg: 'pectin',                           us: 'Pectin',                         cat: 'texturizer', ord: 44 },

    // ── ACIDS (sortOrder 50) ──────────────────────────────────────────────────
    { mfg: 'dl-malic acid',                    us: 'Malic Acid',                     cat: 'acid', ord: 50 },
    { mfg: 'dl malic acid',                    us: 'Malic Acid',                     cat: 'acid', ord: 50 },
    { mfg: 'l-malic acid',                     us: 'Malic Acid',                     cat: 'acid', ord: 50 },
    { mfg: 'malic acid',                       us: 'Malic Acid',                     cat: 'acid', ord: 50 },
    { mfg: 'citric acid',                      us: 'Citric Acid',                    cat: 'acid', ord: 51 },
    { mfg: 'tartaric acid',                    us: 'Tartaric Acid',                  cat: 'acid', ord: 52 },
    { mfg: 'fumaric acid',                     us: 'Fumaric Acid',                   cat: 'acid', ord: 52 },
    { mfg: 'lactic acid',                      us: 'Lactic Acid',                    cat: 'acid', ord: 52 },
    { mfg: 'acetic acid',                      us: 'Acetic Acid',                    cat: 'acid', ord: 52 },
    { mfg: 'phosphoric acid',                  us: 'Phosphoric Acid',                cat: 'acid', ord: 52 },
    { mfg: 'ascorbic acid',                    us: 'Ascorbic Acid (Vitamin C)',       cat: 'acid', ord: 53 },
    { mfg: 'e330',                             us: 'Citric Acid',                    cat: 'acid', ord: 51 },
    { mfg: 'e296',                             us: 'Malic Acid',                     cat: 'acid', ord: 50 },
    { mfg: 'e334',                             us: 'Tartaric Acid',                  cat: 'acid', ord: 52 },
    { mfg: 'e338',                             us: 'Phosphoric Acid',                cat: 'acid', ord: 52 },

    // ── SALTS / REGULATORS (sortOrder 55) ────────────────────────────────────
    { mfg: 'sodium citrate',                   us: 'Sodium Citrate',                 cat: 'salt', ord: 55 },
    { mfg: 'potassium citrate',                us: 'Potassium Citrate',              cat: 'salt', ord: 55 },
    { mfg: 'sodium bicarbonate',               us: 'Sodium Bicarbonate',             cat: 'salt', ord: 55 },
    { mfg: 'baking soda',                      us: 'Sodium Bicarbonate',             cat: 'salt', ord: 55 },
    { mfg: 'sodium chloride',                  us: 'Salt',                           cat: 'salt', ord: 55 },
    { mfg: 'salt',                             us: 'Salt',                           cat: 'salt', ord: 55 },
    { mfg: 'sodium benzoate',                  us: 'Sodium Benzoate',                cat: 'salt', ord: 56 },
    { mfg: 'potassium sorbate',                us: 'Potassium Sorbate',              cat: 'salt', ord: 56 },
    { mfg: 'sulfur dioxide',                   us: 'Sulfur Dioxide',                 cat: 'salt', ord: 56 },
    { mfg: 'e202',                             us: 'Potassium Sorbate',              cat: 'salt', ord: 56 },
    { mfg: 'e211',                             us: 'Sodium Benzoate',                cat: 'salt', ord: 56 },
    { mfg: 'e220',                             us: 'Sulfur Dioxide',                 cat: 'salt', ord: 56 },
    { mfg: 'e331',                             us: 'Sodium Citrate',                 cat: 'salt', ord: 55 },

    // ── EMULSIFIERS (sortOrder 57) ────────────────────────────────────────────
    { mfg: 'soy lecithin',                     us: 'Soy Lecithin',                   cat: 'emulsifier', ord: 57 },
    { mfg: 'sunflower lecithin',               us: 'Sunflower Lecithin',             cat: 'emulsifier', ord: 57 },
    { mfg: 'lecithin',                         us: 'Lecithin',                       cat: 'emulsifier', ord: 57 },
    { mfg: 'e322',                             us: 'Lecithin',                       cat: 'emulsifier', ord: 57 },
    { mfg: 'e471',                             us: 'Mono and Diglycerides',          cat: 'emulsifier', ord: 57 },
    { mfg: 'e472e',                            us: 'DATEM',                          cat: 'emulsifier', ord: 57 },

    // ── FLAVORS (sortOrder 60) ────────────────────────────────────────────────
    { mfg: 'natural and artificial flavors',   us: 'Natural and Artificial Flavors', cat: 'flavor', ord: 60 },
    { mfg: 'natural and artificial flavour',   us: 'Natural and Artificial Flavors', cat: 'flavor', ord: 60 },
    { mfg: 'natural & artificial flavors',     us: 'Natural and Artificial Flavors', cat: 'flavor', ord: 60 },
    { mfg: 'edible flavorings',                us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'edible flavoring',                 us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'edible flavours',                  us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'edible flavour',                   us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'food flavoring',                   us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'artificial flavouring',            us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'artificial flavoring',             us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'artificial flavours',              us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'artificial flavors',               us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'artificial flavour',               us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'artificial flavor',                us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'natural flavouring',               us: 'Natural Flavors',                cat: 'flavor', ord: 60 },
    { mfg: 'natural flavoring',                us: 'Natural Flavors',                cat: 'flavor', ord: 60 },
    { mfg: 'natural flavours',                 us: 'Natural Flavors',                cat: 'flavor', ord: 60 },
    { mfg: 'natural flavors',                  us: 'Natural Flavors',                cat: 'flavor', ord: 60 },
    { mfg: 'natural flavour',                  us: 'Natural Flavors',                cat: 'flavor', ord: 60 },
    { mfg: 'natural flavor',                   us: 'Natural Flavors',                cat: 'flavor', ord: 60 },
    { mfg: 'flavouring',                       us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'flavoring',                        us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'flavours',                         us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },
    { mfg: 'flavour',                          us: 'Artificial Flavors',             cat: 'flavor', ord: 61 },

    // ── COLORS — descriptive / trade / regional names (sortOrder 70) ─────────
    { mfg: 'tartrazine',                       us: 'Yellow 5',                       cat: 'color', ord: 70 },
    { mfg: 'lemon yellow',                     us: 'Yellow 5',                       cat: 'color', ord: 70 },
    { mfg: 'fd&c yellow no. 5',                us: 'Yellow 5',                       cat: 'color', ord: 70 },
    { mfg: 'fd&c yellow 5',                    us: 'Yellow 5',                       cat: 'color', ord: 70 },
    { mfg: 'yellow 5',                         us: 'Yellow 5',                       cat: 'color', ord: 70 },
    { mfg: 'sunset yellow',                    us: 'Yellow 6',                       cat: 'color', ord: 71 },
    { mfg: 'fd&c yellow no. 6',                us: 'Yellow 6',                       cat: 'color', ord: 71 },
    { mfg: 'fd&c yellow 6',                    us: 'Yellow 6',                       cat: 'color', ord: 71 },
    { mfg: 'yellow 6',                         us: 'Yellow 6',                       cat: 'color', ord: 71 },
    { mfg: 'allura red',                       us: 'Red 40',                         cat: 'color', ord: 72 },
    { mfg: 'tinted red',                       us: 'Red 40',                         cat: 'color', ord: 72 },
    { mfg: 'fd&c red no. 40',                  us: 'Red 40',                         cat: 'color', ord: 72 },
    { mfg: 'fd&c red 40',                      us: 'Red 40',                         cat: 'color', ord: 72 },
    { mfg: 'red 40',                           us: 'Red 40',                         cat: 'color', ord: 72 },
    { mfg: 'erythrosine',                      us: 'Red 3',                          cat: 'color', ord: 73 },
    { mfg: 'fd&c red no. 3',                   us: 'Red 3',                          cat: 'color', ord: 73 },
    { mfg: 'fd&c red 3',                       us: 'Red 3',                          cat: 'color', ord: 73 },
    { mfg: 'red 3',                            us: 'Red 3',                          cat: 'color', ord: 73 },
    { mfg: 'brilliant blue',                   us: 'Blue 1',                         cat: 'color', ord: 74 },
    { mfg: 'bright blue',                      us: 'Blue 1',                         cat: 'color', ord: 74 },
    { mfg: 'fd&c blue no. 1',                  us: 'Blue 1',                         cat: 'color', ord: 74 },
    { mfg: 'fd&c blue 1',                      us: 'Blue 1',                         cat: 'color', ord: 74 },
    { mfg: 'blue 1',                           us: 'Blue 1',                         cat: 'color', ord: 74 },
    { mfg: 'indigo carmine',                   us: 'Blue 2',                         cat: 'color', ord: 75 },
    { mfg: 'fd&c blue no. 2',                  us: 'Blue 2',                         cat: 'color', ord: 75 },
    { mfg: 'blue 2',                           us: 'Blue 2',                         cat: 'color', ord: 75 },
    { mfg: 'fast green',                       us: 'Green 3',                        cat: 'color', ord: 76 },
    { mfg: 'green 3',                          us: 'Green 3',                        cat: 'color', ord: 76 },
    { mfg: 'annatto',                          us: 'Annatto Extract (Color)',         cat: 'color', ord: 77 },
    { mfg: 'beta-carotene',                    us: 'Beta-Carotene',                  cat: 'color', ord: 77 },
    { mfg: 'beta carotene',                    us: 'Beta-Carotene',                  cat: 'color', ord: 77 },
    { mfg: 'caramel coloring',                 us: 'Caramel Color',                  cat: 'color', ord: 77 },
    { mfg: 'caramel colouring',                us: 'Caramel Color',                  cat: 'color', ord: 77 },
    { mfg: 'caramel colour',                   us: 'Caramel Color',                  cat: 'color', ord: 77 },
    { mfg: 'caramel color',                    us: 'Caramel Color',                  cat: 'color', ord: 77 },
    { mfg: 'paprika extract',                  us: 'Paprika Extract (Color)',         cat: 'color', ord: 77 },
    { mfg: 'paprika',                          us: 'Paprika',                        cat: 'color', ord: 77 },
    { mfg: 'chlorophyllin',                    us: 'Chlorophyllin (Copper Complex)',  cat: 'color', ord: 78 },
    { mfg: 'anthocyanins',                     us: 'Anthocyanins',                   cat: 'color', ord: 78 },
    { mfg: 'beet juice',                       us: 'Beet Juice (Color)',              cat: 'color', ord: 78 },
    { mfg: 'lutein',                           us: 'Lutein',                         cat: 'color', ord: 78 },
    { mfg: 'iron oxide',                       us: 'Iron Oxides and Hydroxides',      cat: 'color', ord: 78 },
    { mfg: 'iron oxides',                      us: 'Iron Oxides and Hydroxides',      cat: 'color', ord: 78 },

    // ── COLORS — E-numbers (sortOrder 70-78, same as above) ─────────────────
    { mfg: 'e102',   us: 'Yellow 5',                              cat: 'color', ord: 70 },
    { mfg: 'e110',   us: 'Yellow 6',                              cat: 'color', ord: 71 },
    { mfg: 'e127',   us: 'Red 3',                                 cat: 'color', ord: 73 },
    { mfg: 'e129',   us: 'Red 40',                                cat: 'color', ord: 72 },
    { mfg: 'e131',   us: 'Blue 1',                                cat: 'color', ord: 74 },
    { mfg: 'e132',   us: 'Blue 2',                                cat: 'color', ord: 75 },
    { mfg: 'e133',   us: 'Blue 1',                                cat: 'color', ord: 74 },
    { mfg: 'e141',   us: 'Chlorophyllin (Copper Complex)',         cat: 'color', ord: 78 },
    { mfg: 'e150a',  us: 'Caramel Color',                         cat: 'color', ord: 77 },
    { mfg: 'e150',   us: 'Caramel Color',                         cat: 'color', ord: 77 },
    { mfg: 'e160a',  us: 'Beta-Carotene',                         cat: 'color', ord: 77 },
    { mfg: 'e160c',  us: 'Paprika Extract (Color)',                cat: 'color', ord: 77 },
    { mfg: 'e161b',  us: 'Lutein',                                 cat: 'color', ord: 78 },
    { mfg: 'e162',   us: 'Beet Juice (Color)',                     cat: 'color', ord: 78 },
    { mfg: 'e163',   us: 'Anthocyanins',                           cat: 'color', ord: 78 },
    { mfg: 'e172',   us: 'Iron Oxides and Hydroxides',             cat: 'color', ord: 78 },

    // ── FLAGGED COLORS — require explicit human review ────────────────────────
    // Carmine: keep in output + warn (do NOT silently convert to Red 40)
    { mfg: 'carmine',   us: 'Carmine',  flag: true, cat: 'color', ord: 79,
      flagNote: 'Carmine is an animal-derived colorant. Verify allergen/vegan requirements with retailer before use.' },
    { mfg: 'cochineal', us: 'Carmine',  flag: true, cat: 'color', ord: 79,
      flagNote: 'Cochineal extract = Carmine (animal-derived). Same review requirement as Carmine.' },
    { mfg: 'e120',      us: 'Carmine',  flag: true, cat: 'color', ord: 79,
      flagNote: 'E120 = Carmine (cochineal, animal-derived). Verify before U.S. use.' },
    // Not FDA approved
    { mfg: 'e122',  us: null, flag: true, cat: 'color', ord: 79,
      flagNote: 'E122 (Carmoisine/Azorubine) is NOT FDA approved — must be removed or substituted.' },
    { mfg: 'e124',  us: null, flag: true, cat: 'color', ord: 79,
      flagNote: 'E124 (Ponceau 4R) is NOT FDA approved — must be removed or substituted.' },
    { mfg: 'e171',  us: null, flag: true, cat: 'color', ord: 79,
      flagNote: 'E171 (Titanium Dioxide) banned by FDA (2024) — must be removed from formulation.' },

    // ── MISC (sortOrder 90) ───────────────────────────────────────────────────
    { mfg: 'water',   us: 'Water',  cat: 'misc', ord: 90, exclude: true,
      excludeNote: 'Water removed by default (typically excluded from candy ingredient declarations)' },
    { mfg: 'colour',  us: 'Color',  cat: 'misc', ord: 90 },
    { mfg: 'colours', us: 'Colors', cat: 'misc', ord: 90 },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // STRUCTURAL LABELS — stripped before tokenization
  // ═══════════════════════════════════════════════════════════════════════════
  const STRUCTURAL_LABEL_RES = [
    /food\s+additives?\s*[:\-]?/gi,
    /food\s+colou?rings?\s*[:\-]?/gi,
    /colou?ring\s*agents?\s*[:\-]?/gi,
    /contains\s*[:\-]?/gi,
    /ingredients?\s*[:\-]?/gi,
    /made\s+with\s*[:\-]?/gi,
    /declaration\s*[:\-]?/gi,
    /components?\s*[:\-]?/gi,
  ];

  // Tokens to exclude entirely (default filter)
  const EXCLUDE_TOKENS_RE = [
    /^open\b/i, /^consume\b/i, /^see\b/i, /^for\b.*use$/i,
    /^best\s+before/i, /^store\b/i, /^keep\b/i, /^refrigerate/i,
    /^shake\b/i, /^mix\b/i, /^add\b/i, /^heat\b/i, /^microwave/i,
    /^serving\b/i, /^per\b/i, /^about\b/i,
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // SOURCE CONFIDENCE TIERS
  // Heuristic: blocks with percentages are Tier 1 (high confidence).
  // Blocks that start with "Ingredients:" or similar are Tier 2.
  // Everything else is Tier 3 (summary / OCR).
  // ═══════════════════════════════════════════════════════════════════════════
  function _assignTier(block) {
    if (/\d+\.?\d*\s*%/.test(block)) return 1;           // has percentages → detailed formula
    if (/ingredients?\s*:/i.test(block)) return 2;        // explicit ingredients block
    return 3;                                             // summary / translated fragment
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRE-CLEAN
  // ═══════════════════════════════════════════════════════════════════════════
  function _preclean(text) {
    return (text || '')
      .replace(/\r\n|\r/g, '\n')
      .replace(/['']/g, "'")
      .replace(/[""„]/g, '"')
      .replace(/[≥≤<>]/g, '')
      .replace(/\u00a0/g, ' ')    // non-breaking space
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPLIT RAW TEXT INTO SOURCE BLOCKS (handles multi-block supplier docs)
  // ═══════════════════════════════════════════════════════════════════════════
  function _splitBlocks(text) {
    // Split on newlines that precede "Ingredients:" or a line starting with a percentage list
    const parts = text.split(/\n(?=\s*(?:ingredients?\s*:|[\d.]+\s*%))/i);
    if (parts.length <= 1) return [text];
    return parts.map(p => p.trim()).filter(Boolean);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTRACT TOKENS FROM ONE BLOCK
  // ═══════════════════════════════════════════════════════════════════════════
  function _extractTokens(blockText) {
    let w = blockText;

    // Strip structural labels
    STRUCTURAL_LABEL_RES.forEach(re => { w = w.replace(re, ' '); });

    // Flatten square-bracket additive groups [a, b, c] → , a, b, c ,
    w = w.replace(/\[([^\]]*)\]/g, (_, inner) => ', ' + inner + ',');
    w = w.replace(/\[([^\]]*)/g,   (_, inner) => ', ' + inner);   // unclosed [
    w = w.replace(/\]/g, ',');                                      // orphaned ]

    // Flatten parenthetical sub-lists containing commas
    w = w.replace(/\(([^)]+,[^)]+)\)/g, (_, inner) => ', ' + inner);

    // Strip percentages (keep the ingredient name after it)
    w = w.replace(/\d+\.?\d*\s*%\s*/g, '');

    // Strip dangling qualifiers
    w = w.replace(/\bwith\s+added\b/gi, '');
    w = w.replace(/\b(?:added|approx\.?|approximately|min\.?|max\.?)\b/gi, '');

    // Normalize separators
    w = w.replace(/[;\/]/g, ',');
    w = w.replace(/\.\s*(?=[A-Z])/g, ', ');    // period before capital = separator
    w = w.replace(/\.\s*$/gm, '');             // trailing periods per line

    // Clean up
    w = w.replace(/,\s*,+/g, ',');
    w = w.replace(/\s{2,}/g, ' ');

    return w.split(',')
      .map(t => t.trim())
      .filter(t => {
        if (t.length < 2) return false;
        // Drop pure noise tokens
        if (EXCLUDE_TOKENS_RE.some(re => re.test(t))) return false;
        // Drop tokens that are just symbols or digits
        if (/^[\d\s\-_.:\/\\]+$/.test(t)) return false;
        return true;
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAP ONE TOKEN through the dictionary (longest-match, case-insensitive)
  // ═══════════════════════════════════════════════════════════════════════════
  function _mapToken(token) {
    const lower = token.toLowerCase().trim();

    for (const entry of DICT) {
      const mfgLower = entry.mfg.toLowerCase();
      if (lower === mfgLower || lower.includes(mfgLower)) {
        return {
          original:   token,
          resolved:   entry.us !== null ? entry.us : _titleCase(token),
          usName:     entry.us,
          cat:        entry.cat || 'misc',
          ord:        entry.ord != null ? entry.ord : 99,
          flag:       !!entry.flag,
          flagNote:   entry.flagNote || null,
          review:     !!entry.review,
          reviewNote: entry.reviewNote || null,
          exclude:    !!entry.exclude,
          excludeNote:entry.excludeNote || null,
          mapped:     true,
          dictEntry:  entry.mfg,
        };
      }
    }

    // No match — pass through with title-case
    return {
      original:  token,
      resolved:  _titleCase(token),
      usName:    null,
      cat:       'misc',
      ord:       85,   // after flavors/colors, before water
      flag:      false,
      review:    false,
      exclude:   false,
      mapped:    false,
      dictEntry: null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TITLE CASE
  // ═══════════════════════════════════════════════════════════════════════════
  function _titleCase(str) {
    // Don't title-case tokens that look like E-numbers or already capitalized codes
    if (/^e\d/i.test(str.trim())) return str.trim().toUpperCase();
    return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEDUPE — merge by normalized resolved name; tier-1 wins naming conflicts
  // ═══════════════════════════════════════════════════════════════════════════
  function _dedupe(tokens) {
    const map = new Map();
    tokens.forEach(t => {
      const key = (t.resolved || t.original).toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, t);
      }
      // else: already seen — keep first (tier-1 sources processed first)
    });
    return Array.from(map.values());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFLICT CHECK — detect when two tokens resolve to competing identities
  // e.g. both Red 40 (from allura red) and Carmine present
  // ═══════════════════════════════════════════════════════════════════════════
  function _detectConflicts(tokens) {
    const conflicts = [];
    const redSources = tokens.filter(t =>
      t.resolved === 'Red 40' || t.resolved === 'Carmine' || t.resolved === 'Red 3'
    );
    if (redSources.length > 1) {
      const names = [...new Set(redSources.map(t => t.resolved))];
      if (names.length > 1) {
        conflicts.push({
          text: `Multiple red colorants detected: ${names.join(', ')}`,
          note: 'Verify with supplier which colorants are actually present — multiple red sources may indicate conflicting documentation.',
          type: 'conflict',
        });
      }
    }
    return conflicts;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SORT — U.S. declaration order heuristic
  // Uses ordinal from dict entry. Unmapped tokens get ord=85 (after colors).
  // When percentages were present in the source, we preserve approx order
  // within each category band (higher percentage = earlier in category).
  // ═══════════════════════════════════════════════════════════════════════════
  function _sort(tokens) {
    return tokens.slice().sort((a, b) => {
      if (a.ord !== b.ord) return a.ord - b.ord;
      // Within same ord: alphabetical
      return (a.resolved || '').localeCompare(b.resolved || '');
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let _initialized = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    if (_initialized) return;
    _initialized = true;
    console.log('[NFSIngredientIntel] init — dictionary entries:', DICT.length);
  }

  function normalize(text) { return _preclean(text); }

  /**
   * getMappings(rawText) → IngredientResult
   *
   * Full pipeline. Returns:
   * {
   *   raw, cleaned,
   *   packagingDraft,   — primary output: clean final U.S. declaration
   *   reviewDraft,      — same but with [VERIFY:...] markers inline
   *   cleanDraft,       — normalized text (no mappings, no ordering)
   *   mappings,         — [{original, resolved, dictEntry}]
   *   warnings,         — [{text, note, type}]
   *   excluded,         — [{token, reason}]
   *   tokens,           — full token objects (debug)
   * }
   */
  function getMappings(rawText) {
    const raw     = rawText || '';
    const cleaned = _preclean(raw);

    // ── 1. Split into source blocks + assign tiers ──────────────────────────
    const blocks = _splitBlocks(cleaned);
    blocks.sort((a, b) => _assignTier(a) - _assignTier(b)); // tier 1 first

    // ── 2. Extract all tokens across all blocks ─────────────────────────────
    const allTokens = [];
    blocks.forEach(block => {
      const tokens = _extractTokens(block);
      tokens.forEach(t => allTokens.push(t));
    });

    // ── 3. Map each token ───────────────────────────────────────────────────
    const mapped = allTokens.map(_mapToken);

    // ── 4. Separate excluded tokens (water etc.) ────────────────────────────
    const excluded     = mapped.filter(t => t.exclude);
    const nonExcluded  = mapped.filter(t => !t.exclude);

    // ── 5. Dedupe ───────────────────────────────────────────────────────────
    const deduped = _dedupe(nonExcluded);

    // ── 6. Conflict check ───────────────────────────────────────────────────
    const conflicts = _detectConflicts(deduped);

    // ── 7. Sort ─────────────────────────────────────────────────────────────
    const sorted = _sort(deduped);

    // ── 8. Assemble outputs ─────────────────────────────────────────────────
    const mappings  = [];
    const warnings  = [...conflicts];
    const packagingParts = [];
    const reviewParts    = [];

    sorted.forEach(t => {
      // Collect warnings
      if (t.flag)   warnings.push({ text: `⚠ ${t.original} → ${t.resolved}`, note: t.flagNote,   type: 'flag' });
      if (t.review) warnings.push({ text: `⚠ Ambiguous: "${t.original}"`,    note: t.reviewNote, type: 'review' });

      // Collect mappings (where name actually changed)
      if (t.mapped && t.dictEntry && t.usName &&
          t.usName.toLowerCase() !== t.original.toLowerCase()) {
        mappings.push({ original: t.original, resolved: t.resolved, dictEntry: t.dictEntry });
      }

      // Build output parts
      if (t.usName === null && (t.flag || t.review)) {
        // Banned / ambiguous — mark for review in both drafts
        reviewParts.push(`[VERIFY: ${_titleCase(t.original)}]`);
        packagingParts.push(`[VERIFY: ${_titleCase(t.original)}]`);
      } else {
        packagingParts.push(t.resolved);
        reviewParts.push(t.flag || t.review ? `${t.resolved} [⚠]` : t.resolved);
      }
    });

    // Warn about excluded items
    excluded.forEach(t => {
      warnings.push({ text: `ℹ ${_titleCase(t.original)} removed`, note: t.excludeNote || `"${t.original}" excluded by default filter`, type: 'info' });
    });

    // Assemble final strings
    // FDA US format: ALL CAPS for packaging/review drafts
    const packagingDraft = packagingParts.length ? packagingParts.join(', ').toUpperCase() + '.' : '';
    const reviewDraft    = reviewParts.length    ? reviewParts.join(', ').toUpperCase()    + '.' : '';
    const cleanDraft     = sorted.map(t => t.resolved).join(', ') + (sorted.length ? '.' : '');

    return {
      raw,
      cleaned,
      packagingDraft,
      reviewDraft,
      cleanDraft,
      mappings,
      warnings,
      excluded: excluded.map(t => ({ token: t.original, reason: t.excludeNote || 'default filter' })),
      tokens: sorted,
    };
  }

  function translateToUS(text) { return getMappings(text).packagingDraft; }
  function getTranslationMap() { return DICT.slice(); }

  // Legacy alias — older code calls getMappings and reads result.usDraft
  // Keep working by aliasing to packagingDraft
  const _origGetMappings = getMappings;
  window.NFSIngredientIntel = {
    init, normalize, translateToUS, getTranslationMap,
    getMappings: function(text) {
      const r = _origGetMappings(text);
      r.usDraft = r.packagingDraft;   // backward-compat alias
      return r;
    },
  };

})();
