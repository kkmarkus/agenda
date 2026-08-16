export interface Recorrencia {
  frequencia: 'diaria' | 'semanal' | 'mensal';
  diaSemana?: number; // usado quando frequencia === 'semanal' (0 = domingo)
  diaDoMes?: number; // usado quando frequencia === 'mensal'
}

// Dados de um evento ainda não salvo, prontos pra enviar à agenda nativa.
export interface NovoEvento {
  titulo: string;
  data: Date;
  descricao?: string;
  tags: string[];
  duracaoMinutos?: number;
  antecedenciaAlarmeMinutos?: number | null; // null = sem alarme
  diaInteiro?: boolean;
  dataFimDiaInteiro?: Date;
  recorrencia?: Recorrencia | null;
}

// Evento como exibido no app: combina o registro local (id, tags,
// fixado) com os dados vindos da agenda nativa (título, data etc).
export interface EventoApp {
  id: number;
  nativeEventId: string;
  titulo: string;
  data: Date;
  descricao?: string;
  tags: string[];
  recorrente?: boolean;
  recorrencia?: Recorrencia | null;
  fixado: boolean;
}
