// Painel lateral deslizante (usado por Configurações, Tags e
// Sincronização de calendários), com backdrop e animação de entrada/saída.
import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// Função pura (em vez de uma constante lida uma vez com `Dimensions.get`)
// pra quem precisa calcular a largura padrão do painel fora deste
// componente (ex: `SettingsDrawer` calculando a largura de um painel
// aninhado) — assim o valor reage à largura atual da janela, inclusive
// depois de uma rotação de tela, em vez de ficar fixo no valor de quando
// o app abriu.
export function calcularLarguraPainelPadrao(larguraJanela: number): number {
  return Math.min(larguraJanela * 0.86, 360);
}

type Props = {
  visivel: boolean;
  onFechar: () => void;
  largura?: number;
  children: React.ReactNode;

  // Usado quando este painel é aberto por dentro de outro Modal (ex: um
  // painel dentro do SettingsDrawer): evita aninhar <Modal> dentro de
  // <Modal>, o que quebra no Android.
  semModalProprio?: boolean;
  zIndice?: number;
};

export default function SlidePanel({
  visivel,
  onFechar,
  largura: larguraProp,
  children,
  semModalProprio = false,
  zIndice = 50,
}: Props) {
  const theme = useTheme();
  const { width: larguraJanela } = useWindowDimensions();
  const largura = larguraProp ?? calcularLarguraPainelPadrao(larguraJanela);

  const translateX = useRef(new Animated.Value(largura)).current;
  const opacidadeBackdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visivel ? 0 : largura,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacidadeBackdrop, {
        toValue: visivel ? 1 : 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visivel, translateX, opacidadeBackdrop, largura]);

  // Mantém o painel montado durante a animação de saída: se
  // desmontasse na hora que `visivel` vira false, a animação de fechar
  // nunca seria vista.
  const [renderizado, setRenderizado] = useState(visivel);
  useEffect(() => {
    if (visivel) {
      setRenderizado(true);
    } else {
      const timer = setTimeout(() => setRenderizado(false), 260);
      return () => clearTimeout(timer);
    }
  }, [visivel]);

  if (!renderizado) return null;

  const conteudo = (
    <View
      style={[styles.overlayContainer, semModalProprio && { zIndex: zIndice, elevation: zIndice }]}
      pointerEvents={visivel ? 'auto' : 'none'}
    >
      <Animated.View style={[styles.backdrop, { opacity: opacidadeBackdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFechar} />
      </Animated.View>

      <Animated.View
        style={[
          styles.painel,
          {
            width: largura,
            backgroundColor: theme.colors.surfaceElevated,
            borderColor: theme.colors.border,
            borderTopLeftRadius: theme.radius.xl,
            borderBottomLeftRadius: theme.radius.xl,
            shadowColor: theme.shadow.color,
            shadowOpacity: theme.shadow.opacity * 2,
            shadowRadius: theme.shadow.radius,
            transform: [{ translateX }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );

  if (semModalProprio) {
    return conteudo;
  }

  return (
    <Modal visible={renderizado} transparent animationType="none" onRequestClose={onFechar}>
      {conteudo}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 50,
    elevation: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,13,10,0.55)',
  },
  painel: {
    height: '100%',
    borderLeftWidth: 1,
    shadowOffset: { width: -2, height: 0 },
  },
});
