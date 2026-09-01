# CMS Foundation and Content Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Supabase backend and a working admin CMS at cms.televizio.ge that manages channels, the logo marquee and the pricing cards, and publishes them as a `content.json` snapshot.

**Architecture:** Postgres with row-level security on every table, admin-only. A React admin app talks to it with `supabase-js` under a logged-in admin's JWT. Pressing Publish calls an edge function that assembles one JSON document and writes it to a public Storage bucket. Nothing in this plan touches the live public site — that is Plan 2.

**Tech Stack:** Supabase (Postgres 15, Auth, Storage, Deno edge functions), pgTAP for database tests, Vite + React 19 + TypeScript + Tailwind 4, react-router 7, TanStack Query 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-cms-televizio-design.md`

## Global Constraints

- The public site stays a folder of static files. Nothing in this plan modifies `index.html`, `assets/js/main.js` or `assets/css/style.css`.
- Every content field that a visitor reads exists in both languages: `*_ka` and `*_en`.
- RLS is enabled on every table created. There are no exceptions and no `using (true)` policies.
- The service role key never appears in `cms/` or in any file served to a browser. It exists only in edge function environment variables.
- Admin roles are `owner`, `editor`, `support`. Content writes require `owner` or `editor`. Subscriber writes require `owner` or `support`.
- Channel slugs, plan slugs and category slugs are lowercase ASCII, matching the values already in `index.html` (`1tv`, `imedi`, `basic`, `ge`, …).
- Migration files are named `supabase/migrations/<UTC timestamp>_<name>.sql` and are never edited after being committed — corrections go in a new migration.
- Every task ends with a commit. Commit messages are written in the imperative and describe the change, matching the existing log style.

## Amendment — hosted Supabase, no local stack

*Added 2026-09-01, after Docker proved unavailable on this machine and the decision
was taken to work against a hosted project directly.*

There is **one** Supabase project, and it is the real one. Every command below runs
against live infrastructure, which changes three things:

**`supabase db reset` is forbidden.** It drops the database. It appears nowhere in
this plan any more; where a task said to reset and re-apply, push the new migration
instead.

**Command mapping** — wherever a task says the left, do the right:

| The plan says | Do this instead |
|---|---|
| `npx supabase start` | nothing — the project is already up |
| `npx supabase db reset` | `npm run db:push` (applies un-applied migrations only) |
| `npx supabase test db` | `npm run db:test` (pgTAP over a plain connection) |
| `npx supabase functions serve` | `npx supabase functions deploy <name> --use-api` |
| `http://127.0.0.1:54321` | `$SUPABASE_URL` from `.env` |
| invite mail at `:54324` | the real inbox — invites are actually sent |

**pgTAP without the CLI.** `supabase test db` needs Docker. `supabase/tests/run.mjs`
replaces it: it connects with `pg`, runs each `*.test.sql` in a transaction and rolls
back, so a suite leaves nothing behind. Suites must therefore keep their
`begin; … rollback;` wrapper — that wrapper is now the only thing standing between a
test and your production data.

**Integration tests mutate the live database.** The publish suite creates
`editor@televizio.ge` and briefly nulls a channel's logo. Each test restores what it
changed. Run them before there are real subscribers, and never against a project
you would mind seeing a test admin in.

**Credentials** live in `.env` at the repo root, gitignored, filled from
`.env.example`. The service role key and the database password are in there; nothing
reads them but the CLI, the test runner and the deploy step, and none of the three
prints them.

---

## File Structure

```
supabase/config.toml                          Supabase CLI project config
supabase/migrations/*.sql                     schema, RLS, seed — applied in order
supabase/tests/*.test.sql                     pgTAP tests, run by `supabase test db`
supabase/functions/_shared/types.ts           shared row + snapshot types
supabase/functions/_shared/snapshot.ts        pure snapshot builder + validator
supabase/functions/_shared/auth.ts            JWT → admin role resolution
supabase/functions/publish/index.ts           the Publish endpoint
supabase/functions/create-admin/index.ts      owner-only admin provisioning
supabase/seed/upload-logos.mjs                one-off: local logos → Storage
supabase/README.md                            setup guide

package.json                                  root: npm workspaces + Vitest
vitest.config.ts                              one test runner for the whole repo
tsconfig.json                                 base TS config

tests/shared/snapshot.test.ts                 snapshot builder unit tests
tests/shared/validate.test.ts                 publish-blocker unit tests
tests/functions/publish.test.ts               HTTP integration against local stack

cms/package.json, vite.config.ts, tailwind.config.js, index.html
cms/src/main.tsx                              entry
cms/src/App.tsx                               router
cms/src/lib/supabase.ts                       client singleton
cms/src/lib/queries.ts                        TanStack Query hooks
cms/src/auth/AuthProvider.tsx                 session + admin row + role
cms/src/auth/guard.ts                         pure route-permission logic
cms/src/components/Shell.tsx                  nav + Publish control
cms/src/pages/Login.tsx
cms/src/pages/Channels.tsx
cms/src/pages/ChannelDrawer.tsx
cms/src/pages/Slider.tsx
cms/src/pages/Plans.tsx
cms/src/pages/Settings.tsx
cms/src/lib/image.ts                          intrinsic-dimension capture
```

Files split by responsibility rather than layer: a page owns its own queries and its own form. `_shared/` holds the only logic two runtimes both need, which is why it is pure TypeScript with no imports.

---

## Task 1: Supabase project and the content schema

**Files:**
- Create: `supabase/config.toml` (generated), `supabase/.gitignore` (generated)
- Create: `supabase/migrations/20260901000001_content.sql`
- Create: `supabase/tests/content_schema.test.sql`
- Create: `supabase/README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: tables `categories`, `channels`, `channel_categories`, `plans`, `plan_features`, `plan_channels`, `site_settings`; trigger function `set_updated_at()`

- [ ] **Step 1: Install the Supabase CLI and initialise**

Docker Desktop must be running — the local stack needs it.

```bash
npm install --save-dev supabase
npx supabase init
```

Answer "n" to generating VS Code settings and Deno settings.

- [ ] **Step 2: Ignore local Supabase artifacts**

Append to `.gitignore`:

```
node_modules/
supabase/.branches
supabase/.temp
.env
.env.local
```

- [ ] **Step 3: Write the failing schema test**

Create `supabase/tests/content_schema.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'categories', 'categories exists');
select has_table('public', 'channels', 'channels exists');
select has_table('public', 'channel_categories', 'channel_categories exists');
select has_table('public', 'plans', 'plans exists');
select has_table('public', 'plan_features', 'plan_features exists');
select has_table('public', 'plan_channels', 'plan_channels exists');
select has_table('public', 'site_settings', 'site_settings exists');

select col_is_pk('public', 'channel_categories', array['channel_id','category_id'],
  'channel_categories is keyed on the pair');
select col_is_pk('public', 'plan_channels', array['plan_id','channel_id'],
  'plan_channels is keyed on the pair');
select col_is_unique('public', 'channels', 'slug', 'channel slugs are unique');
select col_is_unique('public', 'plans', 'slug', 'plan slugs are unique');
select col_has_default('public', 'channels', 'is_active', 'channels default to active');

select col_not_null('public', 'plans', 'is_featured', 'is_featured is never null');

select lives_ok(
  $$ insert into categories (slug, name_ka, name_en, sort_order)
     values ('tmp', 'დროებითი', 'Temp', 99) $$,
  'a category can be inserted');

select * from finish();
rollback;
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npx supabase start
npx supabase test db
```

Expected: FAIL — `relation "public.categories" does not exist`.

- [ ] **Step 5: Write the migration**

Create `supabase/migrations/20260901000001_content.sql`:

```sql
-- Content the CMS owns: the channels, the plans, and the numbers on the page.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_ka     text not null,
  name_en     text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.channels (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name_ka      text not null,
  name_en      text not null,
  logo_path    text,
  logo_w       int,
  logo_h       int,
  sort_order   int  not null default 0,
  in_slider    boolean not null default false,
  slider_order int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A channel carries several categories; the first by sort_order is the one
-- printed on its card as .chan__tag, so the order is meaningful.
create table public.channel_categories (
  channel_id  uuid not null references public.channels(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  sort_order  int  not null default 0,
  primary key (channel_id, category_id)
);

create table public.plans (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name_ka      text not null,
  name_en      text not null,
  price        numeric(10,2) not null,
  currency     text not null default '₾',
  period_ka    text not null default 'თვე',
  period_en    text not null default 'mo',
  badge_ka     text,
  badge_en     text,
  is_featured  boolean not null default false,
  total_label  text not null default '',
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.plan_features (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.plans(id) on delete cascade,
  text_ka    text not null,
  text_en    text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create table public.plan_channels (
  plan_id    uuid not null references public.plans(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  primary key (plan_id, channel_id)
);

create table public.site_settings (
  key         text primary key,
  value_text  text,
  value_num   numeric,
  description text not null default '',
  updated_at  timestamptz not null default now()
);

create index channels_sort_idx  on public.channels (sort_order);
create index channels_slider_idx on public.channels (slider_order) where in_slider;
create index plan_features_plan_idx on public.plan_features (plan_id, sort_order);

create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();
create trigger channels_updated before update on public.channels
  for each row execute function public.set_updated_at();
create trigger plans_updated before update on public.plans
  for each row execute function public.set_updated_at();
create trigger site_settings_updated before update on public.site_settings
  for each row execute function public.set_updated_at();
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: PASS, 14 tests.

- [ ] **Step 7: Write the setup guide**

Create `supabase/README.md`:

```markdown
# Supabase backend

The CMS, the subscriber records and the site's published content all live in one
Supabase project.

## Local development

Docker Desktop must be running.

```bash
npx supabase start      # boots Postgres, Auth, Storage, the function runtime
npx supabase db reset   # drops and re-applies every migration, then the seed
npx supabase test db    # runs the pgTAP tests in supabase/tests
npx supabase stop
```

`supabase start` prints the local API URL, anon key and service role key. The anon
key is safe to commit; the service role key is not.

## Creating the hosted project

1. Create a project at supabase.com. Region: Frankfurt (`eu-central-1`) — closest to
   Georgia of the EU regions, and it keeps subscriber data in the EU.
2. Authentication → Providers → Email: turn **Enable signup off**. Admins are
   created through the `create-admin` function, never by self-registration.
3. Link and push:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## Migrations

Files in `migrations/` run in filename order and are never edited once committed.
A correction is a new migration.
```

- [ ] **Step 8: Commit**

```bash
git add .gitignore package.json package-lock.json supabase/
git commit -m "Give the content its tables"
```

---

## Task 2: Admins, audit trail and publication history

**Files:**
- Create: `supabase/migrations/20260901000002_admin.sql`
- Create: `supabase/tests/admin_schema.test.sql`

**Interfaces:**
- Consumes: Task 1's tables
- Produces: tables `admins`, `audit_log`, `publications`; functions `public.is_admin() → boolean`, `public.admin_role() → text`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/admin_schema.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_table('public', 'admins', 'admins exists');
select has_table('public', 'audit_log', 'audit_log exists');
select has_table('public', 'publications', 'publications exists');
select has_function('public', 'is_admin', 'is_admin() exists');
select has_function('public', 'admin_role', 'admin_role() exists');
select has_function('public', 'log_audit', 'log_audit() exists');
select has_trigger('public', 'channels', 'channels_audit',
  'channel edits are recorded');

-- With no JWT there is no admin and no role.
set local role postgres;
select is(public.is_admin(), false, 'no session is not an admin');
select is(public.admin_role(), null, 'no session has no role');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.admins" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260901000002_admin.sql`:

```sql
-- Who may use the CMS, and a record of what they did.

create table public.admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text not null,
  role       text not null default 'editor'
             check (role in ('owner', 'editor', 'support')),
  created_at timestamptz not null default now()
);

-- security definer so the policies can consult admins without recursing
-- through the policy on admins itself.
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

create or replace function public.admin_role()
returns text language sql stable security definer
set search_path = public as $$
  select role from public.admins where id = auth.uid();
$$;

create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references public.admins(id) on delete set null,
  action     text not null check (action in ('create','update','delete','publish')),
  entity     text not null,
  entity_id  text,
  diff       jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_recent_idx on public.audit_log (created_at desc);

create table public.publications (
  id            uuid primary key default gen_random_uuid(),
  published_at  timestamptz not null default now(),
  published_by  uuid references public.admins(id) on delete set null,
  snapshot_hash text not null,
  channel_count int  not null,
  plan_count    int  not null
);

create index publications_recent_idx on public.publications (published_at desc);

-- Every content edit writes its own audit row, so the trail does not depend
-- on the CMS remembering to log. auth.uid() is null for the service key,
-- which is how a publish or a seed is told apart from a person.
create or replace function public.log_audit()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  row_id text;
begin
  row_id := coalesce(
    (to_jsonb(coalesce(new, old)) ->> 'id'),
    (to_jsonb(coalesce(new, old)) ->> 'key'));

  insert into public.audit_log (admin_id, action, entity, entity_id, diff)
  values (
    auth.uid(),
    case tg_op when 'INSERT' then 'create'
               when 'UPDATE' then 'update'
               else 'delete' end,
    tg_table_name,
    row_id,
    case tg_op when 'DELETE' then to_jsonb(old) else to_jsonb(new) end);

  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['channels','plans','plan_features','categories',
                           'site_settings']
  loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.log_audit()', t, t);
  end loop;
end $$;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx supabase db reset && npx supabase test db
```

Expected: PASS, 23 tests total across both files.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "Say who may edit, and keep a record of what they changed"
```

---

## Task 3: Row-level security

This is the task that decides whether a leaked anon key matters. Its tests are the proof.

**Files:**
- Create: `supabase/migrations/20260901000003_rls.sql`
- Create: `supabase/tests/rls.test.sql`

**Interfaces:**
- Consumes: `is_admin()`, `admin_role()` from Task 2
- Produces: RLS enabled with policies on every table from Tasks 1 and 2

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/rls.test.sql`. `set local request.jwt.claims` is how a pgTAP test impersonates a signed-in user, because `auth.uid()` reads it.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- two admins to impersonate
insert into auth.users (id, email, instance_id, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'editor@televizio.ge',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
       ('22222222-2222-2222-2222-222222222222', 'support@televizio.ge',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into public.admins (id, email, name, role) values
  ('11111111-1111-1111-1111-111111111111', 'editor@televizio.ge',  'Editor',  'editor'),
  ('22222222-2222-2222-2222-222222222222', 'support@televizio.ge', 'Support', 'support');

insert into public.categories (slug, name_ka, name_en, sort_order)
values ('rlsge', 'ქართული', 'Georgian', 1);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.channels'::regclass),
  'RLS is on for channels');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.admins'::regclass),
  'RLS is on for admins');

-- ── anon sees nothing ──────────────────────────────────────────────
set local role anon;
select is_empty($$ select 1 from public.channels $$,
  'anon reads no channels');
select is_empty($$ select 1 from public.categories $$,
  'anon reads no categories');
select throws_ok($$ insert into public.channels (slug, name_ka, name_en)
                    values ('hack', 'x', 'x') $$,
  '42501', null, 'anon cannot insert a channel');
reset role;

-- ── editor writes content ──────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$ insert into public.channels (slug, name_ka, name_en)
                   values ('editorch', 'რედაქტორი', 'Editor Ch') $$,
  'an editor may create a channel');
select isnt_empty($$ select 1 from public.channels $$,
  'an editor may read channels');

-- ── support may read content but not write it ──────────────────────
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select isnt_empty($$ select 1 from public.channels $$,
  'support may read channels');
select throws_ok($$ insert into public.channels (slug, name_ka, name_en)
                    values ('supportch', 'x', 'x') $$,
  '42501', null, 'support may not create a channel');
select throws_ok($$ update public.plans set price = 1 $$,
  '42501', null, 'support may not reprice a plan');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx supabase test db
```

Expected: FAIL — RLS is off, so `anon reads no channels` fails and the `throws_ok` assertions find no error.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260901000003_rls.sql`:

```sql
-- Deny by default, everywhere. The public site never reads these tables;
-- it reads the published snapshot out of Storage instead.

alter table public.categories         enable row level security;
alter table public.channels           enable row level security;
alter table public.channel_categories enable row level security;
alter table public.plans              enable row level security;
alter table public.plan_features      enable row level security;
alter table public.plan_channels      enable row level security;
alter table public.site_settings      enable row level security;
alter table public.admins             enable row level security;
alter table public.audit_log          enable row level security;
alter table public.publications       enable row level security;

-- Content: any admin reads; owner and editor write.
do $$
declare t text;
begin
  foreach t in array array['categories','channels','channel_categories',
                           'plans','plan_features','plan_channels','site_settings']
  loop
    execute format(
      'create policy %I_read on public.%I for select using (public.is_admin())',
      t, t);
    execute format(
      'create policy %I_write on public.%I for all
         using (public.admin_role() in (''owner'',''editor''))
         with check (public.admin_role() in (''owner'',''editor''))',
      t, t);
  end loop;
end $$;

-- Admins: every admin sees the roster; only an owner changes it.
create policy admins_read on public.admins
  for select using (public.is_admin());
create policy admins_write on public.admins
  for all using (public.admin_role() = 'owner')
          with check (public.admin_role() = 'owner');

-- Audit log: append-only from the application's point of view.
create policy audit_read on public.audit_log
  for select using (public.is_admin());
create policy audit_insert on public.audit_log
  for insert with check (public.is_admin());

-- Publications: any admin reads; the publish function writes with the
-- service key, which bypasses RLS.
create policy publications_read on public.publications
  for select using (public.is_admin());
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx supabase db reset && npx supabase test db
```

Expected: PASS, all three files green.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "Lock every table behind row-level security"
```

---

## Task 4: Storage buckets

**Files:**
- Create: `supabase/migrations/20260901000004_storage.sql`
- Create: `supabase/tests/storage.test.sql`

**Interfaces:**
- Consumes: `is_admin()`, `admin_role()`
- Produces: public buckets `logos` and `site`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/storage.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is((select public from storage.buckets where id = 'logos'), true,
  'the logos bucket is public');
select is((select public from storage.buckets where id = 'site'), true,
  'the site bucket is public');
select isnt_empty(
  $$ select 1 from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname='logos_admin_write' $$,
  'admins may write logos');
select isnt_empty(
  $$ select 1 from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname='logos_public_read' $$,
  'anyone may read logos');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx supabase test db
```

Expected: FAIL — no rows in `storage.buckets`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260901000004_storage.sql`:

```sql
-- Two public buckets: the channel artwork, and the one JSON document the
-- site reads. Public read is the point — these are served over the CDN.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', true, 2097152,
   array['image/png','image/svg+xml','image/webp','image/jpeg']),
  ('site',  'site',  true, 5242880,
   array['application/json'])
on conflict (id) do nothing;

create policy logos_public_read on storage.objects
  for select using (bucket_id = 'logos');

create policy logos_admin_write on storage.objects
  for all using (bucket_id = 'logos'
                 and public.admin_role() in ('owner','editor'))
      with check (bucket_id = 'logos'
                 and public.admin_role() in ('owner','editor'));

create policy site_public_read on storage.objects
  for select using (bucket_id = 'site');
-- Nothing may write to `site` from a browser. The publish function writes it
-- with the service key, which bypasses these policies.
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx supabase db reset && npx supabase test db
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "Open two buckets: one for artwork, one for the snapshot"
```

---

## Task 5: Seed today's content

The seed reproduces exactly what `index.html` shows today, so that Plan 2's swap is invisible to a visitor.

**Files:**
- Create: `supabase/migrations/20260901000005_seed.sql`
- Create: `supabase/tests/seed.test.sql`
- Create: `supabase/seed/upload-logos.mjs`

**Interfaces:**
- Consumes: every content table
- Produces: 5 categories, 13 channels, 3 plans, 14 plan features, 30 plan_channels rows, 4 settings

**Reference — read from `index.html` before writing:** channel names and dimensions come from the `#pmCatalogue` template (lines 609–675); marquee order comes from the first `.scan__set` (line 147); plan copy comes from `.plans` (lines 402–450).

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/seed.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select is((select count(*)::int from public.categories), 5, 'five categories');
select is((select count(*)::int from public.channels), 13, 'thirteen channels');
select is((select count(*)::int from public.plans), 3, 'three plans');
select is((select count(*)::int from public.plan_channels), 30,
  'thirty plan-channel pairs');

select is(
  (select count(*)::int from public.plan_channels pc
   join public.plans p on p.id = pc.plan_id where p.slug = 'basic'),
  6, 'basic carries six channels');
select is(
  (select count(*)::int from public.plan_channels pc
   join public.plans p on p.id = pc.plan_id where p.slug = 'standard'),
  11, 'standard carries eleven channels');
select is(
  (select count(*)::int from public.plan_channels pc
   join public.plans p on p.id = pc.plan_id where p.slug = 'premium'),
  13, 'premium carries every channel');

select is((select count(*)::int from public.channels where in_slider), 13,
  'every channel is in the marquee');
select is((select logo_w from public.channels where slug = 'euronews'), 2106,
  'euronews keeps its intrinsic width');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx supabase test db
```

Expected: FAIL — every count is 0.

- [ ] **Step 3: Write the seed migration**

Create `supabase/migrations/20260901000005_seed.sql`.

Note `euronews`, `cnn`, `bbc`, `discovery`, `natgeo`, `cartoon`, `nickelodeon` and
`setanta` carry the same string in both languages — that is deliberate, and it is
how the renderer knows to print a bare name instead of two `.ka`/`.en` spans.

```sql
insert into public.categories (slug, name_ka, name_en, sort_order) values
  ('ge',    'ქართული',       'Georgian',    1),
  ('news',  'ახალი ამბები',  'News',        2),
  ('sport', 'სპორტი',        'Sport',       3),
  ('doc',   'დოკუმენტური',   'Documentary', 4),
  ('kids',  'საბავშვო',      'Kids',        5);

insert into public.channels
  (slug, name_ka, name_en, logo_path, logo_w, logo_h, sort_order, in_slider, slider_order) values
  ('1tv',         'პირველი არხი',        'First Channel',        'channels/1tv.svg',          465,  465,  1, true,  4),
  ('imedi',       'იმედი',               'Imedi',                'channels/imedi.png',        138,  120,  2, true,  1),
  ('rustavi2',    'რუსთავი 2',           'Rustavi 2',            'channels/rustavi2.png',     129,  120,  3, true,  2),
  ('formula',     'ფორმულა',             'Formula',              'channels/formula.png',       65,  120,  4, true,  6),
  ('palitranews', 'პალიტრანიუსი',        'Palitra News',         'channels/palitranews.png',  267,  120,  5, true,  8),
  ('euronews',    'Euronews',            'Euronews',             'channels/euronews.svg',    2106,  250,  6, true, 12),
  ('cnn',         'CNN',                 'CNN',                  'channels/cnn.png',          258,  120,  7, true,  5),
  ('bbc',         'BBC News',            'BBC News',             'channels/bbc.svg',          560,  160,  8, true, 13),
  ('discovery',   'Discovery',           'Discovery',            'channels/discovery.png',    579,  120,  9, true,  3),
  ('natgeo',      'National Geographic', 'National Geographic',  'channels/natgeo.svg',      1000,  294, 10, true,  7),
  ('cartoon',     'Cartoon Network',     'Cartoon Network',      'channels/cartoon.png',      200,  120, 11, true,  9),
  ('nickelodeon', 'Nickelodeon',         'Nickelodeon',          'channels/nickelodeon.png',  830,  120, 12, true, 11),
  ('setanta',     'Setanta Sports',      'Setanta Sports',       'channels/setanta.png',      426,  120, 13, true, 10);

-- sort_order 0 is the category printed on the card as .chan__tag
insert into public.channel_categories (channel_id, category_id, sort_order)
select c.id, k.id, v.ord
from (values
  ('1tv','ge',0), ('imedi','ge',0), ('rustavi2','ge',0),
  ('formula','ge',0), ('formula','news',1),
  ('palitranews','ge',0), ('palitranews','news',1),
  ('euronews','news',0), ('cnn','news',0), ('bbc','news',0),
  ('discovery','doc',0), ('natgeo','doc',0),
  ('cartoon','kids',0), ('nickelodeon','kids',0),
  ('setanta','sport',0)
) as v(ch, cat, ord)
join public.channels   c on c.slug = v.ch
join public.categories k on k.slug = v.cat;

insert into public.plans
  (slug, name_ka, name_en, price, badge_ka, badge_en, is_featured, total_label, sort_order) values
  ('basic',    'საბაზისო',      'Basic',    19, null, null, false, '180+',  1),
  ('standard', 'სტანდარტული',   'Standard', 29,
     'ყველაზე პოპულარული', 'Most popular', true, '520+',  2),
  ('premium',  'პრემიუმი',      'Premium',  45, null, null, false, '1 024', 3);

insert into public.plan_features (plan_id, text_ka, text_en, sort_order)
select p.id, v.ka, v.en, v.ord
from (values
  ('basic',    '180+ არხი',              '180+ channels',       1),
  ('basic',    'HD ხარისხი',             'HD quality',          2),
  ('basic',    '1 მოწყობილობა',          '1 device',            3),
  ('basic',    '3 დღიანი არქივი',        '3-day archive',       4),
  ('standard', '520+ არხი',              '520+ channels',       1),
  ('standard', 'Full HD ხარისხი',        'Full HD quality',     2),
  ('standard', '3 მოწყობილობა',          '3 devices',           3),
  ('standard', '7 დღიანი არქივი',        '7-day archive',       4),
  ('standard', 'ყუთი უფასოდ 12 თვეზე',   'Free box on 12 months', 5),
  ('premium',  '1024 არხი',              '1,024 channels',      1),
  ('premium',  '4K HDR ხარისხი',         '4K HDR quality',      2),
  ('premium',  '5 მოწყობილობა',          '5 devices',           3),
  ('premium',  '14 დღიანი არქივი',       '14-day archive',      4),
  ('premium',  'სპორტული პაკეტი შედის',  'Sport pack included', 5)
) as v(plan, ka, en, ord)
join public.plans p on p.slug = v.plan;

-- basic: the six every plan carries. standard adds five. premium takes all.
insert into public.plan_channels (plan_id, channel_id)
select p.id, c.id from public.plans p, public.channels c
where (p.slug = 'basic'
        and c.slug in ('1tv','imedi','rustavi2','formula','palitranews','euronews'))
   or (p.slug = 'standard'
        and c.slug in ('1tv','imedi','rustavi2','formula','palitranews','euronews',
                       'cnn','bbc','discovery','cartoon','nickelodeon'))
   or (p.slug = 'premium');

insert into public.site_settings (key, value_text, value_num, description) values
  ('channel_count',       '1 024',  1024, 'the stat counter under the guide'),
  ('hero_channels_label', '1,000+', null, 'the figure in the hero headline'),
  ('rewind_days',         '14',       14, 'how far back the archive goes'),
  ('country_count',       '40',       40, 'countries named in the channels lede');
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx supabase db reset && npx supabase test db
```

Expected: PASS, 9 seed assertions green.

- [ ] **Step 5: Write the logo upload script**

The seed puts paths in the database; the files still have to reach the bucket. Create `supabase/seed/upload-logos.mjs`:

```js
/* Uploads assets/img/channels/* into the logos bucket at channels/<file>.
   Run once per environment:
     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node supabase/seed/upload-logos.mjs
*/
import { readdir, readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  process.exit(1);
}

const TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const db = createClient(url, key);
const dir = 'assets/img/channels';

for (const file of await readdir(dir)) {
  const ext = file.slice(file.lastIndexOf('.'));
  if (!TYPES[ext]) continue;                       // skips the README
  const body = await readFile(`${dir}/${file}`);
  const { error } = await db.storage
    .from('logos')
    .upload(`channels/${file}`, body, { contentType: TYPES[ext], upsert: true });
  console.log(error ? `FAIL ${file}: ${error.message}` : `ok   ${file}`);
  if (error) process.exitCode = 1;
}
```

- [ ] **Step 6: Run it against the local stack**

Take the URL and service key from `npx supabase status`.

```bash
npm install --save-dev @supabase/supabase-js
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_KEY=<local service key> node supabase/seed/upload-logos.mjs
```

Expected: thirteen `ok` lines. Confirm one is served:

```bash
curl -sI http://127.0.0.1:54321/storage/v1/object/public/logos/channels/imedi.png | head -1
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 7: Commit**

```bash
git add supabase/ package.json package-lock.json
git commit -m "Seed the channels and plans the site already shows"
```

---

## Task 6: Test harness and the snapshot builder

**Files:**
- Create: `package.json` (root), `vitest.config.ts`, `tsconfig.json`
- Create: `supabase/functions/_shared/types.ts`
- Create: `supabase/functions/_shared/snapshot.ts`
- Create: `tests/shared/snapshot.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing at runtime — this is pure TypeScript
- Produces:
  - `type ChannelRow`, `PlanRow`, `CategoryRow`, `SettingRow`, `Snapshot`
  - `buildSnapshot(input: SnapshotInput, publishedAt: string): Snapshot`
  - `SnapshotInput = { categories, channels, plans, settings }`

`_shared/` is inside `supabase/functions/` because the Supabase CLI bundles
underscore-prefixed directories with the functions that import them, while not
deploying them as functions themselves.

- [ ] **Step 1: Create the root workspace**

Create `package.json`:

```json
{
  "name": "televizio",
  "private": true,
  "type": "module",
  "workspaces": ["cms"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "db:test": "supabase test db"
  },
  "devDependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "jsdom": "^25.0.0",
    "supabase": "^1.200.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'cms/src/**/*.test.ts'],
    environment: 'node',
  },
});
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["tests", "supabase/functions", "cms/src"]
}
```

```bash
npm install
```

- [ ] **Step 2: Write the failing test**

Create `tests/shared/snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../../supabase/functions/_shared/snapshot.ts';
import type { SnapshotInput } from '../../supabase/functions/_shared/types.ts';

const BASE = 'https://x.supabase.co/storage/v1/object/public/logos/';

const input: SnapshotInput = {
  logoBaseUrl: BASE,
  categories: [
    { slug: 'ge', name_ka: 'ქართული', name_en: 'Georgian', sort_order: 1 },
    { slug: 'news', name_ka: 'ახალი ამბები', name_en: 'News', sort_order: 2 },
  ],
  channels: [
    { slug: 'formula', name_ka: 'ფორმულა', name_en: 'Formula',
      logo_path: 'channels/formula.png', logo_w: 65, logo_h: 120,
      sort_order: 4, in_slider: true, slider_order: 6,
      cats: ['ge', 'news'], plans: ['basic', 'premium'] },
    { slug: 'cnn', name_ka: 'CNN', name_en: 'CNN',
      logo_path: 'channels/cnn.png', logo_w: 258, logo_h: 120,
      sort_order: 7, in_slider: true, slider_order: 5,
      cats: ['news'], plans: ['premium'] },
  ],
  plans: [
    { slug: 'basic', name_ka: 'საბაზისო', name_en: 'Basic', price: 19,
      currency: '₾', period_ka: 'თვე', period_en: 'mo',
      badge_ka: null, badge_en: null, is_featured: false,
      total_label: '180+', sort_order: 1,
      features: [{ ka: '180+ არხი', en: '180+ channels' }] },
  ],
  settings: [{ key: 'channel_count', value_text: '1 024', value_num: 1024 }],
};

describe('buildSnapshot', () => {
  const snap = buildSnapshot(input, '2026-09-01T12:00:00.000Z');

  it('stamps the version and the publish time', () => {
    expect(snap.version).toBe(1);
    expect(snap.published_at).toBe('2026-09-01T12:00:00.000Z');
  });

  it('turns each logo path into a full public URL', () => {
    expect(snap.channels[0].logo).toBe(`${BASE}channels/cnn.png`);
  });

  it('orders channels by sort_order, not input order', () => {
    expect(snap.channels.map((c) => c.slug)).toEqual(['formula', 'cnn']);
  });

  it('keeps the first category first, since it becomes the card tag', () => {
    expect(snap.channels.find((c) => c.slug === 'formula')!.cats).toEqual(['ge', 'news']);
  });

  it('carries plan membership onto the channel', () => {
    expect(snap.channels.find((c) => c.slug === 'cnn')!.plans).toEqual(['premium']);
  });

  it('flattens settings into an object of both text and number', () => {
    expect(snap.settings.channel_count).toBe(1024);
    expect(snap.settings.channel_count_label).toBe('1 024');
  });

  it('keeps plan features in order', () => {
    expect(snap.plans[0].features).toEqual([{ ka: '180+ არხი', en: '180+ channels' }]);
  });

  it('is stable — the same input twice gives byte-identical JSON', () => {
    const a = JSON.stringify(buildSnapshot(input, '2026-09-01T12:00:00.000Z'));
    const b = JSON.stringify(buildSnapshot(input, '2026-09-01T12:00:00.000Z'));
    expect(a).toBe(b);
  });
});
```

Sorting by `sort_order` is asserted with input already in order, so add one more
case proving it actually sorts. Append inside the `describe`:

```ts
  it('sorts even when the rows arrive backwards', () => {
    const reversed = { ...input, channels: [...input.channels].reverse() };
    const s = buildSnapshot(reversed, '2026-09-01T12:00:00.000Z');
    expect(s.channels.map((c) => c.slug)).toEqual(['formula', 'cnn']);
  });
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module .../_shared/snapshot.ts`.

- [ ] **Step 4: Write the types**

Create `supabase/functions/_shared/types.ts`:

```ts
export type CategoryRow = {
  slug: string; name_ka: string; name_en: string; sort_order: number;
};

export type ChannelRow = {
  slug: string; name_ka: string; name_en: string;
  logo_path: string | null; logo_w: number | null; logo_h: number | null;
  sort_order: number; in_slider: boolean; slider_order: number;
  cats: string[];    // ordered — the first is the card's tag
  plans: string[];
};

export type PlanRow = {
  slug: string; name_ka: string; name_en: string;
  price: number; currency: string; period_ka: string; period_en: string;
  badge_ka: string | null; badge_en: string | null;
  is_featured: boolean; total_label: string; sort_order: number;
  features: { ka: string; en: string }[];
};

export type SettingRow = {
  key: string; value_text: string | null; value_num: number | null;
};

export type SnapshotInput = {
  logoBaseUrl: string;
  categories: CategoryRow[];
  channels: ChannelRow[];
  plans: PlanRow[];
  settings: SettingRow[];
};

export type SnapshotChannel = {
  slug: string; name_ka: string; name_en: string;
  logo: string; w: number; h: number;
  cats: string[]; plans: string[];
  in_slider: boolean; slider_order: number; sort: number;
};

export type SnapshotPlan = {
  slug: string; name_ka: string; name_en: string;
  price: number; currency: string; period_ka: string; period_en: string;
  featured: boolean; badge_ka: string | null; badge_en: string | null;
  total_label: string;
  features: { ka: string; en: string }[];
};

export type Snapshot = {
  version: 1;
  published_at: string;
  settings: Record<string, string | number>;
  categories: { slug: string; name_ka: string; name_en: string; sort: number }[];
  channels: SnapshotChannel[];
  plans: SnapshotPlan[];
};
```

- [ ] **Step 5: Write the builder**

Create `supabase/functions/_shared/snapshot.ts`:

```ts
import type { Snapshot, SnapshotInput } from './types.ts';

/** Assemble the one document the public site reads.
 *
 *  Plan membership is denormalised onto each channel because that is the
 *  shape the markup wants — data-plan="basic standard premium" — even though
 *  the database keeps it as a join table.
 *
 *  The output is deterministic: everything is sorted, so two publishes of
 *  unchanged content hash the same and the CDN keeps its cache.
 */
export function buildSnapshot(input: SnapshotInput, publishedAt: string): Snapshot {
  const base = input.logoBaseUrl.endsWith('/')
    ? input.logoBaseUrl
    : `${input.logoBaseUrl}/`;

  const settings: Record<string, string | number> = {};
  for (const s of [...input.settings].sort((a, b) => a.key.localeCompare(b.key))) {
    if (s.value_num !== null) settings[s.key] = Number(s.value_num);
    if (s.value_text !== null) settings[`${s.key}_label`] = s.value_text;
  }
  // channel_count is read as a number and printed from its label, so both
  // spellings are kept; the label wins where the markup shows "1 024".

  return {
    version: 1,
    published_at: publishedAt,
    settings,
    categories: [...input.categories]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        slug: c.slug, name_ka: c.name_ka, name_en: c.name_en, sort: c.sort_order,
      })),
    channels: [...input.channels]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        slug: c.slug,
        name_ka: c.name_ka,
        name_en: c.name_en,
        logo: `${base}${c.logo_path ?? ''}`,
        w: c.logo_w ?? 0,
        h: c.logo_h ?? 0,
        cats: c.cats,
        plans: [...c.plans].sort(),
        in_slider: c.in_slider,
        slider_order: c.slider_order,
        sort: c.sort_order,
      })),
    plans: [...input.plans]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({
        slug: p.slug,
        name_ka: p.name_ka,
        name_en: p.name_en,
        price: Number(p.price),
        currency: p.currency,
        period_ka: p.period_ka,
        period_en: p.period_en,
        featured: p.is_featured,
        badge_ka: p.badge_ka,
        badge_en: p.badge_en,
        total_label: p.total_label,
        features: p.features,
      })),
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS, 9 tests.

Note the `plans` array is sorted inside the builder, so the fixture's
`['basic','premium']` stays as written. If a test fails on ordering, fix the
expectation, not the sort — determinism is the point.

- [ ] **Step 7: Note the tooling in the site README**

The site README says the project has no dependencies to install. That is still true
of what gets deployed, but no longer of the repo. Under `## Run locally`, add:

```markdown
The deployed site is still a folder of static files with no build step. The
`package.json` at the root is development tooling only — Vitest, the Supabase CLI
and the CMS workspace. Nothing it installs is uploaded.
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json supabase/ tests/ README.md
git commit -m "Build the snapshot the site will read"
```

---

## Task 7: Refuse to publish broken content

**Files:**
- Create: `supabase/functions/_shared/validate.ts`
- Create: `tests/shared/validate.test.ts`

**Interfaces:**
- Consumes: `SnapshotInput` from Task 6
- Produces: `validateContent(input: SnapshotInput): ContentProblem[]`, `type ContentProblem = { kind: 'missing_logo' | 'empty_plan'; slug: string; message: string }`

The same two conditions the dashboard raises as content warnings in Plan 4. One rule set, checked here.

- [ ] **Step 1: Write the failing test**

Create `tests/shared/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../supabase/functions/_shared/validate.ts';
import type { SnapshotInput } from '../../supabase/functions/_shared/types.ts';

function make(over: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    logoBaseUrl: 'https://x/',
    categories: [],
    channels: [
      { slug: 'cnn', name_ka: 'CNN', name_en: 'CNN',
        logo_path: 'channels/cnn.png', logo_w: 258, logo_h: 120,
        sort_order: 1, in_slider: true, slider_order: 1,
        cats: ['news'], plans: ['basic'] },
    ],
    plans: [
      { slug: 'basic', name_ka: 'საბაზისო', name_en: 'Basic', price: 19,
        currency: '₾', period_ka: 'თვე', period_en: 'mo',
        badge_ka: null, badge_en: null, is_featured: false,
        total_label: '180+', sort_order: 1, features: [] },
    ],
    settings: [],
    ...over,
  };
}

describe('validateContent', () => {
  it('passes clean content', () => {
    expect(validateContent(make())).toEqual([]);
  });

  it('names a channel with no logo', () => {
    const input = make();
    input.channels[0].logo_path = null;
    const problems = validateContent(input);
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe('missing_logo');
    expect(problems[0].slug).toBe('cnn');
    expect(problems[0].message).toContain('cnn');
  });

  it('treats a logo with no dimensions as missing, since the marquee reflows', () => {
    const input = make();
    input.channels[0].logo_w = null;
    expect(validateContent(input)[0].kind).toBe('missing_logo');
  });

  it('names a plan carrying no channels', () => {
    const input = make();
    input.channels[0].plans = [];
    const problems = validateContent(input);
    expect(problems.map((p) => p.kind)).toContain('empty_plan');
    expect(problems.find((p) => p.kind === 'empty_plan')!.slug).toBe('basic');
  });

  it('reports every problem, not just the first', () => {
    const input = make();
    input.channels[0].logo_path = null;
    input.channels[0].plans = [];
    expect(validateContent(input)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module .../validate.ts`.

- [ ] **Step 3: Write the validator**

Create `supabase/functions/_shared/validate.ts`:

```ts
import type { SnapshotInput } from './types.ts';

export type ContentProblem = {
  kind: 'missing_logo' | 'empty_plan';
  slug: string;
  message: string;
};

/** The conditions that block a publish.
 *
 *  A logo without intrinsic dimensions counts as missing: the marquee sizes
 *  itself from width and height attributes and reflows without them, which
 *  looks like a broken page rather than a missing image.
 */
export function validateContent(input: SnapshotInput): ContentProblem[] {
  const problems: ContentProblem[] = [];

  for (const c of input.channels) {
    if (!c.logo_path || !c.logo_w || !c.logo_h) {
      problems.push({
        kind: 'missing_logo',
        slug: c.slug,
        message: `Channel "${c.slug}" has no usable logo. Upload one before publishing.`,
      });
    }
  }

  for (const p of input.plans) {
    const carries = input.channels.some((c) => c.plans.includes(p.slug));
    if (!carries) {
      problems.push({
        kind: 'empty_plan',
        slug: p.slug,
        message: `Plan "${p.slug}" carries no channels. Assign some before publishing.`,
      });
    }
  }

  return problems;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS, 14 tests total.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/validate.ts tests/shared/validate.test.ts
git commit -m "Block a publish that would break the page"
```

---

## Task 8: The publish endpoint

**Files:**
- Create: `supabase/functions/_shared/auth.ts`
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/publish/index.ts`
- Create: `tests/functions/publish.test.ts`

**Interfaces:**
- Consumes: `buildSnapshot`, `validateContent`
- Produces: `POST /functions/v1/publish` → `200 { published_at, channel_count, plan_count, hash }`, `400 { problems }`, `403`, `405`
- Produces: `requireAdmin(req, roles) → { id, role } | Response` from `_shared/auth.ts`

- [ ] **Step 1: Write the failing integration test**

Create `tests/functions/publish.test.ts`. It runs against the local stack; if that is
not up, it fails loudly rather than silently passing.

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_KEY!;

const EDITOR = { email: 'editor@televizio.ge', password: 'test-password-1' };

beforeAll(async () => {
  expect(ANON, 'set SUPABASE_ANON_KEY from `npx supabase status`').toBeTruthy();
  const admin = createClient(URL, SERVICE);
  const { data } = await admin.auth.admin.createUser({
    email: EDITOR.email, password: EDITOR.password, email_confirm: true,
  });
  if (data.user) {
    await admin.from('admins').upsert({
      id: data.user.id, email: EDITOR.email, name: 'Editor', role: 'editor',
    });
  }
});

async function editorToken() {
  const db = createClient(URL, ANON);
  const { data, error } = await db.auth.signInWithPassword(EDITOR);
  if (error) throw error;
  return data.session!.access_token;
}

async function publish(token?: string) {
  return fetch(`${URL}/functions/v1/publish`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

describe('publish', () => {
  it('refuses a caller with no session', async () => {
    expect((await publish()).status).toBe(403);
  });

  it('writes a snapshot for an editor', async () => {
    const res = await publish(await editorToken());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel_count).toBe(13);
    expect(body.plan_count).toBe(3);
    expect(body.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('puts the document where the site will look for it', async () => {
    const res = await fetch(`${URL}/storage/v1/object/public/site/content.json`);
    expect(res.status).toBe(200);
    const snap = await res.json();
    expect(snap.version).toBe(1);
    expect(snap.channels).toHaveLength(13);
    expect(snap.channels[0].slug).toBe('1tv');
    expect(snap.plans.map((p: { slug: string }) => p.slug))
      .toEqual(['basic', 'standard', 'premium']);
  });

  it('records the publish in the history', async () => {
    const admin = createClient(URL, SERVICE);
    const { data } = await admin.from('publications').select('*');
    expect(data!.length).toBeGreaterThan(0);
  });

  it('refuses and explains when a channel has no logo', async () => {
    const admin = createClient(URL, SERVICE);
    await admin.from('channels').update({ logo_path: null }).eq('slug', 'cnn');
    const res = await publish(await editorToken());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.problems[0].slug).toBe('cnn');
    await admin.from('channels')
      .update({ logo_path: 'channels/cnn.png' }).eq('slug', 'cnn');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx supabase start
npx supabase functions serve --no-verify-jwt &
SUPABASE_ANON_KEY=<anon> SUPABASE_SERVICE_KEY=<service> npm test -- tests/functions
```

Expected: FAIL — the function does not exist, so every request 404s.

- [ ] **Step 3: Write the shared CORS and auth helpers**

Create `supabase/functions/_shared/cors.ts`:

```ts
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
```

Create `supabase/functions/_shared/auth.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { json } from './cors.ts';

export type Caller = { id: string; role: string };

/** Resolve the bearer token to an admin, or hand back the refusal to return.
 *
 *  The role comes from the admins table rather than the JWT, so revoking
 *  someone takes effect immediately instead of when their token expires.
 */
export async function requireAdmin(
  req: Request,
  allowed: string[],
): Promise<Caller | Response> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return json({ error: 'forbidden' }, 403);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: user } = await admin.auth.getUser(token);
  if (!user?.user) return json({ error: 'forbidden' }, 403);

  const { data: row } = await admin
    .from('admins').select('id, role').eq('id', user.user.id).maybeSingle();

  if (!row || !allowed.includes(row.role)) return json({ error: 'forbidden' }, 403);
  return { id: row.id, role: row.role };
}
```

- [ ] **Step 4: Write the publish function**

Create `supabase/functions/publish/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildSnapshot } from '../_shared/snapshot.ts';
import { validateContent } from '../_shared/validate.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { cors, json } from '../_shared/cors.ts';
import type { SnapshotInput } from '../_shared/types.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const caller = await requireAdmin(req, ['owner', 'editor']);
  if (caller instanceof Response) return caller;

  const db = createClient(URL_, SERVICE);

  const [cats, chans, plans, settings] = await Promise.all([
    db.from('categories').select('slug, name_ka, name_en, sort_order'),
    db.from('channels').select(
      `slug, name_ka, name_en, logo_path, logo_w, logo_h, sort_order,
       in_slider, slider_order,
       channel_categories ( sort_order, categories ( slug ) ),
       plan_channels ( plans ( slug, is_active ) )`,
    ).eq('is_active', true),
    db.from('plans').select(
      `slug, name_ka, name_en, price, currency, period_ka, period_en,
       badge_ka, badge_en, is_featured, total_label, sort_order,
       plan_features ( text_ka, text_en, sort_order )`,
    ).eq('is_active', true),
    db.from('site_settings').select('key, value_text, value_num'),
  ]);

  const failed = [cats, chans, plans, settings].find((r) => r.error);
  if (failed) return json({ error: failed.error!.message }, 500);

  const activePlans = new Set((plans.data ?? []).map((p) => p.slug));

  const input: SnapshotInput = {
    logoBaseUrl: `${URL_}/storage/v1/object/public/logos/`,
    categories: cats.data ?? [],
    channels: (chans.data ?? []).map((c) => ({
      slug: c.slug, name_ka: c.name_ka, name_en: c.name_en,
      logo_path: c.logo_path, logo_w: c.logo_w, logo_h: c.logo_h,
      sort_order: c.sort_order, in_slider: c.in_slider, slider_order: c.slider_order,
      cats: (c.channel_categories ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((cc) => cc.categories.slug),
      plans: (c.plan_channels ?? [])
        .map((pc) => pc.plans.slug)
        .filter((slug: string) => activePlans.has(slug)),
    })),
    plans: (plans.data ?? []).map((p) => ({
      ...p,
      features: (p.plan_features ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((f) => ({ ka: f.text_ka, en: f.text_en })),
    })),
    settings: settings.data ?? [],
  };

  const problems = validateContent(input);
  if (problems.length) return json({ problems }, 400);

  const publishedAt = new Date().toISOString();
  const snapshot = buildSnapshot(input, publishedAt);
  const body = JSON.stringify(snapshot);

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hash = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  const up = await db.storage.from('site').upload('content.json', body, {
    contentType: 'application/json',
    cacheControl: '60',       // short: a publish should show up within a minute
    upsert: true,
  });
  if (up.error) return json({ error: up.error.message }, 500);

  await db.from('publications').insert({
    published_by: caller.id,
    snapshot_hash: hash,
    channel_count: snapshot.channels.length,
    plan_count: snapshot.plans.length,
  });

  await db.from('audit_log').insert({
    admin_id: caller.id, action: 'publish', entity: 'snapshot', entity_id: hash,
  });

  return json({
    published_at: publishedAt,
    channel_count: snapshot.channels.length,
    plan_count: snapshot.plans.length,
    hash,
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx supabase functions serve --no-verify-jwt &
SUPABASE_ANON_KEY=<anon> SUPABASE_SERVICE_KEY=<service> npm test -- tests/functions
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ tests/functions/
git commit -m "Publish the snapshot on demand"
```

---

## Task 9: The CMS shell — auth, routing, layout

**Files:**
- Create: `cms/package.json`, `cms/vite.config.ts`, `cms/tsconfig.json`, `cms/index.html`, `cms/.env.example`, `cms/src/index.css`
- Create: `cms/src/main.tsx`, `cms/src/App.tsx`
- Create: `cms/src/lib/supabase.ts`, `cms/src/auth/AuthProvider.tsx`, `cms/src/auth/guard.ts`
- Create: `cms/src/components/Shell.tsx`, `cms/src/pages/Login.tsx`
- Create: `cms/src/auth/guard.test.ts`
- Create: `supabase/seed/make-owner.mjs`

**Interfaces:**
- Consumes: the Supabase project URL and anon key from env
- Produces:
  - `useAuth() → { session, admin, role, signIn, signOut, loading }`
  - `canWrite(role, area) → boolean` where `area` is `'content' | 'subscribers'`
  - routes `/login`, `/`, and a `<Shell>` that wraps every authenticated route

- [ ] **Step 1: Scaffold the app**

```bash
npm create vite@latest cms -- --template react-ts
cd cms && npm install
npm install @supabase/supabase-js react-router-dom @tanstack/react-query
npm install -D tailwindcss @tailwindcss/vite
cd ..
```

Replace `cms/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
});
```

Replace `cms/src/index.css` with a single line:

```css
@import "tailwindcss";
```

Create `cms/.env.example`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=
```

Copy it to `cms/.env.local` and fill in the values from `npx supabase status`.

- [ ] **Step 2: Write the failing guard test**

Create `cms/src/auth/guard.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test -- cms/src/auth
```

Expected: FAIL — `Cannot find module './guard'`.

- [ ] **Step 4: Write the guard**

Create `cms/src/auth/guard.ts`:

```ts
export type Role = 'owner' | 'editor' | 'support';
export type Area = 'content' | 'subscribers';

const WRITERS: Record<Area, Role[]> = {
  content: ['owner', 'editor'],
  subscribers: ['owner', 'support'],
};

/** Mirrors the RLS policies exactly. The database is the enforcement; this
 *  only decides whether to render a disabled button or a live one. */
export function canWrite(role: string | null | undefined, area: Area): boolean {
  if (!role) return false;
  return (WRITERS[area] as string[]).includes(role);
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test -- cms/src/auth
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Write the Supabase client**

Create `cms/src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in cms/.env.local');
}

export const supabase = createClient(url, key);
```

- [ ] **Step 7: Write the auth provider**

Create `cms/src/auth/AuthProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role } from './guard';

type Admin = { id: string; email: string; name: string; role: Role };

type Ctx = {
  session: Session | null;
  admin: Admin | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setAdmin(null); setLoading(false); return; }
    let alive = true;
    supabase.from('admins').select('id, email, name, role')
      .eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setAdmin(data as Admin | null);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [session]);

  const value: Ctx = {
    session, admin, loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    async signOut() { await supabase.auth.signOut(); },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
```

An authenticated user with no `admins` row gets `admin === null` and is shown the
door — being able to sign in is not the same as being an admin.

- [ ] **Step 8: Write the login page**

Create `cms/src/pages/Login.tsx`:

```tsx
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100">
      <form onSubmit={submit} className="w-80 space-y-4">
        <h1 className="text-2xl font-semibold">Televizio CMS</h1>
        <input
          type="email" value={email} required autoFocus
          onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          className="w-full rounded bg-neutral-900 px-3 py-2 outline-none
                     ring-1 ring-neutral-800 focus:ring-red-600"
        />
        <input
          type="password" value={password} required
          onChange={(e) => setPassword(e.target.value)} placeholder="Password"
          className="w-full rounded bg-neutral-900 px-3 py-2 outline-none
                     ring-1 ring-neutral-800 focus:ring-red-600"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full rounded bg-red-600 px-3 py-2 font-medium
                     disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
```

There is deliberately no "create an account" link. Signup is disabled server-side.

- [ ] **Step 9: Write the shell and the router**

Create `cms/src/components/Shell.tsx`:

```tsx
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/channels', label: 'Channels' },
  { to: '/slider', label: 'Slider' },
  { to: '/plans', label: 'Plans' },
  { to: '/settings', label: 'Settings' },
];

export default function Shell() {
  const { admin, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center gap-6 border-b border-neutral-800 px-6 py-3">
        <span className="font-semibold tracking-tight">Televizio CMS</span>
        <nav className="flex gap-4 text-sm">
          {LINKS.map((l) => (
            <NavLink
              key={l.to} to={l.to} end={l.end}
              className={({ isActive }) =>
                isActive ? 'text-red-500' : 'text-neutral-400 hover:text-neutral-100'}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-neutral-400">
          <span>{admin?.name} · {admin?.role}</span>
          <button onClick={signOut} className="hover:text-neutral-100">Sign out</button>
        </div>
      </header>
      <main className="p-6"><Outlet /></main>
    </div>
  );
}
```

Create `cms/src/App.tsx`:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Shell from './components/Shell';
import Login from './pages/Login';

const qc = new QueryClient();

function Private() {
  const { session, admin, loading } = useAuth();
  if (loading) return <div className="p-6 text-neutral-500">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!admin) {
    return (
      <div className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-400">
        This account is not an admin. Ask an owner to add you.
      </div>
    );
  }
  return <Shell />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Private />}>
              <Route index element={<div>Dashboard comes in Plan 4.</div>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

Replace `cms/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

- [ ] **Step 10: Verify it runs**

Create a local owner to sign in with, taking the service key from `npx supabase status`:

The root `package.json` sets `"type": "module"`, so this is an ES module script.
Create `supabase/seed/make-owner.mjs`:

```js
/* Creates the first owner. Run once per environment:
     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... EMAIL=... PASSWORD=... \
       node supabase/seed/make-owner.mjs
*/
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, EMAIL, PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !EMAIL || !PASSWORD) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_KEY, EMAIL and PASSWORD.');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const { data, error } = await db.auth.admin.createUser({
  email: EMAIL, password: PASSWORD, email_confirm: true,
});

let id = data?.user?.id;
if (!id) {
  const { data: found } = await db.auth.admin.listUsers();
  id = found.users.find((u) => u.email === EMAIL)?.id;
}
if (!id) { console.error(error?.message ?? 'could not create the user'); process.exit(1); }

const { error: rowError } = await db.from('admins')
  .upsert({ id, email: EMAIL, name: 'Owner', role: 'owner' });
console.log(rowError ? `FAIL ${rowError.message}` : `owner ready: ${EMAIL}`);
```

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_KEY=<local service key> \
  EMAIL=owner@televizio.ge PASSWORD=test-password-1 \
  node supabase/seed/make-owner.mjs
```

Expected: `owner ready: owner@televizio.ge`.

The same script bootstraps the first owner on the hosted project — it is the only
way in, since signup is disabled and `create-admin` needs an owner to already exist.

```bash
npm run dev --workspace cms
```

Open http://localhost:5174, sign in as `owner@televizio.ge`, and confirm the shell
renders with the name and role in the corner.

- [ ] **Step 11: Commit**

```bash
git add cms/ supabase/seed/ package.json package-lock.json
git commit -m "Stand up the CMS behind a login"
```

---

## Task 10: The channels list

**Files:**
- Create: `cms/src/lib/queries.ts`, `cms/src/pages/Channels.tsx`
- Modify: `cms/src/App.tsx`

**Interfaces:**
- Consumes: `supabase`, `useAuth`, `canWrite`
- Produces: `useChannels()`, `useCategories()`, `useSaveChannel()`, `useDeleteChannel()`, `type ChannelRecord`

- [ ] **Step 1: Write the queries module**

Create `cms/src/lib/queries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type ChannelRecord = {
  id: string; slug: string; name_ka: string; name_en: string;
  logo_path: string | null; logo_w: number | null; logo_h: number | null;
  sort_order: number; in_slider: boolean; slider_order: number;
  is_active: boolean;
  channel_categories: { category_id: string; sort_order: number }[];
};

export type CategoryRecord = {
  id: string; slug: string; name_ka: string; name_en: string; sort_order: number;
};

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories').select('*').order('sort_order');
      if (error) throw error;
      return data as CategoryRecord[];
    },
  });
}

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*, channel_categories ( category_id, sort_order )')
        .order('sort_order');
      if (error) throw error;
      return data as ChannelRecord[];
    },
  });
}

/** Saves the row and rewrites its category links, since the join table has no
 *  natural upsert. Delete-then-insert is safe here: the pair is the key. */
export function useSaveChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<ChannelRecord> & { categoryIds: string[] },
    ) => {
      const { categoryIds, channel_categories: _drop, ...row } = input;
      const { data, error } = await supabase
        .from('channels').upsert(row).select('id').single();
      if (error) throw error;

      const id = data.id as string;
      await supabase.from('channel_categories').delete().eq('channel_id', id);
      if (categoryIds.length) {
        const { error: linkError } = await supabase
          .from('channel_categories')
          .insert(categoryIds.map((cid, i) => ({
            channel_id: id, category_id: cid, sort_order: i,
          })));
        if (linkError) throw linkError;
      }
      return id;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); },
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('channels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); },
  });
}
```

The first category in `categoryIds` gets `sort_order: 0`, which is what the site
prints as the channel's tag — so the order of that array is the editor's choice of
primary category, not an implementation detail.

- [ ] **Step 2: Write the channels page**

Create `cms/src/pages/Channels.tsx`:

```tsx
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useCategories, useChannels, type ChannelRecord } from '../lib/queries';
import ChannelDrawer from './ChannelDrawer';

export default function Channels() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'content');
  const channels = useChannels();
  const categories = useCategories();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ChannelRecord | 'new' | null>(null);

  if (channels.isLoading || categories.isLoading) {
    return <p className="text-neutral-500">Loading…</p>;
  }
  if (channels.error) {
    return <p className="text-red-500">{String(channels.error)}</p>;
  }

  const term = query.trim().toLowerCase();
  const rows = (channels.data ?? []).filter((c) =>
    !term ||
    c.slug.includes(term) ||
    c.name_en.toLowerCase().includes(term) ||
    c.name_ka.includes(query.trim()));

  return (
    <section className="space-y-4">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Channels</h1>
        <span className="text-sm text-neutral-500">{rows.length}</span>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="ml-auto rounded bg-neutral-900 px-3 py-1.5 text-sm
                     ring-1 ring-neutral-800 focus:outline-none focus:ring-red-600"
        />
        {editable && (
          <button
            onClick={() => setEditing('new')}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium"
          >
            Add channel
          </button>
        )}
      </header>

      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr className="border-b border-neutral-800">
            <th className="py-2 font-medium">Logo</th>
            <th className="font-medium">Name</th>
            <th className="font-medium">Slug</th>
            <th className="font-medium">Categories</th>
            <th className="font-medium">Order</th>
            <th className="font-medium">Slider</th>
            <th className="font-medium">Active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.id}
              onClick={() => editable && setEditing(c)}
              className="border-b border-neutral-900 hover:bg-neutral-900/60
                         cursor-pointer"
            >
              <td className="py-2">
                {c.logo_path
                  ? <span className="text-neutral-400">{c.logo_w}×{c.logo_h}</span>
                  : <span className="text-red-500">missing</span>}
              </td>
              <td>{c.name_en}<span className="text-neutral-600"> · {c.name_ka}</span></td>
              <td className="text-neutral-500">{c.slug}</td>
              <td className="text-neutral-500">{c.channel_categories.length}</td>
              <td className="text-neutral-500">{c.sort_order}</td>
              <td className="text-neutral-500">{c.in_slider ? c.slider_order : '—'}</td>
              <td>{c.is_active ? '' : <span className="text-neutral-600">off</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <ChannelDrawer
          channel={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 3: Register the route**

In `cms/src/App.tsx`, add the import and the route inside the `<Route element={<Private />}>` block:

```tsx
import Channels from './pages/Channels';
```

```tsx
              <Route path="channels" element={<Channels />} />
```

- [ ] **Step 4: Verify against the seeded data**

```bash
npm run dev --workspace cms
```

Open http://localhost:5174/channels. Expected: thirteen rows, `1tv` first,
dimensions shown for each, `imedi` showing slider position 1.

- [ ] **Step 5: Commit**

```bash
git add cms/src/
git commit -m "List the channels the CMS holds"
```

---

## Task 11: The channel editor and logo upload

**Files:**
- Create: `cms/src/lib/image.ts`, `cms/src/lib/image.test.ts`, `cms/src/pages/ChannelDrawer.tsx`

**Interfaces:**
- Consumes: `useSaveChannel`, `useDeleteChannel`, `CategoryRecord`
- Produces: `readImageSize(file: File) → Promise<{ w: number; h: number }>`, `uploadLogo(file, slug) → Promise<{ path, w, h }>`

- [ ] **Step 1: Write the failing test for dimension reading**

Create `cms/src/lib/image.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- cms/src/lib
```

Expected: FAIL — `Cannot find module './image'`.

- [ ] **Step 3: Write the image helpers**

Create `cms/src/lib/image.ts`:

```ts
import { supabase } from './supabase';

/** SVGs have no natural bitmap size, so the dimensions come out of the markup.
 *  The marquee needs both numbers or it reflows, which is why a logo without
 *  them blocks a publish. */
export function svgSizeFromText(text: string): { w: number; h: number } | null {
  const num = (s: string) => parseFloat(s.replace(/[a-z%]/gi, ''));

  const w = text.match(/<svg[^>]*\swidth\s*=\s*"([^"]+)"/i);
  const h = text.match(/<svg[^>]*\sheight\s*=\s*"([^"]+)"/i);
  if (w && h) {
    const wide = num(w[1]);
    const tall = num(h[1]);
    if (wide > 0 && tall > 0) return { w: Math.round(wide), h: Math.round(tall) };
  }

  const box = text.match(/viewBox\s*=\s*"\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
  if (box) return { w: Math.round(+box[1]), h: Math.round(+box[2]) };

  return null;
}

export function logoPathFor(slug: string, filename: string, stamp: number): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return `channels/${slug}-${stamp}${ext}`;
}

export async function readImageSize(file: File): Promise<{ w: number; h: number }> {
  if (file.type === 'image/svg+xml') {
    const size = svgSizeFromText(await file.text());
    if (!size) throw new Error('This SVG declares no width/height or viewBox.');
    return size;
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error('Could not read that image.'));
      img.src = url;
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadLogo(file: File, slug: string) {
  const { w, h } = await readImageSize(file);
  const path = logoPathFor(slug, file.name, Date.now());
  const { error } = await supabase.storage
    .from('logos').upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  return { path, w, h };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- cms/src/lib
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the drawer**

Create `cms/src/pages/ChannelDrawer.tsx`:

```tsx
import { useState } from 'react';
import { uploadLogo } from '../lib/image';
import {
  useDeleteChannel, useSaveChannel,
  type CategoryRecord, type ChannelRecord,
} from '../lib/queries';

const BLANK = {
  slug: '', name_ka: '', name_en: '',
  logo_path: null as string | null, logo_w: null as number | null,
  logo_h: null as number | null,
  sort_order: 0, in_slider: false, slider_order: 0, is_active: true,
};

export default function ChannelDrawer({
  channel, categories, onClose,
}: {
  channel: ChannelRecord | null;
  categories: CategoryRecord[];
  onClose: () => void;
}) {
  const save = useSaveChannel();
  const remove = useDeleteChannel();
  const [form, setForm] = useState(channel ? { ...channel } : { ...BLANK });
  const [catIds, setCatIds] = useState<string[]>(
    channel
      ? [...channel.channel_categories]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((c) => c.category_id)
      : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Clicking a category toggles it; the first one selected stays first, and
   *  that is the label printed on the channel's card. */
  function toggleCat(id: string) {
    setCatIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  async function onFile(file: File) {
    setError(null);
    if (!form.slug) { setError('Give the channel a slug first — the file is named after it.'); return; }
    setBusy(true);
    try {
      const { path, w, h } = await uploadLogo(file, form.slug);
      setForm((f) => ({ ...f, logo_path: path, logo_w: w, logo_h: h }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!catIds.length) { setError('Pick at least one category.'); return; }
    setBusy(true);
    try {
      const { channel_categories: _drop, ...row } = form as typeof form &
        { channel_categories?: unknown };
      await save.mutateAsync({ ...row, categoryIds: catIds });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const field = 'w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ' +
                'ring-neutral-800 focus:outline-none focus:ring-red-600';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <form
        onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="h-full w-[28rem] space-y-4 overflow-y-auto border-l
                   border-neutral-800 bg-neutral-950 p-6"
      >
        <h2 className="text-lg font-semibold">
          {channel ? `Edit ${channel.name_en}` : 'New channel'}
        </h2>

        <label className="block space-y-1">
          <span className="text-xs text-neutral-500">Slug</span>
          <input className={field} required value={form.slug}
                 onChange={(e) => set('slug', e.target.value.toLowerCase().trim())} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Name (Georgian)</span>
            <input className={field} required value={form.name_ka}
                   onChange={(e) => set('name_ka', e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Name (English)</span>
            <input className={field} required value={form.name_en}
                   onChange={(e) => set('name_en', e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-neutral-600">
          Give both the same value for a brand that is not translated — CNN, Discovery.
          The site then prints one name instead of switching between two.
        </p>

        <div className="space-y-1">
          <span className="text-xs text-neutral-500">
            Categories — the first is printed on the card
          </span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const at = catIds.indexOf(c.id);
              return (
                <button
                  type="button" key={c.id} onClick={() => toggleCat(c.id)}
                  className={`rounded px-2 py-1 text-xs ring-1 ${
                    at === 0 ? 'bg-red-600 ring-red-600'
                    : at > 0 ? 'bg-neutral-800 ring-neutral-700'
                    : 'ring-neutral-800 text-neutral-400'}`}
                >
                  {c.name_en}{at === 0 ? ' · tag' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-neutral-500">Logo</span>
          <input
            type="file" accept=".png,.svg,.webp,.jpg,.jpeg"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="block w-full text-sm text-neutral-400"
          />
          <p className="text-xs text-neutral-600">
            {form.logo_path
              ? `${form.logo_path} · ${form.logo_w}×${form.logo_h}`
              : 'No logo yet — a publish will refuse until there is one.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Order</span>
            <input className={field} type="number" value={form.sort_order}
                   onChange={(e) => set('sort_order', +e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Slider pos.</span>
            <input className={field} type="number" value={form.slider_order}
                   onChange={(e) => set('slider_order', +e.target.value)} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={form.in_slider}
                   onChange={(e) => set('in_slider', e.target.checked)} />
            In slider
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active}
                 onChange={(e) => set('is_active', e.target.checked)} />
          Active — inactive channels are left out of a publish
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={busy}
                  className="rounded bg-red-600 px-3 py-2 text-sm font-medium disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onClose}
                  className="rounded px-3 py-2 text-sm text-neutral-400">
            Cancel
          </button>
          {channel && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Delete ${channel.name_en}? This cannot be undone.`)) return;
                await remove.mutateAsync(channel.id);
                onClose();
              }}
              className="ml-auto rounded px-3 py-2 text-sm text-red-500"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Verify a real upload**

With the dev server running, open `/channels`, click `bbc`, upload any PNG, and
confirm the dimension line updates and Save closes the drawer. Then check the row
in the table shows the new dimensions.

- [ ] **Step 7: Commit**

```bash
git add cms/src/
git commit -m "Edit a channel and give it a logo"
```

---

## Task 12: Slider ordering

**Files:**
- Create: `cms/src/pages/Slider.tsx`
- Modify: `cms/src/App.tsx`, `cms/src/lib/queries.ts`

**Interfaces:**
- Consumes: `useChannels`
- Produces: `useSaveSliderOrder(rows: { id: string; in_slider: boolean; slider_order: number }[])`

The marquee is a curated subset in its own order — `imedi` leads it while `1tv` leads the catalogue — so it gets its own screen rather than a column in the channels table.

- [ ] **Step 1: Add the mutation**

Append to `cms/src/lib/queries.ts`:

```ts
export function useSaveSliderOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: { id: string; in_slider: boolean; slider_order: number }[],
    ) => {
      for (const row of rows) {
        const { error } = await supabase
          .from('channels')
          .update({ in_slider: row.in_slider, slider_order: row.slider_order })
          .eq('id', row.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); },
  });
}
```

- [ ] **Step 2: Write the page**

Create `cms/src/pages/Slider.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useChannels, useSaveSliderOrder } from '../lib/queries';

type Row = { id: string; name_en: string; in_slider: boolean };

export default function Slider() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'content');
  const channels = useChannels();
  const save = useSaveSliderOrder();
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!channels.data) return;
    setRows(
      [...channels.data]
        .sort((a, b) => {
          if (a.in_slider !== b.in_slider) return a.in_slider ? -1 : 1;
          return a.slider_order - b.slider_order;
        })
        .map((c) => ({ id: c.id, name_en: c.name_en, in_slider: c.in_slider })),
    );
  }, [channels.data]);

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setRows(next);
    setSaved(false);
  }

  async function commit() {
    // Position is the index among the channels actually in the marquee,
    // counted from one, so the numbers read the way the strip does.
    let position = 0;
    await save.mutateAsync(rows.map((r) => ({
      id: r.id,
      in_slider: r.in_slider,
      slider_order: r.in_slider ? ++position : 0,
    })));
    setSaved(true);
  }

  if (channels.isLoading) return <p className="text-neutral-500">Loading…</p>;

  return (
    <section className="max-w-xl space-y-4">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Slider</h1>
        <span className="text-sm text-neutral-500">
          {rows.filter((r) => r.in_slider).length} in the strip
        </span>
        {editable && (
          <button onClick={commit} disabled={save.isPending}
                  className="ml-auto rounded bg-red-600 px-3 py-1.5 text-sm font-medium
                             disabled:opacity-50">
            {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save order'}
          </button>
        )}
      </header>

      <ol className="divide-y divide-neutral-900 rounded ring-1 ring-neutral-800">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-6 text-neutral-600">{r.in_slider ? i + 1 : '—'}</span>
            <input
              type="checkbox" checked={r.in_slider} disabled={!editable}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...r, in_slider: e.target.checked };
                setRows(next);
                setSaved(false);
              }}
            />
            <span className={r.in_slider ? '' : 'text-neutral-600'}>{r.name_en}</span>
            {editable && (
              <span className="ml-auto flex gap-1">
                <button onClick={() => move(i, i - 1)}
                        className="px-2 text-neutral-500 hover:text-neutral-100">↑</button>
                <button onClick={() => move(i, i + 1)}
                        className="px-2 text-neutral-500 hover:text-neutral-100">↓</button>
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 3: Register the route**

In `cms/src/App.tsx`:

```tsx
import Slider from './pages/Slider';
```

```tsx
              <Route path="slider" element={<Slider />} />
```

- [ ] **Step 4: Verify**

Open `/slider`. Expected: `imedi` at position 1, `rustavi2` at 2, `discovery` at 3 —
matching the marquee's order in `index.html:147`. Move one, save, reload, confirm it
stuck.

- [ ] **Step 5: Commit**

```bash
git add cms/src/
git commit -m "Order the logo strip on its own screen"
```

---

## Task 13: The plans editor

**Files:**
- Create: `cms/src/pages/Plans.tsx`
- Modify: `cms/src/App.tsx`, `cms/src/lib/queries.ts`

**Interfaces:**
- Consumes: `useChannels`
- Produces: `usePlans()`, `useSavePlan()`, `type PlanRecord`

- [ ] **Step 1: Add the queries**

Append to `cms/src/lib/queries.ts`:

```ts
export type PlanRecord = {
  id: string; slug: string; name_ka: string; name_en: string;
  price: number; currency: string; period_ka: string; period_en: string;
  badge_ka: string | null; badge_en: string | null;
  is_featured: boolean; total_label: string; sort_order: number; is_active: boolean;
  plan_features: { id: string; text_ka: string; text_en: string; sort_order: number }[];
  plan_channels: { channel_id: string }[];
};

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*, plan_features ( id, text_ka, text_en, sort_order ), plan_channels ( channel_id )')
        .order('sort_order');
      if (error) throw error;
      return data as PlanRecord[];
    },
  });
}

/** Features and channel links are rewritten wholesale rather than diffed.
 *  A plan has a handful of each, so the simpler code is the better trade. */
export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      plan: Omit<PlanRecord, 'plan_features' | 'plan_channels'>;
      features: { text_ka: string; text_en: string }[];
      channelIds: string[];
    }) => {
      const { error } = await supabase.from('plans').upsert(input.plan);
      if (error) throw error;
      const id = input.plan.id;

      await supabase.from('plan_features').delete().eq('plan_id', id);
      if (input.features.length) {
        const { error: fe } = await supabase.from('plan_features').insert(
          input.features.map((f, i) => ({ plan_id: id, ...f, sort_order: i + 1 })),
        );
        if (fe) throw fe;
      }

      await supabase.from('plan_channels').delete().eq('plan_id', id);
      if (input.channelIds.length) {
        const { error: ce } = await supabase.from('plan_channels').insert(
          input.channelIds.map((cid) => ({ plan_id: id, channel_id: cid })),
        );
        if (ce) throw ce;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
```

- [ ] **Step 2: Write the page**

Create `cms/src/pages/Plans.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useChannels, usePlans, useSavePlan, type PlanRecord } from '../lib/queries';

const field = 'w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ' +
              'ring-neutral-800 focus:outline-none focus:ring-red-600';

function PlanCard({ plan, editable }: { plan: PlanRecord; editable: boolean }) {
  const channels = useChannels();
  const save = useSavePlan();
  const [form, setForm] = useState(plan);
  const [features, setFeatures] = useState(
    [...plan.plan_features].sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => ({ text_ka: f.text_ka, text_en: f.text_en })),
  );
  const [channelIds, setChannelIds] = useState(
    plan.plan_channels.map((c) => c.channel_id),
  );
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { setForm(plan); }, [plan]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const { plan_features: _f, plan_channels: _c, ...row } = form;
    try {
      await save.mutateAsync({ plan: row, features, channelIds });
      setStatus('Saved');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={submit}
          className="space-y-3 rounded ring-1 ring-neutral-800 p-4">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">{form.name_en}</h2>
        <span className="text-xs text-neutral-600">{form.slug}</span>
        {form.is_featured && (
          <span className="rounded bg-red-600 px-1.5 text-[10px]">featured</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 block">
          <span className="text-xs text-neutral-500">Name (Georgian)</span>
          <input className={field} value={form.name_ka}
                 onChange={(e) => setForm({ ...form, name_ka: e.target.value })} />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs text-neutral-500">Name (English)</span>
          <input className={field} value={form.name_en}
                 onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs text-neutral-500">Price</span>
          <input className={field} type="number" step="1" value={form.price}
                 onChange={(e) => setForm({ ...form, price: +e.target.value })} />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs text-neutral-500">
            Channel count shown on the card
          </span>
          <input className={field} value={form.total_label}
                 onChange={(e) => setForm({ ...form, total_label: e.target.value })} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_featured}
               onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
        Featured — the raised card with the red button
      </label>

      <div className="space-y-2">
        <span className="text-xs text-neutral-500">Features</span>
        {features.map((f, i) => (
          <div key={i} className="flex gap-2">
            <input className={field} value={f.text_ka} placeholder="Georgian"
                   onChange={(e) => {
                     const next = [...features];
                     next[i] = { ...f, text_ka: e.target.value };
                     setFeatures(next);
                   }} />
            <input className={field} value={f.text_en} placeholder="English"
                   onChange={(e) => {
                     const next = [...features];
                     next[i] = { ...f, text_en: e.target.value };
                     setFeatures(next);
                   }} />
            <button type="button" className="px-2 text-neutral-500"
                    onClick={() => setFeatures(features.filter((_, x) => x !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="text-xs text-neutral-400"
                onClick={() => setFeatures([...features, { text_ka: '', text_en: '' }])}>
          + Add a feature
        </button>
      </div>

      <div className="space-y-2">
        <span className="text-xs text-neutral-500">
          Channels in this plan — {channelIds.length} of {channels.data?.length ?? 0}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(channels.data ?? []).map((c) => {
            const on = channelIds.includes(c.id);
            return (
              <button
                type="button" key={c.id}
                onClick={() => setChannelIds(on
                  ? channelIds.filter((x) => x !== c.id)
                  : [...channelIds, c.id])}
                className={`rounded px-2 py-1 text-xs ring-1 ${
                  on ? 'bg-red-600 ring-red-600' : 'ring-neutral-800 text-neutral-400'}`}
              >
                {c.name_en}
              </button>
            );
          })}
        </div>
      </div>

      {editable && (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={save.isPending}
                  className="rounded bg-red-600 px-3 py-2 text-sm font-medium
                             disabled:opacity-50">
            {save.isPending ? 'Saving…' : 'Save plan'}
          </button>
          {status && <span className="text-xs text-neutral-500">{status}</span>}
        </div>
      )}
    </form>
  );
}

export default function Plans() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'content');
  const plans = usePlans();

  if (plans.isLoading) return <p className="text-neutral-500">Loading…</p>;
  if (plans.error) return <p className="text-red-500">{String(plans.error)}</p>;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Plans</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        {(plans.data ?? []).map((p) => (
          <PlanCard key={p.id} plan={p} editable={editable} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Register the route**

In `cms/src/App.tsx`:

```tsx
import Plans from './pages/Plans';
```

```tsx
              <Route path="plans" element={<Plans />} />
```

- [ ] **Step 4: Verify against the seed**

Open `/plans`. Expected: three cards; Standard marked featured with badge text;
Basic showing 6 channels selected, Standard 11, Premium 13; Premium's features
listing five rows ending in "Sport pack included". Change Basic's price to 21, save,
reload, confirm it stuck, then set it back to 19.

- [ ] **Step 5: Commit**

```bash
git add cms/src/
git commit -m "Edit the pricing cards and what they carry"
```

---

## Task 14: The Publish control

**Files:**
- Create: `cms/src/components/PublishButton.tsx`
- Modify: `cms/src/components/Shell.tsx`, `cms/src/lib/queries.ts`

**Interfaces:**
- Consumes: the `publish` function from Task 8
- Produces: `useLastPublication()`, `usePendingChanges()`, `usePublish()`

- [ ] **Step 1: Add the queries**

Append to `cms/src/lib/queries.ts`:

```ts
export function useLastPublication() {
  return useQuery({
    queryKey: ['last-publication'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('publications').select('*')
        .order('published_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as { published_at: string; channel_count: number } | null;
    },
  });
}

/** How many content rows changed since the last publish. Counting rather than
 *  listing keeps this to three cheap head queries. */
export function usePendingChanges(since: string | null | undefined) {
  return useQuery({
    queryKey: ['pending', since],
    enabled: since !== undefined,
    queryFn: async () => {
      const tables = ['channels', 'plans', 'categories', 'site_settings'] as const;
      let total = 0;
      for (const t of tables) {
        let q = supabase.from(t).select('*', { count: 'exact', head: true });
        if (since) q = q.gt('updated_at', since);
        const { count, error } = await q;
        if (error) throw error;
        total += count ?? 0;
      }
      return total;
    },
  });
}

export function usePublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/publish`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
        },
      );
      const body = await res.json();
      if (!res.ok) {
        const problems = body.problems as { message: string }[] | undefined;
        throw new Error(problems
          ? problems.map((p) => p.message).join('\n')
          : (body.error ?? 'Publish failed.'));
      }
      return body as { published_at: string; channel_count: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['last-publication'] });
      qc.invalidateQueries({ queryKey: ['pending'] });
    },
  });
}
```

- [ ] **Step 2: Write the button**

Create `cms/src/components/PublishButton.tsx`:

```tsx
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useLastPublication, usePendingChanges, usePublish } from '../lib/queries';

export default function PublishButton() {
  const { admin } = useAuth();
  const last = useLastPublication();
  const pending = usePendingChanges(last.data?.published_at ?? null);
  const publish = usePublish();

  if (!canWrite(admin?.role, 'content')) return null;

  const count = pending.data ?? 0;
  const when = last.data
    ? new Date(last.data.published_at).toLocaleString('en-GB',
        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'never';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">
        {count > 0 ? `${count} unpublished` : 'up to date'} · last {when}
      </span>
      <button
        onClick={() => publish.mutate()}
        disabled={publish.isPending}
        className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
          count > 0 ? 'bg-red-600' : 'ring-1 ring-neutral-700 text-neutral-300'}`}
      >
        {publish.isPending ? 'Publishing…' : 'Publish'}
      </button>
      {publish.error && (
        <span className="max-w-sm whitespace-pre-line text-xs text-red-500">
          {publish.error.message}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Put it in the shell**

In `cms/src/components/Shell.tsx`, import it and place it before the account block:

```tsx
import PublishButton from './PublishButton';
```

Replace the `<div className="ml-auto …">` opening with:

```tsx
        <div className="ml-auto flex items-center gap-4 text-sm text-neutral-400">
          <PublishButton />
```

- [ ] **Step 4: Verify end to end**

With `npx supabase functions serve` running, change Basic's price in `/plans`, save,
and confirm the header shows "1 unpublished". Press Publish. Expected: the count
returns to "up to date", and:

```bash
curl -s http://127.0.0.1:54321/storage/v1/object/public/site/content.json | head -c 200
```

shows the new price. Then set a channel's logo to missing in the database and confirm
Publish shows the refusal message rather than succeeding:

```bash
curl -s http://127.0.0.1:54321/storage/v1/object/public/site/content.json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).plans.map(p=>p.slug+':'+p.price).join(' ')))"
```

- [ ] **Step 5: Commit**

```bash
git add cms/src/
git commit -m "Put a publish button where it can always be reached"
```

---

## Task 15: Settings — admins and publish history

**Files:**
- Create: `supabase/functions/create-admin/index.ts`, `cms/src/pages/Settings.tsx`
- Modify: `cms/src/App.tsx`, `cms/src/lib/queries.ts`
- Create: `tests/functions/create-admin.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` from Task 8
- Produces: `POST /functions/v1/create-admin` → `200 { id }` | `403`; `useAdmins()`, `usePublications()`, `useSiteSettings()`, `useSaveSetting()`

- [ ] **Step 1: Write the failing test**

Create `tests/functions/create-admin.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_KEY!;

// The test makes its own owner and editor rather than relying on whoever
// happens to be in the database, so it can run against a fresh db reset.
beforeAll(async () => {
  const admin = createClient(URL, SERVICE);
  for (const [email, role] of [
    ['owner@televizio.ge', 'owner'],
    ['editor@televizio.ge', 'editor'],
  ] as const) {
    const { data } = await admin.auth.admin.createUser({
      email, password: 'test-password-1', email_confirm: true,
    });
    const { data: found } = await admin.auth.admin.listUsers();
    const id = data.user?.id ?? found.users.find((u) => u.email === email)?.id;
    if (id) {
      await admin.from('admins').upsert({ id, email, name: role, role });
    }
  }
});

async function tokenFor(email: string, password: string) {
  const db = createClient(URL, ANON);
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session!.access_token;
}

async function call(token: string | undefined, body: unknown) {
  return fetch(`${URL}/functions/v1/create-admin`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('create-admin', () => {
  it('refuses an anonymous caller', async () => {
    const res = await call(undefined, { email: 'x@y.z', name: 'X', role: 'editor' });
    expect(res.status).toBe(403);
  });

  it('refuses an editor — only an owner provisions admins', async () => {
    const token = await tokenFor('editor@televizio.ge', 'test-password-1');
    const res = await call(token, { email: 'x@y.z', name: 'X', role: 'editor' });
    expect(res.status).toBe(403);
  });

  it('creates an admin for an owner', async () => {
    const token = await tokenFor('owner@televizio.ge', 'test-password-1');
    const email = `support-${Date.now()}@televizio.ge`;
    const res = await call(token, { email, name: 'Support', role: 'support' });
    expect(res.status).toBe(200);

    const admin = createClient(URL, SERVICE);
    const { data } = await admin.from('admins').select('role').eq('email', email).single();
    expect(data!.role).toBe('support');
  });

  it('rejects a role that is not one of the three', async () => {
    const token = await tokenFor('owner@televizio.ge', 'test-password-1');
    const res = await call(token, { email: 'y@z.z', name: 'Y', role: 'superuser' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
SUPABASE_ANON_KEY=<anon> SUPABASE_SERVICE_KEY=<service> npm test -- tests/functions/create-admin
```

Expected: FAIL — the function 404s.

- [ ] **Step 3: Write the function**

Create `supabase/functions/create-admin/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/auth.ts';
import { cors, json } from '../_shared/cors.ts';

const ROLES = ['owner', 'editor', 'support'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const caller = await requireAdmin(req, ['owner']);
  if (caller instanceof Response) return caller;

  const { email, name, role } = await req.json().catch(() => ({}));
  if (!email || !name || !ROLES.includes(role)) {
    return json({ error: 'email, name and a role of owner/editor/support are required' }, 400);
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // An invite rather than a password: the new admin sets their own, and no
  // password is ever typed into this form or sent over it.
  const { data, error } = await db.auth.admin.inviteUserByEmail(email);
  if (error || !data.user) return json({ error: error?.message ?? 'invite failed' }, 400);

  const { error: rowError } = await db.from('admins')
    .insert({ id: data.user.id, email, name, role });
  if (rowError) return json({ error: rowError.message }, 400);

  await db.from('audit_log').insert({
    admin_id: caller.id, action: 'create', entity: 'admin', entity_id: data.user.id,
    diff: { email, name, role },
  });

  return json({ id: data.user.id });
});
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
SUPABASE_ANON_KEY=<anon> SUPABASE_SERVICE_KEY=<service> npm test -- tests/functions/create-admin
```

Expected: PASS, 4 tests. The local stack captures invite emails at
http://127.0.0.1:54324 rather than sending them.

- [ ] **Step 5: Add the settings queries**

Append to `cms/src/lib/queries.ts`:

```ts
export function useAdmins() {
  return useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admins').select('id, email, name, role, created_at')
        .order('created_at');
      if (error) throw error;
      return data as { id: string; email: string; name: string;
                       role: string; created_at: string }[];
    },
  });
}

export function usePublications() {
  return useQuery({
    queryKey: ['publications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('publications').select('*')
        .order('published_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data as { id: string; published_at: string; snapshot_hash: string;
                       channel_count: number; plan_count: number }[];
    },
  });
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings').select('*').order('key');
      if (error) throw error;
      return data as { key: string; value_text: string | null;
                       value_num: number | null; description: string }[];
    },
  });
}

export function useSaveSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { key: string; value_text: string | null;
                              value_num: number | null }) => {
      const { error } = await supabase.from('site_settings').update({
        value_text: row.value_text, value_num: row.value_num,
      }).eq('key', row.key);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['site-settings'] }); },
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; name: string; role: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify(input),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not create that admin.');
      return body as { id: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); },
  });
}
```

- [ ] **Step 6: Write the settings page**

Create `cms/src/pages/Settings.tsx`:

```tsx
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  useAdmins, useCreateAdmin, usePublications, useSaveSetting, useSiteSettings,
} from '../lib/queries';

const field = 'rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ' +
              'ring-neutral-800 focus:outline-none focus:ring-red-600';

function Admins() {
  const { admin } = useAuth();
  const admins = useAdmins();
  const create = useCreateAdmin();
  const [form, setForm] = useState({ email: '', name: '', role: 'editor' });
  const [note, setNote] = useState<string | null>(null);
  const isOwner = admin?.role === 'owner';

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Admins</h2>
      <ul className="divide-y divide-neutral-900 rounded text-sm ring-1 ring-neutral-800">
        {(admins.data ?? []).map((a) => (
          <li key={a.id} className="flex gap-3 px-3 py-2">
            <span>{a.name}</span>
            <span className="text-neutral-500">{a.email}</span>
            <span className="ml-auto text-neutral-500">{a.role}</span>
          </li>
        ))}
      </ul>

      {isOwner && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setNote(null);
            try {
              await create.mutateAsync(form);
              setNote(`Invite sent to ${form.email}.`);
              setForm({ email: '', name: '', role: 'editor' });
            } catch (err) {
              setNote(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <input className={field} required type="email" placeholder="Email"
                 value={form.email}
                 onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={field} required placeholder="Name" value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={field} value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="editor">editor — content</option>
            <option value="support">support — subscribers</option>
            <option value="owner">owner — everything</option>
          </select>
          <button type="submit" disabled={create.isPending}
                  className="rounded bg-red-600 px-3 py-2 text-sm font-medium
                             disabled:opacity-50">
            Invite
          </button>
          {note && <p className="w-full text-xs text-neutral-400">{note}</p>}
        </form>
      )}
      {!isOwner && (
        <p className="text-xs text-neutral-600">Only an owner can add admins.</p>
      )}
    </section>
  );
}

function Numbers() {
  const settings = useSiteSettings();
  const save = useSaveSetting();

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Numbers on the page</h2>
      <div className="space-y-2">
        {(settings.data ?? []).map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <span className="w-44 text-neutral-500">{s.key}</span>
            <input
              className={field} defaultValue={s.value_text ?? ''}
              onBlur={(e) => save.mutate({
                key: s.key,
                value_text: e.target.value,
                value_num: Number.isFinite(+e.target.value.replace(/[\s,+]/g, ''))
                  ? +e.target.value.replace(/[\s,+]/g, '')
                  : s.value_num,
              })}
            />
            <span className="text-xs text-neutral-600">{s.description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function History() {
  const pubs = usePublications();
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Publish history</h2>
      <ul className="divide-y divide-neutral-900 rounded text-sm ring-1 ring-neutral-800">
        {(pubs.data ?? []).map((p) => (
          <li key={p.id} className="flex gap-4 px-3 py-2 text-neutral-400">
            <span>{new Date(p.published_at).toLocaleString('en-GB')}</span>
            <span>{p.channel_count} channels · {p.plan_count} plans</span>
            <span className="ml-auto font-mono text-xs text-neutral-600">
              {p.snapshot_hash.slice(0, 12)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Settings() {
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Admins />
      <Numbers />
      <History />
    </div>
  );
}
```

- [ ] **Step 7: Register the route**

In `cms/src/App.tsx`:

```tsx
import Settings from './pages/Settings';
```

```tsx
              <Route path="settings" element={<Settings />} />
```

- [ ] **Step 8: Verify**

Open `/settings` as the owner. Expected: the admin list shows owner and editor; the
numbers section lists four settings; the history shows the publishes from Task 14.
Invite a fourth admin and confirm the message appears at http://127.0.0.1:54324.
Sign in as the editor and confirm the invite form is replaced by the note that only
an owner can add admins.

- [ ] **Step 9: Run the full suite**

```bash
npx supabase db reset
npx supabase test db
npm test
```

Expected: every pgTAP file green, every Vitest file green.

- [ ] **Step 10: Commit**

```bash
git add cms/src/ supabase/functions/ tests/
git commit -m "Add settings: who may edit, the numbers, and what was published"
```

---

## Done when

- `npx supabase test db` is green across five test files.
- `npm test` is green: snapshot builder, validator, guard, image helpers, and the
  publish and create-admin integration tests.
- An owner can sign in at cms.televizio.ge (locally, port 5174), change a channel, a
  plan, the slider order and a site setting, press Publish, and see the change in
  `content.json` on the CDN.
- A publish is refused, with the channel named, when a logo is missing.
- `curl` with only the anon key returns no rows from any content table.
- `index.html` is untouched. The public site still renders from its own markup —
  swapping it over is Plan 2.
