import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { buscarEventoDaAgenda, apagarEventoDaAgenda } from '../services/calendarService';
import { listarRegistros, apagarRegistro, listarCoresDeTags, listarTagsUnicas } from '../services/database';
import { EventoApp } from '../types/event';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { corDaTag, TAG_WASH_ALPHA } from '../theme/theme';
import SkeletonBlock from '../components/SkeletonBlock';

// CORREÇÃO: antes cada tela declarava seu próprio tipo de Props "simplificado",
// desalinhado do RootStackParamList real do AppNavigator. Usando
// NativeStackScreenProps aqui, o TypeScript passa a checar de verdade os
// parâmetros de rota e navegação (erro de digitação em nome de tela ou
// parâmetro esquecido vira erro de compilação, não bug em produção).
type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const LIMITE_URGENTE_HORAS = 48;

const MESES_COMPLETOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default function DashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = criarStyles(theme);

  const [eventos, setEventos] = useState<EventoApp[]>([]);
  const [tagsDisponiveis, setTagsDisponiveis] = useState<string[]>([]);
  const [tagAtiva, setTagAtiva] = useState<string | null>(null); // null = "Todas"
  const [carregando, setCarregando] = useState(true);
  const [coresPorTag, setCoresPorTag] = useState<Record<string, number>>({});

  // Cada linha da lista tem seu próprio Swipeable; guardamos as refs pra
  // poder fechar as outras quando uma nova é aberta (senão várias linhas
  // podem ficar "abertas" ao mesmo tempo, o que fica estranho).
  const swipeableRefs = useRef<Record<number, any>>({});

  function fecharOutrosSwipes(idAtual: number) {
    Object.entries(swipeableRefs.current).forEach(([id, ref]) => {
      if (Number(id) !== idAtual && ref) ref.close();
    });
  }

  // useFocusEffect (não useEffect) porque ela pode voltar pra essa tela
  // depois de salvar um evento novo — precisa recarregar toda vez que a tela ganha foco.
  useFocusEffect(
    useCallback(() => {
      carregarEventos();
    }, [])
  );

  async function carregarEventos() {
    setCarregando(true);
    const registros = listarRegistros();
    const resultado: EventoApp[] = [];

    for (const registro of registros) {
      const dadosNativos = await buscarEventoDaAgenda(registro.nativeEventId);

      if (!dadosNativos) {
        // Evento sumiu da agenda nativa (ela apagou direto no Google Calendar):
        // limpamos o registro órfão pra não aparecer de novo na próxima carga.
        apagarRegistro(registro.id);
        continue;
      }

      resultado.push({
        id: registro.id,
        nativeEventId: registro.nativeEventId,
        tag: registro.tag,
        titulo: dadosNativos.titulo,
        data: dadosNativos.data,
        descricao: dadosNativos.descricao,
      });
    }

    resultado.sort((a, b) => a.data.getTime() - b.data.getTime());
    setEventos(resultado);
    setTagsDisponiveis(listarTagsUnicas());
    setCoresPorTag(listarCoresDeTags());
    setCarregando(false);
  }

  function handleEditar(evento: EventoApp) {
    navigation.navigate('Confirmar', {
      nativeEventId: evento.nativeEventId,
      rascunho: {
        titulo: evento.titulo,
        data: evento.data,
        descricao: evento.descricao,
        tag: evento.tag,
      },
    });
  }

  function handleApagar(evento: EventoApp) {
    swipeableRefs.current[evento.id]?.close();
    Alert.alert('Apagar evento', `Remover "${evento.titulo}" da agenda?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          // Sincronizado: apaga dos dois lados, senão o alarme nativo
          // continua ativo pra um evento que sumiu do app.
          await apagarEventoDaAgenda(evento.nativeEventId);
          apagarRegistro(evento.id);
          carregarEventos();
        },
      },
    ]);
  }

  const eventosFiltrados = tagAtiva
    ? eventos.filter((e) => e.tag.toLowerCase() === tagAtiva.toLowerCase())
    : eventos;

  const agora = new Date();

  // Contagem de urgentes pra badge do cabeçalho — pequeno toque de
  // "dashboard de verdade" em vez de só uma lista.
  const totalUrgentes = eventos.filter((e) => {
    const horas = (e.data.getTime() - Date.now()) / (1000 * 60 * 60);
    return horas >= 0 && horas <= LIMITE_URGENTE_HORAS;
  }).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.overline}>{formatarCabecalho(agora).toUpperCase()}</Text>
          <Text style={styles.titulo}>Agenda</Text>
        </View>
        {/* Único acesso à tela de Tags agora — ela só serve pra gerenciar
            a cor de cada tag, já que o filtro passou a viver aqui embaixo. */}
        <Pressable
          style={({ pressed }) => [styles.botaoTags, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => navigation.navigate('Tags')}
          hitSlop={10}
        >
          <Feather name="tag" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      {!carregando && eventos.length > 0 && (
        <View style={styles.resumoRow}>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoNumero}>{eventos.length}</Text>
            <Text style={styles.resumoLabel}>
              {eventos.length === 1 ? 'EVENTO' : 'EVENTOS'}
            </Text>
          </View>
          <View style={styles.resumoDivisor} />
          <View style={styles.resumoItem}>
            <Text style={[styles.resumoNumero, totalUrgentes > 0 && { color: theme.colors.urgent }]}>
              {totalUrgentes}
            </Text>
            <Text style={styles.resumoLabel}>PRÓXIMOS 48H</Text>
          </View>
        </View>
      )}

      {tagsDisponiveis.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {['Todas', ...tagsDisponiveis].map((tag) => {
            const ativa = tag === 'Todas' ? tagAtiva === null : tagAtiva?.toLowerCase() === tag.toLowerCase();
            return (
              <Pressable
                key={tag}
                style={({ pressed }) => [styles.tab, ativa && styles.tabAtiva, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => setTagAtiva(tag === 'Todas' ? null : tag)}
              >
                <Text style={[styles.tabTexto, ativa && styles.tabTextoAtiva]}>{tag}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {carregando && eventos.length === 0 ? (
        <View>
          <SkeletonBlock style={styles.skeletonCard} />
          <SkeletonBlock style={styles.skeletonCard} />
          <SkeletonBlock style={styles.skeletonCard} />
        </View>
      ) : (
        <FlatList
          data={eventosFiltrados}
          keyExtractor={(item) => String(item.id)}
          refreshing={carregando}
          onRefresh={carregarEventos}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl + theme.spacing.lg }}
          ListEmptyComponent={
            !carregando ? (
              <View style={styles.vazioContainer}>
                <View style={styles.vazioIconeCirculo}>
                  <Feather name="calendar" size={22} color={theme.colors.textMuted} />
                </View>
                <Text style={styles.vazio}>
                  {tagAtiva
                    ? `Nenhum evento com a tag "${tagAtiva}".`
                    : 'Nenhum evento salvo ainda.\nToque em "+" pra criar o primeiro.'}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const horasRestantes = (item.data.getTime() - Date.now()) / (1000 * 60 * 60);
            const urgente = horasRestantes >= 0 && horasRestantes <= LIMITE_URGENTE_HORAS;
            const corIndex = coresPorTag[item.tag.trim().toLowerCase()] ?? 0;
            const cor = corDaTag(corIndex, theme.mode);

            const corAcento = urgente ? theme.colors.urgent : cor.base;

            return (
              <Swipeable
                ref={(ref) => {
                  swipeableRefs.current[item.id] = ref;
                }}
                overshootRight={false}
                rightThreshold={40}
                friction={2}
                onSwipeableWillOpen={() => fecharOutrosSwipes(item.id)}
                renderRightActions={() => (
                  <Pressable style={styles.acaoApagar} onPress={() => handleApagar(item)}>
                    <Feather name="trash-2" size={19} color={theme.colors.urgent} />
                  </Pressable>
                )}
              >
                <Pressable
                  style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => handleEditar(item)}
                >
                  <View style={[styles.faixa, { backgroundColor: corAcento }]} />
                  <View style={styles.cardConteudo}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.cardTituloRow}>
                        {urgente && <Feather name="bell" size={12} color={theme.colors.urgent} />}
                        <Text style={styles.cardTitulo} numberOfLines={1}>{item.titulo}</Text>
                      </View>
                      <View style={styles.cardMetaRow}>
                        <Text style={[styles.cardData, urgente && styles.cardDataUrgente]}>
                          {formatarDataLegivel(item.data)}
                        </Text>
                        <View style={styles.cardTagPill}>
                          <View style={[styles.cardTagBolinha, { backgroundColor: cor.base }]} />
                          <Text style={styles.cardTagTexto} numberOfLines={1}>{item.tag}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.cardDias, urgente && styles.cardDiasUrgente]}>
                      {formatarDiasRestantes(horasRestantes)}
                    </Text>
                  </View>
                </Pressable>
              </Swipeable>
            );
          }}
        />
      )}

      <Pressable
        style={({ pressed }) => [
          styles.botaoNovoWrapper,
          { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
        onPress={() => navigation.navigate('Input')}
      >
        <LinearGradient
          colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.botaoNovo}
        >
          <Feather name="plus" size={24} color={theme.colors.accentText} />
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

function formatarSaudacao(hora: number): string {
  if (hora < 5) return 'Boa noite';
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Linha pequena do cabeçalho: saudação de verdade (calculada na hora, não
// fixa) + data por extenso. Ex.: "Boa tarde · 14 de julho".
function formatarCabecalho(data: Date): string {
  return `${formatarSaudacao(data.getHours())} · ${data.getDate()} de ${MESES_COMPLETOS[data.getMonth()]}`;
}

// MUDANÇA: formato trocado de "dd/mm, HH:mm" pra "dd mês, HH:mm" (ex:
// "20 jul, 14:00"), mais legível/editorial — mantém a hora numérica pra
// não perder a leitura rápida de horário.
function formatarDataLegivel(data: Date): string {
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${data.getDate()} ${MESES_ABREV[data.getMonth()]}, ${hh}:${min}`;
}

function formatarDiasRestantes(horas: number): string {
  if (horas < 0) return 'passou';
  if (horas < 24) return 'hoje';
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    overline: { ...theme.typography.overline, color: theme.colors.textMuted },
    titulo: { ...theme.typography.display, color: theme.colors.textPrimary, marginTop: 4 },
    botaoTags: {
      padding: theme.spacing.sm,
      marginTop: 2,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resumoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: theme.spacing.sm + 2,
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    resumoItem: { flex: 1, alignItems: 'center' },
    resumoDivisor: { width: 1, height: 28, backgroundColor: theme.colors.border },
    resumoNumero: { ...theme.typography.heading, fontSize: 22, color: theme.colors.textPrimary },
    resumoLabel: { ...theme.typography.overline, color: theme.colors.textMuted, marginTop: 3 },
    tabsScroll: { flexGrow: 0, marginBottom: theme.spacing.md },
    tabsContent: { gap: theme.spacing.xs, paddingRight: theme.spacing.lg },
    tab: {
      paddingVertical: theme.spacing.xs + 3,
      paddingHorizontal: theme.spacing.sm + 6,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    tabAtiva: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    tabTexto: { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
    tabTextoAtiva: { color: theme.colors.accentText },
    vazioContainer: { alignItems: 'center', marginTop: theme.spacing.xl + theme.spacing.md, gap: theme.spacing.md },
    vazioIconeCirculo: {
      width: 52,
      height: 52,
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
    },
    skeletonCard: { height: 68, marginBottom: theme.spacing.sm, borderRadius: theme.radius.lg },
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
    // Traço lateral fino — a cor da tag vira um detalhe editorial, não
    // mais uma faixa grossa nem um fundo colorido no card inteiro.
    faixa: { width: 3 },
    cardConteudo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    cardTituloRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitulo: { ...theme.typography.subheading, color: theme.colors.textPrimary, flexShrink: 1 },
    cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 5 },
    cardData: { ...theme.typography.caption, color: theme.colors.textSecondary },
    cardDataUrgente: { color: theme.colors.urgent, fontFamily: theme.typography.bodyMedium.fontFamily },
    cardTagPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: 110,
    },
    cardTagBolinha: { width: 6, height: 6, borderRadius: 3 },
    cardTagTexto: { ...theme.typography.caption, color: theme.colors.textMuted },
    cardDias: { ...theme.typography.caption, color: theme.colors.textSecondary },
    cardDiasUrgente: { color: theme.colors.urgent, fontFamily: theme.typography.bodyMedium.fontFamily },
    acaoApagar: {
      width: 64,
      borderRadius: theme.radius.lg,
      marginBottom: theme.spacing.sm + 2,
      marginLeft: theme.spacing.sm,
      backgroundColor: theme.colors.urgentBg,
      borderWidth: 1,
      borderColor: theme.colors.urgent + '40',
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoNovoWrapper: {
      position: 'absolute',
      right: theme.spacing.lg,
      bottom: theme.spacing.lg + theme.spacing.xs,
    },
    botaoNovo: {
      width: 56,
      height: 56,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.glow.color,
      shadowOffset: { width: 0, height: theme.glow.offsetY },
      shadowOpacity: theme.glow.opacity,
      shadowRadius: theme.glow.radius,
      elevation: 6,
    },
  });
}
