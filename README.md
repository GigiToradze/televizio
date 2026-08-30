# televizio.ge

Single-page marketing site for Televizio — Android TV box + channel subscription.
Static HTML/CSS/JS. No build step, no dependencies to install.

## Run locally

```bash
npx serve -l 4173 .
```

Then open http://localhost:4173. Any static server works; serve it over HTTP rather
than opening the file directly, so the fonts and video load.

## Deploy

Upload the whole folder as-is to any static host (Netlify, Cloudflare Pages, Nginx,
a plain S3 bucket). Nothing is generated at build time.

## Structure

```
index.html                 all markup, both languages
assets/css/style.css       @font-face, tokens + all styles
assets/js/main.js          language switch, menu, hero parallax, reveals
assets/js/vendor/          GSAP 3.15 + ScrollTrigger (vendored, no CDN)
assets/fonts/              Eurostile GEO_Mt, four weights as woff2
assets/video/box-loop.mp4  looping product reveal in "the box" section
assets/img/                room.webp (hero), logo lockups, icons, star mask
```

## Typography

**Eurostile GEO_Mt** carries both scripts — Georgian and Latin come from the same
family, so the two language versions look identical in weight and colour. Four
upright weights are self-hosted as woff2 (`400` body, `600` labels, `700` headings,
`900` hero). **IBM Plex Mono** is loaded from Google Fonts and used only for
technical surfaces: the programme-guide time ruler, spec values, buttons, nav and
meta lines. Georgian inside those mono runs falls back to Eurostile automatically.

The font is a commercial licence from typeface.ge. The woff2 files here were built
from the TTFs with `fontTools`; confirm the licence covers web embedding before the
site goes public, and re-export if you need a subset.

## Brand assets

| File | Source | Used for |
|---|---|---|
| `logo-white.png` | wordmark, white | header |
| `logo-red.png` | wordmark, red | footer |
| `icon-red.png` | solid red tile, black star | Open Graph image |
| `icon-outline.png` | outlined tile, red star | closing call to action |
| `apple-touch-icon.png`, `favicon.png` | solid red tile | browser and home screen |
| `star.svg` | the star alone | CSS mask for bullets and separators |

All lockups are transparent PNGs at 2× their largest on-page size. `star.svg` is
painted with `mask` plus `background: currentColor`, so every bullet, ticker
separator and eyebrow marker takes the colour of its own text.

## The hero

`room.webp` sits on a CSS 3D stage: `.hero__stage` sets the perspective, `.hero__plate`
holds `transform-style: preserve-3d`, and the layers inside sit at different
`translateZ` depths — the bias-light glow behind the set at 52px, the neon sign's halo
at 34px, a pointer-tracked sheen at 76px. Each depth carries a counter-scale
(`(perspective − z) / perspective`) so every layer lands exactly on the photograph at
rest and only separates once the plate tilts.

Pointer position drives `rotationX` / `rotationY` (±4.2°) through `gsap.quickTo`, the
copy slides the opposite way for parallax, and the closer the pointer gets to the
television the brighter the room burns — that's the `--tvglow` custom property being
tweened, read by the glow layer's `opacity`. Before anyone touches it a slow idle drift
keeps the room alive; the first pointer move kills it for good. Scroll adds a second
parallax as the hero leaves.

Coarse pointers, touch devices and `prefers-reduced-motion` get the photograph, the
glow and the scroll parallax, with no tilt and no sheen. On phones the hero re-lays out
entirely: the room becomes a 52svh band with the copy beneath it.

If you replace `room.webp`, check the three hard-coded frame positions: `TV` in
`main.js` and the `left`/`top` of `.hero__tvglow` and `.hero__neonglow` in the CSS,
all expressed as a fraction of the image.

## The product film

`box-loop.mp4` in "the box" section starts when it scrolls into view, loops, and
pauses when it scrolls out — an IntersectionObserver in `main.js` drives it. It is
muted and `playsinline`, so it autoplays everywhere without a gesture.

## Languages

Georgian is the default. Every string is in the markup twice, as
`<span class="ka">` / `<span class="en">`, and CSS shows one set based on
`<html data-lang>`. The choice is stored in `localStorage` under `televizio-lang`.
To add or change copy, edit both spans together.

## Placeholders to replace before launch

All invented, all realistic — none of it is real business data.

| Where | Placeholder |
|---|---|
| Pricing | 19₾ / 29₾ / 45₾ per month; box 149₾ or free on 12 months |
| Channel counts | 180+ / 520+ / 1,024; "40+ countries"; 3/7/14-day archive |
| EPG grid | 9 channels with invented programme titles and the 46% "now" playhead (`--now`) |
| Specs | Android TV 11, 2 GB / 16 GB, 4K HDR10+, Wi-Fi 5, 24-month warranty |
| Delivery times | 24 h Tbilisi, 48 h regions |
| Contact | +995 32 2 000 000, sales@televizio.ge, hello@televizio.ge |
| Company | Chavchavadze Ave 37, Tbilisi 0179; reg. 400000000 |
| Legal links | Terms and Privacy point at `#` |
| Plan buttons | "Choose" links jump to `#contact`; wire them to a real order form |

## Accessibility and fallbacks

- `prefers-reduced-motion`: the tilt, sheen, reveals and ticker are disabled; the
  hero keeps the photograph and its glow.
- No JavaScript: the hero photograph renders as-is, all copy is visible, and the
  site reads top to bottom in Georgian.
- Keyboard: skip link, visible red focus ring, `<details>` FAQ, Escape closes the
  mobile menu.
