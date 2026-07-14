// Dados que vêm do formulário (antes de existir na agenda nativa)
export interface NovoEvento {
  titulo: string;
  data: Date;       // já combinada com a hora
  descricao?: string;
  tag: string;
}

// Evento já salvo: combina o que veio da agenda nativa (título/data/descrição)
// com o que vive só no nosso banco local (a tag).
export interface EventoApp {
  id: number;              // id da linha no SQLite
  nativeEventId: string;   // id do evento na agenda nativa do Android
  titulo: string;
  data: Date;
  descricao?: string;
  tag: string;
}
