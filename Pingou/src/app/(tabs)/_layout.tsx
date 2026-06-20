import { Link, Tabs } from 'expo-router';
import { User, QrCode, Users } from 'lucide-react-native';
import { View, useColorScheme } from 'react-native';
import { Feedback } from '~/src/utils/Feedback';
import { HeaderButton } from '../../components/HeaderButton';

export default function TabLayout() {
  // Define the height of the tab bar to use in calculations.
  const tabBarHeight = 90; // Increased height to accommodate labels
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // Active tab color - adapts to dark/light mode
        tabBarActiveTintColor: colorScheme === 'dark' ? '#FFFFFF' : '#1F2937',
        // Inactive tab color - adapts to dark/light mode
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280',
        // Custom label styling - ensure labels are visible
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
          marginBottom: 6,
          textAlign: 'center',
        },
        tabBarShowLabel: true, // Explicitly show labels
        // Main tab bar styling - creates the glassy translucent effect
        tabBarStyle: {
          position: 'absolute', // Positions tab bar above content
          bottom: 40, // Fixed distance from the bottom
          height: tabBarHeight, // Use the defined height
          marginHorizontal: '5%', // Even less margin to give more width
          paddingVertical: 12, // More vertical padding for labels
          paddingHorizontal: 12, // Reduced horizontal padding to give more space for text
          borderRadius: 50, // Full pill shape
          backgroundColor:
            colorScheme === 'dark'
              ? 'rgba(40, 40, 40, 0.8)' // Darker, more opaque translucent for dark mode
              : 'rgba(255, 255, 255, 0.75)', // Slightly more transparent for subtle glass effect
          borderTopWidth: 0, // Removes default border
          borderWidth: 1, // Add subtle border
          borderColor:
            colorScheme === 'dark'
              ? 'rgba(255, 255, 255, 0.15)' // More visible light border for dark mode
              : 'rgba(255, 255, 255, 0.2)', // Light border for light mode
          // Elevated floating shadow effect
          elevation: 20, // Strong Android shadow for floating effect
          shadowColor: '#000000', // iOS shadow
          shadowOpacity: 0.25, // More visible shadow for elevation
          shadowRadius: 15, // Larger blur for soft floating effect
          shadowOffset: { width: 0, height: 8 }, // Deeper offset for elevated look
          // Backdrop blur effect (iOS)
          backdropFilter: 'blur(20px)',
        },
        // Individual tab item styling
        tabBarItemStyle: {
          borderRadius: 30,
          marginHorizontal: 8, // Reduced spacing to give more room for text
          paddingVertical: 4,
          paddingHorizontal: 4, // Reduced horizontal padding for more text space
          flex: 1, // Allow tabs to expand equally
        },
        // Active tab background styling
        tabBarActiveBackgroundColor: 'transparent',
      }}>
      <Tabs.Screen
        name="index"
        listeners={{
          tabPress: () => {
            Feedback.medium();
          },
        }}
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color }) => <User color={color} size={24} strokeWidth={2} />,
          headerRight: () => (
            <Link href="/modal" asChild>
              <HeaderButton />
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="scanner"
        listeners={{
          tabPress: () => {
            Feedback.medium();
          },
        }}
        options={{
          title: 'Scan',
          headerShown: false,
          tabBarIcon: () => (
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#1F2937',
                borderWidth: 4, // Add border width
                borderColor: colorScheme === 'dark' ? '#FFFFFF' : '#1F2937', // Border color - white for both modes
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: -45, // More elevated - pushes it higher above the tab bar
                padding: 16, // Added internal padding for more space around the icon
                // Subtle shadow for scan icon
                elevation: 6, // Reduced Android shadow
                shadowColor: '#000000', // iOS shadow
                shadowOpacity: 0.15, // Much lighter shadow
                shadowRadius: 4, // Smaller blur
                shadowOffset: { width: 0, height: 2 }, // Minimal offset
              }}>
              <QrCode
                color={colorScheme === 'dark' ? '#FFFFFF' : '#FFFFFF'} // Inverted icon color
                size={30}
                strokeWidth={2}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(connections)"
        listeners={{
          tabPress: () => {
            Feedback.medium();
          },
        }}
        options={{
          title: 'Connections',
          headerShown: false,
          tabBarIcon: ({ color }) => <Users color={color} size={24} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
