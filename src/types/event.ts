// Dados que vêm do formulário (antes de existir na agenda nativa)
export interface NovoEvento {
  titulo: string;
  data: Date;       // já combinada com a hora
  descricao?: string;
  // MUDANÇA: tag agora é opcional. null = "sem tag" — um estado de
  // primeira classe, não a ausência de dado. Isso importa principalmente
  // pros eventos importados via sincronização com outros calendários: eles
  // nunca vêm com tag nenhuma, e forçar uma tag obrigatória nesse fluxo
  // não faz sentido (ela não está criando o evento pelo app).
  tag: string | null;
}

// Evento já salvo: combina o que veio da agenda nativa (título/data/descrição)
// com o que vive só no nosso banco local (a tag).
export interface EventoApp {
  id: number;              // id da linha no SQLite
  nativeEventId: string;   // id do evento na agenda nativa do Android
  titulo: string;
  data: Date;
  descricao?: string;
  tag: string | null;
}
