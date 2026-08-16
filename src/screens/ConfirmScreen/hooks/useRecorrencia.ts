import { useState } from 'react';
import type { NovoEvento, Recorrencia } from '../../../types/event';

export type RecorrenciaOpcao = 'nenhuma' | 'diaria' | 'semanal' | 'mensal';

export function useRecorrencia(recorrenciaInicial: Recorrencia | null | undefined) {
  const [recorrenciaOpcao, setRecorrenciaOpcao] = useState<RecorrenciaOpcao>(
    recorrenciaInicial?.frequencia ?? 'nenhuma'
  );

  // Monta a recorrência a partir da opção escolhida e da data de início:
  // semanal usa o dia da semana da própria data, mensal usa o dia do mês.
  function montarRecorrencia(dataInicio: Date): NovoEvento['recorrencia'] {
    if (recorrenciaOpcao === 'nenhuma') return null;
    if (recorrenciaOpcao === 'diaria') return { frequencia: 'diaria' };
    if (recorrenciaOpcao === 'semanal') return { frequencia: 'semanal', diaSemana: dataInicio.getDay() };
    return { frequencia: 'mensal', diaDoMes: dataInicio.getDate() };
  }

  return { recorrenciaOpcao, setRecorrenciaOpcao, montarRecorrencia };
}
