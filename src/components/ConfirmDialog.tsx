import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  visivel: boolean;
  titulo: string;
  mensagem: string;
  icone?: keyof typeof Feather.glyphMap;
  // Se textoCancelar for omitido, o diálogo vira informativo (só um botão).
  textoCancelar?: string;
  textoConfirmar?: string;
  // Estilo destrutivo (vermelho) pra ações como apagar — reaproveita a
  // mesma linguagem visual do botão de apagar por swipe no Dashboard
  // (urgentBg + borda urgent), em vez de inventar uma cor nova aqui.
  destrutivo?: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
};

// Substitui o Alert.alert nativo (que não segue tema nenhum, sempre sai
// branco/estilo Material puro) por um modal no mesmo padrão visual do
// TagColorPicker: cartão com puxador, overline, título e botões nos
// tokens do tema. Reutilizável em qualquer confirmação/aviso do app.
export default function ConfirmDialog({
  visivel,
  titulo,
  mensagem,
  icone,
  textoCancelar,
  textoConfirmar = 'OK',
  destrutivo = false,
  onConfirmar,
  onFechar,
}: Props) {
  const theme = useTheme();
  const styles = criarStyles(theme);

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.backdrop} onPress={onFechar}>
        <Pressable style={styles.cartao} onPress={(e) => e.stopPropagation()}>
          <View style={styles.puxador} />

          {icone && (
            <View style={[styles.iconeCirculo, destrutivo && styles.iconeCirculoDestrutivo]}>
              <Feather name={icone} size={20} color={destrutivo ? theme.colors.urgent : theme.colors.accent} />
            </View>
          )}

          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.mensagem}>{mensagem}</Text>

          <View style={styles.botoesRow}>
            {textoCancelar && (
              <Pressable
                style={({ pressed }) => [styles.botaoSecundario, { opacity: pressed ? 0.7 : 1 }]}
                onPress={onFechar}
              >
                <Text style={styles.botaoSecundarioTexto} numberOfLines={1}>
                  {textoCancelar}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.botaoPrincipal,
                destrutivo && styles.botaoPrincipalDestrutivo,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={onConfirmar}
            >
              <Text
                style={[styles.botaoPrincipalTexto, destrutivo && styles.botaoPrincipalTextoDestrutivo]}
                numberOfLines={1}
              >
                {textoConfirmar}
              </Text>
            </Pressable>
          </View>
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
    iconeCirculo: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: theme.spacing.sm,
    },
    iconeCirculoDestrutivo: {
      backgroundColor: theme.colors.urgentBg,
    },
    titulo: {
      ...theme.typography.heading,
      fontSize: 19,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    mensagem: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.xs + 2,
      marginBottom: theme.spacing.lg,
      lineHeight: 20,
    },
    botoesRow: { flexDirection: 'row', gap: theme.spacing.sm },
    // minHeight fixo nos dois botões: o texto muda de tamanho conforme o
    // estado ("Cancelar" vs "Apagar" vs "Entendi"), mas a altura do botão
    // não pode mudar por causa disso — mesmo raciocínio aplicado nos
    // botões da ConfirmScreen.
    botaoSecundario: {
      flex: 1,
      minHeight: 50,
      padding: theme.spacing.md - 2,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoSecundarioTexto: { ...theme.typography.bodyMedium, color: theme.colors.textPrimary },
    botaoPrincipal: {
      flex: 1,
      minHeight: 50,
      padding: theme.spacing.md - 2,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
    },
    botaoPrincipalDestrutivo: {
      backgroundColor: theme.colors.urgentBg,
      borderWidth: 1,
      borderColor: theme.colors.urgent + '40',
    },
    botaoPrincipalTexto: { ...theme.typography.bodyMedium, color: theme.colors.accentText },
    botaoPrincipalTextoDestrutivo: { color: theme.colors.urgent },
  });
}
