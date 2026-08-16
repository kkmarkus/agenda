import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, ScrollView, TextInput, Platform, StatusBar as StatusBarRN } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import type { EventoApp } from '../../types/event';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme/ThemeContext';
import { SEM_TAG_LABEL } from '../../services/database';
import SkeletonBlock from '../../components/SkeletonBlock';
import ConfirmDialog from '../../components/ConfirmDialog';
import SettingsDrawer from '../../components/SettingsDrawer';
import EventoCard from './EventoCard';
import { criarStyles } from './styles';
import { formatarCabecalho } from './format';
import { useCarregarEventos } from './hooks/useCarregarEventos';
import { useAcoesDeEvento } from './hooks/useAcoesDeEvento';
import { useFiltroEventos } from './hooks/useFiltroEventos';
import { useSwipeableRefs } from './hooks/useSwipeableRefs';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

// Tela principal: lista de eventos com cabeçalho/pills que recolhem ao
// rolar (efeito "collapsing header"), busca, filtro por tag e ações
// (editar, fixar, apagar, limpar passados).
const LIMITE_URGENTE_HORAS = 48;

export default function DashboardScreen({ navigation }: Props) {
  const theme = useTheme();

  const styles = useMemo(() => criarStyles(theme), [theme]);

  const insets = useSafeAreaInsets();
  // insets.top do react-navigation às vezes vem 0 no Android logo na
  // primeira renderização; cai pra StatusBar.currentHeight como reserva.
  const gapStatusBar =
    Platform.OS === 'android' ? insets.top || StatusBarRN.currentHeight || 0 : insets.top;

  // Alturas medidas via onLayout (não fixas), porque variam com o
  // tamanho da fonte do sistema e o texto da saudação; usadas pra
  // calcular o quanto o cabeçalho/pills recolhem ao rolar e o padding
  // da lista pra não ficar escondida atrás deles.
  const [tituloHeight, setTituloHeight] = useState(96);
  const onLayoutTitulo = useCallback((e: LayoutChangeEvent) => {
    const altura = e.nativeEvent.layout.height;
    setTituloHeight((atual) => (Math.abs(atual - altura) > 0.5 ? altura : atual));
  }, []);

  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = useState(140);
  const [pillsHeight, setPillsHeight] = useState(56);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY]
  );

  const onLayoutHeader = useCallback((e: LayoutChangeEvent) => {
    const altura = e.nativeEvent.layout.height;
    setHeaderHeight((atual) => (Math.abs(atual - altura) > 0.5 ? altura : atual));
  }, []);

  const onLayoutPills = useCallback((e: LayoutChangeEvent) => {
    const altura = e.nativeEvent.layout.height;
    setPillsHeight((atual) => (Math.abs(atual - altura) > 0.5 ? altura : atual));
  }, []);

  // Resumo/busca sobe e desaparece ao rolar; as pills de tag sobem atrás
  // dele, ocupando o espaço que o resumo deixou (por isso o range
  // inverso: começa em headerHeight e vai a 0).
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight],
    extrapolate: 'clamp',
  });

  const pillsTranslateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [headerHeight, 0],
    extrapolate: 'clamp',
  });

  const [menuAberto, setMenuAberto] = useState(false);

  const fecharMenu = useCallback(() => setMenuAberto(false), []);

  const { eventos, setEventos, tagsDisponiveis, coresPorTag, carregando, carregarEventos } = useCarregarEventos();
  const { registrarSwipeableRef, onSwipeableWillOpen, fecharSwipeDoItem } = useSwipeableRefs();
  const {
    agora,
    navegarParaEdicao,
    handleEditar,
    eventoParaEscolherEscopoEdicao,
    setEventoParaEscolherEscopoEdicao,
    eventoParaApagar,
    setEventoParaApagar,
    handleApagar,
    confirmarApagar,
    handleAlternarFixado,
    confirmandoLimpezaPassados,
    setConfirmandoLimpezaPassados,
    confirmarLimpezaPassados,
    eventosPassados,
    eventosPassadosNaoFixados,
    eventosPassadosFixados,
  } = useAcoesDeEvento({ eventos, setEventos, carregarEventos, navigation, fecharSwipeDoItem });
  const { tagAtiva, setTagAtiva, busca, setBusca, buscaNormalizada, temEventosSemTag, eventosFiltrados } =
    useFiltroEventos(eventos);

  // Contagem pro card de resumo "PRÓXIMOS 48H" no cabeçalho.
  const totalUrgentes = useMemo(() => {
    const agoraMs = Date.now();
    return eventos.filter((e) => {
      const horas = (e.data.getTime() - agoraMs) / (1000 * 60 * 60);
      return horas >= 0 && horas <= LIMITE_URGENTE_HORAS;
    }).length;
  }, [eventos]);

  const renderItem = useCallback(
    ({ item }: { item: EventoApp }) => {
      const horasRestantes = (item.data.getTime() - Date.now()) / (1000 * 60 * 60);
      const urgente = horasRestantes >= 0 && horasRestantes <= LIMITE_URGENTE_HORAS;
      return (
        <EventoCard
          item={item}
          urgente={urgente}
          horasRestantes={horasRestantes}
          theme={theme}
          styles={styles}
          coresPorTag={coresPorTag}
          registrarSwipeableRef={registrarSwipeableRef}
          onSwipeableWillOpen={onSwipeableWillOpen}
          onEditar={handleEditar}
          onAlternarFixado={handleAlternarFixado}
          onApagar={handleApagar}
        />
      );
    },
    [theme, styles, coresPorTag, registrarSwipeableRef, onSwipeableWillOpen, handleEditar, handleAlternarFixado, handleApagar]
  );

  // Resumo/busca só aparecem se já existe algo pra resumir/buscar (evita
  // mostrar "0 eventos" e uma busca vazia numa agenda vazia).
  const existeConteudoDeFiltro = !carregando && eventos.length > 0;

  const paddingSuperiorCorpo = tituloHeight + headerHeight + pillsHeight;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {carregando && eventos.length === 0 ? (
        <View style={{ paddingTop: paddingSuperiorCorpo, paddingHorizontal: theme.spacing.lg }}>
          <SkeletonBlock style={styles.skeletonCard} />
          <SkeletonBlock style={styles.skeletonCard} />
          <SkeletonBlock style={styles.skeletonCard} />
        </View>
      ) : (
        <Animated.FlatList
          data={eventosFiltrados}
          keyExtractor={(item) => String(item.id)}
          refreshing={carregando}
          onRefresh={carregarEventos}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}

          contentContainerStyle={{
            paddingTop: paddingSuperiorCorpo,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xl + theme.spacing.lg,
          }}
          ListEmptyComponent={
            !carregando ? (
              <View style={styles.vazioContainer}>
                <View style={styles.vazioIconeCirculo}>
                  <Feather name="calendar" size={22} color={theme.colors.textMuted} />
                </View>
                <Text style={styles.vazio}>
                  {buscaNormalizada
                    ? `Nenhum evento com "${busca.trim()}" no título.`
                    : tagAtiva === ''
                    ? 'Nenhum evento sem tag.'
                    : tagAtiva
                    ? `Nenhum evento com a tag "${tagAtiva}".`
                    : 'Nenhum evento salvo ainda.\nToque em "+" pra criar o primeiro.'}
                </Text>
              </View>
            ) : null
          }
          renderItem={renderItem}
        />
      )}

      {/* Saudação + "Agenda": fixo no topo, nunca recolhe ao rolar. */}
      <View
        onLayout={onLayoutTitulo}
        style={[styles.tituloFixo, { paddingTop: gapStatusBar + theme.spacing.lg }]}
      >
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.overline}>{formatarCabecalho(agora).toUpperCase()}</Text>
            <Text style={styles.titulo}>Agenda</Text>
          </View>
        </View>
      </View>

      {/* Resumo (contagem/urgentes) + busca: recolhe ao rolar. */}
      <Animated.View
        onLayout={onLayoutHeader}
        style={[styles.headerOverlay, { top: tituloHeight, transform: [{ translateY: headerTranslateY }] }]}
      >
        {existeConteudoDeFiltro && (
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

        {existeConteudoDeFiltro && (
          <View style={styles.buscaRow}>
            <Feather name="search" size={15} color={theme.colors.textMuted} />
            <TextInput
              style={styles.buscaInput}
              placeholder="Buscar por título"
              placeholderTextColor={theme.colors.textMuted}
              value={busca}
              onChangeText={setBusca}
              returnKeyType="search"
            />
            {busca.length > 0 && (
              <Pressable onPress={() => setBusca('')} hitSlop={8}>
                <Feather name="x" size={15} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>
        )}
      </Animated.View>

      {/* Pills de filtro por tag + link de limpar passados: sobe atrás do resumo ao rolar. */}
      <Animated.View
        onLayout={onLayoutPills}
        style={[styles.pillsOverlay, { top: tituloHeight, transform: [{ translateY: pillsTranslateY }] }]}
      >
        {(tagsDisponiveis.length > 0 || temEventosSemTag) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContent}
          >
            {['Todas', ...tagsDisponiveis, ...(temEventosSemTag ? [SEM_TAG_LABEL] : [])].map((tag) => {
              const ativa =
                tag === 'Todas'
                  ? tagAtiva === null
                  : tag === SEM_TAG_LABEL
                  ? tagAtiva === ''
                  : tagAtiva?.toLowerCase() === tag.toLowerCase();
              return (
                <Pressable
                  key={tag}
                  style={({ pressed }) => [styles.tab, ativa && styles.tabAtiva, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => setTagAtiva(tag === 'Todas' ? null : tag === SEM_TAG_LABEL ? '' : tag)}
                >
                  <Text style={[styles.tabTexto, ativa && styles.tabTextoAtiva]}>{tag}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {eventosPassados.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.linkLimparPassados, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => setConfirmandoLimpezaPassados(true)}
          >
            <Feather name="trash-2" size={13} color={theme.colors.textMuted} />
            <Text style={styles.linkLimparPassadosTexto}>
              Limpar eventos passados ({eventosPassadosNaoFixados.length})
            </Text>
          </Pressable>
        )}
      </Animated.View>

      <Pressable
        style={({ pressed }) => [
          styles.botaoConfiguracoesFixo,
          { top: gapStatusBar + theme.spacing.lg, opacity: pressed ? 0.6 : 1 },
        ]}
        onPress={() => setMenuAberto(true)}
        hitSlop={10}
      >
        <Feather name="settings" size={18} color={theme.colors.textSecondary} />
      </Pressable>

      <SettingsDrawer visivel={menuAberto} onFechar={fecharMenu} />

      <Pressable
        style={({ pressed }) => [
          styles.botaoNovoWrapper,
          { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
        onPress={() => navigation.navigate('Input')}
      >
        <View style={[styles.botaoNovo, { backgroundColor: theme.colors.accent }]}>
          <Feather name="plus" size={24} color={theme.colors.accentText} />
        </View>
      </Pressable>

      <ConfirmDialog
        visivel={eventoParaApagar !== null}
        titulo="Apagar evento"
        mensagem={
          eventoParaApagar
            ? eventoParaApagar.recorrente
              ? `"${eventoParaApagar.titulo}" se repete. O que você quer apagar?`
              : `Remover "${eventoParaApagar.titulo}" da agenda?`
            : ''
        }
        icone="trash-2"
        textoCancelar="Cancelar"
        textoConfirmar={eventoParaApagar?.recorrente ? 'Este e os futuros' : 'Apagar'}
        textoAcaoExtra={eventoParaApagar?.recorrente ? 'Somente este evento' : undefined}
        onAcaoExtra={eventoParaApagar?.recorrente ? () => confirmarApagar(false) : undefined}
        destrutivo
        onConfirmar={() => confirmarApagar(eventoParaApagar?.recorrente ? true : undefined)}
        onFechar={() => setEventoParaApagar(null)}
      />

      <ConfirmDialog
        visivel={eventoParaEscolherEscopoEdicao !== null}
        titulo="Editar evento recorrente"
        mensagem={
          eventoParaEscolherEscopoEdicao
            ? `"${eventoParaEscolherEscopoEdicao.titulo}" se repete. O que você quer editar?`
            : ''
        }
        icone="edit-2"
        textoCancelar="Cancelar"
        textoConfirmar="Este e os futuros"
        textoAcaoExtra="Somente este evento"
        onAcaoExtra={() => {
          if (!eventoParaEscolherEscopoEdicao) return;
          const evento = eventoParaEscolherEscopoEdicao;
          setEventoParaEscolherEscopoEdicao(null);
          navegarParaEdicao(evento, { instanceStartDate: evento.data, futureEvents: false });
        }}
        onConfirmar={() => {
          if (!eventoParaEscolherEscopoEdicao) return;
          const evento = eventoParaEscolherEscopoEdicao;
          setEventoParaEscolherEscopoEdicao(null);
          navegarParaEdicao(evento, { instanceStartDate: evento.data, futureEvents: true });
        }}
        onFechar={() => setEventoParaEscolherEscopoEdicao(null)}
      />

      <ConfirmDialog
        visivel={confirmandoLimpezaPassados}
        titulo="Limpar eventos passados"
        mensagem={`Apagar os ${eventosPassadosNaoFixados.length} eventos que já passaram da agenda?`}
        icone="trash-2"
        textoCancelar="Cancelar"
        textoConfirmar="Apagar"
        textoAcaoExtra={eventosPassadosFixados.length > 0 ? `Incluir os ${eventosPassadosFixados.length} fixados` : undefined}
        onAcaoExtra={eventosPassadosFixados.length > 0 ? () => confirmarLimpezaPassados(true) : undefined}
        destrutivo
        onConfirmar={() => confirmarLimpezaPassados(false)}
        onFechar={() => setConfirmandoLimpezaPassados(false)}
      />
    </SafeAreaView>
  );
}
