// Lógica de salvar/atualizar o evento (ou par início+fim, se for
// intervalo) na agenda nativa + registro local, com rollback em caso de
// falha parcial.
import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  pedirPermissao,
  criarEventoNaAgenda,
  atualizarEventoNaAgenda,
  apagarEventoDaAgenda,
} from '../../../services/calendarService';
import { salvarRegistro, atualizarTagsPorNativeId, apagarRegistro } from '../../../services/database';
import type { NovoEvento } from '../../../types/event';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { combinarComHora } from '../../../utils/dataHora';
import type { DuracaoResultado } from './useDuracaoEAlarme';
import { salvarIntervaloComRollback } from './salvarIntervaloComRollback';

type Navigation = NativeStackScreenProps<RootStackParamList, 'Confirmar'>['navigation'];
type Ocorrencia = { instanceStartDate: Date; futureEvents: boolean } | undefined;

type Params = {
  navigation: Navigation;
  modoEdicao: boolean;
  nativeEventId: string | undefined;
  ocorrencia: Ocorrencia;
  ehIntervalo: boolean;
  titulo: string;
  data: Date;
  dataFimIntervalo: Date;
  descricao: string;
  tagsSelecionadas: string[];
  antecedenciaOpcao: '10' | '30' | '60' | '1440' | 'sem';
  montarDuracaoEDiaInteiro: (dataInicio: Date) => DuracaoResultado;
  montarRecorrencia: (dataInicio: Date) => NovoEvento['recorrencia'];
};

export function useSalvarEvento({
  navigation,
  modoEdicao,
  nativeEventId,
  ocorrencia,
  ehIntervalo,
  titulo,
  data,
  dataFimIntervalo,
  descricao,
  tagsSelecionadas,
  antecedenciaOpcao,
  montarDuracaoEDiaInteiro,
  montarRecorrencia,
}: Params) {
  const [salvando, setSalvando] = useState(false);

  const [aviso, setAviso] = useState<{ titulo: string; mensagem: string } | null>(null);

  async function handleSalvar() {
    if (!titulo.trim()) {
      setAviso({ titulo: 'Falta o título', mensagem: 'Digite um título pro evento antes de salvar.' });
      return;
    }

    if (ehIntervalo) {
      await handleSalvarIntervalo();
      return;
    }

    const duracaoResultado = montarDuracaoEDiaInteiro(data);
    if (!duracaoResultado.ok) {
      setAviso({ titulo: duracaoResultado.titulo, mensagem: duracaoResultado.mensagem });
      return;
    }

    setSalvando(true);
    try {
      const temPermissao = await pedirPermissao();
      if (!temPermissao) {
        setAviso({ titulo: 'Permissão necessária', mensagem: 'O app precisa de acesso à agenda pra salvar o evento.' });
        return;
      }

      const evento: NovoEvento = {
        titulo: titulo.trim(),
        data,
        descricao: descricao.trim() || undefined,
        tags: tagsSelecionadas,
        diaInteiro: duracaoResultado.diaInteiro,
        duracaoMinutos: duracaoResultado.diaInteiro ? undefined : duracaoResultado.duracaoMinutos,
        dataFimDiaInteiro: duracaoResultado.diaInteiro ? duracaoResultado.dataFimDiaInteiro : undefined,
        antecedenciaAlarmeMinutos: antecedenciaOpcao === 'sem' ? null : Number(antecedenciaOpcao),
        recorrencia: montarRecorrencia(data),
      };

      if (modoEdicao && nativeEventId) {
        await atualizarEventoNaAgenda(nativeEventId, evento, ocorrencia);
        atualizarTagsPorNativeId(nativeEventId, evento.tags);
      } else {
        const novoNativeEventId = await criarEventoNaAgenda(evento);
        salvarRegistro(novoNativeEventId, evento.tags);
      }

      navigation.navigate('Dashboard');
    } catch (erro) {
      console.error('Erro ao salvar evento:', erro);
      setAviso({ titulo: 'Erro ao salvar', mensagem: 'Não foi possível salvar o evento. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  }

  // Intervalo vira DOIS eventos na agenda ("Início" e "Prazo final"), não
  // um evento só com múltiplos dias.
  async function handleSalvarIntervalo() {
    const inicio = data;
    const fim = combinarComHora(dataFimIntervalo, data);

    if (fim.getTime() < inicio.getTime()) {
      setAviso({ titulo: 'Datas fora de ordem', mensagem: 'A data final precisa ser igual ou depois da data de início.' });
      return;
    }

    setSalvando(true);
    try {
      const temPermissao = await pedirPermissao();
      if (!temPermissao) {
        setAviso({ titulo: 'Permissão necessária', mensagem: 'O app precisa de acesso à agenda pra salvar o evento.' });
        return;
      }

      const tituloBase = titulo.trim();
      const tagsFinal = tagsSelecionadas;
      const descricaoFinal = descricao.trim() || undefined;

      const eventoInicio: NovoEvento = {
        titulo: `Início: ${tituloBase}`,
        data: inicio,
        descricao: descricaoFinal,
        tags: tagsFinal,
      };
      const eventoFim: NovoEvento = {
        titulo: `Prazo final: ${tituloBase}`,
        data: fim,
        descricao: descricaoFinal,
        tags: tagsFinal,
      };

      const resultado = await salvarIntervaloComRollback(eventoInicio, eventoFim, tagsFinal, {
        criarEventoNaAgenda,
        salvarRegistro,
        apagarEventoDaAgenda,
        apagarRegistro,
      });

      if (!resultado.ok) {
        throw resultado.erro;
      }

      navigation.navigate('Dashboard');
    } catch (erro) {
      console.error('Erro ao salvar intervalo de eventos:', erro);
      setAviso({ titulo: 'Erro ao salvar', mensagem: 'Não foi possível salvar os dois eventos do período. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  }

  return { salvando, aviso, setAviso, handleSalvar };
}
