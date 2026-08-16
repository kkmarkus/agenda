import { salvarIntervaloComRollback, OperacoesSalvarIntervalo } from './salvarIntervaloComRollback';
import type { NovoEvento } from '../../../types/event';

const eventoInicio: NovoEvento = {
  titulo: 'Início: Viagem',
  data: new Date('2026-03-10T09:00:00'),
  tags: ['pessoal'],
};

const eventoFim: NovoEvento = {
  titulo: 'Prazo final: Viagem',
  data: new Date('2026-03-15T18:00:00'),
  tags: ['pessoal'],
};

const tagsFinal = ['pessoal'];

// Monta um conjunto de operações fake determinísticas, registrando a
// ordem das chamadas num array — sem jest.fn(), sem mock de módulo.
function criarOperacoesFake(overrides: Partial<{
  criarEventoFalha: 'inicio' | 'fim' | null;
  rollbackFalha: boolean;
}> = {}) {
  const { criarEventoFalha = null, rollbackFalha = false } = overrides;
  const chamadas: string[] = [];
  let proximoNativeId = 1;
  let proximoRegistroId = 1;

  const operacoes: OperacoesSalvarIntervalo = {
    criarEventoNaAgenda: async (evento) => {
      const ehEventoDeInicio = evento.titulo === eventoInicio.titulo;
      if (
        (ehEventoDeInicio && criarEventoFalha === 'inicio') ||
        (!ehEventoDeInicio && criarEventoFalha === 'fim')
      ) {
        chamadas.push(`criarEventoNaAgenda(${evento.titulo}) -> falha`);
        throw new Error(`falha ao criar: ${evento.titulo}`);
      }
      chamadas.push(`criarEventoNaAgenda(${evento.titulo})`);
      return `native-${proximoNativeId++}`;
    },
    salvarRegistro: (nativeEventId) => {
      chamadas.push(`salvarRegistro(${nativeEventId})`);
      return proximoRegistroId++;
    },
    apagarEventoDaAgenda: async (nativeEventId) => {
      if (rollbackFalha) {
        chamadas.push(`apagarEventoDaAgenda(${nativeEventId}) -> falha`);
        throw new Error('perdeu a permissão durante o rollback');
      }
      chamadas.push(`apagarEventoDaAgenda(${nativeEventId})`);
    },
    apagarRegistro: (id) => {
      chamadas.push(`apagarRegistro(${id})`);
    },
  };

  return { operacoes, chamadas };
}

describe('salvarIntervaloComRollback', () => {
  it('caminho feliz: os dois eventos são criados e retorna ok', async () => {
    const { operacoes, chamadas } = criarOperacoesFake();

    const resultado = await salvarIntervaloComRollback(eventoInicio, eventoFim, tagsFinal, operacoes);

    expect(resultado).toEqual({ ok: true });
    expect(chamadas).toEqual([
      'criarEventoNaAgenda(Início: Viagem)',
      'salvarRegistro(native-1)',
      'criarEventoNaAgenda(Prazo final: Viagem)',
      'salvarRegistro(native-2)',
    ]);
  });

  it('segundo evento falha: o primeiro é revertido (rollback) e retorna erro', async () => {
    const { operacoes, chamadas } = criarOperacoesFake({ criarEventoFalha: 'fim' });

    const resultado = await salvarIntervaloComRollback(eventoInicio, eventoFim, tagsFinal, operacoes);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toBeInstanceOf(Error);
      expect((resultado.erro as Error).message).toContain('Prazo final: Viagem');
    }

    // O evento de início criado foi apagado da agenda e o registro local
    // também foi limpo — nenhum evento órfão fica pra trás.
    expect(chamadas).toEqual([
      'criarEventoNaAgenda(Início: Viagem)',
      'salvarRegistro(native-1)',
      'criarEventoNaAgenda(Prazo final: Viagem) -> falha',
      'apagarEventoDaAgenda(native-1)',
      'apagarRegistro(1)',
    ]);
  });

  it('segundo evento falha E o rollback do primeiro também falha: ainda assim retorna erro, sem lançar, e limpa o registro local', async () => {
    const { operacoes, chamadas } = criarOperacoesFake({ criarEventoFalha: 'fim', rollbackFalha: true });

    // Não deve lançar erro pra fora mesmo com o rollback nativo falhando.
    const resultado = await salvarIntervaloComRollback(eventoInicio, eventoFim, tagsFinal, operacoes);

    expect(resultado.ok).toBe(false);

    // Mesmo com apagarEventoDaAgenda falhando, apagarRegistro (local)
    // ainda foi chamado — esse é o comportamento documentado no código
    // original: não deixar o registro local órfão mesmo que o rollback
    // nativo não tenha ido até o fim.
    expect(chamadas).toEqual([
      'criarEventoNaAgenda(Início: Viagem)',
      'salvarRegistro(native-1)',
      'criarEventoNaAgenda(Prazo final: Viagem) -> falha',
      'apagarEventoDaAgenda(native-1) -> falha',
      'apagarRegistro(1)',
    ]);
  });

  it('confirma a ordem das chamadas no caminho feliz: início -> salvarRegistro -> fim', async () => {
    const { operacoes, chamadas } = criarOperacoesFake();

    await salvarIntervaloComRollback(eventoInicio, eventoFim, tagsFinal, operacoes);

    const ordemRelevante = chamadas.filter((c) => c.startsWith('criarEventoNaAgenda') || c.startsWith('salvarRegistro'));
    expect(ordemRelevante).toEqual([
      'criarEventoNaAgenda(Início: Viagem)',
      'salvarRegistro(native-1)',
      'criarEventoNaAgenda(Prazo final: Viagem)',
      'salvarRegistro(native-2)',
    ]);
  });
});
