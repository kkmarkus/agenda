import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { buscarEventoDaAgenda, apagarEventoDaAgenda, buscarEventosFuturosDeCalendarios } from '../services/calendarService';
import {
  listarRegistros,
  apagarRegistro,
  listarCoresDeTags,
  listarTagsUnicas,
  listarCalendariosSincronizadosAtivos,
  listarNativeIdsRegistrados,
  salvarRegistro,
  alternarFixado,
  SEM_TAG_LABEL,
} from '../services/database';
import { EventoApp } from '../types/event';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { corDaTag, corDaTagAcentuada, TAG_WASH_ALPHA } from '../theme/theme';
import SkeletonBlock from '../components/SkeletonBlock';
import ConfirmDialog from '../components/ConfirmDialog';
import SettingsDrawer from '../components/SettingsDrawer';

// CORREÇÃO: antes cada tela declarava seu próprio tipo de Props "simplificado",
// desalinhado do RootStackParamList real do AppNavigator. Usando
// NativeStackScreenProps aqui, o TypeScript passa a checar de verdade os
// parâmetros de rota e navegação (erro de digitação em nome de tela ou
// parâmetro esquecido vira erro de compilação, não bug em produção).
type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const LIMITE_URGENTE_HORAS = 48;
// Janela de busca da sincronização: só importa eventos dos próximos 90
// dias. Eventos mais distantes que isso simplesmente não existem ainda
// pro dashboard — na próxima vez que ela abrir o app dentro dessa janela,
// eles aparecem normalmente.
const DIAS_SINCRONIZACAO = 90;

const MESES_COMPLETOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// CORREÇÃO (perf 1): extraído de dentro de carregarEventos pra poder ser
// reaproveitado nas atualizações otimistas (fixar/desafixar, apagar,
// limpar passados) — mesmo critério de sempre: fixados primeiro
// (ordenados entre si por data), depois o resto por proximidade. `sort` é
// estável no engine JS usado pelo React Native (V8/Hermes), então basta
// comparar o fixado — quem empata mantém a ordem relativa da comparação
// por data que já rodou antes.
function ordenarEventos(lista: EventoApp[]): EventoApp[] {
  const copia = [...lista];
  copia.sort((a, b) => a.data.getTime() - b.data.getTime());
  copia.sort((a, b) => Number(b.fixado) - Number(a.fixado));
  return copia;
}

// CORREÇÃO (perf 2): antes esse card inteiro era uma função inline dentro
// do `renderItem` do FlatList — recriada a cada render do Dashboard,
// inclusive a cada tecla digitada na busca. Extraído pra um componente
// próprio e envolvido em `React.memo`, ele só rerenderiza quando as props
// de um evento específico mudam de verdade (não quando outro evento da
// lista muda, nem quando o texto de busca muda mas esse item continua
// igual).
type EventoCardProps = {
  item: EventoApp;
  urgente: boolean;
  horasRestantes: number;
  theme: ReturnType<typeof useTheme>;
  styles: ReturnType<typeof criarStyles>;
  coresPorTag: Record<string, number>;
  registrarSwipeableRef: (id: number, ref: any) => void;
  onSwipeableWillOpen: (id: number) => void;
  onEditar: (evento: EventoApp) => void;
  onAlternarFixado: (evento: EventoApp) => void;
  onApagar: (evento: EventoApp) => void;
};

const EventoCard = React.memo(function EventoCard({
  item,
  urgente,
  horasRestantes,
  theme,
  styles,
  coresPorTag,
  registrarSwipeableRef,
  onSwipeableWillOpen,
  onEditar,
  onAlternarFixado,
  onApagar,
}: EventoCardProps) {
  // MUDANÇA (item 4): tags exibidas nas pills e no traço lateral, travadas
  // nas 3 primeiras (na ordem em que foram adicionadas — ver
  // definirTagsDoEvento em database.ts). Com 4+ tags, as demais continuam
  // aparecendo só nas pills de texto (ver "+N" abaixo), sem ganhar
  // segmento próprio no traço.
  const tagsParaFaixa = item.tags.slice(0, 3);
  function corDaTagNome(nome: string) {
    return corDaTag(coresPorTag[nome.trim().toLowerCase()] ?? 0, theme.mode);
  }
  // CORREÇÃO (item D — opção 2): só a bolinha de 6px do pill usa a versão
  // mais saturada — o fundo lavado da pill e o texto continuam vindo de
  // corDaTagNome (paleta original).
  function corAcentuadaDaTagNome(nome: string) {
    return corDaTagAcentuada(coresPorTag[nome.trim().toLowerCase()] ?? 0, theme.mode);
  }

  // Evento urgente sobrepõe a cor de urgência no lugar das cores de tag
  // (regra que já existia antes do item 4, sem mudança) — um único
  // segmento sólido, não um por tag, já que a urgência é uma propriedade
  // do evento, não de cada tag individualmente.
  const segmentosFaixa: string[] = urgente
    ? [theme.colors.urgent]
    : tagsParaFaixa.length > 0
    ? tagsParaFaixa.map((t) => corDaTagNome(t).base)
    : [theme.colors.textMuted];

  return (
    <Swipeable
      ref={(ref) => registrarSwipeableRef(item.id, ref)}
      overshootRight={false}
      rightThreshold={40}
      friction={2}
      onSwipeableWillOpen={() => onSwipeableWillOpen(item.id)}
      renderRightActions={() => (
        <View style={styles.acoesSwipeRow}>
          <Pressable style={styles.acaoFixar} onPress={() => onAlternarFixado(item)}>
            {/* CORREÇÃO (bug 4): "map-pin" do Feather é um pino de
                localização (gota de mapa), sem relação visual com "fixar
                no topo" — MaterialCommunityIcons tem um alfinete/thumbtack
                de verdade ("pin"). */}
            <MaterialCommunityIcons
              name="pin"
              size={19}
              color={item.fixado ? theme.colors.accent : theme.colors.textMuted}
            />
          </Pressable>
          <Pressable style={styles.acaoApagar} onPress={() => onApagar(item)}>
            <Feather name="trash-2" size={19} color={theme.colors.urgent} />
          </Pressable>
        </View>
      )}
    >
      <Pressable
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => onEditar(item)}
      >
        <View style={styles.faixa}>
          {segmentosFaixa.map((corSegmento, indice) => (
            <View key={indice} style={[styles.faixaSegmento, { backgroundColor: corSegmento }]} />
          ))}
        </View>
        <View style={styles.cardConteudo}>
          <View style={{ flex: 1 }}>
            <View style={styles.cardTituloRow}>
              {item.fixado && <MaterialCommunityIcons name="pin" size={12} color={theme.colors.accent} />}
              {urgente && <Feather name="bell" size={12} color={theme.colors.urgent} />}
              <Text style={styles.cardTitulo} numberOfLines={1}>{item.titulo}</Text>
            </View>
            {/* CORREÇÃO (bug 6): antes cardMetaRow (data) e cardTagsRow
                (pills) eram duas Views separadas, uma sempre embaixo da
                outra — mesmo quando cabia tudo numa linha só (ex: 1-2 tags
                curtas). Um único container com flexWrap deixa a data e as
                pills preencherem a mesma linha na ordem em que aparecem,
                só descendo pra uma segunda linha quando não couber mais —
                sem precisar de nenhuma lógica baseada em quantas tags o
                evento tem. */}
            <View style={styles.cardMetaTagsRow}>
              <Text style={[styles.cardData, urgente && styles.cardDataUrgente]}>
                {formatarDataLegivel(item.data)}
              </Text>
              {item.tags.length === 0 ? (
                <View style={styles.cardTagPill}>
                  <View style={[styles.cardTagBolinha, { backgroundColor: theme.colors.textMuted }]} />
                  <Text style={styles.cardTagTexto} numberOfLines={1}>{SEM_TAG_LABEL}</Text>
                </View>
              ) : (
                <>
                  {item.tags.slice(0, 3).map((nomeTag) => {
                    const corTag = corDaTagNome(nomeTag);
                    return (
                      <View
                        key={nomeTag}
                        style={[styles.cardTagPill, { backgroundColor: corTag.base + TAG_WASH_ALPHA }]}
                      >
                        <View
                          style={[
                            styles.cardTagBolinha,
                            { backgroundColor: corAcentuadaDaTagNome(nomeTag).base },
                          ]}
                        />
                        <Text style={[styles.cardTagTexto, { color: corTag.base }]} numberOfLines={1}>
                          {nomeTag}
                        </Text>
                      </View>
                    );
                  })}
                  {item.tags.length > 3 && (
                    <View style={styles.cardTagPill}>
                      <Text style={styles.cardTagTexto}>+{item.tags.length - 3}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
          <Text style={[styles.cardDias, urgente && styles.cardDiasUrgente]}>
            {formatarDiasRestantes(horasRestantes)}
          </Text>
        </View>
      </Pressable>
    </Swipeable>
  );
});

export default function DashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  // CORREÇÃO (performance): `criarStyles` monta um StyleSheet novo a cada
  // render — nesta tela em particular isso rodava a cada tecla digitada na
  // busca, cada troca de aba de tag etc. `useMemo` faz recalcular só
  // quando o tema muda de verdade.
  const styles = useMemo(() => criarStyles(theme), [theme]);

  const [eventos, setEventos] = useState<EventoApp[]>([]);
  const [tagsDisponiveis, setTagsDisponiveis] = useState<string[]>([]);
  const [tagAtiva, setTagAtiva] = useState<string | null>(null); // null = "Todas"
  const [carregando, setCarregando] = useState(true);
  const [coresPorTag, setCoresPorTag] = useState<Record<string, number>>({});
  const [menuAberto, setMenuAberto] = useState(false);
  // CORREÇÃO (performance): função estável (não recriada a cada render) —
  // sem isso, o `React.memo` aplicado em SettingsDrawer não teria efeito
  // nenhum, já que uma prop de função nova a cada render sempre "muda"
  // pro React, forçando o SettingsDrawer a rerenderizar de qualquer jeito.
  const fecharMenu = useCallback(() => setMenuAberto(false), []);
  // MUDANÇA (9.5): busca por texto, filtrando por título — convive com o
  // filtro de tag (abas) já existente, sem substituí-lo. Os dois se
  // combinam por E lógico: uma tag ativa + um texto de busca mostram só o
  // que casa com AMBOS.
  const [busca, setBusca] = useState('');
  // CORREÇÃO (perf 4): `busca` (acima) atualiza a cada tecla, pro campo em
  // si responder na hora — sem isso o texto digitado pareceria com
  // atraso. `buscaDebounced` só acompanha 200ms depois que ela para de
  // digitar, e é essa versão que alimenta o filtro de verdade (mais
  // abaixo), evitando recalcular a lista inteira a cada caractere.
  const [buscaDebounced, setBuscaDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca), 200);
    return () => clearTimeout(timer);
  }, [busca]);

  // Cada linha da lista tem seu próprio Swipeable; guardamos as refs pra
  // poder fechar as outras quando uma nova é aberta (senão várias linhas
  // podem ficar "abertas" ao mesmo tempo, o que fica estranho).
  const swipeableRefs = useRef<Record<number, any>>({});

  // CORREÇÃO (perf 2): funções estáveis (useCallback com deps vazias) —
  // passadas como prop pro EventoCard memoizado, uma nova referência a
  // cada render invalidaria o React.memo dele à toa.
  const registrarSwipeableRef = useCallback((id: number, ref: any) => {
    swipeableRefs.current[id] = ref;
  }, []);

  function fecharOutrosSwipes(idAtual: number) {
    Object.entries(swipeableRefs.current).forEach(([id, ref]) => {
      if (Number(id) !== idAtual && ref) ref.close();
    });
  }
  // CORREÇÃO (perf 2): versão estável de fecharOutrosSwipes, pra passar
  // como prop pro EventoCard memoizado sem invalidar o React.memo a cada
  // render.
  const onSwipeableWillOpen = useCallback((idAtual: number) => fecharOutrosSwipes(idAtual), []);

  // useFocusEffect (não useEffect) porque ela pode voltar pra essa tela
  // depois de salvar um evento novo — precisa recarregar toda vez que a tela ganha foco.
  // A sincronização roda ANTES de carregar, na mesma passada: assim eventos
  // importados de outros calendários já aparecem na primeira renderização,
  // sem um segundo "pulo" na lista logo depois de carregar.
  useFocusEffect(
    useCallback(() => {
      sincronizarCalendariosExternos().finally(() => carregarEventos());
    }, [])
  );

  /**
   * Importa eventos futuros dos calendários externos que ela escolheu
   * sincronizar (ver CalendarSyncScreen). Só insere o que ainda não existe
   * no banco local — compara pelo id nativo do evento, então rodar isso de
   * novo a cada vez que o Dashboard ganha foco não duplica nada. Eventos
   * importados sempre entram sem tag (tag: null), já que ela não passou
   * por essa tela pra classificar — aparecem no grupo "Sem tag" até ela
   * decidir dar uma tag (editando o evento).
   */
  async function sincronizarCalendariosExternos() {
    try {
      const idsAtivos = listarCalendariosSincronizadosAtivos();
      if (idsAtivos.length === 0) return;

      const eventosExternos = await buscarEventosFuturosDeCalendarios(idsAtivos, DIAS_SINCRONIZACAO);
      const jaRegistrados = listarNativeIdsRegistrados();

      for (const evento of eventosExternos) {
        if (!jaRegistrados.has(evento.nativeEventId)) {
          salvarRegistro(evento.nativeEventId, []);
        }
      }
    } catch {
      // Sincronização é um "bônus" — se falhar (ex: permissão revogada),
      // o Dashboard ainda deve carregar normalmente com o que já existe
      // no banco local, em vez de travar a tela inteira por causa disso.
    }
  }

  async function carregarEventos() {
    setCarregando(true);
    const registros = listarRegistros();

    // MUDANÇA (9.3): antes era um for...of sequencial (uma chamada de
    // buscarEventoDaAgenda esperava a anterior terminar antes de começar a
    // próxima) — com N eventos, o tempo total crescia linearmente com N.
    // Promise.all dispara todas as buscas de uma vez; o tempo total passa a
    // ser só o da busca mais lenta, não a soma de todas.
    const resultados = await Promise.all(
      registros.map(async (registro) => {
        const dadosNativos = await buscarEventoDaAgenda(registro.nativeEventId);
        return { registro, dadosNativos };
      })
    );

    const resultado: EventoApp[] = [];
    const registrosOrfaos: number[] = [];

    resultados.forEach(({ registro, dadosNativos }) => {
      if (!dadosNativos) {
        // Evento sumiu da agenda nativa (ela apagou direto no Google Calendar):
        // marcamos o registro órfão pra limpar depois do loop — apagar
        // durante o forEach misturaria escrita e leitura no meio da
        // montagem do array, sem ganho nenhum (as buscas já rodaram todas
        // em paralelo antes disso).
        registrosOrfaos.push(registro.id);
        return;
      }

      resultado.push({
        id: registro.id,
        nativeEventId: registro.nativeEventId,
        tags: registro.tags,
        titulo: dadosNativos.titulo,
        data: dadosNativos.data,
        descricao: dadosNativos.descricao,
        recorrente: dadosNativos.recorrente,
        recorrencia: dadosNativos.recorrencia,
        fixado: registro.fixado,
      });
    });

    registrosOrfaos.forEach((id) => apagarRegistro(id));

    // MUDANÇA (item 5): fixados sempre primeiro (ordenados entre si por
    // data, igual antes), depois o resto na ordem de sempre (proximidade)
    // — ver ordenarEventos, acima, reaproveitada aqui e nas atualizações
    // otimistas (perf 1).
    setEventos(ordenarEventos(resultado));
    setTagsDisponiveis(listarTagsUnicas());
    setCoresPorTag(listarCoresDeTags());
    setCarregando(false);
  }

  // MUDANÇA (item 2): navega pra edição de fato — extraído do antigo
  // handleEditar pra poder ser chamado tanto direto (evento comum) quanto
  // depois de ela escolher o escopo (evento recorrente).
  // CORREÇÃO (perf 2): useCallback — handleEditar (abaixo, passado como
  // prop pro EventoCard memoizado) depende dela.
  const navegarParaEdicao = useCallback(
    (evento: EventoApp, ocorrencia?: { instanceStartDate: Date; futureEvents: boolean }) => {
      navigation.navigate('Confirmar', {
        nativeEventId: evento.nativeEventId,
        rascunho: {
          titulo: evento.titulo,
          data: evento.data,
          descricao: evento.descricao,
          tags: evento.tags,
          recorrencia: evento.recorrencia,
        },
        ocorrencia,
      });
    },
    [navigation]
  );

  // Evento recorrente aguardando ela escolher "Somente este" ou "Este e os
  // futuros" antes de abrir a tela de edição.
  const [eventoParaEscolherEscopoEdicao, setEventoParaEscolherEscopoEdicao] = useState<EventoApp | null>(null);

  // CORREÇÃO (perf 2): useCallback — passada como prop pro EventoCard
  // memoizado, uma nova referência a cada render invalidaria o
  // React.memo dele à toa.
  const handleEditar = useCallback(
    (evento: EventoApp) => {
      if (evento.recorrente) {
        setEventoParaEscolherEscopoEdicao(evento);
        return;
      }
      navegarParaEdicao(evento);
    },
    [navegarParaEdicao]
  );

  // Estado do evento aguardando confirmação de exclusão — substitui o
  // Alert.alert nativo (fora do tema, sempre branco/Material) pelo
  // ConfirmDialog, que segue a paleta do app.
  const [eventoParaApagar, setEventoParaApagar] = useState<EventoApp | null>(null);

  // CORREÇÃO (perf 2): useCallback, mesmo motivo acima.
  const handleApagar = useCallback((evento: EventoApp) => {
    swipeableRefs.current[evento.id]?.close();
    setEventoParaApagar(evento);
  }, []);

  // MUDANÇA (item 5): fixar/desafixar não precisa de confirmação (ação
  // reversível e barata, diferente de apagar) — alterna direto.
  // CORREÇÃO (bug 2 + perf 1): antes chamava carregarEventos() depois de
  // alternar — isso disparava buscarEventoDaAgenda (chamada nativa) de
  // novo pra TODOS os eventos só pra refletir uma mudança de um campo já
  // conhecido localmente (fixado). Como não tem nenhum dado vindo de fora
  // do app envolvido aqui, dá pra atualizar o estado local direto e
  // reordenar em memória.
  // CORREÇÃO (perf 2): useCallback, mesmo motivo acima.
  const handleAlternarFixado = useCallback((evento: EventoApp) => {
    swipeableRefs.current[evento.id]?.close();
    alternarFixado(evento.id);
    setEventos((atual) =>
      ordenarEventos(atual.map((e) => (e.id === evento.id ? { ...e, fixado: !e.fixado } : e)))
    );
  }, []);

  async function confirmarApagar(futureEvents?: boolean) {
    if (!eventoParaApagar) return;
    // MUDANÇA (item 2): evento recorrente precisa dizer ao expo-calendar
    // A PARTIR DE QUAL ocorrência apagar — usamos a própria data carregada
    // do evento (o `data` do EventoApp É o início dessa ocorrência
    // específica), não uma data-base da série.
    const opcoesOcorrencia =
      eventoParaApagar.recorrente && futureEvents !== undefined
        ? { instanceStartDate: eventoParaApagar.data, futureEvents }
        : undefined;
    // Sincronizado: apaga dos dois lados, senão o alarme nativo continua
    // ativo pra um evento que sumiu do app. Exceção: evento recorrente
    // ("Somente este" ou "Este e os futuros") NÃO apaga o registro local
    // aqui — o registro (native_event_id + tag) representa a SÉRIE
    // inteira, e outras ocorrências dela podem continuar existindo. Se a
    // série inteira tiver mesmo sumido, a próxima carga do Dashboard já
    // detecta isso sozinha (buscarEventoDaAgenda retorna null) e limpa o
    // registro órfão — mesmo mecanismo que já existe pra quando ela apaga
    // um evento direto no Google Calendar.
    await apagarEventoDaAgenda(eventoParaApagar.nativeEventId, opcoesOcorrencia);
    if (!opcoesOcorrencia) {
      apagarRegistro(eventoParaApagar.id);
      // CORREÇÃO (bug 2 + perf 1): registro realmente sumiu (não é uma
      // série que pode continuar existindo) — remove do estado local
      // direto, sem recarregar tudo de novo.
      const idApagado = eventoParaApagar.id;
      setEventos((atual) => atual.filter((e) => e.id !== idApagado));
      setEventoParaApagar(null);
    } else {
      // Evento recorrente com escopo ("Somente este" / "Este e os
      // futuros"): o registro local continua representando a série, mas a
      // PRÓXIMA ocorrência exibida pode ter mudado — isso só a agenda
      // nativa sabe, então aqui precisa mesmo recarregar pra buscar a
      // data atualizada (não dá pra estimar isso otimisticamente).
      setEventoParaApagar(null);
      carregarEventos();
    }
  }

  // MUDANÇA (item 6): estado do diálogo de limpeza em lote — separado de
  // `eventoParaApagar` porque não se refere a um evento específico.
  const [confirmandoLimpezaPassados, setConfirmandoLimpezaPassados] = useState(false);

  /**
   * Apaga uma lista de eventos (agenda nativa + registro local) — usada
   * tanto pela limpeza em lote (item 6) quanto, no fundo, pelo mesmo
   * caminho que `confirmarApagar` já percorre pra um evento só, reaproveitado
   * aqui em vez de duplicar o loop de apagar+desregistrar.
   *
   * CORREÇÃO (perf 3): antes era um `for...of` sequencial (um `await` por
   * evento, esperando cada exclusão terminar antes de começar a próxima),
   * mesmo padrão que já tinha sido corrigido no carregamento
   * (`carregarEventos` usa `Promise.all` desde a mudança 9.3). Como cada
   * exclusão é independente (não lê nada que outra escreveu — diferente
   * de leitura+escrita misturadas, onde paralelizar poderia causar
   * condição de corrida), dá pra paralelizar do mesmo jeito: o tempo total
   * passa a ser o da exclusão mais lenta, não a soma de todas.
   */
  async function apagarListaDeEventos(lista: EventoApp[]) {
    await Promise.all(
      lista.map(async (evento) => {
        await apagarEventoDaAgenda(evento.nativeEventId);
        apagarRegistro(evento.id);
      })
    );
  }

  async function confirmarLimpezaPassados(incluirFixados: boolean) {
    const alvos = incluirFixados ? eventosPassados : eventosPassadosNaoFixados;
    await apagarListaDeEventos(alvos);
    setConfirmandoLimpezaPassados(false);
    // CORREÇÃO (bug 2 + perf 1): mesmo raciocínio do apagar/fixar — todos
    // os `alvos` já foram removidos (agenda nativa + registro local), não
    // tem nenhum dado externo pra buscar de novo. Remove do estado local
    // direto em vez de recarregar tudo.
    const idsApagados = new Set(alvos.map((e) => e.id));
    setEventos((atual) => atual.filter((e) => !idsApagados.has(e.id)));
  }


  const temEventosSemTag = eventos.some((e) => e.tags.length === 0);

  // tagAtiva: null = "Todas", '' = "Sem tag" (sentinel — tags de verdade
  // nunca são string vazia), qualquer outra string = tag específica.
  // MUDANÇA (item 4): com múltiplas tags por evento, o filtro passa a
  // checar se a tag ativa está ENTRE as tags do evento (some), não se é a
  // única tag dele (comparação de igualdade direta, que só fazia sentido
  // quando cada evento tinha no máximo uma).
  // CORREÇÃO (perf 2): antes rodava direto no corpo da função, recalculando
  // (com uma nova referência de array) a cada render — inclusive a cada
  // tecla digitada na busca. `useMemo` só recalcula quando `eventos` ou
  // `tagAtiva` mudam de verdade.
  const eventosFiltradosPorTag = useMemo(() => {
    return tagAtiva === null
      ? eventos
      : tagAtiva === ''
      ? eventos.filter((e) => e.tags.length === 0)
      : eventos.filter((e) => e.tags.some((t) => t.toLowerCase() === tagAtiva.toLowerCase()));
  }, [eventos, tagAtiva]);

  // MUDANÇA (9.5): aplicado por cima do filtro de tag, não no lugar dele —
  // buscar "reunião" com a aba "Trabalho" ativa mostra só reuniões
  // marcadas como Trabalho, não todas as reuniões do app inteiro.
  // CORREÇÃO (perf 2): mesmo raciocínio acima — só recalcula quando o
  // resultado do filtro de tag ou o texto da busca mudam.
  // CORREÇÃO (perf 4): usa buscaDebounced, não busca — o filtro (e o
  // recálculo de eventosFiltrados que ele aciona) só roda 200ms depois da
  // última tecla digitada.
  const buscaNormalizada = buscaDebounced.trim().toLowerCase();
  const eventosFiltrados = useMemo(() => {
    return buscaNormalizada
      ? eventosFiltradosPorTag.filter((e) => e.titulo.toLowerCase().includes(buscaNormalizada))
      : eventosFiltradosPorTag;
  }, [eventosFiltradosPorTag, buscaNormalizada]);

  const agora = new Date();

  // MUDANÇA (item 6): candidatos à limpeza em lote. Eventos recorrentes
  // ficam de fora — o `data` carregado é só a ocorrência mais recente que
  // a agenda nativa devolveu pra esse native_event_id, e apagar o evento
  // inteiro (sem instanceStartDate) apagaria a SÉRIE toda, futuras
  // ocorrências inclusive, o que não é o que "limpar o que já passou"
  // deveria fazer. Editar/excluir ocorrências específicas de uma série já
  // tem seu próprio fluxo (item 2, direto no card).
  const eventosPassados = eventos.filter((e) => e.data.getTime() < agora.getTime() && !e.recorrente);
  const eventosPassadosNaoFixados = eventosPassados.filter((e) => !e.fixado);
  const eventosPassadosFixados = eventosPassados.filter((e) => e.fixado);

  // Contagem de urgentes pra badge do cabeçalho — pequeno toque de
  // "dashboard de verdade" em vez de só uma lista.
  const totalUrgentes = eventos.filter((e) => {
    const horas = (e.data.getTime() - Date.now()) / (1000 * 60 * 60);
    return horas >= 0 && horas <= LIMITE_URGENTE_HORAS;
  }).length;

  // CORREÇÃO (perf 2): renderItem do FlatList como useCallback — antes era
  // uma função inline no JSX, recriada a cada render (inclusive a cada
  // tecla digitada na busca). Suas deps são só o que o EventoCard
  // realmente usa (theme/styles/coresPorTag + as funções estáveis
  // definidas acima), então só muda de referência quando algo que afeta a
  // renderização de fato muda.
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.overline}>{formatarCabecalho(agora).toUpperCase()}</Text>
          <Text style={styles.titulo}>Agenda</Text>
        </View>
        <View style={styles.headerAcoes}>
          {/* MUDANÇA: os acessos a Tags e Sincronizar deixaram de ter ícone
              próprio no cabeçalho — agora vivem dentro do menu de
              configurações (SettingsDrawer), junto com aparência (tema e
              cor de destaque). Um cabeçalho que ganhasse um ícone novo a
              cada configuração futura ficaria poluído; um menu central
              escala melhor conforme mais opções forem entrando. */}
          <Pressable
            style={({ pressed }) => [styles.botaoTags, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => setMenuAberto(true)}
            hitSlop={10}
          >
            <Feather name="settings" size={18} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <SettingsDrawer visivel={menuAberto} onFechar={fecharMenu} />

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

      {!carregando && eventos.length > 0 && (
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

      {/* MUDANÇA (item 2): escolha de escopo antes de abrir a edição de um
          evento recorrente — perguntada aqui (não dentro da ConfirmScreen)
          porque a decisão precisa acontecer ANTES de ela começar a mexer
          nos campos, e ConfirmScreen usa o `ocorrencia` recebido só na
          hora de salvar, sem repetir essa pergunta. */}
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

      {/* MUDANÇA (item 6): limpeza em lote. Por padrão pula os fixados —
          fixar é um sinal explícito de "isso importa", então a ação extra
          "Incluir fixados" só aparece quando existe pelo menos um passado
          fixado, evitando o botão vazio no caso comum. */}
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
    headerAcoes: { flexDirection: 'row', gap: theme.spacing.xs + 2 },
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
    // MUDANÇA (9.5): campo de busca por título — mesmo padrão visual de
    // `resumoRow` (fundo/borda/raio), só que em row compacta com ícone de
    // lupa fixo à esquerda, pra ficar claramente diferente do resumo
    // numérico acima e das abas de tag logo abaixo.
    buscaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs + 2,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.sm + 2,
      marginBottom: theme.spacing.md,
    },
    buscaInput: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      ...theme.typography.body,
      color: theme.colors.textPrimary,
    },
    tabsScroll: { flexGrow: 0, marginBottom: theme.spacing.md },
    tabsContent: { gap: theme.spacing.xs, paddingRight: theme.spacing.lg },
    // MUDANÇA (item 6): link discreto — não é uma ação de todo dia, então
    // fica pequena e neutra, sem competir visualmente com as abas de tag.
    linkLimparPassados: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs - 2,
      alignSelf: 'flex-start',
      marginBottom: theme.spacing.md,
    },
    linkLimparPassadosTexto: { ...theme.typography.caption, color: theme.colors.textMuted },
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
    // Traço lateral — grosso o bastante pra cor ser reconhecível de
    // relance, sem virar um fundo colorido no card inteiro. MUDANÇA (item
    // 4): de 6px pra 9px — com até 3 segmentos empilhados (uma tag cada),
    // 6px deixava cada segmento fino demais pra cor ser reconhecível.
    faixa: { width: 9, flexDirection: 'column' },
    // Um segmento por tag (até 3), altura igual entre eles — `flex: 1` faz
    // cada View dividir a altura do card igualmente, sem precisar calcular
    // porcentagem manualmente.
    faixaSegmento: { flex: 1 },
    cardConteudo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    cardTituloRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitulo: { ...theme.typography.subheading, color: theme.colors.textPrimary, flexShrink: 1 },
    // CORREÇÃO (bug 6): antes eram dois estilos (cardMetaRow + cardTagsRow),
    // um embaixo do outro sempre. Um único container com flexWrap deixa a
    // data e as pills de tag preencherem a mesma linha quando cabe, e só
    // quebrar pra uma segunda linha quando não couber mais.
    cardMetaTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 5,
      marginTop: 5,
    },
    // MUDANÇA (item 4): linha própria pra pills de tag (até 3 + indicador
    // "+N"), com flexWrap pra não estourar a largura do card quando várias
    // tags têm nomes longos.
    cardData: { ...theme.typography.caption, color: theme.colors.textSecondary },
    cardDataUrgente: { color: theme.colors.urgent, fontFamily: theme.typography.bodyMedium.fontFamily },
    cardTagPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: 110,
      paddingVertical: 2,
      paddingHorizontal: 7,
      borderRadius: theme.radius.pill,
    },
    cardTagBolinha: { width: 6, height: 6, borderRadius: 3 },
    // Cor padrão (sem tag) continua neutra — a versão colorida é
    // aplicada por cima, inline, só quando o evento tem tag de verdade.
    cardTagTexto: { ...theme.typography.caption, color: theme.colors.textMuted },
    cardDias: { ...theme.typography.caption, color: theme.colors.textSecondary },
    cardDiasUrgente: { color: theme.colors.urgent, fontFamily: theme.typography.bodyMedium.fontFamily },
    // MUDANÇA (item 5): as duas ações de swipe (fixar + apagar) lado a
    // lado, mesmo espaçamento/raio que "apagar" já usava sozinho.
    acoesSwipeRow: { flexDirection: 'row', gap: theme.spacing.sm - 4 },
    acaoFixar: {
      width: 64,
      borderRadius: theme.radius.lg,
      marginBottom: theme.spacing.sm + 2,
      marginLeft: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acaoApagar: {
      width: 64,
      borderRadius: theme.radius.lg,
      marginBottom: theme.spacing.sm + 2,
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
