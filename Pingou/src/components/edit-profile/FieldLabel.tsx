import React from 'react';
import { Text } from 'react-native';

export default function FieldLabel({ text }: { text: string }) {
  return <Text className="mb-2 text-xl font-semibold text-black dark:text-white">{text}</Text>;
}
