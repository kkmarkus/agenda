import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme/ThemeContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatarData, formatarHora, combinarDataEHora, combinarComHora, abrirDatePicker, abrirTimePicker } from '../../utils/dataHora';
import { criarStyles } from './styles';
import { OPCOES_DURACAO, OPCOES_ANTECEDENCIA, OPCOES_RECORRENCIA, NOMES_DIA_SEMANA_EXTENSO } from './constants';
import ChipSelector from './components/ChipSelector';
import CampoDataHora from './components/CampoDataHora';
import TagsField from './components/TagsField';
import { useTagsDoFormulario } from './hooks/useTagsDoFormulario';
import { useDuracaoEAlarme } from './hooks/useDuracaoEAlarme';
import { useRecorrencia } from './hooks/useRecorrencia';
import { useSalvarEvento } from './hooks/useSalvarEvento';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirmar'>;

export default function ConfirmScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => criarStyles(theme), [theme]);

  const { rascunho, nativeEventId, dataFim, ocorrencia } = route.params;
  const modoEdicao = !!nativeEventId;

  // Intervalo só é possível ao criar um evento novo a partir do parser de
  // texto livre (dataFim vindo da tela anterior); ao editar, sempre é
  // um evento único.
  const ehIntervalo = !!dataFim && !modoEdicao;

  const [titulo, setTitulo] = useState(rascunho.titulo ?? '');

  const [data, setData] = useState<Date>(rascunho.data ?? new Date());
  const [dataFimIntervalo, setDataFimIntervalo] = useState<Date>(dataFim ?? rascunho.data ?? new Date());
  const [descricao, setDescricao] = useState(rascunho.descricao ?? '');
  const [campoFocado, setCampoFocado] = useState<string | null>(null);

  const tagsForm = useTagsDoFormulario(rascunho.tags ?? []);
  const duracaoForm = useDuracaoEAlarme();
  const recorrenciaForm = useRecorrencia(rascunho.recorrencia);
  const { salvando, aviso, setAviso, handleSalvar } = useSalvarEvento({
    navigation,
    modoEdicao,
    nativeEventId,
    ocorrencia,
    ehIntervalo,
    titulo,
    data,
    dataFimIntervalo,
    descricao,
    tagsSelecionadas: tagsForm.tagsSelecionadas,
    antecedenciaOpcao: duracaoForm.antecedenciaOpcao,
    montarDuracaoEDiaInteiro: duracaoForm.montarDuracaoEDiaInteiro,
    montarRecorrencia: recorrenciaForm.montarRecorrencia,
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.overline}>{modoEdicao ? 'EDITAR' : 'REVISAR ANTES DE SALVAR'}</Text>
        <Text style={styles.titulo}>{modoEdicao ? 'Editar evento' : 'Confirmar evento'}</Text>

        {ehIntervalo && (
          <View style={styles.avisoIntervalo}>
            <Feather name="repeat" size={14} color={theme.colors.accent} />
            <Text style={styles.avisoIntervaloTexto}>
              Detectamos um período. Vamos criar dois eventos: um de início e um de prazo final.
            </Text>
          </View>
        )}

        <Text style={styles.label}>TÍTULO</Text>
        <TextInput
          style={[styles.input, campoFocado === 'titulo' && styles.inputFocado]}
          value={titulo}
          onChangeText={setTitulo}
          onFocus={() => setCampoFocado('titulo')}
          onBlur={() => setCampoFocado(null)}
          placeholderTextColor={theme.colors.textMuted}
        />

        <View style={styles.linhaDupla}>
          <View style={styles.inputMetade}>
            <CampoDataHora
              icone="calendar"
              label={ehIntervalo ? 'INÍCIO' : 'DATA'}
              valor={formatarData(data)}
              onPress={() => abrirDatePicker(data, (novaData) => setData((atual) => combinarDataEHora(atual, novaData)))}
              styles={styles}
              theme={theme}
            />
          </View>
          <View style={styles.inputMetade}>
            <CampoDataHora
              icone="clock"
              label="HORA"
              valor={formatarHora(data)}
              onPress={() => abrirTimePicker(data, (novaHora) => setData((atual) => combinarComHora(atual, novaHora)))}
              styles={styles}
              theme={theme}
            />
          </View>
        </View>

        {ehIntervalo && (
          <>
            <CampoDataHora
              icone="flag"
              label="PRAZO FINAL"
              valor={formatarData(dataFimIntervalo)}
              onPress={() =>
                abrirDatePicker(dataFimIntervalo, (novaData) =>
                  setDataFimIntervalo((atual) => combinarDataEHora(atual, novaData))
                )
              }
              styles={styles}
              theme={theme}
            />
            <Text style={styles.dicaHoraCompartilhada}>
              O horário acima ({formatarHora(data)}) é usado nos dois eventos.
            </Text>
          </>
        )}

        {/* Duração/alarme/recorrência só fazem sentido pra um evento único (não pro caso de intervalo). */}
        {!ehIntervalo && (
          <>
            <View style={styles.labelComIcone}>
              <Feather name="clock" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>DURAÇÃO</Text>
            </View>
            <ChipSelector
              opcoes={OPCOES_DURACAO}
              valorSelecionado={duracaoForm.duracaoOpcao}
              onSelecionar={duracaoForm.setDuracaoOpcao}
              styles={styles}
            />

            {duracaoForm.duracaoOpcao === 'personalizado' && (
              <TextInput
                style={[styles.input, campoFocado === 'duracaoPersonalizada' && styles.inputFocado]}
                placeholder="Duração em minutos, ex: 90"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={duracaoForm.duracaoPersonalizadaStr}
                onChangeText={duracaoForm.setDuracaoPersonalizadaStr}
                onFocus={() => setCampoFocado('duracaoPersonalizada')}
                onBlur={() => setCampoFocado(null)}
              />
            )}

            {duracaoForm.duracaoOpcao === 'diaInteiro' && (
              <>
                <Text style={styles.dicaHoraCompartilhada}>
                  Deixe igual ao início pra um evento de um dia só, ou escolha o último dia (ex: viagem, prova de
                  múltiplos dias).
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.input, styles.inputPressable, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={() =>
                    abrirDatePicker(duracaoForm.dataFimDiaInteiro ?? data, (novaData) =>
                      duracaoForm.setDataFimDiaInteiro(
                        new Date(novaData.getFullYear(), novaData.getMonth(), novaData.getDate())
                      )
                    )
                  }
                >
                  <Text style={styles.inputPressableTexto}>
                    {duracaoForm.dataFimDiaInteiro ? formatarData(duracaoForm.dataFimDiaInteiro) : 'Igual ao início (um dia só)'}
                  </Text>
                  <Feather name="chevron-down" size={14} color={theme.colors.textMuted} />
                </Pressable>
                {duracaoForm.dataFimDiaInteiro && (
                  <Pressable
                    style={({ pressed }) => [styles.limparLink, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => duracaoForm.setDataFimDiaInteiro(undefined)}
                  >
                    <Feather name="rotate-ccw" size={12} color={theme.colors.accent} />
                    <Text style={styles.limparLinkTexto}>Voltar a um dia só</Text>
                  </Pressable>
                )}
              </>
            )}

            <View style={styles.labelComIcone}>
              <Feather name="bell" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>ANTECEDÊNCIA DO ALARME</Text>
            </View>
            <ChipSelector
              opcoes={OPCOES_ANTECEDENCIA}
              valorSelecionado={duracaoForm.antecedenciaOpcao}
              onSelecionar={duracaoForm.setAntecedenciaOpcao}
              styles={styles}
            />

            {/* Repetição não define data de término — sempre repete indefinidamente. */}
            <View style={styles.labelComIcone}>
              <Feather name="repeat" size={13} color={theme.colors.textMuted} />
              <Text style={styles.label}>REPETIR</Text>
            </View>
            <ChipSelector
              opcoes={OPCOES_RECORRENCIA}
              valorSelecionado={recorrenciaForm.recorrenciaOpcao}
              onSelecionar={recorrenciaForm.setRecorrenciaOpcao}
              styles={styles}
            />
            {recorrenciaForm.recorrenciaOpcao !== 'nenhuma' && (
              <Text style={styles.dicaHoraCompartilhada}>
                {recorrenciaForm.recorrenciaOpcao === 'diaria' && 'Repete todo dia, sem data de término definida.'}
                {recorrenciaForm.recorrenciaOpcao === 'semanal' &&
                  `Repete toda ${NOMES_DIA_SEMANA_EXTENSO[data.getDay()]}, sem data de término definida.`}
                {recorrenciaForm.recorrenciaOpcao === 'mensal' &&
                  `Repete todo dia ${data.getDate()} do mês, sem data de término definida.`}
              </Text>
            )}
          </>
        )}

        <Text style={styles.label}>DESCRIÇÃO (OPCIONAL)</Text>
        <TextInput
          style={[styles.input, styles.textarea, campoFocado === 'descricao' && styles.inputFocado]}
          multiline
          placeholder="Detalhes adicionais do evento"
          placeholderTextColor={theme.colors.textMuted}
          value={descricao}
          onChangeText={setDescricao}
          onFocus={() => setCampoFocado('descricao')}
          onBlur={() => setCampoFocado(null)}
        />

        <TagsField
          styles={styles}
          theme={theme}
          tagsSelecionadas={tagsForm.tagsSelecionadas}
          coresPorTag={tagsForm.coresPorTag}
          removerTag={tagsForm.removerTag}
          novaTagTexto={tagsForm.novaTagTexto}
          setNovaTagTexto={tagsForm.setNovaTagTexto}
          campoFocado={campoFocado}
          setCampoFocado={setCampoFocado}
          handleAdicionarNovaTag={tagsForm.handleAdicionarNovaTag}
          tagsExistentes={tagsForm.tagsExistentes}
          tagJaSelecionada={tagsForm.tagJaSelecionada}
          alternarTagExistente={tagsForm.alternarTagExistente}
        />

        <View style={styles.botoesRow}>
          <Pressable
            style={({ pressed }) => [
              styles.botaoSecundario,
              { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="x" size={16} color={theme.colors.textPrimary} />
            <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.botaoPrincipalWrapper,
              { opacity: pressed || salvando ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
            onPress={handleSalvar}
            disabled={salvando}
          >
            <View style={[styles.botaoPrincipal, { backgroundColor: theme.colors.accent }]}>
              {salvando ? (
                <ActivityIndicator size="small" color={theme.colors.accentText} style={styles.spinner} />
              ) : (
                <Feather
                  name={modoEdicao ? 'check' : 'calendar'}
                  size={16}
                  color={theme.colors.accentText}
                  style={styles.spinner}
                />
              )}
              <Text style={styles.botaoPrincipalTexto}>
                {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : ehIntervalo ? 'Criar os 2 eventos' : 'Salvar na agenda'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmDialog
        visivel={aviso !== null}
        titulo={aviso?.titulo ?? ''}
        mensagem={aviso?.mensagem ?? ''}
        icone="alert-circle"
        textoConfirmar="Entendi"
        onConfirmar={() => setAviso(null)}
        onFechar={() => setAviso(null)}
      />
    </SafeAreaView>
  );
}
