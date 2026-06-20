import React from 'react';
import { View, Text, Pressable } from 'react-native';

export default function AddMoreRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable className="mt-3 flex-row items-center gap-3" onPress={onPress}>
      <View className="h-5 w-5 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-600">
        <Text className="-mt-[1px] text-sm font-semibold text-neutral-700 dark:text-neutral-300">+</Text>
      </View>
      <Text className="text-sm text-neutral-700 dark:text-neutral-300">Click to add more links</Text>
    </Pressable>
  );
}
