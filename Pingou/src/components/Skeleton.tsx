import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
};

export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
        },
        animatedStyle,
        style,
      ]}
      className="dark:bg-neutral-700"
    />
  );
}

/** Profile page skeleton */
export function ProfileSkeleton() {
  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900 px-4">
      {/* Avatar */}
      <View className="mt-24 items-center">
        <Skeleton width={128} height={128} borderRadius={64} />
        <View className="mt-6">
          <Skeleton width={180} height={24} borderRadius={12} />
        </View>
        <View className="mt-3">
          <Skeleton width={140} height={14} borderRadius={7} />
        </View>
        <View className="mt-4">
          <Skeleton width={140} height={44} borderRadius={22} />
        </View>
      </View>

      {/* Stats card */}
      <View className="mt-6">
        <Skeleton width="100%" height={120} borderRadius={16} />
      </View>

      {/* QR card */}
      <View className="mt-8">
        <Skeleton width="100%" height={280} borderRadius={16} />
      </View>

      {/* Contact card */}
      <View className="mt-6">
        <Skeleton width="100%" height={100} borderRadius={16} />
      </View>
    </View>
  );
}

/** Connection list skeleton */
export function ConnectionsSkeleton() {
  return (
    <View className="flex-1 bg-white dark:bg-black px-4 pt-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} className="flex-row items-center py-3">
          <Skeleton width={48} height={48} borderRadius={24} />
          <View className="ml-3 flex-1">
            <Skeleton width={140} height={16} borderRadius={8} />
            <View className="mt-2">
              <Skeleton width={200} height={12} borderRadius={6} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Folder list skeleton */
export function FoldersSkeleton() {
  return (
    <View className="flex-1 bg-white dark:bg-black px-4 pt-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} className="flex-row items-center py-4">
          <Skeleton width={48} height={48} borderRadius={12} />
          <View className="ml-3 flex-1">
            <Skeleton width={120} height={16} borderRadius={8} />
            <View className="mt-2">
              <Skeleton width={80} height={12} borderRadius={6} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
