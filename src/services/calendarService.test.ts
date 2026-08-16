// Mocka só o módulo `expo-calendar` (não `calendarService.ts` inteiro):
// a lógica de mesclagem lote+fallback é a coisa de verdade sendo testada,
// só as chamadas nativas (`getCalendarsAsync`/`getEventsAsync`/
// `getEventAsync`) são fakes. Opção mais simples que injeção de
// dependência pra esse caso — a assinatura de produção não precisa
// mudar.
import * as Calendar from 'expo-calendar';
import { buscarEventosDaAgendaEmLote } from './calendarService';

jest.mock('expo-calendar', () => ({
  getCalendarsAsync: jest.fn(),
  createCalendarAsync: jest.fn(),
  getEventsAsync: jest.fn(),
  getEventAsync: jest.fn(),
  EntityTypes: { EVENT: 'event' },
  SourceType: { LOCAL: 'local' },
  CalendarAccessLevel: { OWNER: 'owner' },
  Frequency: { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly' },
}));

const CALENDAR_ID = 'calendario-app-fake';

// O app sempre resolve pra esse único calendário próprio — o mock de
// `getCalendarsAsync` já devolve ele existente, então `createCalendarAsync`
// nunca precisa ser chamado nestes testes.
function configurarCalendarioExistente() {
  (Calendar.getCalendarsAsync as jest.Mock).mockResolvedValue([
    { id: CALENDAR_ID, title: 'Meus Eventos (App)' },
  ]);
}

function eventoNativoFake(id: string, titulo: string) {
  return {
    id,
    title: titulo,
    notes: undefined,
    startDate: new Date('2026-03-10T10:00:00').toISOString(),
    recurrenceRule: undefined,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  configurarCalendarioExistente();
});

describe('buscarEventosDaAgendaEmLote', () => {
  it('lista vazia: retorna mapa vazio sem chamar a agenda nativa', async () => {
    const resultado = await buscarEventosDaAgendaEmLote([]);

    expect(resultado.size).toBe(0);
    expect(Calendar.getCalendarsAsync).not.toHaveBeenCalled();
    expect(Calendar.getEventsAsync).not.toHaveBeenCalled();
  });

  it('caminho feliz: os dois eventos vêm na busca em lote, sem precisar de fallback', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([
      eventoNativoFake('id-1', 'Reunião'),
      eventoNativoFake('id-2', 'Consulta'),
    ]);

    const resultado = await buscarEventosDaAgendaEmLote(['id-1', 'id-2']);

    expect(resultado.size).toBe(2);
    expect(resultado.get('id-1')?.titulo).toBe('Reunião');
    expect(resultado.get('id-2')?.titulo).toBe('Consulta');
    expect(Calendar.getEventAsync).not.toHaveBeenCalled();
  });

  it('um evento fora da janela do lote: cai no fallback individual só pra esse id', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([eventoNativoFake('id-1', 'Reunião')]);
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue(eventoNativoFake('id-2', 'Evento antigo'));

    const resultado = await buscarEventosDaAgendaEmLote(['id-1', 'id-2']);

    expect(resultado.size).toBe(2);
    expect(resultado.get('id-1')?.titulo).toBe('Reunião');
    expect(resultado.get('id-2')?.titulo).toBe('Evento antigo');
    // Fallback individual só foi chamado pro id que faltou no lote.
    expect(Calendar.getEventAsync).toHaveBeenCalledTimes(1);
    expect(Calendar.getEventAsync).toHaveBeenCalledWith('id-2');
  });

  it('evento apagado direto na agenda: fallback individual falha e o id simplesmente não entra no resultado', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([eventoNativoFake('id-1', 'Reunião')]);
    (Calendar.getEventAsync as jest.Mock).mockRejectedValue(new Error('evento não existe mais'));

    const resultado = await buscarEventosDaAgendaEmLote(['id-1', 'id-2']);

    expect(resultado.size).toBe(1);
    expect(resultado.has('id-1')).toBe(true);
    expect(resultado.has('id-2')).toBe(false);
  });

  it('lote falha inteiro: cai no fallback individual pra todos os ids', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockRejectedValue(new Error('permissão perdida'));
    (Calendar.getEventAsync as jest.Mock).mockImplementation(async (id: string) =>
      eventoNativoFake(id, `Evento ${id}`)
    );

    const resultado = await buscarEventosDaAgendaEmLote(['id-1', 'id-2', 'id-3']);

    expect(resultado.size).toBe(3);
    expect(Calendar.getEventAsync).toHaveBeenCalledTimes(3);
    expect(Calendar.getEventAsync).toHaveBeenCalledWith('id-1');
    expect(Calendar.getEventAsync).toHaveBeenCalledWith('id-2');
    expect(Calendar.getEventAsync).toHaveBeenCalledWith('id-3');
  });

  it('lote falha inteiro e alguns fallbacks individuais também falham: mantém só os que deram certo', async () => {
    (Calendar.getEventsAsync as jest.Mock).mockRejectedValue(new Error('permissão perdida'));
    (Calendar.getEventAsync as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'id-2') throw new Error('evento não existe mais');
      return eventoNativoFake(id, `Evento ${id}`);
    });

    const resultado = await buscarEventosDaAgendaEmLote(['id-1', 'id-2', 'id-3']);

    expect(resultado.size).toBe(2);
    expect(resultado.has('id-1')).toBe(true);
    expect(resultado.has('id-2')).toBe(false);
    expect(resultado.has('id-3')).toBe(true);
  });
});
