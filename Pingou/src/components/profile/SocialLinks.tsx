import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { getPlatformById } from '~/src/config/socialPlatforms';
import { SocialLinkItem } from '~/src/utils/buildSocialLinks';

interface SocialLinksProps {
  links: SocialLinkItem[];
}

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
};

const SocialLinks: React.FC<SocialLinksProps> = ({ links }) => {
  if (links.length === 0) return null;

  return (
    <View className="mx-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900">
      <Text className="mb-4 text-lg font-bold text-neutral-900 dark:text-neutral-100">
        Social media
      </Text>

      <View className="space-y-6">
        {links.map((link) => {
          const platform = getPlatformById(link.id);
          const Icon = platform?.icon;
          const color = link.color || platform?.color || '#6B7280';

          return (
            <View key={link.id} style={cardShadow} className="rounded-xl">
              <TouchableOpacity
                onPress={() => Linking.openURL(link.url)}
                activeOpacity={0.8}
                className="mb-2 flex-row items-center gap-4 rounded-xl bg-white p-4 dark:bg-neutral-800"
                accessibilityRole="link"
                accessibilityLabel={`${link.label} link`}>
                {/* Platform icon */}
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: color + '20' }}>
                  {Icon ? (
                    <Icon size={20} color={color} />
                  ) : (
                    <Text className="text-lg font-bold" style={{ color }}>
                      {link.label.charAt(0)}
                    </Text>
                  )}
                </View>

                {/* Label + URL */}
                <View className="flex-1">
                  <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {link.label}
                  </Text>
                  <Text numberOfLines={1} className="text-sm text-neutral-500 dark:text-neutral-400">
                    {link.url.replace(/^https?:\/\//, '')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default SocialLinks;
