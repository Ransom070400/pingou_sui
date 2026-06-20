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
import { createEventFolder } from '~/src/utils/events';
import { Feedback } from '~/src/utils/Feedback';

type Props = {
  visible: boolean;
  userId: string;
  onCancel: () => void;
  onCreated: (folderId: string) => void;
};

const DURATION_PRESETS = [
  { label: '2h', hours: 2 },
  { label: '4h', hours: 4 },
  { label: '8h', hours: 8 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
];

export default function CreateEventModal({ visible, userId, onCancel, onCreated }: Props) {
  const [name, setName] = useState('');
  const [hours, setHours] = useState(4);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setHours(4);
    setBusy(false);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + hours * 3600 * 1000);
      const folder = await createEventFolder({
        userId,
        name: trimmed,
        startsAt,
        endsAt,
      });
      Feedback.success();
      reset();
      onCreated(folder.id);
    } catch (err: any) {
      Feedback.heavy();
      Alert.alert('Could not create event', err.message ?? 'Unknown error');
      setBusy(false);
    }
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
              Create Event
            </Text>
            <Text className="mb-4 text-center text-sm text-neutral-500">
              Admin only · starts immediately
            </Text>

            <TextInput
              className="mb-4 h-12 rounded-full bg-neutral-100 px-4 text-base text-black dark:bg-neutral-700 dark:text-white"
              placeholder="Event name (e.g. DevConnect)"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              autoFocus
              editable={!busy}
            />

            <Text className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Duration
            </Text>
            <View className="mb-5 flex-row flex-wrap gap-2">
              {DURATION_PRESETS.map((p) => {
                const active = p.hours === hours;
                return (
                  <TouchableOpacity
                    key={p.label}
                    onPress={() => setHours(p.hours)}
                    disabled={busy}
                    className={`rounded-full px-4 py-2 ${
                      active ? 'bg-amber-500' : 'bg-neutral-100 dark:bg-neutral-700'
                    }`}>
                    <Text
                      className={`font-semibold ${
                        active ? 'text-white' : 'text-neutral-700 dark:text-neutral-200'
                      }`}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                disabled={busy}
                className="h-11 flex-1 items-center justify-center rounded-full border border-neutral-300"
                onPress={handleCancel}>
                <Text className="font-semibold text-neutral-700 dark:text-neutral-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={busy || !name.trim()}
                className="h-11 flex-1 items-center justify-center rounded-full bg-black dark:bg-white"
                onPress={handleCreate}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold text-white dark:text-black">Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
