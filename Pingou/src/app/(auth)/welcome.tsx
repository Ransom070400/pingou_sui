import { View, Text, TouchableOpacity, Image, Pressable } from 'react-native';
import React, { useEffect, useState } from 'react';
import { router, Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WelcomeCards from '~/src/components/WelcomeCards';
import { Feedback } from '~/src/utils/Feedback';

const SEEN_KEY = 'pingou.seenOnboarding';

// Sui value-prop cards.
const onboardingCards = [
  {
    title: 'No wallet, no passwords',
    description:
      'Sign in with Google or Apple and we set up a secure account for you — no seed phrases, no gas, nothing to lose.',
    tiltDegrees: 0,
  },
  {
    title: 'Your card, encrypted',
    description:
      'Build your Pingou card once. It’s encrypted and stored on-chain — only people you connect with can ever read it.',
    tiltDegrees: -4,
  },
  {
    title: 'One tap to exchange',
    description: 'Scan a QR once and you both get each other’s card instantly. Your connections, truly yours.',
    tiltDegrees: 3,
  },
];

const Onboarding = () => {
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [seen, setSeen] = useState(false);
  const isLast = index === onboardingCards.length - 1;

  // Show onboarding only the first time; returning/logged-out users skip to sign-in.
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => setSeen(v === '1'))
      .finally(() => setChecked(true));
  }, []);

  // Auto-advance through the deck; stop on the last (wait for "Get Started").
  useEffect(() => {
    if (!checked || seen || isLast) return;
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, onboardingCards.length - 1)), 3600);
    return () => clearTimeout(t);
  }, [index, checked, seen, isLast]);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(SEEN_KEY, '1');
    } catch {}
    router.replace('/(auth)/signin');
  };

  const next = () => {
    Feedback.selection();
    if (isLast) finish();
    else setIndex((i) => i + 1);
  };

  if (!checked) return <View className="flex-1 bg-gray-100 dark:bg-neutral-900" />;
  if (seen) return <Redirect href="/(auth)/signin" />;

  return (
    <View className="flex-1 bg-gray-100 dark:bg-neutral-900">
      {/* Top-right penguin */}
      <Image
        source={require('../../../assets/PingouLogoWOBG.png')}
        className="absolute -right-40 top-8 h-[500px] w-[500px]"
        style={{ transform: [{ rotate: '-25deg' }], transformOrigin: 'top center' }}
        resizeMode="contain"
      />
      {/* Bottom-left penguin */}
      <Image
        source={require('../../../assets/PingouLogoWOBG.png')}
        className="absolute bottom-20 right-[210px] h-[520px] w-[500px]"
        style={{ transform: [{ rotate: '20deg' }], transformOrigin: 'bottom center' }}
        resizeMode="contain"
      />

      {/* Stacked card deck — tap to advance. The current card sits on top; the
          upcoming ones peek out behind it, then surface as you advance. */}
      <Pressable onPress={next} className="flex-1 justify-center px-6">
        <View className="relative" style={{ minHeight: 220, justifyContent: 'center' }}>
          {onboardingCards.map((card, i) => {
            const depth = i - index; // 0 = top card, 1/2 = behind
            if (depth < 0 || depth > 2) return null;
            const isTop = depth === 0;
            return (
              <View
                key={card.title}
                className="absolute w-full"
                style={{
                  zIndex: 10 - depth,
                  opacity: isTop ? 1 : 0.55,
                  transform: [{ translateY: -depth * 14 }, { scale: 1 - depth * 0.05 }],
                }}>
                <WelcomeCards
                  title={card.title}
                  description={card.description}
                  tiltDegrees={card.tiltDegrees}
                />
              </View>
            );
          })}
        </View>
      </Pressable>

      {/* Bottom controls */}
      <View className="px-6 pb-12">
        {/* Progress dots (active = wide pill) */}
        <View className="mb-8 flex-row justify-center space-x-2">
          {onboardingCards.map((_, i) => {
            const active = i === index;
            const done = i < index;
            return (
              <View
                key={i}
                className={`h-2 rounded-full ${
                  active
                    ? 'w-8 bg-gray-800 dark:bg-white'
                    : done
                      ? 'w-2 bg-gray-500 dark:bg-neutral-400'
                      : 'w-2 bg-gray-300 dark:bg-neutral-600'
                }`}
              />
            );
          })}
        </View>

        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            className="rounded-full border border-gray-300 px-7 py-3 dark:border-neutral-600"
            onPress={finish}>
            <Text className="font-medium text-black dark:text-white">Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center rounded-full bg-gray-800 px-8 py-3 dark:bg-white"
            onPress={next}>
            <Text className="mr-2 font-medium text-white dark:text-black">
              {isLast ? 'Get Started' : 'Next'}
            </Text>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-black">
              <Text className="self-center text-black dark:text-white">→</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Onboarding;
