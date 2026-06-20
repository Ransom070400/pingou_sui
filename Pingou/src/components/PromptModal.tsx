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
} from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

export default function PromptModal({
  visible,
  title,
  placeholder = '',
  submitLabel = 'Create',
  onCancel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  };

  const handleCancel = () => {
    setValue('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={handleCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            className="mx-8 w-80 rounded-2xl bg-white p-6 dark:bg-neutral-800"
            onPress={() => {}}>
            <Text className="mb-4 text-center text-lg font-semibold text-black dark:text-white">
              {title}
            </Text>

            <TextInput
              className="mb-4 h-12 rounded-full bg-neutral-100 px-4 text-base text-black dark:bg-neutral-700 dark:text-white"
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              value={value}
              onChangeText={setValue}
              autoFocus
              onSubmitEditing={handleSubmit}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="h-11 flex-1 items-center justify-center rounded-full border border-neutral-300"
                onPress={handleCancel}>
                <Text className="font-semibold text-neutral-700 dark:text-neutral-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="h-11 flex-1 items-center justify-center rounded-full bg-black dark:bg-white"
                onPress={handleSubmit}>
                <Text className="font-semibold text-white dark:text-black">{submitLabel}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
