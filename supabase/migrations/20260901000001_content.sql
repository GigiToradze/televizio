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
