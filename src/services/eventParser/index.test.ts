import { parseTextoLivre, parseMultiplosEventos } from './index';

// Terça-feira, 11/08/2026 — data fixa pra deixar os testes determinísticos.
const AGORA = new Date(2026, 7, 11);

describe('parseTextoLivre', () => {
  it('reconhece data + hora e limpa o título', () => {
    const resultado = parseTextoLivre('reunião amanhã às 14h', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 12, 14, 0, 0, 0));
    expect(resultado.dataFim).toBeNull();
    expect(resultado.horaEncontrada).toBe(true);
    expect(resultado.recorrencia).toBeNull();
    expect(resultado.titulo).toBe('reunião');
  });

  it('usa 08:00 como padrão quando não há hora no texto', () => {
    const resultado = parseTextoLivre('reunião amanhã', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 12, 8, 0, 0, 0));
    expect(resultado.horaEncontrada).toBe(false);
  });

  it('intervalo tem prioridade sobre data única e aplica a hora nos dois lados', () => {
    const resultado = parseTextoLivre('viagem de 10 a 15/08 às 9h', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 10, 9, 0, 0, 0));
    expect(resultado.dataFim).toEqual(new Date(2026, 7, 15, 9, 0, 0, 0));
    expect(resultado.horaEncontrada).toBe(true);
    expect(resultado.titulo).toBe('viagem');
  });

  it('intervalo sem hora usa 08:00 nos dois lados', () => {
    const resultado = parseTextoLivre('viagem de 10 a 15/08', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 10, 8, 0, 0, 0));
    expect(resultado.dataFim).toEqual(new Date(2026, 7, 15, 8, 0, 0, 0));
  });

  it('recorrência tem prioridade sobre data única ("toda sexta" não vira só "sexta")', () => {
    const resultado = parseTextoLivre('pagar aluguel toda sexta às 10h', AGORA);
    expect(resultado.recorrencia).toEqual({ frequencia: 'semanal', diaSemana: 5 });
    expect(resultado.data).toEqual(new Date(2026, 7, 14, 10, 0, 0, 0));
    expect(resultado.dataFim).toBeNull();
    expect(resultado.titulo).toBe('pagar aluguel');
  });

  it('recorrência sem hora usa 08:00', () => {
    const resultado = parseTextoLivre('pagar aluguel toda sexta', AGORA);
    expect(resultado.data).toEqual(new Date(2026, 7, 14, 8, 0, 0, 0));
  });

  it('retorna data null quando não reconhece nenhum padrão, mantendo o título original', () => {
    const resultado = parseTextoLivre('reunião de alinhamento geral', AGORA);
    expect(resultado.data).toBeNull();
    expect(resultado.dataFim).toBeNull();
    expect(resultado.recorrencia).toBeNull();
    expect(resultado.titulo).toBe('reunião de alinhamento geral');
  });
});

describe('parseMultiplosEventos', () => {
  it('reconhece modo lista (uma linha por evento, com marcador "-")', () => {
    const texto = '- dentista amanhã às 10h\n- reunião terça às 14h';
    const resultado = parseMultiplosEventos(texto, AGORA);
    expect(resultado).toHaveLength(2);
    expect(resultado[0].titulo).toBe('dentista');
    expect(resultado[0].data).toEqual(new Date(2026, 7, 12, 10, 0, 0, 0));
    expect(resultado[1].titulo).toBe('reunião');
    expect(resultado[1].data).toEqual(new Date(2026, 7, 11, 14, 0, 0, 0));
  });

  it('descarta linhas do modo lista sem nenhuma data reconhecida', () => {
    const texto = '- dentista amanhã\n- café da manhã com a equipe\n- academia sexta';
    const resultado = parseMultiplosEventos(texto, AGORA);
    expect(resultado).toHaveLength(2);
    expect(resultado.map((e) => e.titulo)).toEqual(['dentista', 'academia']);
  });

  it('funciona em modo lista sem marcador nenhum (uma linha por evento já é suficiente)', () => {
    const texto = 'dentista amanhã\nreunião terça';
    const resultado = parseMultiplosEventos(texto, AGORA);
    expect(resultado).toHaveLength(2);
  });

  it('cai pro modo parágrafo corrido quando o texto é uma linha só com várias datas', () => {
    const texto = '20/07 dentista, 25/07 medico, 30/07 advogado';
    const resultado = parseMultiplosEventos(texto, AGORA);
    expect(resultado).toHaveLength(3);
    expect(resultado.map((e) => e.titulo)).toEqual(['dentista', 'medico', 'advogado']);
  });

  it('retorna lista vazia quando nenhum candidato tem data reconhecida', () => {
    const texto = '- comprar pão\n- ligar pro fulano';
    const resultado = parseMultiplosEventos(texto, AGORA);
    expect(resultado).toEqual([]);
  });

  it('ignora linhas em branco entre os itens da lista', () => {
    const texto = '- dentista amanhã\n\n- reunião terça';
    const resultado = parseMultiplosEventos(texto, AGORA);
    expect(resultado).toHaveLength(2);
  });
});
