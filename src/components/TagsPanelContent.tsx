import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  contarPorTag,
  listarCoresDeTags,
  definirCorDaTag,
  renomearOuMesclarTag,
  apagarTagDeTodosOsEventos,
  SEM_TAG_LABEL,
} from '../services/database';
import { useTheme } from '../theme/ThemeContext';
import { corDaTag, TAG_WASH_ALPHA } from '../theme/theme';
import TagColorPicker from './TagColorPicker';
import ConfirmDialog from './ConfirmDialog';

// MUDANÇA (item 7): mesmo conteúdo que antes vivia em TagsScreen.tsx,
// extraído pra um componente sem depender de NativeStackScreenProps nem de
// navegação — chama as mesmas funções de database.ts de sempre, só que
// agora renderizado dentro de um SlidePanel empilhado em vez de uma tela
// cheia. `useFocusEffect` (que dependia do ciclo de vida de uma rota) virou
// um `useEffect` de montagem simples: como o componente só existe enquanto
// o painel está aberto, montar de novo a cada abertura já cobre o caso de
// "uma tag nova pode ter sido criada desde a última visita".
//
// CORREÇÃO (remoção do botão de voltar): saía junto do "arrow-left" que
// havia no cabeçalho — sair deste painel agora depende só do backdrop ou
// do voltar nativo do Android (ver `fecharUmNivel` em SettingsDrawer.tsx),
// então este componente não precisa mais de uma prop de navegação própria.
export default function TagsPanelContent() {
  const theme = useTheme();
  const styles = useMemo(() => criarStyles(theme), [theme]);
  const [tags, setTags] = useState<{ tag: string | null; total: number }[]>([]);
  const [coresPorTag, setCoresPorTag] = useState<Record<string, number>>({});
  const [tagEmEdicao, setTagEmEdicao] = useState<string | null>(null);
  // MUDANÇA (9.2): separado de tagEmEdicao pra poder mostrar o
  // ConfirmDialog destrutivo DEPOIS de fechar o TagColorPicker — dois
  // modais abertos ao mesmo tempo (um por cima do outro) funcionaria, mas
  // fica visualmente mais limpo fechar um antes de abrir o outro.
  const [tagParaApagar, setTagParaApagar] = useState<string | null>(null);

  useEffect(() => {
    carregar();
  }, []);

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

  // MUDANÇA (9.2): renomear (ou, se o nome novo já existir, mesclar
  // automaticamente com a tag existente — ver renomearOuMesclarTag).
  function handleRenomear(novoNome: string) {
    if (!tagEmEdicao) return;
    renomearOuMesclarTag(tagEmEdicao, novoNome);
    setTagEmEdicao(null);
    carregar(); // recarrega contagens/cores do zero: mesclagem pode ter reduzido o total de tags
  }

  function handleSolicitarApagar() {
    if (!tagEmEdicao) return;
    // Fecha o picker de cor e abre a confirmação destrutiva em seu lugar.
    setTagParaApagar(tagEmEdicao);
    setTagEmEdicao(null);
  }

  function handleConfirmarApagar() {
    if (!tagParaApagar) return;
    apagarTagDeTodosOsEventos(tagParaApagar);
    setTagParaApagar(null);
    carregar();
  }

  const tagsReais = tags.filter((t): t is { tag: string; total: number } => t.tag !== null);
  const grupoSemTag = tags.find((t) => t.tag === null);

  const cabecalho = (
    <View style={styles.headerTopRow}>
      <View>
        <Text style={styles.overline}>ORGANIZAÇÃO</Text>
        <Text style={styles.titulo}>Tags</Text>
      </View>
    </View>
  );

  if (tagsReais.length === 0 && !grupoSemTag) {
    return (
      <View style={styles.container}>
        {cabecalho}
        <View style={styles.vazioContainer}>
          <View style={styles.vazioIconeCirculo}>
            <Feather name="tag" size={22} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.vazio}>
            Novas tags aparecem aqui automaticamente conforme você as usa nos eventos.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {cabecalho}
      <Text style={styles.subtitulo}>Toque numa tag pra trocar a cor dela</Text>

      {grupoSemTag && (
        <View style={styles.cardSemTag}>
          <View style={styles.cardEsquerda}>
            <View style={[styles.iconeTag, { backgroundColor: theme.colors.border }]}>
              <Feather name="slash" size={13} color={theme.colors.textMuted} />
            </View>
            <Text style={[styles.cardTitulo, { color: theme.colors.textMuted }]}>{SEM_TAG_LABEL}</Text>
          </View>
          <Text style={styles.cardContagem}>
            {grupoSemTag.total === 1 ? '1 evento' : `${grupoSemTag.total} eventos`}
          </Text>
        </View>
      )}

      {tagsReais.length > 0 && (
        <FlatList
          data={tagsReais}
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
      )}

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
        onRenomear={handleRenomear}
        onSolicitarApagar={handleSolicitarApagar}
        onFechar={() => setTagEmEdicao(null)}
      />

      <ConfirmDialog
        visivel={tagParaApagar !== null}
        titulo="Apagar tag"
        mensagem={
          tagParaApagar
            ? `Apagar a tag "${tagParaApagar}"? Os eventos não são apagados, só deixam de ter essa tag.`
            : ''
        }
        icone="trash-2"
        destrutivo
        textoCancelar="Cancelar"
        textoConfirmar="Apagar"
        onConfirmar={handleConfirmarApagar}
        onFechar={() => setTagParaApagar(null)}
      />
    </View>
  );
}

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
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
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      marginBottom: theme.spacing.sm + 2,
    },
    faixa: { width: 3 },
    cardSemTag: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
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
