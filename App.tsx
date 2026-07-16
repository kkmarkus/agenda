// Precisa ser o primeiro import do arquivo de entrada — é exigência da
// própria lib (react-native-gesture-handler) pra registrar o handler
// nativo antes de qualquer outra coisa carregar.
import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  NotoSerif_400Regular,
  NotoSerif_600SemiBold,
  NotoSerif_700Bold,
} from '@expo-google-fonts/noto-serif';
import { YesevaOne_400Regular } from '@expo-google-fonts/yeseva-one';
import { initDatabase } from './src/services/database';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';

export default function App() {
  // CORREÇÃO: useFonts devolve [loaded, error]. O código anterior ignorava
  // o "error" e só olhava "loaded" — se o carregamento da fonte falhasse
  // por qualquer motivo (comum em builds de produção/preview), "loaded"
  // nunca virava true, e o app ficava PARA SEMPRE preso na View vazia
  // abaixo. Isso é indistinguível de uma "tela branca estática": não é
  // crash nenhum, é o app esperando um evento que nunca chega.
  // Agora, se der erro no carregamento da fonte, seguimos em frente mesmo
  // assim (o texto só cai pra fonte padrão do sistema, o que é bem menos
  // grave que o app nunca abrir).
  const [fontsLoaded, fontError] = useFonts({
    NotoSerif_400Regular,
    NotoSerif_600SemiBold,
    NotoSerif_700Bold,
    // Serif retrô/bold usada só nos títulos grandes (tokens "display" e
    // "heading" do theme.ts).
    YesevaOne_400Regular,
  });

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

  // Enquanto as fontes não carregam (e não deram erro), mostramos só uma
  // View vazia em vez de deixar o texto "piscar" com a fonte padrão do
  // sistema antes de trocar pra Josefin Sans / Fraunces.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1 }} />;
  }

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
          <AppNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
