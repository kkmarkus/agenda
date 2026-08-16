import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { EventoApp } from '../../types/event';
import type { useTheme } from '../../theme/ThemeContext';
import { corDaTag, corDaTagAcentuada, TAG_WASH_ALPHA } from '../../theme/theme';
import { SEM_TAG_LABEL } from '../../services/database';
import type { criarStyles } from './styles';
import { formatarDataLegivel, formatarDiasRestantes } from './format';

// Card de evento na lista do Dashboard, com swipe pra fixar/apagar.
// Memoizado (React.memo) porque a lista pode ter muitos itens e o
// Dashboard reconstrói a lista inteira a cada atualização.

type EventoCardProps = {
  item: EventoApp;
  urgente: boolean;
  horasRestantes: number;
  theme: ReturnType<typeof useTheme>;
  styles: ReturnType<typeof criarStyles>;
  coresPorTag: Record<string, number>;
  registrarSwipeableRef: (id: number, ref: SwipeableMethods | null) => void;
  onSwipeableWillOpen: (id: number) => void;
  onEditar: (evento: EventoApp) => void;
  onAlternarFixado: (evento: EventoApp) => void;
  onApagar: (evento: EventoApp) => void;
};

const EventoCard = React.memo(function EventoCard({
  item,
  urgente,
  horasRestantes,
  theme,
  styles,
  coresPorTag,
  registrarSwipeableRef,
  onSwipeableWillOpen,
  onEditar,
  onAlternarFixado,
  onApagar,
}: EventoCardProps) {
  const tagsParaFaixa = item.tags.slice(0, 3);
  function corDaTagNome(nome: string) {
    return corDaTag(coresPorTag[nome.trim().toLowerCase()] ?? 0, theme.mode);
  }

  function corAcentuadaDaTagNome(nome: string) {
    return corDaTagAcentuada(coresPorTag[nome.trim().toLowerCase()] ?? 0, theme.mode);
  }

  // A faixa lateral colorida mostra até 3 cores (uma por tag, dividida em
  // segmentos); evento urgente sempre mostra a cor de urgência, ignorando
  // as tags.
  const segmentosFaixa: string[] = urgente
    ? [theme.colors.urgent]
    : tagsParaFaixa.length > 0
    ? tagsParaFaixa.map((t) => corDaTagNome(t).base)
    : [theme.colors.textMuted];

  return (
    <Swipeable
      ref={(ref) => registrarSwipeableRef(item.id, ref)}
      overshootRight={false}
      rightThreshold={40}
      friction={2}
      onSwipeableWillOpen={() => onSwipeableWillOpen(item.id)}
      renderRightActions={() => (
        <View style={styles.acoesSwipeRow}>
          <Pressable style={styles.acaoFixar} onPress={() => onAlternarFixado(item)}>
            {/* Ícone muda de cor conforme o estado atual de fixado, sem precisar de dois ícones diferentes. */}
            <MaterialCommunityIcons
              name="pin"
              size={19}
              color={item.fixado ? theme.colors.accent : theme.colors.textMuted}
            />
          </Pressable>
          <Pressable style={styles.acaoApagar} onPress={() => onApagar(item)}>
            <Feather name="trash-2" size={19} color={theme.colors.urgent} />
          </Pressable>
        </View>
      )}
    >
      <Pressable
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => onEditar(item)}
      >
        <View style={styles.faixa}>
          {segmentosFaixa.map((corSegmento, indice) => (
            <View key={indice} style={[styles.faixaSegmento, { backgroundColor: corSegmento }]} />
          ))}
        </View>
        <View style={styles.cardConteudo}>
          <View style={{ flex: 1 }}>
            <View style={styles.cardTituloRow}>
              {item.fixado && <MaterialCommunityIcons name="pin" size={12} color={theme.colors.accent} />}
              {urgente && <Feather name="bell" size={12} color={theme.colors.urgent} />}
              <Text style={styles.cardTitulo} numberOfLines={1}>{item.titulo}</Text>
            </View>
            <View style={styles.cardMetaTagsRow}>
              <Text style={[styles.cardData, urgente && styles.cardDataUrgente]}>
                {formatarDataLegivel(item.data)}
              </Text>
              {item.tags.length === 0 ? (
                <View style={styles.cardTagPill}>
                  <View style={[styles.cardTagBolinha, { backgroundColor: theme.colors.textMuted }]} />
                  <Text style={styles.cardTagTexto} numberOfLines={1}>{SEM_TAG_LABEL}</Text>
                </View>
              ) : (
                <>
                  {item.tags.slice(0, 3).map((nomeTag) => {
                    const corTag = corDaTagNome(nomeTag);
                    return (
                      <View
                        key={nomeTag}
                        style={[styles.cardTagPill, { backgroundColor: corTag.base + TAG_WASH_ALPHA }]}
                      >
                        <View
                          style={[
                            styles.cardTagBolinha,
                            { backgroundColor: corAcentuadaDaTagNome(nomeTag).base },
                          ]}
                        />
                        <Text style={[styles.cardTagTexto, { color: corTag.base }]} numberOfLines={1}>
                          {nomeTag}
                        </Text>
                      </View>
                    );
                  })}
                  {item.tags.length > 3 && (
                    <View style={styles.cardTagPill}>
                      <Text style={styles.cardTagTexto}>+{item.tags.length - 3}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
          <Text style={[styles.cardDias, urgente && styles.cardDiasUrgente]}>
            {formatarDiasRestantes(horasRestantes)}
          </Text>
        </View>
      </Pressable>
    </Swipeable>
  );
});

export default EventoCard;
