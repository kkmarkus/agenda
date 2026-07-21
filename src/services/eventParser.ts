// Parser baseado em regras — sem IA por enquanto (ver decisão em resumo-projeto).
// Reconhece os padrões mais comuns de como ela escreve no WhatsApp:
// datas em dd/mm ou dd/mm/aaaa, "hoje"/"amanhã"/"depois de amanhã",
// datas por extenso ("4 de agosto"), expressões relativas ("daqui a 3 dias",
// "semana que vem", "fim de semana que vem"), dias da semana ("sexta",
// "próxima sexta", "quinta-feira que vem"), intervalos de datas ("do dia
// 10 ao dia 20", "de 10 a 15 de agosto"), e horário em "Xh", "X:XX" ou
// "X horas".

// MUDANÇA (item 2): o tipo `Recorrencia` mora em types/event.ts (não aqui)
// porque é compartilhado entre o resultado do parser (`EventoExtraido`,
// abaixo) e o que a tela de confirmação monta pra salvar (`NovoEvento`) —
// ver comentário completo lá.
import type { Recorrencia } from '../types/event';

export interface EventoExtraido {
  titulo: string;
  data: Date | null;
  // Presente só quando o texto descreve um PERÍODO ("do dia X ao dia Y"),
  // não uma data única. Quando existe, a tela de confirmação mostra dois
  // campos de data e salva DOIS eventos na agenda nativa (início e prazo
  // final) em vez de um — ver decisão em resumo-projeto sobre por quê
  // (o que importa pra ela é ser lembrada nas duas pontas do período, não
  // uma barra visual de "evento de vários dias").
  dataFim: Date | null;
  horaEncontrada: boolean; // se não achou hora, o formulário assume um horário padrão
  // MUDANÇA (item 2): null explícito (não undefined) — "não detectei
  // recorrência nenhuma" é um resultado tão válido quanto detectar uma,
  // e a tela de confirmação distingue os dois só pra decidir o valor
  // inicial do seletor, nunca pra esconder o seletor (ele aparece sempre,
  // editável manualmente mesmo sem detecção — ver ConfirmScreen).
  recorrencia: Recorrencia | null;
}

// CORREÇÃO IMPORTANTE (já existia): o parser original usava \b (word boundary)
// em palavras acentuadas, ex: /\bamanh[ãa]\b/i. Em JavaScript, \b só reconhece
// [A-Za-z0-9_] como "caractere de palavra" — letras acentuadas (ã, á, ç, õ...)
// NÃO contam. Isso quebrava o reconhecimento de "amanhã" e deixava "às" sobrando
// no título. A correção troca \b por lookbehind/lookahead que tratam
// explicitamente letras com acento (faixa Latin-1 À-ÿ) como "letra".
//
// Usada só para padrões SEM grupos de captura internos — se o padrão já tem
// grupos próprios (ex: "(\d+) dias"), envolver tudo em "(${padrao})" desloca
// os índices de captura (match[1] deixa de ser o grupo interno, vira o grupo
// externo inteiro). Esse foi um bug real de uma versão anterior desta função:
// "daqui a (\d+) dias" precisava de match[2], não match[1]. Pra não reintroduzir
// esse problema, os padrões com captura própria (data extenso, "daqui a X",
// dia da semana) são escritos como regex própria, com lookbehind/lookahead
// manual, em vez de passar por este helper.
function comLimitesDePalavra(padrao: string, flags = 'i'): RegExp {
  return new RegExp(`(?<![a-zA-ZÀ-ÿ])(${padrao})(?![a-zA-ZÀ-ÿ])`, flags);
}

function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Se a data não veio com ano explícito (dd/mm, ou "4 de agosto") e já ficou
// no passado em relação a hoje, assume o próximo ano — ex: dizer "20/01" em
// dezembro quase certamente quer dizer o janeiro seguinte, não o já passado.
function ajustarAnoSeNoPassado(data: Date, agora: Date): Date {
  const hojeSemHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dataSemHora = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  if (dataSemHora < hojeSemHora) {
    const ajustada = new Date(data);
    ajustada.setFullYear(ajustada.getFullYear() + 1);
    return ajustada;
  }
  return data;
}

const REGEX_HOJE = comLimitesDePalavra('hoje');
const REGEX_DEPOIS_DE_AMANHA = comLimitesDePalavra('depois de amanh[ãa]');
const REGEX_AMANHA = comLimitesDePalavra('amanh[ãa]');
const REGEX_PALAVRAS_DESCARTAVEIS = comLimitesDePalavra('dia|às|as|em', 'gi');

const REGEX_DATA_COMPLETA = /(\d{1,2})\/(\d{1,2})\/(\d{4})/; // 27/07/2026
const REGEX_DATA_CURTA = /(\d{1,2})\/(\d{1,2})(?!\/)/; // 27/07 (sem ano)

// "4 de agosto", "4 de agosto de 2027"
const REGEX_DATA_EXTENSO = /(\d{1,2})\s+de\s+([a-zA-ZÀ-ÿ]+)(?:\s+de\s+(\d{4}))?/i;
const MESES: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2, // comparado sempre já sem acento (removerAcentos cobre "março")
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

// Intervalo de datas: "do dia 10 ao dia 20", "de 10 a 15 de agosto",
// "entre 10 e 20 de julho", "do dia 10/07 ao dia 20/07". Cada lado do
// intervalo pode ser um número de dia isolado (quando as duas pontas
// compartilham o mesmo mês, ex: "de 10 a 15 de agosto") ou uma data
// completa dd/mm(/aaaa) (quando os meses são diferentes, ex: "do dia
// 28/07 ao dia 3/08"). O mês/ano por extenso no final, se presente, só
// é usado pra completar os lados que vieram como número de dia isolado —
// um lado que já veio com "/" (dd/mm) é resolvido sozinho, sem depender
// dele.
const REGEX_INTERVALO = new RegExp(
  '(?:do\\s+dia\\s+|de\\s+|entre\\s+)' +
    '(\\d{1,2}(?:/\\d{1,2}(?:/\\d{4})?)?)' +
    '\\s+(?:ao\\s+dia\\s+|at[eé]\\s+(?:o\\s+dia\\s+)?|a\\s+|e\\s+)' +
    '(\\d{1,2}(?:/\\d{1,2}(?:/\\d{4})?)?)' +
    '(?:\\s+de\\s+([a-zA-ZÀ-ÿ]+)(?:\\s+de\\s+(\\d{4}))?)?',
  'i'
);

/**
 * Resolve um dos lados do intervalo pra uma Date "bruta" (sem decidir
 * rollover de ano ainda — isso é feito depois, olhando pro intervalo como
 * um todo, ver extrairIntervalo). Se o componente já veio com "/" (dd/mm
 * ou dd/mm/aaaa), ele já é auto-suficiente. Se veio como só um número de
 * dia, precisa do mês por extenso compartilhado (capturado no final do
 * REGEX_INTERVALO) pra fazer sentido — sem ele, não dá pra saber o mês, e
 * a função retorna null (o que faz o intervalo inteiro ser descartado).
 */
function interpretarComponenteIntervalo(
  componente: string,
  mesExtenso: string | undefined,
  anoExtenso: string | undefined,
  agora: Date
): { data: Date; anoExplicito: boolean } | null {
  if (componente.includes('/')) {
    const [diaTexto, mesTexto, anoTexto] = componente.split('/');
    const anoExplicito = !!anoTexto;
    const anoFinal = anoExplicito ? Number(anoTexto) : agora.getFullYear();
    return { data: new Date(anoFinal, Number(mesTexto) - 1, Number(diaTexto)), anoExplicito };
  }

  if (!mesExtenso) return null;
  const mesIndice = MESES[removerAcentos(mesExtenso.toLowerCase())];
  if (mesIndice === undefined) return null;

  const anoExplicito = !!anoExtenso;
  const anoFinal = anoExplicito ? Number(anoExtenso) : agora.getFullYear();
  return { data: new Date(anoFinal, mesIndice, Number(componente)), anoExplicito };
}

function extrairIntervalo(
  texto: string,
  agora: Date
): { inicio: Date; fim: Date; trecho: string } | null {
  const match = texto.match(REGEX_INTERVALO);
  if (!match) return null;

  const [trecho, comp1, comp2, mesExtenso, anoExtenso] = match;
  const inicioBruto = interpretarComponenteIntervalo(comp1, mesExtenso, anoExtenso, agora);
  const fimBruto = interpretarComponenteIntervalo(comp2, mesExtenso, anoExtenso, agora);
  if (!inicioBruto || !fimBruto) return null;

  let inicio = inicioBruto.data;
  let fim = fimBruto.data;

  // BUG ENCONTRADO NO TESTE: aplicar ajustarAnoSeNoPassado em cada lado do
  // intervalo SEPARADAMENTE quebra o período quando ele já começou mas
  // ainda não terminou (ex: hoje=16/07, período "10/07 a 20/07" — o início
  // sozinho parece "no passado" e pulava pra 2027, enquanto o fim ficava em
  // 2026, invertendo o intervalo inteiro). A decisão de rollover precisa
  // ser ATÔMICA pro par: olhamos só pro FIM (a ponta mais tardia) — se ele
  // já passou, o período inteiro é do ano que vem, e as duas pontas pulam
  // juntas. Se nenhum lado tinha ano explícito, claro: se ela escreveu um
  // ano, respeitamos exatamente o que foi pedido, mesmo que já tenha passado.
  const semAnoExplicito = !inicioBruto.anoExplicito && !fimBruto.anoExplicito;
  if (semAnoExplicito) {
    const hojeSemHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const fimSemHora = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
    if (fimSemHora < hojeSemHora) {
      inicio = new Date(inicio);
      inicio.setFullYear(inicio.getFullYear() + 1);
      fim = new Date(fim);
      fim.setFullYear(fim.getFullYear() + 1);
    }
  }

  return { inicio, fim, trecho };
}

// "daqui a 3 dias", "daqui a 2 semanas", "daqui a 1 mês"
//
// BUG ENCONTRADO NO TESTE: escrever a unidade como alternância "dia|dias"
// (plural como opção separada, depois do singular) faz o regex casar só
// "dia" dentro de "dias" — porque a alternativa "dia" já satisfaz o resto do
// padrão, o motor não tenta a alternativa mais longa depois, e o "s" final
// sobra sem ser consumido (aparecia como resíduo solto no título depois do
// replace). A correção usa sufixo plural opcional e GANANCIOSO dentro da
// mesma alternativa ("dias?"), que sempre tenta consumir o "s" quando ele
// existe, em vez de duas alternativas concorrendo.
const REGEX_DAQUI_A = /daqui\s+a\s+(\d+)\s+(dias?|semanas?|m[eê]s(?:es)?)/i;

// "fim de semana que vem"
const REGEX_FIM_DE_SEMANA_QUE_VEM = /fim\s+de\s+semana\s+que\s+vem/i;
// "semana que vem" isolado (checada DEPOIS da anterior, senão ela também
// casaria dentro de "fim de semana que vem" e a versão mais específica nunca
// seria alcançada)
const REGEX_SEMANA_QUE_VEM = comLimitesDePalavra('semana que vem');

// Dias da semana, com ou sem "-feira", com ou sem "próximo/próxima" antes ou
// "que vem" depois. Os dois prefixos/sufixos têm o MESMO efeito: pular a
// ocorrência mais próxima e ir pra semana seguinte (ver proximaOcorrencia).
// BUG CORRIGIDO: antes só "próximo/próxima X" pulava a semana; "X que vem"
// (ex: "quinta-feira que vem") caía por engano na regra de dia isolado.
// BUG CORRIGIDO: por capturar "(-feira)?" dentro do mesmo match, o trecho
// inteiro ("terça-feira") é removido de uma vez do título — antes "terça" e
// "feira" eram tratados como palavras separadas e sobrava um "-" solto.
const DIAS_SEMANA_PADRAO = 'domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado';
const REGEX_DIA_SEMANA = new RegExp(
  `(?<![a-zA-ZÀ-ÿ])(pr[oó]xim[oa]\\s+)?(${DIAS_SEMANA_PADRAO})(-feira)?(?![a-zA-ZÀ-ÿ])(\\s+que\\s+vem)?`,
  'i'
);
const NOMES_DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

// Horário numérico: "14h", "14:30", "14h30"
const REGEX_HORA_CURTA = /(\d{1,2})[:h](\d{2})?\s*h?/i;
// Horário por extenso: "17 horas", "17 horas e 30 minutos"
const REGEX_HORA_EXTENSO = /(\d{1,2})\s*horas?(?:\s+e\s+(\d{1,2})\s*minutos?)?/i;

// --- Recorrência (item 2) ---
// Ordem de checagem importa (ver extrairRecorrencia): do mais específico
// pro mais genérico, senão um padrão genérico "ganha" antes de um mais
// específico ser considerado (mesmo cuidado já usado nos padrões de data).

// "todo dia 5", "todo dia 15" — mensal com dia explícito. Precisa ser
// checado ANTES do padrão diário genérico ("todo dia" sem número), senão
// esse casaria primeiro e o número "5" sobraria solto no título.
const REGEX_RECORRENCIA_MENSAL_DIA = /todo\s+dia\s+(\d{1,2})(?!\s*[/\d])/i;

// "toda terça", "todo sábado", "todas as segundas" — semanal com dia
// explícito. Aceita "todo"/"toda"/"todos"/"todas" na frente porque a
// concordância de gênero varia conforme o dia (masc: domingo, sábado;
// fem: os demais) e não vale a pena validar isso — sobrar "s" solto não
// atrapalha, já que o trecho inteiro do match é removido do título.
const REGEX_RECORRENCIA_SEMANAL_DIA = new RegExp(
  `todo[sa]?s?\\s+(?:as\\s+)?(${DIAS_SEMANA_PADRAO})(-feira)?(?![a-zA-ZÀ-ÿ])`,
  'i'
);

const REGEX_RECORRENCIA_DIARIAMENTE = comLimitesDePalavra('diariamente');
const REGEX_RECORRENCIA_MENSAL_GENERICO = /todo\s+m[eê]s/i;
const REGEX_RECORRENCIA_SEMANAL_GENERICO = /toda\s+semana/i;
// "todo dia" sem número atrás — checado por ÚLTIMO entre os padrões de
// recorrência: só sobra pra essa regra o que não casou com nenhum padrão
// mais específico acima (em especial REGEX_RECORRENCIA_MENSAL_DIA).
const REGEX_RECORRENCIA_DIARIA_GENERICA = /(?<![a-zA-ZÀ-ÿ])todo\s+dia(?![a-zA-ZÀ-ÿ0-9])/i;

/** Próxima data (a partir de hoje, inclusive) em que cai o dia da semana informado. */
function proximaOcorrencia(agora: Date, diaAlvo: number): Date {
  const data = new Date(agora);
  const diaAtual = data.getDay();
  const diferenca = (diaAlvo - diaAtual + 7) % 7;
  data.setDate(data.getDate() + diferenca);
  return data;
}

/** Próxima data (a partir de hoje, inclusive) em que cai o dia do mês informado. */
function proximaOcorrenciaDoDiaDoMes(agora: Date, dia: number): Date {
  const candidato = new Date(agora.getFullYear(), agora.getMonth(), dia);
  const hojeSemHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (candidato.getTime() < hojeSemHora.getTime()) {
    candidato.setMonth(candidato.getMonth() + 1);
  }
  return candidato;
}

/**
 * Reconhece padrões de recorrência ("toda terça", "todo dia 5", "todo mês",
 * "toda semana", "diariamente") e já resolve a data da PRIMEIRA ocorrência,
 * pra servir de base pro evento que será criado com `recurrenceRule` (ver
 * calendarService.ts). Não define data de término — ver comentário na
 * função que monta o recurrenceRule sobre por quê fica indefinida por
 * padrão.
 */
function extrairRecorrencia(
  texto: string,
  agora: Date
): { recorrencia: Recorrencia; trecho: string; dataBase: Date } | null {
  const mensalDia = texto.match(REGEX_RECORRENCIA_MENSAL_DIA);
  if (mensalDia) {
    const dia = Number(mensalDia[1]);
    return {
      recorrencia: { frequencia: 'mensal', diaDoMes: dia },
      trecho: mensalDia[0],
      dataBase: proximaOcorrenciaDoDiaDoMes(agora, dia),
    };
  }

  const semanalDia = texto.match(REGEX_RECORRENCIA_SEMANAL_DIA);
  if (semanalDia) {
    const chaveDia = removerAcentos(semanalDia[1].toLowerCase());
    const diaAlvo = NOMES_DIAS_SEMANA[chaveDia];
    if (diaAlvo !== undefined) {
      return {
        recorrencia: { frequencia: 'semanal', diaSemana: diaAlvo },
        trecho: semanalDia[0],
        dataBase: proximaOcorrencia(agora, diaAlvo),
      };
    }
  }

  const diariamente = texto.match(REGEX_RECORRENCIA_DIARIAMENTE);
  if (diariamente) {
    return { recorrencia: { frequencia: 'diaria' }, trecho: diariamente[0], dataBase: new Date(agora) };
  }

  const mensalGenerico = texto.match(REGEX_RECORRENCIA_MENSAL_GENERICO);
  if (mensalGenerico) {
    return {
      recorrencia: { frequencia: 'mensal', diaDoMes: agora.getDate() },
      trecho: mensalGenerico[0],
      dataBase: new Date(agora),
    };
  }

  const semanalGenerico = texto.match(REGEX_RECORRENCIA_SEMANAL_GENERICO);
  if (semanalGenerico) {
    return {
      recorrencia: { frequencia: 'semanal', diaSemana: agora.getDay() },
      trecho: semanalGenerico[0],
      dataBase: new Date(agora),
    };
  }

  const diariaGenerica = texto.match(REGEX_RECORRENCIA_DIARIA_GENERICA);
  if (diariaGenerica) {
    return { recorrencia: { frequencia: 'diaria' }, trecho: diariaGenerica[0], dataBase: new Date(agora) };
  }

  return null;
}

function extrairData(texto: string, agora: Date): { data: Date | null; trecho: string | null } {
  const matchDepoisDeAmanha = texto.match(REGEX_DEPOIS_DE_AMANHA);
  if (matchDepoisDeAmanha) {
    const depoisDeAmanha = new Date(agora);
    depoisDeAmanha.setDate(depoisDeAmanha.getDate() + 2);
    return { data: depoisDeAmanha, trecho: matchDepoisDeAmanha[0] };
  }

  // Precisa vir DEPOIS de "depois de amanhã": esse trecho também contém a
  // palavra "amanhã" isolada no fim, então se checássemos "amanhã" primeiro
  // ela "ganharia" e a data ficaria errada (amanhã em vez de depois de amanhã).
  const matchAmanha = texto.match(REGEX_AMANHA);
  if (matchAmanha) {
    const amanha = new Date(agora);
    amanha.setDate(amanha.getDate() + 1);
    return { data: amanha, trecho: matchAmanha[0] };
  }

  const matchHoje = texto.match(REGEX_HOJE);
  if (matchHoje) {
    return { data: new Date(agora), trecho: matchHoje[0] };
  }

  const completa = texto.match(REGEX_DATA_COMPLETA);
  if (completa) {
    const [trecho, dia, mes, ano] = completa;
    return { data: new Date(Number(ano), Number(mes) - 1, Number(dia)), trecho };
  }

  // Data por extenso: "4 de agosto" / "4 de agosto de 2027". Só considera
  // válido se a palavra depois de "de" for realmente um mês reconhecido —
  // senão deixa passar pra próxima regra (ex: "reunião de clientes dia 20"
  // não deve virar data só por causa do "de").
  const extenso = texto.match(REGEX_DATA_EXTENSO);
  if (extenso) {
    const [trecho, dia, mesTexto, ano] = extenso;
    const chaveMes = removerAcentos(mesTexto.toLowerCase());
    const mesIndice = MESES[chaveMes];
    if (mesIndice !== undefined) {
      const anoFinal = ano ? Number(ano) : agora.getFullYear();
      let data = new Date(anoFinal, mesIndice, Number(dia));
      if (!ano) data = ajustarAnoSeNoPassado(data, agora);
      return { data, trecho };
    }
  }

  const curta = texto.match(REGEX_DATA_CURTA);
  if (curta) {
    const [trecho, dia, mes] = curta;
    let data = new Date(agora.getFullYear(), Number(mes) - 1, Number(dia));
    data = ajustarAnoSeNoPassado(data, agora);
    return { data, trecho };
  }

  // "daqui a X dias/semanas/meses"
  const daquiA = texto.match(REGEX_DAQUI_A);
  if (daquiA) {
    const [trecho, quantidadeTexto, unidadeTexto] = daquiA;
    const quantidade = Number(quantidadeTexto);
    const unidade = removerAcentos(unidadeTexto.toLowerCase());
    const data = new Date(agora);
    if (unidade.startsWith('dia')) {
      data.setDate(data.getDate() + quantidade);
    } else if (unidade.startsWith('semana')) {
      data.setDate(data.getDate() + quantidade * 7);
    } else {
      data.setMonth(data.getMonth() + quantidade);
    }
    return { data, trecho };
  }

  // "fim de semana que vem" — checada ANTES de "semana que vem" isolado,
  // porque o padrão mais genérico também casaria dentro do mais específico.
  const fimDeSemanaQueVem = texto.match(REGEX_FIM_DE_SEMANA_QUE_VEM);
  if (fimDeSemanaQueVem) {
    const data = proximaOcorrencia(agora, 6); // sábado = início do fim de semana
    data.setDate(data.getDate() + 7); // "que vem" pula o fim de semana mais próximo
    return { data, trecho: fimDeSemanaQueVem[0] };
  }

  // "semana que vem" isolado — sem dia específico citado, então assume o
  // mesmo dia da semana de hoje, uma semana à frente.
  const semanaQueVem = texto.match(REGEX_SEMANA_QUE_VEM);
  if (semanaQueVem) {
    const data = new Date(agora);
    data.setDate(data.getDate() + 7);
    return { data, trecho: semanaQueVem[0] };
  }

  // Dia da semana isolado, com ou sem "próximo/próxima" antes ou "que vem"
  // depois. Sem esses marcadores: pega a ocorrência mais próxima (podendo
  // ser hoje mesmo, se hoje já for o dia citado). Com eles: pula a
  // ocorrência mais próxima e vai pra semana seguinte.
  const diaSemana = texto.match(REGEX_DIA_SEMANA);
  if (diaSemana) {
    const [trecho, prefixoProximo, diaBaseTexto, , sufixoQueVem] = diaSemana;
    const chaveDia = removerAcentos(diaBaseTexto.toLowerCase());
    const diaAlvo = NOMES_DIAS_SEMANA[chaveDia];
    if (diaAlvo !== undefined) {
      const pularSemana = !!prefixoProximo || !!sufixoQueVem;
      const data = proximaOcorrencia(agora, diaAlvo);
      if (pularSemana) data.setDate(data.getDate() + 7);
      return { data, trecho };
    }
  }

  return { data: null, trecho: null };
}

function extrairHora(texto: string): { hora: number; minuto: number; trecho: string } | null {
  const matchCurta = texto.match(REGEX_HORA_CURTA);
  if (matchCurta) {
    const [trecho, hora, minuto] = matchCurta;
    return { hora: Number(hora), minuto: minuto ? Number(minuto) : 0, trecho };
  }

  const matchExtenso = texto.match(REGEX_HORA_EXTENSO);
  if (matchExtenso) {
    const [trecho, hora, minuto] = matchExtenso;
    return { hora: Number(hora), minuto: minuto ? Number(minuto) : 0, trecho };
  }

  return null;
}

/**
 * Extrai título, data e hora de um texto livre.
 * O título final é o texto original menos os trechos de data/hora reconhecidos,
 * pra não sobrar "reunião dia 20/07 às 14h" como título — só "reunião".
 */
export function parseTextoLivre(texto: string, agora: Date = new Date()): EventoExtraido {
  const horaInfo = extrairHora(texto);

  // Intervalo tem prioridade sobre data única: se não checássemos isso
  // primeiro, um texto como "inscrições de 10 a 15 de agosto" cairia na
  // regra de data por extenso (REGEX_DATA_EXTENSO), que casaria só "15 de
  // agosto" e deixaria "de 10 a" sobrando feio no título, perdendo a
  // segunda ponta do período inteiramente.
  const intervalo = extrairIntervalo(texto, agora);
  if (intervalo) {
    let inicio = intervalo.inicio;
    let fim = intervalo.fim;
    // A mesma hora encontrada (se houver) se aplica às duas pontas do
    // período — não faz sentido pedir pra ela escrever a hora duas vezes
    // pra dizer a mesma coisa. Sem hora: mesmo padrão de 08:00 usado em
    // eventos de data única.
    if (horaInfo) {
      inicio = new Date(inicio);
      inicio.setHours(horaInfo.hora, horaInfo.minuto, 0, 0);
      fim = new Date(fim);
      fim.setHours(horaInfo.hora, horaInfo.minuto, 0, 0);
    } else {
      inicio.setHours(8, 0, 0, 0);
      fim.setHours(8, 0, 0, 0);
    }

    let titulo = texto.replace(intervalo.trecho, '');
    if (horaInfo) titulo = titulo.replace(horaInfo.trecho, '');
    titulo = titulo
      .replace(REGEX_PALAVRAS_DESCARTAVEIS, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return {
      titulo: titulo || texto.trim(),
      data: inicio,
      dataFim: fim,
      horaEncontrada: !!horaInfo,
      recorrencia: null,
    };
  }

  // MUDANÇA (item 2): recorrência é checada ANTES da extração de data
  // única. Um texto como "academia toda terça" não pode cair na regra de
  // dia da semana isolado (REGEX_DIA_SEMANA, dentro de extrairData) — ela
  // casaria só "terça" e deixaria "toda" sobrando feio no título, além de
  // perder a informação de repetição inteiramente. "terça que vem"
  // continua caindo na regra de data única normalmente: nenhum padrão de
  // recorrência reconhece "que vem" sozinho, só "todo"/"toda" na frente —
  // não há conflito entre as duas leituras.
  const recorrenciaInfo = extrairRecorrencia(texto, agora);
  if (recorrenciaInfo) {
    let dataFinal = recorrenciaInfo.dataBase;
    if (horaInfo) {
      dataFinal = new Date(dataFinal);
      dataFinal.setHours(horaInfo.hora, horaInfo.minuto, 0, 0);
    } else {
      dataFinal.setHours(8, 0, 0, 0);
    }

    let titulo = texto.replace(recorrenciaInfo.trecho, '');
    if (horaInfo) titulo = titulo.replace(horaInfo.trecho, '');
    titulo = titulo
      .replace(REGEX_PALAVRAS_DESCARTAVEIS, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return {
      titulo: titulo || texto.trim(),
      data: dataFinal,
      dataFim: null,
      horaEncontrada: !!horaInfo,
      recorrencia: recorrenciaInfo.recorrencia,
    };
  }

  const { data: dataBase, trecho: trechoData } = extrairData(texto, agora);

  let dataFinal = dataBase;
  if (dataFinal && horaInfo) {
    dataFinal = new Date(dataFinal);
    dataFinal.setHours(horaInfo.hora, horaInfo.minuto, 0, 0);
  } else if (dataFinal) {
    dataFinal.setHours(8, 0, 0, 0); // sem hora informada: assume 08:00
  }

  let titulo = texto;
  if (trechoData) titulo = titulo.replace(trechoData, '');
  if (horaInfo) titulo = titulo.replace(horaInfo.trecho, '');
  titulo = titulo
    .replace(REGEX_PALAVRAS_DESCARTAVEIS, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    titulo: titulo || texto.trim(),
    data: dataFinal,
    dataFim: null,
    horaEncontrada: !!horaInfo,
    recorrencia: null,
  };
}

// --- Múltiplos eventos por texto (item 3) ---

// Marcador de item de lista no INÍCIO da linha: "-", "•", "*", "1.", "1)".
// Só remove o marcador em si — o resto da linha (o texto do compromisso)
// fica intacto pra ser processado por parseTextoLivre normalmente.
const REGEX_MARCADOR_LISTA = /^\s*(?:[-•*]|\d+[.)])\s*/;

// Combinado só pra ACHAR onde uma data começa no texto corrido (fallback
// best-effort quando não há marcador de lista nenhum) — não extrai valor
// nenhum daqui, só a posição. A extração de verdade continua sendo feita
// depois, trecho por trecho, por parseTextoLivre (que já sabe interpretar
// cada um desses padrões corretamente). Deliberadamente não inclui TODOS
// os padrões que extrairData reconhece (ex: "semana que vem" sozinho,
// "daqui a X dias") — cobre os marcadores mais comuns em avisos colados
// (data numérica, "hoje/amanhã", data por extenso, dia da semana); é uma
// rede de segurança, não uma segunda implementação completa do parser.
const REGEX_MARCADOR_DATA_GLOBAL = new RegExp(
  [
    '\\d{1,2}/\\d{1,2}(?:/\\d{4})?', // dd/mm ou dd/mm/aaaa
    '(?<![a-zA-ZÀ-ÿ])depois de amanh[ãa](?![a-zA-ZÀ-ÿ])',
    '(?<![a-zA-ZÀ-ÿ])amanh[ãa](?![a-zA-ZÀ-ÿ])',
    '(?<![a-zA-ZÀ-ÿ])hoje(?![a-zA-ZÀ-ÿ])',
    '\\d{1,2}\\s+de\\s+[a-zA-ZÀ-ÿ]+', // "4 de agosto"
    `(?<![a-zA-ZÀ-ÿ])(?:pr[oó]xim[oa]\\s+)?(?:${DIAS_SEMANA_PADRAO})(?:-feira)?(?![a-zA-ZÀ-ÿ])`,
  ].join('|'),
  'gi'
);

/**
 * Fallback best-effort: sem marcador de lista reconhecível, divide o texto
 * corrido pela posição de cada data solta encontrada. Cada trecho começa
 * no marcador anterior (ou no início do texto pro primeiro), pra não
 * perder palavras do título que vêm ANTES da data no mesmo compromisso
 * (ex: "reunião 20/07" — "reunião" precisa ficar junto de "20/07", não
 * virar um trecho vazio separado). Com 0 ou 1 marcador encontrado, não há
 * o que dividir — devolve o texto inteiro como um candidato único.
 */
function dividirPorPosicaoDeDatas(texto: string): string[] {
  const indices: number[] = [];
  const regex = new RegExp(REGEX_MARCADOR_DATA_GLOBAL.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto)) !== null) {
    indices.push(match.index);
    if (match.index === regex.lastIndex) regex.lastIndex += 1; // evita loop infinito em match de tamanho zero
  }

  if (indices.length <= 1) return [texto];

  const pontosDeCorte = [0, ...indices.slice(1)];
  return pontosDeCorte.map((inicio, i) => {
    const fim = i + 1 < pontosDeCorte.length ? pontosDeCorte[i + 1] : texto.length;
    return texto.slice(inicio, fim).trim();
  });
}

/**
 * Extrai VÁRIOS eventos de um único texto — o caso comum de colar um aviso
 * de grupo com uma lista de compromissos, em vez de um texto só sobre um
 * evento (que continua indo por `parseTextoLivre`, usado aqui internamente
 * pra cada trecho já isolado).
 *
 * Estratégia, em ordem de preferência:
 * 1. Se o texto tem mais de uma linha reconhecível (quebra de linha e/ou
 *    marcador de lista tipo "-"/"•"/"1."), cada linha vira um candidato.
 * 2. Sem isso, cai no fallback best-effort de `dividirPorPosicaoDeDatas`.
 *
 * Trechos sem NENHUMA data reconhecida (`data` e `dataFim` ambos null)
 * são descartados — não são um compromisso separado, provavelmente é uma
 * segunda linha de detalhe do trecho anterior (ex: um endereço, uma
 * observação) que não faz sentido virar um evento próprio sem data.
 */
export function parseMultiplosEventos(texto: string, agora: Date = new Date()): EventoExtraido[] {
  const linhas = texto
    .split('\n')
    .map((linha) => linha.replace(REGEX_MARCADOR_LISTA, '').trim())
    .filter((linha) => linha.length > 0);

  const candidatos = linhas.length > 1 ? linhas : dividirPorPosicaoDeDatas(texto.trim());

  const eventos: EventoExtraido[] = [];
  candidatos.forEach((candidato) => {
    if (!candidato) return;
    const extraido = parseTextoLivre(candidato, agora);
    if (extraido.data || extraido.dataFim) {
      eventos.push(extraido);
    }
  });

  return eventos;
}
