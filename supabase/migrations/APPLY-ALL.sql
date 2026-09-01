-- televizio — the whole schema, in one paste.
-- Paste into the Supabase SQL editor and press Run.
-- Generated; edit the migrations, not this file.

-- ── 20260901000001_content.sql ──────────────────────────────────────
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

-- ── 20260901000002_admin.sql ──────────────────────────────────────
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

-- ── 20260901000003_rls.sql ──────────────────────────────────────
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

-- ── 20260901000004_storage.sql ──────────────────────────────────────
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

-- ── 20260901000005_seed.sql ──────────────────────────────────────
-- Exactly what index.html shows today, so swapping the site over to the
-- published snapshot is invisible to a visitor.
--
-- euronews, cnn, bbc, discovery, natgeo, cartoon, nickelodeon and setanta
-- carry the same string in both languages. That is deliberate: it is how the
-- renderer knows to print one bare name instead of two .ka/.en spans.

insert into public.categories (slug, name_ka, name_en, sort_order) values
  ('ge',    'ქართული',       'Georgian',    1),
  ('news',  'ახალი ამბები',  'News',        2),
  ('sport', 'სპორტი',        'Sport',       3),
  ('doc',   'დოკუმენტური',   'Documentary', 4),
  ('kids',  'საბავშვო',      'Kids',        5)
on conflict (slug) do nothing;

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
  ('setanta',     'Setanta Sports',      'Setanta Sports',       'channels/setanta.png',      426,  120, 13, true, 10)
on conflict (slug) do nothing;

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
join public.categories k on k.slug = v.cat
on conflict do nothing;

insert into public.plans
  (slug, name_ka, name_en, price, badge_ka, badge_en, is_featured, total_label, sort_order) values
  ('basic',    'საბაზისო',      'Basic',    19, null, null, false, '180+',  1),
  ('standard', 'სტანდარტული',   'Standard', 29,
     'ყველაზე პოპულარული', 'Most popular', true, '520+',  2),
  ('premium',  'პრემიუმი',      'Premium',  45, null, null, false, '1 024', 3)
on conflict (slug) do nothing;

insert into public.plan_features (plan_id, text_ka, text_en, sort_order)
select p.id, v.ka, v.en, v.ord
from (values
  ('basic',    '180+ არხი',              '180+ channels',         1),
  ('basic',    'HD ხარისხი',             'HD quality',            2),
  ('basic',    '1 მოწყობილობა',          '1 device',              3),
  ('basic',    '3 დღიანი არქივი',        '3-day archive',         4),
  ('standard', '520+ არხი',              '520+ channels',         1),
  ('standard', 'Full HD ხარისხი',        'Full HD quality',       2),
  ('standard', '3 მოწყობილობა',          '3 devices',             3),
  ('standard', '7 დღიანი არქივი',        '7-day archive',         4),
  ('standard', 'ყუთი უფასოდ 12 თვეზე',   'Free box on 12 months', 5),
  ('premium',  '1024 არხი',              '1,024 channels',        1),
  ('premium',  '4K HDR ხარისხი',         '4K HDR quality',        2),
  ('premium',  '5 მოწყობილობა',          '5 devices',             3),
  ('premium',  '14 დღიანი არქივი',       '14-day archive',        4),
  ('premium',  'სპორტული პაკეტი შედის',  'Sport pack included',   5)
) as v(plan, ka, en, ord)
join public.plans p on p.slug = v.plan
where not exists (select 1 from public.plan_features f where f.plan_id = p.id);

-- basic: the six every plan carries. standard adds five. premium takes all.
insert into public.plan_channels (plan_id, channel_id)
select p.id, c.id from public.plans p, public.channels c
where (p.slug = 'basic'
        and c.slug in ('1tv','imedi','rustavi2','formula','palitranews','euronews'))
   or (p.slug = 'standard'
        and c.slug in ('1tv','imedi','rustavi2','formula','palitranews','euronews',
                       'cnn','bbc','discovery','cartoon','nickelodeon'))
   or (p.slug = 'premium')
on conflict do nothing;

insert into public.site_settings (key, value_text, value_num, description) values
  ('channel_count',       '1 024',  1024, 'the stat counter under the guide'),
  ('hero_channels_label', '1,000+', null, 'the figure in the hero headline'),
  ('rewind_days',         '14',       14, 'how far back the archive goes'),
  ('country_count',       '40',       40, 'countries named in the channels lede')
on conflict (key) do nothing;

-- ── 20260901000006_grants.sql ──────────────────────────────────────
-- Privileges, stated rather than inherited.
--
-- This project issues no default grants on tables created after it was set
-- up, so anon reaching a content table gets SQLSTATE 42501 before RLS is
-- ever consulted. That is fine for anon — it is exactly what we want — but
-- the CMS signs in as `authenticated`, and that role needs table privileges
-- for its policies to get a chance to run at all.
--
-- So: authenticated is granted table access and then constrained by RLS;
-- anon is denied here as well as by RLS. Two layers, and the design's claim
-- that "anon can read nothing" becomes literally true at the grant level.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on all tables in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Anon touches none of these. The public site reads content.json out of
-- Storage; the lookup and analytics endpoints are edge functions holding
-- the service key.
revoke all on all tables in schema public from anon;

alter default privileges in schema public
  revoke all on tables from anon;

-- ── 20260901000007_subscribers.sql ──────────────────────────────────────
-- Subscriber records. Kept by hand by an admin; no customer ever writes here.
--
-- Money is recorded, never processed: `payments` is a ledger an admin types
-- into, and nothing in this schema talks to a card network.

create table public.subscribers (
  id            uuid primary key default gen_random_uuid(),
  subscriber_no text not null unique,
  full_name     text not null,
  phone         text not null,
  -- The lookup's second factor, derived rather than typed twice so it can
  -- never drift from the number it is meant to match.
  phone_last4   text generated always as
                  (right(regexp_replace(phone, '\D', '', 'g'), 4)) stored,
  email         text,
  address       text,
  city          text,
  notes         text,
  status        text not null default 'active'
                check (status in ('active', 'suspended', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  subscriber_id   uuid not null references public.subscribers(id) on delete cascade,
  -- restrict, not cascade: deleting a plan that people are on should fail
  -- loudly rather than quietly erase their subscriptions.
  plan_id         uuid not null references public.plans(id) on delete restrict,
  started_on      date not null,
  due_on          date not null,
  status          text not null default 'active'
                  check (status in ('active', 'expired', 'cancelled')),
  device_count    int not null default 1,
  -- Frozen. Plan prices change; what someone agreed to should not.
  price_at_signup numeric(10,2) not null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  amount          numeric(10,2) not null,
  currency        text not null default '₾',
  paid_on         date not null,
  method          text not null default 'cash'
                  check (method in ('cash', 'transfer', 'card', 'other')),
  recorded_by     uuid references public.admins(id) on delete set null,
  note            text,
  created_at      timestamptz not null default now()
);

-- Feeds both the rate limiter and the abuse warning. No raw IP is kept:
-- the hash is salted with the UTC date, so it stops correlating at midnight.
create table public.lookup_attempts (
  id                      uuid primary key default gen_random_uuid(),
  subscriber_no_attempted text,
  ip_hash                 text not null,
  success                 boolean not null default false,
  created_at              timestamptz not null default now()
);

create index subscribers_no_idx     on public.subscribers (subscriber_no);
create index subscribers_lookup_idx on public.subscribers (subscriber_no, phone_last4);
create index subscribers_name_idx   on public.subscribers (full_name);
create index subscriptions_sub_idx  on public.subscriptions (subscriber_id, due_on desc);
create index subscriptions_due_idx  on public.subscriptions (due_on) where status = 'active';
create index payments_sub_idx       on public.payments (subscription_id, paid_on desc);
create index lookup_attempts_idx    on public.lookup_attempts (ip_hash, created_at desc);

create trigger subscribers_updated before update on public.subscribers
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger subscribers_audit after insert or update or delete on public.subscribers
  for each row execute function public.log_audit();
create trigger subscriptions_audit after insert or update or delete on public.subscriptions
  for each row execute function public.log_audit();
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function public.log_audit();

-- ── row level security ──────────────────────────────────────────────
alter table public.subscribers     enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.payments        enable row level security;
alter table public.lookup_attempts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['subscribers', 'subscriptions', 'payments']
  loop
    execute format(
      'create policy %I_read on public.%I for select using (public.is_admin())',
      t, t);
    execute format(
      'create policy %I_write on public.%I for all
         using (public.admin_role() in (''owner'',''support''))
         with check (public.admin_role() in (''owner'',''support''))',
      t, t);
  end loop;
end $$;

-- The lookup function writes these with the service key, which bypasses RLS.
-- Nothing else may write them at all.
create policy lookup_attempts_read on public.lookup_attempts
  for select using (public.is_admin());

-- ── privileges ──────────────────────────────────────────────────────
-- Stated, not inherited: this project grants nothing by default, and
-- without these the policies above would never be consulted.
grant select, insert, update, delete
  on public.subscribers, public.subscriptions, public.payments
  to authenticated;
grant select on public.lookup_attempts to authenticated;

revoke all on public.subscribers, public.subscriptions,
              public.payments, public.lookup_attempts
  from anon;

