import * as Calendar from 'expo-calendar';
import { NovoEvento, Recorrencia } from '../types/event';

const NOME_CALENDARIO_APP = 'Meus Eventos (App)';

/**
 * Pede permissão de acesso à agenda do sistema.
 * Precisa ser chamado antes de qualquer outra função aqui.
 */
export async function pedirPermissao(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Checa o status atual da permissão de agenda SEM pedir de novo — usado
 * pelo SettingsDrawer (item 8.2) só pra mostrar o estado atual. Depois de
 * negada uma vez, o Android não deixa mais o app pedir programaticamente
 * de novo (`requestCalendarPermissionsAsync` volta 'denied' direto, sem
 * mostrar diálogo nenhum), então a única saída pra ela reverter é abrir as
 * configurações do app manualmente — ver `Linking.openSettings()` no
 * SettingsDrawer.
 */
export async function obterStatusPermissao(): Promise<Calendar.PermissionStatus> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status;
}

/**
 * Procura um calendário local dedicado ao app. Se não existir, cria um.
 *
 * Por quê um calendário próprio, e não usar o "Pessoal" do Google direto?
 * Porque assim os eventos do app ficam isolados visualmente na agenda dela
 * (cor própria, fácil de identificar), sem se misturar com o resto da
 * rotina, e sem risco de mexer sem querer no calendário principal dela.
 */
async function getOrCreateCalendarId(): Promise<string> {
  const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existente = calendarios.find((c) => c.title === NOME_CALENDARIO_APP);
  if (existente) return existente.id;

  // CORREÇÃO: a versão anterior tentava reaproveitar a "source" de um
  // calendário existente (ex: conta Google) e montava um sourceId a partir
  // dela, mas caía num fallback `{ isLocalAccount: true, ... }` sem `id` —
  // ou seja, `sourceId: (defaultSource as any).id` virava `undefined` sempre
  // que o aparelho não tinha nenhum calendário OWNER (comum logo após só
  // conceder a permissão), quebrando a criação do calendário no Android.
  //
  // Como o app é Android-only, seguimos o padrão recomendado pela própria
  // documentação do expo-calendar para Android: usar isLocalAccount e não
  // depender de nenhuma conta externa (o campo `type: SourceType.LOCAL` é
  // exigido pela tipagem do pacote, mas ignorado pelo Android nesse caso).
  // Isso evita esse ponto de falha.
  const novoId = await Calendar.createCalendarAsync({
    title: NOME_CALENDARIO_APP,
    color: '#378ADD',
    entityType: Calendar.EntityTypes.EVENT,
    source: { isLocalAccount: true, name: NOME_CALENDARIO_APP, type: Calendar.SourceType.LOCAL },
    name: NOME_CALENDARIO_APP,
    ownerAccount: 'local',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  return novoId;
}

/**
 * Calcula `startDate`/`endDate`/`allDay` a partir das preferências do
 * evento (item 1). Centralizado aqui porque criar e atualizar precisam do
 * mesmo cálculo, e porque a regra de eventos "dia inteiro" tem uma
 * pegadinha que não pode ficar espalhada em dois lugares (ver comentário
 * abaixo).
 */
function calcularJanelaDoEvento(evento: NovoEvento): {
  startDate: Date;
  endDate: Date;
  allDay: boolean;
} {
  if (evento.diaInteiro) {
    // Eventos "dia inteiro" no Android CalendarProvider usam datas sem
    // horário, e o endDate é EXCLUSIVO: um evento de um dia só (dia X)
    // precisa de endDate = início do dia X+1, senão o próprio dia X não
    // aparece marcado como dia inteiro na agenda nativa. Por isso zeramos
    // o horário do início e sempre somamos +1 dia no fim, mesmo quando
    // dataFimDiaInteiro não foi informado (evento de um dia só).
    const inicioDia = new Date(evento.data.getFullYear(), evento.data.getMonth(), evento.data.getDate());
    const ultimoDia = evento.dataFimDiaInteiro ?? evento.data;
    const fimExclusivo = new Date(ultimoDia.getFullYear(), ultimoDia.getMonth(), ultimoDia.getDate() + 1);
    return { startDate: inicioDia, endDate: fimExclusivo, allDay: true };
  }

  const duracaoMinutos = evento.duracaoMinutos ?? 60;
  const fimEvento = new Date(evento.data.getTime() + duracaoMinutos * 60 * 1000);
  return { startDate: evento.data, endDate: fimEvento, allDay: false };
}

/**
 * Calcula a lista de alarmes do `expo-calendar` a partir da antecedência
 * escolhida. `null` explícito é "Sem alarme" (lista vazia — o expo-calendar
 * não cria nenhum lembrete); `undefined` cai no padrão de 30 min antes.
 */
function calcularAlarms(evento: NovoEvento): { relativeOffset: number }[] {
  if (evento.antecedenciaAlarmeMinutos === null) return [];
  const antecedencia = evento.antecedenciaAlarmeMinutos ?? 30;
  return [{ relativeOffset: -antecedencia }];
}

/**
 * Mapeia a recorrência extraída/escolhida (item 2) pro formato
 * `recurrenceRule` do expo-calendar. Sem data de término explícita no
 * texto original (o parser nunca preenche uma sozinho — ver
 * eventParser.ts), a regra fica sem `endDate`, ou seja, recorrência
 * INDEFINIDA. Isso é editável manualmente na tela de confirmação (campo
 * de término opcional), mas o padrão é "repete pra sempre" porque é o caso
 * mais comum do jeito que ela fala ("academia toda terça" não costuma vir
 * com uma data de fim em mente).
 */
function mapearRecorrenciaParaRegra(
  recorrencia: NovoEvento['recorrencia'],
  dataTermino: Date | undefined
): Calendar.RecurrenceRule | undefined {
  if (!recorrencia) return undefined;

  const frequencia =
    recorrencia.frequencia === 'diaria'
      ? Calendar.Frequency.DAILY
      : recorrencia.frequencia === 'semanal'
      ? Calendar.Frequency.WEEKLY
      : Calendar.Frequency.MONTHLY;

  return {
    frequency: frequencia,
    interval: 1,
    ...(dataTermino ? { endDate: dataTermino } : {}),
  };
}

/**
 * Opções pra mirar numa OCORRÊNCIA específica de um evento recorrente, em
 * vez da série inteira — usadas em `atualizarEventoNaAgenda` e
 * `apagarEventoDaAgenda` quando ela escolhe "Somente este evento" ou "Este
 * e os futuros" (ver ConfirmDialog em DashboardScreen). `instanceStartDate`
 * precisa ser o horário de início exato da ocorrência que está sendo
 * editada/apagada (o `data` do EventoApp carregado, não a data-base da
 * série). Sem recorrência envolvida, essas opções ficam de fora e o
 * expo-calendar trata a chamada como um evento comum.
 *
 * ATENÇÃO: o comportamento exato de "este e os futuros" no Android varia
 * conforme o app de agenda que fornece o provider (Google Calendar,
 * calendário local, etc.) — validar no aparelho antes de confiar 100%
 * nessa distinção.
 */
export interface OpcoesOcorrencia {
  instanceStartDate: Date;
  futureEvents: boolean;
}

/**
 * Cria o evento na agenda nativa, com alarme, e devolve o id do evento
 * (é esse id que guardamos no banco local junto com a tag).
 */
export async function criarEventoNaAgenda(evento: NovoEvento): Promise<string> {
  const calendarId = await getOrCreateCalendarId();
  const { startDate, endDate, allDay } = calcularJanelaDoEvento(evento);

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: evento.titulo,
    notes: evento.descricao,
    startDate,
    endDate,
    allDay,
    timeZone: 'America/Fortaleza', // fuso de Teresina-PI
    alarms: calcularAlarms(evento),
    recurrenceRule: mapearRecorrenciaParaRegra(evento.recorrencia, undefined),
  });

  return eventId;
}

/**
 * Busca os dados atuais de um evento direto na agenda nativa.
 * Retorna null se o evento não existe mais (ex: ela apagou pelo Google Calendar) —
 * é assim que o app detecta e limpa eventos "fantasma" do dashboard.
 */
export async function buscarEventoDaAgenda(nativeEventId: string) {
  try {
    const evento = await Calendar.getEventAsync(nativeEventId);

    // MUDANÇA (item 2): traduz o recurrenceRule nativo de volta pro nosso
    // formato de Recorrencia, só pra pré-selecionar o seletor certo ao
    // abrir um evento recorrente pra editar — não tenta reconstruir regras
    // mais elaboradas (ex: intervalo > 1, YEARLY), já que o app nunca cria
    // esse tipo de regra por aqui; nesses casos cai em `null` e ela edita
    // como se fosse um evento comum, sem perder o resto dos dados.
    let recorrencia: Recorrencia | null = null;
    const regra = evento.recurrenceRule;
    if (regra?.frequency === Calendar.Frequency.DAILY) {
      recorrencia = { frequencia: 'diaria' };
    } else if (regra?.frequency === Calendar.Frequency.WEEKLY) {
      recorrencia = { frequencia: 'semanal', diaSemana: new Date(evento.startDate).getDay() };
    } else if (regra?.frequency === Calendar.Frequency.MONTHLY) {
      recorrencia = { frequencia: 'mensal', diaDoMes: new Date(evento.startDate).getDate() };
    }

    return {
      titulo: evento.title,
      data: new Date(evento.startDate),
      descricao: evento.notes ?? undefined,
      // MUDANÇA (item 2): usado pelo Dashboard pra decidir se, ao editar ou
      // apagar, precisa perguntar "Somente este evento" ou "Este e os
      // futuros" (só faz sentido perguntar isso pra um evento que se repete).
      recorrente: !!regra,
      recorrencia,
    };
  } catch {
    return null;
  }
}

/**
 * Apaga o evento da agenda nativa. Deve sempre ser chamado junto com a
 * remoção da linha correspondente no banco local (ver database.ts),
 * senão o alarme nativo continua ativo para um evento que sumiu do app.
 */
export async function apagarEventoDaAgenda(
  nativeEventId: string,
  opcoesOcorrencia?: OpcoesOcorrencia
): Promise<void> {
  if (opcoesOcorrencia) {
    await Calendar.deleteEventAsync(nativeEventId, {
      instanceStartDate: opcoesOcorrencia.instanceStartDate,
      futureEvents: opcoesOcorrencia.futureEvents,
    });
    return;
  }
  await Calendar.deleteEventAsync(nativeEventId);
}

/**
 * Atualiza um evento já existente na agenda nativa (usado no fluxo de edição).
 *
 * CORREÇÃO (item 1): antes o alarme e a duração eram sempre reescritos como
 * 30min/1h fixos, mesmo que o evento tivesse sido criado com outros valores
 * — ou seja, editar qualquer coisa (até só o título) silenciosamente
 * resetava a duração/alarme personalizados dela. Agora os dois vêm de
 * `evento`, igual em `criarEventoNaAgenda`. Continua valendo a limitação de
 * que a agenda nativa não expõe o alarme/duração atuais de volta pra gente:
 * é responsabilidade de quem chama (ConfirmScreen) reenviar os valores
 * corretos em modo edição, já que não há como "ler antes de escrever" aqui.
 */
export async function atualizarEventoNaAgenda(
  nativeEventId: string,
  evento: NovoEvento,
  opcoesOcorrencia?: OpcoesOcorrencia
): Promise<void> {
  const { startDate, endDate, allDay } = calcularJanelaDoEvento(evento);

  const detalhes = {
    title: evento.titulo,
    notes: evento.descricao,
    startDate,
    endDate,
    allDay,
    timeZone: 'America/Fortaleza',
    alarms: calcularAlarms(evento),
    recurrenceRule: mapearRecorrenciaParaRegra(evento.recorrencia, undefined),
  };

  if (opcoesOcorrencia) {
    await Calendar.updateEventAsync(nativeEventId, detalhes, {
      instanceStartDate: opcoesOcorrencia.instanceStartDate,
      futureEvents: opcoesOcorrencia.futureEvents,
    });
    return;
  }
  await Calendar.updateEventAsync(nativeEventId, detalhes);
}

// --- Sincronização com outros calendários nativos ---
// Permite importar automaticamente eventos que ela já tem em outros
// calendários do aparelho (o pessoal, o do trabalho, etc.) pro dashboard
// do app, sem precisar recriar cada um manualmente por texto livre.

export interface CalendarioDisponivel {
  id: string;
  titulo: string;
  cor: string;
}

/**
 * Lista os calendários do aparelho que fazem sentido oferecer como fonte
 * de sincronização: só os editáveis pela própria usuária (`allowsModifications`),
 * o que já exclui calendários automáticos e somente-leitura como
 * "Aniversários" e "Feriados" — importar esses geraria uma enxurrada de
 * eventos que não são "compromissos" de verdade. Também excluímos o
 * calendário do próprio app ("Meus Eventos (App)"), senão ele tentaria se
 * auto-sincronizar e duplicar tudo que ela cria por aqui.
 */
export async function listarCalendariosDisponiveisParaSync(): Promise<CalendarioDisponivel[]> {
  const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendarios
    .filter((c) => c.allowsModifications && c.title !== NOME_CALENDARIO_APP)
    .map((c) => ({ id: c.id, titulo: c.title, cor: c.color }));
}

/**
 * Busca eventos futuros (a partir de agora — nunca eventos passados, que
 * não interessam pro dashboard) nos calendários selecionados, dentro de
 * uma janela de `diasNoFuturo` dias.
 *
 * Por que polling em vez de um listener em tempo real: o Android/expo-calendar
 * não expõe um jeito confiável de "escutar" mudanças na agenda nativa feitas
 * por fora do app (ex: um evento criado direto no Google Calendar). Chamar
 * isso no foco do Dashboard (useFocusEffect) é o padrão mais simples e
 * robusto disponível, ainda que não seja instantâneo.
 */
export async function buscarEventosFuturosDeCalendarios(
  calendarIds: string[],
  diasNoFuturo: number
): Promise<{ nativeEventId: string; titulo: string; data: Date }[]> {
  if (calendarIds.length === 0) return [];

  const agora = new Date();
  const limite = new Date(agora.getTime() + diasNoFuturo * 24 * 60 * 60 * 1000);

  const eventos = await Calendar.getEventsAsync(calendarIds, agora, limite);
  return eventos.map((e) => ({
    nativeEventId: e.id,
    titulo: e.title,
    data: new Date(e.startDate),
  }));
}

/**
 * MUDANÇA (9.4): ids nativos de tudo que está hoje num calendário
 * específico — usado ao desativar a sincronização desse calendário, pra
 * descobrir quais registros locais vieram dele (ver
 * CalendarSyncPanelContent). Janela de ±365 dias (passado E futuro,
 * diferente de `buscarEventosFuturosDeCalendarios`, que só olha pra
 * frente): por essa altura um evento importado como "futuro" pode já ter
 * virado passado, e ainda precisa ser encontrado pra oferecer a remoção.
 */
export async function buscarNativeEventIdsDoCalendario(calendarId: string): Promise<Set<string>> {
  const umAnoAtras = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const umAnoNoFuturo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const eventos = await Calendar.getEventsAsync([calendarId], umAnoAtras, umAnoNoFuturo);
  return new Set(eventos.map((e) => e.id));
}
