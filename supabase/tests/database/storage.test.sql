begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

delete from auth.users;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

select is(
  (select public || '|' || file_size_limit::text || '|' || allowed_mime_types::text
   from storage.buckets where id = 'avatars'),
  'true|2097152|{image/jpeg}',
  'the avatars bucket exists: public, 2 MiB, JPEG only'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok($$
  insert into storage.objects (bucket_id, name, owner_id)
  values ('avatars', '00000000-0000-0000-0000-00000000000a/avatar-1.jpg', '00000000-0000-0000-0000-00000000000a')
$$, 'A can upload into A''s own folder');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('avatars', '00000000-0000-0000-0000-00000000000b/avatar-1.jpg')
$$, '42501', null, 'A cannot upload into B''s folder');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('other', '00000000-0000-0000-0000-00000000000a/avatar-1.jpg')
$$, '42501', null, 'A cannot write to another bucket');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 1,
  'A sees A''s own object');
select lives_ok($$
  update storage.objects set metadata = '{"x":1}'::jsonb
  where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-00000000000a/avatar-1.jpg'
$$, 'A can update A''s own object');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0,
  'B does not see A''s object through the API');

-- Direct deletes from storage.objects are blocked for everyone by Supabase (use the Storage API),
-- so check that the delete policy exists and is scoped to the caller's folder.
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
     and roles = '{authenticated}' and qual like '%avatars%' and qual like '%foldername%'),
  1, 'there is a delete policy scoped to the avatars bucket and the caller''s folder'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('avatars', '00000000-0000-0000-0000-00000000000a/avatar-2.jpg')
$$, '42501', null, 'signed-out visitors cannot upload');

select * from finish();
rollback;
