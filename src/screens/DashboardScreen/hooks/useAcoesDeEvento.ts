import { useCallback, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apagarEventoDaAgenda } from '../../../services/calendarService';
import { apagarRegistro, alternarFixado } from '../../../services/database';
import type { EventoApp } from '../../../types/event';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { ordenarEventos } from '../format';

// Ações sobre eventos existentes: editar, apagar (com escolha de escopo
// pra recorrentes), fixar/desfixar e limpar eventos passados em lote.

type Navigation = NativeStackScreenProps<RootStackParamList, 'Dashboard'>['navigation'];

type Params = {
  eventos: EventoApp[];
  setEventos: React.Dispatch<React.SetStateAction<EventoApp[]>>;
  carregarEventos: () => Promise<void>;
  navigation: Navigation;
  fecharSwipeDoItem: (id: number) => void;
};

export function useAcoesDeEvento({ eventos, setEventos, carregarEventos, navigation, fecharSwipeDoItem }: Params) {
  const navegarParaEdicao = useCallback(
    (evento: EventoApp, ocorrencia?: { instanceStartDate: Date; futureEvents: boolean }) => {
      navigation.navigate('Confirmar', {
        nativeEventId: evento.nativeEventId,
        rascunho: {
          titulo: evento.titulo,
          data: evento.data,
          descricao: evento.descricao,
          tags: evento.tags,
          recorrencia: evento.recorrencia,
        },
        ocorrencia,
      });
    },
    [navigation]
  );

  const [eventoParaEscolherEscopoEdicao, setEventoParaEscolherEscopoEdicao] = useState<EventoApp | null>(null);

  // Evento recorrente precisa perguntar antes se a edição vale só pra
  // essa ocorrência ou pras futuras também; evento normal edita direto.
  const handleEditar = useCallback(
    (evento: EventoApp) => {
      if (evento.recorrente) {
        setEventoParaEscolherEscopoEdicao(evento);
        return;
      }
      navegarParaEdicao(evento);
    },
    [navegarParaEdicao]
  );

  const [eventoParaApagar, setEventoParaApagar] = useState<EventoApp | null>(null);

  const handleApagar = useCallback(
    (evento: EventoApp) => {
      fecharSwipeDoItem(evento.id);
      setEventoParaApagar(evento);
    },
    [fecharSwipeDoItem]
  );

  const handleAlternarFixado = useCallback(
    (evento: EventoApp) => {
      fecharSwipeDoItem(evento.id);
      alternarFixado(evento.id);
      setEventos((atual) =>
        ordenarEventos(atual.map((e) => (e.id === evento.id ? { ...e, fixado: !e.fixado } : e)))
      );
    },
    [fecharSwipeDoItem, setEventos]
  );

  async function confirmarApagar(futureEvents?: boolean) {
    if (!eventoParaApagar) return;

    const opcoesOcorrencia =
      eventoParaApagar.recorrente && futureEvents !== undefined
        ? { instanceStartDate: eventoParaApagar.data, futureEvents }
        : undefined;

    await apagarEventoDaAgenda(eventoParaApagar.nativeEventId, opcoesOcorrencia);
    if (!opcoesOcorrencia) {
      // Apagou o evento inteiro (não-recorrente): remove localmente sem
      // precisar recarregar tudo.
      apagarRegistro(eventoParaApagar.id);
      const idApagado = eventoParaApagar.id;
      setEventos((atual) => atual.filter((e) => e.id !== idApagado));
      setEventoParaApagar(null);
    } else {
      // Apagou só uma ocorrência (ou as futuras) de uma série recorrente:
      // a agenda nativa reorganiza a série sozinha, então recarrega do
      // zero em vez de tentar remendar o estado local.
      setEventoParaApagar(null);
      carregarEventos();
    }
  }

  const [confirmandoLimpezaPassados, setConfirmandoLimpezaPassados] = useState(false);

  async function apagarListaDeEventos(lista: EventoApp[]) {
    await Promise.all(
      lista.map(async (evento) => {
        await apagarEventoDaAgenda(evento.nativeEventId);
        apagarRegistro(evento.id);
      })
    );
  }

  // Eventos passados e não-recorrentes são candidatos à "limpeza em
  // lote"; recorrentes ficam de fora porque sua data mostrada já é
  // sempre a próxima ocorrência futura.
  const { agora, eventosPassados, eventosPassadosNaoFixados, eventosPassadosFixados } = useMemo(() => {
    const agora = new Date();
    const eventosPassados = eventos.filter((e) => e.data.getTime() < agora.getTime() && !e.recorrente);
    const eventosPassadosNaoFixados = eventosPassados.filter((e) => !e.fixado);
    const eventosPassadosFixados = eventosPassados.filter((e) => e.fixado);
    return { agora, eventosPassados, eventosPassadosNaoFixados, eventosPassadosFixados };
  }, [eventos]);

  async function confirmarLimpezaPassados(incluirFixados: boolean) {
    const alvos = incluirFixados ? eventosPassados : eventosPassadosNaoFixados;
    await apagarListaDeEventos(alvos);
    setConfirmandoLimpezaPassados(false);

    const idsApagados = new Set(alvos.map((e) => e.id));
    setEventos((atual) => atual.filter((e) => !idsApagados.has(e.id)));
  }

  return {
    agora,
    navegarParaEdicao,
    handleEditar,
    eventoParaEscolherEscopoEdicao,
    setEventoParaEscolherEscopoEdicao,
    eventoParaApagar,
    setEventoParaApagar,
    handleApagar,
    confirmarApagar,
    handleAlternarFixado,
    confirmandoLimpezaPassados,
    setConfirmandoLimpezaPassados,
    confirmarLimpezaPassados,
    eventosPassados,
    eventosPassadosNaoFixados,
    eventosPassadosFixados,
  };
}
