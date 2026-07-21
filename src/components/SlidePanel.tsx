import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated, Dimensions, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const LARGURA_TELA = Dimensions.get('window').width;
// Painel ocupa a maior parte da largura mas sempre deixa uma faixa do
// fundo visível à esquerda (~14%) — reforça que é um painel sobreposto,
// não uma troca de tela inteira, e dá uma área óbvia pra tocar fora e fechar.
export const LARGURA_PAINEL_PADRAO = Math.min(LARGURA_TELA * 0.86, 360);

type Props = {
  visivel: boolean;
  onFechar: () => void;
  largura?: number;
  children: React.ReactNode;
  // MUDANÇA (item 7): quando true, o painel NÃO abre seu próprio Modal
  // nativo — em vez disso renderiza como uma camada absoluta posicionada
  // pra ficar por cima do conteúdo já presente no Modal de outro SlidePanel
  // (o caso do painel empilhado de Tags/Sincronizar por cima do drawer de
  // configurações — ver SettingsDrawer.tsx). Dois <Modal> nativos abertos
  // ao mesmo tempo no Android empilham por ordem de montagem, o que
  // costuma funcionar mas é frágil; ficar dentro de um Modal só evita esse
  // risco.
  semModalProprio?: boolean;
  // zIndex/elevation dessa camada quando semModalProprio — precisa ser
  // maior que a do painel de fora pra ficar por cima dele.
  zIndice?: number;
};

/**
 * Painel lateral deslizante reaproveitável — extraído do SettingsDrawer
 * original (mesma animação translateX + opacidade do backdrop, mesmo
 * Animated.parallel). Usado tanto pro drawer de configurações raiz quanto
 * pelos painéis empilhados de Tags/Sincronizar dentro dele (item 7).
 *
 * CORREÇÃO (bug reportado: drawer "deslizando torto"/bugado, dificultando
 * navegação): o gesto de arrastar-pra-fechar (PanGestureHandler, item 10)
 * foi removido. Ele envolvia TODO o conteúdo do painel — inclusive
 * controles horizontais como o seletor de tema e a grade de cores de
 * destaque — então qualquer toque com um mínimo de deslize horizontal
 * (comum em toques reais) competia com o próprio botão sendo tocado: o
 * painel "arrastava" um pouco (efeito de slide estranho) e o toque no
 * controle por baixo podia se perder, dando a sensação de travado/bugado.
 * Fechar continua funcionando por dois caminhos nativos, sem esse
 * conflito: tocar fora do painel (backdrop) e o botão/gesto de voltar do
 * Android (`onRequestClose` do Modal, abaixo) — os mesmos dois caminhos
 * que os antigos botões de "x"/voltar apenas duplicavam.
 */
export default function SlidePanel({
  visivel,
  onFechar,
  largura = LARGURA_PAINEL_PADRAO,
  children,
  semModalProprio = false,
  zIndice = 50,
}: Props) {
  const theme = useTheme();

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

  // Continua "montado" um instante depois de visivel virar false, só pra
  // deixar a animação de saída terminar — sem isso o painel some
  // instantaneamente em vez de deslizar pra fora.
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

  // Modal (nativo do RN, sem lib nova) em vez de só uma View absoluta: o
  // conteúdo de um Modal renderiza numa camada separada da árvore
  // principal — por isso ele NÃO é afetado pelo crossfade de opacidade
  // que o ThemeProvider aplica em toda troca de tema/acento (ver
  // ThemeContext.tsx). Isso também cobre de graça o painel empilhado
  // (semModalProprio) que for renderizado dentro deste, já que ele
  // reaproveita esta mesma árvore nativa. Sem gesto de arrastar (ver
  // comentário acima), não precisa mais de GestureHandlerRootView próprio
  // aqui dentro.
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
