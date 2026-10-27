begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

delete from auth.users;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

select is(
  (select public || '|' || file_size_limit::text || '|' || allowed_mime_types::text
   from storage.buckets where id = 'pick-photos'),
  'true|4194304|{image/jpeg}',
  'the pick-photos bucket exists: public, 4 MiB, JPEG only'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok($$
  insert into storage.objects (bucket_id, name, owner_id)
  values ('pick-photos', '00000000-0000-0000-0000-00000000000a/pick-1700000000000.jpg', '00000000-0000-0000-0000-00000000000a')
$$, 'A can upload into A''s own folder');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('pick-photos', '00000000-0000-0000-0000-00000000000b/pick-1700000000000.jpg')
$$, '42501', null, 'A cannot upload into B''s folder');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('pick-photos', '00000000-0000-0000-0000-00000000000a/evil.png')
$$, '42501', null, 'A cannot upload a file that is not pick-<unix-ms>.jpg, even in A''s own folder');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('pick-photos', '00000000-0000-0000-0000-00000000000a/avatar-1.jpg')
$$, '42501', null, 'an avatar-style name is refused in pick-photos');
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('avatars', '00000000-0000-0000-0000-00000000000a/pick-1700000000000.jpg')
$$, '42501', null, 'a pick-style name is refused in the avatars bucket');
select is((select count(*)::int from storage.objects where bucket_id = 'pick-photos'), 1,
  'A sees A''s own object');
select lives_ok($$
  update storage.objects set metadata = '{"x":1}'::jsonb
  where bucket_id = 'pick-photos' and name = '00000000-0000-0000-0000-00000000000a/pick-1700000000000.jpg'
$$, 'A can update A''s own object');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'pick-photos'), 0,
  'B does not see A''s object through the API');
select lives_ok($$
  update storage.objects set metadata = '{"x":2}'::jsonb
  where bucket_id = 'pick-photos' and name = '00000000-0000-0000-0000-00000000000a/pick-1700000000000.jpg'
$$, 'B''s update of A''s object runs without error (and affects 0 rows)');
reset role;
select is(
  (select metadata::text from storage.objects
   where bucket_id = 'pick-photos' and name = '00000000-0000-0000-0000-00000000000a/pick-1700000000000.jpg'),
  '{"x": 1}', 'B''s update changed nothing');

-- Direct deletes from storage.objects are blocked for everyone by Supabase (use the Storage API),
-- so check that the delete policy exists and is scoped to the caller's folder.
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
     and roles = '{authenticated}' and qual like '%pick-photos%' and qual like '%foldername%'),
  1, 'there is a delete policy scoped to the pick-photos bucket and the caller''s folder'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$
  insert into storage.objects (bucket_id, name)
  values ('pick-photos', '00000000-0000-0000-0000-00000000000a/pick-1700000000001.jpg')
$$, '42501', null, 'signed-out visitors cannot upload');

select * from finish();
rollback;
