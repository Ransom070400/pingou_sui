import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { QrCode } from 'lucide-react-native';
import { router } from 'expo-router';
import { joinEventByCode } from '~/src/utils/events';
import { Feedback } from '~/src/utils/Feedback';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onJoined: (folderId: string) => void;
};

export default function JoinEventModal({ visible, onCancel, onJoined }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCode('');
    setBusy(false);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setBusy(true);
    try {
      const folderId = await joinEventByCode(trimmed);
      Feedback.success();
      reset();
      onJoined(folderId);
    } catch (err: any) {
      Feedback.heavy();
      Alert.alert('Could not join event', err.message ?? 'Unknown error');
      setBusy(false);
    }
  };

  const handleScan = () => {
    reset();
    onCancel();
    router.push('/(tabs)/scanner');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={handleCancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            className="mx-8 w-80 rounded-2xl bg-white p-6 dark:bg-neutral-800"
            onPress={() => {}}>
            <Text className="mb-1 text-center text-lg font-semibold text-black dark:text-white">
              Join Event
            </Text>
            <Text className="mb-4 text-center text-sm text-neutral-500">
              Enter the 6-character code from the host
            </Text>

            <TextInput
              className="mb-3 h-12 rounded-full bg-neutral-100 px-4 text-center text-lg font-bold tracking-[4px] text-black dark:bg-neutral-700 dark:text-white"
              placeholder="ABC123"
              placeholderTextColor="#9CA3AF"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoFocus
              autoCapitalize="characters"
              maxLength={8}
              onSubmitEditing={handleSubmit}
              editable={!busy}
            />

            <TouchableOpacity
              onPress={handleScan}
              className="mb-4 flex-row items-center justify-center gap-2 py-2">
              <QrCode size={16} color="#D97706" />
              <Text className="font-medium text-amber-600">or scan the event QR</Text>
            </TouchableOpacity>

            <View className="flex-row gap-3">
              <TouchableOpacity
                disabled={busy}
                className="h-11 flex-1 items-center justify-center rounded-full border border-neutral-300"
                onPress={handleCancel}>
                <Text className="font-semibold text-neutral-700 dark:text-neutral-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={busy || !code.trim()}
                className="h-11 flex-1 items-center justify-center rounded-full bg-black dark:bg-white"
                onPress={handleSubmit}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold text-white dark:text-black">Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
