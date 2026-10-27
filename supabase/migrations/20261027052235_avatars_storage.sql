-- Avatars: one folder per person inside the public "avatars" bucket.
-- Object path: <uid>/avatar-<unix-ms>.jpg
-- The bucket itself (public, 2 MiB, image/jpeg) is declared in supabase/config.toml
-- ([storage.buckets.avatars]); reads need no policy because the bucket is public.

-- Writes only inside your own folder.
-- A select policy for your own folder is needed as well: updates and deletes look rows up
-- by name, and the Storage API's DELETE is refused without it. Other people's files stay
-- invisible to the API; public reads are served by the bucket being public.
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
