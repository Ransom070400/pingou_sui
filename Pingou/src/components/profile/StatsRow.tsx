import React from 'react';
import { View, Text } from 'react-native';
import { Trophy, User, Users } from 'lucide-react-native';

interface StatsCardProps {
  pingTokens: number;
  connections: number;
}

export const StatsCard: React.FC<StatsCardProps> = ({ pingTokens, connections }) => {
  return (
    // Main container with rounded corners and dark background
    <View className="bg-gray-900 mt-6 rounded-2xl p-6 mx-4">
      {/* Flexbox container to place items side by side */}
      <View className="flex-row justify-between items-center">
        
        {/* Left side - Ping Tokens */}
        <View className="flex-1 items-center">
          {/* Trophy icon placeholder - you can replace with actual icon */}
          <View className="w-16 h-16 p-2 bg-white rounded-full mb-3 items-center justify-center">
            <Trophy color={"orange"} />
          </View>
          {/* Large number display */}
          <Text className="text-white text-4xl font-bold">{pingTokens}</Text>
          {/* Label text */}
          <Text className="text-gray-400 text-xl font-semibold mt-1">Ping Tokens</Text>
        </View>

        {/* Vertical divider line */}
        <View className="w-px h-16 bg-gray-700 mx-4" />

        {/* Right side - Connections */}
        <View className="flex-1 items-center">
          {/* People icon placeholder */}
          <View className="w-16 h-16 p-2 bg-white rounded-full mb-3 items-center justify-center">
          <Users color={"black"} />
          </View>
          {/* Large number display */}
          <Text className="text-white text-4xl font-bold">{connections}</Text>
          {/* Label text */}
          <Text className="text-gray-400 text-xl font-semibold mt-1">Connections</Text>
        </View>
      </View>
    </View>
  );
};