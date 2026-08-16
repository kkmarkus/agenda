// Painel de configurações: escolhe quais calendários do dispositivo têm
// seus eventos importados automaticamente pro Dashboard (ver
// useCarregarEventos.sincronizarCalendariosExternos).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  pedirPermissao,
  listarCalendariosDisponiveisParaSync,
  buscarNativeEventIdsDoCalendario,
  CalendarioDisponivel,
} from '../services/calendarService';
import {
  obterPreferenciasSincronizacao,
  definirSincronizacaoDoCalendario,
  listarRegistros,
  apagarRegistro,
  RegistroEvento,
} from '../services/database';
import { useTheme } from '../theme/ThemeContext';
import SkeletonBlock from './SkeletonBlock';
import ConfirmDialog from './ConfirmDialog';

export default function CalendarSyncPanelContent() {
  const theme = useTheme();
  const styles = useMemo(() => criarStyles(theme), [theme]);

  const [calendarios, setCalendarios] = useState<CalendarioDisponivel[]>([]);
  const [ativos, setAtivos] = useState<Record<string, boolean>>({});
  const [carregando, setCarregando] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);

  const [calendarioParaLimpar, setCalendarioParaLimpar] = useState<{
    titulo: string;
    registros: RegistroEvento[];
  } | null>(null);

  useEffect(() => {
    carregar();
  }, []);

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

  // Ao DESativar um calendário, oferece apagar do app os eventos que já
  // tinham sido importados dele (só os sem tag — se o usuário deu uma
  // tag, entende-se que já "adotou" aquele evento e não some sozinho).
  async function alternar(calendarId: string, titulo: string) {
    const eraAtivo = !!ativos[calendarId];
    const novoValor = !eraAtivo;
    definirSincronizacaoDoCalendario(calendarId, novoValor);
    setAtivos((atual) => ({ ...atual, [calendarId]: novoValor }));

    if (!eraAtivo || novoValor) return;

    try {
      const idsDoCalendario = await buscarNativeEventIdsDoCalendario(calendarId);
      const registrosImportados = listarRegistros().filter(
        (r) => r.tags.length === 0 && idsDoCalendario.has(r.nativeEventId)
      );
      if (registrosImportados.length > 0) {
        setCalendarioParaLimpar({ titulo, registros: registrosImportados });
      }
    } catch (erro) {
      // Se a busca falhar, não oferece a limpeza em lote dessa vez — os
      // registros continuam no app normalmente, sem risco de dado perdido.
      console.error('Erro ao buscar eventos importados do calendário:', erro);
    }
  }

  function confirmarLimpezaImportados() {
    calendarioParaLimpar?.registros.forEach((r) => apagarRegistro(r.id));
    setCalendarioParaLimpar(null);
  }

  const cabecalho = (
    <View style={styles.headerTopRow}>
      <View>
        <Text style={styles.overline}>CONFIGURAÇÃO</Text>
        <Text style={styles.titulo}>Sincronizar calendários</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
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
          <Text style={styles.vazio}>Nenhum outro calendário editável encontrado no aparelho.</Text>
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
                onPress={() => alternar(item.id, item.titulo)}
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

      <ConfirmDialog
        visivel={calendarioParaLimpar !== null}
        titulo="Remover eventos importados"
        mensagem={
          calendarioParaLimpar
            ? `Você desativou "${calendarioParaLimpar.titulo}". Remover do app os ${calendarioParaLimpar.registros.length} ${
                calendarioParaLimpar.registros.length === 1 ? 'evento já importado' : 'eventos já importados'
              } dele? Isso não apaga nada do calendário original — só some do seu Dashboard.`
            : ''
        }
        icone="trash-2"
        destrutivo
        textoCancelar="Manter no Dashboard"
        textoConfirmar="Remover"
        onConfirmar={confirmarLimpezaImportados}
        onFechar={() => setCalendarioParaLimpar(null)}
      />
    </View>
  );
}

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
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
      backgroundColor: theme.colors.surface,
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
