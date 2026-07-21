import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import InputScreen from '../screens/InputScreen';
import ConfirmScreen from '../screens/ConfirmScreen';
import ConfirmMultiplosScreen from '../screens/ConfirmMultiplosScreen';
import DashboardScreen from '../screens/DashboardScreen';
import { NovoEvento } from '../types/event';
import type { EventoExtraido } from '../services/eventParser';

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
  // ocorrencia presente = ela escolheu editar um evento recorrente e já
  // decidiu o escopo ("Somente este" ou "Este e os futuros" — ver
  // DashboardScreen). instanceStartDate é o início ORIGINAL da ocorrência
  // carregada, não o valor (possivelmente editado) do campo de data na
  // tela — precisa ser fixo pra mirar corretamente na agenda nativa.
  Confirmar: {
    rascunho: Partial<NovoEvento>;
    nativeEventId?: string;
    dataFim?: Date;
    ocorrencia?: { instanceStartDate: Date; futureEvents: boolean };
  };
  // MUDANÇA (item 3): destino quando `parseMultiplosEventos` encontra mais
  // de um evento num único texto — lista de revisão em lote, cada item
  // editável antes de confirmar todos de uma vez. Só existe na criação
  // (nunca chega aqui vinda de uma edição).
  ConfirmarMultiplos: {
    eventos: EventoExtraido[];
  };
  // MUDANÇA (item 7): Tags e Sincronizar deixaram de ser rotas — viraram
  // painéis empilhados abertos de dentro do SettingsDrawer
  // (TagsPanelContent/CalendarSyncPanelContent), sem navegação de tela
  // cheia. Ver SettingsDrawer.tsx.
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
