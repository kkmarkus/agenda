import { useEffect, useState } from 'react';
import { lerDuracaoEAntecedenciaPadrao } from '../../../services/database';
import { validarDuracaoEDiaInteiro } from './validarDuracaoEDiaInteiro';
import type { DuracaoOpcao, AntecedenciaOpcao, DuracaoResultado } from './validarDuracaoEDiaInteiro';

// Reexportados: outros arquivos importam esses tipos a partir daqui, e a
// extração da lógica de validação não deve mudar isso.
export type { DuracaoOpcao, AntecedenciaOpcao, DuracaoResultado };

export function useDuracaoEAlarme() {
  const [duracaoOpcao, setDuracaoOpcao] = useState<DuracaoOpcao>('60');
  const [duracaoPersonalizadaStr, setDuracaoPersonalizadaStr] = useState('');
  const [dataFimDiaInteiro, setDataFimDiaInteiro] = useState<Date | undefined>(undefined);
  const [antecedenciaOpcao, setAntecedenciaOpcao] = useState<AntecedenciaOpcao>('30');

  // Preenche com a duração/antecedência padrão salva nas configurações,
  // se houver (senão mantém os valores iniciais acima).
  useEffect(() => {
    const { duracaoPadrao, antecedenciaPadrao } = lerDuracaoEAntecedenciaPadrao();
    if (duracaoPadrao) setDuracaoOpcao(duracaoPadrao);
    if (antecedenciaPadrao) setAntecedenciaOpcao(antecedenciaPadrao);
  }, []);

  // Valida e resolve a duração conforme a opção escolhida, devolvendo um
  // resultado pronto pra montar o evento (ou o erro pra mostrar). A regra
  // em si mora em validarDuracaoEDiaInteiro (função pura, testada
  // separadamente); aqui só passamos o estado atual do formulário.
  function montarDuracaoEDiaInteiro(dataInicio: Date): DuracaoResultado {
    return validarDuracaoEDiaInteiro(duracaoOpcao, duracaoPersonalizadaStr, dataFimDiaInteiro, dataInicio);
  }

  return {
    duracaoOpcao,
    setDuracaoOpcao,
    duracaoPersonalizadaStr,
    setDuracaoPersonalizadaStr,
    dataFimDiaInteiro,
    setDataFimDiaInteiro,
    antecedenciaOpcao,
    setAntecedenciaOpcao,
    montarDuracaoEDiaInteiro,
  };
}
