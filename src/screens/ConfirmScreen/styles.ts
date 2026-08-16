// Estilos do formulário de confirmação de evento (ConfirmScreen).
import { StyleSheet } from 'react-native';
import type { useTheme } from '../../theme/ThemeContext';
import { criarEstilosConfirmacaoCompartilhados } from '../estilosConfirmacaoCompartilhados';

export function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    ...criarEstilosConfirmacaoCompartilhados(theme),
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1, padding: theme.spacing.lg },
    titulo: { ...theme.typography.heading, color: theme.colors.textPrimary, marginTop: 6, marginBottom: theme.spacing.lg },
    label: { ...theme.typography.overline, color: theme.colors.textMuted, marginBottom: theme.spacing.xs + 2 },
    labelComIcone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing.xs + 2 },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm + 4,
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surfaceElevated,
    },
    inputFocado: {
      borderColor: theme.colors.accent,
      borderWidth: 1.5,
    },

    limparLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      marginTop: -theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    limparLinkTexto: { ...theme.typography.caption, color: theme.colors.accent },
    textarea: { minHeight: 64, textAlignVertical: 'top' },
    avisoIntervalo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs + 2,
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm + 2,
      marginBottom: theme.spacing.md,
    },
    avisoIntervaloTexto: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    dicaHoraCompartilhada: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: -theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs + 2, marginBottom: theme.spacing.lg },

    inputAdicionarTag: { flex: 1, marginBottom: theme.spacing.md },
    botaoAdicionarTag: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: theme.spacing.xs + 1,
      paddingHorizontal: theme.spacing.sm + 2,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipTextoSelecionado: { color: theme.colors.textPrimary, fontFamily: theme.typography.bodyMedium.fontFamily },
    botoesRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg },
    botaoSecundario: {
      flex: 1,

      minHeight: 56,
      flexDirection: 'row',
      gap: theme.spacing.xs + 2,
      padding: theme.spacing.md - 2,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoSecundarioTexto: { ...theme.typography.bodyMedium, color: theme.colors.textPrimary },
    botaoPrincipalWrapper: { flex: 1 },
    botaoPrincipal: {
      minHeight: 56,
      flexDirection: 'row',
      borderRadius: theme.radius.md,
      padding: theme.spacing.md - 2,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.glow.color,
      shadowOpacity: theme.glow.opacity,
      shadowRadius: theme.glow.radius,
      shadowOffset: { width: 0, height: theme.glow.offsetY },
      elevation: 4,
    },
    spinner: { marginRight: theme.spacing.xs },
  });
}
