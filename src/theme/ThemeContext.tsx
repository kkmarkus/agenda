import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, Theme } from './theme';

const ThemeContext = createContext<Theme>(lightTheme);

// Segue a preferência do sistema operacional (Appearance API, via
// useColorScheme) — sem toggle manual por enquanto, como definido no escopo.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const esquemaSistema = useColorScheme();
  const tema = esquemaSistema === 'dark' ? darkTheme : lightTheme;

  return <ThemeContext.Provider value={tema}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
