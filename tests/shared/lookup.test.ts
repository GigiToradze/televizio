import { describe, expect, it } from 'vitest';
import {
  MAX_FAILURES, REFUSED, overLimit, parseRequest, summarise,
} from '../../supabase/functions/_shared/lookup.ts';

/* The integration tests in tests/functions cover the endpoint end to end,
   but they need credentials and a deployed function. These cover the rules
   themselves, which are the part worth being sure about. */

describe('the refusal', () => {
  it('is a single shared object, so every failure path returns the same bytes', () => {
    expect(JSON.stringify(REFUSED)).toBe('{"error":"no_match"}');
  });

  it('says nothing about why', () => {
    expect(Object.keys(REFUSED)).toEqual(['error']);
    expect(JSON.stringify(REFUSED)).not.toMatch(/number|phone|found|exist/i);
  });
});

describe('overLimit', () => {
  it('allows attempts below the threshold', () => {
    expect(overLimit(MAX_FAILURES - 1)).toBe(false);
  });

  it('blocks at the threshold', () => {
    expect(overLimit(MAX_FAILURES)).toBe(true);
  });
});

describe('parseRequest', () => {
  it('accepts a number and four digits', () => {
    const r = parseRequest({ subscriber_no: ' TV-1001 ', phone_last4: '3478' });
    expect(r).toEqual({ subscriberNo: 'TV-1001', digits: '3478', valid: true });
  });

  it('takes the last four digits of a whole phone number', () => {
    expect(parseRequest({ subscriber_no: 'A', phone_last4: '+995 555 12 34 78' }).digits)
      .toBe('3478');
  });

  it('rejects a missing number', () => {
    expect(parseRequest({ phone_last4: '3478' }).valid).toBe(false);
  });

  it('rejects fewer than four digits', () => {
    expect(parseRequest({ subscriber_no: 'A', phone_last4: '347' }).valid).toBe(false);
  });

  it('rejects a junk body without throwing', () => {
    expect(parseRequest(null).valid).toBe(false);
    expect(parseRequest('nonsense').valid).toBe(false);
  });

  it('caps the number so the attempt log cannot be bloated', () => {
    expect(parseRequest({ subscriber_no: 'x'.repeat(500), phone_last4: '1234' })
      .subscriberNo.length).toBe(64);
  });
});

describe('summarise', () => {
  const subscriber = { subscriber_no: 'TV-1001', status: 'active' };
  const subscription = {
    started_on: '2026-01-15', due_on: '2026-10-15', status: 'active',
    device_count: 3, plan_name_ka: 'სტანდარტული', plan_name_en: 'Standard',
  };

  it('returns the days remaining, counted from today', () => {
    expect(summarise(subscriber, subscription, '2026-10-01').days_left).toBe(14);
  });

  it('carries both languages so the toggle needs no second request', () => {
    const r = summarise(subscriber, subscription, '2026-10-01');
    expect(r.plan_name_ka).toBe('სტანდარტული');
    expect(r.plan_name_en).toBe('Standard');
  });

  it('leaks nothing personal', () => {
    const r = summarise(subscriber, subscription, '2026-10-01');
    const keys = Object.keys(r);
    for (const forbidden of ['phone', 'phone_last4', 'email', 'address',
                             'notes', 'id', 'subscriber_id', 'plan_id']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(JSON.stringify(r)).not.toMatch(/@|\+995/);
  });

  it('answers plainly when the account has no subscription yet', () => {
    const r = summarise(subscriber, null, '2026-10-01');
    expect(r.status).toBe('none');
    expect(r.due_on).toBeNull();
    expect(r.days_left).toBeNull();
  });

  it('reports a suspended account even while the subscription runs', () => {
    const r = summarise({ ...subscriber, status: 'suspended' }, subscription, '2026-10-01');
    expect(r.account_status).toBe('suspended');
  });
});
