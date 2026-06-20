// Polyfill crypto before any Sui/Seal code runs (Hermes lacks these).
// Order matters: getRandomValues first, then the crypto.subtle shim that uses it.
import 'react-native-get-random-values';
import '../lib/sui/cryptoPolyfill';
import '../../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthProvider';
import { SuiAuthProvider, useSuiAuth } from '../context/SuiAuthProvider';
import { SUI_ENABLED } from '../lib/sui/config';
import LoadingPenguins from '../components/LoadingPenguins';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  if (SUI_ENABLED) {
    return (
      <SuiAuthProvider>
        <SuiRootLayoutNav />
      </SuiAuthProvider>
    );
  }
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const Loader = () => (
  <LoadingPenguins
    penguinSize={220}
    size={460}
    penguinSource={require('../../assets/PingouLogoWOBG.png')}
  />
);

// Sui-mode routing: gate purely on a zkLogin address. Profile setup is handled
// inside the app (the home tab prompts when no profile exists yet).
function SuiRootLayoutNav() {
  const colorScheme = useColorScheme();
  const { address, loading } = useSuiAuth();

  if (loading) return <Loader />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Protected guard={!address}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!!address}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="editProfile" options={{ title: 'Edit Profile', presentation: 'modal', headerTransparent: true }} />
            <Stack.Screen name="connectionDetail" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="eventFolder" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Screen name="modal" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { profile, session, loading } = useAuth();

  if (loading) {
    return (
      <LoadingPenguins
        penguinSize={220}
        size={460}
        penguinSource={require('../../assets/PingouLogoWOBG.png')}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Protected guard={!session || !profile}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!!session && !!profile}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name='editProfile' options={{ title: "Edit Profile", presentation: "modal", headerTransparent: true}} />
            <Stack.Screen name='connectionDetail' options={{ headerShown: false, presentation: "modal" }} />
            <Stack.Screen name='eventFolder' options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Screen name="modal" options={{ headerShown: false, presentation: "modal" }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
