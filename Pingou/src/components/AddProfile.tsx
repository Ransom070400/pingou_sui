import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import { Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
// Import the shared card chrome component
import OnboardingCard from './OnboardingCard';

interface Props {
  // ADDED: 1-based current step index (optional)
  onBack: () => void;
  onContinue: (imageUri: string) => void;
  currentStep?: number;
  // ADDED: total number of steps (optional)
  totalSteps?: number;
}

export default function AddProfileCard({ currentStep, totalSteps, onBack, onContinue }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);

    const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Derived: enable button only if imageUri is set
  const hasAny = !!imageUri;
  return (
    <OnboardingCard
      currentStep={currentStep}
      totalSteps={totalSteps}
      title="Almost there!"
      subtitle="Tap the camera icon to upload a photo">
      <View className="mb-6 items-center">
        {/* Avatar circle - tappable to pick an image */}
        <View className="relative">
          {/* Touchable area is the whole circle */}
          <TouchableOpacity
            // Larger circle for better UI (w-48 ~ 192px). Dark mode friendly bg.
            className="h-58 w-58 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
            onPress={pickImage}
            accessibilityLabel="Add profile photo">
            {imageUri ? (
              // Show chosen image filling the circle; resizeMode cover crops to fit
              <Image source={{ uri: imageUri }} className="h-44 w-44" resizeMode="cover" />
            ) : (
              // Placeholder: Pingou logo centered inside grey circle
              <Image
                source={require('../../assets/PingouLogoWOBG.png')}
                className="h-44 w-44"
                resizeMode="contain"
               style={{
                  transform: [
                    // Rotate first so translations happen along rotated axes.
                    { rotate: '25deg' },
                    // Translate further along rotated X (more negative => farther left along rotated axis).
                    { translateX: -48 },
                    // Translate further along rotated Y (positive => down along rotated axis).
                    { translateY: 36 },
                  ],
                }}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Camera badge positioned bottom-right inside the circle */}
        <TouchableOpacity
          // Absolute positioning relative to parent .relative
          onPress={pickImage}
          className="absolute bottom-3 right-[75px]"
          accessibilityLabel="Open photo picker">
          {/* Small circular badge with icon; adapts to dark mode */}
          <View className="h-10 w-10 items-center justify-center rounded-full bg-black shadow dark:bg-white">
            {/* Lucide icon: set size and color to contrast with bg */}
            <Camera size={25} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Actions row */}
      <View className="mt-2 flex-row">
        <TouchableOpacity
          onPress={onBack}
          className="mr-3 h-12 flex-1 flex-row items-center justify-center rounded-full border border-neutral-300">
          <Text className="font-medium text-neutral-800">Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!hasAny}
          onPress={() => onContinue(imageUri!)} // Pass imageUri here when ready
          className={`h-12 flex-1 flex-row items-center justify-center rounded-full ${
            hasAny ? 'bg-black' : 'bg-neutral-400'
          }`}>
          <Text className="mr-3 font-semibold text-white">Continue</Text>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
            <Text className="text-black">→</Text>
          </View>
        </TouchableOpacity>
      </View>
    </OnboardingCard>
  );
}
