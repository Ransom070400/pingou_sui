import React from 'react'
import { View, Text } from 'react-native'

type Props = {
  progress?: number
  currentStep?: number
  totalSteps?: number
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export default function OnboardingCard({
  progress = 0,
  currentStep,
  totalSteps,
  title,
  subtitle,
  children
}: Props) {
  const useSegments = typeof currentStep === 'number' && typeof totalSteps === 'number' && totalSteps > 1
  const clamped = Math.max(0, Math.min(1, progress))

  return (
    <View className="mx-2">
      {/* Top progress region */}
      {useSegments ? (
        <View className="flex-row items-center mb-4">
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const active = idx < (currentStep as number)
            return (
              <View
                key={idx}
                className={`h-1 rounded-full flex-1 ${active ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-600'}`}
                style={{ marginRight: idx === (totalSteps as number) - 1 ? 0 : 8 }}
              />
            )
          })}
        </View>
      ) : (
        <View className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden mb-4">
          <View style={{ width: `${clamped * 100}%` }} className="h-2 bg-black dark:bg-white rounded-full" />
        </View>
      )}

      {/* Card shell */}
      <View className="bg-white dark:bg-neutral-800 rounded-2xl px-6 py-6 shadow-lg">
        <Text className="text-center text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-center text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  )
}
