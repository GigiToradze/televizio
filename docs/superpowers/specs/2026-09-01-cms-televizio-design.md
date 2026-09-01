# cms.televizio.ge — design

**Date:** 2026-09-01
**Status:** approved, ready for implementation planning

## 1. What this is

televizio.ge is today a static marketing site: one hand-authored `index.html`, one
`main.js`, one stylesheet, thirteen channel logos. Channels, plan prices and the
plan-sheet channel list are all hardcoded markup, so every content change is a code
change and a redeploy.

This design adds four things on a shared Supabase backend:

1. **A content CMS** at `cms.televizio.ge` — channels and their logos, the logo
   marquee, the pricing cards, and which channels each plan carries.
2. **Subscriber records** — customers and their subscriptions, entered by hand by
   admins, with a manual payment log.
3. **A public lookup page** on televizio.ge where a customer types their subscriber
   number and sees their plan and due date.
4. **A dashboard** over visitor analytics, subscription figures and operational
   warnings.

## 2. Non-goals

- **No online payments.** No card processing, no BOG/TBC gateway. Payments are
  record-keeping rows an admin types in. If online payment is ever wanted it is a
  separate project.
- **No customer accounts.** Customers never sign up, never get a password. The
  lookup page is the entire customer-facing surface.
- **No build step on the public site.** televizio.ge stays a folder of static files
  uploaded as-is. Only the CMS gets a bundler.
- **No retrofitting tests onto the existing site.** New code is tested; `main.js`
  and `style.css` are left as they are.
- **No CMS control over general site copy.** Only channels, the marquee, pricing
  cards and a small set of numeric settings are editable. Headlines, FAQ and the
  rest stay in `index.html`.

## 3. Architecture

Three deployables and one backend.

```
televizio.ge          static folder, no build  ──┐
cms.televizio.ge      cms/dist, Vite build     ──┼──> Supabase (Postgres + Auth
supabase/             migrations + functions   ──┘         + Storage + Edge Functions)
```

Repository layout after this work:

```
index.html                     public site — channel markup removed, now injected
assets/js/main.js              unchanged
assets/js/content.js           NEW  fetch snapshot, render, then boot main.js
assets/data/content.json       NEW  fallback snapshot, committed to git
lookup.html                    NEW  public subscription lookup page
assets/js/lookup.js            NEW  its form logic
cms/                           NEW  Vite + React + TypeScript + Tailwind
supabase/migrations/*.sql      NEW  schema, RLS policies, seed data
supabase/functions/publish/    NEW  build and upload content.json
supabase/functions/lookup/     NEW  subscriber lookup, rate limited
supabase/functions/track/      NEW  analytics ingest
supabase/functions/create-admin/  NEW  owner-only admin provisioning
```

The public site and the CMS share nothing but the Supabase project. The CMS is never
loaded by a visitor; the public site never reads a subscriber table.

## 4. Data model

All tables live in `public`. Every table has `id uuid primary key default gen_random_uuid()`,
`created_at timestamptz not null default now()` and, where edited, `updated_at timestamptz`
maintained by a trigger.

### 4.1 Content

**`categories`** — the plan sheet's filter chips.

| column | type | notes |
|---|---|---|
| `slug` | text unique | `ge`, `news`, `doc`, `kids`, `sport` |
| `name_ka`, `name_en` | text | chip labels |
| `sort_order` | int | |

**`channels`**

| column | type | notes |
|---|---|---|
| `slug` | text unique | |
| `name_ka`, `name_en` | text | |
| `logo_path` | text | object path in the `logos` bucket |
| `logo_w`, `logo_h` | int | intrinsic pixels, captured on upload |
| `sort_order` | int | order in the plan-sheet catalogue |
| `in_slider` | bool | appears in the header marquee |
| `slider_order` | int | order within the marquee |
| `is_active` | bool | inactive channels are excluded from publishes |

**`channel_categories`** — `(channel_id, category_id)`, composite primary key. A
channel can carry several (`data-cat="ge news"` today).

**`plans`**

| column | type | notes |
|---|---|---|
| `slug` | text unique | `basic`, `standard`, `premium` |
| `name_ka`, `name_en` | text | |
| `price` | numeric(10,2) | |
| `currency` | text default `'₾'` | |
| `period_ka`, `period_en` | text | `თვე` / `mo` |
| `badge_ka`, `badge_en` | text null | "Most popular" flag; null means no badge |
| `is_featured` | bool | drives `.plan--featured` and the red CTA |
| `total_label` | text | the `data-total` string — `180+`, `520+`, `1 024` |
| `sort_order` | int | left-to-right card order |
| `is_active` | bool | |

**`plan_features`** — `plan_id`, `text_ka`, `text_en`, `sort_order`. The `<li>`
bullets on each card, reused verbatim as the plan sheet's `.pm__perks`.

**`plan_channels`** — `(plan_id, channel_id)`, composite primary key. Replaces the
space-separated `data-plan` attribute.

**`site_settings`** — `key` text primary key, `value_text`, `value_num`,
`description`. Holds the figures that today are typed into markup: the stat counter
`1 024`, the hero's `1,000+`, the rewind window `14`.

### 4.2 Subscribers

**`subscribers`**

| column | type | notes |
|---|---|---|
| `subscriber_no` | text unique not null | the number the customer types |
| `full_name` | text not null | |
| `phone` | text not null | stored E.164 where possible |
| `phone_last4` | text generated always as `right(regexp_replace(phone,'\D','','g'),4)` stored | the lookup's second factor |
| `email`, `address`, `city`, `notes` | text null | |
| `status` | text check in (`active`,`suspended`,`cancelled`) | |

`subscriber_no` is indexed; `(subscriber_no, phone_last4)` is the lookup's key.

**`subscriptions`**

| column | type | notes |
|---|---|---|
| `subscriber_id` | fk → subscribers | |
| `plan_id` | fk → plans | |
| `started_on`, `due_on` | date not null | |
| `status` | text check in (`active`,`expired`,`cancelled`) | |
| `device_count` | int default 1 | |
| `price_at_signup` | numeric(10,2) | frozen — plan prices change, history should not |
| `notes` | text null | |

A subscriber may have several rows over time; the one with the latest `due_on` and
status `active` is the current one.

**`payments`** — `subscription_id`, `amount`, `currency`, `paid_on` date,
`method` (`cash`/`transfer`/`card`/`other`), `recorded_by` fk → admins, `note`.
Purely a ledger. Nothing computes from a card network.

### 4.3 Analytics

**`page_views`** — `path`, `referrer_host`, `country`, `device_type`
(`desktop`/`mobile`/`tablet`), `lang`, `session_id` text, `created_at`.

**`events`** — `name` text, `props` jsonb, `session_id`, `created_at`. Named events:
`plan_cta_click`, `plan_sheet_open`, `lang_switch`, `lookup_success`, `lookup_fail`.

**`lookup_attempts`** — `subscriber_no_attempted`, `ip_hash`, `success` bool,
`created_at`. Feeds both the rate limiter and the abuse warning.

`session_id` is `sha256(ip + user_agent + daily_salt)`, computed inside the `track`
function. No cookie is set, no raw IP is ever stored, and the identifier stops
correlating at midnight. This keeps the analytics out of GDPR consent territory.

### 4.4 Admin

**`admins`** — `id uuid primary key references auth.users(id) on delete cascade`,
`email`, `name`, `role` check in (`owner`,`editor`,`support`).

- `owner` — everything, including creating other admins.
- `editor` — content and publishing, read-only on subscribers.
- `support` — subscribers and payments, read-only on content.

**`audit_log`** — `admin_id`, `action` (`create`/`update`/`delete`/`publish`),
`entity`, `entity_id`, `diff` jsonb, `created_at`. Written by triggers on the
content and subscriber tables.

**`publications`** — `published_at`, `published_by`, `snapshot_hash`,
`channel_count`, `plan_count`. The publish history, and the reference point for
"there are unpublished changes".

### 4.5 Storage

- **`logos`** — public bucket, channel artwork. Path convention
  `channels/<slug>-<timestamp>.<ext>`; the timestamp busts the CDN on re-upload.
- **`site`** — public bucket, holds exactly one live object: `content.json`.

## 5. Security

### 5.1 Row level security

RLS is enabled on every table with no exceptions. The default is deny.

Policies are role-aware, so the roles in §4.4 are enforced by the database rather
than only by the interface. Two helper functions keep the predicates readable:
`is_admin()` returns whether `auth.uid()` appears in `admins`, and `admin_role()`
returns that row's role.

- **Content tables** (`channels`, `plans`, `categories`, join tables,
  `site_settings`) — `select` for any admin; `insert`/`update`/`delete` only where
  `admin_role() in ('owner','editor')`. Anon has no access at all; the public site
  reads the published JSON from Storage instead, never the tables.
- **`subscribers`, `subscriptions`, `payments`** — `select` for any admin;
  `insert`/`update`/`delete` only where `admin_role() in ('owner','support')`. Anon
  is denied outright, so a leaked anon key exposes no customer data. The lookup
  function reaches these with the service key from inside an edge function, never
  from a browser.
- **Analytics tables** — no direct anon access. Writes arrive only through the
  `track` function using the service key. Admins may read.
- **`admins`** — readable by any admin; writable only by `owner`, and in practice
  only through the `create-admin` function.
- **`audit_log`** — insert by trigger, select by admin, no update or delete.

### 5.2 Authentication

Supabase Auth, email plus password. **Public signup is disabled in project
settings.** An owner creates an admin through the `create-admin` edge function,
which uses the service key to create the auth user and the matching `admins` row in
one transaction, and sends the invite email. There is no path for a stranger to
obtain an admin session.

### 5.3 The lookup, specifically

This is the one place customer data leaves the database toward an unauthenticated
caller, so it is worth stating the rules explicitly:

- It is an edge function. The browser never queries a table.
- Input is `{ subscriber_no, phone_last4 }`. Both are required.
- **Rate limit:** 5 failed attempts per `ip_hash` per 10 minutes, counted from
  `lookup_attempts`. On breach it returns 429 without touching the subscriber table.
- **Uniform failure:** an unknown number and a known number with the wrong last-4
  return byte-identical responses. The form cannot be used to learn which numbers
  exist.
- **Minimal response.** On success it returns only
  `{ plan_name_ka, plan_name_en, status, started_on, due_on, days_left, device_count }`.
  Never the phone, address, email, notes, price, or internal ids.
- Every attempt, successful or not, is logged.

## 6. Edge functions

| function | auth | input | output |
|---|---|---|---|
| `publish` | admin JWT, role `owner` or `editor` | — | `{ published_at, channel_count, plan_count, hash }` |
| `lookup` | anon | `{ subscriber_no, phone_last4 }` | subscription summary, or uniform 404, or 429 |
| `track` | anon | `{ path, referrer, lang, screen_w, event?, props? }` | 204 |
| `create-admin` | admin JWT, role `owner` | `{ email, name, role }` | `{ id }` |

`track` derives country and device type from request headers and computes
`session_id` server-side. The client sends no identifier of its own.

## 7. The publish pipeline

Editing in the CMS changes the database. **The live site changes only when an admin
presses Publish.** This is deliberate: it means a half-finished edit is never
visible, and it gives a clean rollback point.

Publish assembles one document and writes it to `site/content.json`:

```json
{
  "version": 1,
  "published_at": "2026-09-01T12:00:00Z",
  "settings": { "channel_count": 1024, "channel_count_label": "1 024", "rewind_days": 14 },
  "categories": [
    { "slug": "ge", "name_ka": "ქართული", "name_en": "Georgian", "sort": 1 }
  ],
  "channels": [
    {
      "slug": "1tv",
      "name_ka": "პირველი არხი",
      "name_en": "First Channel",
      "logo": "https://<proj>.supabase.co/storage/v1/object/public/logos/channels/1tv-1756...svg",
      "w": 465, "h": 465,
      "cats": ["ge"],
      "plans": ["basic", "standard", "premium"],
      "in_slider": true, "slider_order": 4,
      "sort": 1
    }
  ],
  "plans": [
    {
      "slug": "standard",
      "name_ka": "სტანდარტული", "name_en": "Standard",
      "price": 29, "currency": "₾",
      "period_ka": "თვე", "period_en": "mo",
      "featured": true,
      "badge_ka": "ყველაზე პოპულარული", "badge_en": "Most popular",
      "total_label": "520+",
      "features": [ { "ka": "520+ არხი", "en": "520+ channels" } ]
    }
  ]
}
```

Plan membership is denormalised onto each channel as a `plans` array, because that
is the shape the DOM wants (`data-plan="basic standard premium"`), even though the
database stores it as a join table.

Only `is_active` rows are included. The function refuses to publish if an active
channel has no `logo_path` or an active plan has no channels, and names the offending
rows in its error — a broken publish is worse than a blocked one. These are the same
two conditions the dashboard raises as content warnings (§10.1), so the warning
panel is an early view of what would block a publish, not a separate rule set.

## 8. Public site integration

### 8.1 The constraint

`main.js` is a single IIFE of self-invoking modules that read the DOM at
script-execution time. `planSheet()` at `assets/js/main.js:874` snapshots
`#pmCatalogue`'s `.chan` figures and every `.plan[data-plan]` card the moment it
runs, and returns early if it finds none. The counters module reads `data-count`
the same way. **Content must therefore be in the DOM before `main.js` executes.**

### 8.2 The boot sequence

`index.html` drops its three blocks of hardcoded channel markup and its
`<script src="assets/js/main.js">` tag, and gains `<script src="assets/js/content.js">`.
`content.js` then:

1. fetches `site/content.json` from the Supabase CDN with a hard **1500 ms** timeout;
2. on timeout, network error or malformed JSON, falls back to
   `assets/data/content.json`, committed in the repo — so the site renders exactly
   today's content even with Supabase entirely down;
3. renders three regions from whichever snapshot it got:
   - both `.scan__set` copies of the header marquee (the second stays `aria-hidden`),
   - the `.plans` pricing cards, including features, badge, featured modifier,
     `data-plan` and `data-total`,
   - the `#pmCatalogue` template's `.chan` figures with their `data-cat` and
     `data-plan` attributes;
4. appends `main.js` to the document, which then initialises against a complete DOM.

`main.js` needs no structural change whatsoever. That is the reason for ordering it
this way rather than exporting an init hook. The brief boot delay is covered by the
loading hold the site already has.

Every rendered `<img>` carries its `width` and `height` from the snapshot, because
the marquee's layout depends on intrinsic dimensions and would reflow without them.

### 8.3 Analytics beacon

A short block in `content.js` posts one `track` call per page load, and binds
`plan_cta_click`, `plan_sheet_open` and `lang_switch`. It uses `sendBeacon` where
available, fails silently, and is skipped entirely under Do Not Track.

## 9. The lookup page

`lookup.html`, a sibling of `index.html`, reusing `style.css` and the site's
bilingual `.ka`/`.en` span convention and language toggle. Two fields — subscriber
number and last four digits of the phone on the account — one button, one result
card showing plan, status, start date, due date, days remaining and device count.
Overdue and near-due states are coloured. Errors are one message for every failure
mode; the 429 gets its own "try again in a few minutes".

Linked from the site header and footer.

## 10. The CMS

React + TypeScript + Tailwind on Vite, with react-router, TanStack Query,
supabase-js and Recharts. **The admin interface is in English**; every content field
it edits is bilingual ka/en.

| route | what it does |
|---|---|
| `/login` | email + password; no signup link |
| `/` | dashboard — see below |
| `/channels` | table with search and category filter; drawer editor; drag to reorder; drop a file to upload a logo |
| `/slider` | the marquee's membership and order, on its own, since it is a curated subset |
| `/plans` | card editor — price, bilingual name and features, badge, featured flag, `total_label`, and a checkbox grid assigning channels |
| `/subscribers` | table, search by number, name or phone; row → detail |
| `/subscribers/new` | create a subscriber and their first subscription in one form |
| `/subscribers/:id` | profile, subscription history, payment ledger, renew action |
| `/analytics` | pageviews over time, top paths, referrers, device split, language split, plan CTA clicks, lookup volume |
| `/settings` | admins, publish history, site settings |

A **Publish** control sits in the app shell at all times, showing the count of
unpublished changes and the time of the last publish.

Logo upload captures intrinsic dimensions in the browser before upload and stores
them alongside the path, so the marquee never reflows.

### 10.1 The warnings panel

The dashboard's warnings panel carries four families, each a query:

1. **Expiring** — active subscriptions with `due_on` inside 7 days, and inside 30
   days, as two counts.
2. **Overdue and unpaid** — active subscriptions with `due_on` in the past, split by
   whether the current period has been paid. A period counts as paid when a
   `payments` row exists for that subscription with `paid_on >= ` the period's start,
   where the period's start is the later of `started_on` and the previous `due_on`.
   Overdue-and-unpaid is the urgent half; overdue-but-paid usually means someone
   forgot to push the due date forward.
3. **Suspicious lookups** — `ip_hash` values with 10 or more failed
   `lookup_attempts` in 24 hours.
4. **Content problems** — an active channel with no logo, an active plan with no
   channels, and content rows whose `updated_at` is newer than the last
   `publications.published_at`.

Each is a link into the list it describes, not a dead number.

## 11. Testing

The existing site has no test framework and does not get one. New code does.

**Vitest, in `cms/`:**
- the snapshot builder — given fixture rows, produces the exact `content.json` shape
- warning calculators — boundary dates around 7 and 30 days, overdue with and
  without payments, timezone edges
- subscription date maths — renewal from `due_on` not from today
- form validation for subscriber numbers and phones

**Vitest with jsdom, for the public site:**
- `content.js` renders the committed fallback snapshot into markup carrying every
  attribute `main.js` reads: `.chan[data-cat][data-plan]` inside `#pmCatalogue`,
  `.plan[data-plan][data-total]`, and two `.scan__set` copies
- the 1500 ms timeout falls back rather than rendering an empty page

**Deno tests, for the edge functions:**
- `lookup` returns identical bytes for an unknown number and a wrong last-4
- `lookup` returns 429 after 5 failures from one `ip_hash`
- `lookup`'s success payload contains no phone, address, email or notes
- `publish` refuses a channel with no logo and names it
- anon, holding only the anon key, cannot select from `subscribers` — the RLS proof

## 12. Deployment and configuration

- **televizio.ge** — the folder, uploaded as today. Adds `lookup.html`,
  `assets/js/content.js`, `assets/js/lookup.js`, `assets/data/content.json`.
- **cms.televizio.ge** — a second static site from `cms/dist`, built by
  `npm run build` in `cms/`. DNS: a CNAME for `cms`.
- **Supabase** — migrations applied from `supabase/migrations` in order. Setup
  covers creating the project, both Storage buckets, disabling public signup, and
  bootstrapping the first `owner` admin.

Configuration is the project URL and anon key, which are public by design. They are
inlined in the public site's JS and set as Vite env vars for the CMS. **The service
key never leaves the edge functions' environment.**

Migrations are delivered as SQL files to run yourself. Nothing in this work reaches
into a live database directly.

## 13. Build sequence

One implementation run, in this order, because each stage depends on the one before:

1. Supabase project, schema, RLS, seed from today's hardcoded content
2. CMS shell — auth, layout, routing, admin provisioning
3. Channels, slider, plans editors, logo upload
4. `publish` function and `content.json` contract
5. Public site rewiring — `content.js`, fallback snapshot, `index.html` edits
6. Subscribers, subscriptions, payments
7. `lookup` function and `lookup.html`
8. `track` function, the site beacon, analytics screens
9. Dashboard and warnings

## 14. Assumptions

Stated because they were decided rather than asked, and are cheap to change now and
expensive later:

- Admin chrome is English. Content fields are bilingual.
- Subscriber numbers are assigned by the admin, not generated. The CMS warns on
  duplicates but imposes no format.
- Renewal extends `due_on` by the plan's period from the previous `due_on`, not from
  the date the payment was entered.
- The thirteen existing logos are migrated into the `logos` bucket as-is with their
  current dimensions. The per-logo adaptation for black backgrounds documented in
  `assets/img/channels/README.md` remains a manual design job.
- Analytics retention is not capped in this design. If the tables grow
  uncomfortably, a scheduled aggregation is a later change.
