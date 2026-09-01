import type { SnapshotInput } from './types.ts';

export type ContentProblem = {
  kind: 'missing_logo' | 'empty_plan';
  slug: string;
  message: string;
};

/** The conditions that block a publish.
 *
 *  A logo without intrinsic dimensions counts as missing: the marquee sizes
 *  itself from width and height attributes and reflows without them, which
 *  looks like a broken page rather than a missing image.
 */
export function validateContent(input: SnapshotInput): ContentProblem[] {
  const problems: ContentProblem[] = [];

  for (const c of input.channels) {
    if (!c.logo_path || !c.logo_w || !c.logo_h) {
      problems.push({
        kind: 'missing_logo',
        slug: c.slug,
        message: `Channel "${c.slug}" has no usable logo. Upload one before publishing.`,
      });
    }
  }

  for (const p of input.plans) {
    const carries = input.channels.some((c) => c.plans.includes(p.slug));
    if (!carries) {
      problems.push({
        kind: 'empty_plan',
        slug: p.slug,
        message: `Plan "${p.slug}" carries no channels. Assign some before publishing.`,
      });
    }
  }

  return problems;
}
