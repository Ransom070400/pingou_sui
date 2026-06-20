import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Folder, Trash2, Trophy, Ticket } from 'lucide-react-native';
import { router } from 'expo-router';
import Fab from '~/src/components/Fab';
import EmptyState from '~/src/components/EmptyState';
import PromptModal from '~/src/components/PromptModal';
import JoinEventModal from '~/src/components/JoinEventModal';
import CreateEventModal from '~/src/components/CreateEventModal';
import { supabase } from '~/src/lib/supabase';
import { useAuth } from '~/src/context/AuthProvider';
import { SUI_ENABLED } from '~/src/lib/sui/config';
import { Feedback } from '~/src/utils/Feedback';
import { FoldersSkeleton } from '~/src/components/Skeleton';
import { fetchMyFolders, isEventAdmin } from '~/src/utils/events';

type FolderItem = {
  id: string;
  name: string;
  created_at: string;
  connectionCount: number;
  type: 'personal' | 'event';
  join_code?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  owner_id?: string;
};

const formatEventStatus = (starts_at?: string | null, ends_at?: string | null) => {
  if (!ends_at) return 'Live';
  const now = Date.now();
  const end = new Date(ends_at).getTime();
  if (end < now) return 'Ended';
  if (starts_at && new Date(starts_at).getTime() > now) return 'Upcoming';
  const diff = end - now;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

const Folders = () => {
  const { session, profile } = useAuth();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinEvent, setShowJoinEvent] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderConnections, setFolderConnections] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = isEventAdmin(profile?.email);

  const fetchFolders = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      const folderData = await fetchMyFolders(session.user.id);

      const { data: connData } = await supabase
        .from('connections')
        .select('folder')
        .eq('owner_id', session.user.id)
        .not('folder', 'is', null);

      const countMap: Record<string, number> = {};
      (connData ?? []).forEach((c: any) => {
        if (c.folder) countMap[c.folder] = (countMap[c.folder] || 0) + 1;
      });

      const mapped: FolderItem[] = folderData.map((f: any) => ({
        id: f.id,
        name: f.name,
        created_at: f.created_at,
        connectionCount: countMap[f.name] || 0,
        type: (f.type ?? 'personal') as 'personal' | 'event',
        join_code: f.join_code,
        starts_at: f.starts_at,
        ends_at: f.ends_at,
        owner_id: f.owner_id,
      }));

      mapped.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'event' ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      });

      setFolders(mapped);
    } catch (err) {
      console.warn('fetchFolders error:', err);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const fetchFolderConnections = async (folderName: string) => {
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from('connections')
      .select('id, connected_to, folder, created_at, profiles:connected_to(*)')
      .eq('owner_id', session.user.id)
      .eq('folder', folderName)
      .order('created_at', { ascending: false });

    setFolderConnections(data ?? []);
    setSelectedFolder(folderName);
  };

  const createFolder = async (name: string) => {
    if (!session?.user?.id) return;
    setShowCreate(false);
    Feedback.success();

    const { error } = await supabase.from('folders').insert({
      owner_id: session.user.id,
      name,
    });

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Oops', 'A folder with that name already exists');
      } else {
        Alert.alert('Error', error.message);
      }
      return;
    }

    fetchFolders();
  };

  const deleteFolder = (folder: FolderItem) => {
    Feedback.medium();
    const isOwner = folder.owner_id === session?.user?.id;
    const isEvent = folder.type === 'event';
    const title = isEvent ? (isOwner ? 'Delete Event' : 'Leave Event') : 'Delete Folder';
    const message = isEvent
      ? isOwner
        ? `Delete "${folder.name}"? The leaderboard and participants will be lost.`
        : `Leave "${folder.name}"? Your connections stay, but you'll lose access to the leaderboard.`
      : `Delete "${folder.name}"? Connections inside won't be deleted.`;

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isEvent && !isOwner ? 'Leave' : 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (isEvent && !isOwner) {
            await supabase
              .from('event_participants')
              .delete()
              .eq('folder_id', folder.id)
              .eq('user_id', session!.user.id);
          } else {
            if (!isEvent) {
              await supabase
                .from('connections')
                .update({ folder: null })
                .eq('owner_id', session!.user.id)
                .eq('folder', folder.name);
            }
            await supabase.from('folders').delete().eq('id', folder.id);
          }
          fetchFolders();
        },
      },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      fetchFolders();
      setSelectedFolder(null);
    }, [fetchFolders])
  );

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n.charAt(0)).join('').toUpperCase();

  const handleCreatePress = () => {
    Feedback.medium();
    if (!isAdmin) {
      setShowCreate(true);
      return;
    }
    Alert.alert('Create', 'What do you want to create?', [
      { text: 'Folder', onPress: () => setShowCreate(true) },
      { text: 'Event', onPress: () => setShowCreateEvent(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Viewing connections inside a (personal) folder
  if (selectedFolder) {
    return (
      <View className="flex-1 bg-white dark:bg-black">
        <TouchableOpacity
          className="flex-row items-center border-b border-neutral-100 px-4 py-3 dark:border-neutral-800"
          onPress={() => setSelectedFolder(null)}>
          <Text className="text-base text-black dark:text-white">←</Text>
          <Text className="ml-2 text-lg font-semibold text-black dark:text-white">
            {selectedFolder}
          </Text>
          <Text className="ml-2 text-sm text-neutral-500">({folderConnections.length})</Text>
        </TouchableOpacity>

        {folderConnections.length === 0 ? (
          <EmptyState
            title="No connections here"
            description="Assign connections to this folder from the All Connections tab"
          />
        ) : (
          <FlatList
            data={folderConnections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center border-b border-neutral-100 px-4 py-3 dark:border-neutral-800"
                onPress={() =>
                  router.push({ pathname: '/connectionDetail', params: { userId: item.connected_to } })
                }
                activeOpacity={0.7}>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
                  <Text className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
                    {getInitials(item.profiles?.fullname ?? '?')}
                  </Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-black dark:text-white">
                    {item.profiles?.fullname}
                  </Text>
                  <Text className="text-sm text-neutral-500">{item.profiles?.email}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  if (loading && folders.length === 0) {
    return <FoldersSkeleton />;
  }

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {/* Join event pill */}
      <TouchableOpacity
        onPress={() => {
          Feedback.light();
          setShowJoinEvent(true);
        }}
        className="mx-4 mt-3 flex-row items-center justify-center gap-2 rounded-full bg-amber-100 py-3 dark:bg-amber-900/30">
        <Ticket size={16} color="#D97706" />
        <Text className="font-semibold text-amber-700 dark:text-amber-400">Join an event</Text>
      </TouchableOpacity>

      {!loading && folders.length === 0 ? (
        <EmptyState
          title="No Folders yet."
          description="Create a folder to organize your connections"
        />
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchFolders();
                setRefreshing(false);
              }}
            />
          }
          renderItem={({ item }) => {
            const isEvent = item.type === 'event';
            const status = isEvent ? formatEventStatus(item.starts_at, item.ends_at) : null;
            const ended = status === 'Ended';
            return (
              <TouchableOpacity
                className="flex-row items-center border-b border-neutral-100 px-4 py-4 dark:border-neutral-800"
                onPress={() => {
                  if (isEvent) {
                    router.push(`/eventFolder?folderId=${item.id}` as any);
                  } else {
                    fetchFolderConnections(item.name);
                  }
                }}
                activeOpacity={0.7}>
                <View
                  className={`h-12 w-12 items-center justify-center rounded-2xl ${
                    isEvent ? 'bg-amber-500' : 'bg-amber-100 dark:bg-amber-900'
                  }`}>
                  {isEvent ? (
                    <Trophy size={22} color="#ffffff" />
                  ) : (
                    <Folder size={22} color="#D97706" />
                  )}
                </View>
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className="text-base font-semibold text-black dark:text-white"
                      numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isEvent && (
                      <View
                        className={`rounded-full px-2 py-0.5 ${
                          ended ? 'bg-neutral-200' : 'bg-amber-100'
                        }`}>
                        <Text
                          className={`text-[10px] font-bold uppercase ${
                            ended ? 'text-neutral-500' : 'text-amber-700'
                          }`}>
                          Event
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-neutral-500">
                    {isEvent
                      ? status
                      : `${item.connectionCount} ${
                          item.connectionCount === 1 ? 'connection' : 'connections'
                        }`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteFolder(item)} hitSlop={12} className="p-2">
                  <Trash2 size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Fab label="Create" onPress={handleCreatePress} />

      <PromptModal
        visible={showCreate}
        title="Create Folder"
        placeholder="Folder name"
        submitLabel="Create"
        onCancel={() => setShowCreate(false)}
        onSubmit={createFolder}
      />

      <JoinEventModal
        visible={showJoinEvent}
        onCancel={() => setShowJoinEvent(false)}
        onJoined={(folderId) => {
          setShowJoinEvent(false);
          fetchFolders();
          router.push(`/eventFolder?folderId=${folderId}` as any);
        }}
      />

      {session?.user?.id && (
        <CreateEventModal
          visible={showCreateEvent}
          userId={session.user.id}
          onCancel={() => setShowCreateEvent(false)}
          onCreated={(folderId) => {
            setShowCreateEvent(false);
            fetchFolders();
            router.push(`/eventFolder?folderId=${folderId}` as any);
          }}
        />
      )}
    </View>
  );
};

// Folders/events are Supabase-backed and outside the Sui migration's 3-feature scope.
const SuiFoldersPlaceholder = () => (
  <View className="flex-1 items-center justify-center bg-white px-8 dark:bg-black">
    <Text className="mb-2 text-lg font-bold text-black dark:text-white">Folders & events</Text>
    <Text className="text-center text-sm text-neutral-500 dark:text-neutral-400">
      Not available in this version yet. Your connections live under "All Connections".
    </Text>
  </View>
);

export default function FoldersTab() {
  return SUI_ENABLED ? <SuiFoldersPlaceholder /> : <Folders />;
}
