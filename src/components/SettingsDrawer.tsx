import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Dimensions, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, useThemeConfig, ModoPreferido } from '../theme/ThemeContext';
import { ACCENT_PRESETS } from '../theme/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import appJson from '../../app.json';

type Props = {
  visivel: boolean;
  onFechar: () => void;
  // Tipado pro screen 'Dashboard' especificamente (de onde o drawer é
  // sempre aberto) em vez do NativeStackNavigationProp genérico — a
  // versão genérica (sem o segundo parâmetro de rota) não é atribuível a
  // partir do navigation prop concreto que cada tela recebe, por causa de
  // como TypeScript varia os tipos de setParams entre rotas.
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

const LARGURA_TELA = Dimensions.get('window').width;
// Painel ocupa a maior parte da largura mas sempre deixa uma faixa do
// fundo visível à esquerda (~14%) — reforça que é um painel sobreposto,
// não uma troca de tela inteira, e dá uma área óbvia pra tocar fora e fechar.
const LARGURA_PAINEL = Math.min(LARGURA_TELA * 0.86, 360);

const OPCOES_MODO: { valor: ModoPreferido; label: string; icone: keyof typeof Feather.glyphMap }[] = [
  { valor: 'light', label: 'Claro', icone: 'sun' },
  { valor: 'dark', label: 'Escuro', icone: 'moon' },
  { valor: 'system', label: 'Sistema', icone: 'smartphone' },
];

/**
 * Menu lateral de configurações — construído do zero com Animated (sem
 * dependência nova de drawer navigator) pra não mexer na estrutura de
 * navegação existente nem introduzir mais uma lib nativa num pipeline de
 * build que já teve atrito (ver histórico do Kotlin). Desliza a partir
 * da borda direita, com um backdrop escurecido atrás.
 */
export default function SettingsDrawer({ visivel, onFechar, navigation }: Props) {
  const theme = useTheme();
  const { modoPreferido, presetAtual, definirModoPreferido, definirAccentPresetId } = useThemeConfig();
  const styles = criarStyles(theme);

  const translateX = useRef(new Animated.Value(LARGURA_PAINEL)).current;
  const opacidadeBackdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visivel ? 0 : LARGURA_PAINEL,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacidadeBackdrop, {
        toValue: visivel ? 1 : 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visivel, translateX, opacidadeBackdrop]);

  // Continua "montado" um instante depois de visivel virar false, só pra
  // deixar a animação de saída terminar — sem isso o painel some
  // instantaneamente em vez de deslizar pra fora.
  const [renderizado, setRenderizado] = React.useState(visivel);
  useEffect(() => {
    if (visivel) {
      setRenderizado(true);
    } else {
      const timer = setTimeout(() => setRenderizado(false), 260);
      return () => clearTimeout(timer);
    }
  }, [visivel]);

  if (!renderizado) return null;

  function irPara(tela: 'Tags' | 'Sincronizar') {
    onFechar();
    navigation.navigate(tela);
  }

  return (
    <View style={styles.overlayContainer} pointerEvents={visivel ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: opacidadeBackdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFechar} />
      </Animated.View>

      <Animated.View style={[styles.painel, { transform: [{ translateX }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.painelConteudo}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitulo}>Configurações</Text>
            <Pressable
              style={({ pressed }) => [styles.botaoFechar, { opacity: pressed ? 0.6 : 1 }]}
              onPress={onFechar}
              hitSlop={10}
            >
              <Feather name="x" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.secaoTitulo}>ORGANIZAÇÃO</Text>
          <Pressable
            style={({ pressed }) => [styles.itemMenu, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => irPara('Tags')}
          >
            <View style={styles.itemIconeCirculo}>
              <Feather name="tag" size={16} color={theme.colors.accent} />
            </View>
            <Text style={styles.itemTexto}>Tags</Text>
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.itemMenu, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => irPara('Sincronizar')}
          >
            <View style={styles.itemIconeCirculo}>
              <Feather name="refresh-cw" size={16} color={theme.colors.accent} />
            </View>
            <Text style={styles.itemTexto}>Sincronizar calendários</Text>
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
          </Pressable>

          <Text style={[styles.secaoTitulo, styles.secaoComEspaco]}>APARÊNCIA</Text>

          <Text style={styles.rotuloMini}>TEMA</Text>
          <View style={styles.segmentado}>
            {OPCOES_MODO.map((opcao) => {
              const ativo = modoPreferido === opcao.valor;
              return (
                <Pressable
                  key={opcao.valor}
                  style={({ pressed }) => [
                    styles.segmentoItem,
                    ativo && styles.segmentoItemAtivo,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => definirModoPreferido(opcao.valor)}
                >
                  <Feather
                    name={opcao.icone}
                    size={14}
                    color={ativo ? theme.colors.accentText : theme.colors.textSecondary}
                  />
                  <Text style={[styles.segmentoTexto, ativo && { color: theme.colors.accentText }]}>
                    {opcao.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.rotuloMini, styles.rotuloComEspaco]}>COR DE DESTAQUE</Text>
          <View style={styles.gradeCores}>
            {ACCENT_PRESETS.map((preset) => {
              const selecionado = preset.id === presetAtual.id;
              return (
                <Pressable
                  key={preset.id}
                  style={({ pressed }) => [
                    styles.bolinhaWrapper,
                    selecionado && { borderColor: theme.colors.accent },
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => definirAccentPresetId(preset.id)}
                  hitSlop={4}
                >
                  <View style={[styles.bolinha, { backgroundColor: preset.swatch }]}>
                    {selecionado && <Feather name="check" size={15} color="#FFFFFF" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.nomePresetAtual}>{presetAtual.nome}</Text>

          <View style={styles.rodape}>
            <Text style={styles.rodapeTexto}>
              {appJson.expo.name} · v{appJson.expo.version}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
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
      width: LARGURA_PAINEL,
      height: '100%',
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: theme.radius.xl,
      borderBottomLeftRadius: theme.radius.xl,
      borderLeftWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.shadow.color,
      shadowOpacity: theme.shadow.opacity * 2,
      shadowRadius: theme.shadow.radius,
      shadowOffset: { width: -2, height: 0 },
    },
    painelConteudo: { padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    headerTitulo: { ...theme.typography.heading, fontSize: 20, color: theme.colors.textPrimary },
    botaoFechar: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secaoTitulo: { ...theme.typography.overline, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
    secaoComEspaco: { marginTop: theme.spacing.lg },
    itemMenu: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm + 2,
      paddingVertical: theme.spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemIconeCirculo: {
      width: 30,
      height: 30,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemTexto: { ...theme.typography.bodyMedium, color: theme.colors.textPrimary, flex: 1 },
    rotuloMini: { ...theme.typography.overline, color: theme.colors.textMuted, marginBottom: theme.spacing.xs + 2 },
    rotuloComEspaco: { marginTop: theme.spacing.lg },
    segmentado: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 3,
      gap: 3,
    },
    segmentoItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: theme.spacing.xs + 3,
      borderRadius: theme.radius.sm,
    },
    segmentoItemAtivo: { backgroundColor: theme.colors.accent },
    segmentoTexto: { ...theme.typography.caption, color: theme.colors.textSecondary },
    gradeCores: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm + 2 },
    bolinhaWrapper: {
      padding: 3,
      borderRadius: theme.radius.pill,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    bolinha: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nomePresetAtual: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.sm,
    },
    rodape: {
      marginTop: theme.spacing.xl,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    rodapeTexto: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
  });
}
