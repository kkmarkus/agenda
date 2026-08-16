import { db } from './db';
import { criarResolvedorDeGrafiaCanonica } from './tagsRepository';

export interface BackupDados {
  versao: 1;
  exportadoEm: string;
  tagCores: { tag: string; corIndex: number }[];
  eventoTags: { nativeEventId: string; tag: string }[];
  preferencias: { chave: string; valor: string }[];
  calendariosSync: { calendarId: string; ativo: boolean }[];
}

// Exporta os dados locais (cores de tag, associações evento-tag,
// preferências e calendários sincronizados). Não inclui os eventos em si,
// já que esses vivem na agenda nativa do sistema, não no app.
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

// Restaura um backup por cima dos dados atuais. Tags/preferências/
// calendários são upsertados (substituem por chave); associações
// evento-tag só são restauradas pra eventos que ainda existem no
// dispositivo atual (o backup pode ser de outro aparelho).
export function restaurarBackup(dados: BackupDados): void {
  const resolverGrafiaCanonica = criarResolvedorDeGrafiaCanonica();
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

      const tagCanonica = resolverGrafiaCanonica(item.tag);
      db.runSync(`INSERT OR IGNORE INTO evento_tags (evento_id, tag) VALUES (?, ?);`, [
        registro.id,
        tagCanonica,
      ]);
    });
  });
}
