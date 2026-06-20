import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  Canvas,
  Group,
  Text as SkiaText,
  useFont,
  Blur,
  LinearGradient,
  vec,
  Mask,
  Rect,
  Fill,
} from '@shopify/react-native-skia';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AdvancedTextRevealProps {
  text: string;
  fontSize?: number;
  width?: number;
  height?: number;
  color?: string;
  duration?: number;
  delay?: number;
  fontPath?: string; // Path to custom font file
}

/**
 * Advanced TextReveal using Skia for sophisticated effects
 * Features:
 * - Gradient mask reveal (like Apple Keynote)
 * - Blur to sharp transition
 * - Smooth opacity and position animations
 * 
 * Note: To use custom fonts, you need to:
 * 1. Add font file to your assets
 * 2. Pass the font path to this component
 * 3. Load it with useFont hook
 */
export const AdvancedTextReveal: React.FC<AdvancedTextRevealProps> = ({
  text,
  fontSize = 48,
  width = SCREEN_WIDTH - 40,
  height = 100,
  color = '#FFFFFF',
  duration = 1500,
  delay = 0,
  fontPath,
}) => {
  const progress = useSharedValue(0);
  
  // Load font - you'll need to provide a font file
  // Example: const font = useFont(require('../../assets/fonts/YourFont.ttf'), fontSize);
  // For now, we'll use null and provide instructions
  const font = fontPath ? useFont(fontPath, fontSize) : null;

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      })
    );
  }, [delay, duration]);

  // Animated props for blur effect
  const animatedBlurProps = useAnimatedProps(() => {
    const blurAmount = interpolate(
      progress.value,
      [0, 0.5, 1],
      [20, 5, 0],
      Extrapolation.CLAMP
    );
    return { blur: blurAmount };
  });

  // Animated props for gradient mask
  const animatedMaskProps = useAnimatedProps(() => {
    const maskProgress = interpolate(
      progress.value,
      [0, 1],
      [0, width],
      Extrapolation.CLAMP
    );
    return { width: maskProgress };
  });

  if (!font) {
    // Fallback: provide instructions to user
    return (
      <View style={[styles.container, { width, height }]}>
        <View style={styles.instructionBox}>
          <Animated.Text style={styles.instructionText}>
            To use Skia fonts, add a font file to your assets and pass the fontPath prop
          </Animated.Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }}>
        <Group>
          {/* Gradient mask for reveal effect */}
          <Mask
            mask={
              <Group>
                <Rect x={0} y={0} width={width} height={height}>
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(width, 0)}
                    colors={['transparent', color, color]}
                    positions={[0, 0.3, 1]}
                  />
                </Rect>
              </Group>
            }
          >
            {/* Text with blur effect */}
            <Group>
              <Blur blur={10} />
              <SkiaText
                x={20}
                y={fontSize + 10}
                text={text}
                font={font}
                color={color}
              />
            </Group>
          </Mask>
        </Group>
      </Canvas>
    </View>
  );
};

/**
 * Character-by-character reveal with individual animations
 * This creates a typewriter effect with Apple-style refinement
 */
interface CharacterRevealProps {
  text: string;
  fontSize?: number;
  color?: string;
  duration?: number;
  delay?: number;
  style?: any;
}

export const CharacterReveal: React.FC<CharacterRevealProps> = ({
  text,
  fontSize = 48,
  color = '#FFFFFF',
  duration = 1500,
  delay = 0,
  style,
}) => {
  const characters = text.split('');
  const charDelay = duration / characters.length;

  return (
    <View style={[styles.characterContainer, style]}>
      {characters.map((char, index) => (
        <AnimatedCharacter
          key={index}
          char={char}
          fontSize={fontSize}
          color={color}
          delay={delay + index * charDelay}
        />
      ))}
    </View>
  );
};

interface AnimatedCharacterProps {
  char: string;
  fontSize: number;
  color: string;
  delay: number;
}

const AnimatedCharacter: React.FC<AnimatedCharacterProps> = ({
  char,
  fontSize,
  color,
  delay,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );
  }, [delay]);

  const animatedStyle = useAnimatedProps(() => {
    return {
      opacity: interpolate(progress.value, [0, 1], [0, 1]),
      transform: [
        {
          translateY: interpolate(progress.value, [0, 1], [10, 0]),
        },
        {
          scale: interpolate(progress.value, [0, 0.5, 1], [0.5, 1.1, 1]),
        },
      ],
    };
  });

  return (
    <Animated.Text
      style={[
        styles.character,
        { fontSize, color },
        animatedStyle as any,
      ]}
    >
      {char}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  characterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  character: {
    fontWeight: '700',
    letterSpacing: -1,
  },
  instructionBox: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  instructionText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default AdvancedTextReveal;
