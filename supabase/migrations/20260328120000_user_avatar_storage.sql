-- Profile photo URL + public avatars bucket (no dependency on friendships).
-- See 20260328120001_search_users_friendship_avatar_url.sql for friend search RPC returning avatar_url.

alter table public.users add column if not exists avatar_url text;

comment on column public.users.avatar_url is 'Public URL for profile image (e.g. Supabase Storage)';

-- Public bucket for avatar images (reads are public; writes scoped by folder = Clerk user id)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies (Clerk JWT sub in auth.jwt())
drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "Users insert own avatars" on storage.objects;
drop policy if exists "Users update own avatars" on storage.objects;
drop policy if exists "Users delete own avatars" on storage.objects;

create policy "Public read avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy "Users insert own avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = (auth.jwt() ->> 'sub')
);

create policy "Users update own avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = (auth.jwt() ->> 'sub')
);

create policy "Users delete own avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = (auth.jwt() ->> 'sub')
);
