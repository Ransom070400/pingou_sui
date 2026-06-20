import React from 'react';
import { View, TextInput } from 'react-native';

export default function PlaceholderInput({
  tall = false,
  value,
  onChangeText,
  placeholder = 'Type something...',
}: {
  tall?: boolean;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <View className={tall ? 'h-24 rounded-xl bg-neutral-200 dark:bg-neutral-700' : 'h-12 rounded-full bg-neutral-200 dark:bg-neutral-700'}>
      <TextInput
        className="h-full w-full rounded-xl bg-transparent px-4 py-2 text-base text-black dark:text-white placeholder:text-neutral-500"
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        multiline={tall}
      />
    </View>
  );
}
