import { describe, expect, it } from 'vitest';
import {
  countByMonth, cumulativeByMonth, monthsBack, renewalBuckets, sumByMonth,
} from './analytics';

describe('monthsBack', () => {
  it('ends on the current month and runs backwards', () => {
    expect(monthsBack(3, '2026-09-15')).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('crosses the year boundary', () => {
    expect(monthsBack(3, '2027-01-05')).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('returns one month when asked for one', () => {
    expect(monthsBack(1, '2026-09-15')).toEqual(['2026-09']);
  });
});

describe('countByMonth', () => {
  const months = ['2026-07', '2026-08', '2026-09'];

  it('counts rows into their month', () => {
    expect(countByMonth(
      ['2026-07-03', '2026-08-11', '2026-08-29', '2026-09-01'], months,
    )).toEqual([1, 2, 1]);
  });

  it('ignores anything outside the window', () => {
    expect(countByMonth(['2025-01-01', '2026-09-30'], months)).toEqual([0, 0, 1]);
  });

  it('handles timestamps, not just dates', () => {
    expect(countByMonth(['2026-08-11T22:14:03.000Z'], months)).toEqual([0, 1, 0]);
  });
});

describe('cumulativeByMonth', () => {
  const months = ['2026-07', '2026-08', '2026-09'];

  it('carries earlier rows into the opening total', () => {
    // Two people signed up before the window; the line must not start at zero.
    expect(cumulativeByMonth(
      ['2025-03-01', '2025-04-01', '2026-08-10'], months,
    )).toEqual([2, 3, 3]);
  });

  it('never goes down', () => {
    const out = cumulativeByMonth(['2026-07-01', '2026-09-01'], months);
    expect(out).toEqual([1, 1, 2]);
  });
});

describe('sumByMonth', () => {
  const months = ['2026-08', '2026-09'];

  it('adds the amounts in each month', () => {
    expect(sumByMonth(
      [{ paid_on: '2026-08-02', amount: 29 }, { paid_on: '2026-08-20', amount: 19 },
       { paid_on: '2026-09-04', amount: 45 }],
      months,
    )).toEqual([48, 45]);
  });

  it('is zero for a month with no payments', () => {
    expect(sumByMonth([{ paid_on: '2026-09-01', amount: 10 }], months)).toEqual([0, 10]);
  });
});

describe('renewalBuckets', () => {
  const today = '2026-09-01';

  it('sorts subscriptions by how near the due date is', () => {
    const out = renewalBuckets([
      { due_on: '2026-08-20', status: 'active' },   // overdue
      { due_on: '2026-09-01', status: 'active' },   // today -> within 7
      { due_on: '2026-09-07', status: 'active' },   // within 7
      { due_on: '2026-09-20', status: 'active' },   // within 30
      { due_on: '2026-12-01', status: 'active' },   // later
    ], today);
    expect(out).toEqual({ overdue: 1, within7: 2, within30: 1, later: 1 });
  });

  it('leaves cancelled and expired subscriptions out entirely', () => {
    const out = renewalBuckets([
      { due_on: '2026-08-01', status: 'cancelled' },
      { due_on: '2026-08-01', status: 'expired' },
    ], today);
    expect(out).toEqual({ overdue: 0, within7: 0, within30: 0, later: 0 });
  });

  it('counts the 30th day as within 30, not later', () => {
    expect(renewalBuckets([{ due_on: '2026-10-01', status: 'active' }], today).within30)
      .toBe(1);
  });
});
