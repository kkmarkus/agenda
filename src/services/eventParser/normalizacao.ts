// Constrói um regex que só casa a palavra/frase se não estiver colada em
// outras letras (evita "amanhã" casar dentro de "depois de amanhã", etc).
export function comLimitesDePalavra(padrao: string, flags = 'i'): RegExp {
  return new RegExp(`(?<![a-zA-ZÀ-ÿ])(${padrao})(?![a-zA-ZÀ-ÿ])`, flags);
}

export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export const REGEX_PALAVRAS_DESCARTAVEIS = comLimitesDePalavra('dia|às|as|em', 'gi');

// Remove do texto original os trechos de data/hora já reconhecidos (pra
// não sobrarem soltos no título, ex: "reunião dia 20/07 às 14h" → sem
// isso, viraria "reunião às").
export function limparTitulo(texto: string, trechosParaRemover: (string | null | undefined)[]): string {
  let titulo = texto;
  for (const trecho of trechosParaRemover) {
    if (trecho) titulo = titulo.replace(trecho, '');
  }
  titulo = titulo
    .replace(REGEX_PALAVRAS_DESCARTAVEIS, '')
    .replace(/\s{2,}/g, ' ')
    // Pontuação solta que sobra nas bordas depois de remover a data (ex:
    // "dentista, 25/07 medico" → tirando "25/07" sobra "dentista," com a
    // vírgula pendurada — comum em listas separadas por vírgula).
    .replace(/^[,;:.\-–—\s]+|[,;:.\-–—\s]+$/g, '')
    .trim();
  return titulo || texto.trim();
}
