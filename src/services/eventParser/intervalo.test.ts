import { extrairIntervalo } from './intervalo';

// Terça-feira, 11/08/2026 — data fixa pra deixar os testes determinísticos.
const AGORA = new Date(2026, 7, 11);

describe('extrairIntervalo', () => {
  it('reconhece "de X a Y/MM" (dia solto + dia/mês)', () => {
    const resultado = extrairIntervalo('viagem de 10 a 15/08', AGORA);
    expect(resultado?.inicio).toEqual(new Date(2026, 7, 10));
    expect(resultado?.fim).toEqual(new Date(2026, 7, 15));
  });

  it('o lado com dia solto herda mês/ano do lado com data completa, na ordem inversa também', () => {
    const resultado = extrairIntervalo('de 15/08 a 20', AGORA);
    expect(resultado?.inicio).toEqual(new Date(2026, 7, 15));
    expect(resultado?.fim).toEqual(new Date(2026, 7, 20));
  });

  it('reconhece "do dia X ao dia Y de MÊS" (mês por extenso pros dois lados)', () => {
    const resultado = extrairIntervalo('férias do dia 20 ao dia 25 de agosto', AGORA);
    expect(resultado?.inicio).toEqual(new Date(2026, 7, 20));
    expect(resultado?.fim).toEqual(new Date(2026, 7, 25));
  });

  it('reconhece "entre X e Y de MÊS de ANO" com ano explícito', () => {
    const resultado = extrairIntervalo('entre 10 e 12 de agosto de 2027', AGORA);
    expect(resultado?.inicio).toEqual(new Date(2027, 7, 10));
    expect(resultado?.fim).toEqual(new Date(2027, 7, 12));
  });

  it('retorna null quando não há padrão de intervalo', () => {
    expect(extrairIntervalo('reunião amanhã às 14h', AGORA)).toBeNull();
  });

  it('retorna null se o mês por extenso não existir', () => {
    expect(extrairIntervalo('de 10 a 15 de mêsinventado', AGORA)).toBeNull();
  });

  describe('rollover de ano (sem ano explícito)', () => {
    it('rola pro ano seguinte quando o fim do intervalo já passou', () => {
      // Hoje é 11/08/2026 — "1 a 5 de janeiro" sem ano já ficou no
      // passado esse ano, então deve assumir janeiro de 2027.
      const resultado = extrairIntervalo('de 1 a 5 de janeiro', AGORA);
      expect(resultado?.inicio).toEqual(new Date(2027, 0, 1));
      expect(resultado?.fim).toEqual(new Date(2027, 0, 5));
    });

    it('aplica o rollover ATOMICAMENTE aos dois lados (não só ao fim)', () => {
      // Verificação explícita do aprendizado-chave do projeto: o
      // rollover é decidido só pelo fim, mas aplicado aos DOIS lados —
      // início e fim devem terminar no mesmo ano, nunca invertidos.
      const resultado = extrairIntervalo('de 1 a 5 de janeiro', AGORA);
      expect(resultado?.inicio.getFullYear()).toBe(resultado?.fim.getFullYear());
      expect(resultado!.inicio.getTime()).toBeLessThan(resultado!.fim.getTime());
    });

    it('não rola de ano quando o intervalo ainda está no futuro', () => {
      // Hoje é agosto/2026 — "10 a 15 de dezembro" ainda não passou.
      const resultado = extrairIntervalo('de 10 a 15 de dezembro', AGORA);
      expect(resultado?.inicio).toEqual(new Date(2026, 11, 10));
      expect(resultado?.fim).toEqual(new Date(2026, 11, 15));
    });

    it('NÃO rola de ano quando um dos lados tem ano explícito, mesmo se já passou', () => {
      // Ano explícito é uma decisão deliberada do usuário — não deve ser
      // "corrigido" automaticamente mesmo que já tenha passado.
      const resultado = extrairIntervalo('de 1 a 5 de janeiro de 2026', AGORA);
      expect(resultado?.inicio).toEqual(new Date(2026, 0, 1));
      expect(resultado?.fim).toEqual(new Date(2026, 0, 5));
    });
  });
});
