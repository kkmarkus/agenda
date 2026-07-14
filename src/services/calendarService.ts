import * as Calendar from 'expo-calendar';
import { NovoEvento } from '../types/event';

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

  const defaultSource =
    calendarios.find((c) => c.source && c.accessLevel === Calendar.CalendarAccessLevel.OWNER)
      ?.source ?? { isLocalAccount: true, name: 'Local', type: 'LOCAL' };

  const novoId = await Calendar.createCalendarAsync({
    title: NOME_CALENDARIO_APP,
    color: '#378ADD',
    entityType: Calendar.EntityTypes.EVENT,
    source: defaultSource,
    sourceId: (defaultSource as any).id,
    name: NOME_CALENDARIO_APP,
    ownerAccount: 'local',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  return novoId;
}

/**
 * Cria o evento na agenda nativa, com alarme, e devolve o id do evento
 * (é esse id que guardamos no banco local junto com a tag).
 */
export async function criarEventoNaAgenda(evento: NovoEvento): Promise<string> {
  const calendarId = await getOrCreateCalendarId();

  const fimEvento = new Date(evento.data.getTime() + 60 * 60 * 1000); // 1h de duração padrão

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: evento.titulo,
    notes: evento.descricao,
    startDate: evento.data,
    endDate: fimEvento,
    timeZone: 'America/Fortaleza', // fuso de Teresina-PI
    alarms: [{ relativeOffset: -30 }], // alerta 30 min antes
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
    return {
      titulo: evento.title,
      data: new Date(evento.startDate),
      descricao: evento.notes ?? undefined,
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
export async function apagarEventoDaAgenda(nativeEventId: string): Promise<void> {
  await Calendar.deleteEventAsync(nativeEventId);
}
