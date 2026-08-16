import { criarBancoDeTeste } from './testUtils';

describe('tagsRepository', () => {
  let banco: ReturnType<typeof criarBancoDeTeste>;

  beforeEach(() => {
    banco = criarBancoDeTeste();
  });

  describe('normalizarTag', () => {
    it('remove espaços de borda e baixa a caixa', () => {
      expect(banco.normalizarTag('  Trabalho  ')).toBe('trabalho');
    });
  });

  describe('cor de tag', () => {
    it('não tem cor pra uma tag nunca usada', () => {
      expect(banco.obterCorIndexDaTag('trabalho')).toBeNull();
    });

    it('define e lê a cor de uma tag (case-insensitive)', () => {
      banco.definirCorDaTag('Trabalho', 3);
      expect(banco.obterCorIndexDaTag('trabalho')).toBe(3);
      expect(banco.obterCorIndexDaTag('TRABALHO')).toBe(3);
    });

    it('garantirCorDaTag não sobrescreve uma cor já definida', () => {
      banco.definirCorDaTag('trabalho', 3);
      banco.garantirCorDaTag('trabalho');
      expect(banco.obterCorIndexDaTag('trabalho')).toBe(3);
    });

    it('garantirCorDaTag atribui cores diferentes em round-robin pras primeiras tags', () => {
      banco.garantirCorDaTag('a');
      banco.garantirCorDaTag('b');
      banco.garantirCorDaTag('c');
      const cores = [
        banco.obterCorIndexDaTag('a'),
        banco.obterCorIndexDaTag('b'),
        banco.obterCorIndexDaTag('c'),
      ];
      expect(new Set(cores).size).toBe(3);
    });
  });

  describe('definirTagsDoEvento', () => {
    it('associa as tags e garante cor pra cada uma', () => {
      const id = banco.salvarRegistro('native-1', []);
      banco.definirTagsDoEvento(id, ['trabalho', 'urgente']);
      expect(banco.listarTagsDoEvento(id)).toEqual(['trabalho', 'urgente']);
      expect(banco.obterCorIndexDaTag('trabalho')).not.toBeNull();
      expect(banco.obterCorIndexDaTag('urgente')).not.toBeNull();
    });

    it('não duplica tags equivalentes por capitalização diferente', () => {
      const id = banco.salvarRegistro('native-1', []);
      banco.definirTagsDoEvento(id, ['Trabalho', 'trabalho', ' TRABALHO ']);
      expect(banco.listarTagsDoEvento(id)).toEqual(['Trabalho']);
    });

    it('substitui completamente as tags anteriores do evento', () => {
      const id = banco.salvarRegistro('native-1', ['antiga']);
      banco.definirTagsDoEvento(id, ['nova']);
      expect(banco.listarTagsDoEvento(id)).toEqual(['nova']);
    });

    it('ignora tags vazias/só espaço', () => {
      const id = banco.salvarRegistro('native-1', []);
      banco.definirTagsDoEvento(id, ['trabalho', '  ', '']);
      expect(banco.listarTagsDoEvento(id)).toEqual(['trabalho']);
    });
  });

  describe('listarTagsUnicas', () => {
    it('lista uma entrada por tag, ordenado, sem duplicar por capitalização', () => {
      const id1 = banco.salvarRegistro('native-1', ['zebra']);
      const id2 = banco.salvarRegistro('native-2', ['Abelha']);
      banco.definirTagsDoEvento(id1, ['zebra']);
      banco.definirTagsDoEvento(id2, ['Abelha', 'abelha']);
      expect(banco.listarTagsUnicas()).toEqual(['Abelha', 'zebra']);
    });
  });

  describe('contarPorTag', () => {
    it('conta eventos por tag e agrupa os sem tag em null', () => {
      const id1 = banco.salvarRegistro('native-1', ['trabalho']);
      const id2 = banco.salvarRegistro('native-2', ['trabalho']);
      banco.salvarRegistro('native-3', []);
      banco.definirTagsDoEvento(id1, ['trabalho']);
      banco.definirTagsDoEvento(id2, ['trabalho']);

      const resultado = banco.contarPorTag();
      expect(resultado).toEqual([
        { tag: 'trabalho', total: 2 },
        { tag: null, total: 1 },
      ]);
    });
  });

  describe('renomearOuMesclarTag', () => {
    it('renomeia in-place quando só muda a capitalização', () => {
      const id = banco.salvarRegistro('native-1', ['trabalho']);
      banco.definirTagsDoEvento(id, ['trabalho']);
      banco.definirCorDaTag('trabalho', 5);

      banco.renomearOuMesclarTag('trabalho', 'Trabalho');

      expect(banco.listarTagsDoEvento(id)).toEqual(['Trabalho']);
      expect(banco.obterCorIndexDaTag('trabalho')).toBe(5);
    });

    it('renomeação de fato (nome novo não existia) reaproveita a cor da tag antiga', () => {
      const id = banco.salvarRegistro('native-1', ['antiga']);
      banco.definirTagsDoEvento(id, ['antiga']);
      banco.definirCorDaTag('antiga', 7);

      banco.renomearOuMesclarTag('antiga', 'nova');

      expect(banco.listarTagsDoEvento(id)).toEqual(['nova']);
      expect(banco.obterCorIndexDaTag('nova')).toBe(7);
      expect(banco.obterCorIndexDaTag('antiga')).toBeNull();
    });

    it('mesclagem (nome novo já existia) preserva a cor da tag de DESTINO', () => {
      const idOrigem = banco.salvarRegistro('native-1', ['trampo']);
      const idDestino = banco.salvarRegistro('native-2', ['trabalho']);
      banco.definirTagsDoEvento(idOrigem, ['trampo']);
      banco.definirTagsDoEvento(idDestino, ['trabalho']);
      banco.definirCorDaTag('trampo', 2);
      banco.definirCorDaTag('trabalho', 5);

      banco.renomearOuMesclarTag('trampo', 'trabalho');

      expect(banco.listarTagsDoEvento(idOrigem)).toEqual(['trabalho']);
      expect(banco.listarTagsDoEvento(idDestino)).toEqual(['trabalho']);
      expect(banco.obterCorIndexDaTag('trabalho')).toBe(5); // destino prevalece
      expect(banco.listarTagsUnicas()).toEqual(['trabalho']); // "trampo" não existe mais
    });

    it('mesclagem não duplica o vínculo se o evento de origem já tinha a tag de destino também', () => {
      const id = banco.salvarRegistro('native-1', ['trampo', 'trabalho']);
      banco.definirTagsDoEvento(id, ['trampo', 'trabalho']);

      banco.renomearOuMesclarTag('trampo', 'trabalho');

      // INSERT OR IGNORE evita o vínculo duplicado evento+tag.
      expect(banco.listarTagsDoEvento(id)).toEqual(['trabalho']);
    });
  });

  describe('apagarTagDeTodosOsEventos', () => {
    it('remove a tag de todos os eventos e sua cor', () => {
      const id1 = banco.salvarRegistro('native-1', ['trabalho']);
      const id2 = banco.salvarRegistro('native-2', ['trabalho', 'pessoal']);
      banco.definirTagsDoEvento(id1, ['trabalho']);
      banco.definirTagsDoEvento(id2, ['trabalho', 'pessoal']);

      banco.apagarTagDeTodosOsEventos('trabalho');

      expect(banco.listarTagsDoEvento(id1)).toEqual([]);
      expect(banco.listarTagsDoEvento(id2)).toEqual(['pessoal']);
      expect(banco.obterCorIndexDaTag('trabalho')).toBeNull();
    });
  });
});
