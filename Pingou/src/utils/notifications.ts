import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const isExpoGo = Constants.appOwnership === 'expo';

// Configure how notifications appear when the app is in the foreground.
// Skip in Expo Go — remote push was removed in SDK 53+ and the handler errors on Android.
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Registers for push notifications and saves the token to the user's profile.
 * Call this after the user is authenticated.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Skip entirely in Expo Go (remote push was removed in SDK 53+)
  if (isExpoGo) {
    console.log('Skipping push registration: running in Expo Go. Use a dev build.');
    return null;
  }

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Get the Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Save token to the user's profile in Supabase
    await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('user_id', userId);

    console.log('Push token registered:', token);
    return token;
  } catch (err) {
    console.error('Failed to get push token:', err);
    return null;
  }
}
