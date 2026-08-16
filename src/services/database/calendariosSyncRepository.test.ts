import { criarBancoDeTeste } from './testUtils';

describe('calendariosSyncRepository', () => {
  let banco: ReturnType<typeof criarBancoDeTeste>;

  beforeEach(() => {
    banco = criarBancoDeTeste();
  });

  it('não lista nenhum calendário sincronizado antes de configurar nada', () => {
    expect(banco.listarCalendariosSincronizadosAtivos()).toEqual([]);
  });

  it('ativa um calendário e passa a listá-lo', () => {
    banco.definirSincronizacaoDoCalendario('cal-1', true);
    expect(banco.listarCalendariosSincronizadosAtivos()).toEqual(['cal-1']);
  });

  it('desativa um calendário e ele some da lista de ativos', () => {
    banco.definirSincronizacaoDoCalendario('cal-1', true);
    banco.definirSincronizacaoDoCalendario('cal-1', false);
    expect(banco.listarCalendariosSincronizadosAtivos()).toEqual([]);
  });

  it('obterPreferenciasSincronizacao reflete ativos e inativos', () => {
    banco.definirSincronizacaoDoCalendario('cal-1', true);
    banco.definirSincronizacaoDoCalendario('cal-2', false);
    expect(banco.obterPreferenciasSincronizacao()).toEqual({ 'cal-1': true, 'cal-2': false });
  });

  it('definir de novo o mesmo calendário atualiza (não duplica)', () => {
    banco.definirSincronizacaoDoCalendario('cal-1', true);
    banco.definirSincronizacaoDoCalendario('cal-1', true);
    expect(banco.listarCalendariosSincronizadosAtivos()).toEqual(['cal-1']);
  });
});
