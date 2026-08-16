import {
  ACCENT_PRESETS,
  ACCENT_PRESET_PADRAO_ID,
  obterAccentPreset,
  criarTema,
  corDaTag,
  corDaTagAcentuada,
  TAG_PALETTE_LIGHT,
  TAG_PALETTE_DARK,
  TAG_PALETTE_LIGHT_ACENTUADA,
  TAG_PALETTE_DARK_ACENTUADA,
  TOTAL_CORES_TAG,
  lightTheme,
  darkTheme,
} from './theme';

const HEX_VALIDO = /^#[0-9A-F]{6}$/;

describe('obterAccentPreset', () => {
  it('encontra o preset pelo id', () => {
    const preset = obterAccentPreset('esmeralda');
    expect(preset.id).toBe('esmeralda');
    expect(preset.nome).toBe('Esmeralda');
  });

  it('cai no primeiro preset da lista quando o id não existe', () => {
    const preset = obterAccentPreset('id-que-nao-existe');
    expect(preset).toBe(ACCENT_PRESETS[0]);
  });

  it('o id padrão (grafite) existe de fato na lista de presets', () => {
    const preset = obterAccentPreset(ACCENT_PRESET_PADRAO_ID);
    expect(preset.id).toBe(ACCENT_PRESET_PADRAO_ID);
  });
});

describe('ACCENT_PRESETS', () => {
  it('todos os ids são únicos', () => {
    const ids = ACCENT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo preset tem cores válidas (#RRGGBB) nos dois modos', () => {
    for (const preset of ACCENT_PRESETS) {
      for (const modo of ['light', 'dark'] as const) {
        const tokens = preset[modo];
        expect(tokens.accent).toMatch(HEX_VALIDO);
        expect(tokens.accentText).toMatch(HEX_VALIDO);
        expect(tokens.accentSoft).toMatch(HEX_VALIDO);
        expect(tokens.gradientStart).toMatch(HEX_VALIDO);
        expect(tokens.gradientEnd).toMatch(HEX_VALIDO);
        expect(tokens.glowColor).toMatch(HEX_VALIDO);
      }
    }
  });
});

describe('criarTema', () => {
  it('gera um tema com o modo correto e cores em hex válido, pra cada preset nos dois modos', () => {
    for (const preset of ACCENT_PRESETS) {
      for (const modo of ['light', 'dark'] as const) {
        const tema = criarTema(modo, preset);
        expect(tema.mode).toBe(modo);
        for (const valor of Object.values(tema.colors)) {
          expect(valor).toMatch(HEX_VALIDO);
        }
      }
    }
  });

  it('no modo escuro o fundo é sempre preto puro, em qualquer preset (economia AMOLED)', () => {
    for (const preset of ACCENT_PRESETS) {
      const tema = criarTema('dark', preset);
      expect(tema.colors.background).toBe('#000000');
    }
  });

  it('no modo escuro a sombra some (radius/opacity zerados)', () => {
    const tema = criarTema('dark', obterAccentPreset('royal'));
    expect(tema.shadow.opacity).toBe(0);
    expect(tema.shadow.radius).toBe(0);
  });

  it('no modo claro a sombra usa a cor do texto primário e tem opacidade/raio definidos', () => {
    const tema = criarTema('light', obterAccentPreset('royal'));
    expect(tema.shadow.opacity).toBeGreaterThan(0);
    expect(tema.shadow.radius).toBeGreaterThan(0);
    expect(tema.shadow.color).toBe(tema.colors.textPrimary);
  });

  it('o accent, gradientes e glow do tema vêm do preset escolhido, não são fixos', () => {
    const temaDourado = criarTema('light', obterAccentPreset('dourado'));
    const temaTurquesa = criarTema('light', obterAccentPreset('turquesa'));
    expect(temaDourado.colors.accent).not.toBe(temaTurquesa.colors.accent);
  });

  it('lightTheme e darkTheme exportados usam o preset padrão (grafite)', () => {
    const esperadoLight = criarTema('light', obterAccentPreset(ACCENT_PRESET_PADRAO_ID));
    const esperadoDark = criarTema('dark', obterAccentPreset(ACCENT_PRESET_PADRAO_ID));
    expect(lightTheme).toEqual(esperadoLight);
    expect(darkTheme).toEqual(esperadoDark);
  });
});

describe('paletas de cor de tag', () => {
  it('as quatro paletas (normal/acentuada x claro/escuro) têm o mesmo tamanho', () => {
    expect(TAG_PALETTE_LIGHT).toHaveLength(TAG_PALETTE_DARK.length);
    expect(TAG_PALETTE_LIGHT).toHaveLength(TAG_PALETTE_LIGHT_ACENTUADA.length);
    expect(TAG_PALETTE_LIGHT).toHaveLength(TAG_PALETTE_DARK_ACENTUADA.length);
  });

  it('TOTAL_CORES_TAG reflete o tamanho real das paletas', () => {
    expect(TOTAL_CORES_TAG).toBe(TAG_PALETTE_LIGHT.length);
  });

  it('todas as cores das paletas são hex válido', () => {
    for (const paleta of [TAG_PALETTE_LIGHT, TAG_PALETTE_DARK, TAG_PALETTE_LIGHT_ACENTUADA, TAG_PALETTE_DARK_ACENTUADA]) {
      for (const cor of paleta) {
        expect(cor.base).toMatch(HEX_VALIDO);
        expect(cor.text).toMatch(HEX_VALIDO);
      }
    }
  });
});

describe('corDaTag', () => {
  it('retorna a cor no índice pedido', () => {
    expect(corDaTag(0, 'light')).toEqual(TAG_PALETTE_LIGHT[0]);
    expect(corDaTag(3, 'dark')).toEqual(TAG_PALETTE_DARK[3]);
  });

  it('dá a volta na paleta (módulo) quando o índice passa do tamanho', () => {
    const ultimoIndice = TOTAL_CORES_TAG - 1;
    expect(corDaTag(TOTAL_CORES_TAG, 'light')).toEqual(TAG_PALETTE_LIGHT[0]);
    expect(corDaTag(TOTAL_CORES_TAG + ultimoIndice, 'light')).toEqual(TAG_PALETTE_LIGHT[ultimoIndice]);
  });
});

describe('corDaTagAcentuada', () => {
  it('retorna a cor acentuada no índice pedido', () => {
    expect(corDaTagAcentuada(0, 'light')).toEqual(TAG_PALETTE_LIGHT_ACENTUADA[0]);
    expect(corDaTagAcentuada(3, 'dark')).toEqual(TAG_PALETTE_DARK_ACENTUADA[3]);
  });

  it('dá a volta na paleta (módulo) quando o índice passa do tamanho', () => {
    expect(corDaTagAcentuada(TOTAL_CORES_TAG, 'dark')).toEqual(TAG_PALETTE_DARK_ACENTUADA[0]);
  });
});
