import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { contarPorTag } from '../services/database';
import type { RootStackParamList } from '../navigation/AppNavigator';

// CORREÇÃO: mesmo problema das outras telas — Props simplificado próprio
// substituído pelo tipo real de navegação.
type Props = NativeStackScreenProps<RootStackParamList, 'Tags'>;

const CORES_TAG = ['#378ADD', '#639922', '#7F77DD', '#D85A30', '#D4537E'];

export default function TagsScreen({ navigation }: Props) {
  const [tags, setTags] = useState<{ tag: string; total: number }[]>([]);

  // Mesma lógica do Dashboard: recarrega toda vez que a tela ganha foco,
  // já que uma tag nova pode ter sido criada desde a última visita.
  useFocusEffect(
    useCallback(() => {
      setTags(contarPorTag());
    }, [])
  );

  if (tags.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.titulo}>Tags</Text>
        <Text style={styles.vazio}>
          Novas tags aparecem aqui automaticamente conforme você as usa nos eventos.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.titulo}>Tags</Text>
      <FlatList
        data={tags}
        keyExtractor={(item) => item.tag}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Dashboard', { tagFiltro: item.tag })}
          >
            <View style={styles.cardEsquerda}>
              <View style={[styles.bolinha, { backgroundColor: CORES_TAG[index % CORES_TAG.length] }]} />
              <Text style={styles.cardTitulo}>{item.tag}</Text>
            </View>
            <Text style={styles.cardContagem}>
              {item.total === 1 ? '1 evento' : `${item.total} eventos`}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  titulo: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  vazio: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8,
  },
  cardEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  cardTitulo: { fontSize: 14, fontWeight: '500' },
  cardContagem: { fontSize: 12, color: '#888' },
});
