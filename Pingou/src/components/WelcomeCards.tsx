import { View, Text } from 'react-native'
import React from 'react'

interface OnboardingCardProps {
  title: string
  description: string
  className?: string
  tiltDegrees?: number
}

const WelcomeCards = ({ title, description, className = '', tiltDegrees = 0 }: OnboardingCardProps) => {
  return (
    <View
      className={`bg-white dark:bg-neutral-800 rounded-3xl p-8 mx-4 shadow-lg ${className}`}
      style={{
        transform: tiltDegrees !== 0 ? [{ rotate: `${tiltDegrees}deg` }] : undefined
      }}
    >
      <Text className='text-2xl font-bold text-center text-gray-800 dark:text-white mb-4'>
        {title}
      </Text>
      <Text className='text-gray-600 dark:text-neutral-400 text-center leading-6'>
        {description}
      </Text>
    </View>
  )
}

export default WelcomeCards
