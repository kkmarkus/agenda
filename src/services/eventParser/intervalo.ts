import { removerAcentos } from './normalizacao';
import { MESES } from './dataUnica';

// Casa padrões como "de 10 a 15/08", "do dia 3 ao dia 5", "entre 10 e 12
// de agosto de 2027". O mês/ano por extenso no final, se houver, vale
// pros dois lados do intervalo.
const REGEX_INTERVALO = new RegExp(
  '(?:do\\s+dia\\s+|de\\s+|entre\\s+)' +
    '(\\d{1,2}(?:/\\d{1,2}(?:/\\d{4})?)?)' +
    '\\s+(?:ao\\s+dia\\s+|at[eé]\\s+(?:o\\s+dia\\s+)?|a\\s+|e\\s+)' +
    '(\\d{1,2}(?:/\\d{1,2}(?:/\\d{4})?)?)' +
    '(?:\\s+de\\s+([a-zA-ZÀ-ÿ]+)(?:\\s+de\\s+(\\d{4}))?)?',
  'i'
);

// Interpreta um dos dois lados do intervalo, que pode vir como "10/08"
// (já com mês próprio) ou só "10" (usando o mês/ano por extenso comum aos
// dois lados).
function interpretarComponenteIntervalo(
  componente: string,
  mesExtenso: string | undefined,
  anoExtenso: string | undefined,
  agora: Date
): { data: Date; anoExplicito: boolean } | null {
  if (componente.includes('/')) {
    const [diaTexto, mesTexto, anoTexto] = componente.split('/');
    const anoExplicito = !!anoTexto;
    const anoFinal = anoExplicito ? Number(anoTexto) : agora.getFullYear();
    return { data: new Date(anoFinal, Number(mesTexto) - 1, Number(diaTexto)), anoExplicito };
  }

  if (!mesExtenso) return null;
  const mesIndice = MESES[removerAcentos(mesExtenso.toLowerCase())];
  if (mesIndice === undefined) return null;

  const anoExplicito = !!anoExtenso;
  const anoFinal = anoExplicito ? Number(anoExtenso) : agora.getFullYear();
  return { data: new Date(anoFinal, mesIndice, Number(componente)), anoExplicito };
}

export function extrairIntervalo(
  texto: string,
  agora: Date
): { inicio: Date; fim: Date; trecho: string } | null {
  const match = texto.match(REGEX_INTERVALO);
  if (!match) return null;

  const [trecho, comp1, comp2, mesExtenso, anoExtenso] = match;
  let inicioBruto = interpretarComponenteIntervalo(comp1, mesExtenso, anoExtenso, agora);
  let fimBruto = interpretarComponenteIntervalo(comp2, mesExtenso, anoExtenso, agora);

  // Um lado pode vir só com o dia solto (sem "/" e sem mês por extenso no
  // texto, ex: "de 10 a 15/08" — o "10" não tem mês próprio nenhum). Nesse
  // caso, herda mês/ano do OUTRO lado, que tem uma data completa via "/".
  // Sem isso, um padrão que o próprio comentário deste arquivo promete
  // suportar ("de 10 a 15/08") não era reconhecido de jeito nenhum.
  if (!inicioBruto && fimBruto && !comp1.includes('/')) {
    inicioBruto = {
      data: new Date(fimBruto.data.getFullYear(), fimBruto.data.getMonth(), Number(comp1)),
      anoExplicito: fimBruto.anoExplicito,
    };
  }
  if (!fimBruto && inicioBruto && !comp2.includes('/')) {
    fimBruto = {
      data: new Date(inicioBruto.data.getFullYear(), inicioBruto.data.getMonth(), Number(comp2)),
      anoExplicito: inicioBruto.anoExplicito,
    };
  }

  if (!inicioBruto || !fimBruto) return null;

  let inicio = inicioBruto.data;
  let fim = fimBruto.data;

  // Se nenhum dos dois lados tinha ano explícito e o fim do intervalo já
  // ficou no passado, assume que é pro ano seguinte (mesma lógica de
  // "próxima ocorrência" usada pra datas soltas).
  const semAnoExplicito = !inicioBruto.anoExplicito && !fimBruto.anoExplicito;
  if (semAnoExplicito) {
    const hojeSemHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const fimSemHora = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
    if (fimSemHora < hojeSemHora) {
      inicio = new Date(inicio);
      inicio.setFullYear(inicio.getFullYear() + 1);
      fim = new Date(fim);
      fim.setFullYear(fim.getFullYear() + 1);
    }
  }

  return { inicio, fim, trecho };
}
