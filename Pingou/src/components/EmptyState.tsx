import React from 'react';
import { View, Text, Image } from 'react-native';

type EmptyStateProps = {
  // Title line e.g. "No Folders yet"
  title: string;
  // Short description text line
  description?: string;
  // Optional bigger emoji/icon-like char (kept simple to avoid extra deps)
  emoji?: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, emoji = '' }) => {
  return (
    // Center the block; do not force full-screen so parent can control layout
    <View className="items-center justify-center px-6">
      {/* Big emoji as lightweight illustration */}
      <Image
        // Use a larger size; values are dp (density‑independent pixels)
        source={require('../../assets/PingouLogoWOBG.png')}
        style={{ width: 160, height: 160 }}
        resizeMode="contain"
      />

      {/* Title: readable in both modes */}
      <Text className="text-center text-2xl font-semibold text-black dark:text-white">{title}</Text>

      {/* Description: softer contrast */}
      {description ? (
        <Text className="mt-2 text-center text-gray-600 dark:text-gray-400">{description}</Text>
      ) : null}
    </View>
  );
};

export default EmptyState;
