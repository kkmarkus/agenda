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

/**
 * Atualiza um evento já existente na agenda nativa (usado no fluxo de edição).
 * Mantém o mesmo alarme padrão de 30 min antes, já que a agenda nativa não
 * expõe o alarme atual de volta pra gente reaproveitar com segurança.
 */
export async function atualizarEventoNaAgenda(
  nativeEventId: string,
  evento: NovoEvento
): Promise<void> {
  const fimEvento = new Date(evento.data.getTime() + 60 * 60 * 1000);

  await Calendar.updateEventAsync(nativeEventId, {
    title: evento.titulo,
    notes: evento.descricao,
    startDate: evento.data,
    endDate: fimEvento,
    timeZone: 'America/Fortaleza',
    alarms: [{ relativeOffset: -30 }],
  });
}
