import React from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '~/src/context/AuthProvider';

export default function AuthLayout() {
  const { session } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* No session yet → show welcome / sign in / sign up */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="welcome" options={{ title: 'Welcome' }} />
        <Stack.Screen name="signin" options={{ title: 'Sign in' }} />
        <Stack.Screen name="signup" options={{ title: 'Sign up' }} />
        <Stack.Screen name="forgotPassword" options={{ title: 'Forgot Password' }} />
      </Stack.Protected>

      {/* Has session but no profile yet → show onboarding (profile creation) */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="onboarding" options={{ title: 'Onboarding' }} />
      </Stack.Protected>
    </Stack>
  );
}
