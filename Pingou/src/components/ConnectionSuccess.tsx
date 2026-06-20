import React, { useEffect } from 'react';
import { View, Text, Modal, Image, Pressable, ActivityIndicator } from 'react-native';
import Animated, { ZoomIn, FadeIn, FadeOut } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { colorFromAddress } from '~/src/utils/avatarColor';

export interface ConnectionSuccessData {
  /** While true, show a spinner ("Connecting…"); the exchange is still in flight. */
  loading?: boolean;
  name?: string;
  avatarUrl?: string | null;
  address?: string;
  onViewProfile?: () => void;
}

/**
 * Connection feedback overlay. Pops up instantly on scan with a spinner, then
 * morphs into an animated green checkmark + the person's name when the on-chain
 * exchange completes. Auto-dismisses once resolved.
 */
export default function ConnectionSuccess({
  data,
  onClose,
}: {
  data: ConnectionSuccessData | null;
  onClose: () => void;
}) {
  const loading = !!data?.loading;

  useEffect(() => {
    if (!data || loading) return; // keep it up while the exchange runs
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [data, loading, onClose]);

  if (!data) return null;
  const initials = (data.name ?? '')
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Modal transparent visible animationType="none" onRequestClose={loading ? undefined : onClose}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(180)}
        className="flex-1 items-center justify-center bg-black/60 px-10">
        {!loading && <Pressable className="absolute inset-0" onPress={onClose} />}
        <Animated.View
          entering={ZoomIn.springify().damping(13).stiffness(140)}
          className="w-full items-center rounded-3xl bg-white px-6 py-8 dark:bg-neutral-900">
          {loading ? (
            <>
              <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <ActivityIndicator size="large" color="#22c55e" />
              </View>
              <Text className="text-xl font-bold text-neutral-900 dark:text-white">Connecting…</Text>
              <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Exchanging cards securely
              </Text>
            </>
          ) : (
            <>
              {/* Animated check badge */}
              <Animated.View
                entering={ZoomIn.springify().damping(9)}
                className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-green-500">
                <Check size={44} color="#fff" strokeWidth={3} />
              </Animated.View>

              <Text className="text-xl font-bold text-neutral-900 dark:text-white">Connected!</Text>

              <View className="mt-4 flex-row items-center">
                <View
                  className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
                  style={!data.avatarUrl && data.address ? { backgroundColor: colorFromAddress(data.address) } : undefined}>
                  {data.avatarUrl ? (
                    <Image source={{ uri: data.avatarUrl }} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <Text className="text-xs font-bold text-white">{initials}</Text>
                  )}
                </View>
                <Text className="ml-2 text-base font-medium text-neutral-700 dark:text-neutral-200" numberOfLines={1}>
                  {data.name}
                </Text>
              </View>

              {data.onViewProfile && (
                <Pressable
                  onPress={() => {
                    onClose();
                    data.onViewProfile?.();
                  }}
                  className="mt-6 h-11 w-full items-center justify-center rounded-full bg-black active:opacity-90 dark:bg-white">
                  <Text className="font-semibold text-white dark:text-black">View profile</Text>
                </Pressable>
              )}
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
