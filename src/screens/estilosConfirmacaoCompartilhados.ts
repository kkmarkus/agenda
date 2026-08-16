// Estilos idênticos entre `ConfirmScreen` (evento único) e
// `ConfirmMultiplosScreen` (lote) — as duas telas compartilham o mesmo
// vocabulário visual de formulário (chips de tag, campo tipo Pressable,
// texto do botão principal etc).
//
// Importante: isso NÃO junta tudo que é "parecido" entre as duas telas —
// vários estilos com o mesmo papel têm valores propositalmente diferentes
// (o card de lote é mais compacto, com paddings/gaps menores, porque
// cabem vários por tela). Só entram aqui os que são byte-a-byte iguais
// nos dois arquivos; se algum dia um dos dois precisar de um valor
// diferente, é só remover a chave daqui e voltar a declarar localmente —
// não force os dois a ficarem iguais.
import type { useTheme } from '../theme/ThemeContext';

export function criarEstilosConfirmacaoCompartilhados(theme: ReturnType<typeof useTheme>) {
  return {
    overline: { ...theme.typography.overline, color: theme.colors.accent },
    inputPressable: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    inputPressableTexto: { ...theme.typography.body, color: theme.colors.textPrimary },
    linhaDupla: { flexDirection: 'row' as const, gap: theme.spacing.sm },
    inputMetade: { flex: 1 },
    chipSelecionado: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    chipBolinha: { width: 7, height: 7, borderRadius: 4 },
    chipTexto: { ...theme.typography.caption, color: theme.colors.textSecondary },
    linhaAdicionarTag: { flexDirection: 'row' as const, gap: theme.spacing.sm, alignItems: 'flex-start' as const },
    botaoPrincipalTexto: { ...theme.typography.bodyMedium, color: theme.colors.accentText },
  };
}
