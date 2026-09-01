import { daysLeft } from '../../../supabase/functions/_shared/subscription';

/* Shaping records into series.
 *
 * Kept apart from the charts that draw them: a wrong number is a much worse
 * bug than a wrong bar, and this half can be tested without a DOM.
 *
 * Months are 'YYYY-MM' and compare correctly as strings, which is the whole
 * reason for that format.
 */

export type MonthKey = string;

/** The last `n` months ending with the one `today` falls in. */
export function monthsBack(n: number, today: string): MonthKey[] {
  const [y, m] = today.slice(0, 7).split('-').map(Number);
  const out: MonthKey[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = m - 1 - i;
    const year = y + Math.floor(t / 12);
    const month = ((t % 12) + 12) % 12 + 1;
    out.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return out;
}

const monthOf = (iso: string): MonthKey => iso.slice(0, 7);

/** How many rows fall in each month of the window. */
export function countByMonth(isoDates: string[], months: MonthKey[]): number[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const out = months.map(() => 0);
  for (const d of isoDates) {
    const i = index.get(monthOf(d));
    if (i !== undefined) out[i]++;
  }
  return out;
}

/** A running total across the window, opening with everything that happened
 *  before it — otherwise a growth line restarts at zero every year. */
export function cumulativeByMonth(isoDates: string[], months: MonthKey[]): number[] {
  const first = months[0];
  let running = isoDates.filter((d) => monthOf(d) < first).length;
  const perMonth = countByMonth(isoDates, months);
  return perMonth.map((n) => (running += n));
}

export function sumByMonth(
  rows: { paid_on: string; amount: number }[], months: MonthKey[],
): number[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const out = months.map(() => 0);
  for (const r of rows) {
    const i = index.get(monthOf(r.paid_on));
    if (i !== undefined) out[i] += Number(r.amount);
  }
  return out;
}

export type Buckets = {
  overdue: number; within7: number; within30: number; later: number;
};

/** How much renewal work is coming, and how much is already late.
 *  Cancelled and expired subscriptions are nobody's to chase. */
export function renewalBuckets(
  subs: { due_on: string; status: string }[], today: string,
): Buckets {
  const out: Buckets = { overdue: 0, within7: 0, within30: 0, later: 0 };
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const left = daysLeft(s.due_on, today);
    if (left < 0) out.overdue++;
    else if (left <= 7) out.within7++;
    else if (left <= 30) out.within30++;
    else out.later++;
  }
  return out;
}

/** Month label for an axis. Short, because there are twelve of them. */
export function monthLabel(m: MonthKey, lang: 'ka' | 'en'): string {
  const KA = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ',
              'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const i = Number(m.slice(5, 7)) - 1;
  return (lang === 'ka' ? KA : EN)[i] ?? m;
}
