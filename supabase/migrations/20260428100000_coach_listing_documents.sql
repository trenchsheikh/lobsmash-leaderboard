-- Coach listing: club flag + private document paths (Supabase Storage coach_documents).

alter table public.coach_profiles
  add column if not exists already_at_club boolean not null default false,
  add column if not exists credential_document_path text,
  add column if not exists identification_document_path text;

comment on column public.coach_profiles.already_at_club is 'Whether the coach already coaches at a padel club (self-reported).';
comment on column public.coach_profiles.credential_document_path is 'Storage object path in coach_documents bucket (e.g. user_xxx/credential-....pdf).';
comment on column public.coach_profiles.identification_document_path is 'Storage object path for ID proof; private bucket — use signed URLs to review.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach_documents',
  'coach_documents',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Coach docs select own" on storage.objects;
drop policy if exists "Coach docs insert own" on storage.objects;
drop policy if exists "Coach docs update own" on storage.objects;
drop policy if exists "Coach docs delete own" on storage.objects;

create policy "Coach docs select own"
on storage.objects for select to authenticated
using (
  bucket_id = 'coach_documents'
  and split_part(name, '/', 1) = (auth.jwt() ->> 'sub')
);

create policy "Coach docs insert own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'coach_documents'
  and split_part(name, '/', 1) = (auth.jwt() ->> 'sub')
);

create policy "Coach docs update own"
on storage.objects for update to authenticated
using (
  bucket_id = 'coach_documents'
  and split_part(name, '/', 1) = (auth.jwt() ->> 'sub')
);

create policy "Coach docs delete own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'coach_documents'
  and split_part(name, '/', 1) = (auth.jwt() ->> 'sub')
);
