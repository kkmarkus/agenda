import * as SQLite from 'expo-sqlite';
import { TOTAL_CORES_TAG } from '../theme/theme';

// Guardamos SÓ o id do evento nativo + a tag.
// Título, data e descrição NUNCA são duplicados aqui — sempre vêm ao vivo
// da agenda nativa (via calendarService), para nunca ficarem desatualizados.
const db = SQLite.openDatabaseSync('agenda-app.db');

// Rótulo usado em toda a UI (Dashboard, Tags) pra representar eventos sem
// tag — tanto os criados pelo app sem preencher tag quanto os importados
// via sincronização de calendário (que nunca vêm com tag nenhuma).
export const SEM_TAG_LABEL = 'Sem tag';

export function initDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      native_event_id TEXT NOT NULL UNIQUE,
      tag TEXT,
      created_at TEXT NOT NULL
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
  `);

  migrarTagParaOpcional();

  // Migração: quem já tinha eventos salvos antes dessa tabela existir tem
  // tags sem nenhuma cor gravada ainda. Preenchemos aqui, uma vez, pra elas
  // não aparecerem todas na mesma cor até o próximo evento ser editado.
  const tagsSemCor = db.getAllSync<{ tag: string }>(
    `SELECT DISTINCT tag FROM eventos WHERE tag IS NOT NULL AND tag NOT IN (SELECT tag FROM tag_cores);`
  );
  tagsSemCor.forEach((linha) => garantirCorDaTag(linha.tag));
}

// MUDANÇA: tag deixou de ser obrigatória (NOT NULL) no schema. Quem já
// tinha o app instalado antes dessa mudança está com a tabela antiga
// (coluna `tag TEXT NOT NULL`) — o CREATE TABLE IF NOT EXISTS acima não
// altera uma tabela que já existe, então precisamos migrar manualmente.
// SQLite não tem "ALTER COLUMN ... DROP NOT NULL" direto; o caminho
// padrão é recriar a tabela sem a restrição e copiar os dados.
function migrarTagParaOpcional(): void {
  const colunas = db.getAllSync<{ name: string; notnull: number }>(`PRAGMA table_info(eventos);`);
  const colunaTag = colunas.find((c) => c.name === 'tag');
  if (!colunaTag || colunaTag.notnull !== 1) return; // já está opcional (ou tabela nova)

  db.execSync(`
    CREATE TABLE eventos_novo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      native_event_id TEXT NOT NULL UNIQUE,
      tag TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO eventos_novo (id, native_event_id, tag, created_at)
      SELECT id, native_event_id, tag, created_at FROM eventos;
    DROP TABLE eventos;
    ALTER TABLE eventos_novo RENAME TO eventos;
  `);
}

export interface RegistroEvento {
  id: number;
  nativeEventId: string;
  tag: string | null;
}

export function salvarRegistro(nativeEventId: string, tag: string | null): void {
  db.runSync(
    `INSERT INTO eventos (native_event_id, tag, created_at) VALUES (?, ?, ?);`,
    [nativeEventId, tag, new Date().toISOString()]
  );
  if (tag) garantirCorDaTag(tag);
}

export function listarRegistros(): RegistroEvento[] {
  const linhas = db.getAllSync<{ id: number; native_event_id: string; tag: string | null }>(
    `SELECT id, native_event_id, tag FROM eventos ORDER BY created_at DESC;`
  );
  return linhas.map((l) => ({ id: l.id, nativeEventId: l.native_event_id, tag: l.tag }));
}

/** Ids nativos (agenda do Android) de tudo que já está registrado no app —
 * usado pela sincronização pra saber quais eventos importados já existem
 * e evitar duplicar registro pra um evento já conhecido. */
export function listarNativeIdsRegistrados(): Set<string> {
  const linhas = db.getAllSync<{ native_event_id: string }>(`SELECT native_event_id FROM eventos;`);
  return new Set(linhas.map((l) => l.native_event_id));
}

export function apagarRegistro(id: number): void {
  db.runSync(`DELETE FROM eventos WHERE id = ?;`, [id]);
}

/**
 * Atualiza a tag de um registro já existente (usado no fluxo de edição,
 * quando ela decide reclassificar um evento que já estava salvo).
 */
export function atualizarTagPorNativeId(nativeEventId: string, tag: string | null): void {
  db.runSync(`UPDATE eventos SET tag = ? WHERE native_event_id = ?;`, [tag, nativeEventId]);
  if (tag) garantirCorDaTag(tag);
}

/**
 * Retorna as tags já usadas, sem repetição — alimenta o autocomplete
 * na tela de confirmação, evitando variações tipo "Universidade" vs "universidade".
 * Eventos sem tag (null) não entram aqui — "Sem tag" não é uma tag de
 * verdade que faça sentido sugerir/reaproveitar no autocomplete.
 */
export function listarTagsUnicas(): string[] {
  const linhas = db.getAllSync<{ tag: string }>(
    `SELECT DISTINCT tag FROM eventos WHERE tag IS NOT NULL ORDER BY tag COLLATE NOCASE;`
  );
  return linhas.map((l) => l.tag);
}

/**
 * Agrupa os registros por tag, contando quantos eventos cada uma tem.
 * Usado na tela de Tags. Eventos sem tag caem no grupo `tag: null` — o
 * SQLite já agrupa NULLs juntos automaticamente (GROUP BY trata todo NULL
 * como uma única categoria), então isso vem de graça da query; só
 * ordenamos pra esse grupo aparecer por último, não misturado
 * alfabeticamente entre as tags de verdade.
 */
export function contarPorTag(): { tag: string | null; total: number }[] {
  return db.getAllSync<{ tag: string | null; total: number }>(
    `SELECT tag, COUNT(*) as total FROM eventos GROUP BY tag COLLATE NOCASE ORDER BY tag IS NULL, tag COLLATE NOCASE;`
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

// --- Sincronização com outros calendários nativos ---
// Guarda só QUAIS calendários (fora o "Meus Eventos (App)") ela escolheu
// importar. A sincronização em si (buscar eventos, comparar com o que já
// existe) fica em calendarService.ts + na tela de Dashboard — aqui é só
// a preferência de quais calendários estão ligados.

export function listarCalendariosSincronizadosAtivos(): string[] {
  const linhas = db.getAllSync<{ calendar_id: string }>(
    `SELECT calendar_id FROM calendarios_sync WHERE ativo = 1;`
  );
  return linhas.map((l) => l.calendar_id);
}

export function obterPreferenciasSincronizacao(): Record<string, boolean> {
  const linhas = db.getAllSync<{ calendar_id: string; ativo: number }>(
    `SELECT calendar_id, ativo FROM calendarios_sync;`
  );
  const mapa: Record<string, boolean> = {};
  linhas.forEach((l) => {
    mapa[l.calendar_id] = l.ativo === 1;
  });
  return mapa;
}

export function definirSincronizacaoDoCalendario(calendarId: string, ativo: boolean): void {
  db.runSync(
    `INSERT INTO calendarios_sync (calendar_id, ativo) VALUES (?, ?)
     ON CONFLICT(calendar_id) DO UPDATE SET ativo = excluded.ativo;`,
    [calendarId, ativo ? 1 : 0]
  );
}

// --- Preferências gerais (tema, cor de destaque, etc.) ---
// Tabela chave/valor genérica: qualquer preferência simples de app que
// precise persistir entre aberturas usa isso, sem precisar de uma tabela
// dedicada nova pra cada preferência futura (tema e cor de acento hoje;
// o que mais surgir amanhã reaproveita o mesmo par de funções).

export function obterPreferencia(chave: string): string | null {
  const linha = db.getFirstSync<{ valor: string }>(`SELECT valor FROM preferencias WHERE chave = ?;`, [chave]);
  return linha ? linha.valor : null;
}

export function definirPreferencia(chave: string, valor: string): void {
  db.runSync(
    `INSERT INTO preferencias (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor;`,
    [chave, valor]
  );
}
