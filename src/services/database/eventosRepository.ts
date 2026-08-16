import { db } from './db';
import { definirTagsDoEvento } from './tagsRepository';

export interface RegistroEvento {
  id: number;
  nativeEventId: string;
  tags: string[];
  fixado: boolean;
}

// Cria o registro local do evento (que aponta pro evento real na agenda
// nativa via `nativeEventId`) e associa as tags a ele.
export function salvarRegistro(nativeEventId: string, tags: string[]): number {
  const resultado = db.runSync(
    `INSERT INTO eventos (native_event_id, created_at) VALUES (?, ?);`,
    [nativeEventId, new Date().toISOString()]
  );
  definirTagsDoEvento(resultado.lastInsertRowId, tags);
  return resultado.lastInsertRowId;
}

export function listarRegistros(): RegistroEvento[] {
  const linhas = db.getAllSync<{ id: number; native_event_id: string; fixado: number }>(
    `SELECT id, native_event_id, fixado FROM eventos ORDER BY created_at DESC, id DESC;`
  );

  // Busca todas as tags de uma vez (em vez de uma query por evento) e
  // agrupa em memória, bem mais rápido pra listas grandes.
  const tagLinhas = db.getAllSync<{ evento_id: number; tag: string }>(
    `SELECT evento_id, tag FROM evento_tags ORDER BY rowid ASC;`
  );
  const tagsPorEvento = new Map<number, string[]>();
  tagLinhas.forEach((l) => {
    const lista = tagsPorEvento.get(l.evento_id) ?? [];
    lista.push(l.tag);
    tagsPorEvento.set(l.evento_id, lista);
  });
  return linhas.map((l) => ({
    id: l.id,
    nativeEventId: l.native_event_id,
    tags: tagsPorEvento.get(l.id) ?? [],
    fixado: l.fixado === 1,
  }));
}

export function alternarFixado(id: number): void {
  db.runSync(`UPDATE eventos SET fixado = 1 - fixado WHERE id = ?;`, [id]);
}

export function listarNativeIdsRegistrados(): Set<string> {
  const linhas = db.getAllSync<{ native_event_id: string }>(`SELECT native_event_id FROM eventos;`);
  return new Set(linhas.map((l) => l.native_event_id));
}

export function apagarRegistro(id: number): void {
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM evento_tags WHERE evento_id = ?;`, [id]);
    db.runSync(`DELETE FROM eventos WHERE id = ?;`, [id]);
  });
}

export function atualizarTagsPorNativeId(nativeEventId: string, tags: string[]): void {
  const registro = db.getFirstSync<{ id: number }>(
    `SELECT id FROM eventos WHERE native_event_id = ?;`,
    [nativeEventId]
  );
  if (!registro) return;
  definirTagsDoEvento(registro.id, tags);
}
