-- ============================================================
-- Pingou — Supabase SQL Migrations
-- Run this in the Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. PROFILES TABLE
-- Stores user profile data, linked to Supabase Auth
-- ============================================================
create table if not exists profiles (
  user_id    uuid references auth.users(id) on delete cascade primary key,
  email      text not null,
  nickname   text not null default '',
  fullname   text not null default '',
  phone      text,
  instagram  text,
  twitter    text,
  linkedin   text,
  website    text,
  extras     text[] default '{}',
  profile_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;

-- Any authenticated user can read any profile (needed for QR scanning)
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

-- Users can only create their own profile
create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can only update their own profile
create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = user_id);


-- 2. CONNECTIONS TABLE
-- Stores user-to-user connections from QR scans
-- ============================================================
create table if not exists connections (
  id            uuid default gen_random_uuid() primary key,
  owner_id      uuid references auth.users(id) on delete cascade not null,
  connected_to  uuid references profiles(user_id) on delete cascade not null,
  folder        text,
  created_at    timestamptz default now(),
  -- Prevent duplicate connections
  unique(owner_id, connected_to)
);

-- Enable Row Level Security
alter table connections enable row level security;

-- Users can only view their own connections
create policy "Users can view their own connections"
  on connections for select
  to authenticated
  using (auth.uid() = owner_id);

-- Users can only create their own connections
create policy "Users can insert their own connections"
  on connections for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- Users can update their own connections (e.g. move to folder)
create policy "Users can update their own connections"
  on connections for update
  to authenticated
  using (auth.uid() = owner_id);

-- Users can delete their own connections
create policy "Users can delete their own connections"
  on connections for delete
  to authenticated
  using (auth.uid() = owner_id);


-- 3. STORAGE BUCKET — Profile Pictures
-- ============================================================
-- Create this in the Supabase Dashboard → Storage → New Bucket:
--   Name: pfp
--   Public: false
--
-- Then add these storage policies in the Dashboard → Storage → Policies:
--
-- SELECT (download) policy — authenticated users can download any profile picture:
--   Allowed operation: SELECT
--   Target roles: authenticated
--   Policy: true
--
-- INSERT (upload) policy — users can upload their own profile picture:
--   Allowed operation: INSERT
--   Target roles: authenticated
--   Policy: (bucket_id = 'pfp') AND (auth.uid()::text = (storage.foldername(name))[1])
--
-- UPDATE (overwrite) policy — users can overwrite their own profile picture:
--   Allowed operation: UPDATE
--   Target roles: authenticated
--   Policy: (bucket_id = 'pfp') AND (auth.uid()::text = (storage.foldername(name))[1])
--
-- Or run this SQL to create the bucket + policies programmatically:

insert into storage.buckets (id, name, public)
values ('pfp', 'pfp', false)
on conflict (id) do nothing;

create policy "Authenticated users can download profile pictures"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'pfp');

create policy "Users can upload their own profile picture"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pfp' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can overwrite their own profile picture"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'pfp' and auth.uid()::text = (storage.foldername(name))[1]);


-- 4. OPTIONAL: Auto-update updated_at on profile changes
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row
  execute function update_updated_at();
