import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { TAG_PALETTE_LIGHT, TAG_PALETTE_DARK } from '../theme/theme';

type Props = {
  visivel: boolean;
  tag: string;
  corAtual: number;
  onSelecionar: (corIndex: number) => void;
  // MUDANÇA (9.2): novoNome já vem "trimado" e sem estar vazio — quem
  // chama (TagsPanelContent) decide o que fazer com mesclagem (aqui o
  // picker só avisa que o nome mudou, a lógica de mesclar/renomear vive
  // em database.ts).
  onRenomear: (novoNome: string) => void;
  // Só sinaliza a intenção — a confirmação destrutiva (ConfirmDialog) e a
  // chamada real de apagar vivem em TagsPanelContent, não aqui, pra não
  // empilhar modal-dentro-de-modal-de-confirmação neste componente.
  onSolicitarApagar: () => void;
  onFechar: () => void;
};

// Modal com as bolinhas da paleta do tema atual — toque pra escolher, toque
// fora ou em "Fechar" pra cancelar. Também permite renomear (e, ao renomear
// pra um nome já existente, mesclar automaticamente) ou apagar a tag por
// completo. Chamado a partir de um toque simples no card da tag em
// TagsPanelContent.
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
  // Paleta muda com o tema (claro/escuro) pra manter contraste — o índice
  // gravado no banco é o mesmo, só a cor exibida em cada posição muda.
  const paleta = theme.mode === 'dark' ? TAG_PALETTE_DARK : TAG_PALETTE_LIGHT;

  // Estado local do campo de nome — reseta pro nome atual sempre que o
  // modal abre pra uma tag diferente (ou reabre pra mesma), pra nunca
  // mostrar um rascunho de edição de uma abertura anterior.
  const [nome, setNome] = useState(tag);
  useEffect(() => {
    if (visivel) setNome(tag);
  }, [visivel, tag]);

  const nomeMudou = nome.trim().length > 0 && nome.trim() !== tag;

  function handleSalvarNome() {
    if (!nomeMudou) return;
    onRenomear(nome.trim());
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
