// Controla quais calendários nativos entram na sincronização do Dashboard.
import { db } from './db';

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
