# Channel marks — placeholders

These 26 SVGs are stand-ins, not the broadcasters' real logos. They carry the
right channel names in a neutral house style so the strip can be designed and
reviewed, and they are sized to be swapped one-for-one.

Replace each file with the real licensed logo before launch:

- Keep the filenames. `index.html` references them by slug.
- SVG preferred, transparent background, no fixed white fill — the strip
  desaturates them with a CSS filter and restores colour on hover, so a mark
  that is already grey has nothing to reveal.
- Trim the artboard to the mark itself. The strip sets `max-height` and lets
  width follow, so padding inside the file shows up as a smaller logo.
- Roughly 48 units tall in the viewBox keeps them consistent with these.

Using a broadcaster's logo needs their permission. That is the operator's
call, not something this repo can settle.
