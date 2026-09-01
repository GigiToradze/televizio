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
