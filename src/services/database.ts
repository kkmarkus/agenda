import * as SQLite from 'expo-sqlite';

// Guardamos SÓ o id do evento nativo + a tag.
// Título, data e descrição NUNCA são duplicados aqui — sempre vêm ao vivo
// da agenda nativa (via calendarService), para nunca ficarem desatualizados.
const db = SQLite.openDatabaseSync('agenda-app.db');

export function initDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      native_event_id TEXT NOT NULL UNIQUE,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export interface RegistroEvento {
  id: number;
  nativeEventId: string;
  tag: string;
}

export function salvarRegistro(nativeEventId: string, tag: string): void {
  db.runSync(
    `INSERT INTO eventos (native_event_id, tag, created_at) VALUES (?, ?, ?);`,
    [nativeEventId, tag, new Date().toISOString()]
  );
}

export function listarRegistros(): RegistroEvento[] {
  const linhas = db.getAllSync<{ id: number; native_event_id: string; tag: string }>(
    `SELECT id, native_event_id, tag FROM eventos ORDER BY created_at DESC;`
  );
  return linhas.map((l) => ({ id: l.id, nativeEventId: l.native_event_id, tag: l.tag }));
}

export function apagarRegistro(id: number): void {
  db.runSync(`DELETE FROM eventos WHERE id = ?;`, [id]);
}

/**
 * Retorna as tags já usadas, sem repetição — alimenta o autocomplete
 * na tela de confirmação, evitando variações tipo "Universidade" vs "universidade".
 */
export function listarTagsUnicas(): string[] {
  const linhas = db.getAllSync<{ tag: string }>(
    `SELECT DISTINCT tag FROM eventos ORDER BY tag COLLATE NOCASE;`
  );
  return linhas.map((l) => l.tag);
}

/**
 * Agrupa os registros por tag, contando quantos eventos cada uma tem.
 * Usado na tela de Tags.
 */
export function contarPorTag(): { tag: string; total: number }[] {
  return db.getAllSync<{ tag: string; total: number }>(
    `SELECT tag, COUNT(*) as total FROM eventos GROUP BY tag COLLATE NOCASE ORDER BY tag COLLATE NOCASE;`
  );
}
