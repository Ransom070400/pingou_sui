import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function Header() {
  return (
    <View className="flex-row items-center px-3 h-13 bg-neutral-100">
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        className="w-6 h-6 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text className="text-base text-neutral-900">←</Text>
      </Pressable>
      <Text className="flex-1 text-center text-base font-semibold text-neutral-900">
        Edit Profile
      </Text>
      <View className="w-6" />
    </View>
  );
}
