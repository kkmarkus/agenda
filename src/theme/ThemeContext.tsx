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

// Lido uma única vez, de forma síncrona, ANTES da primeira renderização
// (dentro do useState abaixo) — evita o "flash" de mostrar o preset
// padrão por um instante antes de trocar pro preset salvo. Como
// expo-sqlite é síncrono aqui (getFirstSync) e o banco já foi
// inicializado em App.tsx antes de qualquer componente montar (ver
// comentário lá), essa leitura é segura.
function lerPreferenciasIniciais(): { modo: ModoPreferido; acentoId: string } {
  try {
    const modoSalvo = obterPreferencia(CHAVE_MODO);
    const acentoSalvo = obterPreferencia(CHAVE_ACENTO);
    return {
      modo: ehModoValido(modoSalvo) ? modoSalvo : 'system',
      acentoId: acentoSalvo && ACCENT_PRESETS.some((p) => p.id === acentoSalvo) ? acentoSalvo : ACCENT_PRESET_PADRAO_ID,
    };
  } catch {
    // Se por algum motivo a leitura falhar (ex: banco indisponível),
    // caímos nos padrões em vez de travar a tela inicial do app.
    return { modo: 'system', acentoId: ACCENT_PRESET_PADRAO_ID };
  }
}

type ThemeConfig = {
  modoPreferido: ModoPreferido;
  presetAtual: AccentPreset;
  definirModoPreferido: (modo: ModoPreferido) => void;
  definirAccentPresetId: (id: string) => void;
};

// Dois contexts separados: useTheme() continua devolvendo só o Theme
// "pronto" (mesmo shape de sempre — nenhuma das telas existentes
// precisou mudar uma linha por causa desta etapa). useThemeConfig() é
// novo, só pra quem precisa LER/MUDAR a preferência em si (a tela de
// configurações) — separar os dois evita que toda tela que só consome
// cores precise saber que "configuração de tema" existe.
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

  // "system" segue a Appearance API do aparelho (useColorScheme); os
  // outros dois modos são a escolha manual dela, e ignoram o sistema.
  const modoEfetivo: 'light' | 'dark' =
    modoPreferido === 'system' ? (esquemaSistema === 'dark' ? 'dark' : 'light') : modoPreferido;

  const presetAtual = useMemo(() => obterAccentPreset(acentoId), [acentoId]);
  const tema = useMemo(() => criarTema(modoEfetivo, presetAtual), [modoEfetivo, presetAtual]);

  const config: ThemeConfig = useMemo(
    () => ({ modoPreferido, presetAtual, definirModoPreferido, definirAccentPresetId }),
    [modoPreferido, presetAtual]
  );

  // Crossfade sutil disparado toda vez que o tema RESULTANTE muda (modo
  // claro/escuro efetivo OU preset de acento) — em vez de recolorir tudo
  // instantaneamente (o "flash" de cor que a usuária reportou), a árvore
  // inteira dá um mergulho rápido de opacidade e volta, escondendo a troca
  // abrupta de cor por trás de um fade. Não anima cor a cor (inviável aqui,
  // pois as cores vêm de StyleSheet recriado a cada render, não de um
  // Animated.Value por token) — anima a opacidade do container raiz, que
  // cobre visualmente qualquer troca de tema, seja de modo ou de acento.
  const opacidadeTransicao = useRef(new Animated.Value(1)).current;
  const primeiraRenderizacao = useRef(true);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      // Não anima no mount inicial — só em trocas feitas pela usuária depois.
      primeiraRenderizacao.current = false;
      return;
    }
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

/** Só pra quem precisa ler/mudar a preferência de tema em si (tela de
 * configurações) — todo o resto do app usa useTheme() normalmente. */
export function useThemeConfig(): ThemeConfig {
  const config = useContext(ThemeConfigContext);
  if (!config) {
    throw new Error('useThemeConfig precisa ser usado dentro de um ThemeProvider.');
  }
  return config;
}
