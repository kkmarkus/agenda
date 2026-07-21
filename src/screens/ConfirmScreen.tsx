import React, { useEffect, useMemo, useState } from 'react';
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
import {
  salvarRegistro,
  listarTagsUnicas,
  atualizarTagsPorNativeId,
  listarCoresDeTags,
  obterPreferencia,
  PREF_DURACAO_PADRAO_MINUTOS,
  PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS,
} from '../services/database';
import { NovoEvento } from '../types/event';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { corDaTag } from '../theme/theme';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  formatarData,
  formatarHora,
  combinarDataEHora,
  combinarComHora,
  abrirDatePicker,
  abrirTimePicker,
} from '../utils/dataHora';

// CORREÇÃO: Props simplificado próprio substituído pelo tipo real de navegação.
type Props = NativeStackScreenProps<RootStackParamList, 'Confirmar'>;

export default function ConfirmScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => criarStyles(theme), [theme]);

  const { rascunho, nativeEventId, dataFim, ocorrencia } = route.params;
  const modoEdicao = !!nativeEventId;
  // Intervalo só faz sentido na criação — depois de salvo, os dois eventos
  // (início/prazo final) passam a ser independentes, cada um editável na
  // sua própria ida à ConfirmScreen (modoEdicao normal, sem esse conceito).
  const ehIntervalo = !!dataFim && !modoEdicao;

  const [titulo, setTitulo] = useState(rascunho.titulo ?? '');
  // MUDANÇA (item 9.1): data/hora deixam de ser TextInput livre validado
  // por regex (`montarData`, que aceitava datas impossíveis como 31/02 e
  // deixava o `Date` do JS "rolar" pro mês seguinte silenciosamente) e
  // passam a vir sempre de um picker nativo — ou seja, o estado aqui é um
  // `Date` de verdade, nunca uma string a validar. Sem data detectada pelo
  // parser, começa em "agora": um picker sempre precisa de um valor pra
  // exibir, diferente de um TextInput que podia começar vazio.
  const [data, setData] = useState<Date>(rascunho.data ?? new Date());
  const [dataFimIntervalo, setDataFimIntervalo] = useState<Date>(dataFim ?? rascunho.data ?? new Date());
  const [descricao, setDescricao] = useState(rascunho.descricao ?? '');
  // MUDANÇA (item 4): campo de tag única virou lista de tags selecionadas
  // + um texto solto pra criar uma tag nova. `tagsSelecionadas` guarda o
  // texto exatamente como foi digitado/escolhido (mesmo padrão de
  // `renomearOuMesclarTag`: grava como veio, só a chave de cor é
  // normalizada) — a ORDEM da lista importa pro traço lateral segmentado
  // do Dashboard (primeira tag = primeiro segmento).
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>(rascunho.tags ?? []);
  const [novaTagTexto, setNovaTagTexto] = useState('');
  // MUDANÇA (item 1): duração e antecedência do alarme deixam de ser fixas.
  // Em modo edição também partimos do padrão (60min/30min), já que a
  // agenda nativa não devolve esses valores de volta pra gente pré-selecionar
  // o que já estava configurado (mesma limitação já documentada em
  // atualizarEventoNaAgenda, agora refletida aqui na tela).
  const [duracaoOpcao, setDuracaoOpcao] = useState<'30' | '60' | '120' | 'diaInteiro' | 'personalizado'>('60');
  const [duracaoPersonalizadaStr, setDuracaoPersonalizadaStr] = useState('');
  // undefined = "um dia só" (mesmo dia de `data`) — diferente de string vazia,
  // não precisa de validação de formato porque só existe via picker.
  const [dataFimDiaInteiro, setDataFimDiaInteiro] = useState<Date | undefined>(undefined);
  const [antecedenciaOpcao, setAntecedenciaOpcao] = useState<'10' | '30' | '60' | '1440' | 'sem'>('30');
  // MUDANÇA (item 2): 'nenhuma' é o padrão — o seletor fica sempre visível
  // e editável, mesmo quando o parser não detectou repetição nenhuma (ela
  // pode marcar recorrência manualmente num evento digitado sem indicar
  // repetição). Quando o parser detecta (rascunho.recorrencia), ou quando
  // ela está editando um evento que já é recorrente (rascunho.recorrencia
  // também vem populado nesse caso — ver DashboardScreen), o valor inicial
  // já vem pré-selecionado.
  const [recorrenciaOpcao, setRecorrenciaOpcao] = useState<'nenhuma' | 'diaria' | 'semanal' | 'mensal'>(
    rascunho.recorrencia?.frequencia ?? 'nenhuma'
  );
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

  // MUDANÇA (8.1): os seletores de duração/antecedência partem dos padrões
  // definidos em Configurações (SettingsDrawer), em vez dos 60min/30min
  // hardcoded. Só sobrescreve o estado se houver um padrão salvo — sem
  // preferência gravada ainda (app recém-instalado), mantém os defaults
  // '60'/'30' já assumidos no useState. Roda uma vez só: como é o valor
  // *inicial* do formulário, mudar a preferência global depois de a tela
  // já estar aberta não deve arrastar a seleção que ela já estava fazendo.
  useEffect(() => {
    const duracaoSalva = obterPreferencia(PREF_DURACAO_PADRAO_MINUTOS);
    if (duracaoSalva === '30' || duracaoSalva === '60' || duracaoSalva === '120') {
      setDuracaoOpcao(duracaoSalva);
    }
    const antecedenciaSalva = obterPreferencia(PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS);
    if (
      antecedenciaSalva === '10' ||
      antecedenciaSalva === '30' ||
      antecedenciaSalva === '60' ||
      antecedenciaSalva === '1440'
    ) {
      setAntecedenciaOpcao(antecedenciaSalva);
    }
  }, []);

  // MUDANÇA (item 1 + 9.1): traduz a opção de chip selecionada pros campos
  // reais de NovoEvento. Só "Personalizado" ainda valida um TextInput (é
  // número de minutos, não uma data — não faz sentido num date picker);
  // "Dia inteiro" não precisa mais validar formato de data nenhum, porque
  // `dataFimDiaInteiro` só existe como `Date` já válido vindo do picker.
  // Ainda validamos a ORDEM das datas (fim antes do início), que é uma
  // regra de negócio, não um problema de formato — o picker não impede
  // ela de escolher um "último dia" anterior ao início por engano.
  function montarDuracaoEDiaInteiro(
    dataInicio: Date
  ):
    | { ok: true; diaInteiro: boolean; duracaoMinutos?: number; dataFimDiaInteiro?: Date }
    | { ok: false; titulo: string; mensagem: string } {
    if (duracaoOpcao === 'diaInteiro') {
      if (!dataFimDiaInteiro) {
        return { ok: true, diaInteiro: true };
      }
      const inicioSoData = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());
      const fimSoData = new Date(
        dataFimDiaInteiro.getFullYear(),
        dataFimDiaInteiro.getMonth(),
        dataFimDiaInteiro.getDate()
      );
      if (fimSoData.getTime() < inicioSoData.getTime()) {
        return {
          ok: false,
          titulo: 'Datas fora de ordem',
          mensagem: 'O fim do dia inteiro precisa ser igual ou depois da data do evento.',
        };
      }
      return { ok: true, diaInteiro: true, dataFimDiaInteiro: fimSoData };
    }

    if (duracaoOpcao === 'personalizado') {
      const minutos = Number(duracaoPersonalizadaStr);
      if (!duracaoPersonalizadaStr.trim() || !Number.isFinite(minutos) || minutos <= 0) {
        return {
          ok: false,
          titulo: 'Duração inválida',
          mensagem: 'Digite a duração personalizada em minutos (um número maior que zero).',
        };
      }
      return { ok: true, diaInteiro: false, duracaoMinutos: Math.round(minutos) };
    }

    return { ok: true, diaInteiro: false, duracaoMinutos: Number(duracaoOpcao) };
  }

  // MUDANÇA (item 2): traduz a opção de chip selecionada pro formato
  // Recorrencia. diaSemana/diaDoMes vêm da data-base do próprio evento —
  // se ela mudou a data no formulário, a recorrência acompanha a nova
  // data (ex: escolheu "semanal" numa quinta, repete toda quinta a partir
  // dali), não o dia detectado originalmente pelo parser.
  function montarRecorrencia(dataInicio: Date): NovoEvento['recorrencia'] {
    if (recorrenciaOpcao === 'nenhuma') return null;
    if (recorrenciaOpcao === 'diaria') return { frequencia: 'diaria' };
    if (recorrenciaOpcao === 'semanal') return { frequencia: 'semanal', diaSemana: dataInicio.getDay() };
    return { frequencia: 'mensal', diaDoMes: dataInicio.getDate() };
  }

  // MUDANÇA (item 4): substitui o antigo `setTag(t)` de seleção única.
  // Comparação case-insensitive (mesmo critério usado em toda a app pra
  // "é a mesma tag") pra não deixar ela adicionar "Trabalho" duas vezes
  // com capitalizações diferentes sem perceber.
  function tagJaSelecionada(t: string): boolean {
    const chave = t.trim().toLowerCase();
    return tagsSelecionadas.some((existente) => existente.trim().toLowerCase() === chave);
  }

  function adicionarTag(t: string) {
    const texto = t.trim();
    if (!texto || tagJaSelecionada(texto)) return;
    setTagsSelecionadas((atual) => [...atual, texto]);
  }

  function removerTag(t: string) {
    setTagsSelecionadas((atual) => atual.filter((existente) => existente !== t));
  }

  // Chip de tag já usada antes (autocomplete): alterna a seleção em vez de
  // substituir — é assim que a lista vira multi-select.
  function alternarTagExistente(t: string) {
    if (tagJaSelecionada(t)) {
      setTagsSelecionadas((atual) => atual.filter((existente) => existente.trim().toLowerCase() !== t.trim().toLowerCase()));
    } else {
      setTagsSelecionadas((atual) => [...atual, t]);
    }
  }

  function handleAdicionarNovaTag() {
    adicionarTag(novaTagTexto);
    setNovaTagTexto('');
  }

  async function handleSalvar() {
    if (!titulo.trim()) {
      setAviso({ titulo: 'Falta o título', mensagem: 'Digite um título pro evento antes de salvar.' });
      return;
    }

    if (ehIntervalo) {
      await handleSalvarIntervalo();
      return;
    }
    // MUDANÇA (item 9.1): não existe mais checagem de "Data inválida" aqui
    // — `data` vem sempre de um picker nativo, então já é um `Date` válido
    // por construção (esse era exatamente o bug que esse item corrigia:
    // texto livre tipo "31/02" era aceito e o `Date` do JS rolava
    // silenciosamente pro mês seguinte).
    // MUDANÇA: tag deixou de ser obrigatória. Antes essa validação bloqueava
    // o salvamento sem uma tag; agora um evento sem tag é um estado válido
    // (cai no grupo "Sem tag" no Dashboard e na tela de Tags).

    // MUDANÇA (item 1): valida a duração/dia inteiro escolhidos antes de
    // gastar uma chamada de permissão — mesmo padrão das validações acima
    // (falhar cedo, sem tocar a agenda nativa).
    const duracaoResultado = montarDuracaoEDiaInteiro(data);
    if (!duracaoResultado.ok) {
      setAviso({ titulo: duracaoResultado.titulo, mensagem: duracaoResultado.mensagem });
      return;
    }

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
        tags: tagsSelecionadas,
        diaInteiro: duracaoResultado.diaInteiro,
        duracaoMinutos: duracaoResultado.diaInteiro ? undefined : duracaoResultado.duracaoMinutos,
        dataFimDiaInteiro: duracaoResultado.diaInteiro ? duracaoResultado.dataFimDiaInteiro : undefined,
        antecedenciaAlarmeMinutos: antecedenciaOpcao === 'sem' ? null : Number(antecedenciaOpcao),
        recorrencia: montarRecorrencia(data),
      };

      if (modoEdicao && nativeEventId) {
        // MELHORIA: modo edição — atualiza o evento existente na agenda
        // nativa e as tags no banco local, em vez de criar um registro novo
        // (o que antes duplicava o evento e deixava o antigo órfão).
        // MUDANÇA (item 2): `ocorrencia` só vem preenchido quando o evento
        // editado já era recorrente e ela escolheu o escopo no Dashboard
        // ("Somente este" ou "Este e os futuros") antes de chegar aqui —
        // sem ele, o expo-calendar trata como edição de um evento comum.
        await atualizarEventoNaAgenda(nativeEventId, evento, ocorrencia);
        atualizarTagsPorNativeId(nativeEventId, evento.tags);
      } else {
        const novoNativeEventId = await criarEventoNaAgenda(evento);
        salvarRegistro(novoNativeEventId, evento.tags);
      }

      navigation.navigate('Dashboard');
    } catch (erro) {
      setAviso({ titulo: 'Erro ao salvar', mensagem: 'Não foi possível salvar o evento. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  }

  /**
   * Salva um intervalo como DOIS eventos nativos independentes — "Início: X"
   * na primeira data e "Prazo final: X" na segunda, mesma tag nas duas,
   * cada um com seu próprio alarme de 30 min (herdado de criarEventoNaAgenda,
   * sem precisar de nada especial aqui). Decisão de produto: o que importa
   * pra ela é ser lembrada nas duas pontas do período, não visualizar uma
   * barra de "evento de vários dias" na agenda nativa.
   */
  async function handleSalvarIntervalo() {
    const inicio = data;
    // MUDANÇA (item 9.1): o horário do fim é sempre o mesmo de `data`
    // (compartilhado, como já era antes com horaStr) — só o dia vem de
    // `dataFimIntervalo`. Sem TextInput livre, não existe mais "Data
    // inválida" pra validar aqui: só resta checar a ORDEM das datas.
    const fim = combinarComHora(dataFimIntervalo, data);

    if (fim.getTime() < inicio.getTime()) {
      setAviso({ titulo: 'Datas fora de ordem', mensagem: 'A data final precisa ser igual ou depois da data de início.' });
      return;
    }

    setSalvando(true);
    try {
      const temPermissao = await pedirPermissao();
      if (!temPermissao) {
        setAviso({ titulo: 'Permissão necessária', mensagem: 'O app precisa de acesso à agenda pra salvar o evento.' });
        return;
      }

      const tituloBase = titulo.trim();
      const tagsFinal = tagsSelecionadas;
      const descricaoFinal = descricao.trim() || undefined;

      const eventoInicio: NovoEvento = {
        titulo: `Início: ${tituloBase}`,
        data: inicio,
        descricao: descricaoFinal,
        tags: tagsFinal,
      };
      const eventoFim: NovoEvento = {
        titulo: `Prazo final: ${tituloBase}`,
        data: fim,
        descricao: descricaoFinal,
        tags: tagsFinal,
      };

      const idInicio = await criarEventoNaAgenda(eventoInicio);
      salvarRegistro(idInicio, tagsFinal);
      const idFim = await criarEventoNaAgenda(eventoFim);
      salvarRegistro(idFim, tagsFinal);

      navigation.navigate('Dashboard');
    } catch (erro) {
      setAviso({ titulo: 'Erro ao salvar', mensagem: 'Não foi possível salvar os dois eventos do período. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.overline}>{modoEdicao ? 'EDITAR' : 'REVISAR ANTES DE SALVAR'}</Text>
        <Text style={styles.titulo}>{modoEdicao ? 'Editar evento' : 'Confirmar evento'}</Text>

        {ehIntervalo && (
          <View style={styles.avisoIntervalo}>
            <Feather name="repeat" size={14} color={theme.colors.accent} />
            <Text style={styles.avisoIntervaloTexto}>
              Detectamos um período. Vamos criar dois eventos: um de início e um de prazo final.
            </Text>
          </View>
        )}

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
              <Text style={styles.label}>{ehIntervalo ? 'INÍCIO' : 'DATA'}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.input, styles.inputPressable, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() => abrirDatePicker(data, (novaData) => setData((atual) => combinarDataEHora(atual, novaData)))}
            >
              <Text style={styles.inputPressableTexto}>{formatarData(data)}</Text>
              <Feather name="chevron-down" size={14} color={theme.colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.inputMetade}>
            <View style={styles.labelComIcone}>
              <Feather name="clock" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>HORA</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.input, styles.inputPressable, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() => abrirTimePicker(data, (novaHora) => setData((atual) => combinarComHora(atual, novaHora)))}
            >
              <Text style={styles.inputPressableTexto}>{formatarHora(data)}</Text>
              <Feather name="chevron-down" size={14} color={theme.colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {ehIntervalo && (
          <>
            <View style={styles.labelComIcone}>
              <Feather name="flag" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>PRAZO FINAL</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.input, styles.inputPressable, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() =>
                abrirDatePicker(dataFimIntervalo, (novaData) =>
                  setDataFimIntervalo((atual) => combinarDataEHora(atual, novaData))
                )
              }
            >
              <Text style={styles.inputPressableTexto}>{formatarData(dataFimIntervalo)}</Text>
              <Feather name="chevron-down" size={14} color={theme.colors.textMuted} />
            </Pressable>
            <Text style={styles.dicaHoraCompartilhada}>
              O horário acima ({formatarHora(data)}) é usado nos dois eventos.
            </Text>
          </>
        )}

        {/* MUDANÇA (item 1): duração e alarme configuráveis. Escondidos no
            fluxo de intervalo (início + prazo final) porque esse fluxo cria
            dois eventos pontuais e continua usando os padrões (60min/30min),
            sem uma "duração" ou "dia inteiro" que faça sentido pra ele. */}
        {!ehIntervalo && (
          <>
            <View style={styles.labelComIcone}>
              <Feather name="clock" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>DURAÇÃO</Text>
            </View>
            <View style={styles.chipsRow}>
              {OPCOES_DURACAO.map((opcao) => {
                const selecionada = duracaoOpcao === opcao.valor;
                return (
                  <Pressable
                    key={opcao.valor}
                    style={({ pressed }) => [
                      styles.chip,
                      selecionada && styles.chipSelecionado,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={() => setDuracaoOpcao(opcao.valor)}
                  >
                    <Text style={[styles.chipTexto, selecionada && styles.chipTextoSelecionado]}>
                      {opcao.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {duracaoOpcao === 'personalizado' && (
              <TextInput
                style={[styles.input, campoFocado === 'duracaoPersonalizada' && styles.inputFocado]}
                placeholder="Duração em minutos, ex: 90"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={duracaoPersonalizadaStr}
                onChangeText={setDuracaoPersonalizadaStr}
                onFocus={() => setCampoFocado('duracaoPersonalizada')}
                onBlur={() => setCampoFocado(null)}
              />
            )}

            {duracaoOpcao === 'diaInteiro' && (
              <>
                <Text style={styles.dicaHoraCompartilhada}>
                  Deixe igual ao início pra um evento de um dia só, ou escolha o último dia (ex: viagem, prova de
                  múltiplos dias).
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.input, styles.inputPressable, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={() =>
                    abrirDatePicker(dataFimDiaInteiro ?? data, (novaData) =>
                      setDataFimDiaInteiro(new Date(novaData.getFullYear(), novaData.getMonth(), novaData.getDate()))
                    )
                  }
                >
                  <Text style={styles.inputPressableTexto}>
                    {dataFimDiaInteiro ? formatarData(dataFimDiaInteiro) : 'Igual ao início (um dia só)'}
                  </Text>
                  <Feather name="chevron-down" size={14} color={theme.colors.textMuted} />
                </Pressable>
                {dataFimDiaInteiro && (
                  <Pressable
                    style={({ pressed }) => [styles.limparLink, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => setDataFimDiaInteiro(undefined)}
                  >
                    <Feather name="rotate-ccw" size={12} color={theme.colors.accent} />
                    <Text style={styles.limparLinkTexto}>Voltar a um dia só</Text>
                  </Pressable>
                )}
              </>
            )}

            <View style={styles.labelComIcone}>
              <Feather name="bell" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>ANTECEDÊNCIA DO ALARME</Text>
            </View>
            <View style={styles.chipsRow}>
              {OPCOES_ANTECEDENCIA.map((opcao) => {
                const selecionada = antecedenciaOpcao === opcao.valor;
                return (
                  <Pressable
                    key={opcao.valor}
                    style={({ pressed }) => [
                      styles.chip,
                      selecionada && styles.chipSelecionado,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={() => setAntecedenciaOpcao(opcao.valor)}
                  >
                    <Text style={[styles.chipTexto, selecionada && styles.chipTextoSelecionado]}>
                      {opcao.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* MUDANÇA (item 2): seletor de recorrência. Sempre visível,
                mesmo quando o parser não detectou nenhuma repetição — ela
                pode marcar recorrência manualmente num evento que digitou
                sem indicar repetição nenhuma. */}
            <View style={styles.labelComIcone}>
              <Feather name="repeat" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>REPETIR</Text>
            </View>
            <View style={styles.chipsRow}>
              {OPCOES_RECORRENCIA.map((opcao) => {
                const selecionada = recorrenciaOpcao === opcao.valor;
                return (
                  <Pressable
                    key={opcao.valor}
                    style={({ pressed }) => [
                      styles.chip,
                      selecionada && styles.chipSelecionado,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={() => setRecorrenciaOpcao(opcao.valor)}
                  >
                    <Text style={[styles.chipTexto, selecionada && styles.chipTextoSelecionado]}>
                      {opcao.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {recorrenciaOpcao !== 'nenhuma' && (
              <Text style={styles.dicaHoraCompartilhada}>
                {recorrenciaOpcao === 'diaria' && 'Repete todo dia, sem data de término definida.'}
                {recorrenciaOpcao === 'semanal' &&
                  `Repete toda ${NOMES_DIA_SEMANA_EXTENSO[data.getDay()]}, sem data de término definida.`}
                {recorrenciaOpcao === 'mensal' &&
                  `Repete todo dia ${data.getDate()} do mês, sem data de término definida.`}
              </Text>
            )}
          </>
        )}

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
          <Text style={styles.label}>TAGS (OPCIONAL)</Text>
        </View>

        {/* MUDANÇA (item 4): tags já adicionadas a este evento, como chips
            removíveis (padrão "chips de convidados" de apps de e-mail) —
            ficam ACIMA do campo de criar tag nova, pra deixar claro que já
            fazem parte do evento, não são só sugestões. */}
        {tagsSelecionadas.length > 0 && (
          <View style={styles.chipsRow}>
            {tagsSelecionadas.map((t) => {
              const cor = corDaTag(coresPorTag[t.trim().toLowerCase()] ?? 0, theme.mode);
              return (
                <Pressable
                  key={t}
                  style={({ pressed }) => [styles.chip, styles.chipSelecionado, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => removerTag(t)}
                >
                  <View style={[styles.chipBolinha, { backgroundColor: cor.base }]} />
                  <Text style={[styles.chipTexto, styles.chipTextoSelecionado]}>{t}</Text>
                  <Feather name="x" size={11} color={theme.colors.textPrimary} />
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.linhaAdicionarTag}>
          <TextInput
            style={[
              styles.input,
              styles.inputAdicionarTag,
              campoFocado === 'novaTag' && styles.inputFocado,
            ]}
            placeholder="Ex: Universidade"
            placeholderTextColor={theme.colors.textMuted}
            value={novaTagTexto}
            onChangeText={setNovaTagTexto}
            onFocus={() => setCampoFocado('novaTag')}
            onBlur={() => setCampoFocado(null)}
            onSubmitEditing={handleAdicionarNovaTag}
            returnKeyType="done"
          />
          <Pressable
            style={({ pressed }) => [styles.botaoAdicionarTag, { opacity: pressed ? 0.7 : 1 }]}
            onPress={handleAdicionarNovaTag}
            hitSlop={8}
          >
            <Feather name="plus" size={18} color={theme.colors.accentText} />
          </Pressable>
        </View>

        {/* Autocomplete de tags já usadas antes — multi-select: tocar
            alterna a seleção (marca/desmarca), em vez de substituir a
            escolha anterior como era no campo de tag única. Tags que já
            estão em `tagsSelecionadas` não aparecem duplicadas aqui de
            novo (já têm seu chip removível acima). */}
        {tagsExistentes.filter((t) => !tagJaSelecionada(t)).length > 0 && (
          <View style={styles.chipsRow}>
            {tagsExistentes
              .filter((t) => !tagJaSelecionada(t))
              .map((t) => {
                const cor = corDaTag(coresPorTag[t.trim().toLowerCase()] ?? 0, theme.mode);
                return (
                  <Pressable
                    key={t}
                    style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => alternarTagExistente(t)}
                  >
                    <View style={[styles.chipBolinha, { backgroundColor: cor.base }]} />
                    <Text style={styles.chipTexto}>{t}</Text>
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
                {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : ehIntervalo ? 'Criar os 2 eventos' : 'Salvar na agenda'}
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

// MUDANÇA (item 3): formatarData/formatarHora/combinarDataEHora/combinarComHora/
// abrirDatePicker/abrirTimePicker migraram pra src/utils/dataHora.ts —
// ConfirmMultiplosScreen.tsx precisa do mesmo padrão de picker e duplicar
// aqui ia divergir com o tempo. Ver import no topo do arquivo.

// MUDANÇA (item 1): opções fixas dos dois seletores de chip. Vivem fora do
// componente porque são constantes — não dependem de estado nem de props,
// só do texto exibido em cada chip.
const OPCOES_DURACAO: { valor: '30' | '60' | '120' | 'diaInteiro' | 'personalizado'; label: string }[] = [
  { valor: '30', label: '30 min' },
  { valor: '60', label: '1h' },
  { valor: '120', label: '2h' },
  { valor: 'diaInteiro', label: 'Dia inteiro' },
  { valor: 'personalizado', label: 'Personalizado' },
];

const OPCOES_ANTECEDENCIA: { valor: '10' | '30' | '60' | '1440' | 'sem'; label: string }[] = [
  { valor: '10', label: '10 min' },
  { valor: '30', label: '30 min' },
  { valor: '60', label: '1h' },
  { valor: '1440', label: '1 dia' },
  { valor: 'sem', label: 'Sem alarme' },
];

// MUDANÇA (item 2): opções do seletor de recorrência.
const OPCOES_RECORRENCIA: { valor: 'nenhuma' | 'diaria' | 'semanal' | 'mensal'; label: string }[] = [
  { valor: 'nenhuma', label: 'Não repete' },
  { valor: 'diaria', label: 'Todo dia' },
  { valor: 'semanal', label: 'Toda semana' },
  { valor: 'mensal', label: 'Todo mês' },
];

// Usado só pra montar a dica de texto abaixo do seletor de recorrência
// ("Repete toda quinta..."), a partir de Date.getDay() (0 = domingo).
const NOMES_DIA_SEMANA_EXTENSO = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

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
    // MUDANÇA (item 9.1): campos de data/hora agora são Pressable (abrem o
    // picker nativo), não mais TextInput — reaproveita a base visual de
    // `input` (mesma borda/fundo/padding) mas em row, com o texto formatado
    // de um lado e um chevron do outro indicando que é tocável.
    inputPressable: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    inputPressableTexto: { ...theme.typography.body, color: theme.colors.textPrimary },
    limparLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      marginTop: -theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    limparLinkTexto: { ...theme.typography.caption, color: theme.colors.accent },
    textarea: { minHeight: 64, textAlignVertical: 'top' },
    linhaDupla: { flexDirection: 'row', gap: theme.spacing.sm },
    inputMetade: { flex: 1 },
    avisoIntervalo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs + 2,
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm + 2,
      marginBottom: theme.spacing.md,
    },
    avisoIntervaloTexto: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    dicaHoraCompartilhada: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: -theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs + 2, marginBottom: theme.spacing.lg },
    // MUDANÇA (item 4): campo de criar tag nova + botão "+", lado a lado —
    // reaproveita a base visual de `input`, mas em row com o botão de
    // largura fixa ao lado (mesmo padrão de `inputPressable`, só que aqui
    // o segundo elemento é um botão separado, não parte do mesmo Pressable).
    linhaAdicionarTag: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' },
    inputAdicionarTag: { flex: 1, marginBottom: theme.spacing.md },
    botaoAdicionarTag: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
