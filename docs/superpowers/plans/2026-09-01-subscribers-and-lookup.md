# Subscribers and the Public Lookup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep subscriber and subscription records in the CMS, and let a customer check their own plan and due date on televizio.ge without an account.

**Architecture:** Three new tables behind the same deny-by-default RLS as everything else, written only by `owner` and `support`. The customer-facing half is a single edge function — the browser never queries a subscriber table — fronted by a static bilingual page on the marketing site.

**Tech Stack:** As Plan 1. Postgres + RLS, a Deno edge function, the React CMS, and vanilla JS on the static site.

**Spec:** `docs/superpowers/specs/2026-09-01-cms-televizio-design.md` — §4.2, §5.1, §5.3, §6, §9, §10

## Global Constraints

- Everything from Plan 1's Global Constraints and its hosted-Supabase amendment still applies. **`supabase db reset` remains forbidden.**
- This project issues no default table grants. Every new table needs an explicit `grant … to authenticated` and a `revoke … from anon`, or RLS never gets consulted — see migration `20260901000006_grants.sql`.
- Subscriber writes require `owner` or `support`. `editor` reads only.
- The lookup never returns a phone, address, email, note or internal id.
- Money is recorded, never processed. No gateway, no card data, ever.
- Dates are `date`, not `timestamptz`. A due date is a calendar day, and timezones would only make it wrong somewhere.

---

## Decisions this plan makes

Stated up front because they are cheap to change now and expensive later, and because the spec left them open.

1. **Renewal counts from `due_on`, never from today.** Paying three days late must not shorten the next period. Renewing an expired subscription more than one period late rolls forward from the last `due_on` until the result is in the future.
2. **A period is monthly.** `plans` has `period_ka`/`period_en` for display only; the arithmetic is one calendar month. Anything else is a later change.
3. **`subscriber_no` is assigned by the admin.** No generated format. The CMS refuses duplicates because the column is unique, and says so plainly.
4. **`price_at_signup` freezes on the subscription.** Plan prices change; history should not.
5. **`ip_hash` is `sha256(ip + UTC date)`.** No raw IP is stored and the identifier stops correlating at midnight. It is enough to rate-limit a single day's attempts, which is all it is for.
6. **The lookup answers in both languages at once.** It returns `plan_name_ka` and `plan_name_en` and lets the page pick, so the page's language toggle keeps working without a second request.

---

## File Structure

```
supabase/migrations/20260901000007_subscribers.sql   tables, RLS, grants, triggers
supabase/tests/subscribers.test.sql                  pgTAP: shape, RLS, roles
supabase/functions/_shared/subscription.ts           pure date and state logic
supabase/functions/lookup/index.ts                   the public endpoint
tests/shared/subscription.test.ts                    unit tests for the above
tests/functions/lookup.test.ts                       enumeration + rate-limit proofs

cms/src/lib/subscribers.ts                           queries and mutations
cms/src/pages/Subscribers.tsx                        list + search
cms/src/pages/SubscriberDrawer.tsx                   create / edit a subscriber
cms/src/pages/Subscriber.tsx                         one subscriber: history, payments

lookup.html                                          public page, bilingual
assets/js/lookup.js                                  its form logic
assets/css/style.css                                 + a .lk block for the page
vercel.json                                          + cleanUrls, so /lookup resolves
```

---

## Task 1: The tables

**Files:** create `supabase/migrations/20260901000007_subscribers.sql`, `supabase/tests/subscribers.test.sql`

**Produces:** `subscribers`, `subscriptions`, `payments`, `lookup_attempts`

- [ ] **Step 1: Write the failing pgTAP suite** — asserts the four tables exist; `subscriber_no` is unique; `phone_last4` is a generated column; anon is denied on all four; a `support` admin may insert a subscriber; an `editor` may read one but not insert.
- [ ] **Step 2: Run `npm run db:test`** — expect failures on every assertion.
- [ ] **Step 3: Write the migration.** Columns per spec §4.2. `phone_last4 text generated always as (right(regexp_replace(phone,'\D','','g'),4)) stored`. Indexes on `subscriber_no`, `(subscriber_no, phone_last4)`, `subscriptions(due_on)` and `lookup_attempts(ip_hash, created_at)`. RLS: select for any admin, write for `owner`/`support`. Grants to `authenticated`, revoke from `anon`. Audit triggers on all three record tables, reusing `public.log_audit()`.
- [ ] **Step 4: Apply it** — paste into the SQL editor, since there is no database password on this machine. Regenerate `APPLY-ALL.sql` first with `bash supabase/build-apply-all.sh`.
- [ ] **Step 5: Run `npm run db:test`** — expect green.
- [ ] **Step 6: Verify anon is denied over HTTP**, the same check that caught the missing grants in Plan 1.
- [ ] **Step 7: Commit.**

## Task 2: Subscription arithmetic

**Files:** create `supabase/functions/_shared/subscription.ts`, `tests/shared/subscription.test.ts`

**Produces:**
- `addMonths(iso: string, n: number): string`
- `nextDueDate(dueOn: string, today: string): string` — rolls forward until future
- `daysLeft(dueOn: string, today: string): number`
- `subscriptionState(s, today): 'active' | 'due-soon' | 'overdue' | 'expired' | 'cancelled'`
- `periodStart(s): string` — later of `started_on` and previous `due_on`
- `isPeriodPaid(s, payments): boolean`
- `last4(phone: string): string`

- [ ] **Step 1: Write the failing tests.** The cases that matter: 31 Jan + 1 month is 28/29 Feb, not 3 March; renewing on the 5th when due on the 1st gives the 1st of next month; `daysLeft` is 0 on the due date and negative after; `due-soon` is within 7 days; a subscription three periods overdue rolls forward past today in one call; `isPeriodPaid` is false when the only payment predates the current period.
- [ ] **Step 2: `npm test`** — expect module-not-found.
- [ ] **Step 3: Implement.** Pure functions, no imports, no `Date` arithmetic that crosses a timezone — parse `YYYY-MM-DD` by hand.
- [ ] **Step 4: `npm test`** — expect green.
- [ ] **Step 5: Commit.**

## Task 3: The lookup endpoint

**Files:** create `supabase/functions/lookup/index.ts`, `tests/functions/lookup.test.ts`

**Produces:** `POST /functions/v1/lookup` → `200` summary · `404` uniform refusal · `429` rate limited

- [ ] **Step 1: Write the failing integration tests.** The three that matter, from spec §5.3: an unknown number and a known number with the wrong last-4 return **byte-identical** bodies and statuses; a sixth failure from one IP inside ten minutes returns 429 without touching the subscriber table; a successful response contains none of `phone`, `email`, `address`, `notes`, `id`.
- [ ] **Step 2: Run them** — expect 404 from a missing function.
- [ ] **Step 3: Implement.** Service key, never the caller's. Count failures for `ip_hash` in the last 10 minutes before doing anything else. Log every attempt, successful or not. Return only `{ subscriber_no, plan_name_ka, plan_name_en, status, started_on, due_on, days_left, device_count }`.
- [ ] **Step 4: Deploy** — `npx supabase functions deploy lookup --use-api`.
- [ ] **Step 5: Run the tests against it** — expect green.
- [ ] **Step 6: Commit.**

## Task 4: Subscribers in the CMS — the list

**Files:** create `cms/src/lib/subscribers.ts`, `cms/src/pages/Subscribers.tsx`; modify `cms/src/App.tsx`, `cms/src/components/Shell.tsx`

**Produces:** `useSubscribers(search)`, `useSubscriber(id)`, `useSaveSubscriber()`, route `/subscribers`

- [ ] **Step 1:** Queries module, following `cms/src/lib/queries.ts` exactly — same TanStack patterns, same error handling.
- [ ] **Step 2:** The list: search by number, name or phone; columns for number, name, phone, current plan, due date and state; the state coloured by `subscriptionState` — `state--fault` for overdue, `state--standby` for due-soon, `state--ok` otherwise.
- [ ] **Step 3:** Add a "People" group to the rail with a Subscribers link, so the rail stops being one undifferentiated list.
- [ ] **Step 4:** Verify against real rows in the browser.
- [ ] **Step 5: Commit.**

## Task 5: One subscriber

**Files:** create `cms/src/pages/Subscriber.tsx`, `cms/src/pages/SubscriberDrawer.tsx`

- [ ] **Step 1:** The drawer creates and edits a subscriber, and on create takes the first subscription in the same form — a subscriber with no subscription is not a useful record.
- [ ] **Step 2:** The detail page: contact block, subscription history newest first, payment ledger, and a **Renew** action that adds one month to `due_on` using `nextDueDate` and records a payment at `price_at_signup`.
- [ ] **Step 3:** Duplicate `subscriber_no` must say "that number is already taken", not surface a Postgres unique-violation.
- [ ] **Step 4:** Verify in the browser.
- [ ] **Step 5: Commit.**

## Task 6: The public lookup page

**Files:** create `lookup.html`, `assets/js/lookup.js`; modify `assets/css/style.css`, `index.html`, `vercel.json`

- [ ] **Step 1:** Add `"cleanUrls": true` to `vercel.json` so `/lookup` resolves to `lookup.html` through the site rewrite.
- [ ] **Step 2:** Build the page in the site's own idiom — `.ka`/`.en` spans, the existing language toggle, header and footer copied from `index.html`, no new fonts or scripts. Two fields, one button, one result card.
- [ ] **Step 3:** `lookup.js`: posts to the edge function, renders the result, and gives every failure the same message. The 429 gets its own: "Too many attempts. Try again in a few minutes."
- [ ] **Step 4:** Link it from the site header and footer, in both languages.
- [ ] **Step 5:** Verify in the browser at both widths, with a real subscriber and a wrong one.
- [ ] **Step 6: Commit.**

---

## Done when

- `npm run db:test` green, including the new RLS and role assertions.
- `npm test` green, including the enumeration and rate-limit proofs.
- An admin can add a subscriber with a subscription, renew it, and record a payment.
- A customer can check a real number on televizio.ge and get their plan and due date.
- A wrong number and a wrong last-4 are indistinguishable, and six tries in ten minutes get a 429.
