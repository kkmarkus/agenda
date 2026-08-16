// Mock de teste de `db.ts`: mesma interface que os repositórios usam
// (getAllSync/getFirstSync/runSync/execSync/withTransactionSync), mas
// sobre `node:sqlite` em memória em vez de `expo-sqlite` (que só roda
// num dispositivo/emulador real). O Jest troca `db.ts` por este arquivo
// automaticamente em qualquer teste dentro de `src/services/database/`
// (convenção `__mocks__` ao lado do módulo original).
//
// Importante: só o MOCK da conexão é fake — o schema (CREATE TABLE),
// as migrações e toda a lógica de negócio dos repositórios continuam
// sendo o código de produção de verdade. Isso evita que os testes
// fiquem testando um schema hardcoded que pode divergir do real.
import { DatabaseSync } from 'node:sqlite';

// Uma conexão nova por `require` do módulo — cada arquivo de teste (cada
// `describe` roda no seu próprio módulo Jest isolado) começa com um
// banco limpo, sem vazar estado de um teste pro outro.
const sqlite = new DatabaseSync(':memory:');

export const db = {
  getAllSync<T>(sql: string, params: unknown[] = []): T[] {
    return sqlite.prepare(sql).all(...(params as never[])) as T[];
  },
  getFirstSync<T>(sql: string, params: unknown[] = []): T | null {
    const row = sqlite.prepare(sql).get(...(params as never[]));
    return (row as T) ?? null;
  },
  runSync(sql: string, params: unknown[] = []): { lastInsertRowId: number; changes: number } {
    const resultado = sqlite.prepare(sql).run(...(params as never[]));
    // node:sqlite usa `lastInsertRowid` (minúsculo); expo-sqlite usa
    // `lastInsertRowId` — os repositórios usam o nome do expo-sqlite.
    return { lastInsertRowId: Number(resultado.lastInsertRowid), changes: Number(resultado.changes) };
  },
  execSync(sql: string): void {
    sqlite.exec(sql);
  },
  withTransactionSync(fn: () => void): void {
    sqlite.exec('BEGIN');
    try {
      fn();
      sqlite.exec('COMMIT');
    } catch (erro) {
      sqlite.exec('ROLLBACK');
      throw erro;
    }
  },
};
