import { extrairData, ajustarAnoSeNoPassado, proximaOcorrencia } from './dataUnica';

// Terça-feira, 11/08/2026 — data fixa pra deixar os testes determinísticos.
const AGORA = new Date(2026, 7, 11);

describe('ajustarAnoSeNoPassado', () => {
  it('mantém o ano se a data ainda não passou', () => {
    const data = new Date(2026, 11, 20);
    expect(ajustarAnoSeNoPassado(data, AGORA)).toEqual(data);
  });

  it('rola pro ano seguinte se a data já passou', () => {
    const data = new Date(2026, 0, 20);
    const resultado = ajustarAnoSeNoPassado(data, AGORA);
    expect(resultado).toEqual(new Date(2027, 0, 20));
  });

  it('considera hoje como "ainda não passou"', () => {
    expect(ajustarAnoSeNoPassado(new Date(AGORA), AGORA)).toEqual(AGORA);
  });
});

describe('proximaOcorrencia', () => {
  it('retorna hoje mesmo se hoje já é o dia da semana alvo', () => {
    // AGORA é terça (2); pedir terça deve devolver o próprio dia.
    const resultado = proximaOcorrencia(AGORA, 2);
    expect(resultado.getDate()).toBe(11);
  });

  it('encontra o próximo dia da semana à frente', () => {
    // AGORA é terça (2); sexta (5) é daqui a 3 dias.
    const resultado = proximaOcorrencia(AGORA, 5);
    expect(resultado.getDate()).toBe(14);
  });
});

describe('extrairData', () => {
  it('reconhece "hoje"', () => {
    const resultado = extrairData('reunião hoje', AGORA);
    expect(resultado.data).toEqual(AGORA);
  });

  it('reconhece "amanhã"', () => {
    const resultado = extrairData('reunião amanhã', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 12));
  });

  it('reconhece "depois de amanhã" (e não deixa "amanhã" roubar o match)', () => {
    const resultado = extrairData('reunião depois de amanhã', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 13));
    expect(resultado.trecho).toBe('depois de amanhã');
  });

  it('reconhece data completa dd/mm/aaaa', () => {
    const resultado = extrairData('reunião 20/07/2027', AGORA);
    expect(resultado.data).toEqual(new Date(2027, 6, 20));
  });

  it('reconhece data por extenso com ano explícito', () => {
    const resultado = extrairData('reunião 4 de agosto de 2027', AGORA);
    expect(resultado.data).toEqual(new Date(2027, 7, 4));
  });

  it('reconhece data por extenso sem ano, no futuro (mantém o ano atual)', () => {
    const resultado = extrairData('reunião 20 de dezembro', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 11, 20));
  });

  it('reconhece data por extenso sem ano, já no passado (rola pro ano seguinte)', () => {
    const resultado = extrairData('reunião 20 de janeiro', AGORA);
    expect(resultado.data).toEqual(new Date(2027, 0, 20));
  });

  it('não reconhece "de X" como data se a palavra depois não é um mês', () => {
    // Caso citado no próprio comentário do código-fonte.
    const resultado = extrairData('reunião de clientes dia 20', AGORA);
    expect(resultado.data).toBeNull();
  });

  it('reconhece data curta dd/mm sem ano, no futuro', () => {
    const resultado = extrairData('reunião 20/12', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 11, 20));
  });

  it('reconhece data curta dd/mm sem ano, já no passado (rola pro ano seguinte)', () => {
    const resultado = extrairData('reunião 05/01', AGORA);
    expect(resultado.data).toEqual(new Date(2027, 0, 5));
  });

  it('reconhece "daqui a X dias"', () => {
    const resultado = extrairData('reunião daqui a 3 dias', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 14));
  });

  it('reconhece "daqui a X semanas"', () => {
    const resultado = extrairData('reunião daqui a 2 semanas', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 25));
  });

  it('reconhece "daqui a X meses"', () => {
    const resultado = extrairData('reunião daqui a 1 mês', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 8, 11));
  });

  it('reconhece "fim de semana que vem" (pula o fim de semana mais próximo)', () => {
    const resultado = extrairData('viagem fim de semana que vem', AGORA);
    // Sábado mais próximo seria 15/08; "que vem" pula pro 22/08.
    expect(resultado.data).toEqual(new Date(2026, 7, 22));
  });

  it('reconhece "semana que vem" isolada (mesmo dia da semana, 7 dias à frente)', () => {
    const resultado = extrairData('reunião semana que vem', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 18));
  });

  it('reconhece dia da semana isolado, podendo ser hoje', () => {
    const resultado = extrairData('reunião terça', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 11));
  });

  it('reconhece dia da semana com "próximo" (pula pra semana seguinte)', () => {
    const resultado = extrairData('reunião próxima sexta', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 21));
  });

  it('reconhece dia da semana com "que vem" (pula pra semana seguinte)', () => {
    const resultado = extrairData('reunião sexta que vem', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 21));
  });

  it('reconhece dia da semana sem marcador (ocorrência mais próxima, sem pular)', () => {
    const resultado = extrairData('reunião sexta', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 14));
  });

  it('é insensível a acento e maiúscula/minúscula no dia da semana', () => {
    const resultado = extrairData('reunião SÁBADO', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 15));
  });

  it('retorna null quando não há nenhuma data no texto', () => {
    const resultado = extrairData('reunião de alinhamento geral', AGORA);
    expect(resultado.data).toBeNull();
    expect(resultado.trecho).toBeNull();
  });
});
