import { DIAS_SEMANA_PADRAO } from './dataUnica';

// Marcador de item de lista no início da linha: "-", "•", "*" ou "1.", "2)".
export const REGEX_MARCADOR_LISTA = /^\s*(?:[-•*]|\d+[.)])\s*/;

// Qualquer trecho que pareça uma data solta, usado só pra achar ONDE no
// texto começa cada evento (não pra interpretar a data em si — isso fica
// a cargo de `extrairData`).
const REGEX_MARCADOR_DATA_GLOBAL = new RegExp(
  [
    '\\d{1,2}/\\d{1,2}(?:/\\d{4})?',
    '(?<![a-zA-ZÀ-ÿ])depois de amanh[ãa](?![a-zA-ZÀ-ÿ])',
    '(?<![a-zA-ZÀ-ÿ])amanh[ãa](?![a-zA-ZÀ-ÿ])',
    '(?<![a-zA-ZÀ-ÿ])hoje(?![a-zA-ZÀ-ÿ])',
    '\\d{1,2}\\s+de\\s+[a-zA-ZÀ-ÿ]+',
    `(?<![a-zA-ZÀ-ÿ])(?:pr[oó]xim[oa]\\s+)?(?:${DIAS_SEMANA_PADRAO})(?:-feira)?(?![a-zA-ZÀ-ÿ])`,
  ].join('|'),
  'gi'
);

// Divide um parágrafo corrido (sem marcadores de lista) em um pedaço de
// texto por data encontrada — cada pedaço vai da data até o início da
// próxima data (ou o fim do texto).
export function dividirPorPosicaoDeDatas(texto: string): string[] {
  const indices: number[] = [];
  const regex = new RegExp(REGEX_MARCADOR_DATA_GLOBAL.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto)) !== null) {
    indices.push(match.index);
    if (match.index === regex.lastIndex) regex.lastIndex += 1; // evita loop infinito em match de tamanho zero
  }

  if (indices.length <= 1) return [texto];

  const pontosDeCorte = [0, ...indices.slice(1)];
  return pontosDeCorte.map((inicio, i) => {
    const fim = i + 1 < pontosDeCorte.length ? pontosDeCorte[i + 1] : texto.length;
    return texto.slice(inicio, fim).trim();
  });
}
