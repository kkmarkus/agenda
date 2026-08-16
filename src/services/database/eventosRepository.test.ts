import { criarBancoDeTeste } from './testUtils';

describe('eventosRepository', () => {
  let banco: ReturnType<typeof criarBancoDeTeste>;

  beforeEach(() => {
    banco = criarBancoDeTeste();
  });

  it('salva um registro e passa a listá-lo, com as tags associadas', () => {
    banco.salvarRegistro('native-1', ['trabalho', 'urgente']);
    const registros = banco.listarRegistros();
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      nativeEventId: 'native-1',
      tags: ['trabalho', 'urgente'],
      fixado: false,
    });
  });

  it('salva um registro sem nenhuma tag', () => {
    banco.salvarRegistro('native-1', []);
    const registros = banco.listarRegistros();
    expect(registros[0].tags).toEqual([]);
  });

  it('lista mais recentes primeiro (ORDER BY created_at DESC)', () => {
    banco.salvarRegistro('native-1', []);
    banco.salvarRegistro('native-2', []);
    const registros = banco.listarRegistros();
    expect(registros.map((r) => r.nativeEventId)).toEqual(['native-2', 'native-1']);
  });

  it('alternarFixado liga e desliga', () => {
    const id = banco.salvarRegistro('native-1', []);
    banco.alternarFixado(id);
    expect(banco.listarRegistros()[0].fixado).toBe(true);
    banco.alternarFixado(id);
    expect(banco.listarRegistros()[0].fixado).toBe(false);
  });

  it('listarNativeIdsRegistrados devolve um Set com todos os IDs nativos', () => {
    banco.salvarRegistro('native-1', []);
    banco.salvarRegistro('native-2', []);
    expect(banco.listarNativeIdsRegistrados()).toEqual(new Set(['native-1', 'native-2']));
  });

  it('apagarRegistro remove o evento e suas associações de tag', () => {
    const id = banco.salvarRegistro('native-1', ['trabalho']);
    banco.apagarRegistro(id);
    expect(banco.listarRegistros()).toEqual([]);
    // A tag em si (tag_cores) não é apagada, só o vínculo com o evento.
    expect(banco.listarTagsUnicas()).toEqual([]);
  });

  it('atualizarTagsPorNativeId substitui as tags de um evento existente', () => {
    banco.salvarRegistro('native-1', ['antiga']);
    banco.atualizarTagsPorNativeId('native-1', ['nova']);
    expect(banco.listarRegistros()[0].tags).toEqual(['nova']);
  });

  it('atualizarTagsPorNativeId não faz nada se o nativeEventId não existe', () => {
    banco.salvarRegistro('native-1', ['trabalho']);
    expect(() => banco.atualizarTagsPorNativeId('nao-existe', ['nova'])).not.toThrow();
    expect(banco.listarRegistros()[0].tags).toEqual(['trabalho']);
  });
});
