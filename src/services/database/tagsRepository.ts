import { db } from './db';
import { TOTAL_CORES_TAG } from '../../theme/theme';

export const SEM_TAG_LABEL = 'Sem tag';

export function normalizarTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function obterGrafiaCanonicaDaTag(tagBruta: string): string {
  return criarResolvedorDeGrafiaCanonica()(tagBruta);
}

// Devolve uma função que resolve a grafia "oficial" de uma tag: a
// primeira grafia já usada no banco pra aquela tag (case-insensitive).
// Assim "Trabalho" e "trabalho" sempre viram a mesma tag exibida com a
// mesma grafia, em vez de duplicar. Feito como fábrica (e não uma função
// direta) pra reaproveitar o mesmo mapa em várias chamadas de uma vez,
// sem reconsultar o banco a cada tag.
export function criarResolvedorDeGrafiaCanonica(): (tagBruta: string) => string {
  const mapa = new Map<string, string>();
  db.getAllSync<{ tag: string }>(`SELECT DISTINCT tag FROM evento_tags;`).forEach((l) => {
    const chave = normalizarTag(l.tag);
    if (!mapa.has(chave)) mapa.set(chave, l.tag);
  });
  return (tagBruta: string) => {
    const tagLimpa = tagBruta.trim();
    const chave = normalizarTag(tagLimpa);
    const existente = mapa.get(chave);
    if (existente) return existente;
    mapa.set(chave, tagLimpa);
    return tagLimpa;
  };
}

export function obterCorIndexDaTag(tag: string): number | null {
  const linha = db.getFirstSync<{ cor_index: number }>(
    `SELECT cor_index FROM tag_cores WHERE tag = ?;`,
    [normalizarTag(tag)]
  );
  return linha ? linha.cor_index : null;
}

export function definirCorDaTag(tag: string, corIndex: number): void {
  db.runSync(
    `INSERT INTO tag_cores (tag, cor_index) VALUES (?, ?)
     ON CONFLICT(tag) DO UPDATE SET cor_index = excluded.cor_index;`,
    [normalizarTag(tag), corIndex]
  );
}

// Atribui uma cor ainda não usada a uma tag nova (round-robin pelas
// cores disponíveis). Se todas já estiverem em uso, volta a distribuir
// ciclicamente em vez de travar sem cor.
export function garantirCorDaTag(tag: string): void {
  if (obterCorIndexDaTag(tag) !== null) return;
  const usados = new Set(
    db.getAllSync<{ cor_index: number }>(`SELECT cor_index FROM tag_cores;`).map((l) => l.cor_index)
  );
  let proximoIndex = 0;
  while (usados.has(proximoIndex) && proximoIndex < TOTAL_CORES_TAG) proximoIndex += 1;
  if (proximoIndex >= TOTAL_CORES_TAG) proximoIndex = usados.size % TOTAL_CORES_TAG;
  definirCorDaTag(tag, proximoIndex);
}

export function listarCoresDeTags(): Record<string, number> {
  const linhas = db.getAllSync<{ tag: string; cor_index: number }>(`SELECT tag, cor_index FROM tag_cores;`);
  const mapa: Record<string, number> = {};
  linhas.forEach((l) => {
    mapa[l.tag] = l.cor_index;
  });
  return mapa;
}

// Substitui todas as tags de um evento pelas informadas, resolvendo cada
// uma pra sua grafia canônica e evitando duplicar tags equivalentes
// (mesma tag digitada com capitalização diferente).
export function definirTagsDoEvento(eventoId: number, tags: string[]): void {
  const tagsBrutas = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));

  const resolverGrafiaCanonica = criarResolvedorDeGrafiaCanonica();
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM evento_tags WHERE evento_id = ?;`, [eventoId]);

    const jaInseridas = new Set<string>();
    tagsBrutas.forEach((tBruta) => {
      const tCanonica = resolverGrafiaCanonica(tBruta);
      const chave = normalizarTag(tCanonica);
      if (jaInseridas.has(chave)) return;
      jaInseridas.add(chave);
      db.runSync(`INSERT OR IGNORE INTO evento_tags (evento_id, tag) VALUES (?, ?);`, [eventoId, tCanonica]);
      garantirCorDaTag(tCanonica);
    });
  });
}

export function listarTagsDoEvento(eventoId: number): string[] {
  const linhas = db.getAllSync<{ tag: string }>(
    `SELECT tag FROM evento_tags WHERE evento_id = ? ORDER BY rowid ASC;`,
    [eventoId]
  );
  return linhas.map((l) => l.tag);
}

// Lista todas as tags únicas em uso, uma entrada por tag (case-insensitive).
export function listarTagsUnicas(): string[] {
  const linhas = db.getAllSync<{ tag: string }>(
    `SELECT DISTINCT tag FROM evento_tags ORDER BY tag COLLATE NOCASE;`
  );

  const vistas = new Set<string>();
  const unicas: string[] = [];
  linhas.forEach((l) => {
    const chave = normalizarTag(l.tag);
    if (vistas.has(chave)) return;
    vistas.add(chave);
    unicas.push(l.tag);
  });
  return unicas;
}

export function contarPorTag(): { tag: string | null; total: number }[] {
  const comTag = db.getAllSync<{ tag: string; total: number }>(
    `SELECT tag, COUNT(*) as total FROM evento_tags GROUP BY tag COLLATE NOCASE ORDER BY tag COLLATE NOCASE;`
  );
  const semTag = db.getFirstSync<{ total: number }>(
    `SELECT COUNT(*) as total FROM eventos e
     WHERE NOT EXISTS (SELECT 1 FROM evento_tags et WHERE et.evento_id = e.id);`
  );
  const resultado: { tag: string | null; total: number }[] = [...comTag];

  if (semTag && semTag.total > 0) resultado.push({ tag: null, total: semTag.total });
  return resultado;
}

// Renomeia uma tag; se o novo nome já existir (mesma chave normalizada)
// vira uma mesclagem: os eventos da tag antiga passam a usar a existente,
// e a cor/registro da tag antiga é descartado.
export function renomearOuMesclarTag(tagAntiga: string, tagNovaBruta: string): void {
  const tagNova = tagNovaBruta.trim();
  if (!tagNova) return;

  const chaveAntiga = normalizarTag(tagAntiga);
  const chaveNova = normalizarTag(tagNova);
  if (chaveAntiga === chaveNova) {
    // Só mudou a capitalização/espaços: renomeia in-place, sem mesclar.
    db.withTransactionSync(() => {
      db.runSync(`UPDATE evento_tags SET tag = ? WHERE tag = ?;`, [tagNova, tagAntiga]);
    });
    return;
  }

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT OR IGNORE INTO evento_tags (evento_id, tag) SELECT evento_id, ? FROM evento_tags WHERE tag = ?;`,
      [tagNova, tagAntiga]
    );
    db.runSync(`DELETE FROM evento_tags WHERE tag = ?;`, [tagAntiga]);

    const corNovaJaExiste = obterCorIndexDaTag(chaveNova) !== null;
    if (corNovaJaExiste) {
      // Mesclagem: a cor da tag de destino prevalece, descarta a da antiga.
      db.runSync(`DELETE FROM tag_cores WHERE tag = ?;`, [chaveAntiga]);
    } else {
      // Renomeação de fato (tag nova ainda não tinha cor): reaproveita a cor.
      db.runSync(`UPDATE tag_cores SET tag = ? WHERE tag = ?;`, [chaveNova, chaveAntiga]);
    }
  });
}

export function apagarTagDeTodosOsEventos(tag: string): void {
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM evento_tags WHERE tag = ?;`, [tag]);
    db.runSync(`DELETE FROM tag_cores WHERE tag = ?;`, [normalizarTag(tag)]);
  });
}
