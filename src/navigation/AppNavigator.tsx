import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import InputScreen from '../screens/InputScreen';
import ConfirmScreen from '../screens/ConfirmScreen';
import ConfirmMultiplosScreen from '../screens/ConfirmMultiplosScreen';
import DashboardScreen from '../screens/DashboardScreen';
import { NovoEvento } from '../types/event';
import type { EventoExtraido } from '../services/eventParser';

export type RootStackParamList = {
  Dashboard: undefined;
  Input: undefined;
  // `rascunho` vem parcialmente preenchido tanto na criação (vindo do
  // parser de texto livre) quanto na edição (vindo de um evento existente).
  Confirmar: {
    rascunho: Partial<NovoEvento>;
    nativeEventId?: string;
    dataFim?: Date;
    ocorrencia?: { instanceStartDate: Date; futureEvents: boolean };
  };
  ConfirmarMultiplos: {
    eventos: EventoExtraido[];
  };
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
        <Stack.Screen name="ConfirmarMultiplos" component={ConfirmMultiplosScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
