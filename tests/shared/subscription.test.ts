import { describe, expect, it } from 'vitest';
import {
  addMonths, daysLeft, isPeriodPaid, last4, nextDueDate, periodStart,
  subscriptionState,
} from '../../supabase/functions/_shared/subscription.ts';

describe('addMonths', () => {
  it('keeps the day of the month where it can', () => {
    expect(addMonths('2026-09-05', 1)).toBe('2026-10-05');
  });

  it('clamps to the end of a shorter month rather than overflowing', () => {
    // The classic: naive date maths turns 31 January into 3 March.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('knows February in a leap year', () => {
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('crosses a year boundary', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('goes backwards too', () => {
    expect(addMonths('2026-03-01', -1)).toBe('2026-02-01');
    expect(addMonths('2027-01-10', -1)).toBe('2026-12-10');
  });
});

describe('daysLeft', () => {
  it('is zero on the due date', () => {
    expect(daysLeft('2026-09-01', '2026-09-01')).toBe(0);
  });

  it('counts forward', () => {
    expect(daysLeft('2026-09-08', '2026-09-01')).toBe(7);
  });

  it('goes negative once the date has passed', () => {
    expect(daysLeft('2026-08-25', '2026-09-01')).toBe(-7);
  });

  it('is not thrown off by a month boundary', () => {
    expect(daysLeft('2026-10-01', '2026-09-30')).toBe(1);
  });
});

describe('nextDueDate', () => {
  it('counts from the due date, not from today', () => {
    // Paying four days late must not shorten the next period.
    expect(nextDueDate('2026-09-01', '2026-09-05')).toBe('2026-10-01');
  });

  it('still counts from the due date when paying early', () => {
    expect(nextDueDate('2026-09-05', '2026-09-01')).toBe('2026-10-05');
  });

  it('rolls forward past today in one call when badly overdue', () => {
    // Three periods late: the answer must be in the future, not in the past.
    expect(nextDueDate('2026-06-01', '2026-09-15')).toBe('2026-10-01');
  });
});

describe('subscriptionState', () => {
  const base = { started_on: '2026-01-01', due_on: '2026-10-01', status: 'active' as const };

  it('is active with room to spare', () => {
    expect(subscriptionState(base, '2026-09-01')).toBe('active');
  });

  it('is due-soon inside seven days', () => {
    expect(subscriptionState(base, '2026-09-25')).toBe('due-soon');
  });

  it('is still due-soon on the due date itself', () => {
    expect(subscriptionState(base, '2026-10-01')).toBe('due-soon');
  });

  it('is overdue the day after', () => {
    expect(subscriptionState(base, '2026-10-02')).toBe('overdue');
  });

  it('reports a cancelled subscription as cancelled whatever the date', () => {
    expect(subscriptionState({ ...base, status: 'cancelled' }, '2026-01-01'))
      .toBe('cancelled');
  });

  it('reports an expired one as expired', () => {
    expect(subscriptionState({ ...base, status: 'expired' }, '2026-01-01'))
      .toBe('expired');
  });
});

describe('periodStart', () => {
  it('is one month before the due date, mid-subscription', () => {
    expect(periodStart({ started_on: '2026-01-15', due_on: '2026-10-15',
                         status: 'active' })).toBe('2026-09-15');
  });

  it('is the start date during the first period', () => {
    expect(periodStart({ started_on: '2026-09-20', due_on: '2026-10-20',
                         status: 'active' })).toBe('2026-09-20');
  });
});

describe('isPeriodPaid', () => {
  const sub = { started_on: '2026-01-15', due_on: '2026-10-15', status: 'active' as const };

  it('is true for a payment inside the current period', () => {
    expect(isPeriodPaid(sub, [{ paid_on: '2026-09-20' }])).toBe(true);
  });

  it('is true for a payment on the first day of the period', () => {
    expect(isPeriodPaid(sub, [{ paid_on: '2026-09-15' }])).toBe(true);
  });

  it('is false when the only payment is for a previous period', () => {
    expect(isPeriodPaid(sub, [{ paid_on: '2026-08-14' }])).toBe(false);
  });

  it('is false with no payments at all', () => {
    expect(isPeriodPaid(sub, [])).toBe(false);
  });
});

describe('last4', () => {
  it('ignores spaces, plus signs and dashes', () => {
    expect(last4('+995 555 12 34 78')).toBe('3478');
    expect(last4('555-00-11-22')).toBe('1122');
  });

  it('returns what there is when the number is short', () => {
    expect(last4('123')).toBe('123');
  });
});
