// Campo somente-leitura que abre o date/time picker nativo ao ser tocado, usado pra data, hora e prazo final.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { useTheme } from '../../../theme/ThemeContext';
import type { criarStyles } from '../styles';

type CampoDataHoraProps = {
  icone: React.ComponentProps<typeof Feather>['name'];
  label: string;
  valor: string;
  onPress: () => void;
  styles: ReturnType<typeof criarStyles>;
  theme: ReturnType<typeof useTheme>;
};

function CampoDataHora({ icone, label, valor, onPress, styles, theme }: CampoDataHoraProps) {
  return (
    <>
      <View style={styles.labelComIcone}>
        <Feather name={icone} size={13} color={theme.colors.textMuted} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.input, styles.inputPressable, { opacity: pressed ? 0.8 : 1 }]}
        onPress={onPress}
      >
        <Text style={styles.inputPressableTexto}>{valor}</Text>
        <Feather name="chevron-down" size={14} color={theme.colors.textMuted} />
      </Pressable>
    </>
  );
}

export default CampoDataHora;
