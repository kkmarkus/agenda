// Parser de texto livre: transforma uma frase digitada em um evento
// estruturado (data, hora, recorrência), tentando reconhecer padrões em
// português. Ordem de tentativa: intervalo de datas > recorrência > data
// única — porque um intervalo/recorrência também "casaria" com as regras
// de data única se checado primeiro.
import type { Recorrencia } from '../../types/event';
import { limparTitulo } from './normalizacao';
import { extrairData } from './dataUnica';
import { extrairIntervalo } from './intervalo';
import { extrairHora } from './hora';
import { extrairRecorrencia } from './recorrencia';
import { REGEX_MARCADOR_LISTA, dividirPorPosicaoDeDatas } from './multiplosEventos';

export interface EventoExtraido {
  titulo: string;
  data: Date | null;

  dataFim: Date | null;
  horaEncontrada: boolean;

  recorrencia: Recorrencia | null;
}

export function parseTextoLivre(texto: string, agora: Date = new Date()): EventoExtraido {
  const horaInfo = extrairHora(texto);

  // Intervalo (ex: "de 10 a 15/08") tem prioridade: se casar, o texto
  // descreve um evento de início/fim, não uma data única.
  const intervalo = extrairIntervalo(texto, agora);
  if (intervalo) {
    let inicio = intervalo.inicio;
    let fim = intervalo.fim;

    if (horaInfo) {
      inicio = new Date(inicio);
      inicio.setHours(horaInfo.hora, horaInfo.minuto, 0, 0);
      fim = new Date(fim);
      fim.setHours(horaInfo.hora, horaInfo.minuto, 0, 0);
    } else {
      // Sem hora detectada no texto: assume 08:00 como padrão.
      inicio.setHours(8, 0, 0, 0);
      fim.setHours(8, 0, 0, 0);
    }

    return {
      titulo: limparTitulo(texto, [intervalo.trecho, horaInfo?.trecho]),
      data: inicio,
      dataFim: fim,
      horaEncontrada: !!horaInfo,
      recorrencia: null,
    };
  }

  // Recorrência (ex: "toda segunda") vem depois: só é checada se não havia
  // um intervalo explícito.
  const recorrenciaInfo = extrairRecorrencia(texto, agora);
  if (recorrenciaInfo) {
    let dataFinal = recorrenciaInfo.dataBase;
    if (horaInfo) {
      dataFinal = new Date(dataFinal);
      dataFinal.setHours(horaInfo.hora, horaInfo.minuto, 0, 0);
    } else {
      dataFinal.setHours(8, 0, 0, 0);
    }

    return {
      titulo: limparTitulo(texto, [recorrenciaInfo.trecho, horaInfo?.trecho]),
      data: dataFinal,
      dataFim: null,
      horaEncontrada: !!horaInfo,
      recorrencia: recorrenciaInfo.recorrencia,
    };
  }

  // Nem intervalo nem recorrência: tenta extrair uma única data solta.
  const { data: dataBase, trecho: trechoData } = extrairData(texto, agora);

  let dataFinal = dataBase;
  if (dataFinal && horaInfo) {
    dataFinal = new Date(dataFinal);
    dataFinal.setHours(horaInfo.hora, horaInfo.minuto, 0, 0);
  } else if (dataFinal) {
    dataFinal.setHours(8, 0, 0, 0);
  }

  return {
    titulo: limparTitulo(texto, [trechoData, horaInfo?.trecho]),
    data: dataFinal,
    dataFim: null,
    horaEncontrada: !!horaInfo,
    recorrencia: null,
  };
}

// Reconhece texto com vários eventos: primeiro tenta como lista (uma
// linha por evento, com ou sem marcador "-"/"*"); se não for lista,
// tenta dividir um parágrafo corrido por onde aparecem datas soltas.
// Candidatos sem nenhuma data reconhecida são descartados.
export function parseMultiplosEventos(texto: string, agora: Date = new Date()): EventoExtraido[] {
  const linhas = texto
    .split('\n')
    .map((linha) => linha.replace(REGEX_MARCADOR_LISTA, '').trim())
    .filter((linha) => linha.length > 0);

  const candidatos = linhas.length > 1 ? linhas : dividirPorPosicaoDeDatas(texto.trim());

  const eventos: EventoExtraido[] = [];
  candidatos.forEach((candidato) => {
    if (!candidato) return;
    const extraido = parseTextoLivre(candidato, agora);
    if (extraido.data || extraido.dataFim) {
      eventos.push(extraido);
    }
  });

  return eventos;
}
