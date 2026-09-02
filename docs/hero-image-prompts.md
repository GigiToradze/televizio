# Hero plates — generation prompts

Prompts for producing **new** hero photography for `index.html`, to sit alongside (or
replace) `assets/img/scene-*.webp`. Written for a photoreal image model; tested shape is
Gemini 3 Pro Image (`gemini-3-pro-image-preview`, "Nano Banana Pro"), but they carry over
to Firefly or Midjourney with minor syntax changes.

## The pipeline these prompts assume

Do **not** ask the model to draw the Televizio interface. Image models render invented
Georgian glyphs, mangled broadcaster logos and impossible layouts — at hero size it reads
as a fake product. Two stages instead:

1. **Generate the room.** The TV shows a plausible but *disposable* picture. What matters
   is the panel geometry and the light it throws on the family.
2. **Composite the real UI** with `scripts/hero-compose.html` — measure the new panel's
   picture-area corners with `#guides=1`, add them to its `QUADS` map, render at 1584×672.

Stage 2 already exists and is proven on the three current plates. Stage 1 is what needs a
generator.

## Constraints every prompt must hold

These are not stylistic preferences — the composite breaks without them.

| Constraint | Why |
|---|---|
| Whole TV panel in frame, unobstructed, no one's head crossing the screen | the UI is warped onto the panel's four corners |
| Panel near-frontal, tilted no more than ~15° | steeper angles make 25px UI text unreadable |
| Panel occupies roughly the right third, its top edge above the halfway line | matches the current plates and the `hero__copy` overlay |
| Left third quiet — no faces, no bright fixtures | the Georgian headline and CTAs sit there |
| 21:9, delivered at 1584×672 | same plate size as the existing scenes |
| The screen lights the room | if the panel is dark, the composite's dark UI contradicts the lighting |

## Palette

Black ground, one red signal — `#E4211C`, with `#7E0F0C` in the falloff. Red belongs in
the *light*: screen spill on a wall, an accent lamp, a neon mark. Never as a wall colour
across the whole frame, or the headline loses contrast.

---

## The prompts

The runnable copies are in [`scripts/generate-plates.py`](../scripts/generate-plates.py),
which is the single source of truth — every plate there inherits the shared `FRAME` and
`NEGATIVE` blocks that enforce the table above, so only the human subject changes.

| `--plate` | Subject |
|---|---|
| `family` | Mother, father, a boy of nine and a girl of six, modern Tbilisi apartment at night. The primary. |
| `generations` | Grandparents, parents and a child — six people. The most recognisably Georgian of the set. |
| `match` | A family mid-celebration at a football match, red accent light across the back wall. Closest to `scene-2.webp`, the strongest brand image on the site. |
| `quiet` | A couple in their sixties, tea and rain. Most negative space, best for the slide where the copy runs longest. |

## Running it

```bash
pip install google-genai
```

A key from [Google AI Studio](https://aistudio.google.com/apikey), in `~/.claude/.env`:

```
GEMINI_API_KEY=...
```

**The key is not enough.** Image generation on the Gemini API is paid-only — every image
model, pro and flash alike, reports a free-tier quota of `0` and returns 429. The Google
Cloud project behind the key needs billing enabled. Model ids move fast, too: the 2.5
image models are already closed to new keys, so if a model 404s, list what the key can
actually see with `client.models.list()` and pass it via `--model`.

Free alternative: generate in the AI Studio **web** interface, save the results into
`assets/img/plates/`, and skip straight to stage two.

Then:

```bash
python scripts/generate-plates.py --all --n 4
```

Output lands in `assets/img/plates/`. Generate four to six variants per prompt and pick on
panel geometry first, expression second — a beautiful frame with a skewed or occluded
television cannot carry the interface.

## Then stage two

For each chosen plate: open `scripts/hero-compose.html#scene=NAME&guides=1`, read the
panel's picture-area corners off the green overlay, add them to `QUADS` (and a matching
entry in `FEATURE` for what that screen is playing), then render at 1584×672 and convert
to WebP at q0.90 — the current plates land between 150 and 195 KB that way.
