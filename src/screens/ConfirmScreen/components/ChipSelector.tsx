// Grupo de chips (pílulas) de opção única, reaproveitado pra duração, antecedência e recorrência do formulário.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { criarStyles } from '../styles';

type Opcao<T extends string> = { valor: T; label: string };

type ChipSelectorProps<T extends string> = {
  opcoes: Opcao<T>[];
  valorSelecionado: T;
  onSelecionar: (valor: T) => void;
  styles: ReturnType<typeof criarStyles>;
};

function ChipSelector<T extends string>({ opcoes, valorSelecionado, onSelecionar, styles }: ChipSelectorProps<T>) {
  return (
    <View style={styles.chipsRow}>
      {opcoes.map((opcao) => {
        const selecionada = valorSelecionado === opcao.valor;
        return (
          <Pressable
            key={opcao.valor}
            style={({ pressed }) => [styles.chip, selecionada && styles.chipSelecionado, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => onSelecionar(opcao.valor)}
          >
            <Text style={[styles.chipTexto, selecionada && styles.chipTextoSelecionado]}>{opcao.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default ChipSelector;
