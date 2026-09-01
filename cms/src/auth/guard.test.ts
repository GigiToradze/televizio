import { describe, expect, it } from 'vitest';
import { canWrite } from './guard';

describe('canWrite', () => {
  it('lets an owner write anything', () => {
    expect(canWrite('owner', 'content')).toBe(true);
    expect(canWrite('owner', 'subscribers')).toBe(true);
  });

  it('lets an editor write content but not subscribers', () => {
    expect(canWrite('editor', 'content')).toBe(true);
    expect(canWrite('editor', 'subscribers')).toBe(false);
  });

  it('lets support write subscribers but not content', () => {
    expect(canWrite('support', 'content')).toBe(false);
    expect(canWrite('support', 'subscribers')).toBe(true);
  });

  it('refuses an unknown or absent role', () => {
    expect(canWrite(null, 'content')).toBe(false);
    expect(canWrite('intern', 'content')).toBe(false);
  });
});
