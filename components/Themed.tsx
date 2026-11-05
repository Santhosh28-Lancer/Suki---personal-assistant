
import React from 'react';
import {
  Text as DefaultText,
  View as DefaultView,
  useColorScheme,
  type TextProps as NativeTextProps,
  type ViewProps as NativeViewProps,
} from 'react-native';

const themeColors = {
  light: {
    text: '#000000',
    background: '#ffffff',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
  },
};

function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: 'text' | 'background'
) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? 'dark' : 'light';

  return props[theme] ?? themeColors[theme][colorName];
}

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & NativeTextProps;
export type ViewProps = ThemeProps & NativeViewProps;

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;

  const color = useThemeColor(
    { light: lightColor, dark: darkColor },
    'text'
  );

  return (
    <DefaultText style={[{ color }, style]} {...otherProps} />
  );
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;

  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'background'
  );

  return (
    <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />
  );
}
