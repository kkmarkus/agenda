import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme, useThemeConfig, ModoPreferido } from '../theme/ThemeContext';
import { ACCENT_PRESETS } from '../theme/theme';
import {
  lerDuracaoEAntecedenciaPadrao,
  definirPreferencia,
  PREF_DURACAO_PADRAO_MINUTOS,
  PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS,
  montarBackup,
  restaurarBackup,
  BackupDados,
} from '../services/database';
import * as Calendar from 'expo-calendar';
import { obterStatusPermissao } from '../services/calendarService';
import SlidePanel from './SlidePanel';
import TagsPanelContent from './TagsPanelContent';
import CalendarSyncPanelContent from './CalendarSyncPanelContent';
import ConfirmDialog from './ConfirmDialog';
import appJson from '../../app.json';

// Painel principal de configurações (tema, padrões de duração/alarme,
// backup) que também abre os sub-painéis de Tags e Sincronização por
// cima de si mesmo (ver `painelAberto`).

type Props = {
  visivel: boolean;
  onFechar: () => void;
};

const OPCOES_MODO: { valor: ModoPreferido; label: string; icone: keyof typeof Feather.glyphMap }[] = [
  { valor: 'light', label: 'Claro', icone: 'sun' },
  { valor: 'dark', label: 'Escuro', icone: 'moon' },
  { valor: 'system', label: 'Sistema', icone: 'smartphone' },
];

const OPCOES_DURACAO_PADRAO: { valor: '30' | '60' | '120'; label: string }[] = [
  { valor: '30', label: '30 min' },
  { valor: '60', label: '1h' },
  { valor: '120', label: '2h' },
];

const OPCOES_ANTECEDENCIA_PADRAO: { valor: '10' | '30' | '60' | '1440'; label: string }[] = [
  { valor: '10', label: '10 min' },
  { valor: '30', label: '30 min' },
  { valor: '60', label: '1h' },
  { valor: '1440', label: '1 dia' },
];

function SettingsDrawer({ visivel, onFechar }: Props) {
  const theme = useTheme();
  const { modoPreferido, presetAtual, definirModoPreferido, definirAccentPresetId } = useThemeConfig();
  const styles = useMemo(() => criarStyles(theme), [theme]);

  const [painelAberto, setPainelAberto] = useState<'tags' | 'sincronizar' | null>(null);

  function fecharTudo() {
    setPainelAberto(null);
    onFechar();
  }

  // Botão "voltar"/gesto de fechar: se um sub-painel (Tags/Sincronizar)
  // estiver aberto por cima, fecha só ele primeiro; só fecha tudo se já
  // estiver na tela principal de Configurações.
  function fecharUmNivel() {
    if (painelAberto !== null) {
      setPainelAberto(null);
    } else {
      fecharTudo();
    }
  }

  const [duracaoPadrao, setDuracaoPadraoState] = useState<'30' | '60' | '120'>('60');
  const [antecedenciaPadrao, setAntecedenciaPadraoState] = useState<'10' | '30' | '60' | '1440'>('30');

  const [statusPermissao, setStatusPermissao] = useState<Calendar.PermissionStatus>(
    Calendar.PermissionStatus.UNDETERMINED
  );

  const [backupPendente, setBackupPendente] = useState<BackupDados | null>(null);
  const [aviso, setAviso] = useState<{ titulo: string; mensagem: string } | null>(null);
  const [processandoBackup, setProcessandoBackup] = useState(false);

  // Recarrega as preferências e o status de permissão toda vez que o
  // painel abre, pra refletir mudanças feitas em outra tela (ex: usuário
  // concedeu a permissão pelas configurações do sistema e voltou).
  useEffect(() => {
    if (!visivel) return;
    const { duracaoPadrao, antecedenciaPadrao } = lerDuracaoEAntecedenciaPadrao();
    if (duracaoPadrao) setDuracaoPadraoState(duracaoPadrao);
    if (antecedenciaPadrao) setAntecedenciaPadraoState(antecedenciaPadrao);

    obterStatusPermissao().then((status) => setStatusPermissao(status));
  }, [visivel]);

  function definirDuracaoPadrao(valor: '30' | '60' | '120') {
    setDuracaoPadraoState(valor);
    definirPreferencia(PREF_DURACAO_PADRAO_MINUTOS, valor);
  }

  function definirAntecedenciaPadrao(valor: '10' | '30' | '60' | '1440') {
    setAntecedenciaPadraoState(valor);
    definirPreferencia(PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS, valor);
  }

  async function handleExportarDados() {
    setProcessandoBackup(true);
    try {
      const disponivel = await Sharing.isAvailableAsync();
      if (!disponivel) {
        setAviso({
          titulo: 'Compartilhamento indisponível',
          mensagem: 'Este aparelho não suporta compartilhar arquivos.',
        });
        return;
      }

      const dados = montarBackup();
      const dataArquivo = new Date().toISOString().slice(0, 10);
      const caminho = `${FileSystem.cacheDirectory}agenda-backup-${dataArquivo}.json`;
      await FileSystem.writeAsStringAsync(caminho, JSON.stringify(dados, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(caminho, { mimeType: 'application/json', dialogTitle: 'Exportar dados do Agenda' });
    } catch (erro) {
      console.error('Erro ao exportar backup:', erro);
      setAviso({ titulo: 'Erro ao exportar', mensagem: 'Não foi possível gerar o arquivo de backup. Tente novamente.' });
    } finally {
      setProcessandoBackup(false);
    }
  }

  // Valida a forma de cada item, não só a presença dos arrays no nível
  // raiz — um JSON com `tagCores: [{}]` passava na checagem anterior e só
  // ia dar problema depois, silenciosamente (ex: `corIndex` inválido vira
  // `undefined` em `paleta[corIndex % paleta.length]` e quebra a tela de
  // Tags só quando o usuário for olhar aquela tag específica).
  function pareceBackupValido(valor: unknown): valor is BackupDados {
    if (!valor || typeof valor !== 'object') return false;
    const v = valor as Record<string, unknown>;

    if (
      !Array.isArray(v.tagCores) ||
      !Array.isArray(v.eventoTags) ||
      !Array.isArray(v.preferencias) ||
      !Array.isArray(v.calendariosSync)
    ) {
      return false;
    }

    const textoNaoVazio = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
    const corIndexValido = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;

    return (
      v.tagCores.every((item) => {
        const i = item as Record<string, unknown>;
        return textoNaoVazio(i?.tag) && corIndexValido(i?.corIndex);
      }) &&
      v.eventoTags.every((item) => {
        const i = item as Record<string, unknown>;
        return textoNaoVazio(i?.nativeEventId) && textoNaoVazio(i?.tag);
      }) &&
      v.preferencias.every((item) => {
        const i = item as Record<string, unknown>;
        return textoNaoVazio(i?.chave) && typeof i?.valor === 'string';
      }) &&
      v.calendariosSync.every((item) => {
        const i = item as Record<string, unknown>;
        return textoNaoVazio(i?.calendarId) && typeof i?.ativo === 'boolean';
      })
    );
  }

  async function handleImportarDados() {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (resultado.canceled || resultado.assets.length === 0) return;

      setProcessandoBackup(true);
      const conteudo = await FileSystem.readAsStringAsync(resultado.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const dados = JSON.parse(conteudo);

      if (!pareceBackupValido(dados)) {
        setAviso({
          titulo: 'Arquivo inválido',
          mensagem: 'Esse arquivo não parece ser um backup exportado pelo Agenda.',
        });
        return;
      }

      setBackupPendente(dados);
    } catch (erro) {
      console.error('Erro ao importar backup:', erro);
      setAviso({ titulo: 'Erro ao importar', mensagem: 'Não foi possível ler o arquivo selecionado.' });
    } finally {
      setProcessandoBackup(false);
    }
  }

  // Depois de restaurar, releitura das preferências: a duração/
  // antecedência padrão podem ter vindo diferentes no backup importado.
  function confirmarRestauracao() {
    if (!backupPendente) return;
    try {
      restaurarBackup(backupPendente);
      setBackupPendente(null);

      const { duracaoPadrao, antecedenciaPadrao } = lerDuracaoEAntecedenciaPadrao();
      if (duracaoPadrao) setDuracaoPadraoState(duracaoPadrao);
      if (antecedenciaPadrao) setAntecedenciaPadraoState(antecedenciaPadrao);
      setAviso({ titulo: 'Dados restaurados', mensagem: 'O backup foi importado com sucesso.' });
    } catch (erro) {
      console.error('Erro ao restaurar backup:', erro);
      setAviso({ titulo: 'Erro ao restaurar', mensagem: 'Não foi possível aplicar o backup. Nada foi alterado.' });
    }
  }

  return (
    <SlidePanel visivel={visivel} onFechar={fecharUmNivel}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.painelConteudo}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitulo}>Configurações</Text>
        </View>

        <Text style={styles.secaoTitulo}>ORGANIZAÇÃO</Text>
        <Pressable
          style={({ pressed }) => [styles.itemMenu, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setPainelAberto('tags')}
        >
          <View style={styles.itemIconeCirculo}>
            <Feather name="tag" size={16} color={theme.colors.accent} />
          </View>
          <Text style={styles.itemTexto}>Tags</Text>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.itemMenu, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setPainelAberto('sincronizar')}
        >
          <View style={styles.itemIconeCirculo}>
            <Feather name="refresh-cw" size={16} color={theme.colors.accent} />
          </View>
          <Text style={styles.itemTexto}>Sincronizar calendários</Text>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>

        {/* Status de permissão da agenda, com atalho pras configurações do sistema se ainda não concedida. */}
        <View style={styles.itemMenu}>
          <View style={styles.itemIconeCirculo}>
            <Feather
              name={statusPermissao === Calendar.PermissionStatus.GRANTED ? 'check-circle' : 'alert-circle'}
              size={16}
              color={statusPermissao === Calendar.PermissionStatus.GRANTED ? theme.colors.accent : theme.colors.urgent}
            />
          </View>
          <Text style={styles.itemTexto}>
            {statusPermissao === Calendar.PermissionStatus.GRANTED ? 'Acesso à agenda concedido' : 'Sem acesso à agenda'}
          </Text>
          {statusPermissao !== Calendar.PermissionStatus.GRANTED && (
            <Pressable
              style={({ pressed }) => [styles.botaoAbrirConfig, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.botaoAbrirConfigTexto}>Ajustar</Text>
            </Pressable>
          )}
        </View>

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

        <Text style={[styles.secaoTitulo, styles.secaoComEspaco]}>PADRÕES</Text>

        <Text style={styles.rotuloMini}>DURAÇÃO PADRÃO</Text>
        <View style={styles.segmentado}>
          {OPCOES_DURACAO_PADRAO.map((opcao) => {
            const ativo = duracaoPadrao === opcao.valor;
            return (
              <Pressable
                key={opcao.valor}
                style={({ pressed }) => [
                  styles.segmentoItem,
                  ativo && styles.segmentoItemAtivo,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => definirDuracaoPadrao(opcao.valor)}
              >
                <Text style={[styles.segmentoTexto, ativo && { color: theme.colors.accentText }]}>
                  {opcao.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.rotuloMini, styles.rotuloComEspaco]}>ANTECEDÊNCIA PADRÃO DO ALARME</Text>
        <View style={styles.segmentado}>
          {OPCOES_ANTECEDENCIA_PADRAO.map((opcao) => {
            const ativo = antecedenciaPadrao === opcao.valor;
            return (
              <Pressable
                key={opcao.valor}
                style={({ pressed }) => [
                  styles.segmentoItem,
                  ativo && styles.segmentoItemAtivo,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => definirAntecedenciaPadrao(opcao.valor)}
              >
                <Text style={[styles.segmentoTexto, ativo && { color: theme.colors.accentText }]}>
                  {opcao.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.secaoTitulo, styles.secaoComEspaco]}>DADOS</Text>
        <Pressable
          style={({ pressed }) => [styles.itemMenu, { opacity: pressed || processandoBackup ? 0.6 : 1 }]}
          onPress={handleExportarDados}
          disabled={processandoBackup}
        >
          <View style={styles.itemIconeCirculo}>
            <Feather name="upload" size={16} color={theme.colors.accent} />
          </View>
          <Text style={styles.itemTexto}>Exportar dados</Text>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.itemMenu, { opacity: pressed || processandoBackup ? 0.6 : 1 }]}
          onPress={handleImportarDados}
          disabled={processandoBackup}
        >
          <View style={styles.itemIconeCirculo}>
            <Feather name="download" size={16} color={theme.colors.accent} />
          </View>
          <Text style={styles.itemTexto}>Importar dados</Text>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>

        <View style={styles.rodape}>
          <Text style={styles.rodapeTexto}>
            {appJson.expo.name} · v{appJson.expo.version}
          </Text>
        </View>
      </ScrollView>

      {/* Sub-painel (Tags ou Sincronizar) empilhado por cima deste, sem Modal próprio pra não aninhar modais. */}
      <SlidePanel
        visivel={painelAberto !== null}
        onFechar={() => setPainelAberto(null)}
        semModalProprio
        zIndice={60}
      >
        {painelAberto === 'tags' && <TagsPanelContent />}
        {painelAberto === 'sincronizar' && <CalendarSyncPanelContent />}
      </SlidePanel>

      <ConfirmDialog
        visivel={backupPendente !== null}
        titulo="Importar backup"
        mensagem={`Isso vai substituir as cores de tag e as preferências atuais pelas do arquivo (${backupPendente?.tagCores.length ?? 0} cores de tag, ${backupPendente?.eventoTags.length ?? 0} vínculos de tag). Eventos da agenda em si não são afetados.`}
        icone="upload-cloud"
        destrutivo
        textoCancelar="Cancelar"
        textoConfirmar="Substituir"
        onConfirmar={confirmarRestauracao}
        onFechar={() => setBackupPendente(null)}
      />
      <ConfirmDialog
        visivel={aviso !== null}
        titulo={aviso?.titulo ?? ''}
        mensagem={aviso?.mensagem ?? ''}
        icone="alert-circle"
        textoConfirmar="Entendi"
        onConfirmar={() => setAviso(null)}
        onFechar={() => setAviso(null)}
      />
    </SlidePanel>
  );
}

export default React.memo(SettingsDrawer);

function criarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    painelConteudo: { padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    headerTitulo: { ...theme.typography.heading, fontSize: 20, color: theme.colors.textPrimary },
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
    botaoAbrirConfig: {
      paddingHorizontal: theme.spacing.sm + 2,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.accentSoft,
    },
    botaoAbrirConfigTexto: { ...theme.typography.caption, color: theme.colors.accent },
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

    gradeCores: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: theme.spacing.sm + 2 },
    bolinhaWrapper: {
      width: '22%',
      alignItems: 'center',
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
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    rodapeTexto: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
  });
}
