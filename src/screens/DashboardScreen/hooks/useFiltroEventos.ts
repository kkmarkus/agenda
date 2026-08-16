import { useEffect, useMemo, useState } from 'react';
import type { EventoApp } from '../../../types/event';

export function useFiltroEventos(eventos: EventoApp[]) {
  const [tagAtiva, setTagAtiva] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  // `busca` atualiza a cada tecla, pro campo responder na hora.
  // `buscaDebounced` só acompanha 200ms depois que a digitação para, e é
  // essa versão que alimenta o filtro de verdade abaixo, evitando
  // recalcular a lista inteira a cada caractere digitado.
  const [buscaDebounced, setBuscaDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca), 200);
    return () => clearTimeout(timer);
  }, [busca]);

  const temEventosSemTag = eventos.some((e) => e.tags.length === 0);

  // Com múltiplas tags por evento, o filtro checa se a tag ativa está
  // ENTRE as tags do evento, não se é a única. `useMemo` evita recalcular
  // a cada render, inclusive a cada tecla digitada na busca.
  const eventosFiltradosPorTag = useMemo(() => {
    return tagAtiva === null
      ? eventos
      : tagAtiva === ''
      ? eventos.filter((e) => e.tags.length === 0)
      : eventos.filter((e) => e.tags.some((t) => t.toLowerCase() === tagAtiva.toLowerCase()));
  }, [eventos, tagAtiva]);

  const buscaNormalizada = buscaDebounced.trim().toLowerCase();
  const eventosFiltrados = useMemo(() => {
    return buscaNormalizada
      ? eventosFiltradosPorTag.filter((e) => e.titulo.toLowerCase().includes(buscaNormalizada))
      : eventosFiltradosPorTag;
  }, [eventosFiltradosPorTag, buscaNormalizada]);

  return {
    tagAtiva,
    setTagAtiva,
    busca,
    setBusca,
    buscaNormalizada,
    temEventosSemTag,
    eventosFiltrados,
  };
}
