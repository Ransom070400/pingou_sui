import React from 'react';
import { View, Text, TextInput, useColorScheme } from 'react-native';
import { Search } from 'lucide-react-native';

type Props = {
  searchQuery: string;
  onSearchChange: (text: string) => void;
};

const ConnectionsHeader = ({ searchQuery, onSearchChange }: Props) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className={`px-4 pb-4 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      <View className="mt-8 mb-4 flex-row items-center justify-center">
        <Text className={`text-xl font-semibold ml-4 ${isDark ? 'text-white' : 'text-black'}`}>
          Connections
        </Text>
      </View>

      <View
        className={`flex-row items-center px-3 py-2 rounded-full border ${
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
        }`}>
        <Search size={20} color="#9CA3AF" />
        <TextInput
          placeholder="Search connections..."
          placeholderTextColor="#9CA3AF"
          className={`flex-1 p-[15px] text-[15px] ${isDark ? 'text-white' : 'text-black'}`}
          returnKeyType="search"
          autoCapitalize="none"
          clearButtonMode="while-editing"
          value={searchQuery}
          onChangeText={onSearchChange}
        />
      </View>
    </View>
  );
};

export default ConnectionsHeader;
