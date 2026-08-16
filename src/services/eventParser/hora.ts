// "14h", "14:30", "14h30" (hora curta) ou "14 horas e 30 minutos" (por extenso).
const REGEX_HORA_CURTA = /(\d{1,2})[:h](\d{2})?\s*h?/i;

const REGEX_HORA_EXTENSO = /(\d{1,2})\s*horas?(?:\s+e\s+(\d{1,2})\s*minutos?)?/i;

// `\d{1,2}` casa de 0 a 99 tanto pra hora quanto pra minuto — sem essa
// checagem, um valor fora da faixa (ex: "35h", digitado errado) vira
// `data.setHours(35, ...)`, que o JavaScript aceita e rola silenciosamente
// pro dia seguinte, sem nenhum aviso pra quem digitou.
function faixaValida(hora: number, minuto: number): boolean {
  return hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59;
}

export function extrairHora(texto: string): { hora: number; minuto: number; trecho: string } | null {
  const matchCurta = texto.match(REGEX_HORA_CURTA);
  if (matchCurta) {
    const [trecho, hora, minuto] = matchCurta;
    const horaNum = Number(hora);
    const minutoNum = minuto ? Number(minuto) : 0;
    if (faixaValida(horaNum, minutoNum)) {
      return { hora: horaNum, minuto: minutoNum, trecho };
    }
  }

  const matchExtenso = texto.match(REGEX_HORA_EXTENSO);
  if (matchExtenso) {
    const [trecho, hora, minuto] = matchExtenso;
    const horaNum = Number(hora);
    const minutoNum = minuto ? Number(minuto) : 0;
    if (faixaValida(horaNum, minutoNum)) {
      return { hora: horaNum, minuto: minutoNum, trecho };
    }
  }

  return null;
}
