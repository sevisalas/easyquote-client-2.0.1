-- Create a dedicated public bucket for company logos
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = excluded.public;

-- Public read access for logos
create policy "Public can view logos"
on storage.objects
for select
using (bucket_id = 'logos');

-- Authenticated users can upload to their own folder: logos/<user_id>/...
create policy "Users can upload own logos"
on storage.objects
for insert
with check (
  bucket_id = 'logos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update their own logos
create policy "Users can update own logos"
on storage.objects
for update
using (
  bucket_id = 'logos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete their own logos
create policy "Users can delete own logos"
on storage.objects
for delete
using (
  bucket_id = 'logos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
