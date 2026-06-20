import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/*
    Haptic feedback is only used on iOS as it offers very subtle and precise feedback which
    brings joy and happiness to your soul :)
*/

// Lazily-created, reused player for the connection "ping". A single instance is
// kept and re-seeked so rapid pings don't stack up new players. By default this
// respects the iOS silent switch (we don't enable playsInSilentMode), while the
// haptic below always fires — so silent-mode users still feel the confirmation.
let pingPlayer: AudioPlayer | null = null;

export class Feedback {
  static light() {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  static medium() {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  static heavy() {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  static soft = () => {
    if (Platform.OS === 'ios')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  static success = () => {
    if (Platform.OS === 'ios')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  static selection = () => {
    if (Platform.OS === 'ios') Haptics.selectionAsync();
  };

  /**
   * The signature Pingou "ping": a short chime + success haptic, fired the
   * moment a connection lands. Sound is best-effort and never blocks the flow.
   */
  static ping = () => {
    Feedback.success();
    try {
      if (!pingPlayer) {
        pingPlayer = createAudioPlayer(require('../../assets/sounds/ping.wav'));
      }
      pingPlayer.seekTo(0);
      pingPlayer.play();
    } catch {
      // Audio is a nice-to-have; swallow errors so sign-in/connection flow is unaffected.
    }
  };
}