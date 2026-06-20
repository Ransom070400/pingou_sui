import React, { createContext, useContext, useState } from 'react';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, useColorScheme } from 'react-native';
import ConnectionsHeader from '../../../components/ConnectionsHeader';

const TopTabs = withLayoutContext(createMaterialTopTabNavigator().Navigator);

// Share search state between layout and child screens
const SearchContext = createContext<{ query: string; setQuery: (q: string) => void }>({
  query: '',
  setQuery: () => {},
});
export const useSearchQuery = () => useContext(SearchContext);

const ConnectionsLayout = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [query, setQuery] = useState('');

  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          backgroundColor: isDark ? '#111827' : '#ffffff',
        }}>
        <ConnectionsHeader searchQuery={query} onSearchChange={setQuery} />

        <TopTabs
          screenOptions={{
            tabBarStyle: {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              elevation: 0,
              shadowOpacity: 0,
            },
            tabBarLabelStyle: {
              fontSize: 14,
              fontWeight: '600',
            },
            tabBarIndicatorStyle: {
              backgroundColor: 'orange',
              height: 3,
            },
            tabBarActiveTintColor: isDark ? '#fff' : 'black',
            tabBarInactiveTintColor: isDark ? '#9CA3AF' : '#6B7280',
          }}>
          <TopTabs.Screen name="index" options={{ title: 'All Connections' }} />
          <TopTabs.Screen name="folders" options={{ title: 'Folders' }} />
        </TopTabs>
      </View>
    </SearchContext.Provider>
  );
};

export default ConnectionsLayout;
