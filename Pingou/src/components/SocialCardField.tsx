import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
/* Small reusable field subcomponent to avoid repetition */
export default function Field({
  label,
  value,
  onChangeText,
  placeholder
}: {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder: string
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-neutral-700 mb-2">
        {label}
      </Text>
      <TextInput
        className="h-12 bg-neutral-100 border border-neutral-200 rounded-full px-4 text-sm text-neutral-900"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize="none"
        keyboardType="url"
      />
    </View>
  )
}