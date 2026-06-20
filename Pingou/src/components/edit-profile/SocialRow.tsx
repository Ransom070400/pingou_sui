import React from 'react';
import { View, Text, TextInput } from 'react-native';

function iconInitial(name: string) {
  switch (name) {
    case 'Instagram':
      return 'IG';
    case 'X':
      return 'X';
    case 'LinkedIn':
      return 'in';
    case 'Behance':
      return 'Be';
    default:
      return '•';
  }
}

export default function SocialRow({
  name,
  value,
  onChangeText,
}: {
  name: string;
  value?: string;
  onChangeText?: (text: string) => void;
}) {
  return (
    <View className="w-full">
      <View className="h-12 w-full flex-row items-center rounded-full bg-neutral-200 dark:bg-neutral-700 px-3">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-neutral-300 dark:bg-neutral-600">
          <Text className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{iconInitial(name)}</Text>
        </View>
        <TextInput
          className="ml-2 flex-1 h-full bg-transparent text-base text-black dark:text-white placeholder:text-neutral-500"
          placeholder={`Your ${name}`}
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          autoCapitalize="none"
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}
