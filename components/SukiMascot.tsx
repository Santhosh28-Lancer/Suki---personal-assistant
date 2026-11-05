import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Path, Ellipse, Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

type Props = { size?: number; mood?: 'idle' | 'thinking' | 'happy' };

/** Native vector Suki character. The wordmark is never animated; only this character idles. */
export default function SukiMascot({ size = 190, mood = 'idle' }: Props) {
  const float = useSharedValue(0);
  const squash = useSharedValue(1);
  useEffect(() => {
    float.value = withRepeat(withSequence(
      withTiming(-5, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
    ), -1, false);
    squash.value = withRepeat(withSequence(
      withTiming(1.012, { duration: 1100 }),
      withTiming(1, { duration: 1100 }),
    ), -1, false);
  }, [float, squash]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }, { scale: squash.value }] }));
  const eyeY = mood === 'thinking' ? 98 : 105;
  return (
    <View style={[styles.wrap, { width: size, height: size * 0.82 }]}>
      <Animated.View style={animated}>
        <Svg width={size} height={size * 0.82} viewBox="0 0 300 246">
          <Defs>
            <LinearGradient id="body" x1="0" y1="0" x2="0.2" y2="1">
              <Stop offset="0" stopColor="#B8F5FF" />
              <Stop offset="0.42" stopColor="#64D8F4" />
              <Stop offset="0.82" stopColor="#20B6DE" />
              <Stop offset="1" stopColor="#087FAE" />
            </LinearGradient>
            <RadialGradient id="shine" cx="35%" cy="20%" rx="70%" ry="65%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.72" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="base" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#8DEEFF" stopOpacity="0.15" />
              <Stop offset="1" stopColor="#007CA8" stopOpacity="0.55" />
            </LinearGradient>
          </Defs>
          <Ellipse cx="150" cy="224" rx="112" ry="13" fill="#24B8E7" opacity="0.18" />
          <Path d="M34 183 C34 112 74 27 150 24 C226 27 266 112 266 183 C266 217 219 231 150 231 C81 231 34 217 34 183Z" fill="url(#body)" stroke="#168FBF" strokeWidth="4" />
          <Path d="M43 177 C48 108 83 42 150 37 C218 42 252 108 257 177 C236 203 205 214 150 214 C95 214 64 203 43 177Z" fill="url(#shine)" />
          <Path d="M55 181 C83 202 112 207 150 207 C188 207 217 202 245 181 C237 213 202 224 150 224 C98 224 63 213 55 181Z" fill="url(#base)" />
          <Ellipse cx="82" cy="76" rx="10" ry="16" fill="#FFFFFF" opacity="0.9" transform="rotate(35 82 76)" />
          <Ellipse cx="215" cy="64" rx="9" ry="24" fill="#FFFFFF" opacity="0.86" transform="rotate(-42 215 64)" />
          <Ellipse cx="86" cy="151" rx="26" ry="14" fill="#F59CEB" opacity="0.92" />
          <Ellipse cx="214" cy="151" rx="26" ry="14" fill="#F59CEB" opacity="0.92" />
          {mood === 'thinking' ? <>
            <Path d={`M105 ${eyeY} Q119 ${eyeY-12} 132 ${eyeY}`} fill="none" stroke="#145B91" strokeWidth="4" strokeLinecap="round" />
            <Path d={`M168 ${eyeY} Q181 ${eyeY-12} 195 ${eyeY}`} fill="none" stroke="#145B91" strokeWidth="4" strokeLinecap="round" />
          </> : <>
            <Path d={`M103 ${eyeY} Q119 ${eyeY+13} 135 ${eyeY}`} fill="none" stroke="#145B91" strokeWidth="4" strokeLinecap="round" />
            <Path d={`M165 ${eyeY} Q181 ${eyeY+13} 197 ${eyeY}`} fill="none" stroke="#145B91" strokeWidth="4" strokeLinecap="round" />
          </>}
          <Path d="M137 174 Q150 185 163 174" fill="none" stroke="#176A9B" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
        </Svg>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center' } });
