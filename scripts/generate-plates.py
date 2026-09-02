#!/usr/bin/env python3
"""
Generate new hero room plates with Gemini's image model.

Stage one of the hero pipeline: this makes the *room*. The Televizio interface is
composited on afterwards by scripts/hero-compose.html, because image models cannot
render Georgian type or broadcaster marks without inventing them. See
docs/hero-image-prompts.md for the reasoning and the constraints these prompts hold.

    pip install google-genai
    # GEMINI_API_KEY in the environment, or in ~/.claude/.env

    python scripts/generate-plates.py --plate family --n 4
    python scripts/generate-plates.py --all --n 3 --flash
"""

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img" / "plates"

# Image generation on the Gemini API is paid-only — every image model reports a
# free-tier quota of 0. The project behind GEMINI_API_KEY needs billing enabled.
PRO = "gemini-3-pro-image"        # best quality, highest cost per image
FLASH = "gemini-3.1-flash-image"  # cheaper, good enough for culling variants

# Every plate carries these. They are not style notes — the composite in
# hero-compose.html warps the UI onto the panel's four corners, and it breaks
# if the panel is occluded, steeply angled, or too small to carry 25px type.
FRAME = (
    "Cinematic ultrawide photograph, 21:9. The television is a 65-inch panel on the wall "
    "in the right third of the frame, entirely visible and unobstructed, almost square-on "
    "to camera and tilted no more than fifteen degrees, its top edge above the middle of "
    "the image. Nobody's head or hand crosses the screen. The left third of the frame is "
    "quiet — no faces, no bright fixtures, nothing that competes for attention. The screen "
    "is bright and is the main light on the room: cool white on the faces, a deep red glow "
    "spilling onto the wall around the panel. Shot on a full-frame camera at 35mm, f/2.8, "
    "ISO 800 grain, natural colour, deep blacks without crushed shadows. Editorial "
    "advertising photography, calm and unposed."
)

NEGATIVE = (
    "No text, no captions, no subtitles, no logos, no watermarks, no on-screen graphics or "
    "user interface. No distorted hands, no extra fingers. Nobody in the left third of the "
    "frame. Nothing blocking the television."
)

PROMPTS = {
    "family": (
        "A Georgian family of four watching television in a modern Tbilisi apartment at "
        "night. Mother and father in their late thirties on a deep grey sofa, a boy of about "
        "nine leaning forward on the rug, a girl of about six curled against her mother. Seen "
        "from behind and three-quarter rear, faces mostly turned away, warm rim light on hair "
        "and shoulders. Low warm lamps at the left, a window with distant city lights, a low "
        "walnut media console, fruit and tea glasses on the coffee table."
    ),
    "generations": (
        "Three generations of a Georgian family in a warm living room in the evening. "
        "Grandmother and grandfather in armchairs, parents on the sofa, a child on the rug "
        "between them — six people watching television together. A patterned rug on the wall, "
        "a laid table just out of frame, soft domestic clutter. Seen from behind and "
        "three-quarter rear."
    ),
    "match": (
        "A Georgian family watching a football match at night, father and son mid-celebration "
        "with arms half-raised, mother laughing beside them, a younger child kneeling on the "
        "rug. A red accent lamp behind the media console throws strong red light across the "
        "back wall; everything else is close to black. Seen from behind and three-quarter rear."
    ),
    "quiet": (
        "A couple in their sixties watching television late in the evening, tea on the table, "
        "a blanket over their knees, rain on the window behind them. Few objects, a lot of "
        "calm negative space. Seen from behind and three-quarter rear."
    ),
}


def load_key():
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    for p in (Path.home() / ".claude" / ".env", ROOT / ".env"):
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip().strip("\"'")
    return None


def generate(client, types, model, name, prompt, n):
    OUT.mkdir(parents=True, exist_ok=True)
    full = f"{prompt}\n\n{FRAME}\n\n{NEGATIVE}"
    made = []
    for i in range(1, n + 1):
        resp = client.models.generate_content(
            model=model,
            contents=full,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
                image_config=types.ImageConfig(aspect_ratio="21:9"),
            ),
        )
        blob = None
        for cand in resp.candidates or []:
            for part in cand.content.parts or []:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    blob = part.inline_data.data
                    break
            if blob:
                break
        if not blob:
            print(f"  {name} {i}: no image returned "
                  f"({getattr(resp, 'prompt_feedback', None) or 'no feedback'})")
            continue
        path = OUT / f"plate-{name}-{i}.png"
        path.write_bytes(blob)
        made.append(path)
        print(f"  {path.relative_to(ROOT)}  {len(blob) // 1024} KB")
    return made


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plate", choices=sorted(PROMPTS), help="which prompt to run")
    ap.add_argument("--all", action="store_true", help="run every prompt")
    ap.add_argument("--n", type=int, default=4, help="variants per prompt")
    ap.add_argument("--flash", action="store_true", help="use the cheaper model instead of pro")
    ap.add_argument("--model", help="override the model id entirely")
    args = ap.parse_args()

    if not args.plate and not args.all:
        ap.error("pass --plate NAME or --all")

    key = load_key()
    if not key:
        sys.exit(
            "GEMINI_API_KEY not found.\n"
            "Get one at https://aistudio.google.com/apikey, then either export it or add\n"
            "  GEMINI_API_KEY=...\n"
            f"to {Path.home() / '.claude' / '.env'}"
        )

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        sys.exit("google-genai is not installed. Run: pip install google-genai")

    client = genai.Client(api_key=key)
    model = args.model or (FLASH if args.flash else PRO)
    names = sorted(PROMPTS) if args.all else [args.plate]

    print(f"model {model}, {args.n} variant(s) each -> {OUT.relative_to(ROOT)}")
    total = []
    try:
        for name in names:
            print(f"{name}:")
            total += generate(client, types, model, name, PROMPTS[name], args.n)
    except Exception as exc:
        if "RESOURCE_EXHAUSTED" in str(exc) or "429" in str(exc):
            sys.exit(
                "\nThe API rejected this with a free-tier quota of 0.\n"
                "Image generation on the Gemini API is paid-only: enable billing on the\n"
                "project behind this key at https://aistudio.google.com/apikey and retry.\n"
                f"({len(total)} plate(s) written before the stop.)"
            )
        raise

    print(f"\n{len(total)} plate(s) written.")
    print("Pick on panel geometry first, expression second — a beautiful frame with a")
    print("skewed or occluded television cannot carry the interface.")


if __name__ == "__main__":
    main()
