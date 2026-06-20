import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
// Import the shared card chrome component
import OnboardingCard from './OnboardingCard'

// Define props for NameCard (added currentStep & totalSteps to fix TS2322)
type Props = {
  // One‑time seed for name input
  initialName?: string
  // One‑time seed for bio input
  initialBio?: string
  // Callback fired when Continue pressed
  onContinue?: (payload: { name: string; bio: string }) => void
  // ADDED: 1-based current step index (optional)
  currentStep?: number
  // ADDED: total number of steps (optional)
  totalSteps?: number
}

/* NameCard: collects name + bio, emits values upward */
export default function NameCard({
  initialName = '',
  initialBio = '',
  onContinue,
  currentStep,  
  totalSteps
}: Props) {
  // Local state for controlled TextInput (initialName seeds this once)
  const [name, setName] = useState(initialName)
  // Local state for bio field
  const [bio, setBio] = useState(initialBio)

  // Derived: enable button only if name not empty (simple UX improvement)
  const canContinue = name.trim().length > 0

  // Handler for button
  const handleContinue = () => {
    // Guard: do nothing if invalid (defensive)
    if (!canContinue) return
    // Emit snapshot to parent
    onContinue?.({ name, bio })
  }

  return (
    // Pass segmented progress props into OnboardingCard (instead of progress=0.25)
    <OnboardingCard
      currentStep={currentStep}
      totalSteps={totalSteps}
      title="What's your name"
      subtitle="We want to know you"
    >
      {/* Name field */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-neutral-700 mb-2">Your name</Text>
        <TextInput
          // Rounded pill style, border for contrast
          className="h-12 border border-neutral-300 rounded-2xl px-4 text-sm text-neutral-900 bg-white dark:bg-neutral-900"
          placeholder="Type your name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>

      {/* Bio field */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-neutral-700 mb-2">Your Bio</Text>
        <TextInput
          className="h-24 border border-neutral-300 rounded-2xl px-4 py-3 text-sm text-neutral-900 bg-white dark:bg-neutral-900"
          placeholder="type what you do here..."
          value={bio}
          onChangeText={setBio}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Continue button */}
      <TouchableOpacity
        onPress={handleContinue}
        disabled={!canContinue}
        className={`h-12 rounded-full flex-row items-center justify-center ${
          canContinue ? 'bg-black' : 'bg-neutral-400'
        }`}
      >
        <Text className="text-white font-semibold text-sm mr-3">Continue</Text>
        <View className="bg-white dark:bg-neutral-200 rounded-full w-8 h-8 items-center justify-center">
          <Text className="text-black">→</Text>
        </View>
      </TouchableOpacity>
    </OnboardingCard>
  )
}