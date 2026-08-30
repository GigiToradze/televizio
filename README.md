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
assets/js/main.js          ten small modules, listed in its header comment
assets/js/vendor/          GSAP 3.15 + ScrollTrigger, three.js r185 (no CDN)
assets/fonts/              Eurostile GEO_Mt, four weights as woff2
assets/video/box-loop.mp4  looping product reveal in "the box" section
assets/img/                room.webp (hero), og.jpg, logos, icons, star mask
assets/img/channels/       26 channel marks — PLACEHOLDERS, see the README there
robots.txt, sitemap.xml    both assume the site is served from televizio.ge
favicon.ico                only so browsers stop asking for it
```

## Typography

Three faces, three jobs.

- **Eurostile GEO_Mt** — headlines, nav, buttons, numbers, channel names. Self-hosted
  as four woff2 weights (400/600/700/900) and it carries both scripts, so Georgian and
  Latin headlines share the same letterforms.
- **IBM Plex Sans** with **Noto Sans Georgian** — every paragraph. Eurostile is a
  display face; at body sizes it slows reading down, in Georgian especially. Anything
  that is a sentence uses `--f-text` instead.
- **IBM Plex Mono** — the technical surfaces only: the guide's time ruler, spec
  values, eyebrows, meta lines.

English headlines set in caps (`[data-lang="en"]` in the CSS), which is what Eurostile
was drawn for; they also take a slightly smaller size, since caps read optically
larger. Georgian keeps mixed case — Mkhedruli has no capitals.

Every section heading is one size: `.dsp`, and nothing else. The `--m` and `--s`
modifiers are gone deliberately, so no section can quietly drift out of step. Where a
heading has to share a row with something — the guide, the box — the layout gives it a
column wide enough rather than shrinking the type.

The Eurostile licence is a commercial one from typeface.ge. The woff2 files here were
built from the TTFs with `fontTools`; confirm the licence covers web embedding before
the site goes public.

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

`room.webp` fills the section with two light layers over it — the bias glow behind the
television and the neon sign's halo — each positioned as a fraction of the image and
blended with `screen`, so the photograph's own light appears to keep burning. The
television's glow breathes on a nine-second cycle; the neon flickers on its own,
longer one. A vignette and a left-to-right scrim carry the copy.

There is no pointer tilt. The section moves on scroll only: the plate drifts down and
scales fractionally while the copy rises and fades out, both scrubbed.

On phones the hero re-lays out entirely — the room becomes a 52svh band framed on the
television and the neon sign, with the copy beneath it.

If you replace `room.webp`, move the two glows with it: the `left`/`top` on
`.hero__tvglow` and `.hero__neonglow` in the CSS, both fractions of the image.

## What moves, and why

Every one of these sits in its own module in `main.js` and every one is skipped under
`prefers-reduced-motion`.

- **Hero power-on.** One orchestrated GSAP timeline: the room lifts out of near-black
  as the bias glow comes up, then the eyebrow, headline, lede and buttons land in
  sequence. The photograph keeps drifting on scroll as the section leaves.
- **The channel strip**, under the hero. Logos ride past desaturated; the one under
  the cursor comes up to full colour and scale with a red halo behind it, and the lane
  slows to a twelfth of its speed while the pointer is over the strip, so the logo you
  are looking at does not slide out from under you. The lane runs on GSAP, so
  `ScrollTrigger.getVelocity()` also drags it faster while you scroll. Coarse pointers
  have no way to reveal anything, so they get the logos part-desaturated instead.
  The strip carries no rules above or below it — it sits straight on the black.
- **The wall.** A sticky stage in a 230vh runway holds the screen while 1,024 instanced
  cells scatter through depth and assemble into a 32×32 grid, each one landing on its
  own delay and flickering at its own rate once it settles. The headline fades up with
  the first cells, the grid lands at 76% of the runway, and the rest is a beat where it
  stands before the page moves on. It is the number made literal: that is what a
  thousand channels looks like. One `InstancedBufferGeometry`, one `uP` uniform per
  frame, everything else on the GPU. The headline animates outside the WebGL module, so
  it still arrives if three.js never loads.
- **A guide on the real clock, tuning in row by row.** The programme grid is not a
  screenshot. It reads `Date`, opens the ruler two hours before the current hour, puts
  the playhead at the true position, labels it with the actual time, and marks
  whichever block each channel is really inside, re-ticking every 30 seconds. The
  programme titles are invented; the timeline around them is not. On a wide screen the
  section holds itself the way the wall does — heading beside the guide so the pair
  fits one screen, then the heading, the lede, the ruler and the nine channel rows
  arrive one at a time. It pins above 1100px wide and 640px tall; below that the
  heading goes back over the guide and the same timeline runs against a normal scroll
  range.
- **The signal reaching each stage.** A red rail draws across the three steps as you
  scroll them, and each step's tally lights as the signal arrives — the section is a
  real sequence, so the rail is carrying real information.
- **The signal field.** A three.js `Points` grid in the closing section — a custom
  shader sends concentric rings outward from the centre and bulges toward the pointer.
  It writes clip space directly, so there is no camera maths and no lighting.
- **The statistics opening from the middle out.** Five numbers arriving in three
  waves — the middle one, then the pair either side, then the outer pair — read off a
  `data-tier` on each cell. Built like the wall: a sticky stage inside a 190vh runway,
  so the block holds the screen while it assembles and the numbers climb, with the last
  stretch of the runway left as a beat where all five stand. Scroll back up and it runs
  in reverse. Plus the red signal meter under the header.

Hairlines are gone everywhere except where a grid genuinely needs them: the programme
guide, the spec table and the FAQ rows. Sections, cards and the header are separated by
space and by the panel colour instead.

three.js is ~188 KB gzipped. It is fetched once, lazily, shared between the wall and
the field, and only when one of them is within 500–600 px of the viewport. Both render
loops stop whenever their canvas leaves the screen.

## The box

The product film runs the full width of the section: a band across the top on a phone,
edge to edge behind everything once the section is wide and tall enough to hold the
screen, scaled and pushed right so the box lands clear of the copy, with a left-to-right
scrim carrying the text over it.

Same shape as the wall and the statistics: a sticky stage in a 230vh runway holds the
screen while the section assembles — the film fades up, then the headline, the lede,
then the spec sheet fills in a line at a time, then the price and the caption, then a
beat before the page releases. Reading the box report itself row by row is the point of
the sequence.

It only pins above 901px wide and 700px tall, because below that the two columns stack
into more than a screenful and pinning would trap you. Everywhere else the same
timeline runs against a normal scroll range, and the runway collapses to the content's
own height.

`box-loop.mp4` starts when it scrolls into view, loops, and pauses when it scrolls out
— an IntersectionObserver in `main.js` drives it. It is muted and `playsinline`, so it
autoplays everywhere without a gesture.

## Languages

Georgian is the default. Every string is in the markup twice, as
`<span class="ka">` / `<span class="en">`, and CSS shows one set based on
`<html data-lang>`. The choice is stored in `localStorage` under `televizio-lang`.
To add or change copy, edit both spans together.

## SEO

- `title`, `description`, canonical, `robots`, full Open Graph and Twitter card sets,
  and a 1200×630 `og.jpg` built from the hero photograph with the wordmark on it.
- JSON-LD at the end of `index.html`: `Organization`, `WebSite`, `Product` with the
  three offers, and `FAQPage` carrying all five questions — the answers are visible on
  the page, which is what Google requires for the rich result.
- `robots.txt` and `sitemap.xml`, both pointing at `https://televizio.ge/`. **Change
  the domain in all four places** (`canonical`, `og:url`, JSON-LD `@id`s, sitemap) if
  the site lives anywhere else.
- One real limitation: both languages live at one URL and switch with JavaScript, so
  there is nothing to declare `hreflang` against. Crawlers index the Georgian set. If
  the English version needs to rank on its own, it needs its own URL — `/en/` with the
  markup pre-switched server-side.

## UX notes

- The header nav marks the section you are actually reading (`aria-current`).
- On phones a dock at the bottom keeps the price and the order button in reach, and
  gets out of the way once you reach the pricing cards.
- The mobile menu traps focus while open and returns it to the button on Escape.
- Plan buttons carry `aria-label`s naming the plan, so "Choose" is not the only thing
  a screen reader hears.

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
| Channel marks | All 26 files in `assets/img/channels/` are stand-ins, not the broadcasters' logos — replace them with licensed artwork |

## Accessibility and fallbacks

- `prefers-reduced-motion`: the hero timeline, reveals, counters, scan sweep and both
  WebGL scenes are skipped — three.js is never fetched. The wall collapses from a
  230vh scrub runway to a normal block, the step rail draws itself complete, the
  counters print their final numbers, and the hero keeps the photograph and its glow.
- No JavaScript: the hero photograph renders as-is, all copy is visible, and the
  site reads top to bottom in Georgian.
- Keyboard: skip link, visible red focus ring, `<details>` FAQ, Escape closes the
  mobile menu.
