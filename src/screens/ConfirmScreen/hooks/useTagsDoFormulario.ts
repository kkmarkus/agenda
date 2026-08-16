import { useEffect, useState } from 'react';
import { listarTagsUnicas, listarCoresDeTags } from '../../../services/database';

export function useTagsDoFormulario(tagsIniciais: string[]) {
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>(tagsIniciais);
  const [novaTagTexto, setNovaTagTexto] = useState('');
  const [tagsExistentes, setTagsExistentes] = useState<string[]>([]);
  const [coresPorTag, setCoresPorTag] = useState<Record<string, number>>({});

  // Autocomplete: carrega as tags já usadas antes (com sua cor) pra
  // sugerir como chips.
  useEffect(() => {
    setTagsExistentes(listarTagsUnicas());
    setCoresPorTag(listarCoresDeTags());
  }, []);

  // Comparação case-insensitive (mesmo critério usado em todo o app) pra
  // não deixar adicionar "Trabalho" duas vezes com capitalizações diferentes.
  function tagJaSelecionada(t: string): boolean {
    const chave = t.trim().toLowerCase();
    return tagsSelecionadas.some((existente) => existente.trim().toLowerCase() === chave);
  }

  function adicionarTag(t: string) {
    const texto = t.trim();
    if (!texto || tagJaSelecionada(texto)) return;
    setTagsSelecionadas((atual) => [...atual, texto]);
  }

  function removerTag(t: string) {
    setTagsSelecionadas((atual) => atual.filter((existente) => existente !== t));
  }

  // Chip de tag já usada antes: alterna a seleção (multi-select) em vez
  // de substituir.
  function alternarTagExistente(t: string) {
    if (tagJaSelecionada(t)) {
      setTagsSelecionadas((atual) => atual.filter((existente) => existente.trim().toLowerCase() !== t.trim().toLowerCase()));
    } else {
      setTagsSelecionadas((atual) => [...atual, t]);
    }
  }

  function handleAdicionarNovaTag() {
    adicionarTag(novaTagTexto);
    setNovaTagTexto('');
  }

  return {
    tagsSelecionadas,
    novaTagTexto,
    setNovaTagTexto,
    tagsExistentes,
    coresPorTag,
    tagJaSelecionada,
    removerTag,
    alternarTagExistente,
    handleAdicionarNovaTag,
  };
}
