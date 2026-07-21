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

  migrarTagParaOpcional();
  migrarColunaFixado();
  migrarParaTagsMultiplas();

  // Migração: quem já tinha eventos salvos antes dessa tabela existir tem
  // tags sem nenhuma cor gravada ainda. Preenchemos aqui, uma vez, pra elas
  // não aparecerem todas na mesma cor até o próximo evento ser editado.
  // MUDANÇA (item 4): a fonte de verdade de tag por evento passou a ser
  // `evento_tags`, não mais `eventos.tag` — ver migrarParaTagsMultiplas.
  const tagsSemCor = db.getAllSync<{ tag: string }>(
    `SELECT DISTINCT tag FROM evento_tags WHERE tag NOT IN (SELECT tag FROM tag_cores);`
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

// MUDANÇA (item 5): quem já tinha o app instalado antes desse item não tem
// a coluna `fixado`. Ao contrário da migração de `tag` acima, essa é
// simples — SQLite suporta `ALTER TABLE ... ADD COLUMN` direto, sem
// precisar recriar a tabela, desde que a coluna nova tenha um DEFAULT.
function migrarColunaFixado(): void {
  const colunas = db.getAllSync<{ name: string }>(`PRAGMA table_info(eventos);`);
  const jaTem = colunas.some((c) => c.name === 'fixado');
  if (jaTem) return;
  db.execSync(`ALTER TABLE eventos ADD COLUMN fixado INTEGER NOT NULL DEFAULT 0;`);
}

// Chave em `preferencias` usada só como flag de "já migrei" — precisa ser
// de execução única (ao contrário das migrações de schema acima, que se
// auto-detectam pela ausência de coluna/constraint). Sem essa flag, rodar
// a cópia de novo a cada abertura do app ressuscitaria tags que ela já
// tinha removido deliberadamente via `definirTagsDoEvento`, já que
// `eventos.tag` nunca é apagada (só deixa de ser escrita — ver comentário
// abaixo).
const PREF_MIGROU_EVENTO_TAGS = 'migrou_evento_tags_multiplas';

/**
 * MUDANÇA (item 4): copia, uma única vez, o conteúdo de `eventos.tag`
 * (coluna antiga, uma tag por evento) para `evento_tags` (nova tabela de
 * junção, várias tags por evento). Depois dessa migração, todo código novo
 * lê/escreve exclusivamente via `evento_tags` — `eventos.tag` continua
 * existindo na tabela só pra não quebrar um schema antigo em cache, mas
 * vira uma coluna morta (nunca mais lida nem escrita).
 */
function migrarParaTagsMultiplas(): void {
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

export interface RegistroEvento {
  id: number;
  nativeEventId: string;
  // MUDANÇA (item 4): tag única (string | null) virou lista — evento sem
  // nenhuma tag agora é `[]`, não mais `null`. `SEM_TAG_LABEL` continua
  // sendo o rótulo exibido nesse caso em toda a UI.
  tags: string[];
  fixado: boolean;
}

/**
 * Substitui todas as tags de um evento de uma vez: apaga as antigas e
 * insere as novas, numa transação (evita ficar num estado intermediário
 * "sem nenhuma tag" caso algo falhe no meio do caminho). Tags duplicadas
 * (mesmo texto exato) e vazias são descartadas antes de gravar. A ORDEM de
 * `tags` é preservada (via rowid de inserção) — importa pro traço lateral
 * segmentado do Dashboard, onde a primeira tag vira o segmento do topo.
 */
export function definirTagsDoEvento(eventoId: number, tags: string[]): void {
  const tagsLimpas = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM evento_tags WHERE evento_id = ?;`, [eventoId]);
    tagsLimpas.forEach((t) => {
      db.runSync(`INSERT OR IGNORE INTO evento_tags (evento_id, tag) VALUES (?, ?);`, [eventoId, t]);
      garantirCorDaTag(t);
    });
  });
}

/** Tags de um evento específico, na ordem em que foram adicionadas. */
export function listarTagsDoEvento(eventoId: number): string[] {
  const linhas = db.getAllSync<{ tag: string }>(
    `SELECT tag FROM evento_tags WHERE evento_id = ? ORDER BY rowid ASC;`,
    [eventoId]
  );
  return linhas.map((l) => l.tag);
}

export function salvarRegistro(nativeEventId: string, tags: string[]): void {
  const resultado = db.runSync(
    `INSERT INTO eventos (native_event_id, created_at) VALUES (?, ?);`,
    [nativeEventId, new Date().toISOString()]
  );
  definirTagsDoEvento(resultado.lastInsertRowId, tags);
}

export function listarRegistros(): RegistroEvento[] {
  const linhas = db.getAllSync<{ id: number; native_event_id: string; fixado: number }>(
    `SELECT id, native_event_id, fixado FROM eventos ORDER BY created_at DESC;`
  );
  // Uma query só pra todas as tags de todos os eventos (em vez de uma
  // query de tags por registro dentro do .map) — evita N+1 consultas numa
  // lista que já cresce razoável com o tempo.
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

/** Alterna o estado de fixado de um registro (fixar/desafixar) — usado na
 * ação de swipe do Dashboard. */
export function alternarFixado(id: number): void {
  db.runSync(`UPDATE eventos SET fixado = 1 - fixado WHERE id = ?;`, [id]);
}

/** Ids nativos (agenda do Android) de tudo que já está registrado no app —
 * usado pela sincronização pra saber quais eventos importados já existem
 * e evitar duplicar registro pra um evento já conhecido. */
export function listarNativeIdsRegistrados(): Set<string> {
  const linhas = db.getAllSync<{ native_event_id: string }>(`SELECT native_event_id FROM eventos;`);
  return new Set(linhas.map((l) => l.native_event_id));
}

export function apagarRegistro(id: number): void {
  // SQLite não faz cascade automático nas FKs aqui (não habilitamos
  // `PRAGMA foreign_keys`), então limpamos `evento_tags` manualmente —
  // senão sobram linhas órfãs apontando pra um evento_id que não existe
  // mais, que voltariam a poluir contagens/tags se um novo evento algum
  // dia reciclasse o mesmo id.
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM evento_tags WHERE evento_id = ?;`, [id]);
    db.runSync(`DELETE FROM eventos WHERE id = ?;`, [id]);
  });
}

/**
 * MUDANÇA (item 4): substitui `atualizarTagPorNativeId` (tag única) —
 * atualiza TODAS as tags de um registro já existente de uma vez (usado no
 * fluxo de edição, quando ela reclassifica um evento que já estava salvo).
 */
export function atualizarTagsPorNativeId(nativeEventId: string, tags: string[]): void {
  const registro = db.getFirstSync<{ id: number }>(
    `SELECT id FROM eventos WHERE native_event_id = ?;`,
    [nativeEventId]
  );
  if (!registro) return;
  definirTagsDoEvento(registro.id, tags);
}

/**
 * Retorna as tags já usadas, sem repetição — alimenta o autocomplete
 * na tela de confirmação, evitando variações tipo "Universidade" vs "universidade".
 * Eventos sem tag simplesmente não têm linha em `evento_tags`, então não
 * entram aqui — "Sem tag" não é uma tag de verdade que faça sentido
 * sugerir/reaproveitar no autocomplete.
 */
export function listarTagsUnicas(): string[] {
  const linhas = db.getAllSync<{ tag: string }>(
    `SELECT DISTINCT tag FROM evento_tags ORDER BY tag COLLATE NOCASE;`
  );
  return linhas.map((l) => l.tag);
}

/**
 * Agrupa os eventos por tag, contando quantos eventos cada uma tem. Usado
 * na tela de Tags. MUDANÇA (item 4): com múltiplas tags por evento, um
 * evento com 2 tags conta 1 em cada uma das duas — por isso a contagem
 * agora parte de `evento_tags` (uma linha por combinação evento+tag), não
 * mais de `eventos` (uma linha por evento). O grupo "sem tag" (`tag: null`)
 * é calculado à parte: eventos que não têm NENHUMA linha em `evento_tags`.
 */
export function contarPorTag(): { tag: string | null; total: number }[] {
  const comTag = db.getAllSync<{ tag: string; total: number }>(
    `SELECT tag, COUNT(*) as total FROM evento_tags GROUP BY tag COLLATE NOCASE ORDER BY tag COLLATE NOCASE;`
  );
  const semTag = db.getFirstSync<{ total: number }>(
    `SELECT COUNT(*) as total FROM eventos e
     WHERE NOT EXISTS (SELECT 1 FROM evento_tags et WHERE et.evento_id = e.id);`
  );
  const resultado: { tag: string | null; total: number }[] = [...comTag];
  // Só inclui o grupo "sem tag" se existir pelo menos um evento nele —
  // mesmo comportamento de antes (GROUP BY só produzia a linha NULL
  // quando havia algum evento sem tag).
  if (semTag && semTag.total > 0) resultado.push({ tag: null, total: semTag.total });
  return resultado;
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

/**
 * MUDANÇA (9.2): renomeia uma tag em todos os eventos que a usam. Se o
 * nome novo já existir como outra tag (comparando normalizado, igual ao
 * resto do arquivo), isso funciona como mesclagem automática — as duas
 * viram uma só, ficando com a cor da tag que já existia (mantém a cor que
 * ela já reconhece, em vez de trocar por engano a cor de uma tag que ela
 * não estava editando).
 *
 * Gravamos o texto exatamente como veio (trim, sem forçar minúsculas) em
 * `eventos.tag` — só a comparação/chave de `tag_cores` é normalizada, do
 * mesmo jeito que já acontece em `definirCorDaTag`/`garantirCorDaTag`.
 */
export function renomearOuMesclarTag(tagAntiga: string, tagNovaBruta: string): void {
  const tagNova = tagNovaBruta.trim();
  if (!tagNova) return; // nome vazio não é uma renomeação válida — quem chama decide o que fazer (ex: nem chamar)

  const chaveAntiga = normalizarTag(tagAntiga);
  const chaveNova = normalizarTag(tagNova);
  if (chaveAntiga === chaveNova) {
    // Mudou só maiúsculas/minúsculas (ou nada) — mantém uma única linha de
    // cor (a chave normalizada não muda), só atualiza o texto exibido.
    // UPDATE direto é seguro aqui: como a chave normalizada não muda,
    // nenhum evento pode já ter uma linha (evento_id, tagNova) conflitante
    // com a PRIMARY KEY (evento_id, tag).
    db.withTransactionSync(() => {
      db.runSync(`UPDATE evento_tags SET tag = ? WHERE tag = ?;`, [tagNova, tagAntiga]);
    });
    return;
  }

  // MUDANÇA (item 4): com `evento_tags (evento_id, tag)` como chave
  // primária composta, um UPDATE direto de tag=tagAntiga para tag=tagNova
  // quebraria se algum evento já tiver as DUAS tags ao mesmo tempo (ex:
  // ela mescla "Trabalho" em "Urgente" num evento que já tinha as duas) —
  // a linha (evento_id, 'Urgente') já existiria, e o UPDATE colidiria com
  // a PRIMARY KEY. Por isso copiamos com INSERT OR IGNORE (a colisão nesse
  // caso é o comportamento certo: o evento já tinha a tag de destino, não
  // precisa de uma segunda linha) e só depois apagamos as antigas.
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT OR IGNORE INTO evento_tags (evento_id, tag) SELECT evento_id, ? FROM evento_tags WHERE tag = ?;`,
      [tagNova, tagAntiga]
    );
    db.runSync(`DELETE FROM evento_tags WHERE tag = ?;`, [tagAntiga]);

    const corNovaJaExiste = obterCorIndexDaTag(chaveNova) !== null;
    if (corNovaJaExiste) {
      // Mesclagem: a tag de destino já tinha cor própria — descarta a cor
      // da tag antiga, que deixou de existir.
      db.runSync(`DELETE FROM tag_cores WHERE tag = ?;`, [chaveAntiga]);
    } else {
      // Renomeação simples: não existia tag com esse nome ainda, então a
      // cor antiga "muda de dono" junto com o nome.
      db.runSync(`UPDATE tag_cores SET tag = ? WHERE tag = ?;`, [chaveNova, chaveAntiga]);
    }
  });
}

/**
 * MUDANÇA (9.2): remove a tag de todos os eventos que a têm — os eventos
 * em si não são apagados, só voltam pro grupo "Sem tag" (mesmo tratamento
 * de `tag: null` usado em todo o resto do app). A cor gravada da tag
 * também é descartada, já que não há mais nenhum evento pra usá-la.
 */
export function apagarTagDeTodosOsEventos(tag: string): void {
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM evento_tags WHERE tag = ?;`, [tag]);
    db.runSync(`DELETE FROM tag_cores WHERE tag = ?;`, [normalizarTag(tag)]);
  });
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

// Chaves nomeadas (em vez de strings soltas espalhadas em ConfirmScreen e
// SettingsDrawer) pra `obterPreferencia`/`definirPreferencia` — evita erro
// de digitação de um lado ou outro deixando os dois dessincronizados.
export const PREF_DURACAO_PADRAO_MINUTOS = 'duracao_padrao_minutos';
export const PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS = 'antecedencia_alarme_padrao_minutos';

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

// --- Backup e restauração (item 8.3) ---

export interface BackupDados {
  versao: 1;
  exportadoEm: string;
  tagCores: { tag: string; corIndex: number }[];
  eventoTags: { nativeEventId: string; tag: string }[];
  preferencias: { chave: string; valor: string }[];
  calendariosSync: { calendarId: string; ativo: boolean }[];
}

/**
 * Monta o conteúdo exportável: `tag_cores`, `evento_tags`, `preferencias`
 * e `calendarios_sync` — não inclui `eventos` (título/data/descrição
 * sempre vêm ao vivo da agenda nativa, que é a fonte de verdade; não faz
 * sentido duplicar isso num arquivo de backup).
 *
 * `evento_tags` é reindexado de `evento_id` (autoincrement LOCAL deste
 * banco, sem significado nenhum fora dele) pra `native_event_id` (o id
 * real do evento na agenda do Android/Google) — exportar o `evento_id`
 * bruto tornaria o backup inútil em qualquer restauração que não fosse no
 * EXATO mesmo banco local (ex: depois de reinstalar o app, o próximo
 * evento criado pode reaproveitar um `evento_id` que já teve outro
 * significado antes).
 */
export function montarBackup(): BackupDados {
  const tagCores = db.getAllSync<{ tag: string; cor_index: number }>(`SELECT tag, cor_index FROM tag_cores;`);
  const preferenciasLinhas = db.getAllSync<{ chave: string; valor: string }>(
    `SELECT chave, valor FROM preferencias;`
  );
  const calendariosLinhas = db.getAllSync<{ calendar_id: string; ativo: number }>(
    `SELECT calendar_id, ativo FROM calendarios_sync;`
  );
  const eventoTagsLinhas = db.getAllSync<{ native_event_id: string; tag: string }>(
    `SELECT e.native_event_id, et.tag FROM evento_tags et
     JOIN eventos e ON e.id = et.evento_id
     ORDER BY et.rowid ASC;`
  );

  return {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    tagCores: tagCores.map((l) => ({ tag: l.tag, corIndex: l.cor_index })),
    eventoTags: eventoTagsLinhas.map((l) => ({ nativeEventId: l.native_event_id, tag: l.tag })),
    preferencias: preferenciasLinhas.map((l) => ({ chave: l.chave, valor: l.valor })),
    calendariosSync: calendariosLinhas.map((l) => ({ calendarId: l.calendar_id, ativo: l.ativo === 1 })),
  };
}

/**
 * Restaura um backup gerado por `montarBackup` — upsert em cada tabela
 * (substitui o valor já existente pra mesma chave, sem apagar o que não
 * colide), tudo numa transação só (ou entra tudo, ou nada, se algo falhar
 * no meio). Entradas de `evento_tags` cujo `nativeEventId` não corresponde
 * a nenhum evento registrado NESTE dispositivo são ignoradas em silêncio —
 * ela pode ter apagado o evento desde o backup, ou o arquivo é de outro
 * dispositivo com uma agenda diferente; não há evento local pra anexar a
 * tag.
 */
export function restaurarBackup(dados: BackupDados): void {
  db.withTransactionSync(() => {
    dados.tagCores.forEach((item) => {
      db.runSync(
        `INSERT INTO tag_cores (tag, cor_index) VALUES (?, ?)
         ON CONFLICT(tag) DO UPDATE SET cor_index = excluded.cor_index;`,
        [item.tag, item.corIndex]
      );
    });

    dados.preferencias.forEach((item) => {
      db.runSync(
        `INSERT INTO preferencias (chave, valor) VALUES (?, ?)
         ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor;`,
        [item.chave, item.valor]
      );
    });

    dados.calendariosSync.forEach((item) => {
      db.runSync(
        `INSERT INTO calendarios_sync (calendar_id, ativo) VALUES (?, ?)
         ON CONFLICT(calendar_id) DO UPDATE SET ativo = excluded.ativo;`,
        [item.calendarId, item.ativo ? 1 : 0]
      );
    });

    dados.eventoTags.forEach((item) => {
      const registro = db.getFirstSync<{ id: number }>(
        `SELECT id FROM eventos WHERE native_event_id = ?;`,
        [item.nativeEventId]
      );
      if (!registro) return;
      db.runSync(`INSERT OR IGNORE INTO evento_tags (evento_id, tag) VALUES (?, ?);`, [registro.id, item.tag]);
    });
  });
}
