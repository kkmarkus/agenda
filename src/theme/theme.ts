// Tokens de design centralizados. Nenhuma cor, espaçamento, raio ou fonte
// deve ficar hardcoded nas telas — tudo vem daqui via useTheme().
//
// LINGUAGEM VISUAL: paleta "Royal Plum" — Royal Plum (#76335C) como tinta
// de texto/título, Bubblegum Tint (#FE86AA) como ÚNICA cor de destaque
// (botão principal, ícone ativo, chip selecionado, foco de input) e
// Antique White (#FEEBDA) como base do fundo claro. No escuro, o fundo
// vira AMOLED puro (preto) e o rosa sobe de contraste pra continuar
// funcionando como acento sobre o preto.

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
  // salvar/analisar) e no FAB — bubblegum -> plum, a dupla de marca.
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
  // ação principal da tela sem pesar o resto da UI.
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

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
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
    accent: '#FE86AA',
    accentText: '#5C2749',
    accentSoft: '#FDD3DE',
    gradientStart: '#FE86AA',
    gradientEnd: '#76335C',
    urgent: '#C1473B',
    urgentBg: '#FBE4DF',
    success: '#4B7A52',
  },
  spacing,
  radius,
  typography,
  shadow: { color: '#5C2749', opacity: 0.08, radius: 14, offsetY: 4 },
  glow: { color: '#FE86AA', opacity: 0.4, radius: 16, offsetY: 6 },
};
export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    // AMOLED: fundo preto puro (pixels desligados na tela = economia de
    // bateria real, e contraste máximo). Bubblegum Tint já é vívido o
    // bastante pra saltar do preto sem precisar clarear.
    background: '#000000',
    surface: '#160D13',
    surfaceElevated: '#21131C',
    border: '#3A2130',
    borderStrong: '#4E2C40',
    textPrimary: '#FBEEE1',
    textSecondary: '#CBA1B6',
    textMuted: '#8C6478',
    accent: '#FE86AA',
    accentText: '#2B0F1C',
    accentSoft: '#3D1E2C',
    gradientStart: '#FE9DBB',
    gradientEnd: '#B85D89',
    urgent: '#E58A78',
    urgentBg: '#2B1712',
    success: '#7FB088',
  },
  spacing,
  radius,
  typography,
  shadow: { color: '#000000', opacity: 0, radius: 0, offsetY: 0 },
  glow: { color: '#FE86AA', opacity: 0.3, radius: 18, offsetY: 6 },
};

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
