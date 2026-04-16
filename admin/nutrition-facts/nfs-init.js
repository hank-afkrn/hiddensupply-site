/**
 * nfs-init.js — NFS v5.5 Module Boot Path
 *
 * Single init entry point for all v5.5 modular extensions.
 * Runs after DOM is ready. Calls each module's init() in order.
 * Fails gracefully if a module is missing — never throws.
 *
 * Load order (enforced by index.html script tag order):
 *   1. nfs-typography.js     → window.NFSTypography
 *   2. nfs-ingredient-intel.js → window.NFSIngredientIntel
 *   3. nfs-init.js           → boots both (this file)
 */

(function () {
  'use strict';

  // Guard: prevent double-boot if script is somehow loaded twice
  if (window.__NFS_INIT_DONE__) return;
  window.__NFS_INIT_DONE__ = false; // will be set true after successful boot

  // ── Module registry ─────────────────────────────────────────────────────────
  // Add new v5.5 modules here — order matters.
  const MODULES = [
    {
      name: 'NFSTypography',
      globalKey: 'NFSTypography',
      // init options: read active brand from monolith state if available
      initOptions: function () {
        // Try to read the active brand from the monolith's state (non-destructive)
        try {
          const current = window.nfsCurrent; // monolith's current project object
          const brand = current?.brand || current?.brandKey || null;
          // Map brand key to typography preset name
          const presetMap = {
            'juice-bomb':  'juice-bomb',
            'juicebomb':   'juice-bomb',
            'dirty-sips':  'dirty-sips',
            'dirtysips':   'dirty-sips',
            'candu':       'candu',
            'nauti-labs':  'nauti-labs',
            'nautilabs':   'nauti-labs',
            'peelpals':    'peelpals',
          };
          const preset = brand ? (presetMap[brand.toLowerCase()] || 'hs-default') : 'hs-default';
          return { preset };
        } catch (_) {
          return { preset: 'hs-default' };
        }
      },
    },
    {
      name: 'NFSIngredientIntel',
      globalKey: 'NFSIngredientIntel',
      initOptions: null,
    },
  ];

  // ── Boot function ───────────────────────────────────────────────────────────
  function bootModules() {
    if (window.__NFS_INIT_DONE__) return;

    let ok = 0;
    let fail = 0;

    MODULES.forEach(function (m) {
      const mod = window[m.globalKey];
      if (!mod || typeof mod.init !== 'function') {
        console.warn('[nfs-init] module not found or missing init():', m.name);
        fail++;
        return;
      }
      try {
        const opts = typeof m.initOptions === 'function' ? m.initOptions() : (m.initOptions || undefined);
        mod.init(opts);
        ok++;
      } catch (e) {
        console.error('[nfs-init] module init() threw:', m.name, e);
        fail++;
      }
    });

    window.__NFS_INIT_DONE__ = true;
    console.log('[nfs-init] v5.5 modules booted —', ok, 'ok,', fail, 'failed');
  }

  // ── Attach to DOMContentLoaded (or fire immediately if already ready) ───────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootModules);
  } else {
    // DOM already ready (script loaded late / deferred)
    bootModules();
  }

})();
