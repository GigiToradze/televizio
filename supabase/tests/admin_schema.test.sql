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
select is(public.is_admin(), false, 'no session is not an admin');
select is(public.admin_role(), null, 'no session has no role');

select * from finish();
rollback;
