import { criarBancoDeTeste, criarConexaoDeTesteSemInit } from './testUtils';

describe('migrations', () => {
  it('rodar initDatabase duas vezes seguidas não falha nem duplica nada', () => {
    const banco = criarBancoDeTeste();
    banco.salvarRegistro('native-1', ['trabalho']);

    expect(() => banco.initDatabase()).not.toThrow();

    expect(banco.listarRegistros()).toHaveLength(1);
  });

  describe('migrarTagParaOpcional', () => {
    it('torna a coluna tag opcional e preserva os dados existentes', () => {
      const { db, migrations } = criarConexaoDeTesteSemInit();

      // Simula o schema antigo: `tag` era NOT NULL.
      db.execSync(`
        CREATE TABLE eventos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          native_event_id TEXT NOT NULL UNIQUE,
          tag TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      db.runSync(`INSERT INTO eventos (native_event_id, tag, created_at) VALUES (?, ?, ?);`, [
        'native-1',
        'trabalho',
        '2026-01-01',
      ]);

      migrations.migrarTagParaOpcional();

      const colunas = db.getAllSync<{ name: string; notnull: number }>(`PRAGMA table_info(eventos);`);
      const colunaTag = colunas.find((c) => c.name === 'tag');
      expect(colunaTag?.notnull).toBe(0);

      const linhas = db.getAllSync<{ native_event_id: string; tag: string }>(`SELECT native_event_id, tag FROM eventos;`);
      expect(linhas).toEqual([{ native_event_id: 'native-1', tag: 'trabalho' }]);
    });

    it('não faz nada se a coluna já é opcional (idempotente)', () => {
      const { db, migrations } = criarConexaoDeTesteSemInit();
      db.execSync(`
        CREATE TABLE eventos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          native_event_id TEXT NOT NULL UNIQUE,
          tag TEXT,
          created_at TEXT NOT NULL
        );
      `);
      expect(() => migrations.migrarTagParaOpcional()).not.toThrow();
      expect(() => migrations.migrarTagParaOpcional()).not.toThrow();
    });
  });

  describe('migrarColunaFixado', () => {
    it('adiciona a coluna fixado com padrão 0 quando ainda não existe', () => {
      const { db, migrations } = criarConexaoDeTesteSemInit();
      db.execSync(`
        CREATE TABLE eventos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          native_event_id TEXT NOT NULL UNIQUE,
          tag TEXT,
          created_at TEXT NOT NULL
        );
      `);
      db.runSync(`INSERT INTO eventos (native_event_id, created_at) VALUES (?, ?);`, [
        'native-1',
        '2026-01-01',
      ]);

      migrations.migrarColunaFixado();

      const linha = db.getFirstSync<{ fixado: number }>(`SELECT fixado FROM eventos WHERE native_event_id = ?;`, [
        'native-1',
      ]);
      expect(linha?.fixado).toBe(0);
    });

    it('não falha se a coluna já existe (idempotente)', () => {
      const { db, migrations } = criarConexaoDeTesteSemInit();
      db.execSync(`
        CREATE TABLE eventos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          native_event_id TEXT NOT NULL UNIQUE,
          tag TEXT,
          created_at TEXT NOT NULL,
          fixado INTEGER NOT NULL DEFAULT 0
        );
      `);
      expect(() => migrations.migrarColunaFixado()).not.toThrow();
      expect(() => migrations.migrarColunaFixado()).not.toThrow();
    });
  });

  describe('migrarParaTagsMultiplas', () => {
    it('copia a tag única antiga pra evento_tags e marca a preferência pra não rodar de novo', () => {
      const { db, migrations, database } = criarConexaoDeTesteSemInit();
      db.execSync(`
        CREATE TABLE eventos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          native_event_id TEXT NOT NULL UNIQUE,
          tag TEXT,
          created_at TEXT NOT NULL,
          fixado INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE evento_tags (
          evento_id INTEGER NOT NULL,
          tag TEXT NOT NULL,
          PRIMARY KEY (evento_id, tag)
        );
        CREATE TABLE preferencias (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
      `);
      db.runSync(`INSERT INTO eventos (native_event_id, tag, created_at) VALUES (?, ?, ?);`, [
        'native-1',
        'trabalho',
        '2026-01-01',
      ]);

      migrations.migrarParaTagsMultiplas();

      const vinculos = db.getAllSync<{ evento_id: number; tag: string }>(`SELECT * FROM evento_tags;`);
      expect(vinculos).toEqual([{ evento_id: 1, tag: 'trabalho' }]);

      // Rodar de novo não duplica (preferência já marcada).
      migrations.migrarParaTagsMultiplas();
      expect(db.getAllSync(`SELECT * FROM evento_tags;`)).toHaveLength(1);

      expect(database.obterPreferencia('migrou_evento_tags_multiplas')).toBe('1');
    });
  });

  describe('migrarDuplicatasDeTagsPorCase', () => {
    it('unifica duplicatas de tag por capitalização na primeira grafia encontrada', () => {
      const { db, migrations, database } = criarConexaoDeTesteSemInit();
      db.execSync(`
        CREATE TABLE eventos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          native_event_id TEXT NOT NULL UNIQUE,
          tag TEXT,
          created_at TEXT NOT NULL,
          fixado INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE evento_tags (
          evento_id INTEGER NOT NULL,
          tag TEXT NOT NULL,
          PRIMARY KEY (evento_id, tag)
        );
        CREATE TABLE preferencias (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
      `);
      db.runSync(`INSERT INTO eventos (native_event_id, created_at) VALUES (?, ?);`, ['native-1', '2026-01-01']);
      db.runSync(`INSERT INTO eventos (native_event_id, created_at) VALUES (?, ?);`, ['native-2', '2026-01-02']);
      // "Trabalho" foi a primeira grafia usada; "trabalho" é duplicata.
      db.runSync(`INSERT INTO evento_tags (evento_id, tag) VALUES (1, 'Trabalho');`);
      db.runSync(`INSERT INTO evento_tags (evento_id, tag) VALUES (2, 'trabalho');`);

      migrations.migrarDuplicatasDeTagsPorCase();

      const tags = db
        .getAllSync<{ tag: string }>(`SELECT tag FROM evento_tags ORDER BY evento_id;`)
        .map((l) => l.tag);
      expect(tags).toEqual(['Trabalho', 'Trabalho']);
      expect(database.obterPreferencia('migrou_duplicatas_tag_case')).toBe('1');
    });

    it('não mexe em nada se não há duplicatas (mas marca a preferência)', () => {
      const { db, migrations, database } = criarConexaoDeTesteSemInit();
      db.execSync(`
        CREATE TABLE eventos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          native_event_id TEXT NOT NULL UNIQUE,
          tag TEXT,
          created_at TEXT NOT NULL,
          fixado INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE evento_tags (
          evento_id INTEGER NOT NULL,
          tag TEXT NOT NULL,
          PRIMARY KEY (evento_id, tag)
        );
        CREATE TABLE preferencias (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
      `);
      db.runSync(`INSERT INTO eventos (native_event_id, created_at) VALUES (?, ?);`, ['native-1', '2026-01-01']);
      db.runSync(`INSERT INTO evento_tags (evento_id, tag) VALUES (1, 'trabalho');`);

      migrations.migrarDuplicatasDeTagsPorCase();

      expect(db.getAllSync(`SELECT * FROM evento_tags;`)).toHaveLength(1);
      expect(database.obterPreferencia('migrou_duplicatas_tag_case')).toBe('1');
    });
  });
});
