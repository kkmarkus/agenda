import { db } from './db';
import { garantirCorDaTag } from './tagsRepository';
import {
  migrarTagParaOpcional,
  migrarColunaFixado,
  migrarParaTagsMultiplas,
  migrarDuplicatasDeTagsPorCase,
} from './migrations';

// Cria as tabelas se não existirem e roda as migrações pra bancos já
// existentes de versões antigas do app. Chamado uma vez na inicialização.
export function initDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      native_event_id TEXT NOT NULL UNIQUE,
      tag TEXT,
      created_at TEXT NOT NULL,
      fixado INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tag_cores (
      tag TEXT PRIMARY KEY,
      cor_index INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calendarios_sync (
      calendar_id TEXT PRIMARY KEY,
      ativo INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS preferencias (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evento_tags (
      evento_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (evento_id, tag),
      FOREIGN KEY (evento_id) REFERENCES eventos(id)
    );
  `);

  // Ordem importa: cada migração assume que a anterior já rodou.
  migrarTagParaOpcional();
  migrarColunaFixado();
  migrarParaTagsMultiplas();
  migrarDuplicatasDeTagsPorCase();

  // Garante que toda tag em uso já tenha uma cor atribuída (ex: tags que
  // vieram de um backup restaurado).
  const tagsSemCor = db.getAllSync<{ tag: string }>(
    `SELECT DISTINCT tag FROM evento_tags WHERE tag NOT IN (SELECT tag FROM tag_cores);`
  );
  tagsSemCor.forEach((linha) => garantirCorDaTag(linha.tag));
}

export * from './eventosRepository';
export * from './tagsRepository';
export * from './calendariosSyncRepository';
export * from './preferenciasRepository';
export * from './backupRepository';
