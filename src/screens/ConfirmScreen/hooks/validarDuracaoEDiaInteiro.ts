// Validação pura da duração/dia-inteiro escolhida no formulário. Recebe
// os valores de estado como parâmetros em vez de ler direto do hook,
// pra poder testar as regras (datas fora de ordem, duração inválida,
// arredondamento etc.) sem precisar montar o componente React.
export type DuracaoOpcao = '30' | '60' | '120' | 'diaInteiro' | 'personalizado';
export type AntecedenciaOpcao = '10' | '30' | '60' | '1440' | 'sem';

// `ok: false` carrega título/mensagem prontos pra exibir num aviso, em vez
// de lançar exceção — mantém a validação no fluxo normal do formulário.
export type DuracaoResultado =
  | { ok: true; diaInteiro: boolean; duracaoMinutos?: number; dataFimDiaInteiro?: Date }
  | { ok: false; titulo: string; mensagem: string };

export function validarDuracaoEDiaInteiro(
  duracaoOpcao: DuracaoOpcao,
  duracaoPersonalizadaStr: string,
  dataFimDiaInteiro: Date | undefined,
  dataInicio: Date
): DuracaoResultado {
  if (duracaoOpcao === 'diaInteiro') {
    if (!dataFimDiaInteiro) {
      return { ok: true, diaInteiro: true };
    }
    const inicioSoData = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());
    const fimSoData = new Date(
      dataFimDiaInteiro.getFullYear(),
      dataFimDiaInteiro.getMonth(),
      dataFimDiaInteiro.getDate()
    );
    if (fimSoData.getTime() < inicioSoData.getTime()) {
      return {
        ok: false,
        titulo: 'Datas fora de ordem',
        mensagem: 'O fim do dia inteiro precisa ser igual ou depois da data do evento.',
      };
    }
    return { ok: true, diaInteiro: true, dataFimDiaInteiro: fimSoData };
  }

  if (duracaoOpcao === 'personalizado') {
    const minutos = Number(duracaoPersonalizadaStr);
    if (!duracaoPersonalizadaStr.trim() || !Number.isFinite(minutos) || minutos <= 0) {
      return {
        ok: false,
        titulo: 'Duração inválida',
        mensagem: 'Digite a duração personalizada em minutos (um número maior que zero).',
      };
    }
    return { ok: true, diaInteiro: false, duracaoMinutos: Math.round(minutos) };
  }

  return { ok: true, diaInteiro: false, duracaoMinutos: Number(duracaoOpcao) };
}
