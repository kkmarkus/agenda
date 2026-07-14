import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { buscarEventoDaAgenda, apagarEventoDaAgenda } from '../services/calendarService';
import { listarRegistros, apagarRegistro } from '../services/database';
import { EventoApp } from '../types/event';

type Props = {
  navigation: { navigate: (tela: 'Input' | 'Tags') => void };
  route?: { params?: { tagFiltro?: string } };
};

const LIMITE_URGENTE_HORAS = 48;

export default function DashboardScreen({ navigation, route }: Props) {
  const tagFiltro = route?.params?.tagFiltro;
  const [eventos, setEventos] = useState<EventoApp[]>([]);
  const [carregando, setCarregando] = useState(true);

  // useFocusEffect (não useEffect) porque ela pode voltar pra essa tela
  // depois de salvar um evento novo — precisa recarregar toda vez que a tela ganha foco.
  useFocusEffect(
    useCallback(() => {
      carregarEventos();
    }, [])
  );

  async function carregarEventos() {
    setCarregando(true);
    const registros = listarRegistros();
    const resultado: EventoApp[] = [];

    for (const registro of registros) {
      const dadosNativos = await buscarEventoDaAgenda(registro.nativeEventId);

      if (!dadosNativos) {
        // Evento sumiu da agenda nativa (ela apagou direto no Google Calendar):
        // limpamos o registro órfão pra não aparecer de novo na próxima carga.
        apagarRegistro(registro.id);
        continue;
      }

      resultado.push({
        id: registro.id,
        nativeEventId: registro.nativeEventId,
        tag: registro.tag,
        titulo: dadosNativos.titulo,
        data: dadosNativos.data,
        descricao: dadosNativos.descricao,
      });
    }

    const filtrado = tagFiltro
      ? resultado.filter((e) => e.tag.toLowerCase() === tagFiltro.toLowerCase())
      : resultado;

    filtrado.sort((a, b) => a.data.getTime() - b.data.getTime());
    setEventos(filtrado);
    setCarregando(false);
  }

  function handleApagar(evento: EventoApp) {
    Alert.alert('Apagar evento', `Remover "${evento.titulo}" da agenda?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          // Sincronizado: apaga dos dois lados, senão o alarme nativo
          // continua ativo pra um evento que sumiu do app.
          await apagarEventoDaAgenda(evento.nativeEventId);
          apagarRegistro(evento.id);
          carregarEventos();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.titulo}>{tagFiltro ? tagFiltro : 'Seus eventos'}</Text>
        {!tagFiltro && (
          <TouchableOpacity onPress={() => navigation.navigate('Tags')}>
            <Text style={styles.linkTags}>Ver tags</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={eventos}
        keyExtractor={(item) => String(item.id)}
        refreshing={carregando}
        onRefresh={carregarEventos}
        ListEmptyComponent={
          !carregando ? (
            <Text style={styles.vazio}>Nenhum evento salvo ainda. Toque em "+" pra criar o primeiro.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const horasRestantes = (item.data.getTime() - Date.now()) / (1000 * 60 * 60);
          const urgente = horasRestantes >= 0 && horasRestantes <= LIMITE_URGENTE_HORAS;

          return (
            <TouchableOpacity
              style={[styles.card, urgente && styles.cardUrgente]}
              onLongPress={() => handleApagar(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitulo}>{item.titulo}</Text>
                <Text style={[styles.cardData, urgente && styles.cardDataUrgente]}>
                  {formatarDataLegivel(item.data)}
                </Text>
              </View>
              <Text style={[styles.cardDias, urgente && styles.cardDiasUrgente]}>
                {formatarDiasRestantes(horasRestantes)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.botaoNovo} onPress={() => navigation.navigate('Input')}>
        <Text style={styles.botaoNovoTexto}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatarDataLegivel(data: Date): string {
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}, ${hh}:${min}`;
}

function formatarDiasRestantes(horas: number): string {
  if (horas < 0) return 'passou';
  if (horas < 24) return 'hoje';
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo: { fontSize: 20, fontWeight: '600' },
  linkTags: { fontSize: 13, color: '#378ADD' },
  vazio: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  cardUrgente: { backgroundColor: '#fdeaea' },
  cardTitulo: { fontSize: 14, fontWeight: '500' },
  cardData: { fontSize: 12, color: '#888', marginTop: 2 },
  cardDataUrgente: { color: '#c0392b' },
  cardDias: { fontSize: 12, color: '#888' },
  cardDiasUrgente: { color: '#c0392b', fontWeight: '600' },
  botaoNovo: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoNovoTexto: { color: '#fff', fontSize: 24, lineHeight: 26 },
});
