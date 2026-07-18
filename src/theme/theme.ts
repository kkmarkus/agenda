// Tokens de design centralizados. Nenhuma cor, espaçamento, raio ou fonte
// deve ficar hardcoded nas telas — tudo vem daqui via useTheme().
//
// LINGUAGEM VISUAL: paleta base "Royal Plum" — Royal Plum (#76335C) como
// tinta de texto/título e Antique White (#FEEBDA) como base do fundo claro
// (AMOLED puro no escuro) continuam FIXOS, é a identidade visual do app.
// O que MUDOU nesta etapa: a cor de destaque (antes só Bubblegum Tint
// #FE86AA, fixa) agora é escolhível entre vários "presets de acento" —
// ver ACCENT_PRESETS mais abaixo — porque o app deixou de ser feito sob
// medida só pra uma pessoa e precisa deixar espaço pro gosto de cada uma.
// Título, fundo, bordas e texto continuam sempre no mesmo tom (é o que dá
// consistência de marca); só o destaque (botão principal, FAB, foco de
// input, chip selecionado, glow) muda com o preset escolhido.

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

// --- Neutros base: fixos, independentes do acento escolhido ---
// Fundo, superfícies, bordas, texto, urgência e sucesso são a identidade
// visual do app e não mudam com o preset de cor — só o acento muda.
type NeutrosBase = Omit<
  ThemeColors,
  'accent' | 'accentText' | 'accentSoft' | 'gradientStart' | 'gradientEnd'
>;

const neutrosLight: NeutrosBase = {
  // Antique White como base — quente, "papel envelhecido", não branco
  // puro. surface/surfaceElevated dão dois degraus de profundidade
  // acima do fundo, sem precisar de sombra pesada.
  background: '#FEEBDA',
  surface: '#FADFC7',
  surfaceElevated: '#FFF8EF',
  border: '#F0D2AE',
  borderStrong: '#E3BD91',
  // Royal Plum como tinta de texto — amarra a cor de marca direto na
  // hierarquia tipográfica, em vez de um cinza neutro genérico.
  textPrimary: '#5C2749',
  textSecondary: '#8A5670',
  textMuted: '#B98CA0',
  urgent: '#C1473B',
  urgentBg: '#FBE4DF',
  success: '#4B7A52',
};

const neutrosDark: NeutrosBase = {
  // AMOLED: fundo preto puro (pixels desligados na tela = economia de
  // bateria real, e contraste máximo).
  background: '#000000',
  surface: '#160D13',
  surfaceElevated: '#21131C',
  border: '#3A2130',
  borderStrong: '#4E2C40',
  textPrimary: '#FBEEE1',
  textSecondary: '#CBA1B6',
  textMuted: '#8C6478',
  urgent: '#E58A78',
  urgentBg: '#2B1712',
  success: '#7FB088',
};

const shadowLight = { color: '#5C2749', opacity: 0.08, radius: 14, offsetY: 4 };
const shadowDark = { color: '#000000', opacity: 0, radius: 0, offsetY: 0 };

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
 * mudar) combinando os neutros fixos do modo com os tokens do preset de
 * acento escolhido.
 */
export function criarTema(modo: 'light' | 'dark', preset: AccentPreset): Theme {
  const neutros = modo === 'dark' ? neutrosDark : neutrosLight;
  const acento = modo === 'dark' ? preset.dark : preset.light;
  const shadow = modo === 'dark' ? shadowDark : shadowLight;

  return {
    mode: modo,
    colors: {
      ...neutros,
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
// rosa da marca (que é território exclusivo do accent). Contraste
// calibrado pro fundo de cada tema.
export const TAG_PALETTE_LIGHT: CorTag[] = [
  { base: '#3B5D7A', text: '#FFFFFF' }, // azul petróleo
  { base: '#4A7A5C', text: '#FFFFFF' }, // verde musgo
  { base: '#6E5A8C', text: '#FFFFFF' }, // ameixa
  { base: '#A3612E', text: '#FFFFFF' }, // terracota
  { base: '#76335C', text: '#FFFFFF' }, // royal plum
  { base: '#8A7325', text: '#FFFFFF' }, // bronze
];

export const TAG_PALETTE_DARK: CorTag[] = [
  { base: '#7FA8C9', text: '#0B1D28' }, // azul petróleo
  { base: '#8FC4A0', text: '#0C2414' }, // verde musgo
  { base: '#B7A2D6', text: '#221A34' }, // ameixa
  { base: '#D99A63', text: '#331D08' }, // terracota
  { base: '#E3A9C8', text: '#33121A' }, // royal plum (clareado pro preto)
  { base: '#C7B15C', text: '#332B08' }, // bronze
];

export function corDaTag(index: number, modo: 'light' | 'dark'): CorTag {
  const paleta = modo === 'dark' ? TAG_PALETTE_DARK : TAG_PALETTE_LIGHT;
  return paleta[index % paleta.length];
}

// Exportado pra o database.ts saber quantas cores existem na hora de
// auto-atribuir uma cor a uma tag nova (round-robin), sem duplicar o
// número aqui e lá. As duas paletas têm sempre o mesmo tamanho.
export const TOTAL_CORES_TAG = TAG_PALETTE_LIGHT.length;
