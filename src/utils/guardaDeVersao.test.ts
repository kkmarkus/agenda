import { criarGuardaDeVersao } from './guardaDeVersao';

describe('criarGuardaDeVersao', () => {
  it('a primeira versão pedida é sempre a versão atual', () => {
    const guarda = criarGuardaDeVersao();
    const minhaVersao = guarda.proximaVersao();
    expect(guarda.ehVersaoAtual(minhaVersao)).toBe(true);
  });

  it('cada chamada a proximaVersao incrementa o número', () => {
    const guarda = criarGuardaDeVersao();
    expect(guarda.proximaVersao()).toBe(1);
    expect(guarda.proximaVersao()).toBe(2);
    expect(guarda.proximaVersao()).toBe(3);
  });

  it('uma versão antiga deixa de ser a atual assim que uma versão mais nova é pedida', () => {
    const guarda = criarGuardaDeVersao();
    const versaoAntiga = guarda.proximaVersao();
    const versaoNova = guarda.proximaVersao();

    expect(guarda.ehVersaoAtual(versaoAntiga)).toBe(false);
    expect(guarda.ehVersaoAtual(versaoNova)).toBe(true);
  });

  it('cenário real: chamada lenta iniciada primeiro termina depois e deve ser descartada', () => {
    // Simula: chamada A começa, chamada B começa antes de A terminar,
    // B termina primeiro (rápida), A termina depois (lenta).
    const guarda = criarGuardaDeVersao();

    const versaoA = guarda.proximaVersao(); // A começa
    const versaoB = guarda.proximaVersao(); // B começa antes de A terminar

    // B termina primeiro: ainda é a versão mais recente, resultado é aplicado.
    expect(guarda.ehVersaoAtual(versaoB)).toBe(true);

    // A termina depois, mas já não é mais a versão atual: resultado descartado.
    expect(guarda.ehVersaoAtual(versaoA)).toBe(false);
  });

  it('guardas diferentes não interferem uma na outra', () => {
    const guardaEventos = criarGuardaDeVersao();
    const guardaOutraCoisa = criarGuardaDeVersao();

    const versaoEventos = guardaEventos.proximaVersao();
    guardaOutraCoisa.proximaVersao();
    guardaOutraCoisa.proximaVersao();

    expect(guardaEventos.ehVersaoAtual(versaoEventos)).toBe(true);
  });
});
