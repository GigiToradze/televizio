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
  $$ insert into public.categories (slug, name_ka, name_en, sort_order)
     values ('tmpcat', 'დროებითი', 'Temp', 99) $$,
  'a category can be inserted');

select * from finish();
rollback;
