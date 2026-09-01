import { describe, expect, it } from 'vitest';
import { svgSizeFromText, logoPathFor } from './image';

describe('svgSizeFromText', () => {
  it('reads width and height attributes', () => {
    expect(svgSizeFromText('<svg width="560" height="160"></svg>'))
      .toEqual({ w: 560, h: 160 });
  });

  it('falls back to the viewBox when there are no attributes', () => {
    expect(svgSizeFromText('<svg viewBox="0 0 2106 250"></svg>'))
      .toEqual({ w: 2106, h: 250 });
  });

  it('strips units', () => {
    expect(svgSizeFromText('<svg width="465px" height="465px"></svg>'))
      .toEqual({ w: 465, h: 465 });
  });

  it('returns null when it can find neither', () => {
    expect(svgSizeFromText('<svg></svg>')).toBeNull();
  });
});

describe('logoPathFor', () => {
  it('namespaces by slug and busts the cache with a stamp', () => {
    expect(logoPathFor('bbc', 'BBC Logo.SVG', 1756000000000))
      .toBe('channels/bbc-1756000000000.svg');
  });

  it('keeps png as png', () => {
    expect(logoPathFor('imedi', 'imedi.png', 1)).toBe('channels/imedi-1.png');
  });
});
