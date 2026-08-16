import { db } from './db';
import { obterPreferencia, definirPreferencia } from './preferenciasRepository';
import { normalizarTag } from './tagsRepository';

// SQLite não tem "ALTER COLUMN": pra tornar `tag` opcional numa tabela
// antiga onde era NOT NULL, recria a tabela do zero e copia os dados.
export function migrarTagParaOpcional(): void {
  const colunas = db.getAllSync<{ name: string; notnull: number }>(`PRAGMA table_info(eventos);`);
  const colunaTag = colunas.find((c) => c.name === 'tag');
  if (!colunaTag || colunaTag.notnull !== 1) return;

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

export function migrarColunaFixado(): void {
  const colunas = db.getAllSync<{ name: string }>(`PRAGMA table_info(eventos);`);
  const jaTem = colunas.some((c) => c.name === 'fixado');
  if (jaTem) return;
  db.execSync(`ALTER TABLE eventos ADD COLUMN fixado INTEGER NOT NULL DEFAULT 0;`);
}

const PREF_MIGROU_EVENTO_TAGS = 'migrou_evento_tags_multiplas';

// Copia a tag única antiga (coluna `tag` de `eventos`) pra tabela nova de
// tags múltiplas (`evento_tags`). Marca uma preferência pra não rodar de novo.
export function migrarParaTagsMultiplas(): void {
  if (obterPreferencia(PREF_MIGROU_EVENTO_TAGS) === '1') return;

  const eventosComTag = db.getAllSync<{ id: number; tag: string }>(
    `SELECT id, tag FROM eventos WHERE tag IS NOT NULL;`
  );
  db.withTransactionSync(() => {
    eventosComTag.forEach((e) => {
      db.runSync(`INSERT OR IGNORE INTO evento_tags (evento_id, tag) VALUES (?, ?);`, [e.id, e.tag]);
    });
  });
  definirPreferencia(PREF_MIGROU_EVENTO_TAGS, '1');
}

const PREF_MIGROU_CASE_TAGS = 'migrou_duplicatas_tag_case';

// Antes da comparação case-insensitive de tags existir, "Trabalho" e
// "trabalho" podiam coexistir como tags diferentes. Aqui unifica cada
// grupo de duplicatas na primeira grafia encontrada (por rowid).
export function migrarDuplicatasDeTagsPorCase(): void {
  if (obterPreferencia(PREF_MIGROU_CASE_TAGS) === '1') return;

  const linhas = db.getAllSync<{ evento_id: number; tag: string; rowid: number }>(
    `SELECT evento_id, tag, rowid FROM evento_tags ORDER BY rowid ASC;`
  );

  const grafiaCanonica = new Map<string, string>();
  linhas.forEach((l) => {
    const chave = normalizarTag(l.tag);
    if (!grafiaCanonica.has(chave)) grafiaCanonica.set(chave, l.tag);
  });

  const temDuplicata = linhas.length > grafiaCanonica.size;
  if (!temDuplicata) {
    definirPreferencia(PREF_MIGROU_CASE_TAGS, '1');
    return;
  }

  const marcasVistas = new Set<string>();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM evento_tags;`);
    linhas.forEach((l) => {
      const chave = normalizarTag(l.tag);
      const marca = `${l.evento_id}::${chave}`;
      if (marcasVistas.has(marca)) return; // já reinserido esse par evento+tag
      marcasVistas.add(marca);
      db.runSync(`INSERT OR IGNORE INTO evento_tags (evento_id, tag) VALUES (?, ?);`, [
        l.evento_id,
        grafiaCanonica.get(chave)!,
      ]);
    });
  });

  definirPreferencia(PREF_MIGROU_CASE_TAGS, '1');
}
