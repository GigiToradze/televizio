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
