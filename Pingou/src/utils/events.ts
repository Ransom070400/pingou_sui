import { supabase } from '~/src/lib/supabase';

const ADMIN_EMAILS = ['ransomeze654@gmail.com', 'ransomeze67@gmail.com'];

export const isEventAdmin = (email?: string | null) =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase());

export type EventFolder = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  type: 'event';
  join_code: string;
  starts_at: string | null;
  ends_at: string | null;
};

export type PersonalFolder = {
  id: string;
  name: string;
  created_at: string;
  type: 'personal';
};

export const fetchMyFolders = async (userId: string) => {
  const [ownedRes, eventsRes] = await Promise.all([
    supabase
      .from('folders')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('event_participants')
      .select('folder_id, folders:folder_id(*)')
      .eq('user_id', userId),
  ]);

  const owned = (ownedRes.data ?? []) as any[];
  const joined = ((eventsRes.data ?? []) as any[])
    .map((row) => row.folders)
    .filter(Boolean);

  // Dedupe (admin who created an event is both owner and participant).
  const seen = new Set<string>();
  const all = [...owned, ...joined].filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  return all;
};

export const joinEventByCode = async (code: string) => {
  const clean = code.trim().toUpperCase();
  if (!clean) throw new Error('Enter a code');
  const { data, error } = await supabase.rpc('join_event_by_code', { p_code: clean });
  if (error) throw new Error(error.message.replace(/^.*:\s*/, ''));
  return data as string;
};

export const createEventFolder = async (args: {
  userId: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
}) => {
  const { data, error } = await supabase
    .from('folders')
    .insert({
      owner_id: args.userId,
      name: args.name,
      type: 'event',
      starts_at: args.startsAt.toISOString(),
      ends_at: args.endsAt.toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  // Auto-join the admin so the event shows up in their folders list.
  await supabase
    .from('event_participants')
    .insert({ folder_id: data.id, user_id: args.userId });

  return data;
};

export type LeaderboardRow = {
  user_id: string;
  score: number;
  last_scored_at: string | null;
  profile?: {
    fullname: string;
    email: string;
    profile_url: string | null;
  };
};

export const fetchLeaderboard = async (folderId: string): Promise<LeaderboardRow[]> => {
  const { data: rows, error } = await supabase.rpc('event_leaderboard', {
    p_folder_id: folderId,
  });
  if (error) throw new Error(error.message);

  const list = (rows ?? []) as LeaderboardRow[];
  if (list.length === 0) return list;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, fullname, email, profile_url')
    .in(
      'user_id',
      list.map((r) => r.user_id)
    );

  const byId = new Map<string, any>();
  (profiles ?? []).forEach((p: any) => byId.set(p.user_id, p));

  return list.map((r) => ({ ...r, profile: byId.get(r.user_id) }));
};

export const fetchEventFolder = async (folderId: string) => {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('id', folderId)
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const buildEventQrValue = (code: string) => `pingou://event/${code.toUpperCase()}`;

export const parseEventCodeFromScan = (raw: string): string | null => {
  const match = raw.match(/^pingou:\/\/event\/([A-Z0-9]{4,12})$/i);
  return match ? match[1].toUpperCase() : null;
};
