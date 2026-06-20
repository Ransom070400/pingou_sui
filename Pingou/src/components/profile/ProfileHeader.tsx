import { View, Text, Image, TouchableOpacity, useColorScheme } from 'react-native';
import { Camera, Edit } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { router } from 'expo-router';
import { Feedback } from '~/src/utils/Feedback';
import { uploadProfilePicture } from '~/src/utils/uploadProfilePicture';
import { useAuth } from '~/src/context/AuthProvider';
import { supabase } from '~/src/lib/supabase';
import { SUI_ENABLED } from '~/src/lib/sui/config';

type Props = {
  fullName: string;
  tagline: string;
  avatarUrl?: string | null;
};

const ProfileHeader = ({ fullName, tagline, avatarUrl }: Props) => {
  const colorScheme = useColorScheme();
  const badgeIconColor = colorScheme === 'dark' ? '#000' : '#fff';
  const editIconColor = colorScheme === 'dark' ? '#fff' : '#000';
  const { profile, setProfile } = useAuth();

  // Local override — shows immediately while upload happens in background
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  // Display priority: local pick > Supabase URL > initials
  const displayUri = localImageUri ?? avatarUrl;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    const uri = result.assets[0].uri;
    setLocalImageUri(uri); // Show immediately

    // Upload in background
    if (profile?.user_id) {
      const signedUrl = await uploadProfilePicture(uri, profile.user_id);
      if (signedUrl) {
        // Update the profile in Supabase
        await supabase
          .from('profiles')
          .update({ profile_url: signedUrl, updated_at: new Date().toISOString() })
          .eq('user_id', profile.user_id);

        setProfile((prev) => (prev ? { ...prev, profile_url: signedUrl } : prev));
      }
    }
  };

  const buttonShadowStyle =
    colorScheme === 'dark'
      ? {
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.12,
          shadowRadius: 2,
        }
      : {
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        };

  return (
    <View className="mt-[80px] items-center">
      <View className="relative h-32 w-32">
        <View className="h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-orange-400 to-yellow-500 shadow-lg">
          {displayUri ? (
            <Image source={{ uri: displayUri }} className="h-44 w-44" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-yellow-500">
              <Text className="text-3xl font-bold text-white">
                {fullName
                  .split(' ')
                  .map((name) => name.charAt(0))
                  .join('')}
              </Text>
            </View>
          )}
        </View>

        {/* Avatar upload is Supabase-backed; hidden in Sui mode (avatar-on-Walrus is a follow-up). */}
        {!SUI_ENABLED && (
          <TouchableOpacity
            onPress={pickImage}
            accessibilityLabel="Open photo picker"
            style={{
              position: 'absolute',
              right: -2,
              top: '65%',
              transform: [{ translateY: -1 }],
            }}
            activeOpacity={0.8}>
            <View className="h-10 w-10 items-center justify-center rounded-full bg-black shadow dark:bg-white">
              <Camera size={25} color={badgeIconColor} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      <Text className="mt-6 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        {fullName}
      </Text>
      <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">"{tagline}"</Text>

      <TouchableOpacity
        onPress={() => {
          Feedback.medium();
          router.push('/editProfile');
        }}
        className="mt-4 rounded-full bg-white p-2 px-6 py-2 dark:bg-neutral-100"
        style={buttonShadowStyle}
        activeOpacity={0.7}>
        <View className="flex-row items-center p-2">
          <Text className="text-xl font-medium text-black dark:text-white">Edit profile</Text>
          <Edit size={15} color={editIconColor} style={{ marginLeft: 8 }} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default ProfileHeader;
