import { extrairRecorrencia, proximaOcorrenciaDoDiaDoMes } from './recorrencia';

// Terça-feira, 11/08/2026 — data fixa pra deixar os testes determinísticos.
const TERCA = new Date(2026, 7, 11);

describe('proximaOcorrenciaDoDiaDoMes', () => {
  it('retorna este mês se o dia ainda não passou', () => {
    const resultado = proximaOcorrenciaDoDiaDoMes(TERCA, 20);
    expect(resultado.getMonth()).toBe(7);
    expect(resultado.getDate()).toBe(20);
  });

  it('pula pro mês seguinte se o dia já passou', () => {
    const resultado = proximaOcorrenciaDoDiaDoMes(TERCA, 5);
    expect(resultado.getMonth()).toBe(8);
    expect(resultado.getDate()).toBe(5);
  });

  it('considera hoje como "ainda não passou"', () => {
    const resultado = proximaOcorrenciaDoDiaDoMes(TERCA, 11);
    expect(resultado.getMonth()).toBe(7);
    expect(resultado.getDate()).toBe(11);
  });
});

describe('extrairRecorrencia', () => {
  it('reconhece "todo dia N" como recorrência mensal', () => {
    const resultado = extrairRecorrencia('pagar aluguel todo dia 5', TERCA);
    expect(resultado?.recorrencia).toEqual({ frequencia: 'mensal', diaDoMes: 5 });
    expect(resultado?.trecho).toBe('todo dia 5');
  });

  it('não confunde "todo dia N" com uma data completa (dia/mês)', () => {
    // Regra tem lookahead negativo pra não casar "todo dia 5/10".
    const resultado = extrairRecorrencia('evento todo dia 5/10', TERCA);
    expect(resultado?.recorrencia.frequencia).not.toBe('mensal');
  });

  it('reconhece "toda sexta" como recorrência semanal', () => {
    const resultado = extrairRecorrencia('reunião toda sexta', TERCA);
    expect(resultado?.recorrencia).toEqual({ frequencia: 'semanal', diaSemana: 5 });
  });

  it('reconhece "todas as segundas" (plural, com artigo)', () => {
    const resultado = extrairRecorrencia('treino todas as segundas', TERCA);
    expect(resultado?.recorrencia).toEqual({ frequencia: 'semanal', diaSemana: 1 });
  });

  it('reconhece "diariamente"', () => {
    const resultado = extrairRecorrencia('tomar remédio diariamente', TERCA);
    expect(resultado?.recorrencia).toEqual({ frequencia: 'diaria' });
  });

  it('reconhece "todo mês" genérico usando o dia de hoje', () => {
    const resultado = extrairRecorrencia('pagar conta todo mês', TERCA);
    expect(resultado?.recorrencia).toEqual({ frequencia: 'mensal', diaDoMes: 11 });
  });

  it('reconhece "toda semana" genérico usando o dia da semana de hoje', () => {
    const resultado = extrairRecorrencia('reunião toda semana', TERCA);
    expect(resultado?.recorrencia).toEqual({ frequencia: 'semanal', diaSemana: TERCA.getDay() });
  });

  it('reconhece "todo dia" genérico (sem número) como diária', () => {
    const resultado = extrairRecorrencia('tomar água todo dia', TERCA);
    expect(resultado?.recorrencia).toEqual({ frequencia: 'diaria' });
  });

  it('prioriza o padrão mais específico (mensal por dia) sobre o genérico', () => {
    // "todo dia 5" não deve cair no padrão genérico "todo dia" (diária).
    const resultado = extrairRecorrencia('pagar todo dia 5', TERCA);
    expect(resultado?.recorrencia.frequencia).toBe('mensal');
  });

  it('retorna null quando não há padrão de recorrência', () => {
    expect(extrairRecorrencia('reunião amanhã às 14h', TERCA)).toBeNull();
  });
});
