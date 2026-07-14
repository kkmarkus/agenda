import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from './src/services/database';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // Roda uma vez, ao abrir o app: garante que a tabela existe
  // antes de qualquer tela tentar ler ou escrever nela.
  useEffect(() => {
    initDatabase();
  }, []);

  // CORREÇÃO: react-native-safe-area-context já estava no package.json
  // mas nunca era usado — sem o Provider, useSafeAreaInsets/SafeAreaView
  // nas telas não funcionam, e o conteúdo pode ficar colado na status bar
  // ou atrás da barra de navegação em aparelhos com notch/gesture bar.
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
