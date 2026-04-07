# Dark Hero Assets — Hidden Supply OS

## Status
CSS dark filter layer: ✅ ACTIVE (applied via `[data-theme="dark"] .product-float img`)
True transparent cutout assets: ⏳ Coming Soon

## Required Dark Assets (per brand)

| Brand | Source Hero | Dark Target | Status |
|-------|------------|-------------|--------|
| Juice Bomb | `jb_hero_v5_web.webp` | `juice-bomb-hero-dark.webp` | CSS filter active |
| Dirty Sips | `ds_hero_v5_web.webp` | `dirty-sips-hero-dark.webp` | CSS filter active |
| Candu | `candu_hero_v5_web.webp` | `candu-hero-dark.webp` | CSS filter active |
| PeelPals | `pp_hero_v5_web.webp` | `peelpals-hero-dark.webp` | CSS filter active |
| Nauti Labs | `nl_hero_v5_web.webp` | `nauti-labs-hero-dark.webp` | CSS filter active |

## Dark Asset Spec
- No white background box
- No glow/halo edges
- Natural shadow only
- Adjusted contrast for dark surface
- Format: WEBP with transparency (PNG source → WEBP convert)
- Naming: `{brand-slug}-hero-dark.webp`

## CSS Filter (active now)
```css
[data-theme="dark"] .product-float img {
  filter: drop-shadow(0 8px 32px rgba(0,0,0,0.6)) brightness(0.95) contrast(1.05);
}
```
To activate dark mode on a page: `document.documentElement.setAttribute('data-theme', 'dark')`
