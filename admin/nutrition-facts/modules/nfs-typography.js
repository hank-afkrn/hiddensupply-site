/**
 * nfs-typography.js — NFS v5.5 Typography Preset Engine
 * Exposes: window.NFSTypography
 *
 * Owns all typography token definitions, preset configs, and CSS-var/class
 * application helpers. Lives entirely outside the monolith.
 *
 * API:
 *   NFSTypography.init(options?)       — boot, reads current state if available
 *   NFSTypography.applyPreset(name)    — apply preset to preview/export targets
 *   NFSTypography.getPresetConfig(name?) — return preset config object
 *   NFSTypography.listPresets()        — return array of preset names
 */

(function () {
  'use strict';

  // ── Preset definitions ──────────────────────────────────────────────────────
  // Each preset maps to a set of CSS custom properties injected at :root.
  // Names must stay stable — they are persisted with project data.
  const PRESETS = {
    'hs-default': {
      label: 'HS Default',
      description: 'Clean neutral FDA-compliant baseline. Helvetica-family.',
      vars: {
        '--nfs-font-family-body':       '"Helvetica Neue", Helvetica, Arial, sans-serif',
        '--nfs-font-family-header':     '"Helvetica Neue", Helvetica, Arial, sans-serif',
        '--nfs-font-size-header':       '7pt',
        '--nfs-font-size-body':         '6pt',
        '--nfs-font-size-compliance':   '6pt',
        '--nfs-font-weight-header':     '700',
        '--nfs-font-weight-body':       '400',
        '--nfs-letter-spacing-header':  '0em',
        '--nfs-text-transform-header':  'none',
      },
    },

    'juice-bomb': {
      label: 'Juice Bomb',
      description: 'Chunky rounded bold. All-caps headers. Drop-shadow energy.',
      vars: {
        '--nfs-font-family-body':       '"Helvetica Neue", Helvetica, Arial, sans-serif',
        '--nfs-font-family-header':     '"Black Han Sans", "Arial Black", sans-serif',
        '--nfs-font-size-header':       '8pt',
        '--nfs-font-size-body':         '6pt',
        '--nfs-font-size-compliance':   '6pt',
        '--nfs-font-weight-header':     '900',
        '--nfs-font-weight-body':       '400',
        '--nfs-letter-spacing-header':  '0.04em',
        '--nfs-text-transform-header':  'uppercase',
      },
    },

    'dirty-sips': {
      label: 'Dirty Sips',
      description: 'Edgy condensed bold. Attitude-first. Industrial tone.',
      vars: {
        '--nfs-font-family-body':       '"Helvetica Neue", Helvetica, Arial, sans-serif',
        '--nfs-font-family-header':     '"Arial Narrow", "Helvetica Neue Condensed", sans-serif',
        '--nfs-font-size-header':       '8pt',
        '--nfs-font-size-body':         '6pt',
        '--nfs-font-size-compliance':   '6pt',
        '--nfs-font-weight-header':     '800',
        '--nfs-font-weight-body':       '400',
        '--nfs-letter-spacing-header':  '0.02em',
        '--nfs-text-transform-header':  'uppercase',
      },
    },

    'candu': {
      label: 'Candu',
      description: 'Clean rounded friendly. Semi-bold headers. Warm and approachable.',
      vars: {
        '--nfs-font-family-body':       '"Helvetica Neue", Helvetica, Arial, sans-serif',
        '--nfs-font-family-header':     '"Helvetica Neue", Helvetica, Arial, sans-serif',
        '--nfs-font-size-header':       '7.5pt',
        '--nfs-font-size-body':         '6pt',
        '--nfs-font-size-compliance':   '6pt',
        '--nfs-font-weight-header':     '700',
        '--nfs-font-weight-body':       '400',
        '--nfs-letter-spacing-header':  '0.01em',
        '--nfs-text-transform-header':  'none',
      },
    },

    'nauti-labs': {
      label: 'Nauti Labs',
      description: 'Bold structured premium-weird. Centered. Specialty-import feel.',
      vars: {
        '--nfs-font-family-body':       '"Helvetica Neue", Helvetica, Arial, sans-serif',
        '--nfs-font-family-header':     '"Arial Black", "Helvetica Neue", sans-serif',
        '--nfs-font-size-header':       '8pt',
        '--nfs-font-size-body':         '6pt',
        '--nfs-font-size-compliance':   '6pt',
        '--nfs-font-weight-header':     '900',
        '--nfs-font-weight-body':       '400',
        '--nfs-letter-spacing-header':  '0.03em',
        '--nfs-text-transform-header':  'none',
      },
    },

    'peelpals': {
      label: 'PeelPals',
      description: 'Playful bubbly rounded. Tactile fun. Kid-friendly without being childish.',
      vars: {
        '--nfs-font-family-body':       '"Helvetica Neue", Helvetica, Arial, sans-serif',
        '--nfs-font-family-header':     '"Helvetica Neue", Helvetica, Arial, sans-serif',
        '--nfs-font-size-header':       '7.5pt',
        '--nfs-font-size-body':         '6pt',
        '--nfs-font-size-compliance':   '6pt',
        '--nfs-font-weight-header':     '800',
        '--nfs-font-weight-body':       '400',
        '--nfs-letter-spacing-header':  '0.02em',
        '--nfs-text-transform-header':  'none',
      },
    },
  };

  // ── Internal state ──────────────────────────────────────────────────────────
  let _activePreset = 'hs-default';
  let _initialized  = false;

  // ── CSS var injection ───────────────────────────────────────────────────────
  function _applyVarsToRoot(vars) {
    const root = document.documentElement;
    Object.entries(vars).forEach(([prop, val]) => root.style.setProperty(prop, val));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * init(options?)
   * options.preset  — preset name to apply on boot (default: 'hs-default')
   * options.targets — reserved for future: CSS selector(s) to scope vars
   */
  function init(options) {
    if (_initialized) return;
    _initialized = true;

    const preset = options?.preset || 'hs-default';
    applyPreset(preset);
    console.log('[NFSTypography] init — preset:', preset);
  }

  /**
   * applyPreset(name)
   * Applies CSS vars to :root. Safe to call multiple times.
   */
  function applyPreset(name) {
    const config = PRESETS[name] || PRESETS['hs-default'];
    _applyVarsToRoot(config.vars);
    _activePreset = name;
  }

  /**
   * getPresetConfig(name?)
   * Returns full preset object. Defaults to active preset.
   */
  function getPresetConfig(name) {
    return PRESETS[name || _activePreset] || null;
  }

  /**
   * listPresets()
   * Returns array of { name, label, description }
   */
  function listPresets() {
    return Object.entries(PRESETS).map(([name, p]) => ({
      name,
      label: p.label,
      description: p.description,
    }));
  }

  /** activePreset() — returns current preset name */
  function activePreset() { return _activePreset; }

  // ── Expose global ───────────────────────────────────────────────────────────
  window.NFSTypography = { init, applyPreset, getPresetConfig, listPresets, activePreset };

})();
