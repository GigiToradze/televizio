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
