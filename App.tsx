import 'react-native-gesture-handler';

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from './src/services/database';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

try {
  initDatabase();
} catch (erro) {
  // Não impede o app de abrir: as telas tratam a ausência de dados
  // graciosamente, melhor do que travar totalmente por um erro de banco.
  console.error('Falha ao inicializar o banco local:', erro);
}

// Cor da barra de status precisa reagir ao tema, por isso é um
// componente à parte dentro do ThemeProvider (não dá pra ler o tema
// fora dele).
function StatusBarTemaAtual() {
  const theme = useTheme();
  return (
    <StatusBar
      style={theme.mode === 'dark' ? 'light' : 'dark'}
      backgroundColor={theme.colors.background}
    />
  );
}

export default function App() {
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
