import { extrairHora } from './hora';

describe('extrairHora', () => {
  it('reconhece formato curto com minuto (14h30)', () => {
    expect(extrairHora('reunião 14h30')).toEqual({ hora: 14, minuto: 30, trecho: '14h30' });
  });

  it('reconhece formato curto com dois pontos (14:30)', () => {
    expect(extrairHora('reunião 14:30')).toEqual({ hora: 14, minuto: 30, trecho: '14:30' });
  });

  it('reconhece formato curto sem minuto (9h)', () => {
    expect(extrairHora('as 9h')).toEqual({ hora: 9, minuto: 0, trecho: '9h' });
  });

  it('reconhece formato por extenso', () => {
    expect(extrairHora('14 horas e 30 minutos')).toEqual({
      hora: 14,
      minuto: 30,
      trecho: '14 horas e 30 minutos',
    });
  });

  it('aceita os limites válidos (0h00 e 23h59)', () => {
    expect(extrairHora('0h00')).toEqual({ hora: 0, minuto: 0, trecho: '0h00' });
    expect(extrairHora('23h59')).toEqual({ hora: 23, minuto: 59, trecho: '23h59' });
  });

  it('rejeita hora fora da faixa (0-23)', () => {
    expect(extrairHora('35h')).toBeNull();
    expect(extrairHora('24h00')).toBeNull();
  });

  it('rejeita minuto fora da faixa (0-59)', () => {
    expect(extrairHora('14h99')).toBeNull();
    expect(extrairHora('14h60')).toBeNull();
  });

  it('retorna null quando não há hora no texto', () => {
    expect(extrairHora('reunião amanhã')).toBeNull();
  });
});
