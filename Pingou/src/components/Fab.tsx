import React from 'react'
import { Pressable, Text, TouchableOpacity, View, Alert } from 'react-native'
import { Plus } from 'lucide-react-native'

type FabProps = {
  // Text to show inside the button
  label: string
  // Handler for press
  onPress: () => void
  // Optional test id for E2E
  testID?: string
}

const Fab: React.FC<FabProps> = ({ label, onPress, testID }) => {
  return (
    // Absolute bottom-right floating action button
    <TouchableOpacity
      // Accessibility role improves screen-reader experience
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      className="absolute right-5 bottom-40 flex-row items-center px-4 py-3 rounded-full bg-black dark:bg-white"
    >
      {/* Label with contrasting text in both modes */}
      <Text className="text-white dark:text-black font-semibold">{label}</Text>

      {/* Small circular + icon built with views/text to avoid extra icon deps */}
      <View className="ml-2 w-6 h-6 rounded-full p-2 items-center justify-center bg-white dark:bg-black">
      <Plus/>
      </View>
    </TouchableOpacity>
  )
}

export default Fab