-- The proof that a leaked anon key exposes nothing, and that the three roles
-- mean what §4.4 of the design says they mean.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Two admins to impersonate. auth.uid() reads request.jwt.claims, so setting
-- that claim is how a pgTAP test signs in as someone.
insert into auth.users (instance_id, id, aud, role, email,
                        encrypted_password, email_confirmed_at,
                        created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'rls-editor@televizio.ge', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'rls-support@televizio.ge', '', now(), now(), now());

insert into public.admins (id, email, name, role) values
  ('11111111-1111-1111-1111-111111111111', 'rls-editor@televizio.ge',  'Editor',  'editor'),
  ('22222222-2222-2222-2222-222222222222', 'rls-support@televizio.ge', 'Support', 'support');

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
                   values ('rlseditorch', 'რედაქტორი', 'Editor Ch') $$,
  'an editor may create a channel');
select isnt_empty($$ select 1 from public.channels $$,
  'an editor may read channels');

-- ── support may read content but not write it ──────────────────────
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select isnt_empty($$ select 1 from public.channels $$,
  'support may read channels');
select throws_ok($$ insert into public.channels (slug, name_ka, name_en)
                    values ('rlssupportch', 'x', 'x') $$,
  '42501', null, 'support may not create a channel');
select throws_ok($$ update public.plans set price = 1 $$,
  '42501', null, 'support may not reprice a plan');
reset role;

select * from finish();
rollback;
