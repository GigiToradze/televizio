# televizio.ge

Single-page marketing site for Televizio — Android TV box + channel subscription.
Static HTML/CSS/JS. No build step, no dependencies to install.

## Run locally

```bash
npx serve -l 4173 .
```

Then open http://localhost:4173. Any static server works; the page must be served over
HTTP (not `file://`) so the frame sequence loads.

## Deploy

Upload the whole folder as-is to any static host (Netlify, Cloudflare Pages, Nginx,
a plain S3 bucket). Nothing is generated at build time.

## Structure

```
index.html                 all markup, both languages
assets/css/style.css       tokens + all styles
assets/js/main.js          language switch, hero scrub, reveals
assets/js/vendor/          GSAP 3.15 + ScrollTrigger (vendored, no CDN)
assets/frames/f001..f097   hero film, one webp per frame (1.8 MB total)
assets/video/hero.mp4      hero fallback for reduced-motion / no-GSAP
assets/video/box-loop.mp4  product reveal in "the box" section
assets/img/                logo lockups, app icon, favicon, poster
```

## The hero

`assets/frames/` is the source video decimated to every second frame (97 frames from
8.04 s at 24 fps) and painted into a `<canvas>` by GSAP ScrollTrigger, so the film is
scrubbed by scroll position rather than played. The scroll runway is `.hero { height }`
in the CSS — 420vh on desktop, 330vh on phones.

To swap the film, re-run:

```bash
ffmpeg -i source.mp4 -vf "select='not(mod(n\,2))',scale=1280:720" -vsync 0 \
  -c:v libwebp -f image2 -quality 72 -preset photo assets/frames/f%03d.webp
```

then update `COUNT` in `assets/js/main.js` and the `BEATS` milestones (progress ranges,
0–1) that decide when each headline and the red bloom appear.

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

- `prefers-reduced-motion`: the scrub, reveals and ticker are disabled; the hero
  collapses to one screen and plays `hero.mp4` instead.
- No JavaScript: the hero collapses to one screen showing the final frame, all copy
  is visible, and the site reads top to bottom in Georgian.
- Keyboard: skip link, visible red focus ring, `<details>` FAQ, Escape closes the
  mobile menu.
