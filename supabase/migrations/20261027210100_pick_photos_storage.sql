-- Pick photos: one folder per person inside the public "pick-photos" bucket.
-- Object path: <uid>/pick-<unix-ms>.jpg (enforced for insert and update, not just the folder)
-- The bucket itself (public, 4 MiB, image/jpeg) is declared in supabase/config.toml
-- ([storage.buckets.pick-photos]); reads need no policy because the bucket is public.
-- Same shape as the avatars policies (see 20261027052235_avatars_storage.sql), and the same
-- path rule as add_pick / update_pick (picks.photo_path).

-- Writes only inside your own folder.
-- A select policy for your own folder is needed as well: updates and deletes look rows up
-- by name, and the Storage API's DELETE is refused without it. Other people's files stay
-- invisible to the API; public reads are served by the bucket being public.
create policy pick_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pick-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy pick_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pick-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text || '/pick-[0-9]+\.jpg$')
  );

create policy pick_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pick-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'pick-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text || '/pick-[0-9]+\.jpg$')
  );

create policy pick_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pick-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
