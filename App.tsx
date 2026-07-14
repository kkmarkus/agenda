import React, { useEffect } from 'react';
import { initDatabase } from './src/services/database';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // Roda uma vez, ao abrir o app: garante que a tabela existe
  // antes de qualquer tela tentar ler ou escrever nela.
  useEffect(() => {
    initDatabase();
  }, []);

  return <AppNavigator />;
}
