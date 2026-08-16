import type { Recorrencia } from '../../types/event';
import { comLimitesDePalavra, removerAcentos } from './normalizacao';
import { DIAS_SEMANA_PADRAO, NOMES_DIAS_SEMANA, proximaOcorrencia } from './dataUnica';

const REGEX_RECORRENCIA_MENSAL_DIA = /todo\s+dia\s+(\d{1,2})(?!\s*[/\d])/i;

const REGEX_RECORRENCIA_SEMANAL_DIA = new RegExp(
  `tod[oa]s?\\s+(?:[oa]s\\s+)?(${DIAS_SEMANA_PADRAO})(-feira)?s?(?![a-zA-ZÀ-ÿ])`,
  'i'
);

const REGEX_RECORRENCIA_DIARIAMENTE = comLimitesDePalavra('diariamente');
const REGEX_RECORRENCIA_MENSAL_GENERICO = /todo\s+m[eê]s/i;
const REGEX_RECORRENCIA_SEMANAL_GENERICO = /toda\s+semana/i;

// "todo dia" sem número atrás: checado por último entre os padrões de
// recorrência, já que só deve sobrar pra essa regra o que não casou com
// nenhum padrão mais específico acima (em especial o mensal por dia).
const REGEX_RECORRENCIA_DIARIA_GENERICA = /(?<![a-zA-ZÀ-ÿ])todo\s+dia(?![a-zA-ZÀ-ÿ0-9])/i;

// Próxima data (a partir de hoje, inclusive) em que cai o dia do mês informado.
export function proximaOcorrenciaDoDiaDoMes(agora: Date, dia: number): Date {
  const candidato = new Date(agora.getFullYear(), agora.getMonth(), dia);
  const hojeSemHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (candidato.getTime() < hojeSemHora.getTime()) {
    candidato.setMonth(candidato.getMonth() + 1);
  }
  return candidato;
}

// Reconhece padrões de recorrência ("todo dia 5", "toda sexta",
// "diariamente" etc). `dataBase` é a primeira ocorrência a partir de
// agora, usada como sugestão inicial no formulário.
export function extrairRecorrencia(
  texto: string,
  agora: Date
): { recorrencia: Recorrencia; trecho: string; dataBase: Date } | null {
  const mensalDia = texto.match(REGEX_RECORRENCIA_MENSAL_DIA);
  if (mensalDia) {
    const dia = Number(mensalDia[1]);
    return {
      recorrencia: { frequencia: 'mensal', diaDoMes: dia },
      trecho: mensalDia[0],
      dataBase: proximaOcorrenciaDoDiaDoMes(agora, dia),
    };
  }

  const semanalDia = texto.match(REGEX_RECORRENCIA_SEMANAL_DIA);
  if (semanalDia) {
    const chaveDia = removerAcentos(semanalDia[1].toLowerCase());
    const diaAlvo = NOMES_DIAS_SEMANA[chaveDia];
    if (diaAlvo !== undefined) {
      return {
        recorrencia: { frequencia: 'semanal', diaSemana: diaAlvo },
        trecho: semanalDia[0],
        dataBase: proximaOcorrencia(agora, diaAlvo),
      };
    }
  }

  const diariamente = texto.match(REGEX_RECORRENCIA_DIARIAMENTE);
  if (diariamente) {
    return { recorrencia: { frequencia: 'diaria' }, trecho: diariamente[0], dataBase: new Date(agora) };
  }

  // "todo mês"/"toda semana" sem dia específico: usa o dia/dia da semana de hoje.
  const mensalGenerico = texto.match(REGEX_RECORRENCIA_MENSAL_GENERICO);
  if (mensalGenerico) {
    return {
      recorrencia: { frequencia: 'mensal', diaDoMes: agora.getDate() },
      trecho: mensalGenerico[0],
      dataBase: new Date(agora),
    };
  }

  const semanalGenerico = texto.match(REGEX_RECORRENCIA_SEMANAL_GENERICO);
  if (semanalGenerico) {
    return {
      recorrencia: { frequencia: 'semanal', diaSemana: agora.getDay() },
      trecho: semanalGenerico[0],
      dataBase: new Date(agora),
    };
  }

  const diariaGenerica = texto.match(REGEX_RECORRENCIA_DIARIA_GENERICA);
  if (diariaGenerica) {
    return { recorrencia: { frequencia: 'diaria' }, trecho: diariaGenerica[0], dataBase: new Date(agora) };
  }

  return null;
}
