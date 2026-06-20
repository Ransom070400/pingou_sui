import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View, Image } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { CheckCircle2 } from 'lucide-react-native';

export type ConnectionToastData = {
  name: string;
  avatarUrl?: string | null;
  onPress?: () => void;
};

/**
 * A lightweight, non-blocking success banner shown when a connection lands.
 * Pass `data` to show it; it auto-dismisses after `duration` and calls onHide.
 * Tapping it runs `data.onPress` (e.g. open the profile) then dismisses.
 */
export default function ConnectionToast({
  data,
  onHide,
  duration = 2800,
}: {
  data: ConnectionToastData | null;
  onHide: () => void;
  duration?: number;
}) {
  // Keep the latest onHide without resetting the dismiss timer on every render.
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => onHideRef.current(), duration);
    return () => clearTimeout(t);
  }, [data, duration]);

  if (!data) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOutUp.duration(250)}
      className="absolute left-4 right-4 top-16 z-50">
      <Pressable
        onPress={() => {
          data.onPress?.();
          onHideRef.current();
        }}
        className="flex-row items-center rounded-2xl bg-white dark:bg-neutral-800 px-4 py-3 shadow-lg active:opacity-90">
        {data.avatarUrl ? (
          <Image source={{ uri: data.avatarUrl }} className="w-10 h-10 rounded-full mr-3" />
        ) : (
          <View className="w-10 h-10 rounded-full mr-3 bg-neutral-200 dark:bg-neutral-700 items-center justify-center">
            <CheckCircle2 size={22} color="#22c55e" />
          </View>
        )}
        <View className="flex-1">
          <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
            Connected with {data.name} 🎉
          </Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">Tap to view profile</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
