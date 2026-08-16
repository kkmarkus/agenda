import { validarDuracaoEDiaInteiro } from './validarDuracaoEDiaInteiro';

const dataInicio = new Date('2026-03-10T09:00:00');

describe('validarDuracaoEDiaInteiro', () => {
  describe('duração em minutos (30/60/120)', () => {
    it('resolve cada opção fixa pro número de minutos correspondente', () => {
      expect(validarDuracaoEDiaInteiro('30', '', undefined, dataInicio)).toEqual({
        ok: true,
        diaInteiro: false,
        duracaoMinutos: 30,
      });
      expect(validarDuracaoEDiaInteiro('60', '', undefined, dataInicio)).toEqual({
        ok: true,
        diaInteiro: false,
        duracaoMinutos: 60,
      });
      expect(validarDuracaoEDiaInteiro('120', '', undefined, dataInicio)).toEqual({
        ok: true,
        diaInteiro: false,
        duracaoMinutos: 120,
      });
    });
  });

  describe('duração personalizada', () => {
    it('aceita um número de minutos válido', () => {
      const resultado = validarDuracaoEDiaInteiro('personalizado', '45', undefined, dataInicio);
      expect(resultado).toEqual({ ok: true, diaInteiro: false, duracaoMinutos: 45 });
    });

    it('arredonda minutos fracionados', () => {
      const resultado = validarDuracaoEDiaInteiro('personalizado', '45.6', undefined, dataInicio);
      expect(resultado).toEqual({ ok: true, diaInteiro: false, duracaoMinutos: 46 });
    });

    it('rejeita campo vazio', () => {
      const resultado = validarDuracaoEDiaInteiro('personalizado', '', undefined, dataInicio);
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.titulo).toBe('Duração inválida');
    });

    it('rejeita campo só com espaços', () => {
      const resultado = validarDuracaoEDiaInteiro('personalizado', '   ', undefined, dataInicio);
      expect(resultado.ok).toBe(false);
    });

    it('rejeita texto que não é número', () => {
      const resultado = validarDuracaoEDiaInteiro('personalizado', 'abc', undefined, dataInicio);
      expect(resultado.ok).toBe(false);
    });

    it('rejeita zero', () => {
      const resultado = validarDuracaoEDiaInteiro('personalizado', '0', undefined, dataInicio);
      expect(resultado.ok).toBe(false);
    });

    it('rejeita número negativo', () => {
      const resultado = validarDuracaoEDiaInteiro('personalizado', '-10', undefined, dataInicio);
      expect(resultado.ok).toBe(false);
    });

    it('rejeita Infinity', () => {
      const resultado = validarDuracaoEDiaInteiro('personalizado', 'Infinity', undefined, dataInicio);
      expect(resultado.ok).toBe(false);
    });
  });

  describe('dia inteiro', () => {
    it('sem data de fim: dia inteiro de um dia só', () => {
      const resultado = validarDuracaoEDiaInteiro('diaInteiro', '', undefined, dataInicio);
      expect(resultado).toEqual({ ok: true, diaInteiro: true });
    });

    it('com data de fim igual à data de início: aceita (intervalo de um dia só)', () => {
      const fimIgual = new Date('2026-03-10T23:00:00');
      const resultado = validarDuracaoEDiaInteiro('diaInteiro', '', fimIgual, dataInicio);
      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.diaInteiro).toBe(true);
        expect(resultado.dataFimDiaInteiro).toEqual(new Date(2026, 2, 10));
      }
    });

    it('com data de fim depois da data de início: aceita e normaliza pra meia-noite (só a data)', () => {
      const fimDepois = new Date('2026-03-15T18:30:00');
      const resultado = validarDuracaoEDiaInteiro('diaInteiro', '', fimDepois, dataInicio);
      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.dataFimDiaInteiro).toEqual(new Date(2026, 2, 15));
      }
    });

    it('com data de fim antes da data de início: rejeita', () => {
      const fimAntes = new Date('2026-03-05T09:00:00');
      const resultado = validarDuracaoEDiaInteiro('diaInteiro', '', fimAntes, dataInicio);
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.titulo).toBe('Datas fora de ordem');
    });

    it('ignora o horário ao comparar datas (só compara o dia)', () => {
      // Início às 23h, fim "antes" só na hora mas no mesmo dia calendário
      // — não deve contar como fora de ordem.
      const inicioTarde = new Date('2026-03-10T23:00:00');
      const fimMesmoDiaDeManha = new Date('2026-03-10T06:00:00');
      const resultado = validarDuracaoEDiaInteiro('diaInteiro', '', fimMesmoDiaDeManha, inicioTarde);
      expect(resultado.ok).toBe(true);
    });
  });
});
