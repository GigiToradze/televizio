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
