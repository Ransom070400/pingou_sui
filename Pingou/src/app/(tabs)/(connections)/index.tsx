import { View, Text, FlatList, TouchableOpacity, Alert, Image, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FolderPlus, StickyNote } from 'lucide-react-native';
import { router } from 'expo-router';
import EmptyState from '~/src/components/EmptyState';
import { supabase } from '~/src/lib/supabase';
import { useAuth } from '~/src/context/AuthProvider';
import { useSuiAuth } from '~/src/context/SuiAuthProvider';
import { SUI_ENABLED } from '~/src/lib/sui/config';
import { getMyConnections, loadConnectionCard, type Connection } from '~/src/lib/sui/profileService';
import { colorFromAddress } from '~/src/utils/avatarColor';
import { ProfileType } from '~/src/types/ProfileTypes';
import { Feedback } from '~/src/utils/Feedback';
import { useSearchQuery } from './_layout';
import { ConnectionsSkeleton } from '~/src/components/Skeleton';

type ConnectionWithProfile = {
  id: string;
  connected_to: string;
  folder: string | null;
  note: string | null;
  created_at: string;
  profile: ProfileType;
};

// Sui: connections come from the on-chain allow table (so the scanned party sees
// them too). We load the list fast, then decrypt each peer's card (name + avatar)
// incrementally — the Seal session key is cached, so it's one signature for all.
interface ResolvedConnection extends Connection {
  name?: string;
  avatar?: string;
  bio?: string;
  resolved: boolean;
}

const SuiConnections = () => {
  const { address, signer } = useSuiAuth();
  const { query } = useSearchQuery();
  const [items, setItems] = useState<ResolvedConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!address || !signer) return;
    try {
      const conns = await getMyConnections(address);
      setItems(conns.map((c) => ({ ...c, resolved: false })));
      setLoading(false);

      // Resolve cards concurrently (bounded), updating each row as it lands. Cached
      // cards return instantly; only uncached ones hit Walrus + Seal.
      const resolveOne = async (c: Connection) => {
        let patch: Partial<ResolvedConnection> = { resolved: true };
        try {
          const card = await loadConnectionCard(address, signer, c.profileObjectId);
          patch = { name: card.fullname, avatar: card.avatar, bio: card.bio, resolved: true };
        } catch {
          // can't decrypt (shouldn't happen for a real connection)
        }
        setItems((prev) => prev.map((it) => (it.address === c.address ? { ...it, ...patch } : it)));
      };

      const LIMIT = 6;
      let i = 0;
      await Promise.all(
        Array.from({ length: Math.min(LIMIT, conns.length) }, async () => {
          while (i < conns.length) await resolveOne(conns[i++]);
        })
      );
    } catch (e) {
      console.warn('Failed to load connections:', e);
    } finally {
      setLoading(false);
    }
  }, [address, signer]);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
    );
  }, [items, query]);

  if (loading && items.length === 0) return <ConnectionsSkeleton />;
  if (!loading && items.length === 0) {
    return (
      <View className="flex-1 bg-white dark:bg-black">
        <EmptyState
          title="No Connections yet"
          description="Scan another user's QR code to exchange cards"
        />
      </View>
    );
  }

  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const initial = (it: ResolvedConnection) =>
    (it.name?.trim()?.[0] ?? it.address.slice(2, 3)).toUpperCase();

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.address}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          query.trim() ? (
            <View className="items-center pt-12">
              <Text className="text-neutral-500">No results for "{query}"</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center border-b border-neutral-100 px-4 py-3 dark:border-neutral-800"
            onPress={() =>
              router.push({
                pathname: '/connectionDetail',
                params: { profileId: item.profileObjectId, address: item.address },
              })
            }
            activeOpacity={0.7}>
            <View
              className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
              style={!item.avatar ? { backgroundColor: colorFromAddress(item.address) } : undefined}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <Text className="text-sm font-bold text-white">{initial(item)}</Text>
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-black dark:text-white" numberOfLines={1}>
                {item.name ?? (item.resolved ? 'Connection' : 'Decrypting…')}
              </Text>
              <Text className="text-sm text-neutral-500" numberOfLines={1}>
                {item.bio || short(item.address)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const Connections = () => {
  const { session } = useAuth();
  const { query } = useSearchQuery();
  const [connections, setConnections] = useState<ConnectionWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConnections = useCallback(async () => {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from('connections')
      .select('id, connected_to, folder, note, created_at, profiles:connected_to(*)')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchConnections error:', error);
    }

    if (!error && data) {
      const mapped = data
        .map((row: any) => ({
          id: row.id,
          connected_to: row.connected_to,
          folder: row.folder,
          note: row.note,
          created_at: row.created_at,
          profile: row.profiles as ProfileType,
        }))
        .filter((c) => c.profile); // drop rows where the other user's profile is missing
      setConnections(mapped);
    }
    setLoading(false);
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchConnections();
    }, [fetchConnections])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConnections();
    setRefreshing(false);
  }, [fetchConnections]);

  // Filter by search query (searches name, email, nickname, and notes)
  const filtered = useMemo(() => {
    if (!query.trim()) return connections;
    const q = query.toLowerCase();
    return connections.filter(
      (c) =>
        c.profile.fullname.toLowerCase().includes(q) ||
        c.profile.email.toLowerCase().includes(q) ||
        c.profile.nickname?.toLowerCase().includes(q) ||
        c.note?.toLowerCase().includes(q)
    );
  }, [connections, query]);

  const deleteConnection = (connection: ConnectionWithProfile) => {
    Feedback.heavy();
    Alert.alert(
      'Delete Connection',
      `Remove ${connection.profile.fullname} from your connections?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('connections').delete().eq('id', connection.id);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Feedback.success();
              fetchConnections();
            }
          },
        },
      ]
    );
  };

  const showConnectionActions = async (connection: ConnectionWithProfile) => {
    if (!session?.user?.id) return;
    Feedback.medium();

    const { data: folders } = await supabase
      .from('folders')
      .select('name')
      .eq('owner_id', session.user.id)
      .order('name');

    const buttons: { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }[] = [];

    if (folders && folders.length > 0) {
      buttons.push({
        text: connection.folder ? 'Change folder' : 'Move to folder',
        onPress: () => {
          const options = folders.map((f: any) => f.name);
          if (connection.folder) options.push('Remove from folder');
          options.push('Cancel');

          Alert.alert(
            'Assign to Folder',
            `Move ${connection.profile.fullname} to a folder`,
            options.map((name) => ({
              text: name,
              style: name === 'Cancel' ? ('cancel' as const) : name === 'Remove from folder' ? ('destructive' as const) : ('default' as const),
              onPress:
                name === 'Cancel'
                  ? undefined
                  : async () => {
                      const newFolder = name === 'Remove from folder' ? null : name;
                      const { error } = await supabase.from('connections').update({ folder: newFolder }).eq('id', connection.id);
                      if (error) {
                        Alert.alert('Error', error.message);
                      } else {
                        Feedback.success();
                        fetchConnections();
                      }
                    },
            }))
          );
        },
      });
    }

    buttons.push({
      text: 'Delete connection',
      style: 'destructive',
      onPress: () => deleteConnection(connection),
    });

    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(connection.profile.fullname, undefined, buttons);
  };

  if (loading && connections.length === 0) {
    return <ConnectionsSkeleton />;
  }

  if (!loading && connections.length === 0) {
    return (
      <View className="flex-1 bg-white dark:bg-black">
        <EmptyState
          title="No Connections yet"
          description="Scan another user's QR code to add a new connection"
        />
      </View>
    );
  }

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n.charAt(0)).join('').toUpperCase();

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          query.trim() ? (
            <View className="items-center pt-12">
              <Text className="text-neutral-500">No results for "{query}"</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center border-b border-neutral-100 px-4 py-3 dark:border-neutral-800"
            onPress={() => router.push({ pathname: '/connectionDetail', params: { userId: item.connected_to } })}
            onLongPress={() => showConnectionActions(item)}
            activeOpacity={0.7}>
            {/* Avatar */}
            <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
              {item.profile.profile_url ? (
                <Image source={{ uri: item.profile.profile_url }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <Text className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
                  {getInitials(item.profile.fullname)}
                </Text>
              )}
            </View>
            {/* Name + email/note */}
            <View className="ml-3 flex-1">
              <View className="flex-row items-center">
                <Text className="text-base font-semibold text-black dark:text-white" numberOfLines={1}>
                  {item.profile.fullname}
                </Text>
                {item.note && (
                  <StickyNote size={12} color="#D97706" style={{ marginLeft: 6 }} />
                )}
              </View>
              <Text className="text-sm text-neutral-500" numberOfLines={1}>
                {item.note || item.profile.email}
              </Text>
            </View>
            {/* Folder badge */}
            {item.folder ? (
              <TouchableOpacity onPress={() => showConnectionActions(item)} className="rounded-full bg-amber-100 px-2 py-1">
                <Text className="text-xs font-medium text-amber-700">{item.folder}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => showConnectionActions(item)} hitSlop={8} className="p-1">
                <FolderPlus size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default function ConnectionsTab() {
  return SUI_ENABLED ? <SuiConnections /> : <Connections />;
}
