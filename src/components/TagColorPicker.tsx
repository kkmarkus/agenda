import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { TAG_PALETTE_LIGHT, TAG_PALETTE_DARK } from '../theme/theme';

type Props = {
  visivel: boolean;
  tag: string;
  corAtual: number;
  onSelecionar: (corIndex: number) => void;
  onFechar: () => void;
};

// Modal simples com as bolinhas da paleta do tema atual — toque pra
// escolher, toque fora ou em "Fechar" pra cancelar. Chamado a partir de
// um toque simples no card da tag em TagsScreen.
export default function TagColorPicker({ visivel, tag, corAtual, onSelecionar, onFechar }: Props) {
  const theme = useTheme();
  const styles = criarStyles(theme);
  // Paleta muda com o tema (claro/escuro) pra manter contraste — o índice
  // gravado no banco é o mesmo, só a cor exibida em cada posição muda.
  const paleta = theme.mode === 'dark' ? TAG_PALETTE_DARK : TAG_PALETTE_LIGHT;

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.backdrop} onPress={onFechar}>
        <Pressable style={styles.cartao} onPress={(e) => e.stopPropagation()}>
          <View style={styles.puxador} />
          <Text style={styles.overline}>COR DA TAG</Text>
          <Text style={styles.titulo}>{tag}</Text>

          <View style={styles.grade}>
            {paleta.map((cor, index) => {
              const selecionada = index === corAtual;
              return (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.bolinhaWrapper,
                    selecionada && styles.bolinhaWrapperSelecionada,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => onSelecionar(index)}
                >
                  <View style={[styles.bolinha, { backgroundColor: cor.base }]}>
                    {selecionada && <Feather name="check" size={16} color={cor.text} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.botaoFechar, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onFechar}
          >
            <Text style={styles.botaoFecharTexto}>Fechar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15,13,10,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    cartao: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      shadowColor: theme.shadow.color,
      shadowOpacity: theme.shadow.opacity * 2,
      shadowRadius: theme.shadow.radius,
      shadowOffset: { width: 0, height: theme.shadow.offsetY },
    },
    puxador: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      alignSelf: 'center',
      marginBottom: theme.spacing.md,
    },
    overline: {
      ...theme.typography.overline,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    titulo: {
      ...theme.typography.heading,
      fontSize: 20,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: theme.spacing.lg,
    },
    grade: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.md },
    bolinhaWrapper: {
      padding: 3,
      borderRadius: theme.radius.pill,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    bolinhaWrapperSelecionada: {
      borderColor: theme.colors.accent,
    },
    bolinha: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoFechar: {
      marginTop: theme.spacing.lg,
      alignItems: 'center',
      padding: theme.spacing.sm + 4,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    botaoFecharTexto: { ...theme.typography.bodyMedium, color: theme.colors.textPrimary },
  });
}
