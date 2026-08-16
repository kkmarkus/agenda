import { criarBancoDeTeste } from './testUtils';

describe('backupRepository', () => {
  let banco: ReturnType<typeof criarBancoDeTeste>;

  beforeEach(() => {
    banco = criarBancoDeTeste();
  });

  describe('montarBackup', () => {
    it('monta um backup vazio quando não há nada salvo (fora das preferências internas de migração)', () => {
      const backup = banco.montarBackup();
      expect(backup.tagCores).toEqual([]);
      expect(backup.eventoTags).toEqual([]);
      // `initDatabase` sempre grava essas duas chaves de controle interno
      // (marcam que as migrações de dados antigos já rodaram), mesmo num
      // banco novinho em folha sem nenhum dado de usuário ainda.
      expect(backup.preferencias.map((p) => p.chave).sort()).toEqual([
        'migrou_duplicatas_tag_case',
        'migrou_evento_tags_multiplas',
      ]);
      expect(backup.calendariosSync).toEqual([]);
      expect(backup.versao).toBe(1);
    });

    it('inclui cores de tag, vínculos evento-tag, preferências e calendários sincronizados', () => {
      const id = banco.salvarRegistro('native-1', ['trabalho']);
      banco.definirTagsDoEvento(id, ['trabalho']);
      banco.definirCorDaTag('trabalho', 3);
      banco.definirPreferencia('tema', 'grafite');
      banco.definirSincronizacaoDoCalendario('cal-1', true);

      const backup = banco.montarBackup();
      expect(backup.tagCores).toEqual([{ tag: 'trabalho', corIndex: 3 }]);
      expect(backup.eventoTags).toEqual([{ nativeEventId: 'native-1', tag: 'trabalho' }]);
      expect(backup.preferencias).toContainEqual({ chave: 'tema', valor: 'grafite' });
      expect(backup.calendariosSync).toEqual([{ calendarId: 'cal-1', ativo: true }]);
    });
  });

  describe('restaurarBackup', () => {
    it('restaura cores de tag, preferências e calendários por cima do estado atual', () => {
      banco.restaurarBackup({
        versao: 1,
        exportadoEm: new Date().toISOString(),
        tagCores: [{ tag: 'trabalho', corIndex: 4 }],
        eventoTags: [],
        preferencias: [{ chave: 'tema', valor: 'dourado' }],
        calendariosSync: [{ calendarId: 'cal-1', ativo: true }],
      });

      expect(banco.obterCorIndexDaTag('trabalho')).toBe(4);
      expect(banco.obterPreferencia('tema')).toBe('dourado');
      expect(banco.listarCalendariosSincronizadosAtivos()).toEqual(['cal-1']);
    });

    it('só restaura vínculos evento-tag pra eventos que existem no aparelho atual', () => {
      banco.salvarRegistro('native-existe', []);
      banco.restaurarBackup({
        versao: 1,
        exportadoEm: new Date().toISOString(),
        tagCores: [],
        eventoTags: [
          { nativeEventId: 'native-existe', tag: 'trabalho' },
          { nativeEventId: 'native-nao-existe-mais', tag: 'pessoal' },
        ],
        preferencias: [],
        calendariosSync: [],
      });

      const registros = banco.listarRegistros();
      expect(registros).toHaveLength(1);
      expect(registros[0].tags).toEqual(['trabalho']);
      // A tag "pessoal" nunca chega a existir, já que o evento dela não existe.
      expect(banco.listarTagsUnicas()).toEqual(['trabalho']);
    });

    it('upsert: restaurar um backup duas vezes não duplica nem falha', () => {
      const dados = {
        versao: 1 as const,
        exportadoEm: new Date().toISOString(),
        tagCores: [{ tag: 'trabalho', corIndex: 4 }],
        eventoTags: [],
        preferencias: [{ chave: 'tema', valor: 'dourado' }],
        calendariosSync: [{ calendarId: 'cal-1', ativo: true }],
      };
      banco.restaurarBackup(dados);
      expect(() => banco.restaurarBackup(dados)).not.toThrow();
      expect(banco.obterCorIndexDaTag('trabalho')).toBe(4);
    });

    it('exportar e depois restaurar reproduz o mesmo estado (round-trip)', () => {
      const id = banco.salvarRegistro('native-1', ['trabalho']);
      banco.definirTagsDoEvento(id, ['trabalho']);
      banco.definirCorDaTag('trabalho', 6);
      banco.definirPreferencia('tema', 'esmeralda');
      banco.definirSincronizacaoDoCalendario('cal-1', true);

      const backup = banco.montarBackup();

      const outroBanco = criarBancoDeTeste();
      outroBanco.salvarRegistro('native-1', []); // mesmo nativeEventId, outro "aparelho"
      outroBanco.restaurarBackup(backup);

      expect(outroBanco.obterCorIndexDaTag('trabalho')).toBe(6);
      expect(outroBanco.obterPreferencia('tema')).toBe('esmeralda');
      expect(outroBanco.listarCalendariosSincronizadosAtivos()).toEqual(['cal-1']);
      expect(outroBanco.listarRegistros()[0].tags).toEqual(['trabalho']);
    });
  });
});
