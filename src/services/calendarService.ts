// Ponte com a agenda nativa do dispositivo (expo-calendar). Os eventos em
// si moram na agenda nativa, não no banco local — o app só guarda
// referência (nativeEventId) e metadados extras (tags).
import * as Calendar from 'expo-calendar';
import { NovoEvento, Recorrencia } from '../types/event';
import { proximaOcorrencia } from './eventParser/dataUnica';
import { proximaOcorrenciaDoDiaDoMes } from './eventParser/recorrencia';

const NOME_CALENDARIO_APP = 'Meus Eventos (App)';

// Lido do dispositivo em vez de hardcoded: evita eventos criados com o
// horário "errado" na prática se o app rodar num fuso diferente do
// original (troca de aparelho, viagem com fuso do sistema mudado, etc).
// `expo-calendar` interpreta `startDate`/`endDate` neste fuso, não no
// fuso atual do aparelho, então precisa refletir o fuso real de quem usa.
function fusoHorarioDoDispositivo(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// A agenda nativa guarda a primeira ocorrência de um evento recorrente;
// pra exibir no Dashboard a próxima ocorrência a partir de agora, tem que
// recalcular manualmente aqui.
function calcularProximaOcorrencia(recorrencia: Recorrencia, dataOriginal: Date, agora: Date): Date {
  const comHorarioOriginal = (data: Date): Date => {
    const combinada = new Date(data);
    combinada.setHours(
      dataOriginal.getHours(),
      dataOriginal.getMinutes(),
      dataOriginal.getSeconds(),
      0
    );
    return combinada;
  };

  if (recorrencia.frequencia === 'diaria') {
    const candidato = comHorarioOriginal(agora);
    if (candidato.getTime() < agora.getTime()) {
      candidato.setDate(candidato.getDate() + 1);
    }
    return candidato;
  }

  if (recorrencia.frequencia === 'semanal') {
    const diaAlvo = recorrencia.diaSemana ?? dataOriginal.getDay();
    const candidato = comHorarioOriginal(proximaOcorrencia(agora, diaAlvo));
    if (candidato.getTime() < agora.getTime()) {
      candidato.setDate(candidato.getDate() + 7);
    }
    return candidato;
  }

  const diaAlvo = recorrencia.diaDoMes ?? dataOriginal.getDate();
  const candidato = comHorarioOriginal(proximaOcorrenciaDoDiaDoMes(agora, diaAlvo));
  if (candidato.getTime() < agora.getTime()) {
    candidato.setMonth(candidato.getMonth() + 1);
  }
  return candidato;
}

export async function pedirPermissao(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export async function obterStatusPermissao(): Promise<Calendar.PermissionStatus> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status;
}

// O app cria e usa seu próprio calendário local (não mistura eventos
// criados por ele com outros calendários já existentes no dispositivo).
async function getOrCreateCalendarId(): Promise<string> {
  const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existente = calendarios.find((c) => c.title === NOME_CALENDARIO_APP);
  if (existente) return existente.id;

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

function calcularJanelaDoEvento(evento: NovoEvento): {
  startDate: Date;
  endDate: Date;
  allDay: boolean;
} {
  if (evento.diaInteiro) {
    // A agenda nativa trata `endDate` de evento de dia inteiro como
    // exclusivo (o dia seguinte ao último dia do evento), por isso +1.
    const inicioDia = new Date(evento.data.getFullYear(), evento.data.getMonth(), evento.data.getDate());
    const ultimoDia = evento.dataFimDiaInteiro ?? evento.data;
    const fimExclusivo = new Date(ultimoDia.getFullYear(), ultimoDia.getMonth(), ultimoDia.getDate() + 1);
    return { startDate: inicioDia, endDate: fimExclusivo, allDay: true };
  }

  const duracaoMinutos = evento.duracaoMinutos ?? 60;
  const fimEvento = new Date(evento.data.getTime() + duracaoMinutos * 60 * 1000);
  return { startDate: evento.data, endDate: fimEvento, allDay: false };
}

// `null` significa "sem alarme" (escolha explícita do usuário);
// `undefined` usa o padrão de 30 minutos.
function calcularAlarms(evento: NovoEvento): { relativeOffset: number }[] {
  if (evento.antecedenciaAlarmeMinutos === null) return [];
  const antecedencia = evento.antecedenciaAlarmeMinutos ?? 30;
  return [{ relativeOffset: -antecedencia }];
}

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

export interface OpcoesOcorrencia {
  instanceStartDate: Date;
  futureEvents: boolean;
}

export async function criarEventoNaAgenda(evento: NovoEvento): Promise<string> {
  const calendarId = await getOrCreateCalendarId();
  const { startDate, endDate, allDay } = calcularJanelaDoEvento(evento);

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: evento.titulo,
    notes: evento.descricao,
    startDate,
    endDate,
    allDay,
    timeZone: fusoHorarioDoDispositivo(),
    alarms: calcularAlarms(evento),
    recurrenceRule: mapearRecorrenciaParaRegra(evento.recorrencia, undefined),
  });

  return eventId;
}

export interface DadosEventoNativo {
  titulo: string;
  data: Date;
  descricao?: string;
  recorrente: boolean;
  recorrencia: Recorrencia | null;
}

// Reconstrói a recorrência a partir da regra nativa (a agenda não devolve
// os campos no mesmo formato que o app usa internamente) e calcula a
// próxima ocorrência a exibir. Extraído como helper puro pra ser
// reaproveitado tanto na busca de um evento só quanto na busca em lote.
function mapearEventoNativo(evento: Calendar.Event): DadosEventoNativo {
  let recorrencia: Recorrencia | null = null;
  const regra = evento.recurrenceRule;
  if (regra?.frequency === Calendar.Frequency.DAILY) {
    recorrencia = { frequencia: 'diaria' };
  } else if (regra?.frequency === Calendar.Frequency.WEEKLY) {
    recorrencia = { frequencia: 'semanal', diaSemana: new Date(evento.startDate).getDay() };
  } else if (regra?.frequency === Calendar.Frequency.MONTHLY) {
    recorrencia = { frequencia: 'mensal', diaDoMes: new Date(evento.startDate).getDate() };
  }

  const dataOriginal = new Date(evento.startDate);
  const dataExibicao = recorrencia
    ? calcularProximaOcorrencia(recorrencia, dataOriginal, new Date())
    : dataOriginal;

  return {
    titulo: evento.title,
    data: dataExibicao,
    descricao: evento.notes ?? undefined,
    recorrente: !!regra,
    recorrencia,
  };
}

export async function buscarEventoDaAgenda(nativeEventId: string): Promise<DadosEventoNativo | null> {
  try {
    const evento = await Calendar.getEventAsync(nativeEventId);
    return mapearEventoNativo(evento);
  } catch {
    return null;
  }
}

// Busca vários eventos de uma vez com UMA chamada nativa (`getEventsAsync`
// aceita um intervalo de datas, não uma lista de IDs — por isso a janela
// larga abaixo), em vez de uma chamada nativa por evento. Isso é o que
// torna o carregamento do Dashboard rápido mesmo com muitos eventos
// salvos: antes eram N idas e voltas pra camada nativa (uma por evento,
// em lotes de 15 só pra não travar a UI); agora é uma chamada só.
//
// Janela de -2 a +3 anos: cobre folgadamente o que o parser de texto
// livre e os campos de data manual permitem criar na prática. Pro raro
// evento fora dessa janela (ex: um `fixado` bem antigo, ou uma data
// digitada manualmente bem distante), cai no fallback de buscar
// individualmente só os que não apareceram no lote — sem quebrar nada,
// só sem o ganho de performance pra esse caso pontual.
export async function buscarEventosDaAgendaEmLote(
  nativeEventIds: string[]
): Promise<Map<string, DadosEventoNativo>> {
  const resultado = new Map<string, DadosEventoNativo>();
  if (nativeEventIds.length === 0) return resultado;

  const calendarId = await getOrCreateCalendarId();
  const agora = new Date();
  const janelaInicio = new Date(agora.getFullYear() - 2, agora.getMonth(), agora.getDate());
  const janelaFim = new Date(agora.getFullYear() + 3, agora.getMonth(), agora.getDate());

  const idsRestantes = new Set(nativeEventIds);
  try {
    const eventos = await Calendar.getEventsAsync([calendarId], janelaInicio, janelaFim);
    for (const evento of eventos) {
      if (idsRestantes.has(evento.id)) {
        resultado.set(evento.id, mapearEventoNativo(evento));
        idsRestantes.delete(evento.id);
      }
    }
  } catch (erro) {
    // Se a busca em lote falhar por completo (ex: permissão perdida no
    // meio do caminho), cai pro fallback abaixo pra cada ID — mantém a
    // tela funcional em vez de derrubar o carregamento inteiro.
    console.error('Erro ao buscar eventos em lote, tentando individualmente:', erro);
  }

  // Fallback só pros que não vieram no lote (fora da janela, ou a busca
  // em lote falhou por completo).
  await Promise.all(
    Array.from(idsRestantes).map(async (id) => {
      const dados = await buscarEventoDaAgenda(id);
      if (dados) resultado.set(id, dados);
    })
  );

  return resultado;
}

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
    timeZone: fusoHorarioDoDispositivo(),
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

export interface CalendarioDisponivel {
  id: string;
  titulo: string;
  cor: string;
}

export async function listarCalendariosDisponiveisParaSync(): Promise<CalendarioDisponivel[]> {
  const calendarios = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendarios
    .filter((c) => c.allowsModifications && c.title !== NOME_CALENDARIO_APP)
    .map((c) => ({ id: c.id, titulo: c.title, cor: c.color }));
}

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

// Janela de +/- 1 ano: a API nativa exige um intervalo de datas, então
// usamos uma janela ampla o suficiente pra cobrir os eventos relevantes.
export async function buscarNativeEventIdsDoCalendario(calendarId: string): Promise<Set<string>> {
  const umAnoAtras = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const umAnoNoFuturo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const eventos = await Calendar.getEventsAsync([calendarId], umAnoAtras, umAnoNoFuturo);
  return new Set(eventos.map((e) => e.id));
}
