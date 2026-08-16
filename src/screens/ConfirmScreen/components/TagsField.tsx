// Campo de tags do formulário: tags já selecionadas (removíveis), campo
// pra adicionar uma nova, e chips de autocomplete com as tags já usadas
// antes (que ainda não estão selecionadas).
import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { useTheme } from '../../../theme/ThemeContext';
import { corDaTag } from '../../../theme/theme';
import type { criarStyles } from '../styles';

type TagsFieldProps = {
  styles: ReturnType<typeof criarStyles>;
  theme: ReturnType<typeof useTheme>;
  tagsSelecionadas: string[];
  coresPorTag: Record<string, number>;
  removerTag: (t: string) => void;
  novaTagTexto: string;
  setNovaTagTexto: (t: string) => void;
  campoFocado: string | null;
  setCampoFocado: (campo: string | null) => void;
  handleAdicionarNovaTag: () => void;
  tagsExistentes: string[];
  tagJaSelecionada: (t: string) => boolean;
  alternarTagExistente: (t: string) => void;
};

function TagsField({
  styles,
  theme,
  tagsSelecionadas,
  coresPorTag,
  removerTag,
  novaTagTexto,
  setNovaTagTexto,
  campoFocado,
  setCampoFocado,
  handleAdicionarNovaTag,
  tagsExistentes,
  tagJaSelecionada,
  alternarTagExistente,
}: TagsFieldProps) {
  const tagsParaAutocomplete = tagsExistentes.filter((t) => !tagJaSelecionada(t));

  return (
    <>
      <View style={styles.labelComIcone}>
        <Feather name="tag" size={13} color={theme.colors.textMuted} />
        <Text style={styles.label}>TAGS (OPCIONAL)</Text>
      </View>

      {tagsSelecionadas.length > 0 && (
        <View style={styles.chipsRow}>
          {tagsSelecionadas.map((t) => {
            const cor = corDaTag(coresPorTag[t.trim().toLowerCase()] ?? 0, theme.mode);
            return (
              <Pressable
                key={t}
                style={({ pressed }) => [styles.chip, styles.chipSelecionado, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => removerTag(t)}
              >
                <View style={[styles.chipBolinha, { backgroundColor: cor.base }]} />
                <Text style={[styles.chipTexto, styles.chipTextoSelecionado]}>{t}</Text>
                <Feather name="x" size={11} color={theme.colors.textPrimary} />
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.linhaAdicionarTag}>
        <TextInput
          style={[styles.input, styles.inputAdicionarTag, campoFocado === 'novaTag' && styles.inputFocado]}
          placeholder="Ex: Universidade"
          placeholderTextColor={theme.colors.textMuted}
          value={novaTagTexto}
          onChangeText={setNovaTagTexto}
          onFocus={() => setCampoFocado('novaTag')}
          onBlur={() => setCampoFocado(null)}
          onSubmitEditing={handleAdicionarNovaTag}
          returnKeyType="done"
        />
        <Pressable
          style={({ pressed }) => [styles.botaoAdicionarTag, { opacity: pressed ? 0.7 : 1 }]}
          onPress={handleAdicionarNovaTag}
          hitSlop={8}
        >
          <Feather name="plus" size={18} color={theme.colors.accentText} />
        </Pressable>
      </View>

      {tagsParaAutocomplete.length > 0 && (
        <View style={styles.chipsRow}>
          {tagsParaAutocomplete.map((t) => {
            const cor = corDaTag(coresPorTag[t.trim().toLowerCase()] ?? 0, theme.mode);
            return (
              <Pressable
                key={t}
                style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => alternarTagExistente(t)}
              >
                <View style={[styles.chipBolinha, { backgroundColor: cor.base }]} />
                <Text style={styles.chipTexto}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </>
  );
}

export default TagsField;
