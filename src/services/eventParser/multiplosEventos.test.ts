import { REGEX_MARCADOR_LISTA, dividirPorPosicaoDeDatas } from './multiplosEventos';

describe('REGEX_MARCADOR_LISTA', () => {
  it('reconhece marcadores de lista comuns no início da linha', () => {
    expect('- reunião amanhã').toMatch(REGEX_MARCADOR_LISTA);
    expect('• reunião amanhã').toMatch(REGEX_MARCADOR_LISTA);
    expect('* reunião amanhã').toMatch(REGEX_MARCADOR_LISTA);
    expect('1. reunião amanhã').toMatch(REGEX_MARCADOR_LISTA);
    expect('2) reunião amanhã').toMatch(REGEX_MARCADOR_LISTA);
  });

  it('não reconhece linha sem marcador', () => {
    expect('reunião amanhã').not.toMatch(REGEX_MARCADOR_LISTA);
  });

  it('remove exatamente o marcador ao usar replace', () => {
    expect('- reunião amanhã'.replace(REGEX_MARCADOR_LISTA, '')).toBe('reunião amanhã');
    expect('3) dentista'.replace(REGEX_MARCADOR_LISTA, '')).toBe('dentista');
  });
});

describe('dividirPorPosicaoDeDatas', () => {
  it('não divide um texto com só uma data (ou nenhuma)', () => {
    expect(dividirPorPosicaoDeDatas('reunião sem nenhuma data')).toEqual(['reunião sem nenhuma data']);
    expect(dividirPorPosicaoDeDatas('só amanhã tem reunião')).toEqual(['só amanhã tem reunião']);
  });

  it('divide um parágrafo corrido em um pedaço por data encontrada', () => {
    const resultado = dividirPorPosicaoDeDatas('reunião amanhã com fulano, call terça com beltrano');
    expect(resultado).toEqual(['reunião amanhã com fulano, call', 'terça com beltrano']);
  });

  it('divide corretamente com três datas seguidas (dd/mm)', () => {
    const resultado = dividirPorPosicaoDeDatas('20/07 dentista, 25/07 medico, 30/07 advogado');
    expect(resultado).toEqual(['20/07 dentista,', '25/07 medico,', '30/07 advogado']);
  });

  it('cada pedaço, junto, reconstrói o texto original sem perder nem duplicar conteúdo', () => {
    const original = '20/07 dentista, 25/07 medico, 30/07 advogado';
    const partes = dividirPorPosicaoDeDatas(original);
    // As partes devem cobrir o texto inteiro (concatenadas, ignorando os
    // espaços de borda que o trim() de cada parte descarta).
    expect(partes.join(' ')).toBe(original);
  });
});
