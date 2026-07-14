import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { pedirPermissao, criarEventoNaAgenda } from '../services/calendarService';
import { salvarRegistro, listarTagsUnicas } from '../services/database';
import { NovoEvento } from '../types/event';

type Props = {
  navigation: { navigate: (tela: 'Dashboard') => void; goBack: () => void };
  route: { params: { rascunho: Partial<NovoEvento> } };
};

export default function ConfirmScreen({ navigation, route }: Props) {
  const { rascunho } = route.params;

  const [titulo, setTitulo] = useState(rascunho.titulo ?? '');
  const [dataStr, setDataStr] = useState(formatarData(rascunho.data));
  const [horaStr, setHoraStr] = useState(formatarHora(rascunho.data));
  const [descricao, setDescricao] = useState(rascunho.descricao ?? '');
  const [tag, setTag] = useState(rascunho.tag ?? '');
  const [tagsExistentes, setTagsExistentes] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Autocomplete: carrega as tags já usadas por ela pra sugerir como chips.
  useEffect(() => {
    setTagsExistentes(listarTagsUnicas());
  }, []);

  async function handleSalvar() {
    const data = montarData(dataStr, horaStr);

    if (!titulo.trim()) {
      Alert.alert('Falta o título', 'Digite um título pro evento antes de salvar.');
      return;
    }
    if (!data) {
      Alert.alert('Data inválida', 'Confira o formato: dd/mm/aaaa e HH:mm.');
      return;
    }
    if (!tag.trim()) {
      Alert.alert('Falta a tag', 'Escolha ou digite uma tag pra organizar esse evento.');
      return;
    }

    setSalvando(true);
    try {
      const temPermissao = await pedirPermissao();
      if (!temPermissao) {
        Alert.alert('Permissão necessária', 'O app precisa de acesso à agenda pra salvar o evento.');
        return;
      }

      const evento: NovoEvento = { titulo: titulo.trim(), data, descricao: descricao.trim() || undefined, tag: tag.trim() };
      const nativeEventId = await criarEventoNaAgenda(evento);
      salvarRegistro(nativeEventId, evento.tag);

      navigation.navigate('Dashboard');
    } catch (erro) {
      Alert.alert('Erro ao salvar', 'Não foi possível salvar o evento. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.titulo}>Confirmar evento</Text>
      <Text style={styles.subtitulo}>Revise e ajuste antes de salvar</Text>

      <Text style={styles.label}>Título</Text>
      <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} />

      <View style={styles.linhaDupla}>
        <View style={styles.inputMetade}>
          <Text style={styles.label}>Data</Text>
          <TextInput style={styles.input} placeholder="dd/mm/aaaa" value={dataStr} onChangeText={setDataStr} />
        </View>
        <View style={styles.inputMetade}>
          <Text style={styles.label}>Hora</Text>
          <TextInput style={styles.input} placeholder="HH:mm" value={horaStr} onChangeText={setHoraStr} />
        </View>
      </View>

      <Text style={styles.label}>Descrição (opcional)</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        multiline
        placeholder="Detalhes adicionais do evento"
        value={descricao}
        onChangeText={setDescricao}
      />

      <Text style={styles.label}>Tag</Text>
      <TextInput style={styles.input} placeholder="Ex: Universidade" value={tag} onChangeText={setTag} />

      {tagsExistentes.length > 0 && (
        <View style={styles.chipsRow}>
          {tagsExistentes.map((t) => (
            <TouchableOpacity key={t} style={styles.chip} onPress={() => setTag(t)}>
              <Text style={styles.chipTexto}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.botoesRow}>
        <TouchableOpacity style={styles.botaoSecundario} onPress={() => navigation.goBack()}>
          <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botaoPrincipal} onPress={handleSalvar} disabled={salvando}>
          <Text style={styles.botaoPrincipalTexto}>{salvando ? 'Salvando...' : 'Salvar na agenda'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function formatarData(data?: Date): string {
  if (!data) return '';
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${data.getFullYear()}`;
}

function formatarHora(data?: Date): string {
  if (!data) return '';
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

function montarData(dataStr: string, horaStr: string): Date | null {
  const matchData = dataStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!matchData) return null;
  const [, dia, mes, ano] = matchData;

  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  const matchHora = horaStr.match(/(\d{1,2}):(\d{2})/);
  if (matchHora) {
    const [, hora, minuto] = matchHora;
    data.setHours(Number(hora), Number(minuto), 0, 0);
  } else {
    data.setHours(8, 0, 0, 0);
  }

  return data;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  titulo: { fontSize: 20, fontWeight: '600' },
  subtitulo: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 16 },
  label: { fontSize: 12, color: '#888', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  textarea: { minHeight: 60, textAlignVertical: 'top' },
  linhaDupla: { flexDirection: 'row', gap: 8 },
  inputMetade: { flex: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipTexto: { fontSize: 12, color: '#444' },
  botoesRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 24 },
  botaoSecundario: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  botaoSecundarioTexto: { fontSize: 14, color: '#111' },
  botaoPrincipal: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  botaoPrincipalTexto: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
