-- Customer data is the one thing here worth stealing, so the proofs are
-- about who cannot reach it as much as who can.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'subscribers', 'subscribers exists');
select has_table('public', 'subscriptions', 'subscriptions exists');
select has_table('public', 'payments', 'payments exists');
select has_table('public', 'lookup_attempts', 'lookup_attempts exists');

select col_is_unique('public', 'subscribers', 'subscriber_no',
  'a subscriber number belongs to one person');

select is(
  (select attgenerated from pg_attribute
   where attrelid = 'public.subscribers'::regclass and attname = 'phone_last4'),
  's', 'phone_last4 is generated and stored, not typed twice');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.subscribers'::regclass),
  'RLS is on for subscribers');

-- Two admins to impersonate: one who may write customer data, one who may not.
insert into auth.users (instance_id, id, aud, role, email,
                        encrypted_password, email_confirmed_at,
                        created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'subs-support@televizio.ge', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'subs-editor@televizio.ge', '', now(), now(), now());

insert into public.admins (id, email, name, role) values
  ('33333333-3333-3333-3333-333333333333', 'subs-support@televizio.ge', 'Support', 'support'),
  ('44444444-4444-4444-4444-444444444444', 'subs-editor@televizio.ge',  'Editor',  'editor');

-- ── anon reaches nothing ────────────────────────────────────────────
set local role anon;
select throws_ok($$ select 1 from public.subscribers $$,
  '42501', null, 'anon cannot read subscribers');
select throws_ok($$ select 1 from public.payments $$,
  '42501', null, 'anon cannot read payments');
reset role;

-- ── support keeps the records ───────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok($$ insert into public.subscribers (subscriber_no, full_name, phone)
                   values ('TAP-0001', 'Test Person', '+995 555 12 34 78') $$,
  'support may create a subscriber');

select is(
  (select phone_last4 from public.subscribers where subscriber_no = 'TAP-0001'),
  '3478', 'phone_last4 takes the last four digits, ignoring spaces and +');

-- ── an editor may look but not touch ────────────────────────────────
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select isnt_empty($$ select 1 from public.subscribers $$,
  'an editor may read subscribers');
select throws_ok($$ insert into public.subscribers (subscriber_no, full_name, phone)
                    values ('TAP-0002', 'Nope', '555000000') $$,
  '42501', null, 'an editor may not create a subscriber');
reset role;

select * from finish();
rollback;
