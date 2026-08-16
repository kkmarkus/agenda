// Provider de tema: resolve modo claro/escuro (manual ou seguindo o
// sistema) + preset de accent, e monta o Theme final via `criarTema`.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, useColorScheme } from 'react-native';
import { obterPreferencia, definirPreferencia } from '../services/database';
import {
  criarTema,
  obterAccentPreset,
  ACCENT_PRESETS,
  ACCENT_PRESET_PADRAO_ID,
  Theme,
  AccentPreset,
} from './theme';

export type ModoPreferido = 'light' | 'dark' | 'system';

const CHAVE_MODO = 'tema_modo';
const CHAVE_ACENTO = 'tema_acento';

function ehModoValido(valor: string | null): valor is ModoPreferido {
  return valor === 'light' || valor === 'dark' || valor === 'system';
}

function lerPreferenciasIniciais(): { modo: ModoPreferido; acentoId: string } {
  try {
    const modoSalvo = obterPreferencia(CHAVE_MODO);
    const acentoSalvo = obterPreferencia(CHAVE_ACENTO);
    return {
      modo: ehModoValido(modoSalvo) ? modoSalvo : 'system',
      acentoId: acentoSalvo && ACCENT_PRESETS.some((p) => p.id === acentoSalvo) ? acentoSalvo : ACCENT_PRESET_PADRAO_ID,
    };
  } catch {
    // Banco ainda não inicializado ou preferência corrompida: cai no padrão.
    return { modo: 'system', acentoId: ACCENT_PRESET_PADRAO_ID };
  }
}

type ThemeConfig = {
  modoPreferido: ModoPreferido;
  presetAtual: AccentPreset;
  definirModoPreferido: (modo: ModoPreferido) => void;
  definirAccentPresetId: (id: string) => void;
};

const ThemeContext = createContext<Theme>(criarTema('light', obterAccentPreset(ACCENT_PRESET_PADRAO_ID)));
const ThemeConfigContext = createContext<ThemeConfig | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const esquemaSistema = useColorScheme();
  const [{ modo: modoPreferido, acentoId }, setPreferencias] = useState(lerPreferenciasIniciais);

  function definirModoPreferido(modo: ModoPreferido) {
    setPreferencias((atual) => ({ ...atual, modo }));
    definirPreferencia(CHAVE_MODO, modo);
  }

  function definirAccentPresetId(id: string) {
    setPreferencias((atual) => ({ ...atual, acentoId: id }));
    definirPreferencia(CHAVE_ACENTO, id);
  }

  const modoEfetivo: 'light' | 'dark' =
    modoPreferido === 'system' ? (esquemaSistema === 'dark' ? 'dark' : 'light') : modoPreferido;

  const presetAtual = useMemo(() => obterAccentPreset(acentoId), [acentoId]);
  const tema = useMemo(() => criarTema(modoEfetivo, presetAtual), [modoEfetivo, presetAtual]);

  const config: ThemeConfig = useMemo(
    () => ({ modoPreferido, presetAtual, definirModoPreferido, definirAccentPresetId }),
    [modoPreferido, presetAtual]
  );

  const opacidadeTransicao = useRef(new Animated.Value(1)).current;
  const primeiraRenderizacao = useRef(true);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      // Não anima na primeira montagem — só quando o modo/preset muda de fato.
      primeiraRenderizacao.current = false;
      return;
    }
    // Pisca rápido (fade out/in) na troca de tema, disfarçando a
    // mudança instantânea de cores de toda a árvore.
    Animated.sequence([
      Animated.timing(opacidadeTransicao, { toValue: 0.45, duration: 90, useNativeDriver: true }),
      Animated.timing(opacidadeTransicao, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [modoEfetivo, presetAtual.id, opacidadeTransicao]);

  return (
    <ThemeContext.Provider value={tema}>
      <ThemeConfigContext.Provider value={config}>
        <Animated.View style={{ flex: 1, opacity: opacidadeTransicao }}>{children}</Animated.View>
      </ThemeConfigContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function useThemeConfig(): ThemeConfig {
  const config = useContext(ThemeConfigContext);
  if (!config) {
    throw new Error('useThemeConfig precisa ser usado dentro de um ThemeProvider.');
  }
  return config;
}
