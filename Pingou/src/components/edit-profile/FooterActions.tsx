import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Feedback } from '~/src/utils/Feedback';

export default function FooterActions({
  onUpdate,
  loading = false,
}: {
  onUpdate?: () => void;
  loading?: boolean;
}) {
  return (
    <View className="px-3 pb-3">
      <View className="flex-row items-center justify-between gap-3">
        <TouchableOpacity
          className="h-11 flex-1 items-center justify-center rounded-full border border-neutral-300 bg-white"
          onPress={() => {
            Feedback.light();
            router.back();
          }}>
          <Text className="text-[15px] font-semibold text-neutral-800">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-black"
          disabled={loading}
          onPress={() => {
            Feedback.light();
            onUpdate?.();
          }}>
          <Text className="text-[15px] font-semibold text-white">
            {loading ? 'Saving...' : 'Update'}
          </Text>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
            <Text className="-mt-[2px] text-lg text-black">→</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
