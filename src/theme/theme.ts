// Tokens de design centralizados. Nenhuma cor, espaçamento, raio ou fonte
// deve ficar hardcoded nas telas — tudo vem daqui via useTheme().
//
// LINGUAGEM VISUAL (revisada): o app deixou de ter uma tinta de marca fixa
// (Royal Plum). Fundo, superfície, borda e texto agora são GERADOS a
// partir do matiz do preset de acento escolhido — se a usuária escolhe
// Royal (azul), fundo/bordas/título/texto ficam todos numa variação de
// azul; se escolhe Framboesa, todos ficam numa variação de rosa. Só
// luminosidade/saturação de cada camada são fixas (é o que dá a
// hierarquia visual sempre igual, ex. "borda sempre mais escura que
// superfície"); o matiz em si vem do preset. Grafite é a exceção
// deliberada: satura muito pouco esses mesmos tokens, pra ser a opção
// "sem cor" de propósito. Preto AMOLED no modo escuro continua fixo (é
// economia de bateria real, não teria sentido tingir isso). Vermelho de
// urgência e verde de sucesso também continuam fixos nos dois modos —
// são cores de status, não decorativas, não devem mudar com o acento.

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  // Par de cores do gradiente usado nos botões de ação principal (CTA de
  // salvar/analisar) e no FAB — variação clara -> profunda dentro da
  // própria família de cor do preset escolhido.
  gradientStart: string;
  gradientEnd: string;
  urgent: string;
  urgentBg: string;
  success: string;
};

export type Theme = {
  // Usado pra escolher a paleta de cor de tag certa (TAG_PALETTE_LIGHT ou
  // TAG_PALETTE_DARK) sem precisar re-consultar useColorScheme() de novo
  // em cada tela/componente que precisa disso.
  mode: 'light' | 'dark';
  colors: ThemeColors;
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  typography: {
    display: { fontFamily: string; fontSize: number; letterSpacing: number };
    heading: { fontFamily: string; fontSize: number; letterSpacing: number };
    subheading: { fontFamily: string; fontSize: number; letterSpacing: number };
    body: { fontFamily: string; fontSize: number; letterSpacing: number };
    bodyMedium: { fontFamily: string; fontSize: number; letterSpacing: number };
    caption: { fontFamily: string; fontSize: number; letterSpacing: number };
    // Label em caixa alta com tracking largo — a assinatura tipográfica
    // "editorial/premium" usada acima de todo campo e seção (DATA, HORA,
    // TAG, etc). Sempre .toUpperCase() no texto que usa esse token.
    overline: { fontFamily: string; fontSize: number; letterSpacing: number };
  };
  // Sombra "padrão" de elevação de card — difusa e discreta, não a sombra
  // "genérica" de UI kit. No tema escuro isso não usa preto (invisível
  // sobre fundo já preto) — a profundidade ali vem da diferença entre
  // background/surface/surfaceElevated e de uma borda sutil.
  shadow: {
    color: string;
    opacity: number;
    radius: number;
    offsetY: number;
  };
  // Sombra mais ampla e suave, reservada pro CTA principal e pro FAB —
  // um "glow" de cor em vez de sombra neutra, pra dar peso ao ponto de
  // ação principal da tela sem pesar o resto da UI. A cor do glow segue
  // o preset de acento escolhido.
  glow: {
    color: string;
    opacity: number;
    radius: number;
    offsetY: number;
  };
};

const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

// Títulos usam Yeseva One — serif "retrô" bold/arredondada (mesma família
// visual do print de referência), reservada só pra display/heading. Todo
// o resto do texto do app usa Noto Serif, em pesos diferentes conforme a
// hierarquia (Regular pro corpo, SemiBold pros destaques e overlines).
const typography = {
  display: { fontFamily: 'YesevaOne_400Regular', fontSize: 32, letterSpacing: -0.2 },
  heading: { fontFamily: 'YesevaOne_400Regular', fontSize: 22, letterSpacing: -0.1 },
  subheading: { fontFamily: 'NotoSerif_600SemiBold', fontSize: 16, letterSpacing: 0.1 },
  body: { fontFamily: 'NotoSerif_400Regular', fontSize: 14.5, letterSpacing: 0.1 },
  bodyMedium: { fontFamily: 'NotoSerif_600SemiBold', fontSize: 14.5, letterSpacing: 0.1 },
  caption: { fontFamily: 'NotoSerif_400Regular', fontSize: 12.5, letterSpacing: 0.1 },
  overline: { fontFamily: 'NotoSerif_700Bold', fontSize: 11, letterSpacing: 1.4 },
};

// --- Utilitários de cor: só o necessário pra gerar neutros por matiz ---
function hexParaHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslParaHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

type NeutrosHue = Omit<
  ThemeColors,
  'accent' | 'accentText' | 'accentSoft' | 'gradientStart' | 'gradientEnd' | 'urgent' | 'urgentBg' | 'success'
>;

/**
 * Gera os 8 tokens de "camada" (fundo/superfície/borda/texto) a partir de
 * UM matiz — o do preset de acento escolhido. Luminosidade/saturação de
 * cada camada são fixas por modo (é o que garante hierarquia visual
 * sempre igual, ex. borda sempre mais escura que superfície), só o matiz
 * muda. `intensidade` reduz a saturação pro preset Grafite (0.15), que é
 * a opção deliberadamente "sem cor" — os outros presets usam 1.
 */
function gerarNeutros(hue: number, modo: 'light' | 'dark', intensidade: number): NeutrosHue {
  if (modo === 'light') {
    return {
      // Fundo/superfície claros continuam um "papel" com corpo (não
      // branco puro) — só que agora o tom desse papel é o do preset.
      background: hslParaHex(hue, 38 * intensidade, 93),
      surface: hslParaHex(hue, 42 * intensidade, 88),
      surfaceElevated: hslParaHex(hue, 30 * intensidade, 97),
      border: hslParaHex(hue, 50 * intensidade, 81),
      borderStrong: hslParaHex(hue, 55 * intensidade, 71),
      textPrimary: hslParaHex(hue, 45 * intensidade, 27),
      textSecondary: hslParaHex(hue, 28 * intensidade, 40),
      textMuted: hslParaHex(hue, 26 * intensidade, 64),
    };
  }
  return {
    // Fundo continua preto puro (AMOLED) sempre, independente do preset —
    // tingir o preto não faria diferença visual e tira a economia de
    // bateria de ser um preto "de verdade".
    background: '#000000',
    surface: hslParaHex(hue, 24 * intensidade, 7),
    surfaceElevated: hslParaHex(hue, 24 * intensidade, 10.5),
    border: hslParaHex(hue, 24 * intensidade, 18),
    borderStrong: hslParaHex(hue, 24 * intensidade, 24),
    textPrimary: hslParaHex(hue, 35 * intensidade, 90),
    textSecondary: hslParaHex(hue, 25 * intensidade, 71),
    textMuted: hslParaHex(hue, 18 * intensidade, 48),
  };
}

// --- Cores semânticas: fixas nos dois modos, não seguem o acento ---
// Urgência (vermelho) e sucesso (verde) são status, não decoração — se
// mudassem de matiz junto com o preset escolhido (ex. alguém escolhe um
// preset vermelho e o "urgente" deixa de destoar do resto da tela), a
// própria função de alerta visual se perderia.
type Semanticas = { urgent: string; urgentBg: string; success: string };

const semanticasLight: Semanticas = {
  urgent: '#C1473B',
  urgentBg: '#FBE4DF',
  success: '#4B7A52',
};

const semanticasDark: Semanticas = {
  urgent: '#E58A78',
  urgentBg: '#2B1712',
  success: '#7FB088',
};

// Escuro não usa sombra de verdade (invisível sobre AMOLED, a profundidade
// ali vem da diferença entre background/surface/surfaceElevated) — só o
// claro precisa de opacidade > 0. A cor em si é preenchida em criarTema()
// com o textPrimary já gerado pro matiz do preset (mais escuro = boa cor
// de sombra "de graça", sem hardcodear plum de novo).
const shadowConfigLight = { opacity: 0.08, radius: 14, offsetY: 4 };
const shadowConfigDark = { color: '#000000', opacity: 0, radius: 0, offsetY: 0 };

// --- Presets de acento: a cor de destaque escolhível pela usuária ---
// Cada preset define os 5 tokens que dependem do acento, pros dois modos
// (claro/escuro), calibrados pra manter contraste sobre o fundo Antique
// White / AMOLED de cada modo — mesma lógica de contraste que o Bubblegum
// original já usava, só replicada pras outras famílias de cor.
export type AccentTokens = {
  accent: string;
  accentText: string;
  accentSoft: string;
  gradientStart: string;
  gradientEnd: string;
  glowColor: string;
};

export type AccentPreset = {
  id: string;
  nome: string;
  // Cor representativa pro botão/bolinha do seletor de tema — usamos o
  // tom do modo claro em ambos os casos, já que é sempre exibido sobre a
  // superfície do tema ATUAL da tela de configurações (que já dá o
  // contexto de claro/escuro), não precisa duplicar por modo.
  swatch: string;
  light: AccentTokens;
  dark: AccentTokens;
};

// Ordem = roda de cor (matiz crescente: dourado ~50° até tijolo ~352°),
// não mais a ordem de criação bagunçada de antes. Grafite fica sempre
// por último, fora da roda — é o preset "sem cor", não compete por
// posição com os outros. Seguro reordenar: cada preset é referenciado
// por `id` (string) em todo o app, nunca por índice numérico.
export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'dourado',
    nome: 'Dourado',
    swatch: '#917C12',
    light: {
      accent: '#917C12',
      accentText: '#FFFFFF',
      accentSoft: '#EBE8D6',
      gradientStart: '#D2B214',
      gradientEnd: '#2F2804',
      glowColor: '#917C12',
    },
    dark: {
      accent: '#E2CB5A',
      accentText: '#332404',
      accentSoft: '#3E391E',
      gradientStart: '#E4D58B',
      gradientEnd: '#D0B425',
      glowColor: '#E2CB5A',
    },
  },
  {
    id: 'esmeralda',
    nome: 'Esmeralda',
    // Afastado do verde de sucesso (#4B7A52 / #7FB088) — mais escuro e
    // saturado, pra não ser lido como "confirmado/concluído" à toa.
    swatch: '#2D8053',
    light: {
      accent: '#2D8053',
      accentText: '#FFFFFF',
      accentSoft: '#D6EBDF',
      gradientStart: '#38B771',
      gradientEnd: '#0D301D',
      glowColor: '#2D8053',
    },
    dark: {
      accent: '#64C48F',
      // Antes reaproveitava #2B1608 (residual do tema rosa original) —
      // agora é um verde quase-preto calibrado no próprio matiz do
      // accent (mesma lógica já usada em Dourado e Grafite).
      accentText: '#0D2B1A',
      accentSoft: '#1E3E2C',
      gradientStart: '#8FCCAA',
      gradientEnd: '#3EA36B',
      glowColor: '#64C48F',
    },
  },
  {
    id: 'turquesa',
    nome: 'Turquesa',
    swatch: '#1A8973',
    light: {
      accent: '#1A8973',
      accentText: '#FFFFFF',
      accentSoft: '#D6EBE7',
      gradientStart: '#1FC7A5',
      gradientEnd: '#062D25',
      glowColor: '#1A8973',
    },
    dark: {
      accent: '#62DAC2',
      // Idem — era o mesmo #2B1608 residual do Esmeralda, agora um teal
      // quase-preto no matiz do próprio accent.
      accentText: '#0D2B25',
      accentSoft: '#1E3E38',
      gradientStart: '#91DECF',
      gradientEnd: '#2FC6A8',
      glowColor: '#62DAC2',
    },
  },
  {
    id: 'royal',
    nome: 'Royal',
    swatch: '#3A699C',
    light: {
      accent: '#3A699C',
      accentText: '#FFFFFF',
      accentSoft: '#D6E0EB',
      gradientStart: '#528AC7',
      gradientEnd: '#17324F',
      glowColor: '#3A699C',
    },
    dark: {
      accent: '#7DA7D4',
      accentText: '#FFFFFF',
      accentSoft: '#1E2D3E',
      gradientStart: '#A8C1DC',
      gradientEnd: '#4783C2',
      glowColor: '#7DA7D4',
    },
  },
  {
    id: 'orquidea',
    nome: 'Orquídea',
    swatch: '#8E3B91',
    light: {
      accent: '#8E3B91',
      accentText: '#FFFFFF',
      accentSoft: '#EAD6EB',
      gradientStart: '#BC4FBF',
      gradientEnd: '#431745',
      glowColor: '#8E3B91',
    },
    dark: {
      accent: '#C277C5',
      accentText: '#FFFFFF',
      accentSoft: '#3D1E3E',
      gradientStart: '#CDA1CE',
      gradientEnd: '#A849AB',
      glowColor: '#C277C5',
    },
  },
  {
    id: 'framboesa',
    nome: 'Framboesa',
    // Substitui o antigo Bubblegum — mesma família rosa/magenta, mas
    // afastado o suficiente do vermelho de urgência e do próprio
    // Bubblegum antigo pra não ser confundido com nenhum dos dois.
    swatch: '#BA2C8D',
    light: {
      accent: '#BA2C8D',
      accentText: '#FFFFFF',
      accentSoft: '#EBD6E4',
      gradientStart: '#DC4CAE',
      gradientEnd: '#64124A',
      glowColor: '#BA2C8D',
    },
    dark: {
      accent: '#DD7EBF',
      accentText: '#FFFFFF',
      accentSoft: '#3E1E34',
      gradientStart: '#E3ABD1',
      gradientEnd: '#CE46A3',
      glowColor: '#DD7EBF',
    },
  },
  {
    id: 'tijolo',
    nome: 'Tijolo',
    // Deliberadamente diferente do vermelho de urgência (#C1473B / #E58A78)
    // pra nunca ser confundido com o alerta de evento próximo — um
    // vermelho-marsala fechado e escuro, em vez de vermelho puro/vivo.
    swatch: '#862734',
    light: {
      accent: '#862734',
      accentText: '#FFFFFF',
      accentSoft: '#EBD6D9',
      gradientStart: '#C03043',
      gradientEnd: '#320B10',
      glowColor: '#862734',
    },
    dark: {
      accent: '#CB4D5E',
      accentText: '#FFFFFF',
      accentSoft: '#3E1E22',
      gradientStart: '#D07C87',
      gradientEnd: '#A22F3E',
      glowColor: '#CB4D5E',
    },
  },
  {
    id: 'grafite',
    nome: 'Grafite',
    // O preset neutro: saturação bem baixa (8%) e matiz alinhado ao
    // mesmo tom quente do fundo do app (~30°, a mesma família do bege
    // Antique White), pra ficar "sem cor" sem destoar da identidade
    // quente do app — evita um cinza frio/azulado que pareceria
    // emprestado de outro app.
    swatch: '#5E5750',
    light: {
      accent: '#5E5750',
      accentText: '#FFFFFF',
      accentSoft: '#E3E0DE',
      gradientStart: '#85786B',
      gradientEnd: '#2D2924',
      glowColor: '#5E5750',
    },
    dark: {
      accent: '#B4ADA7',
      accentText: '#2B2723',
      accentSoft: '#322E2A',
      gradientStart: '#CBC7C2',
      gradientEnd: '#938A80',
      glowColor: '#B4ADA7',
    },
  },

];

export const ACCENT_PRESET_PADRAO_ID = 'framboesa';

export function obterAccentPreset(id: string): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
}

/**
 * Monta o Theme completo (mesmo shape de sempre — nenhuma tela precisa
 * mudar) combinando os neutros GERADOS a partir do matiz do preset
 * escolhido com os tokens específicos de acento do próprio preset.
 */
export function criarTema(modo: 'light' | 'dark', preset: AccentPreset): Theme {
  // Matiz sempre tirado da versão clara do preset — claro e escuro do
  // mesmo preset já são desenhados pra ser a mesma família de cor, então
  // não precisa (nem deve) recalcular por modo.
  const { h: matiz } = hexParaHsl(preset.light.accent);
  const intensidade = preset.id === 'grafite' ? 0.15 : 1;
  const neutros = gerarNeutros(matiz, modo, intensidade);
  const semanticas = modo === 'dark' ? semanticasDark : semanticasLight;
  const acento = modo === 'dark' ? preset.dark : preset.light;
  const shadow =
    modo === 'dark' ? shadowConfigDark : { color: neutros.textPrimary, ...shadowConfigLight };

  return {
    mode: modo,
    colors: {
      ...neutros,
      ...semanticas,
      accent: acento.accent,
      accentText: acento.accentText,
      accentSoft: acento.accentSoft,
      gradientStart: acento.gradientStart,
      gradientEnd: acento.gradientEnd,
    },
    spacing,
    radius,
    typography,
    shadow,
    glow: {
      color: acento.glowColor,
      opacity: modo === 'dark' ? 0.3 : 0.4,
      radius: modo === 'dark' ? 18 : 16,
      offsetY: 6,
    },
  };
}

// Mantidos por compatibilidade — o preset padrão (Bubblegum) nos dois
// modos, caso algum código externo à árvore de componentes (fora do
// ThemeProvider) precise de um Theme "de fallback" sem contexto.
export const lightTheme: Theme = criarTema('light', obterAccentPreset(ACCENT_PRESET_PADRAO_ID));
export const darkTheme: Theme = criarTema('dark', obterAccentPreset(ACCENT_PRESET_PADRAO_ID));

export type CorTag = {
  // Cor sólida: usada no traço lateral fino do card e na bolinha/ícone de
  // identificação. O card fica neutro — a cor da tag é um detalhe, não o
  // fundo inteiro.
  base: string;
  // Cor de texto/ícone pra usar EM CIMA de `base`.
  text: string;
};

// Sufixo de opacidade (hex) aplicado sobre `base`, reservado hoje só pro
// fundo do badge/ícone pequeno — não mais pro card inteiro.
export const TAG_WASH_ALPHA = '1F'; // ~12% de opacidade

// Duas paletas separadas — mesma ordem de matiz nas duas (índice 0 =
// azul, 1 = verde, etc.), dessaturadas/"jewel" pra não competir com o
// acento escolhido (que é território exclusivo do accent, seja qual for
// o preset ativo). Contraste calibrado pro fundo de cada tema.
//
// Ordem = roda de cor completa (terracota ~26° até cereja ~350°), 12
// cores sem buracos grandes de matiz — não mais a ordem avulsa de
// quando só existiam 6. Cada `text` do modo escuro é calibrado no
// PRÓPRIO matiz da cor (mesmo `base`, saturação ~55%, luminosidade
// ~11%) em vez de reaproveitar um tom genérico emprestado de outra
// paleta — é o que dava aquela sensação de "resíduo" de um tema antigo.
//
// Atenção: o índice gravado no banco por tag é a posição neste array —
// reordenar/inserir aqui muda a cor de tags já existentes. Aceitável
// nesta fase (app ainda em desenvolvimento), mas não fazer de novo sem
// avisar depois que houver instalações reais em uso.
export const TAG_PALETTE_LIGHT: CorTag[] = [
  { base: '#A3612E', text: '#FFFFFF' }, // terracota
  { base: '#8A7325', text: '#FFFFFF' }, // bronze
  { base: '#5E6A39', text: '#FFFFFF' }, // oliva
  { base: '#476A3E', text: '#FFFFFF' }, // grama
  { base: '#4A7A5C', text: '#FFFFFF' }, // verde musgo
  { base: '#3B6D61', text: '#FFFFFF' }, // jade
  { base: '#3B5D7A', text: '#FFFFFF' }, // azul petróleo
  { base: '#494F8D', text: '#FFFFFF' }, // índigo
  { base: '#6E5A8C', text: '#FFFFFF' }, // ameixa
  { base: '#6E467C', text: '#FFFFFF' }, // uva
  { base: '#76335C', text: '#FFFFFF' }, // royal plum
  { base: '#743943', text: '#FFFFFF' }, // cereja
];

export const TAG_PALETTE_DARK: CorTag[] = [
  { base: '#D99A63', text: '#331D08' }, // terracota
  { base: '#C7B15C', text: '#332B08' }, // bronze
  { base: '#A6B47E', text: '#232B0D' }, // oliva
  { base: '#8AB181', text: '#122B0D' }, // grama
  { base: '#8FC4A0', text: '#0C2414' }, // verde musgo
  { base: '#85B7AB', text: '#0D2B24' }, // jade
  { base: '#7FA8C9', text: '#0B1D28' }, // azul petróleo
  { base: '#9599C6', text: '#0D0F2B' }, // índigo
  { base: '#B7A2D6', text: '#221A34' }, // ameixa
  { base: '#B492BF', text: '#240D2B' }, // uva
  { base: '#E3A9C8', text: '#33121A' }, // royal plum
  { base: '#C28E97', text: '#2B0D12' }, // cereja
];

export function corDaTag(index: number, modo: 'light' | 'dark'): CorTag {
  const paleta = modo === 'dark' ? TAG_PALETTE_DARK : TAG_PALETTE_LIGHT;
  return paleta[index % paleta.length];
}

// Exportado pra o database.ts saber quantas cores existem na hora de
// auto-atribuir uma cor a uma tag nova (round-robin), sem duplicar o
// número aqui e lá. As duas paletas têm sempre o mesmo tamanho.
export const TOTAL_CORES_TAG = TAG_PALETTE_LIGHT.length;
