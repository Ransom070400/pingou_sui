import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, useColorScheme } from 'react-native';
import { Check } from 'lucide-react-native';
import OnboardingCard from './OnboardingCard';
import { SOCIAL_PLATFORMS, CATEGORIES, SocialPlatform } from '~/src/config/socialPlatforms';
import { SocialsMap } from '~/src/types/ProfileTypes';

type Props = {
  initial?: SocialsMap;
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onContinue: (data: SocialsMap) => void;
};

export default function SocialsCard({
  initial,
  currentStep,
  totalSteps,
  onBack,
  onContinue,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Track which platforms are selected
  const [selected, setSelected] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (initial) {
      Object.keys(initial).forEach((key) => {
        if (initial[key]?.trim()) set.add(key);
      });
    }
    return set;
  });

  // Track values for each platform
  const [values, setValues] = useState<SocialsMap>(initial ?? {});

  const togglePlatform = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Clear the value when deselecting
        setValues((v) => {
          const copy = { ...v };
          delete copy[id];
          return copy;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateValue = (id: string, text: string) => {
    setValues((prev) => ({ ...prev, [id]: text }));
  };

  // At least one platform must be selected and have a value
  const hasAny = Array.from(selected).some((id) => values[id]?.trim());

  const handleContinue = () => {
    // Only include selected platforms with non-empty values
    const result: SocialsMap = {};
    selected.forEach((id) => {
      const val = values[id]?.trim();
      if (val) result[id] = val;
    });
    onContinue(result);
  };

  const renderPlatform = (platform: SocialPlatform) => {
    const isSelected = selected.has(platform.id);
    const Icon = platform.icon;

    return (
      <View key={platform.id} className="mb-2">
        {/* Platform row — tap to toggle */}
        <TouchableOpacity
          onPress={() => togglePlatform(platform.id)}
          className={`flex-row items-center rounded-xl px-3 py-3 ${
            isSelected
              ? 'bg-neutral-200 dark:bg-neutral-600'
              : 'bg-neutral-100 dark:bg-neutral-700'
          }`}
          activeOpacity={0.7}>
          {/* Icon */}
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: platform.color + '20' }}>
            <Icon size={18} color={platform.color} />
          </View>

          {/* Label + description */}
          <View className="ml-3 flex-1">
            <Text className="text-sm font-semibold text-black dark:text-white">
              {platform.label}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {platform.description}
            </Text>
          </View>

          {/* Checkbox */}
          <View
            className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
              isSelected
                ? 'border-black bg-black dark:border-white dark:bg-white'
                : 'border-neutral-300 dark:border-neutral-500'
            }`}>
            {isSelected && <Check size={14} color={isDark ? '#000' : '#fff'} strokeWidth={3} />}
          </View>
        </TouchableOpacity>

        {/* Input field — shown when selected */}
        {isSelected && (
          <View className="mt-1 ml-12 mr-1 mb-1">
            <TextInput
              className="h-10 rounded-lg bg-white dark:bg-neutral-800 px-3 text-sm text-black dark:text-white"
              placeholder={platform.placeholder}
              placeholderTextColor="#9CA3AF"
              value={values[platform.id] ?? ''}
              onChangeText={(t) => updateValue(platform.id, t)}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <OnboardingCard
      currentStep={currentStep}
      totalSteps={totalSteps}
      title="Link your socials"
      subtitle="Select the platforms you use">
      <ScrollView
        className="max-h-[380px]"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {CATEGORIES.map((cat) => {
          const platforms = SOCIAL_PLATFORMS.filter((p) => p.category === cat.key);
          return (
            <View key={cat.key} className="mb-3">
              <Text className="mb-2 text-xs font-bold uppercase text-neutral-400 dark:text-neutral-500">
                {cat.label}
              </Text>
              {platforms.map(renderPlatform)}
            </View>
          );
        })}
      </ScrollView>

      {/* Actions */}
      <View className="mt-3 flex-row">
        <TouchableOpacity
          onPress={onBack}
          className="mr-3 h-12 flex-1 flex-row items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600">
          <Text className="font-medium text-neutral-800 dark:text-neutral-200">Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!hasAny}
          onPress={handleContinue}
          className={`h-12 flex-1 flex-row items-center justify-center rounded-full ${
            hasAny ? 'bg-black dark:bg-white' : 'bg-neutral-400 dark:bg-neutral-600'
          }`}>
          <Text className={`mr-3 font-semibold ${hasAny ? 'text-white dark:text-black' : 'text-white'}`}>
            Continue
          </Text>
          <View className={`h-8 w-8 items-center justify-center rounded-full ${hasAny ? 'bg-white dark:bg-black' : 'bg-neutral-300'}`}>
            <Text className={hasAny ? 'text-black dark:text-white' : 'text-white'}>→</Text>
          </View>
        </TouchableOpacity>
      </View>
    </OnboardingCard>
  );
}
