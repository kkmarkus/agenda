import { criarBancoDeTeste } from './testUtils';

describe('preferenciasRepository', () => {
  let banco: ReturnType<typeof criarBancoDeTeste>;

  beforeEach(() => {
    banco = criarBancoDeTeste();
  });

  it('retorna null pra uma preferência nunca definida', () => {
    expect(banco.obterPreferencia('chave-inexistente')).toBeNull();
  });

  it('define e lê uma preferência', () => {
    banco.definirPreferencia('tema', 'grafite');
    expect(banco.obterPreferencia('tema')).toBe('grafite');
  });

  it('definir de novo a mesma chave sobrescreve o valor (upsert)', () => {
    banco.definirPreferencia('tema', 'grafite');
    banco.definirPreferencia('tema', 'dourado');
    expect(banco.obterPreferencia('tema')).toBe('dourado');
  });

  describe('lerDuracaoEAntecedenciaPadrao', () => {
    it('devolve os dois campos undefined quando nada foi salvo', () => {
      expect(banco.lerDuracaoEAntecedenciaPadrao()).toEqual({});
    });

    it('devolve os valores válidos salvos', () => {
      banco.definirPreferencia(banco.PREF_DURACAO_PADRAO_MINUTOS, '60');
      banco.definirPreferencia(banco.PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS, '1440');
      expect(banco.lerDuracaoEAntecedenciaPadrao()).toEqual({
        duracaoPadrao: '60',
        antecedenciaPadrao: '1440',
      });
    });

    it('ignora valores fora do conjunto válido, devolvendo undefined pro chamador decidir o fallback', () => {
      banco.definirPreferencia(banco.PREF_DURACAO_PADRAO_MINUTOS, 'lixo');
      banco.definirPreferencia(banco.PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS, '999');
      expect(banco.lerDuracaoEAntecedenciaPadrao()).toEqual({});
    });
  });
});
