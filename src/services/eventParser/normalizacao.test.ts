import { comLimitesDePalavra, removerAcentos, limparTitulo } from './normalizacao';

describe('comLimitesDePalavra', () => {
  it('casa a palavra isolada', () => {
    const regex = comLimitesDePalavra('amanha');
    expect(regex.test('reunião amanha')).toBe(true);
  });

  it('não casa a palavra colada dentro de outra maior', () => {
    const regex = comLimitesDePalavra('amanha');
    // "depois de amanha" contém "amanha" isolado, mas o teste real é
    // garantir que não casa dentro de uma palavra tipo "amanhecer".
    expect(regex.test('vou amanhecer cedo')).toBe(false);
  });

  it('é case-insensitive por padrão', () => {
    const regex = comLimitesDePalavra('amanha');
    expect(regex.test('AMANHA')).toBe(true);
  });
});

describe('removerAcentos', () => {
  it('remove acentos comuns em português', () => {
    expect(removerAcentos('depois de amanhã')).toBe('depois de amanha');
    expect(removerAcentos('próxima terça-feira')).toBe('proxima terca-feira');
    expect(removerAcentos('reunião às 14h')).toBe('reuniao as 14h');
  });

  it('não muda texto sem acentos', () => {
    expect(removerAcentos('sem acentos aqui')).toBe('sem acentos aqui');
  });
});

describe('limparTitulo', () => {
  it('remove os trechos reconhecidos e palavras descartáveis', () => {
    const resultado = limparTitulo('reunião dia 20/07 às 14h', ['20/07', '14h']);
    expect(resultado).toBe('reunião');
  });

  it('ignora trechos null/undefined na lista', () => {
    const resultado = limparTitulo('reunião amanhã', [null, undefined, 'amanhã']);
    expect(resultado).toBe('reunião');
  });

  it('colapsa espaços duplos deixados pela remoção', () => {
    const resultado = limparTitulo('reunião   20/07   às   14h', ['20/07', '14h']);
    expect(resultado).toBe('reunião');
  });

  it('cai de volta pro texto original (trim) se a limpeza esvaziar tudo', () => {
    // Se remover tudo e sobrar só palavra descartável, não deve devolver
    // string vazia — devolve o texto original trimado.
    const resultado = limparTitulo('  dia  ', []);
    expect(resultado).toBe('dia');
  });
});
