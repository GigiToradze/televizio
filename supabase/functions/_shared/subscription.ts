/* Subscription arithmetic.
 *
 * Dates here are calendar days as 'YYYY-MM-DD', never timestamps. A due date
 * is the same day in Tbilisi as it is anywhere else, and the moment a
 * timezone gets involved a subscription starts expiring a day early for
 * somebody. Everything below parses the string by hand and works in UTC.
 *
 * Pure, no imports: used by the edge functions and the CMS alike, and
 * tested on its own.
 */

export type SubscriptionLike = {
  started_on: string;
  due_on: string;
  status: 'active' | 'expired' | 'cancelled';
};

export type PaymentLike = { paid_on: string };

export type SubscriptionState =
  | 'active' | 'due-soon' | 'overdue' | 'expired' | 'cancelled';

/** How near the due date counts as near. */
export const DUE_SOON_DAYS = 7;

function parse(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function utc(iso: string): number {
  const [y, m, d] = parse(iso);
  return Date.UTC(y, m - 1, d);
}

/** Add calendar months, clamping to the end of a shorter month.
 *  31 January plus one month is 28 February, not 3 March. */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = parse(iso);
  const target = m - 1 + n;
  const year = y + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return fmt(year, month + 1, Math.min(d, lastDay));
}

/** Days from today to the due date. Zero on the day itself, negative after. */
export function daysLeft(dueOn: string, today: string): number {
  return Math.round((utc(dueOn) - utc(today)) / 86_400_000);
}

/** The due date after a renewal.
 *
 *  Always counted from the previous due date, never from today — paying four
 *  days late must not cost four days. A subscription several periods overdue
 *  rolls forward in one call until the answer is actually in the future.
 */
export function nextDueDate(dueOn: string, today: string): string {
  let next = addMonths(dueOn, 1);
  let guard = 0;
  while (utc(next) <= utc(today) && guard++ < 600) {
    next = addMonths(next, 1);
  }
  return next;
}

/** The first day of the period the subscription is currently in: the later
 *  of when it started and when the previous period ended. */
export function periodStart(s: SubscriptionLike): string {
  const previous = addMonths(s.due_on, -1);
  return utc(s.started_on) > utc(previous) ? s.started_on : previous;
}

/** Whether the current period has been paid for. Used by the overdue
 *  warning, which cares about unpaid rather than merely late. */
export function isPeriodPaid(s: SubscriptionLike, payments: PaymentLike[]): boolean {
  const from = utc(periodStart(s));
  return payments.some((p) => utc(p.paid_on) >= from);
}

export function subscriptionState(
  s: SubscriptionLike, today: string,
): SubscriptionState {
  if (s.status === 'cancelled') return 'cancelled';
  if (s.status === 'expired') return 'expired';

  const left = daysLeft(s.due_on, today);
  if (left < 0) return 'overdue';
  if (left <= DUE_SOON_DAYS) return 'due-soon';
  return 'active';
}

/** The lookup's second factor. Mirrors the generated column in the database:
 *  digits only, last four. */
export function last4(phone: string): string {
  return phone.replace(/\D/g, '').slice(-4);
}
