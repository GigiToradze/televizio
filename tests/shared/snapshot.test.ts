import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../../supabase/functions/_shared/snapshot.ts';
import type { SnapshotInput } from '../../supabase/functions/_shared/types.ts';

const BASE = 'https://x.supabase.co/storage/v1/object/public/logos/';

const input: SnapshotInput = {
  logoBaseUrl: BASE,
  categories: [
    { slug: 'ge', name_ka: 'ქართული', name_en: 'Georgian', sort_order: 1 },
    { slug: 'news', name_ka: 'ახალი ამბები', name_en: 'News', sort_order: 2 },
  ],
  channels: [
    { slug: 'formula', name_ka: 'ფორმულა', name_en: 'Formula',
      logo_path: 'channels/formula.png', logo_w: 65, logo_h: 120,
      sort_order: 4, in_slider: true, slider_order: 6,
      cats: ['ge', 'news'], plans: ['basic', 'premium'] },
    { slug: 'cnn', name_ka: 'CNN', name_en: 'CNN',
      logo_path: 'channels/cnn.png', logo_w: 258, logo_h: 120,
      sort_order: 7, in_slider: true, slider_order: 5,
      cats: ['news'], plans: ['premium'] },
  ],
  plans: [
    { slug: 'basic', name_ka: 'საბაზისო', name_en: 'Basic', price: 19,
      currency: '₾', period_ka: 'თვე', period_en: 'mo',
      badge_ka: null, badge_en: null, is_featured: false,
      total_label: '180+', sort_order: 1,
      features: [{ ka: '180+ არხი', en: '180+ channels' }] },
  ],
  settings: [{ key: 'channel_count', value_text: '1 024', value_num: 1024 }],
};

describe('buildSnapshot', () => {
  const snap = buildSnapshot(input, '2026-09-01T12:00:00.000Z');

  it('stamps the version and the publish time', () => {
    expect(snap.version).toBe(1);
    expect(snap.published_at).toBe('2026-09-01T12:00:00.000Z');
  });

  it('turns each logo path into a full public URL', () => {
    expect(snap.channels.find((c) => c.slug === 'cnn')!.logo)
      .toBe(`${BASE}channels/cnn.png`);
  });

  it('orders channels by sort_order, not input order', () => {
    expect(snap.channels.map((c) => c.slug)).toEqual(['formula', 'cnn']);
  });

  it('sorts even when the rows arrive backwards', () => {
    const reversed = { ...input, channels: [...input.channels].reverse() };
    const s = buildSnapshot(reversed, '2026-09-01T12:00:00.000Z');
    expect(s.channels.map((c) => c.slug)).toEqual(['formula', 'cnn']);
  });

  it('keeps the first category first, since it becomes the card tag', () => {
    expect(snap.channels.find((c) => c.slug === 'formula')!.cats)
      .toEqual(['ge', 'news']);
  });

  it('carries plan membership onto the channel', () => {
    expect(snap.channels.find((c) => c.slug === 'cnn')!.plans).toEqual(['premium']);
  });

  it('flattens settings into an object of both text and number', () => {
    expect(snap.settings.channel_count).toBe(1024);
    expect(snap.settings.channel_count_label).toBe('1 024');
  });

  it('keeps plan features in order', () => {
    expect(snap.plans[0].features).toEqual([{ ka: '180+ არხი', en: '180+ channels' }]);
  });

  it('is stable — the same input twice gives byte-identical JSON', () => {
    const a = JSON.stringify(buildSnapshot(input, '2026-09-01T12:00:00.000Z'));
    const b = JSON.stringify(buildSnapshot(input, '2026-09-01T12:00:00.000Z'));
    expect(a).toBe(b);
  });
});
