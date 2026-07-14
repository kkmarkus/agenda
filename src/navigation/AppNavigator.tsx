import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import InputScreen from '../screens/InputScreen';
import ConfirmScreen from '../screens/ConfirmScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TagsScreen from '../screens/TagsScreen';
import { NovoEvento } from '../types/event';

// Centraliza as telas e os parâmetros que cada uma espera receber.
// Este é o tipo oficial de navegação: todas as telas usam
// NativeStackScreenProps<RootStackParamList, 'NomeDaTela'> para tipagem
// completa de ponta a ponta (antes cada tela tinha um "Props" simplificado
// próprio, o que já causou divergência entre o que o navigator esperava
// e o que cada tela declarava).
export type RootStackParamList = {
  Dashboard: { tagFiltro?: string } | undefined;
  Input: undefined;
  // nativeEventId presente = modo edição (ConfirmScreen atualiza em vez de criar).
  Confirmar: { rascunho: Partial<NovoEvento>; nativeEventId?: string };
  Tags: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Dashboard" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Input" component={InputScreen} />
        <Stack.Screen name="Confirmar" component={ConfirmScreen} />
        <Stack.Screen name="Tags" component={TagsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
