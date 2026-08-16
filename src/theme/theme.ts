// Definição dos temas (claro/escuro) e das paletas de cor de acento e de
// tags. Os neutros (fundo/texto/borda) são gerados a partir do matiz do
// accent escolhido, pra dar uma leve "tonalização" consistente em vez de
// cinza puro.
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

  gradientStart: string;
  gradientEnd: string;
  urgent: string;
  urgentBg: string;
  success: string;
};

export type Theme = {

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

    overline: { fontFamily: string; fontSize: number; letterSpacing: number };
  };

  shadow: {
    color: string;
    opacity: number;
    radius: number;
    offsetY: number;
  };

  glow: {
    color: string;
    opacity: number;
    radius: number;
    offsetY: number;
  };
};

const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

const typography = {
  display: { fontFamily: 'YesevaOne_400Regular', fontSize: 32, letterSpacing: -0.2 },
  heading: { fontFamily: 'YesevaOne_400Regular', fontSize: 22, letterSpacing: -0.1 },
  subheading: { fontFamily: 'NotoSerif_600SemiBold', fontSize: 16, letterSpacing: 0.1 },
  body: { fontFamily: 'NotoSerif_400Regular', fontSize: 14.5, letterSpacing: 0.1 },
  bodyMedium: { fontFamily: 'NotoSerif_600SemiBold', fontSize: 14.5, letterSpacing: 0.1 },
  caption: { fontFamily: 'NotoSerif_400Regular', fontSize: 12.5, letterSpacing: 0.1 },
  overline: { fontFamily: 'NotoSerif_700Bold', fontSize: 11, letterSpacing: 1.4 },
};

// Conversões hex <-> HSL: usadas pra extrair o matiz do accent e gerar os
// neutros do tema na mesma família de cor.
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

// Gera fundo/superfícies/texto/borda no matiz do accent, calibrados por
// modo. `intensidade` reduz a saturação pro preset Grafite (neutro/"sem
// cor") sem precisar duplicar toda a tabela de valores.
function gerarNeutros(hue: number, modo: 'light' | 'dark', intensidade: number): NeutrosHue {
  if (modo === 'light') {
    return {
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
    // Preto puro (AMOLED) sempre no modo escuro, independente do preset —
    // tingir o preto não muda a percepção visual e economiza bateria.
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

// Cores semânticas (urgência/sucesso) são fixas nos dois modos e não
// seguem o accent escolhido — são status, não decoração.
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

const shadowConfigLight = { opacity: 0.08, radius: 14, offsetY: 4 };
const shadowConfigDark = { color: '#000000', opacity: 0, radius: 0, offsetY: 0 };

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

  swatch: string;
  light: AccentTokens;
  dark: AccentTokens;
};

// Presets de acento que o usuário pode escolher nas configurações. Cada
// um define os tokens dependentes do accent nos dois modos. Grafite é o
// padrão neutro/"sem cor" (ver ACCENT_PRESET_PADRAO_ID).
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

export const ACCENT_PRESET_PADRAO_ID = 'grafite';

export function obterAccentPreset(id: string): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
}

// Monta um Theme completo combinando o preset de accent escolhido com os
// neutros gerados a partir do matiz desse accent.
export function criarTema(modo: 'light' | 'dark', preset: AccentPreset): Theme {
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

export const lightTheme: Theme = criarTema('light', obterAccentPreset(ACCENT_PRESET_PADRAO_ID));
export const darkTheme: Theme = criarTema('dark', obterAccentPreset(ACCENT_PRESET_PADRAO_ID));

export type CorTag = {

  base: string;

  text: string;
};

// Sufixo de opacidade (hex) aplicado sobre `base` no fundo/ícone pequeno
// da tag, deixando a cor mais discreta que o traço/badge sólido.
export const TAG_WASH_ALPHA = '1F';

// Paleta de cor das tags (índice = posição neste array, gravado no
// banco). Reordenar/inserir aqui muda a cor de tags já existentes.
export const TAG_PALETTE_LIGHT: CorTag[] = [
  { base: '#A3612E', text: '#FFFFFF' },
  { base: '#8A7325', text: '#FFFFFF' },
  { base: '#5E6A39', text: '#FFFFFF' },
  { base: '#476A3E', text: '#FFFFFF' },
  { base: '#4A7A5C', text: '#FFFFFF' },
  { base: '#3B6D61', text: '#FFFFFF' },
  { base: '#3B5D7A', text: '#FFFFFF' },
  { base: '#494F8D', text: '#FFFFFF' },
  { base: '#6E5A8C', text: '#FFFFFF' },
  { base: '#6E467C', text: '#FFFFFF' },
  { base: '#76335C', text: '#FFFFFF' },
  { base: '#743943', text: '#FFFFFF' },
];

export const TAG_PALETTE_DARK: CorTag[] = [
  { base: '#D99A63', text: '#331D08' },
  { base: '#C7B15C', text: '#332B08' },
  { base: '#A6B47E', text: '#232B0D' },
  { base: '#8AB181', text: '#122B0D' },
  { base: '#8FC4A0', text: '#0C2414' },
  { base: '#85B7AB', text: '#0D2B24' },
  { base: '#7FA8C9', text: '#0B1D28' },
  { base: '#9599C6', text: '#0D0F2B' },
  { base: '#B7A2D6', text: '#221A34' },
  { base: '#B492BF', text: '#240D2B' },
  { base: '#E3A9C8', text: '#33121A' },
  { base: '#C28E97', text: '#2B0D12' },
];

export function corDaTag(index: number, modo: 'light' | 'dark'): CorTag {
  const paleta = modo === 'dark' ? TAG_PALETTE_DARK : TAG_PALETTE_LIGHT;
  return paleta[index % paleta.length];
}

// Mesma paleta acima, com saturação mais alta — usada só nos elementos
// pequenos de identificação (bolinha do card, ícone do painel de Tags),
// pra não competir visualmente com o accent do tema.
export const TAG_PALETTE_LIGHT_ACENTUADA: CorTag[] = [
  { base: '#B15F20', text: '#FFFFFF' },
  { base: '#95791A', text: '#FFFFFF' },
  { base: '#63752E', text: '#FFFFFF' },
  { base: '#417533', text: '#FFFFFF' },
  { base: '#3D8759', text: '#FFFFFF' },
  { base: '#307867', text: '#FFFFFF' },
  { base: '#2F5E86', text: '#FFFFFF' },
  { base: '#3B449B', text: '#FFFFFF' },
  { base: '#6B4B9B', text: '#FFFFFF' },
  { base: '#743989', text: '#FFFFFF' },
  { base: '#81285E', text: '#FFFFFF' },
  { base: '#7F2E3C', text: '#FFFFFF' },
];

export const TAG_PALETTE_DARK_ACENTUADA: CorTag[] = [
  { base: '#E69956', text: '#331D08' },
  { base: '#D5B94E', text: '#332B08' },
  { base: '#ACC171', text: '#232B0D' },
  { base: '#82BE74', text: '#122B0D' },
  { base: '#84CF9C', text: '#0C2414' },
  { base: '#78C4B2', text: '#0D2B24' },
  { base: '#73A9D5', text: '#0B1D28' },
  { base: '#8A90D1', text: '#0D0F2B' },
  { base: '#B599DF', text: '#221A34' },
  { base: '#BA87CA', text: '#240D2B' },
  { base: '#EAA2C9', text: '#33121A' },
  { base: '#CD8390', text: '#2B0D12' },
];

export function corDaTagAcentuada(index: number, modo: 'light' | 'dark'): CorTag {
  const paleta = modo === 'dark' ? TAG_PALETTE_DARK_ACENTUADA : TAG_PALETTE_LIGHT_ACENTUADA;
  return paleta[index % paleta.length];
}

export const TOTAL_CORES_TAG = TAG_PALETTE_LIGHT.length;
