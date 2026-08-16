// Orquestração pura de "salvar intervalo": cria o evento de início, cria
// o evento de fim, e se o segundo falhar desfaz o primeiro (rollback) —
// pra nunca deixar um evento órfão na agenda nativa. Recebe as operações
// como parâmetros em vez de importá-las direto, o que permite testar a
// decisão (o "quando fazer rollback e como") sem mockar nenhuma
// biblioteca externa.
import type { NovoEvento } from '../../../types/event';

export type OperacoesSalvarIntervalo = {
  criarEventoNaAgenda: (evento: NovoEvento) => Promise<string>;
  salvarRegistro: (nativeEventId: string, tags: string[]) => number;
  apagarEventoDaAgenda: (nativeEventId: string) => Promise<void>;
  apagarRegistro: (id: number) => void;
};

export type ResultadoSalvarIntervalo =
  | { ok: true }
  | { ok: false; erro: unknown };

export async function salvarIntervaloComRollback(
  eventoInicio: NovoEvento,
  eventoFim: NovoEvento,
  tagsFinal: string[],
  operacoes: OperacoesSalvarIntervalo
): Promise<ResultadoSalvarIntervalo> {
  const idInicio = await operacoes.criarEventoNaAgenda(eventoInicio);
  const registroIdInicio = operacoes.salvarRegistro(idInicio, tagsFinal);

  // Se o segundo evento ("Prazo final") falhar, desfaz o primeiro em vez
  // de deixar um evento órfão: ou os dois entram, ou nenhum.
  try {
    const idFim = await operacoes.criarEventoNaAgenda(eventoFim);
    operacoes.salvarRegistro(idFim, tagsFinal);
  } catch (erroSegundoEvento) {
    try {
      await operacoes.apagarEventoDaAgenda(idInicio);
    } catch (erroRollback) {
      // Mesmo se a reversão falhar (ex: perdeu a permissão nesse
      // meio-tempo), segue pro retorno de erro abaixo — mas o registro
      // local ainda precisa ser limpo, senão sobra um registro apontando
      // pra um evento que o app não sabe mais se existe de verdade.
      console.error('Erro ao reverter evento de início após falha no evento de fim:', erroRollback);
    }
    operacoes.apagarRegistro(registroIdInicio);
    return { ok: false, erro: erroSegundoEvento };
  }

  return { ok: true };
}
