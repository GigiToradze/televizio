/* The parts of the public lookup worth proving.
 *
 * This is the one place customer data leaves the database toward an
 * unauthenticated caller, so the rules live here as pure functions rather
 * than inline in the handler — they can then be tested without a database,
 * and there is exactly one of each rather than one per code path.
 */
import { daysLeft, last4 } from './subscription.ts';

/** The single refusal. Every failure returns this object and a 404: an
 *  unknown number and a known number with the wrong last four must be
 *  indistinguishable, or the form becomes a way to discover which numbers
 *  exist. There is deliberately only one of these in the file. */
export const REFUSED = { error: 'no_match' } as const;

export const WINDOW_MINUTES = 10;
export const MAX_FAILURES = 5;

export function overLimit(recentFailures: number): boolean {
  return recentFailures >= MAX_FAILURES;
}

export type LookupRequest = {
  subscriberNo: string;
  digits: string;
  valid: boolean;
};

/** Normalises what the form sent. The subscriber number is trimmed and
 *  capped so a huge string cannot be used to bloat the attempt log. */
export function parseRequest(body: unknown): LookupRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const subscriberNo = String(b.subscriber_no ?? '').trim().slice(0, 64);
  const digits = last4(String(b.phone_last4 ?? ''));
  return { subscriberNo, digits, valid: subscriberNo.length > 0 && digits.length === 4 };
}

export type SubscriberRow = { subscriber_no: string; status: string };
export type SubscriptionRow = {
  started_on: string;
  due_on: string;
  status: string;
  device_count: number;
  plan_name_ka: string | null;
  plan_name_en: string | null;
};

export type LookupResult = {
  subscriber_no: string;
  account_status: string;
  plan_name_ka: string | null;
  plan_name_en: string | null;
  status: string;
  started_on: string | null;
  due_on: string | null;
  days_left: number | null;
  device_count: number | null;
};

/** Builds the response. Only these nine fields ever go out — never the
 *  phone, email, address, notes, or any internal id. Both languages are
 *  returned at once so the page's language toggle needs no second request. */
export function summarise(
  subscriber: SubscriberRow,
  subscription: SubscriptionRow | null,
  today: string,
): LookupResult {
  if (!subscription) {
    return {
      subscriber_no: subscriber.subscriber_no,
      account_status: subscriber.status,
      plan_name_ka: null,
      plan_name_en: null,
      status: 'none',
      started_on: null,
      due_on: null,
      days_left: null,
      device_count: null,
    };
  }

  return {
    subscriber_no: subscriber.subscriber_no,
    account_status: subscriber.status,
    plan_name_ka: subscription.plan_name_ka,
    plan_name_en: subscription.plan_name_en,
    status: subscription.status,
    started_on: subscription.started_on,
    due_on: subscription.due_on,
    days_left: daysLeft(subscription.due_on, today),
    device_count: subscription.device_count,
  };
}
