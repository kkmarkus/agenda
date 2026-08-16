import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { buscarEventosDaAgendaEmLote, buscarEventosFuturosDeCalendarios } from '../../../services/calendarService';
import {
  listarRegistros,
  apagarRegistro,
  listarTagsUnicas,
  listarCoresDeTags,
  listarCalendariosSincronizadosAtivos,
  listarNativeIdsRegistrados,
  salvarRegistro,
} from '../../../services/database';
import type { EventoApp } from '../../../types/event';
import { ordenarEventos } from '../format';
import { criarGuardaDeVersao } from '../../../utils/guardaDeVersao';

const DIAS_SINCRONIZACAO = 90;

export function useCarregarEventos() {
  const [eventos, setEventos] = useState<EventoApp[]>([]);
  const [tagsDisponiveis, setTagsDisponiveis] = useState<string[]>([]);
  const [coresPorTag, setCoresPorTag] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);

  // `useFocusEffect` dispara de novo a cada foco na tela — se o usuário
  // sair e voltar rápido (ou o React Navigation focar duas vezes em
  // sequência), duas chamadas de `carregarEventos` podem ficar em voo ao
  // mesmo tempo. Sem essa proteção, a que termina depois "vence" mesmo
  // que tenha começado antes, podendo sobrescrever o resultado mais
  // recente com dados desatualizados (ex: reexibir um evento que a
  // chamada mais nova já constatou ter sido apagado).
  const guardaDeVersaoRef = useRef(criarGuardaDeVersao());

  // Traz pro registro local qualquer evento novo dos calendários externos
  // marcados pra sincronizar, criando os que ainda não existem no app.
  const sincronizarCalendariosExternos = useCallback(async () => {
    try {
      const idsAtivos = listarCalendariosSincronizadosAtivos();
      if (idsAtivos.length === 0) return;

      const eventosExternos = await buscarEventosFuturosDeCalendarios(idsAtivos, DIAS_SINCRONIZACAO);
      const jaRegistrados = listarNativeIdsRegistrados();

      for (const evento of eventosExternos) {
        if (!jaRegistrados.has(evento.nativeEventId)) {
          salvarRegistro(evento.nativeEventId, []);
        }
      }
    } catch (erro) {
      // Sincronização é um "bônus": se falhar (ex: permissão revogada), o
      // Dashboard ainda deve carregar normalmente com o que já existe no
      // banco local, em vez de travar a tela inteira por causa disso.
      console.error('Erro ao sincronizar calendários externos:', erro);
    }
  }, []);

  const carregarEventos = useCallback(async () => {
    const minhaVersao = guardaDeVersaoRef.current.proximaVersao();
    setCarregando(true);
    const registros = listarRegistros();

    const dadosPorId = await buscarEventosDaAgendaEmLote(registros.map((r) => r.nativeEventId));

    const resultado: EventoApp[] = [];
    const registrosOrfaos: number[] = [];

    registros.forEach((registro) => {
      const dadosNativos = dadosPorId.get(registro.nativeEventId);
      if (!dadosNativos) {
        // O evento foi apagado direto na agenda nativa (fora do app):
        // limpa o registro local órfão em vez de mostrar um card vazio.
        registrosOrfaos.push(registro.id);
        return;
      }

      resultado.push({
        id: registro.id,
        nativeEventId: registro.nativeEventId,
        tags: registro.tags,
        titulo: dadosNativos.titulo,
        data: dadosNativos.data,
        descricao: dadosNativos.descricao,
        recorrente: dadosNativos.recorrente,
        recorrencia: dadosNativos.recorrencia,
        fixado: registro.fixado,
      });
    });

    registrosOrfaos.forEach((id) => apagarRegistro(id));

    if (!guardaDeVersaoRef.current.ehVersaoAtual(minhaVersao)) {
      // Uma chamada mais recente já assumiu enquanto esta estava em voo —
      // descarta este resultado desatualizado em vez de aplicá-lo por
      // cima do que a chamada mais nova já mostrou.
      return;
    }

    setEventos(ordenarEventos(resultado));
    setTagsDisponiveis(listarTagsUnicas());
    setCoresPorTag(listarCoresDeTags());
    setCarregando(false);
  }, []);

  // Recarrega toda vez que a tela ganha foco (ex: voltando da tela de
  // confirmação), não só na primeira montagem.
  useFocusEffect(
    useCallback(() => {
      sincronizarCalendariosExternos().finally(() => carregarEventos());
    }, [sincronizarCalendariosExternos, carregarEventos])
  );

  return { eventos, setEventos, tagsDisponiveis, coresPorTag, carregando, carregarEventos };
}
