import type { Snapshot, SnapshotInput } from './types.ts';

/** Assemble the one document the public site reads.
 *
 *  Plan membership is denormalised onto each channel because that is the
 *  shape the markup wants — data-plan="basic standard premium" — even though
 *  the database keeps it as a join table.
 *
 *  The output is deterministic: everything is sorted, so two publishes of
 *  unchanged content hash the same and the CDN keeps its cache.
 */
export function buildSnapshot(input: SnapshotInput, publishedAt: string): Snapshot {
  const base = input.logoBaseUrl.endsWith('/')
    ? input.logoBaseUrl
    : `${input.logoBaseUrl}/`;

  // A setting carries a number, a label, or both: the counter animates to
  // 1024 but prints as "1 024", and the markup wants each in its own place.
  const settings: Record<string, string | number> = {};
  for (const s of [...input.settings].sort((a, b) => a.key.localeCompare(b.key))) {
    if (s.value_num !== null) settings[s.key] = Number(s.value_num);
    if (s.value_text !== null) settings[`${s.key}_label`] = s.value_text;
  }

  return {
    version: 1,
    published_at: publishedAt,
    settings,
    categories: [...input.categories]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        slug: c.slug, name_ka: c.name_ka, name_en: c.name_en, sort: c.sort_order,
      })),
    channels: [...input.channels]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        slug: c.slug,
        name_ka: c.name_ka,
        name_en: c.name_en,
        logo: `${base}${c.logo_path ?? ''}`,
        w: c.logo_w ?? 0,
        h: c.logo_h ?? 0,
        cats: c.cats,
        plans: [...c.plans].sort(),
        in_slider: c.in_slider,
        slider_order: c.slider_order,
        sort: c.sort_order,
      })),
    plans: [...input.plans]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({
        slug: p.slug,
        name_ka: p.name_ka,
        name_en: p.name_en,
        price: Number(p.price),
        currency: p.currency,
        period_ka: p.period_ka,
        period_en: p.period_en,
        featured: p.is_featured,
        badge_ka: p.badge_ka,
        badge_en: p.badge_en,
        total_label: p.total_label,
        features: p.features,
      })),
  };
}
