import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  pedirPermissao,
  criarEventoNaAgenda,
  atualizarEventoNaAgenda,
} from '../services/calendarService';
import { salvarRegistro, listarTagsUnicas, atualizarTagPorNativeId, listarCoresDeTags } from '../services/database';
import { NovoEvento } from '../types/event';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { corDaTag } from '../theme/theme';
import ConfirmDialog from '../components/ConfirmDialog';

// CORREÇÃO: Props simplificado próprio substituído pelo tipo real de navegação.
type Props = NativeStackScreenProps<RootStackParamList, 'Confirmar'>;

export default function ConfirmScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = criarStyles(theme);

  const { rascunho, nativeEventId } = route.params;
  const modoEdicao = !!nativeEventId;

  const [titulo, setTitulo] = useState(rascunho.titulo ?? '');
  const [dataStr, setDataStr] = useState(formatarData(rascunho.data));
  const [horaStr, setHoraStr] = useState(formatarHora(rascunho.data));
  const [descricao, setDescricao] = useState(rascunho.descricao ?? '');
  const [tag, setTag] = useState(rascunho.tag ?? '');
  const [tagsExistentes, setTagsExistentes] = useState<string[]>([]);
  const [coresPorTag, setCoresPorTag] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [campoFocado, setCampoFocado] = useState<string | null>(null);
  // Substitui os Alert.alert nativos de validação/erro pelo ConfirmDialog
  // temático — só um aviso por vez, então basta título + mensagem.
  const [aviso, setAviso] = useState<{ titulo: string; mensagem: string } | null>(null);

  // Autocomplete: carrega as tags já usadas por ela pra sugerir como chips,
  // já com a cor persistida de cada uma (mesma fonte de verdade da TagsScreen).
  useEffect(() => {
    setTagsExistentes(listarTagsUnicas());
    setCoresPorTag(listarCoresDeTags());
  }, []);

  async function handleSalvar() {
    const data = montarData(dataStr, horaStr);

    if (!titulo.trim()) {
      setAviso({ titulo: 'Falta o título', mensagem: 'Digite um título pro evento antes de salvar.' });
      return;
    }
    if (!data) {
      setAviso({ titulo: 'Data inválida', mensagem: 'Confira o formato: dd/mm/aaaa e HH:mm.' });
      return;
    }
    // MUDANÇA: tag deixou de ser obrigatória. Antes essa validação bloqueava
    // o salvamento sem uma tag; agora um evento sem tag é um estado válido
    // (cai no grupo "Sem tag" no Dashboard e na tela de Tags).

    setSalvando(true);
    try {
      const temPermissao = await pedirPermissao();
      if (!temPermissao) {
        setAviso({ titulo: 'Permissão necessária', mensagem: 'O app precisa de acesso à agenda pra salvar o evento.' });
        return;
      }

      const evento: NovoEvento = {
        titulo: titulo.trim(),
        data,
        descricao: descricao.trim() || undefined,
        tag: tag.trim() || null,
      };

      if (modoEdicao && nativeEventId) {
        // MELHORIA: modo edição — atualiza o evento existente na agenda
        // nativa e a tag no banco local, em vez de criar um registro novo
        // (o que antes duplicava o evento e deixava o antigo órfão).
        await atualizarEventoNaAgenda(nativeEventId, evento);
        atualizarTagPorNativeId(nativeEventId, evento.tag);
      } else {
        const novoNativeEventId = await criarEventoNaAgenda(evento);
        salvarRegistro(novoNativeEventId, evento.tag);
      }

      navigation.navigate('Dashboard');
    } catch (erro) {
      setAviso({ titulo: 'Erro ao salvar', mensagem: 'Não foi possível salvar o evento. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.overline}>{modoEdicao ? 'EDITAR' : 'REVISAR ANTES DE SALVAR'}</Text>
        <Text style={styles.titulo}>{modoEdicao ? 'Editar evento' : 'Confirmar evento'}</Text>

        <Text style={styles.label}>TÍTULO</Text>
        <TextInput
          style={[styles.input, campoFocado === 'titulo' && styles.inputFocado]}
          value={titulo}
          onChangeText={setTitulo}
          onFocus={() => setCampoFocado('titulo')}
          onBlur={() => setCampoFocado(null)}
          placeholderTextColor={theme.colors.textMuted}
        />

        <View style={styles.linhaDupla}>
          <View style={styles.inputMetade}>
            <View style={styles.labelComIcone}>
              <Feather name="calendar" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>DATA</Text>
            </View>
            <TextInput
              style={[styles.input, campoFocado === 'data' && styles.inputFocado]}
              placeholder="dd/mm/aaaa"
              placeholderTextColor={theme.colors.textMuted}
              value={dataStr}
              onChangeText={setDataStr}
              onFocus={() => setCampoFocado('data')}
              onBlur={() => setCampoFocado(null)}
            />
          </View>
          <View style={styles.inputMetade}>
            <View style={styles.labelComIcone}>
              <Feather name="clock" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>HORA</Text>
            </View>
            <TextInput
              style={[styles.input, campoFocado === 'hora' && styles.inputFocado]}
              placeholder="HH:mm"
              placeholderTextColor={theme.colors.textMuted}
              value={horaStr}
              onChangeText={setHoraStr}
              onFocus={() => setCampoFocado('hora')}
              onBlur={() => setCampoFocado(null)}
            />
          </View>
        </View>

        <Text style={styles.label}>DESCRIÇÃO (OPCIONAL)</Text>
        <TextInput
          style={[styles.input, styles.textarea, campoFocado === 'descricao' && styles.inputFocado]}
          multiline
          placeholder="Detalhes adicionais do evento"
          placeholderTextColor={theme.colors.textMuted}
          value={descricao}
          onChangeText={setDescricao}
          onFocus={() => setCampoFocado('descricao')}
          onBlur={() => setCampoFocado(null)}
        />

        <View style={styles.labelComIcone}>
          <Feather name="tag" size={13} color={theme.colors.textMuted} />
          <Text style={styles.label}>TAG (OPCIONAL)</Text>
        </View>
        <TextInput
          style={[styles.input, campoFocado === 'tag' && styles.inputFocado]}
          placeholder="Ex: Universidade"
          placeholderTextColor={theme.colors.textMuted}
          value={tag}
          onChangeText={setTag}
          onFocus={() => setCampoFocado('tag')}
          onBlur={() => setCampoFocado(null)}
        />

        {tagsExistentes.length > 0 && (
          <View style={styles.chipsRow}>
            {/* Chip "Sem tag": limpa o campo, pra ela poder desfazer uma
                seleção de tag sem precisar apagar o texto manualmente. */}
            <Pressable
              style={({ pressed }) => [
                styles.chip,
                tag.trim() === '' && styles.chipSelecionado,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => setTag('')}
            >
              <Feather name="slash" size={11} color={theme.colors.textMuted} />
              <Text style={[styles.chipTexto, tag.trim() === '' && styles.chipTextoSelecionado]}>
                Sem tag
              </Text>
            </Pressable>
            {tagsExistentes.map((t) => {
              const selecionada = t.trim().toLowerCase() === tag.trim().toLowerCase();
              const cor = corDaTag(coresPorTag[t.trim().toLowerCase()] ?? 0, theme.mode);
              return (
                <Pressable
                  key={t}
                  style={({ pressed }) => [
                    styles.chip,
                    selecionada && styles.chipSelecionado,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => setTag(t)}
                >
                  <View style={[styles.chipBolinha, { backgroundColor: cor.base }]} />
                  <Text style={[styles.chipTexto, selecionada && styles.chipTextoSelecionado]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.botoesRow}>
          <Pressable
            style={({ pressed }) => [
              styles.botaoSecundario,
              { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="x" size={16} color={theme.colors.textPrimary} />
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.botaoPrincipalWrapper,
              { opacity: pressed || salvando ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={handleSalvar}
            disabled={salvando}
          >
            <View style={[styles.botaoPrincipal, { backgroundColor: theme.colors.accent }]}>
              {salvando ? (
                <ActivityIndicator size="small" color={theme.colors.accentText} style={styles.spinner} />
              ) : (
                <Feather
                  name={modoEdicao ? 'check' : 'calendar'}
                  size={16}
                  color={theme.colors.accentText}
                  style={styles.spinner}
                />
              )}
              <Text style={styles.botaoPrincipalTexto}>
                {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Salvar na agenda'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

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

function formatarData(data?: Date): string {
  if (!data) return '';
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${data.getFullYear()}`;
}

function formatarHora(data?: Date): string {
  if (!data) return '';
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

function montarData(dataStr: string, horaStr: string): Date | null {
  const matchData = dataStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!matchData) return null;
  const [, dia, mes, ano] = matchData;

  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  const matchHora = horaStr.match(/(\d{1,2}):(\d{2})/);
  if (matchHora) {
    const [, hora, minuto] = matchHora;
    data.setHours(Number(hora), Number(minuto), 0, 0);
  } else {
    data.setHours(8, 0, 0, 0);
  }

  return data;
}

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1, padding: theme.spacing.lg },
    overline: { ...theme.typography.overline, color: theme.colors.accent },
    titulo: { ...theme.typography.heading, color: theme.colors.textPrimary, marginTop: 6, marginBottom: theme.spacing.lg },
    label: { ...theme.typography.overline, color: theme.colors.textMuted, marginBottom: theme.spacing.xs + 2 },
    labelComIcone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing.xs + 2 },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm + 4,
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surfaceElevated,
    },
    inputFocado: {
      borderColor: theme.colors.accent,
      borderWidth: 1.5,
    },
    textarea: { minHeight: 64, textAlignVertical: 'top' },
    linhaDupla: { flexDirection: 'row', gap: theme.spacing.sm },
    inputMetade: { flex: 1 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs + 2, marginBottom: theme.spacing.lg },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: theme.spacing.xs + 1,
      paddingHorizontal: theme.spacing.sm + 2,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipSelecionado: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentSoft,
    },
    chipBolinha: { width: 7, height: 7, borderRadius: 4 },
    chipTexto: { ...theme.typography.caption, color: theme.colors.textSecondary },
    chipTextoSelecionado: { color: theme.colors.textPrimary, fontFamily: theme.typography.bodyMedium.fontFamily },
    botoesRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg },
    botaoSecundario: {
      flex: 1,
      // Altura fixa (não só padding): "Salvar na agenda"/"Salvar
      // alterações" quebra em 2 linhas, enquanto "Salvando..." cabe em 1
      // — sem minHeight, o botão mudava de altura ao trocar de estado.
      // Aplicamos o mesmo valor nos dois botões pra ficarem sempre iguais.
      minHeight: 56,
      flexDirection: 'row',
      gap: theme.spacing.xs + 2,
      padding: theme.spacing.md - 2,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoSecundarioTexto: { ...theme.typography.bodyMedium, color: theme.colors.textPrimary },
    botaoPrincipalWrapper: { flex: 1 },
    botaoPrincipal: {
      minHeight: 56,
      flexDirection: 'row',
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
    spinner: { marginRight: theme.spacing.xs },
  });
}
