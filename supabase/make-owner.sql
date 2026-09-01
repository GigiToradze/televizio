-- Promotes an existing auth user to owner of the CMS.
--
-- Signup is disabled, and create-admin needs an owner to already exist, so
-- the first one is made by hand:
--
--   1. Dashboard -> Authentication -> Users -> Add user
--      Give it your email and a password, and tick "Auto Confirm User".
--   2. Change the email below to the one you used.
--   3. Run this in the SQL editor.
--
-- Safe to run twice; it updates the role if the row is already there.

insert into public.admins (id, email, name, role)
select u.id, u.email, 'Owner', 'owner'
from auth.users u
where u.email = 'CHANGE_ME@televizio.ge'
on conflict (id) do update set role = 'owner';

-- Should print one row. If it prints none, the email above does not match
-- any user — check Authentication -> Users for the exact spelling.
select a.email, a.role, a.created_at from public.admins a;
