import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme, useThemeConfig, ModoPreferido } from '../theme/ThemeContext';
import { ACCENT_PRESETS } from '../theme/theme';
import {
  obterPreferencia,
  definirPreferencia,
  PREF_DURACAO_PADRAO_MINUTOS,
  PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS,
  montarBackup,
  restaurarBackup,
  BackupDados,
} from '../services/database';
import { obterStatusPermissao } from '../services/calendarService';
import SlidePanel, { LARGURA_PAINEL_PADRAO } from './SlidePanel';
import TagsPanelContent from './TagsPanelContent';
import CalendarSyncPanelContent from './CalendarSyncPanelContent';
import ConfirmDialog from './ConfirmDialog';
import appJson from '../../app.json';

type Props = {
  visivel: boolean;
  onFechar: () => void;
};

const OPCOES_MODO: { valor: ModoPreferido; label: string; icone: keyof typeof Feather.glyphMap }[] = [
  { valor: 'light', label: 'Claro', icone: 'sun' },
  { valor: 'dark', label: 'Escuro', icone: 'moon' },
  { valor: 'system', label: 'Sistema', icone: 'smartphone' },
];

// MUDANÇA (item 8.1): opções fixas dos padrões globais de duração/alarme —
// os mesmos valores oferecidos por evento na ConfirmScreen, exceto
// "Personalizado"/"Dia inteiro"/"Sem alarme": o padrão global precisa ser
// um valor concreto sempre aplicável a qualquer evento novo, então fica
// restrito ao mesmo conjunto fechado de opções comuns.
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

/**
 * Menu lateral de configurações. A animação de slide/backdrop mora agora em
 * SlidePanel.tsx (item 7) — este componente só monta o CONTEÚDO e controla
 * a pilha de painéis empilhados (Tags/Sincronizar), que abrem por cima
 * dele sem fechá-lo nem trocar de tela.
 *
 * CORREÇÃO (performance): o Dashboard mantém este componente sempre
 * montado por trás dele (comentário mais abaixo), então digitar na busca,
 * trocar de aba de tag ou puxar a lista pra atualizar — qualquer
 * re-render do Dashboard — recriava a árvore inteira do menu de
 * configurações (todos os itens, o seletor de tema, a grade de cores) a
 * cada tecla digitada, mesmo com o menu fechado e invisível. `React.memo`
 * faz o componente só re-renderizar quando `visivel`/`onFechar`
 * realmente mudam — quem chama precisa passar um `onFechar` estável (ver
 * `useCallback` em DashboardScreen.tsx) pra isso funcionar de verdade.
 */
function SettingsDrawer({ visivel, onFechar }: Props) {
  const theme = useTheme();
  const { modoPreferido, presetAtual, definirModoPreferido, definirAccentPresetId } = useThemeConfig();
  const styles = useMemo(() => criarStyles(theme), [theme]);

  // MUDANÇA (item 7): pilha simples de estado — só existe uma raiz (este
  // drawer) e, no máximo, UM painel secundário empilhado por vez (não faz
  // sentido abrir Tags e Sincronizar simultaneamente). `null` = nenhum
  // painel secundário aberto, ou seja, "na raiz".
  const [painelAberto, setPainelAberto] = useState<'tags' | 'sincronizar' | null>(null);

  // Fechar o drawer inteiro (backdrop do próprio drawer) sempre fecha os
  // dois de uma vez e reseta a pilha, pra reabrir sempre na raiz.
  function fecharTudo() {
    setPainelAberto(null);
    onFechar();
  }

  // CORREÇÃO (remoção dos botões de voltar/fechar próprios — item da
  // etapa de bugs): sem os botões "arrow-left" de TagsPanelContent e
  // CalendarSyncPanelContent, o único jeito de sair de um painel
  // empilhado passa a ser o backdrop (que já fecha só ele, ver
  // `onFechar` do SlidePanel empilhado mais abaixo) ou o botão/gesto de
  // voltar nativo do Android. Esse último, antes, estava ligado direto a
  // `fecharTudo` no SlidePanel raiz — pressionar voltar com um painel
  // empilhado aberto pulava os dois níveis de uma vez, em vez de sair só
  // do painel de cima primeiro. Esta função dá um passo de cada vez: sai
  // do painel empilhado se houver um aberto, senão fecha o drawer.
  function fecharUmNivel() {
    if (painelAberto !== null) {
      setPainelAberto(null);
    } else {
      fecharTudo();
    }
  }

  // MUDANÇA (item 8.1): padrões globais de duração/alarme, persistidos em
  // `preferencias`. Recarregados toda vez que o drawer abre (não só na
  // montagem) — o componente fica sempre montado por trás do Dashboard
  // (ver comentário em DashboardScreen), então um `useEffect` com `[]` só
  // rodaria uma vez na vida do app inteiro.
  const [duracaoPadrao, setDuracaoPadraoState] = useState<'30' | '60' | '120'>('60');
  const [antecedenciaPadrao, setAntecedenciaPadraoState] = useState<'10' | '30' | '60' | '1440'>('30');

  // MUDANÇA (item 8.2): status atual da permissão de agenda, só pra
  // exibição — checado de novo toda vez que o drawer abre (`useEffect` no
  // `visivel`, não só na montagem), pra refletir se ela mudou a permissão
  // fora do app (ex: revogou em Configurações do Android e voltou).
  const [statusPermissao, setStatusPermissao] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  // MUDANÇA (8.3): dados prontos pra restaurar, aguardando confirmação
  // dela no ConfirmDialog (aviso explícito de que isso substitui
  // cores/preferências atuais) — só chamamos `restaurarBackup` de fato
  // depois que ela confirmar. `aviso` cobre tanto o resultado de
  // exportar/importar (sucesso ou erro) quanto avisos simples de texto
  // único — mesmo padrão de `ConfirmScreen`/`ConfirmMultiplosScreen`, no
  // lugar do `Alert.alert` nativo.
  const [backupPendente, setBackupPendente] = useState<BackupDados | null>(null);
  const [aviso, setAviso] = useState<{ titulo: string; mensagem: string } | null>(null);
  const [processandoBackup, setProcessandoBackup] = useState(false);

  useEffect(() => {
    if (!visivel) return;
    const duracaoSalva = obterPreferencia(PREF_DURACAO_PADRAO_MINUTOS);
    if (duracaoSalva === '30' || duracaoSalva === '60' || duracaoSalva === '120') {
      setDuracaoPadraoState(duracaoSalva);
    }
    const antecedenciaSalva = obterPreferencia(PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS);
    if (
      antecedenciaSalva === '10' ||
      antecedenciaSalva === '30' ||
      antecedenciaSalva === '60' ||
      antecedenciaSalva === '1440'
    ) {
      setAntecedenciaPadraoState(antecedenciaSalva);
    }

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

  /**
   * MUDANÇA (8.3): monta o JSON via `montarBackup` (database.ts) e abre a
   * folha de compartilhamento nativa (`expo-sharing`) — ela escolhe pra
   * onde mandar (Drive, WhatsApp, e-mail...), o app não decide isso por
   * ela. Precisa escrever num arquivo real primeiro (`expo-file-system`):
   * `Sharing.shareAsync` compartilha um caminho de arquivo, não uma string
   * solta em memória.
   */
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
    } catch {
      setAviso({ titulo: 'Erro ao exportar', mensagem: 'Não foi possível gerar o arquivo de backup. Tente novamente.' });
    } finally {
      setProcessandoBackup(false);
    }
  }

  /**
   * Valida o mínimo antes de aceitar como backup de verdade — não confia
   * cegamente em qualquer JSON que ela escolher no seletor de arquivo
   * (podia ser qualquer coisa, de um .json qualquer do Downloads a um
   * arquivo corrompido). Checa só a FORMA (campos existem e são arrays),
   * não o conteúdo de cada item — inconsistências ali (ex: uma cor_index
   * fora do intervalo válido) já são absorvidas pelos mesmos limites que
   * protegem `garantirCorDaTag` no uso normal do app.
   */
  function pareceBackupValido(valor: unknown): valor is BackupDados {
    if (!valor || typeof valor !== 'object') return false;
    const v = valor as Record<string, unknown>;
    return (
      Array.isArray(v.tagCores) &&
      Array.isArray(v.eventoTags) &&
      Array.isArray(v.preferencias) &&
      Array.isArray(v.calendariosSync)
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

      // Não restaura direto — guarda pendente e pede confirmação explícita
      // (ver ConfirmDialog abaixo), já que isso SUBSTITUI cores e
      // preferências atuais por coincidência de chave.
      setBackupPendente(dados);
    } catch {
      setAviso({ titulo: 'Erro ao importar', mensagem: 'Não foi possível ler o arquivo selecionado.' });
    } finally {
      setProcessandoBackup(false);
    }
  }

  function confirmarRestauracao() {
    if (!backupPendente) return;
    try {
      restaurarBackup(backupPendente);
      setBackupPendente(null);
      // Cores/duração/alarme padrão podem ter mudado com a restauração —
      // recarrega os dois pra refletir no drawer sem precisar fechar e
      // reabrir.
      const duracaoSalva = obterPreferencia(PREF_DURACAO_PADRAO_MINUTOS);
      if (duracaoSalva === '30' || duracaoSalva === '60' || duracaoSalva === '120') {
        setDuracaoPadraoState(duracaoSalva);
      }
      const antecedenciaSalva = obterPreferencia(PREF_ANTECEDENCIA_ALARME_PADRAO_MINUTOS);
      if (
        antecedenciaSalva === '10' ||
        antecedenciaSalva === '30' ||
        antecedenciaSalva === '60' ||
        antecedenciaSalva === '1440'
      ) {
        setAntecedenciaPadraoState(antecedenciaSalva);
      }
      setAviso({ titulo: 'Dados restaurados', mensagem: 'O backup foi importado com sucesso.' });
    } catch {
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

        {/* MUDANÇA (item 8.2): status da permissão de agenda. Só mostra o
            botão de abrir configurações quando NÃO está concedida — depois
            de negada uma vez, o Android não deixa mais o app reabrir o
            diálogo nativo de permissão sozinho. */}
        <View style={styles.itemMenu}>
          <View style={styles.itemIconeCirculo}>
            <Feather
              name={statusPermissao === 'granted' ? 'check-circle' : 'alert-circle'}
              size={16}
              color={statusPermissao === 'granted' ? theme.colors.accent : theme.colors.urgent}
            />
          </View>
          <Text style={styles.itemTexto}>
            {statusPermissao === 'granted' ? 'Acesso à agenda concedido' : 'Sem acesso à agenda'}
          </Text>
          {statusPermissao !== 'granted' && (
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
          {/* MUDANÇA (8.4): item discreto — 1 linha, sem virar uma tela de
              ajuda separada, pra não destoar do tom minimalista do rodapé. */}
          <Pressable
            style={({ pressed }) => [styles.linkFeedback, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => Linking.openURL('mailto:contato@agendaapp.dev?subject=Feedback%20do%20Agenda')}
          >
            <Feather name="mail" size={12} color={theme.colors.textMuted} />
            <Text style={styles.rodapeTexto}>Enviar feedback</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* MUDANÇA (item 7): painel empilhado — aparece por cima deste
          drawer, sem Modal próprio (semModalProprio) e com zIndice maior,
          pra ficar visualmente acima. Fecha só ele mesmo
          (setPainelAberto(null)) por backdrop ou pelo voltar nativo (ver
          `fecharUmNivel` acima); o drawer de configurações continua
          montado e visível por trás, do jeito que já estava. */}
      <SlidePanel
        visivel={painelAberto !== null}
        onFechar={() => setPainelAberto(null)}
        largura={LARGURA_PAINEL_PADRAO}
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
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    rodapeTexto: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
    // MUDANÇA (8.4): link discreto abaixo do "Agenda · vX.X.X" — mesmo tom
    // (textMuted, caption), só com o ícone de envelope junto pra sinalizar
    // que é tocável, sem virar um botão chamativo.
    linkFeedback: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  });
}
