import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import InputScreen from '../screens/InputScreen';
import ConfirmScreen from '../screens/ConfirmScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TagsScreen from '../screens/TagsScreen';
import { NovoEvento } from '../types/event';

// Centraliza as telas e os parâmetros que cada uma espera receber.
// É esse tipo que deveria substituir os "Props" simplificados usados
// em cada tela individual, quando quiser tipagem completa de ponta a ponta.
export type RootStackParamList = {
  Dashboard: { tagFiltro?: string } | undefined;
  Input: undefined;
  Confirmar: { rascunho: Partial<NovoEvento> };
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
