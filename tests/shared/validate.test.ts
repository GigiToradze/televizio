import { describe, expect, it } from 'vitest';
import { validateContent } from '../../supabase/functions/_shared/validate.ts';
import type { SnapshotInput } from '../../supabase/functions/_shared/types.ts';

function make(over: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    logoBaseUrl: 'https://x/',
    categories: [],
    channels: [
      { slug: 'cnn', name_ka: 'CNN', name_en: 'CNN',
        logo_path: 'channels/cnn.png', logo_w: 258, logo_h: 120,
        sort_order: 1, in_slider: true, slider_order: 1,
        cats: ['news'], plans: ['basic'] },
    ],
    plans: [
      { slug: 'basic', name_ka: 'საბაზისო', name_en: 'Basic', price: 19,
        currency: '₾', period_ka: 'თვე', period_en: 'mo',
        badge_ka: null, badge_en: null, is_featured: false,
        total_label: '180+', sort_order: 1, features: [] },
    ],
    settings: [],
    ...over,
  };
}

describe('validateContent', () => {
  it('passes clean content', () => {
    expect(validateContent(make())).toEqual([]);
  });

  it('names a channel with no logo', () => {
    const input = make();
    input.channels[0].logo_path = null;
    const problems = validateContent(input);
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('missing_logo');
    expect(problems[0].slug).toBe('cnn');
    expect(problems[0].message).toContain('cnn');
  });

  it('treats a logo with no dimensions as missing, since the marquee reflows', () => {
    const input = make();
    input.channels[0].logo_w = null;
    expect(validateContent(input)[0].kind).toBe('missing_logo');
  });

  it('names a plan carrying no channels', () => {
    const input = make();
    input.channels[0].plans = [];
    const problems = validateContent(input);
    expect(problems.map((p) => p.kind)).toContain('empty_plan');
    expect(problems.find((p) => p.kind === 'empty_plan')!.slug).toBe('basic');
  });

  it('reports every problem, not just the first', () => {
    const input = make();
    input.channels[0].logo_path = null;
    input.channels[0].plans = [];
    expect(validateContent(input)).toHaveLength(2);
  });
});
