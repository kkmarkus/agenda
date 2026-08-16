// Evita que uma chamada assíncrona antiga e lenta sobrescreva o resultado
// de uma chamada mais nova e rápida disparada depois dela (ex: focar,
// desfocar e focar de novo uma tela rápido o suficiente pra duas
// requisições ficarem em voo ao mesmo tempo). Sem essa guarda, a que
// termina depois "vence" mesmo que tenha começado antes, podendo
// sobrescrever dados já atualizados com dados desatualizados.
export function criarGuardaDeVersao() {
  let versaoAtual = 0;

  return {
    // Chame no início de cada operação assíncrona pra obter o número
    // dessa chamada específica.
    proximaVersao: (): number => {
      versaoAtual += 1;
      return versaoAtual;
    },
    // Chame depois que a operação assíncrona termina, antes de aplicar o
    // resultado: se retornar `false`, uma chamada mais nova já assumiu
    // enquanto esta estava em voo — descarte o resultado.
    ehVersaoAtual: (minhaVersao: number): boolean => minhaVersao === versaoAtual,
  };
}
