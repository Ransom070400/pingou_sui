import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, useColorScheme, Alert, RefreshControl, Share, Text, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogOut, Share2, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from '~/src/lib/supabase';
import { useAuth } from '~/src/context/AuthProvider';
import { useSuiAuth } from '~/src/context/SuiAuthProvider';
import { SUI_ENABLED } from '~/src/lib/sui/config';
import { buildConnectQR } from '~/src/lib/sui/share';
import { getMyConnections, loadConnectionCard, deleteOwnProfile } from '~/src/lib/sui/profileService';
import { wasAnnounced, markAnnounced } from '~/src/lib/sui/announced';
import { onConnection } from '~/src/lib/sui/realtime';
import ConnectionSuccess, { ConnectionSuccessData } from '~/src/components/ConnectionSuccess';

import ProfileHeader from '~/src/components/profile/ProfileHeader';
import { StatsCard } from '~/src/components/profile/StatsRow';
import ContactInfo from '~/src/components/profile/ContactInfo';
import SocialLinks from '~/src/components/profile/SocialLinks';
import ProfileQRCode from '~/src/components/profile/ProfileQRCode';

import { buildSocialLinks } from '~/src/utils/buildSocialLinks';
import { ProfileSkeleton } from '~/src/components/Skeleton';
import { Feedback } from '~/src/utils/Feedback';

// Every connection a user makes is worth this many Ping Tokens.
const TOKENS_PER_CONNECTION = 10;

const SupabaseHome: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#ffffff' : '#111827';
  const { profile, setProfile, session } = useAuth();
  const [connectionCount, setConnectionCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const socialList = useMemo(() => (profile ? buildSocialLinks(profile) : []), [profile]);

  const fetchStats = useCallback(async () => {
    if (!session?.user?.id) return;
    const { count } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', session.user.id);
    setConnectionCount(count ?? 0);
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    if (data) setProfile(data);
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchStats()]);
    setRefreshing(false);
  }, [refreshProfile, fetchStats]);

  const handleShare = async () => {
    if (!profile) return;
    Feedback.light();
    try {
      await Share.share({
        message: `Connect with ${profile.fullname} on Pingou!\n\nUser ID: ${profile.user_id}`,
      });
    } catch (_) {}
  };

  const handleLogout = () => {
    Feedback.medium();
    Alert.alert('Confirm Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Logout Error', error.message);
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Feedback.heavy();
    Alert.alert(
      'Delete Account',
      'This will permanently delete your profile, connections, and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'Type is final. All your data will be gone forever.', [
              { text: 'Go Back', style: 'cancel' },
              {
                text: 'Yes, Delete',
                style: 'destructive',
                onPress: async () => {
                  if (!session?.user?.id) return;
                  // Delete connections, folders, profile in order
                  await supabase.from('connections').delete().eq('owner_id', session.user.id);
                  await supabase.from('connections').delete().eq('connected_to', session.user.id);
                  await supabase.from('folders').delete().eq('owner_id', session.user.id);
                  await supabase.from('profiles').delete().eq('user_id', session.user.id);
                  // Delete storage
                  await supabase.storage.from('pfp').remove([`${session.user.id}.jpg`]);
                  // Sign out
                  await supabase.auth.signOut();
                },
              },
            ]);
          },
        },
      ]
    );
  };

  if (!profile) {
    return <ProfileSkeleton />;
  }

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      {/* Top-right action buttons */}
      <View style={{ position: 'absolute', top: insets.top + 8, right: 16, zIndex: 10, flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.6}
          className="h-9 w-9 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
          <Share2 size={16} color={iconColor} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.6}
          className="h-9 w-9 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
          <LogOut size={16} color={iconColor} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <ProfileHeader
          fullName={profile.fullname}
          tagline={profile.bio || profile.nickname}
          avatarUrl={profile.profile_url}
        />

        <StatsCard pingTokens={connectionCount * TOKENS_PER_CONNECTION} connections={connectionCount} />

        <View className="mt-8">
          <ProfileQRCode userId={profile.user_id} />
        </View>

        <View className="mt-6">
          <ContactInfo email={profile.email} phone={profile.phone} />
        </View>

        <View className="mb-8 mt-6">
          <SocialLinks links={socialList} />
        </View>

        {/* Delete account — bottom of profile */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          className="mx-4 mb-4 flex-row items-center justify-center rounded-xl py-3">
          <Trash2 size={16} color="#EF4444" />
          <Text className="ml-2 text-sm text-red-500">Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// ── Sui-mode home: profile from zkLogin + on-chain Profile (Walrus+Seal). ──
const SuiHome: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#ffffff' : '#111827';
  const { address, signer, profile, profileRef, busy, loading, logout, refresh } = useSuiAuth();
  const [incoming, setIncoming] = useState<ConnectionSuccessData | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const knownAddrs = useRef<Set<string> | null>(null);

  // Instant path: the scanner notifies us over the realtime relay the moment they
  // connect, so we pop the checkmark immediately (no waiting on the chain poll).
  useEffect(() => {
    const unsub = onConnection((c) => {
      knownAddrs.current?.add(c.from);
      markAnnounced(c.from);
      Feedback.ping();
      setIncoming({
        loading: false,
        name: c.name ?? 'New connection',
        avatarUrl: c.avatar ?? null,
        address: c.from,
        onViewProfile: c.profileId
          ? () =>
              router.push({
                pathname: '/connectionDetail',
                params: { profileId: c.profileId!, address: c.from },
              })
          : undefined,
      });
    });
    return unsub;
  }, []);

  // Fallback: while the QR is on screen, also watch our own allow table in case the
  // realtime notify was missed — when someone scans us we get added to it.
  useFocusEffect(
    useCallback(() => {
      if (!address || !signer || !profile) return;
      let active = true;
      const poll = async () => {
        try {
          const conns = await getMyConnections(address);
          setConnectionCount(conns.length);
          if (knownAddrs.current === null) {
            knownAddrs.current = new Set(conns.map((c) => c.address)); // baseline
            return;
          }
          for (const c of conns) {
            if (knownAddrs.current.has(c.address)) continue;
            knownAddrs.current.add(c.address);
            if (wasAnnounced(c.address)) continue; // already shown (we were the scanner)
            markAnnounced(c.address);
            try {
              const card = await loadConnectionCard(address, signer, c.profileObjectId);
              if (!active) return;
              Feedback.ping();
              setIncoming({
                loading: false,
                name: card.fullname ?? 'New connection',
                avatarUrl: card.avatar ?? null,
                address: c.address,
                onViewProfile: () =>
                  router.push({
                    pathname: '/connectionDetail',
                    params: { profileId: c.profileObjectId, address: c.address },
                  }),
              });
            } catch {}
          }
        } catch {}
      };
      poll();
      const id = setInterval(poll, 5000);
      return () => {
        active = false;
        clearInterval(id);
      };
    }, [address, signer, profile])
  );

  // QR encodes address + profile id + share-code so one scan exchanges both cards.
  const qrValue = useMemo(
    () =>
      address && profileRef && profile?.shareCode
        ? buildConnectQR({ address, profileId: profileRef.profileObjectId, code: profile.shareCode })
        : (address ?? ''),
    [address, profileRef, profile?.shareCode]
  );

  const socialList = useMemo(
    () => (profile ? buildSocialLinks(profile as any) : []),
    [profile]
  );

  const handleLogout = () => {
    Feedback.medium();
    Alert.alert('Confirm Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleShare = async () => {
    if (!qrValue || !profile) return;
    Feedback.light();
    try {
      await Share.share({ message: `Connect with ${profile.fullname} on Pingou:\n${qrValue}` });
    } catch {}
  };

  const handleDeleteAccount = () => {
    Feedback.heavy();
    Alert.alert(
      'Delete Account',
      'This revokes everyone’s access to your card and erases its contents, then signs you out. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!address || !signer) return;
            try {
              await deleteOwnProfile(address, signer);
            } catch (e: any) {
              Alert.alert('Could not delete', e?.message ?? 'Please try again.');
              return;
            }
            await logout();
          },
        },
      ]
    );
  };

  // Show the skeleton whenever a profile load is in flight and we don't have one
  // yet — otherwise the post-login load (RPC + Walrus + Seal) would briefly flash
  // the "Create profile" screen even when a profile exists.
  if ((loading || busy) && !profile) return <ProfileSkeleton />;

  // Signed in, load finished, genuinely no profile yet — welcoming setup screen.
  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-100 px-8 dark:bg-neutral-900">
        <Image
          source={require('../../../assets/PingouLogoWOBG.png')}
          className="mb-2 h-[150px] w-[120px]"
          resizeMode="contain"
        />
        <Text className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
          Welcome to Pingou
        </Text>
        <Text className="mb-9 text-center text-sm leading-5 text-neutral-500 dark:text-neutral-400">
          Let's set up your card — add your name, photo, and socials. It stays private
          until you choose to share it.
        </Text>
        <TouchableOpacity
          onPress={() => {
            Feedback.medium();
            router.push('/editProfile');
          }}
          className="w-full flex-row items-center justify-center rounded-full bg-black py-4 dark:bg-white">
          <Text className="text-base font-semibold text-white dark:text-black">Set up my card</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} className="mt-8">
          <Text className="text-xs text-neutral-400">Log out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      {/* Top-right action buttons */}
      <View
        style={{ position: 'absolute', top: insets.top + 8, right: 16, zIndex: 10, flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.6}
          className="h-9 w-9 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
          <Share2 size={16} color={iconColor} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.6}
          className="h-9 w-9 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
          <LogOut size={16} color={iconColor} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}>
        <ProfileHeader
          fullName={profile.fullname}
          tagline={profile.bio || profile.nickname || ''}
          avatarUrl={profile.avatar}
        />

        <StatsCard pingTokens={connectionCount * TOKENS_PER_CONNECTION} connections={connectionCount} />

        {/* QR carries address + profile id + share-code → one scan = two-way exchange. */}
        <View className="mt-8">
          <ProfileQRCode userId={qrValue} />
        </View>

        <View className="mt-6">
          <ContactInfo email={profile.email} phone={profile.phone} />
        </View>

        <View className="mb-8 mt-6">
          <SocialLinks links={socialList} />
        </View>

        {/* Delete account — bottom of profile */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          className="mx-4 mb-4 flex-row items-center justify-center rounded-xl py-3">
          <Trash2 size={16} color="#EF4444" />
          <Text className="ml-2 text-sm text-red-500">Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Pops when someone scans us (the scanned-device side of the exchange). */}
      <ConnectionSuccess data={incoming} onClose={() => setIncoming(null)} />
    </View>
  );
};

export default function Index() {
  return SUI_ENABLED ? <SuiHome /> : <SupabaseHome />;
}
