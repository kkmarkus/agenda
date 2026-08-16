import React, { useMemo, useState } from 'react';
import { Text, TextInput, Pressable, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseMultiplosEventos, parseTextoLivre } from '../services/eventParser';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Input'>;

export default function InputScreen({ navigation }: Props) {
  const theme = useTheme();
  const [textoLivre, setTextoLivre] = useState('');
  const [focado, setFocado] = useState(false);

  // Se o parser reconhecer mais de um evento no texto (lista ou
  // parágrafo com várias datas), vai pra tela de confirmação em lote em
  // vez da tela de confirmação de evento único.
  function handleAnalisarTexto() {
    if (!textoLivre.trim()) return;

    const extraidos = parseMultiplosEventos(textoLivre);

    if (extraidos.length > 1) {
      navigation.navigate('ConfirmarMultiplos', { eventos: extraidos });
      return;
    }

    // Só achou 0 ou 1 evento na análise de múltiplos: refaz como texto
    // único pra garantir o resultado mais completo (ex: reconhece
    // intervalo, que a análise de múltiplos não tenta separar).
    const extraido = extraidos[0] ?? parseTextoLivre(textoLivre);

    navigation.navigate('Confirmar', {
      rascunho: {
        titulo: extraido.titulo,
        data: extraido.data ?? undefined,
        recorrencia: extraido.recorrencia,
      },
      dataFim: extraido.dataFim ?? undefined,
    });
  }

  const styles = useMemo(() => criarStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.iconeCirculo}>
        <Feather name="edit-3" size={19} color={theme.colors.accentText} />
      </View>
      <Text style={styles.overline}>NOVO EVENTO</Text>
      <Text style={styles.titulo}>O que você precisa lembrar?</Text>
      <Text style={styles.subtitulo}>Digite ou cole o texto do evento — a gente extrai o resto</Text>

      <TextInput
        style={[styles.textarea, focado && styles.textareaFocada]}
        multiline
        placeholder="Ex: reunião com cliente dia 20/07 às 14h"
        placeholderTextColor={theme.colors.textMuted}
        value={textoLivre}
        onChangeText={setTextoLivre}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
      />
      <Pressable
        style={({ pressed }) => [
          styles.botaoPrincipalWrapper,
          !textoLivre.trim() && styles.botaoDesabilitado,
          { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
        onPress={handleAnalisarTexto}
        disabled={!textoLivre.trim()}
      >
        <View style={[styles.botaoPrincipal, { backgroundColor: theme.colors.accent }]}>
          <Text style={styles.botaoPrincipalTexto}>Analisar evento</Text>
          <Feather name="arrow-right" size={17} color={theme.colors.accentText} />
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
    iconeCirculo: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    overline: { ...theme.typography.overline, color: theme.colors.accent },
    titulo: { ...theme.typography.heading, color: theme.colors.textPrimary, marginTop: 6 },
    subtitulo: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
      lineHeight: 20,
    },
    textarea: {
      minHeight: 150,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      textAlignVertical: 'top',
      backgroundColor: theme.colors.surfaceElevated,
    },
    textareaFocada: {
      borderColor: theme.colors.accent,
      borderWidth: 1.5,
    },
    botaoPrincipalWrapper: { marginTop: theme.spacing.lg },
    botaoDesabilitado: { opacity: 0.5 },
    botaoPrincipal: {
      flexDirection: 'row',
      gap: theme.spacing.xs + 2,
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
    botaoPrincipalTexto: { ...theme.typography.bodyMedium, color: theme.colors.accentText },
  });
}
