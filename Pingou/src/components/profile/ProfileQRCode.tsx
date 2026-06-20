import React from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface ProfileQRCodeProps {
  // The value we encode
  userId: string;
  // Optional explicit value override (lets you pass a deep link later)
  valueOverride?: string;
  // Optional size so parent can control dimensions
  size?: number;
}

const ProfileQRCode: React.FC<ProfileQRCodeProps> = ({ userId, valueOverride, size = 200 }) => {
  return (
    // Card container: rounded, padded, and theme-aware background
    <View className="mx-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900">
      {/* Title */}
      <Text className="text-left text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Your QR Code
      </Text>

      {/* Subtitle */}
      <Text className="mt-1 text-left text-lg text-black dark:text-neutral-400">
        Scan to connect
      </Text>

      {/* Center the QR block */}
      <View className="mt-6 items-center">
        {/* Grey rounded background wrapper */}
        <View className="rounded-3xl bg-neutral-100 p-10 shadow-sm dark:bg-neutral-800">
          {/* Exact-fit white square so its corners align 1:1 with the QR */}
          <View
            style={{ width: size, height: size }}
            className="overflow-hidden rounded-none bg-white">
            <QRCode
              value={valueOverride ?? userId}
              size={size}
              backgroundColor="transparent"
              color="#000000"
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProfileQRCode;
