import React from 'react';
import { View, Text } from 'react-native';

export default function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="px-3 pb-4">
      <View className="rounded-2xl bg-white dark:bg-neutral-800 p-4 shadow-sm">
         <Text className="mb-2 mt-3 text-xl text-neutral-900 dark:text-white font-semibold pb-4">{title}</Text>
        {children}
      </View>
    </View>
  );
}
