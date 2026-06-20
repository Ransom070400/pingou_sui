import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, QrCode, Trophy, Users, X } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '~/src/lib/supabase';
import { useAuth } from '~/src/context/AuthProvider';
import {
  buildEventQrValue,
  fetchEventFolder,
  fetchLeaderboard,
  LeaderboardRow,
} from '~/src/utils/events';

type EventDetail = {
  id: string;
  name: string;
  join_code: string;
  starts_at: string | null;
  ends_at: string | null;
};

type Participant = {
  user_id: string;
  joined_at: string;
  profile: {
    fullname: string;
    email: string;
    profile_url: string | null;
  } | null;
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase();

const formatRemaining = (endsAt: string | null) => {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

const EventFolderScreen = () => {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tab, setTab] = useState<'leaderboard' | 'participants'>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [, setTick] = useState(0);

  const loadAll = useCallback(async () => {
    if (!folderId) return;
    try {
      const [folder, lb, parts] = await Promise.all([
        fetchEventFolder(folderId),
        fetchLeaderboard(folderId),
        supabase
          .from('event_participants')
          .select('user_id, joined_at, profiles:user_id(fullname, email, profile_url)')
          .eq('folder_id', folderId)
          .order('joined_at', { ascending: true }),
      ]);
      setEvent(folder as EventDetail);
      setLeaderboard(lb);
      setParticipants(
        ((parts.data ?? []) as any[]).map((p) => ({
          user_id: p.user_id,
          joined_at: p.joined_at,
          profile: p.profiles,
        }))
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not load event');
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAll();
    }, [loadAll])
  );

  // Re-render countdown every 60s.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  if (loading && !event) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <Text className="text-neutral-500">Event not found</Text>
      </View>
    );
  }

  const remaining = formatRemaining(event.ends_at);
  const ended = remaining === 'Ended';
  const qrValue = buildEventQrValue(event.join_code);

  return (
    <View className="flex-1 bg-white dark:bg-black" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} className="p-1">
            <ArrowLeft size={22} color="#111" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowQr(true)}
            className="flex-row items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5">
            <QrCode size={14} color="#D97706" />
            <Text className="text-sm font-bold tracking-widest text-amber-700">
              {event.join_code}
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="mt-3 text-2xl font-bold text-black dark:text-white">{event.name}</Text>
        {remaining && (
          <Text
            className={`mt-1 text-sm ${ended ? 'text-neutral-400' : 'text-amber-600'}`}>
            {ended ? 'Event ended' : `${remaining} · ${participants.length} joined`}
          </Text>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-neutral-100 dark:border-neutral-800">
        {(
          [
            { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
            { key: 'participants', label: 'Participants', icon: Users },
          ] as const
        ).map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              className="flex-1 flex-row items-center justify-center gap-2 py-3">
              <Icon size={16} color={active ? '#D97706' : '#9CA3AF'} />
              <Text
                className={`font-semibold ${
                  active ? 'text-amber-600' : 'text-neutral-500'
                }`}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'leaderboard' ? (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center pt-16">
              <Trophy size={48} color="#D1D5DB" />
              <Text className="mt-4 text-base text-neutral-500">No connections yet</Text>
              <Text className="mt-1 text-sm text-neutral-400">
                Start scanning people to climb the board
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const rank = index + 1;
            const isMe = item.user_id === session?.user?.id;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
            return (
              <TouchableOpacity
                onPress={() =>
                  !isMe &&
                  router.push({
                    pathname: '/connectionDetail',
                    params: { userId: item.user_id },
                  })
                }
                activeOpacity={isMe ? 1 : 0.7}
                className={`flex-row items-center border-b border-neutral-100 px-4 py-3 dark:border-neutral-800 ${
                  isMe ? 'bg-amber-50 dark:bg-amber-950/20' : ''
                }`}>
                <View className="w-10 items-center">
                  {medal ? (
                    <Text className="text-2xl">{medal}</Text>
                  ) : (
                    <Text className="text-base font-bold text-neutral-400">{rank}</Text>
                  )}
                </View>
                <View className="ml-2 h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                  {item.profile?.profile_url ? (
                    <Image
                      source={{ uri: item.profile.profile_url }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
                      {getInitials(item.profile?.fullname ?? '?')}
                    </Text>
                  )}
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-black dark:text-white">
                    {item.profile?.fullname ?? 'Unknown'}
                    {isMe && <Text className="text-amber-600"> · you</Text>}
                  </Text>
                  <Text className="text-sm text-neutral-500">
                    {item.score} {item.score === 1 ? 'connection' : 'connections'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={participants}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center pt-16">
              <Users size={48} color="#D1D5DB" />
              <Text className="mt-4 text-base text-neutral-500">No one has joined yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.user_id === session?.user?.id;
            return (
              <TouchableOpacity
                onPress={() =>
                  !isMe &&
                  router.push({
                    pathname: '/connectionDetail',
                    params: { userId: item.user_id },
                  })
                }
                activeOpacity={isMe ? 1 : 0.7}
                className="flex-row items-center border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
                <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                  {item.profile?.profile_url ? (
                    <Image
                      source={{ uri: item.profile.profile_url }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
                      {getInitials(item.profile?.fullname ?? '?')}
                    </Text>
                  )}
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-black dark:text-white">
                    {item.profile?.fullname ?? 'Unknown'}
                    {isMe && <Text className="text-amber-600"> · you</Text>}
                  </Text>
                  <Text className="text-sm text-neutral-500">{item.profile?.email}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* QR modal */}
      <Modal visible={showQr} transparent animationType="fade" onRequestClose={() => setShowQr(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/80"
          onPress={() => setShowQr(false)}>
          <Pressable className="rounded-3xl bg-white p-8 dark:bg-neutral-900" onPress={() => {}}>
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-black dark:text-white">{event.name}</Text>
              <TouchableOpacity onPress={() => setShowQr(false)} hitSlop={12}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <Text className="mt-1 text-sm text-neutral-500">Scan to join this event</Text>
            <View className="mt-6 items-center rounded-2xl bg-white p-4">
              <QRCode value={qrValue} size={240} backgroundColor="#ffffff" color="#000000" />
            </View>
            <View className="mt-6 items-center">
              <Text className="text-xs uppercase text-neutral-500">or enter code</Text>
              <Text className="mt-1 text-4xl font-bold tracking-[8px] text-black dark:text-white">
                {event.join_code}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default EventFolderScreen;
