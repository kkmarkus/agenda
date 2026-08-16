// Painel de gerenciamento de tags: lista tags em uso com contagem de
// eventos, permite trocar cor, renomear (ou mesclar com outra tag
// existente) e apagar.
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
import { corDaTag, corDaTagAcentuada, TAG_WASH_ALPHA } from '../theme/theme';
import TagColorPicker from './TagColorPicker';
import ConfirmDialog from './ConfirmDialog';

export default function TagsPanelContent() {
  const theme = useTheme();
  const styles = useMemo(() => criarStyles(theme), [theme]);
  const [tags, setTags] = useState<{ tag: string | null; total: number }[]>([]);
  const [coresPorTag, setCoresPorTag] = useState<Record<string, number>>({});
  const [tagEmEdicao, setTagEmEdicao] = useState<string | null>(null);

  const [tagParaApagar, setTagParaApagar] = useState<string | null>(null);

  useEffect(() => {
    carregar();
  }, []);

  function carregar() {
    setTags(contarPorTag());
    setCoresPorTag(listarCoresDeTags());
  }

  // Fallback pro índice da posição na lista se a tag ainda não tiver cor
  // salva (não deveria acontecer em uso normal, já que toda tag nova
  // recebe cor automaticamente — é só uma proteção extra).
  function corIndexDe(tag: string, indiceNaLista: number): number {
    return coresPorTag[tag.trim().toLowerCase()] ?? indiceNaLista;
  }

  // Se o nome mudou junto da cor (TagColorPicker manda os dois de uma
  // vez), trata como mesclagem/renome — senão só troca a cor.
  //
  // Importante: se o novo nome já existe como outra tag, isso é uma
  // MESCLAGEM (não uma renomeação), e a cor da tag de destino (a que já
  // existia) deve prevalecer — não a cor que o usuário tinha acabado de
  // selecionar pra tag de origem. `renomearOuMesclarTag` já decide isso
  // corretamente internamente; aqui só evitamos sobrescrever esse
  // resultado chamando `definirCorDaTag` por cima quando for mesclagem.
  function handleTrocarCor(corIndex: number, novoNomeSeAlterado?: string) {
    if (!tagEmEdicao) return;

    if (novoNomeSeAlterado) {
      const chaveDestino = novoNomeSeAlterado.trim().toLowerCase();
      const ehMesclagem = coresPorTag[chaveDestino] !== undefined && chaveDestino !== tagEmEdicao.trim().toLowerCase();

      renomearOuMesclarTag(tagEmEdicao, novoNomeSeAlterado);
      if (!ehMesclagem) {
        definirCorDaTag(novoNomeSeAlterado, corIndex);
      }
      setTagEmEdicao(null);
      carregar();
      return;
    }

    definirCorDaTag(tagEmEdicao, corIndex);
    setCoresPorTag((atual) => ({ ...atual, [tagEmEdicao.trim().toLowerCase()]: corIndex }));
    setTagEmEdicao(null);
  }

  function handleRenomear(novoNome: string) {
    if (!tagEmEdicao) return;
    renomearOuMesclarTag(tagEmEdicao, novoNome);
    setTagEmEdicao(null);
    carregar();
  }

  function handleSolicitarApagar() {
    if (!tagEmEdicao) return;

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

            const corAcentuada = corDaTagAcentuada(corIndexDe(item.tag, index), theme.mode);
            return (
              <Pressable
                style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => setTagEmEdicao(item.tag)}
              >
                <View style={[styles.faixa, { backgroundColor: corAcentuada.base }]} />
                <View style={styles.cardConteudo}>
                  <View style={styles.cardEsquerda}>
                    <View style={[styles.iconeTag, { backgroundColor: cor.base + TAG_WASH_ALPHA }]}>
                      <Feather name="tag" size={13} color={corAcentuada.base} />
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
