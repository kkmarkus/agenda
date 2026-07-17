import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { contarPorTag, listarCoresDeTags, definirCorDaTag } from '../services/database';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { corDaTag, TAG_WASH_ALPHA } from '../theme/theme';
import TagColorPicker from '../components/TagColorPicker';

// CORREÇÃO: mesmo problema das outras telas — Props simplificado próprio
// substituído pelo tipo real de navegação.
type Props = NativeStackScreenProps<RootStackParamList, 'Tags'>;

// MUDANÇA: essa tela deixou de ser um "seletor de filtro" (isso agora
// vive nas abas do Dashboard) — o único papel dela agora é gerenciar a
// cor de cada tag. Por isso o toque simples no card já abre o seletor de
// cor direto, sem precisar de toque longo.
export default function TagsScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = criarStyles(theme);
  const [tags, setTags] = useState<{ tag: string; total: number }[]>([]);
  const [coresPorTag, setCoresPorTag] = useState<Record<string, number>>({});
  const [tagEmEdicao, setTagEmEdicao] = useState<string | null>(null);

  // Mesma lógica do Dashboard: recarrega toda vez que a tela ganha foco,
  // já que uma tag nova pode ter sido criada desde a última visita.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [])
  );

  function carregar() {
    setTags(contarPorTag());
    setCoresPorTag(listarCoresDeTags());
  }

  function corIndexDe(tag: string, indiceNaLista: number): number {
    return coresPorTag[tag.trim().toLowerCase()] ?? indiceNaLista;
  }

  function handleTrocarCor(corIndex: number) {
    if (!tagEmEdicao) return;
    definirCorDaTag(tagEmEdicao, corIndex);
    setCoresPorTag((atual) => ({ ...atual, [tagEmEdicao.trim().toLowerCase()]: corIndex }));
    setTagEmEdicao(null);
  }

  const cabecalho = (
    <View style={styles.headerTopRow}>
      <Pressable
        style={({ pressed }) => [styles.voltar, { opacity: pressed ? 0.6 : 1 }]}
        onPress={() => navigation.goBack()}
        hitSlop={10}
      >
        <Feather name="arrow-left" size={18} color={theme.colors.textSecondary} />
      </Pressable>
      <View>
        <Text style={styles.overline}>ORGANIZAÇÃO</Text>
        <Text style={styles.titulo}>Tags</Text>
      </View>
    </View>
  );

  if (tags.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {cabecalho}
        <View style={styles.vazioContainer}>
          <View style={styles.vazioIconeCirculo}>
            <Feather name="tag" size={22} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.vazio}>
            Novas tags aparecem aqui automaticamente conforme você as usa nos eventos.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {cabecalho}
      <Text style={styles.subtitulo}>Toque numa tag pra trocar a cor dela</Text>
      <FlatList
        data={tags}
        keyExtractor={(item) => item.tag}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const cor = corDaTag(corIndexDe(item.tag, index), theme.mode);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() => setTagEmEdicao(item.tag)}
            >
              <View style={[styles.faixa, { backgroundColor: cor.base }]} />
              <View style={styles.cardConteudo}>
                <View style={styles.cardEsquerda}>
                  <View style={[styles.iconeTag, { backgroundColor: cor.base + TAG_WASH_ALPHA }]}>
                    <Feather name="tag" size={13} color={cor.base} />
                  </View>
                  <Text style={styles.cardTitulo}>{item.tag}</Text>
                </View>
                <View style={styles.cardDireita}>
                  <Text style={styles.cardContagem}>
                    {item.total === 1 ? '1 evento' : `${item.total} eventos`}
                  </Text>
                  <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <TagColorPicker
        visivel={tagEmEdicao !== null}
        tag={tagEmEdicao ?? ''}
        corAtual={
          tagEmEdicao
            ? corIndexDe(
                tagEmEdicao,
                tags.findIndex((t) => t.tag === tagEmEdicao)
              )
            : 0
        }
        onSelecionar={handleTrocarCor}
        onFechar={() => setTagEmEdicao(null)}
      />
    </SafeAreaView>
  );
}

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
    voltar: {
      width: 34,
      height: 34,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overline: { ...theme.typography.overline, color: theme.colors.textMuted },
    titulo: { ...theme.typography.heading, fontSize: 22, color: theme.colors.textPrimary, marginTop: 2 },
    subtitulo: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    vazioContainer: { alignItems: 'center', marginTop: theme.spacing.xl + theme.spacing.md, gap: theme.spacing.md },
    vazioIconeCirculo: {
      width: 56,
      height: 56,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vazio: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 21,
      paddingHorizontal: theme.spacing.lg,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      marginBottom: theme.spacing.sm + 2,
      shadowColor: theme.shadow.color,
      shadowOpacity: theme.shadow.opacity,
      shadowRadius: theme.shadow.radius,
      shadowOffset: { width: 0, height: theme.shadow.offsetY },
      elevation: theme.shadow.opacity > 0 ? 2 : 0,
    },
    faixa: { width: 3 },
    cardConteudo: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.md,
    },
    cardEsquerda: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    iconeTag: {
      width: 28,
      height: 28,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitulo: { ...theme.typography.bodyMedium, color: theme.colors.textPrimary },
    cardDireita: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardContagem: { ...theme.typography.caption, color: theme.colors.textSecondary },
  });
}
