import React from 'react'
import { View, Text } from 'react-native'

interface ContactInfoProps {
  email?: string
  phone?: string
}

const ContactInfo: React.FC<ContactInfoProps> = ({ email, phone }) => {
  return (
    <View className="bg-white dark:bg-neutral-900 rounded-2xl p-6 mx-4 shadow-sm">
      {/* Title */}
      <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4">
        Contact information
      </Text>

      {/* Email section (render only if provided)
          - Removed the previous bottom margin so spacing is controlled only by the divider.
      */}
      {email && (
        <View className="mb-0">
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            Email
          </Text>
          <Text className="text-base text-neutral-800 dark:text-neutral-200">
            {email}
          </Text>
        </View>
      )}

      {/* Render a horizontal divider only when both email and phone exist
          - Use my-4 so top and bottom spacing around the line are identical.
      */}
      {email && phone && (
        <View className="w-full h-px bg-neutral-200 dark:bg-neutral-700 my-4" />
      )}

      {/* Phone section */}
      {phone && (
        <View>
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            Phone
          </Text>
          <Text className="text-base text-neutral-800 dark:text-neutral-200">
            {phone}
          </Text>
        </View>
      )}
    </View>
  )
}

export default ContactInfo