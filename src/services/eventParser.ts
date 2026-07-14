// Parser baseado em regras — sem IA por enquanto (ver decisão em resumo-projeto).
// Reconhece os padrões mais comuns de como ela escreve no WhatsApp:
// datas em dd/mm ou dd/mm/aaaa, "hoje"/"amanhã", e horário em "Xh" ou "X:XX".

export interface EventoExtraido {
  titulo: string;
  data: Date | null;
  horaEncontrada: boolean; // se não achou hora, o formulário assume um horário padrão
}

const REGEX_DATA_COMPLETA = /(\d{1,2})\/(\d{1,2})\/(\d{4})/; // 27/07/2026
const REGEX_DATA_CURTA = /(\d{1,2})\/(\d{1,2})(?!\/)/; // 27/07 (sem ano)
const REGEX_HORA = /(\d{1,2})[:h](\d{2})?\s*h?/i; // 14h, 14:30, 14h30

function extrairData(texto: string, agora: Date): { data: Date | null; trecho: string | null } {
  if (/\bhoje\b/i.test(texto)) {
    return { data: new Date(agora), trecho: texto.match(/\bhoje\b/i)![0] };
  }

  if (/\bamanh[ãa]\b/i.test(texto)) {
    const amanha = new Date(agora);
    amanha.setDate(amanha.getDate() + 1);
    return { data: amanha, trecho: texto.match(/\bamanh[ãa]\b/i)![0] };
  }

  const completa = texto.match(REGEX_DATA_COMPLETA);
  if (completa) {
    const [trecho, dia, mes, ano] = completa;
    return { data: new Date(Number(ano), Number(mes) - 1, Number(dia)), trecho };
  }

  const curta = texto.match(REGEX_DATA_CURTA);
  if (curta) {
    const [trecho, dia, mes] = curta;
    return { data: new Date(agora.getFullYear(), Number(mes) - 1, Number(dia)), trecho };
  }

  return { data: null, trecho: null };
}

function extrairHora(texto: string): { hora: number; minuto: number; trecho: string } | null {
  const match = texto.match(REGEX_HORA);
  if (!match) return null;
  const [trecho, hora, minuto] = match;
  return { hora: Number(hora), minuto: minuto ? Number(minuto) : 0, trecho };
}

/**
 * Extrai título, data e hora de um texto livre.
 * O título final é o texto original menos os trechos de data/hora reconhecidos,
 * pra não sobrar "reunião dia 20/07 às 14h" como título — só "reunião".
 */
export function parseTextoLivre(texto: string, agora: Date = new Date()): EventoExtraido {
  const { data: dataBase, trecho: trechoData } = extrairData(texto, agora);
  const horaInfo = extrairHora(texto);

  let dataFinal = dataBase;
  if (dataFinal && horaInfo) {
    dataFinal = new Date(dataFinal);
    dataFinal.setHours(horaInfo.hora, horaInfo.minuto, 0, 0);
  } else if (dataFinal) {
    dataFinal.setHours(8, 0, 0, 0); // sem hora informada: assume 08:00
  }

  let titulo = texto;
  if (trechoData) titulo = titulo.replace(trechoData, '');
  if (horaInfo) titulo = titulo.replace(horaInfo.trecho, '');
  titulo = titulo
    .replace(/\b(dia|às|as|em)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    titulo: titulo || texto.trim(),
    data: dataFinal,
    horaEncontrada: !!horaInfo,
  };
}
