-- Deny by default, everywhere. The public site never reads these tables;
-- it reads the published snapshot out of Storage instead.

alter table public.categories         enable row level security;
alter table public.channels           enable row level security;
alter table public.channel_categories enable row level security;
alter table public.plans              enable row level security;
alter table public.plan_features      enable row level security;
alter table public.plan_channels      enable row level security;
alter table public.site_settings      enable row level security;
alter table public.admins             enable row level security;
alter table public.audit_log          enable row level security;
alter table public.publications       enable row level security;

-- Content: any admin reads; owner and editor write.
do $$
declare t text;
begin
  foreach t in array array['categories','channels','channel_categories',
                           'plans','plan_features','plan_channels','site_settings']
  loop
    execute format(
      'create policy %I_read on public.%I for select using (public.is_admin())',
      t, t);
    execute format(
      'create policy %I_write on public.%I for all
         using (public.admin_role() in (''owner'',''editor''))
         with check (public.admin_role() in (''owner'',''editor''))',
      t, t);
  end loop;
end $$;

-- Admins: every admin sees the roster; only an owner changes it.
create policy admins_read on public.admins
  for select using (public.is_admin());
create policy admins_write on public.admins
  for all using (public.admin_role() = 'owner')
          with check (public.admin_role() = 'owner');

-- Audit log: append-only from the application's point of view.
create policy audit_read on public.audit_log
  for select using (public.is_admin());
create policy audit_insert on public.audit_log
  for insert with check (public.is_admin());

-- Publications: any admin reads; the publish function writes with the
-- service key, which bypasses RLS.
create policy publications_read on public.publications
  for select using (public.is_admin());
