import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { contarPorTag } from '../services/database';

type Props = {
  navigation: { navigate: (tela: 'Dashboard', params: { tagFiltro: string }) => void };
};

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
      <View style={styles.container}>
        <Text style={styles.titulo}>Tags</Text>
        <Text style={styles.vazio}>
          Novas tags aparecem aqui automaticamente conforme você as usa nos eventos.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
    </View>
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
