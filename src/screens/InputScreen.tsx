import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { parseTextoLivre } from '../services/eventParser';
import { NovoEvento } from '../types/event';

type Modo = 'texto' | 'formulario';

// Navegação simplificada — troque pelo tipo real do seu AppNavigator quando integrar.
type Props = {
  navigation: { navigate: (tela: 'Confirmar', params: { rascunho: Partial<NovoEvento> }) => void };
};

export default function InputScreen({ navigation }: Props) {
  const [modo, setModo] = useState<Modo>('texto');
  const [textoLivre, setTextoLivre] = useState('');

  // Campos usados só no modo formulário
  const [tituloForm, setTituloForm] = useState('');
  const [dataForm, setDataForm] = useState(''); // dd/mm/aaaa
  const [horaForm, setHoraForm] = useState(''); // HH:mm

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

  function handleUsarFormulario() {
    if (!tituloForm.trim()) return;

    const data = montarDataDoFormulario(dataForm, horaForm);
    navigation.navigate('Confirmar', {
      rascunho: { titulo: tituloForm, data: data ?? undefined },
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Novo evento</Text>
      <Text style={styles.subtitulo}>
        {modo === 'texto' ? 'Digite ou cole o texto do evento' : 'Preencha os campos do evento'}
      </Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, modo === 'texto' && styles.toggleBtnAtivo]}
          onPress={() => setModo('texto')}
        >
          <Text style={modo === 'texto' ? styles.toggleTextoAtivo : styles.toggleTexto}>
            Texto livre
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, modo === 'formulario' && styles.toggleBtnAtivo]}
          onPress={() => setModo('formulario')}
        >
          <Text style={modo === 'formulario' ? styles.toggleTextoAtivo : styles.toggleTexto}>
            Formulário
          </Text>
        </TouchableOpacity>
      </View>

      {modo === 'texto' ? (
        <>
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
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Título do evento"
            value={tituloForm}
            onChangeText={setTituloForm}
          />
          <View style={styles.linhaDupla}>
            <TextInput
              style={[styles.input, styles.inputMetade]}
              placeholder="dd/mm/aaaa"
              value={dataForm}
              onChangeText={setDataForm}
            />
            <TextInput
              style={[styles.input, styles.inputMetade]}
              placeholder="HH:mm"
              value={horaForm}
              onChangeText={setHoraForm}
            />
          </View>
          <TouchableOpacity style={styles.botaoPrincipal} onPress={handleUsarFormulario}>
            <Text style={styles.botaoPrincipalTexto}>Continuar</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function montarDataDoFormulario(dataStr: string, horaStr: string): Date | null {
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
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  toggleBtnAtivo: { backgroundColor: '#111', borderColor: '#111' },
  toggleTexto: { fontSize: 13, color: '#111' },
  toggleTextoAtivo: { fontSize: 13, color: '#fff' },
  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  linhaDupla: { flexDirection: 'row', gap: 8 },
  inputMetade: { flex: 1 },
  botaoPrincipal: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botaoPrincipalTexto: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
