-- Two public buckets: the channel artwork, and the one JSON document the
-- site reads. Public read is the point — these are served over the CDN.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', true, 2097152,
   array['image/png','image/svg+xml','image/webp','image/jpeg']),
  ('site',  'site',  true, 5242880,
   array['application/json'])
on conflict (id) do nothing;

create policy logos_public_read on storage.objects
  for select using (bucket_id = 'logos');

create policy logos_admin_write on storage.objects
  for all using (bucket_id = 'logos'
                 and public.admin_role() in ('owner','editor'))
      with check (bucket_id = 'logos'
                 and public.admin_role() in ('owner','editor'));

create policy site_public_read on storage.objects
  for select using (bucket_id = 'site');
-- Nothing may write to `site` from a browser. The publish function writes it
-- with the service key, which bypasses these policies.
