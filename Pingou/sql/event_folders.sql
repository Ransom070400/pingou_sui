-- ============================================================================
-- Event Folders feature
-- Paste this entire file into the Supabase SQL editor and run once.
-- Safe to re-run (uses IF NOT EXISTS / DROP ... CREATE patterns).
-- ============================================================================

-- 1. Extend folders table -----------------------------------------------------
alter table public.folders
  add column if not exists type text not null default 'personal'
    check (type in ('personal', 'event')),
  add column if not exists join_code text unique,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists created_by_admin boolean not null default false;

create index if not exists folders_type_idx on public.folders(type);
create index if not exists folders_join_code_idx on public.folders(join_code);

-- 2. Event participants -------------------------------------------------------
create table if not exists public.event_participants (
  folder_id uuid not null references public.folders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);

create index if not exists event_participants_user_idx
  on public.event_participants(user_id);
create index if not exists event_participants_folder_idx
  on public.event_participants(folder_id);

alter table public.event_participants enable row level security;

-- Helper: SECURITY DEFINER so the function body bypasses RLS on the same
-- table, avoiding the infinite-recursion error (42P17) that you get when a
-- policy on event_participants queries event_participants directly.
create or replace function public.is_event_participant(p_folder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_participants
    where folder_id = p_folder_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_event_participant(uuid) to authenticated;

drop policy if exists "participants visible to co-participants"
  on public.event_participants;
create policy "participants visible to co-participants"
  on public.event_participants
  for select
  using (public.is_event_participant(folder_id));

drop policy if exists "users can join events" on public.event_participants;
create policy "users can join events"
  on public.event_participants
  for insert
  with check (user_id = auth.uid());

drop policy if exists "users can leave events" on public.event_participants;
create policy "users can leave events"
  on public.event_participants
  for delete
  using (user_id = auth.uid());

-- 3. Folders SELECT policy extension ------------------------------------------
-- Additional permissive policy: event folders visible to anyone who joined.
drop policy if exists "event folders visible to participants" on public.folders;
create policy "event folders visible to participants"
  on public.folders
  for select
  using (type = 'event' and public.is_event_participant(id));

-- 4. Admin allowlist enforced via trigger -------------------------------------
-- The trigger runs regardless of which RLS insert policy matched, so it is
-- the authoritative check for event-folder creation.
create or replace function public.check_event_admin()
returns trigger
language plpgsql
as $$
declare
  v_email text;
begin
  if new.type = 'event' then
    v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    if v_email not in ('ransomeze654@gmail.com', 'ransomeze67@gmail.com') then
      raise exception 'Only admins can create event folders';
    end if;

    if new.join_code is null then
      new.join_code := upper(substr(
        translate(encode(gen_random_bytes(6), 'base64'), '+/=', 'ABC'),
        1, 6
      ));
    else
      new.join_code := upper(new.join_code);
    end if;

    new.created_by_admin := true;
  end if;
  return new;
end;
$$;

drop trigger if exists folders_event_admin_check on public.folders;
create trigger folders_event_admin_check
  before insert on public.folders
  for each row
  execute function public.check_event_admin();

-- 5. Join-by-code RPC ---------------------------------------------------------
create or replace function public.join_event_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folder_id uuid;
  v_ends_at timestamptz;
begin
  select id, ends_at into v_folder_id, v_ends_at
  from public.folders
  where join_code = upper(p_code) and type = 'event';

  if v_folder_id is null then
    raise exception 'Invalid event code';
  end if;

  if v_ends_at is not null and v_ends_at < now() then
    raise exception 'This event has already ended';
  end if;

  insert into public.event_participants (folder_id, user_id)
  values (v_folder_id, auth.uid())
  on conflict do nothing;

  return v_folder_id;
end;
$$;

grant execute on function public.join_event_by_code(text) to authenticated;

-- 6. Leaderboard RPC ----------------------------------------------------------
-- Score = distinct co-participants a user connected with during the event
-- window (either direction of the connections row). Tiebreak = who reached
-- their current score earliest.
create or replace function public.event_leaderboard(p_folder_id uuid)
returns table(user_id uuid, score bigint, last_scored_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with event as (
    select id, starts_at, ends_at
    from public.folders
    where id = p_folder_id and type = 'event'
  ),
  participants as (
    select user_id from public.event_participants where folder_id = p_folder_id
  ),
  pair_events as (
    select c.owner_id as user_id, c.connected_to as peer_id, c.created_at
    from public.connections c, event e
    where c.owner_id in (select user_id from participants)
      and c.connected_to in (select user_id from participants)
      and (e.starts_at is null or c.created_at >= e.starts_at)
      and (e.ends_at is null or c.created_at <= e.ends_at)
    union
    select c.connected_to as user_id, c.owner_id as peer_id, c.created_at
    from public.connections c, event e
    where c.owner_id in (select user_id from participants)
      and c.connected_to in (select user_id from participants)
      and (e.starts_at is null or c.created_at >= e.starts_at)
      and (e.ends_at is null or c.created_at <= e.ends_at)
  ),
  deduped as (
    select user_id, peer_id, min(created_at) as first_at
    from pair_events
    where user_id <> peer_id
    group by user_id, peer_id
  ),
  scored as (
    select user_id, count(*) as score, max(first_at) as last_scored_at
    from deduped
    group by user_id
  )
  select p.user_id,
         coalesce(s.score, 0) as score,
         s.last_scored_at
  from participants p
  left join scored s on s.user_id = p.user_id
  order by score desc, last_scored_at asc nulls last;
$$;

grant execute on function public.event_leaderboard(uuid) to authenticated;
