// Chave-valor simples pra preferências do usuário (duração/alarme padrão etc).
import { db } from './db';

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

export type DuracaoPadraoValida = '30' | '60' | '120';
export type AntecedenciaPadraoValida = '10' | '30' | '60' | '1440';

function ehDuracaoPadraoValida(valor: string | null): valor is DuracaoPadraoValida {
  return valor === '30' || valor === '60' || valor === '120';
}

function ehAntecedenciaPadraoValida(valor: string | null): valor is AntecedenciaPadraoValida {
  return valor === '10' || valor === '30' || valor === '60' || valor === '1440';
}

// Centraliza a leitura + validação da duração/antecedência padrão salva
// nas configurações. Antes essa mesma checagem de valores válidos estava
// duplicada em três lugares (`useDuracaoEAlarme`, `SettingsDrawer` x2) —
// qualquer opção nova precisava ser adicionada nos três ao mesmo tempo.
// Retorna `undefined` pro campo que não tiver um valor salvo válido, pra
// quem chama decidir o próprio fallback (o padrão inicial do estado, por
// exemplo), em vez desta função impor um.
export function lerDuracaoEAntecedenciaPadrao(): {
  duracaoPadrao?: DuracaoPadraoValida;
  antecedenciaPadrao?: AntecedenciaPadraoValida;
} {
  const duracaoSalva = obterPreferencia(PREF_DURACAO_PADRAO_MINUTOS);
  const antecedenciaSalva = obterPreferencia(PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS);
  return {
    duracaoPadrao: ehDuracaoPadraoValida(duracaoSalva) ? duracaoSalva : undefined,
    antecedenciaPadrao: ehAntecedenciaPadraoValida(antecedenciaSalva) ? antecedenciaSalva : undefined,
  };
}
