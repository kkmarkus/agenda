import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseTextoLivre } from '../services/eventParser';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Input'>;

// MUDANÇA: removido o modo "formulário" a pedido — a tela agora só tem
// texto livre. A extração ainda é feita pelo parser de regras
// (eventParser.ts); a troca por uma API de IA fica pra depois, sem
// precisar mexer nesta tela (ela só chama parseTextoLivre e segue pra
// confirmação, então trocar a implementação por trás é transparente aqui).
export default function InputScreen({ navigation }: Props) {
  const [textoLivre, setTextoLivre] = useState('');

  function handleAnalisarTexto() {
    if (!textoLivre.trim()) return;

    const extraido = parseTextoLivre(textoLivre);

    // Mesmo se o parser não achar data, seguimos pra tela de confirmação —
    // ela completa manualmente lá. O app nunca trava o fluxo por falha de extração.
    navigation.navigate('Confirmar', {
      rascunho: {
        titulo: extraido.titulo,
        data: extraido.data ?? undefined,
      },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.titulo}>Novo evento</Text>
      <Text style={styles.subtitulo}>Digite ou cole o texto do evento</Text>

      <TextInput
        style={styles.textarea}
        multiline
        placeholder="Ex: reunião com cliente dia 20/07 às 14h"
        value={textoLivre}
        onChangeText={setTextoLivre}
      />
      <TouchableOpacity style={styles.botaoPrincipal} onPress={handleAnalisarTexto}>
        <Text style={styles.botaoPrincipalTexto}>Analisar evento</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  titulo: { fontSize: 20, fontWeight: '600' },
  subtitulo: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 16 },
  textarea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  botaoPrincipal: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  botaoPrincipalTexto: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
