import { comLimitesDePalavra, removerAcentos } from './normalizacao';

export const DIAS_SEMANA_PADRAO = 'domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado';
export const NOMES_DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

export const MESES: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
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

// Se a data cair no passado (ex: "20/01" digitado em dezembro), assume que
// é pro ano seguinte em vez de repetir uma data que já passou.
export function ajustarAnoSeNoPassado(data: Date, agora: Date): Date {
  const hojeSemHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dataSemHora = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  if (dataSemHora < hojeSemHora) {
    const ajustada = new Date(data);
    ajustada.setFullYear(ajustada.getFullYear() + 1);
    return ajustada;
  }
  return data;
}

// Próxima data (a partir de hoje, inclusive) em que cai o dia da semana informado.
export function proximaOcorrencia(agora: Date, diaAlvo: number): Date {
  const data = new Date(agora);
  const diaAtual = data.getDay();
  const diferenca = (diaAlvo - diaAtual + 7) % 7;
  data.setDate(data.getDate() + diferenca);
  return data;
}

const REGEX_HOJE = comLimitesDePalavra('hoje');
const REGEX_DEPOIS_DE_AMANHA = comLimitesDePalavra('depois de amanh[ãa]');
const REGEX_AMANHA = comLimitesDePalavra('amanh[ãa]');

const REGEX_DATA_COMPLETA = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const REGEX_DATA_CURTA = /(\d{1,2})\/(\d{1,2})(?!\/)/;

const REGEX_DATA_EXTENSO = /(\d{1,2})\s+de\s+([a-zA-ZÀ-ÿ]+)(?:\s+de\s+(\d{4}))?/i;

const REGEX_DAQUI_A = /daqui\s+a\s+(\d+)\s+(dias?|semanas?|m[eê]s(?:es)?)/i;

const REGEX_FIM_DE_SEMANA_QUE_VEM = /fim\s+de\s+semana\s+que\s+vem/i;

const REGEX_SEMANA_QUE_VEM = comLimitesDePalavra('semana que vem');

// Dia da semana isolado, opcionalmente precedido de "próximo/próxima" ou
// seguido de "que vem" (ex: "próxima sexta", "domingo que vem").
const REGEX_DIA_SEMANA = new RegExp(
  `(?<![a-zA-ZÀ-ÿ])(pr[oó]xim[oa]\\s+)?(${DIAS_SEMANA_PADRAO})(-feira)?(?![a-zA-ZÀ-ÿ])(\\s+que\\s+vem)?`,
  'i'
);

// Tenta reconhecer uma data única no texto, testando os padrões em ordem
// de mais específico pra mais genérico (senão um padrão genérico casaria
// antes e "roubaria" o match de um mais específico, como "amanhã" dentro
// de "depois de amanhã").
export function extrairData(texto: string, agora: Date): { data: Date | null; trecho: string | null } {
  const matchDepoisDeAmanha = texto.match(REGEX_DEPOIS_DE_AMANHA);
  if (matchDepoisDeAmanha) {
    const depoisDeAmanha = new Date(agora);
    depoisDeAmanha.setDate(depoisDeAmanha.getDate() + 2);
    return { data: depoisDeAmanha, trecho: matchDepoisDeAmanha[0] };
  }

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

  // dd/mm/aaaa
  const completa = texto.match(REGEX_DATA_COMPLETA);
  if (completa) {
    const [trecho, dia, mes, ano] = completa;
    return { data: new Date(Number(ano), Number(mes) - 1, Number(dia)), trecho };
  }

  // "4 de agosto" / "4 de agosto de 2027" — só conta se a palavra depois
  // de "de" for um mês reconhecido, senão deixa passar pra próxima regra
  // (ex: "reunião de clientes dia 20" não deve virar data só por causa do "de").
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

  // dd/mm sem ano: assume o ano atual (ajustando pro próximo se já passou).
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

  // "fim de semana que vem" precisa ser checado ANTES de "semana que vem"
  // isolado, porque o padrão mais genérico também casaria dentro do mais específico.
  const fimDeSemanaQueVem = texto.match(REGEX_FIM_DE_SEMANA_QUE_VEM);
  if (fimDeSemanaQueVem) {
    const data = proximaOcorrencia(agora, 6); // sábado = início do fim de semana
    data.setDate(data.getDate() + 7); // "que vem" pula o fim de semana mais próximo
    return { data, trecho: fimDeSemanaQueVem[0] };
  }

  // "semana que vem" isolada, sem dia específico: mesmo dia da semana de
  // hoje, uma semana à frente.
  const semanaQueVem = texto.match(REGEX_SEMANA_QUE_VEM);
  if (semanaQueVem) {
    const data = new Date(agora);
    data.setDate(data.getDate() + 7);
    return { data, trecho: semanaQueVem[0] };
  }

  // Dia da semana isolado: sem "próximo/que vem", pega a ocorrência mais
  // próxima (podendo ser hoje); com esses marcadores, pula pra semana seguinte.
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
