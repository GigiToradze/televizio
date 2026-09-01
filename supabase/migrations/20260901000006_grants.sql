-- Privileges, stated rather than inherited.
--
-- This project issues no default grants on tables created after it was set
-- up, so anon reaching a content table gets SQLSTATE 42501 before RLS is
-- ever consulted. That is fine for anon — it is exactly what we want — but
-- the CMS signs in as `authenticated`, and that role needs table privileges
-- for its policies to get a chance to run at all.
--
-- So: authenticated is granted table access and then constrained by RLS;
-- anon is denied here as well as by RLS. Two layers, and the design's claim
-- that "anon can read nothing" becomes literally true at the grant level.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on all tables in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Anon touches none of these. The public site reads content.json out of
-- Storage; the lookup and analytics endpoints are edge functions holding
-- the service key.
revoke all on all tables in schema public from anon;

alter default privileges in schema public
  revoke all on tables from anon;
