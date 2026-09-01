/* Pure image helpers. Deliberately imports nothing — the Supabase client
   throws at module load without env vars, and these need to be testable
   on their own. Anything that talks to Storage lives in ./logos.ts. */

/** SVGs have no natural bitmap size, so the dimensions come out of the markup.
 *  The marquee needs both numbers or it reflows, which is why a logo without
 *  them blocks a publish. */
export function svgSizeFromText(text: string): { w: number; h: number } | null {
  const num = (s: string) => parseFloat(s.replace(/[a-z%]/gi, ''));

  const w = text.match(/<svg[^>]*\swidth\s*=\s*"([^"]+)"/i);
  const h = text.match(/<svg[^>]*\sheight\s*=\s*"([^"]+)"/i);
  if (w && h) {
    const wide = num(w[1]);
    const tall = num(h[1]);
    if (wide > 0 && tall > 0) return { w: Math.round(wide), h: Math.round(tall) };
  }

  const box = text.match(/viewBox\s*=\s*"\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
  if (box) return { w: Math.round(+box[1]), h: Math.round(+box[2]) };

  return null;
}

/** The timestamp busts the CDN when a logo is replaced under the same slug. */
export function logoPathFor(slug: string, filename: string, stamp: number): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return `channels/${slug}-${stamp}${ext}`;
}

export async function readImageSize(file: File): Promise<{ w: number; h: number }> {
  if (file.type === 'image/svg+xml') {
    const size = svgSizeFromText(await file.text());
    if (!size) throw new Error('This SVG declares no width/height or viewBox.');
    return size;
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error('Could not read that image.'));
      img.src = url;
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
