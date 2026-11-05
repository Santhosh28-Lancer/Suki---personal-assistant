import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import SukiMascot from '@/components/SukiMascot';

function SukiIntro() {
  const [visible, setVisible] = React.useState(true);
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(180);
  const scale = useSharedValue(0.72);

  useEffect(() => {
    translateX.value = withSequence(
      withTiming(-12, { duration: 650, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.back(2)) }),
    );
    scale.value = withSequence(
      withTiming(1.08, { duration: 650, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2)) }),
    );
    const fade = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 350 });
      setTimeout(() => setVisible(false), 380);
    }, 1550);
    return () => clearTimeout(fade);
  }, [opacity, scale, translateX]);

  const mascotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.intro}>
      <Animated.View style={mascotStyle}>
        <SukiMascot size={210} mood="happy" />
      </Animated.View>
      <Animated.Text style={[styles.wordmark, titleStyle]}>suki.</Animated.Text>
      <Text style={styles.tagline}>YOUR PERSONAL COMPANION</Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#050A10' },
        }}
      />
      <SukiIntro />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050A10' },
  intro: {
    ...StyleSheet.absoluteFill,
    zIndex: 99,
    backgroundColor: '#071B2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: '#EAFBFF',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -2,
    marginTop: -2,
  },
  tagline: {
    color: '#75DDF4',
    fontSize: 9,
    letterSpacing: 2.4,
    marginTop: 8,
  },
});
