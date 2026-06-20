import React, { useState } from 'react';
import { View, Image, Alert } from 'react-native';
import Animated, { SlideInRight, SlideInLeft, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import NameCard from '../../components/NameCard';
import SocialsCard from '../../components/SocialsCard';
import AddProfileCard from '~/src/components/AddProfile';
import { NameCardType } from '~/types/types';
import { SocialsMap } from '~/src/types/ProfileTypes';
import { buildProfilePayload } from '~/src/utils/buildProfilePayload';
import { uploadOnboarding } from '~/src/utils/uploadOnboarding';
import { useAuth } from '~/src/context/AuthProvider';

export default function OnboardingScreen() {
  const { setProfile } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [nameData, setNameData] = useState<NameCardType>();
  const [socialsData, setSocialsData] = useState<SocialsMap>();
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const totalSteps = 3;

  const goForward = (next: number) => {
    setDirection('forward');
    setStepIndex(next);
  };

  const goBack = (prev: number) => {
    setDirection('back');
    setStepIndex(prev);
  };

  const handleFinish = async (uri?: string) => {
    setSubmitting(true);
    const payload = buildProfilePayload(nameData, socialsData, uri);
    const { profile, error } = await uploadOnboarding(payload);
    setSubmitting(false);

    if (error || !profile) {
      const msg = error?.message ?? JSON.stringify(error) ?? 'Failed to create profile';
      console.error('Onboarding error:', error);
      Alert.alert('Onboarding Error', msg);
      return;
    }

    setProfile(profile);
  };

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <Image
        source={require('../../../assets/PingouLogoWOBG.png')}
        resizeMode="contain"
        className="absolute -right-10 -top-32 h-[500px] w-[400px]"
        style={{ transform: [{ translateX: 120 }, { translateY: 24 }, { rotate: '-20deg' }], opacity: 0.15 }}
      />
      <Image
        source={require('../../../assets/PingouLogoWOBG.png')}
        resizeMode="contain"
        className="absolute -bottom-40 -left-32 h-[500px] w-[400px]"
        style={{ transform: [{ rotate: '12deg' }, { translateX: -90 }, { translateY: -120 }], opacity: 0.15 }}
      />

      <View className="flex-1 justify-center px-5">
        {stepIndex === 0 && (
          <Animated.View
            key="step-0"
            entering={direction === 'back' ? SlideInLeft.duration(300) : SlideInRight.duration(300)}
            exiting={direction === 'forward' ? SlideOutLeft.duration(200) : SlideOutRight.duration(200)}>
            <NameCard
              currentStep={1}
              totalSteps={totalSteps}
              initialName={nameData?.name ?? ''}
              initialBio={nameData?.bio ?? ''}
              onContinue={(data) => {
                setNameData(data);
                goForward(1);
              }}
            />
          </Animated.View>
        )}

        {stepIndex === 1 && (
          <Animated.View
            key="step-1"
            entering={direction === 'back' ? SlideInLeft.duration(300) : SlideInRight.duration(300)}
            exiting={direction === 'forward' ? SlideOutLeft.duration(200) : SlideOutRight.duration(200)}>
            <SocialsCard
              currentStep={2}
              totalSteps={totalSteps}
              initial={socialsData ?? {}}
              onBack={() => goBack(0)}
              onContinue={(data) => {
                setSocialsData(data);
                goForward(2);
              }}
            />
          </Animated.View>
        )}

        {stepIndex === 2 && (
          <Animated.View
            key="step-2"
            entering={direction === 'back' ? SlideInLeft.duration(300) : SlideInRight.duration(300)}>
            <AddProfileCard
              currentStep={3}
              totalSteps={totalSteps}
              onBack={() => goBack(1)}
              onContinue={(uri) => {
                handleFinish(uri);
              }}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}
