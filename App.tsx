// Precisa ser o primeiro import do arquivo de entrada — é exigência da
// própria lib (react-native-gesture-handler) pra registrar o handler
// nativo antes de qualquer outra coisa carregar.
import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from './src/services/database';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

// CORREÇÃO: as fontes (Noto Serif, Yeseva One e o Feather do
// @expo/vector-icons) não são mais carregadas via useFonts em runtime.
// Esse hook baixa/lê os .ttf de forma assíncrona depois que o JS já
// subiu — funciona no Expo Go, mas é um problema conhecido em builds de
// release/preview via EAS: se o carregamento falhar ou nunca resolver, o
// app fica preso pra sempre (indistinguível de uma tela branca travada).
// Agora as fontes são embutidas como recurso nativo no momento do build,
// via plugin "expo-font" no app.json — sem race condition, sem depender
// de nada carregar depois que o app já abriu.

function StatusBarTemaAtual() {
  // A cor/estilo da status bar segue o tema ativo: ícones escuros sobre
  // o fundo bege do tema claro, ícones claros sobre o preto do tema
  // escuro — em vez da barra branca fixa que o Android desenha por
  // padrão quando não existe nenhum <StatusBar> configurado.
  const theme = useTheme();
  return (
    <StatusBar
      style={theme.mode === 'dark' ? 'light' : 'dark'}
      backgroundColor={theme.colors.background}
    />
  );
}

export default function App() {
  // Roda uma vez, ao abrir o app: garante que a tabela existe
  // antes de qualquer tela tentar ler ou escrever nela.
  useEffect(() => {
    try {
      initDatabase();
    } catch (erro) {
      // Não deixamos uma falha aqui travar o app silenciosamente — melhor
      // logar e seguir (as telas que dependem do banco já tratam listas
      // vazias normalmente) do que ficar preso sem explicação nenhuma.
      console.error('Falha ao inicializar o banco local:', erro);
    }
  }, []);

  // CORREÇÃO: react-native-safe-area-context já estava no package.json
  // mas nunca era usado — sem o Provider, useSafeAreaInsets/SafeAreaView
  // nas telas não funcionam, e o conteúdo pode ficar colado na status bar
  // ou atrás da barra de navegação em aparelhos com notch/gesture bar.
  //
  // GestureHandlerRootView precisa envolver a árvore inteira pra o swipe
  // de apagar evento (DashboardScreen) funcionar — sem ele, os gestos só
  // funcionariam parcialmente ou dariam erro em produção (funciona "por
  // acaso" às vezes em dev por causa do Fast Refresh).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBarTemaAtual />
          <AppNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
