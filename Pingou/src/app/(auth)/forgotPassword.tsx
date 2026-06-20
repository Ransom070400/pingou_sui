import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert, useColorScheme } from 'react-native';
import { Mail, ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '~/src/lib/supabase';
import { Feedback } from '~/src/utils/Feedback';

export default function ForgotPassword() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#9CA3AF' : 'gray';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Feedback.success();
    setSent(true);
  };

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900 px-5 pt-9">
      {/* Back button */}
      <TouchableOpacity onPress={() => router.back()} className="mb-4">
        <ArrowLeft size={24} color={isDark ? '#fff' : '#111'} />
      </TouchableOpacity>

      {/* Logo */}
      <View className="items-center mb-6">
        <View className="w-28 h-42 rounded-full items-center justify-center">
          <Image source={require('../../../assets/PingouLogoWOBG.png')} className="w-[91px] h-[126px]" />
        </View>
      </View>

      {/* Heading */}
      <View className="items-center mb-6">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          {sent ? 'Check your email' : 'Reset password'}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 text-center px-4">
          {sent
            ? `We sent a password reset link to ${email}`
            : 'Enter your email and we\'ll send you a reset link'}
        </Text>
      </View>

      {sent ? (
        <View className="items-center mt-8">
          <TouchableOpacity
            className="h-12 w-full rounded-full bg-black dark:bg-white items-center justify-center"
            onPress={() => router.replace('/(auth)/signin')}>
            <Text className="text-white dark:text-black font-semibold text-sm">Back to Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="bg-white dark:bg-neutral-800 rounded-2xl px-5 pt-5 pb-6 shadow-sm">
          {/* Email input */}
          <View className="flex-row items-center h-12 rounded-full border border-neutral-300 dark:border-neutral-600 px-4 mb-4 bg-white dark:bg-neutral-700">
            <Mail color={iconColor} size={20} style={{ marginRight: 8 }} />
            <TextInput
              className="flex-1 text-sm text-neutral-900 dark:text-white"
              placeholder="Enter your Email"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              autoCorrect={false}
            />
          </View>

          {/* Reset button */}
          <TouchableOpacity
            className="h-12 rounded-full bg-black dark:bg-white items-center justify-center active:opacity-90"
            onPress={handleReset}
            disabled={loading}>
            <Text className="text-white dark:text-black font-semibold text-sm">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
