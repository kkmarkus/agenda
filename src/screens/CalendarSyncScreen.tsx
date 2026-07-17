import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import {
  pedirPermissao,
  listarCalendariosDisponiveisParaSync,
  CalendarioDisponivel,
} from '../services/calendarService';
import { obterPreferenciasSincronizacao, definirSincronizacaoDoCalendario } from '../services/database';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import SkeletonBlock from '../components/SkeletonBlock';

type Props = NativeStackScreenProps<RootStackParamList, 'Sincronizar'>;

// Tela de configuração: escolher quais calendários nativos (fora o "Meus
// Eventos (App)") ela quer importar automaticamente pro dashboard. A
// sincronização em si roda sozinha, sempre que o Dashboard ganha foco —
// aqui é só o interruptor de "quais calendários entram nessa".
export default function CalendarSyncScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = criarStyles(theme);

  const [calendarios, setCalendarios] = useState<CalendarioDisponivel[]>([]);
  const [ativos, setAtivos] = useState<Record<string, boolean>>({});
  const [carregando, setCarregando] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [])
  );

  async function carregar() {
    setCarregando(true);
    const temPermissao = await pedirPermissao();
    if (!temPermissao) {
      setSemPermissao(true);
      setCarregando(false);
      return;
    }
    setSemPermissao(false);

    const [lista, preferencias] = await Promise.all([
      listarCalendariosDisponiveisParaSync(),
      Promise.resolve(obterPreferenciasSincronizacao()),
    ]);
    setCalendarios(lista);
    setAtivos(preferencias);
    setCarregando(false);
  }

  function alternar(calendarId: string) {
    const novoValor = !ativos[calendarId];
    definirSincronizacaoDoCalendario(calendarId, novoValor);
    setAtivos((atual) => ({ ...atual, [calendarId]: novoValor }));
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
        <Text style={styles.overline}>CONFIGURAÇÃO</Text>
        <Text style={styles.titulo}>Sincronizar calendários</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {cabecalho}
      <Text style={styles.subtitulo}>
        Eventos futuros dos calendários ativados aqui aparecem sozinhos no seu
        dashboard, sem tag, verificados toda vez que você abre o app.
      </Text>

      {carregando ? (
        <View>
          <SkeletonBlock style={styles.skeletonCard} />
          <SkeletonBlock style={styles.skeletonCard} />
        </View>
      ) : semPermissao ? (
        <View style={styles.vazioContainer}>
          <View style={styles.vazioIconeCirculo}>
            <Feather name="lock" size={22} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.vazio}>
            O app precisa de acesso à agenda pra listar seus calendários.{'\n'}
            Toque em "+" na tela inicial uma vez pra conceder a permissão, depois volte aqui.
          </Text>
        </View>
      ) : calendarios.length === 0 ? (
        <View style={styles.vazioContainer}>
          <View style={styles.vazioIconeCirculo}>
            <Feather name="calendar" size={22} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.vazio}>
            Nenhum outro calendário editável encontrado no aparelho.
          </Text>
        </View>
      ) : (
        <FlatList
          data={calendarios}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const ativo = !!ativos[item.id];
            return (
              <Pressable
                style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => alternar(item.id)}
              >
                <View style={[styles.faixa, { backgroundColor: item.cor }]} />
                <View style={styles.cardConteudo}>
                  <View style={styles.cardEsquerda}>
                    <View style={[styles.iconeBolinha, { backgroundColor: item.cor }]} />
                    <Text style={styles.cardTitulo} numberOfLines={1}>{item.titulo}</Text>
                  </View>
                  <Feather
                    name={ativo ? 'check-circle' : 'circle'}
                    size={22}
                    color={ativo ? theme.colors.accent : theme.colors.border}
                  />
                </View>
              </Pressable>
            );
          }}
        />
      )}
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
    titulo: { ...theme.typography.heading, fontSize: 20, color: theme.colors.textPrimary, marginTop: 2 },
    subtitulo: {
      ...theme.typography.body,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.md,
      lineHeight: 20,
    },
    skeletonCard: { height: 60, marginBottom: theme.spacing.sm, borderRadius: theme.radius.lg },
    vazioContainer: { alignItems: 'center', marginTop: theme.spacing.xl, gap: theme.spacing.md },
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
    },
    faixa: { width: 3 },
    cardConteudo: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.md,
    },
    cardEsquerda: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 1 },
    iconeBolinha: { width: 10, height: 10, borderRadius: 5 },
    cardTitulo: { ...theme.typography.bodyMedium, color: theme.colors.textPrimary, flexShrink: 1 },
  });
}
