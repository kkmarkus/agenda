import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import InputScreen from '../screens/InputScreen';
import ConfirmScreen from '../screens/ConfirmScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TagsScreen from '../screens/TagsScreen';
import CalendarSyncScreen from '../screens/CalendarSyncScreen';
import { NovoEvento } from '../types/event';

// Centraliza as telas e os parâmetros que cada uma espera receber.
// Este é o tipo oficial de navegação: todas as telas usam
// NativeStackScreenProps<RootStackParamList, 'NomeDaTela'> para tipagem
// completa de ponta a ponta (antes cada tela tinha um "Props" simplificado
// próprio, o que já causou divergência entre o que o navigator esperava
// e o que cada tela declarava).
export type RootStackParamList = {
  // Filtro por tag agora é estado local do Dashboard (abas), não mais
  // passado por navegação — TagsScreen deixou de ser um "seletor de
  // filtro" e virou só a tela de gerenciar cor de cada tag.
  Dashboard: undefined;
  Input: undefined;
  // nativeEventId presente = modo edição (ConfirmScreen atualiza em vez de criar).
  // dataFim presente = o parser detectou um INTERVALO de datas (ver
  // eventParser.ts) — só faz sentido na criação (nunca em edição, já que
  // depois de salvo um intervalo vira dois eventos independentes).
  Confirmar: { rascunho: Partial<NovoEvento>; nativeEventId?: string; dataFim?: Date };
  Tags: undefined;
  // Escolher quais calendários nativos (fora o do app) sincronizar.
  Sincronizar: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Dashboard"
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Input" component={InputScreen} />
        <Stack.Screen name="Confirmar" component={ConfirmScreen} />
        <Stack.Screen name="Tags" component={TagsScreen} />
        <Stack.Screen name="Sincronizar" component={CalendarSyncScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
