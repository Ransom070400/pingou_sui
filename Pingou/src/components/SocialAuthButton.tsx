import React, { memo } from 'react'
import { Pressable, Text } from 'react-native'

/**
 * A very small, presentational social auth button.
 * Using memo to avoid re-render when parent state (email) changes unnecessarily.
 */
const SocialAuthButton = memo(function SocialAuthButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
}) {
  return (
    // Wrapper for button styling
    <Pressable
      // className uses NativeWind (tailwind-like). We keep it minimal now.
      className="flex-1 h-11 rounded-full border border-neutral-300 items-center justify-center mx-1 bg-white active:opacity-80"
      // Provide a simple handler (no logic yet)
      onPress={onPress}
      disabled={disabled}
      style={disabled ? { opacity: 0.6 } : undefined}
    >
      {/* Text label (icon will be added later once we confirm icon library) */}
      <Text className="text-sm font-medium text-neutral-800">{label}</Text>
    </Pressable>
  )
})

export default SocialAuthButton