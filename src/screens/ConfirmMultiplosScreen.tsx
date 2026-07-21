import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { pedirPermissao, criarEventoNaAgenda } from '../services/calendarService';
import { salvarRegistro, listarTagsUnicas, listarCoresDeTags } from '../services/database';
import { NovoEvento } from '../types/event';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { corDaTag } from '../theme/theme';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatarData, formatarHora, combinarDataEHora, combinarComHora, abrirDatePicker, abrirTimePicker } from '../utils/dataHora';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmarMultiplos'>;

// MUDANÇA (item 3): estado local de cada card da lista — nasce a partir de
// um EventoExtraido (vindo do parser), mas ganha campos que o parser não
// tem: se está marcado pra confirmar, se o card está expandido, e as tags
// (o parser nunca sugere tag — isso é uma decisão dela, não algo extraído
// do texto). `chaveId` é só um id local estável pra key/list, não se
// relaciona a nada do banco (esses eventos ainda nem existem lá).
interface ItemMultiplo {
  chaveId: string;
  incluido: boolean;
  expandido: boolean;
  titulo: string;
  data: Date;
  tags: string[];
}

export default function ConfirmMultiplosScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => criarStyles(theme), [theme]);
  const { eventos } = route.params;

  const [itens, setItens] = useState<ItemMultiplo[]>(() =>
    eventos.map((e, indice) => ({
      chaveId: String(indice),
      incluido: true,
      expandido: false,
      titulo: e.titulo,
      // Um evento só entra nessa lista se `parseMultiplosEventos` já
      // confirmou que ele tem `data` ou `dataFim` (ver eventParser.ts) —
      // então o `?? new Date()` aqui é só pra satisfazer o TypeScript
      // (Date | null), nunca deveria de fato cair no fallback.
      data: e.data ?? new Date(),
      tags: [],
    }))
  );
  const [tagsExistentes, setTagsExistentes] = useState<string[]>([]);
  const [coresPorTag, setCoresPorTag] = useState<Record<string, number>>({});
  const [novaTagPorItem, setNovaTagPorItem] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ titulo: string; mensagem: string } | null>(null);

  useEffect(() => {
    setTagsExistentes(listarTagsUnicas());
    setCoresPorTag(listarCoresDeTags());
  }, []);

  const selecionados = itens.filter((i) => i.incluido);

  function atualizarItem(chaveId: string, patch: Partial<ItemMultiplo>) {
    setItens((atual) => atual.map((i) => (i.chaveId === chaveId ? { ...i, ...patch } : i)));
  }

  function alternarIncluido(chaveId: string) {
    atualizarItem(chaveId, { incluido: !itens.find((i) => i.chaveId === chaveId)?.incluido });
  }

  function alternarExpandido(chaveId: string) {
    atualizarItem(chaveId, { expandido: !itens.find((i) => i.chaveId === chaveId)?.expandido });
  }

  function removerItem(chaveId: string) {
    setItens((atual) => atual.filter((i) => i.chaveId !== chaveId));
  }

  function tagJaNoItem(item: ItemMultiplo, tag: string): boolean {
    const chave = tag.trim().toLowerCase();
    return item.tags.some((t) => t.trim().toLowerCase() === chave);
  }

  function alternarTagNoItem(item: ItemMultiplo, tag: string) {
    if (tagJaNoItem(item, tag)) {
      atualizarItem(item.chaveId, { tags: item.tags.filter((t) => t.trim().toLowerCase() !== tag.trim().toLowerCase()) });
    } else {
      atualizarItem(item.chaveId, { tags: [...item.tags, tag] });
    }
  }

  function adicionarNovaTagNoItem(item: ItemMultiplo) {
    const texto = (novaTagPorItem[item.chaveId] ?? '').trim();
    if (!texto || tagJaNoItem(item, texto)) return;
    atualizarItem(item.chaveId, { tags: [...item.tags, texto] });
    setNovaTagPorItem((atual) => ({ ...atual, [item.chaveId]: '' }));
  }

  /**
   * Salva em lote — chama `criarEventoNaAgenda` + `salvarRegistro` pra
   * cada item marcado, um de cada vez (não em paralelo: escrever vários
   * eventos ao mesmo tempo na agenda nativa por engano em caso de erro no
   * meio do lote é mais difícil de raciocinar do que uma falha sequencial
   * clara, e o volume aqui — uma lista de avisos colados — nunca é grande
   * o bastante pra latência sequencial importar de verdade).
   */
  async function handleConfirmarTodos() {
    if (selecionados.length === 0) return;

    const semTitulo = selecionados.find((i) => !i.titulo.trim());
    if (semTitulo) {
      setAviso({ titulo: 'Falta um título', mensagem: 'Todo evento marcado precisa de um título antes de confirmar.' });
      return;
    }

    setSalvando(true);
    try {
      const temPermissao = await pedirPermissao();
      if (!temPermissao) {
        setAviso({ titulo: 'Permissão necessária', mensagem: 'O app precisa de acesso à agenda pra salvar os eventos.' });
        return;
      }

      for (const item of selecionados) {
        const evento: NovoEvento = {
          titulo: item.titulo.trim(),
          data: item.data,
          tags: item.tags,
        };
        const nativeEventId = await criarEventoNaAgenda(evento);
        salvarRegistro(nativeEventId, item.tags);
      }

      navigation.navigate('Dashboard');
    } catch {
      setAviso({
        titulo: 'Erro ao salvar',
        mensagem: 'Não foi possível salvar todos os eventos. Os que já foram criados continuam na sua agenda — tente de novo pro restante.',
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.overline}>{itens.length} EVENTOS ENCONTRADOS</Text>
          <Text style={styles.titulo}>Revise antes de confirmar</Text>
        </View>
      </View>
      <Text style={styles.subtitulo}>
        Toque num evento pra editar título, data, hora ou tags. Desmarque o que não quer salvar, ou apague o card
        inteiro com o ícone de lixeira.
      </Text>

      <FlatList
        data={itens}
        keyExtractor={(item) => item.chaveId}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const cores = item.tags.map((t) => corDaTag(coresPorTag[t.trim().toLowerCase()] ?? 0, theme.mode));
          const corFaixa = cores.length > 0 ? cores[0].base : theme.colors.textMuted;

          return (
            <View style={[styles.card, !item.incluido && styles.cardExcluido]}>
              <View style={[styles.faixa, { backgroundColor: corFaixa }]} />
              <View style={styles.cardConteudo}>
                <View style={styles.cardTopo}>
                  <Pressable onPress={() => alternarIncluido(item.chaveId)} hitSlop={8}>
                    <Feather
                      name={item.incluido ? 'check-square' : 'square'}
                      size={20}
                      color={item.incluido ? theme.colors.accent : theme.colors.textMuted}
                    />
                  </Pressable>

                  <Pressable style={{ flex: 1 }} onPress={() => alternarExpandido(item.chaveId)}>
                    <Text style={styles.cardTitulo} numberOfLines={item.expandido ? undefined : 1}>
                      {item.titulo || 'Sem título'}
                    </Text>
                    {!item.expandido && (
                      <Text style={styles.cardData}>
                        {formatarData(item.data)} · {formatarHora(item.data)}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable onPress={() => alternarExpandido(item.chaveId)} hitSlop={8}>
                    <Feather
                      name={item.expandido ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>
                  <Pressable onPress={() => removerItem(item.chaveId)} hitSlop={8}>
                    <Feather name="trash-2" size={17} color={theme.colors.urgent} />
                  </Pressable>
                </View>

                {item.expandido && (
                  <View style={styles.cardExpandido}>
                    <Text style={styles.label}>TÍTULO</Text>
                    <TextInput
                      style={styles.input}
                      value={item.titulo}
                      onChangeText={(texto) => atualizarItem(item.chaveId, { titulo: texto })}
                      placeholder="Título do evento"
                      placeholderTextColor={theme.colors.textMuted}
                    />

                    <View style={styles.linhaDupla}>
                      <View style={styles.inputMetade}>
                        <Text style={styles.label}>DATA</Text>
                        <Pressable
                          style={[styles.input, styles.inputPressable]}
                          onPress={() =>
                            abrirDatePicker(item.data, (novaData) =>
                              atualizarItem(item.chaveId, { data: combinarDataEHora(item.data, novaData) })
                            )
                          }
                        >
                          <Text style={styles.inputPressableTexto}>{formatarData(item.data)}</Text>
                          <Feather name="calendar" size={15} color={theme.colors.textMuted} />
                        </Pressable>
                      </View>
                      <View style={styles.inputMetade}>
                        <Text style={styles.label}>HORA</Text>
                        <Pressable
                          style={[styles.input, styles.inputPressable]}
                          onPress={() =>
                            abrirTimePicker(item.data, (novaHora) =>
                              atualizarItem(item.chaveId, { data: combinarComHora(item.data, novaHora) })
                            )
                          }
                        >
                          <Text style={styles.inputPressableTexto}>{formatarHora(item.data)}</Text>
                          <Feather name="clock" size={15} color={theme.colors.textMuted} />
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.label}>TAGS (OPCIONAL)</Text>
                    {item.tags.length > 0 && (
                      <View style={styles.chipsRow}>
                        {item.tags.map((t) => {
                          const cor = corDaTag(coresPorTag[t.trim().toLowerCase()] ?? 0, theme.mode);
                          return (
                            <Pressable
                              key={t}
                              style={({ pressed }) => [styles.chip, styles.chipSelecionado, { opacity: pressed ? 0.7 : 1 }]}
                              onPress={() => alternarTagNoItem(item, t)}
                            >
                              <View style={[styles.chipBolinha, { backgroundColor: cor.base }]} />
                              <Text style={[styles.chipTexto, styles.chipTextoSelecionado]}>{t}</Text>
                              <Feather name="x" size={10} color={theme.colors.textPrimary} />
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                    <View style={styles.linhaAdicionarTag}>
                      <TextInput
                        style={[styles.input, styles.inputAdicionarTag]}
                        placeholder="Adicionar tag"
                        placeholderTextColor={theme.colors.textMuted}
                        value={novaTagPorItem[item.chaveId] ?? ''}
                        onChangeText={(texto) => setNovaTagPorItem((atual) => ({ ...atual, [item.chaveId]: texto }))}
                        onSubmitEditing={() => adicionarNovaTagNoItem(item)}
                        returnKeyType="done"
                      />
                      <Pressable
                        style={({ pressed }) => [styles.botaoAdicionarTag, { opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => adicionarNovaTagNoItem(item)}
                        hitSlop={8}
                      >
                        <Feather name="plus" size={16} color={theme.colors.accentText} />
                      </Pressable>
                    </View>
                    {tagsExistentes.filter((t) => !tagJaNoItem(item, t)).length > 0 && (
                      <View style={styles.chipsRow}>
                        {tagsExistentes
                          .filter((t) => !tagJaNoItem(item, t))
                          .map((t) => {
                            const cor = corDaTag(coresPorTag[t.trim().toLowerCase()] ?? 0, theme.mode);
                            return (
                              <Pressable
                                key={t}
                                style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]}
                                onPress={() => alternarTagNoItem(item, t)}
                              >
                                <View style={[styles.chipBolinha, { backgroundColor: cor.base }]} />
                                <Text style={styles.chipTexto}>{t}</Text>
                              </Pressable>
                            );
                          })}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Feather name="inbox" size={22} color={theme.colors.textMuted} />
            <Text style={styles.vazio}>Nenhum evento restante — todos foram removidos da lista.</Text>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [
          styles.botaoPrincipalWrapper,
          (selecionados.length === 0 || salvando) && styles.botaoDesabilitado,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handleConfirmarTodos}
        disabled={selecionados.length === 0 || salvando}
      >
        <View style={[styles.botaoPrincipal, { backgroundColor: theme.colors.accent }]}>
          {salvando ? (
            <ActivityIndicator color={theme.colors.accentText} />
          ) : (
            <>
              <Text style={styles.botaoPrincipalTexto}>
                Confirmar todos {selecionados.length > 0 ? `(${selecionados.length})` : ''}
              </Text>
              <Feather name="check" size={17} color={theme.colors.accentText} />
            </>
          )}
        </View>
      </Pressable>

      <ConfirmDialog
        visivel={aviso !== null}
        titulo={aviso?.titulo ?? ''}
        mensagem={aviso?.mensagem ?? ''}
        icone="alert-circle"
        textoConfirmar="Entendi"
        onConfirmar={() => setAviso(null)}
        onFechar={() => setAviso(null)}
      />
    </SafeAreaView>
  );
}

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
    overline: { ...theme.typography.overline, color: theme.colors.accent },
    titulo: { ...theme.typography.heading, fontSize: 20, color: theme.colors.textPrimary, marginTop: 2 },
    subtitulo: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.md,
      lineHeight: 20,
    },
    // MUDANÇA (item 3): reaproveita a mesma base visual dos cards do
    // Dashboard (traço lateral colorido + fundo elevado + sombra) — ver
    // `card`/`faixa` em DashboardScreen.tsx.
    card: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      marginBottom: theme.spacing.sm + 2,
    },
    // Desmarcado (não vai ser confirmado): opacidade reduzida no card
    // inteiro, mesma linguagem visual usada em botões desabilitados.
    cardExcluido: { opacity: 0.5 },
    faixa: { width: 6 },
    cardConteudo: { flex: 1, padding: theme.spacing.md },
    cardTopo: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    cardTitulo: { ...theme.typography.bodyMedium, color: theme.colors.textPrimary },
    cardData: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
    cardExpandido: { marginTop: theme.spacing.md },
    label: { ...theme.typography.overline, color: theme.colors.textMuted, marginBottom: theme.spacing.xs },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm + 2,
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm + 2,
      backgroundColor: theme.colors.surface,
    },
    inputPressable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    inputPressableTexto: { ...theme.typography.body, color: theme.colors.textPrimary },
    linhaDupla: { flexDirection: 'row', gap: theme.spacing.sm },
    inputMetade: { flex: 1 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 5,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipSelecionado: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    chipBolinha: { width: 7, height: 7, borderRadius: 4 },
    chipTexto: { ...theme.typography.caption, color: theme.colors.textSecondary },
    chipTextoSelecionado: { color: theme.colors.textPrimary },
    linhaAdicionarTag: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' },
    inputAdicionarTag: { flex: 1 },
    botaoAdicionarTag: {
      width: 42,
      height: 42,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vazioContainer: { alignItems: 'center', marginTop: theme.spacing.xl, gap: theme.spacing.md },
    vazio: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
    botaoPrincipalWrapper: { marginTop: theme.spacing.sm },
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
