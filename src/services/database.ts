import * as SQLite from 'expo-sqlite';
import { TOTAL_CORES_TAG } from '../theme/theme';

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
    CREATE TABLE IF NOT EXISTS tag_cores (
      tag TEXT PRIMARY KEY,
      cor_index INTEGER NOT NULL
    );
  `);

  // Migração: quem já tinha eventos salvos antes dessa tabela existir tem
  // tags sem nenhuma cor gravada ainda. Preenchemos aqui, uma vez, pra elas
  // não aparecerem todas na mesma cor até o próximo evento ser editado.
  const tagsSemCor = db.getAllSync<{ tag: string }>(
    `SELECT DISTINCT tag FROM eventos WHERE tag NOT IN (SELECT tag FROM tag_cores);`
  );
  tagsSemCor.forEach((linha) => garantirCorDaTag(linha.tag));
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
  garantirCorDaTag(tag);
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
 * Atualiza a tag de um registro já existente (usado no fluxo de edição,
 * quando ela decide reclassificar um evento que já estava salvo).
 */
export function atualizarTagPorNativeId(nativeEventId: string, tag: string): void {
  db.runSync(`UPDATE eventos SET tag = ? WHERE native_event_id = ?;`, [tag, nativeEventId]);
  garantirCorDaTag(tag);
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

// --- Cores de tag ---
// Antes a cor de cada tag era só um índice calculado na hora (posição na
// lista), então não existia nada pra "mudar": a cor mudava sozinha se a
// ordem das tags mudasse, e não tinha como ela escolher uma cor fixa.
// Agora a cor fica gravada aqui, por tag, e só muda quando ela escolhe.

function normalizarTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function obterCorIndexDaTag(tag: string): number | null {
  const linha = db.getFirstSync<{ cor_index: number }>(
    `SELECT cor_index FROM tag_cores WHERE tag = ?;`,
    [normalizarTag(tag)]
  );
  return linha ? linha.cor_index : null;
}

/** Define/sobrescreve a cor de uma tag — usado quando ela escolhe manualmente. */
export function definirCorDaTag(tag: string, corIndex: number): void {
  db.runSync(
    `INSERT INTO tag_cores (tag, cor_index) VALUES (?, ?)
     ON CONFLICT(tag) DO UPDATE SET cor_index = excluded.cor_index;`,
    [normalizarTag(tag), corIndex]
  );
}

/** Garante que toda tag tenha uma cor assim que é usada pela primeira vez
 * (round-robin pela paleta), sem sobrescrever uma cor já escolhida. */
function garantirCorDaTag(tag: string): void {
  if (obterCorIndexDaTag(tag) !== null) return;
  const linha = db.getFirstSync<{ total: number }>(`SELECT COUNT(*) as total FROM tag_cores;`);
  const proximoIndex = (linha?.total ?? 0) % TOTAL_CORES_TAG;
  definirCorDaTag(tag, proximoIndex);
}

/** Mapa tag (normalizada) -> índice de cor, pra lookup em lote no Dashboard
 * (evita uma query por card na lista). */
export function listarCoresDeTags(): Record<string, number> {
  const linhas = db.getAllSync<{ tag: string; cor_index: number }>(`SELECT tag, cor_index FROM tag_cores;`);
  const mapa: Record<string, number> = {};
  linhas.forEach((l) => {
    mapa[l.tag] = l.cor_index;
  });
  return mapa;
}
