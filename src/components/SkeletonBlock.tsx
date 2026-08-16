// Placeholder de carregamento com um "pulsar" de opacidade em loop,
// usado no lugar de conteúdo ainda não carregado (skeleton screen).
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function SkeletonBlock({ style }: { style?: ViewStyle }) {
  const theme = useTheme();
  const opacidade = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidade, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacidade, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacidade]);

  return (
    <Animated.View
      style={[
        styles.base,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, opacity: opacidade },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { width: '100%' },
});
