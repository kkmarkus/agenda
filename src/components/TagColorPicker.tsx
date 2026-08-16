// Modal pra renomear uma tag e/ou trocar sua cor. Usa a paleta
// "acentuada" nas bolinhas de seleção (mais viva/legível como amostra),
// mas o resto do app usa a paleta normal pra não competir com o accent do tema.
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { TAG_PALETTE_LIGHT, TAG_PALETTE_DARK, TAG_PALETTE_LIGHT_ACENTUADA, TAG_PALETTE_DARK_ACENTUADA } from '../theme/theme';

type Props = {
  visivel: boolean;
  tag: string;
  corAtual: number;

  onSelecionar: (corIndex: number, novoNomeSeAlterado?: string) => void;

  onRenomear: (novoNome: string) => void;

  onSolicitarApagar: () => void;
  onFechar: () => void;
};

export default function TagColorPicker({
  visivel,
  tag,
  corAtual,
  onSelecionar,
  onRenomear,
  onSolicitarApagar,
  onFechar,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => criarStyles(theme), [theme]);

  const paleta = theme.mode === 'dark' ? TAG_PALETTE_DARK : TAG_PALETTE_LIGHT;

  const paletaAcentuada = theme.mode === 'dark' ? TAG_PALETTE_DARK_ACENTUADA : TAG_PALETTE_LIGHT_ACENTUADA;

  const [nome, setNome] = useState(tag);
  useEffect(() => {
    if (visivel) setNome(tag);
  }, [visivel, tag]);

  // Se o usuário mudou o nome mas ainda não confirmou, escolher uma cor
  // já aplica o renome junto (evita ter que apertar dois botões).
  const nomeMudou = nome.trim().length > 0 && nome.trim() !== tag;

  function handleSalvarNome() {
    if (!nomeMudou) return;
    onRenomear(nome.trim());
  }

  function handleSelecionarCor(index: number) {
    onSelecionar(index, nomeMudou ? nome.trim() : undefined);
  }

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.backdrop} onPress={onFechar}>
        <Pressable style={styles.cartao} onPress={(e) => e.stopPropagation()}>
          <View style={styles.puxador} />
          <Text style={styles.overline}>RENOMEAR TAG</Text>

          <View style={styles.linhaNome}>
            <TextInput
              style={styles.inputNome}
              value={nome}
              onChangeText={setNome}
              placeholder={tag}
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSalvarNome}
            />
            {nomeMudou && (
              <Pressable
                style={({ pressed }) => [styles.botaoSalvarNome, { opacity: pressed ? 0.8 : 1 }]}
                onPress={handleSalvarNome}
                hitSlop={8}
              >
                <Feather name="check" size={16} color={theme.colors.accentText} />
              </Pressable>
            )}
          </View>

          <Text style={styles.overline}>COR DA TAG</Text>

          <View style={styles.grade}>
            {paleta.map((cor, index) => {
              const selecionada = index === corAtual;
              const corVivo = paletaAcentuada[index];
              return (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.bolinhaWrapper,
                    selecionada && styles.bolinhaWrapperSelecionada,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => handleSelecionarCor(index)}
                >
                  <View style={[styles.bolinha, { backgroundColor: corVivo.base }]}>
                    {selecionada && <Feather name="check" size={16} color={cor.text} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.botaoApagar, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onSolicitarApagar}
          >
            <Feather name="trash-2" size={14} color={theme.colors.urgent} />
            <Text style={styles.botaoApagarTexto}>Apagar tag</Text>
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
    linhaNome: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: 4,
      marginBottom: theme.spacing.lg,
    },
    inputNome: {
      flex: 1,
      ...theme.typography.bodyMedium,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    botaoSalvarNome: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grade: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.md, marginTop: theme.spacing.sm },
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
    botaoApagar: {
      marginTop: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: theme.spacing.xs + 2,
    },
    botaoApagarTexto: { ...theme.typography.caption, color: theme.colors.urgent },
  });
}
