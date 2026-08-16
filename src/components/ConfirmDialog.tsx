// Modal de confirmação/aviso genérico, reaproveitado em todo o app (avisos
// de validação, confirmação de exclusão, escolha de escopo de edição
// recorrente etc). Suporta um terceiro botão opcional ("ação extra"), usado
// por exemplo pra oferecer "só esta ocorrência" vs "esta e as futuras".
import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  visivel: boolean;
  titulo: string;
  mensagem: string;
  icone?: keyof typeof Feather.glyphMap;

  textoCancelar?: string;
  textoConfirmar?: string;

  destrutivo?: boolean;

  textoAcaoExtra?: string;
  onAcaoExtra?: () => void;
  onConfirmar: () => void;
  onFechar: () => void;
};

export default function ConfirmDialog({
  visivel,
  titulo,
  mensagem,
  icone,
  textoCancelar,
  textoConfirmar = 'OK',
  destrutivo = false,
  textoAcaoExtra,
  onAcaoExtra,
  onConfirmar,
  onFechar,
}: Props) {
  const temAcaoExtra = !!(textoAcaoExtra && onAcaoExtra);
  const theme = useTheme();
  const styles = useMemo(() => criarStyles(theme), [theme]);

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

          {temAcaoExtra ? (
            // Com 3 botões, empilha em coluna (cabe melhor que 3 numa linha só).
            <View style={styles.botoesColuna}>
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
              <Pressable
                style={({ pressed }) => [styles.botaoSecundario, { opacity: pressed ? 0.7 : 1 }]}
                onPress={onAcaoExtra}
              >
                <Text style={styles.botaoSecundarioTexto} numberOfLines={1}>
                  {textoAcaoExtra}
                </Text>
              </Pressable>
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
            </View>
          ) : (
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
          )}
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

    botoesColuna: { gap: theme.spacing.sm },

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
