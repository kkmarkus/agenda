// MUDANÇA (item 2): recorrência é um conceito separado de "dataFimDiaInteiro"
// ou de um intervalo — descreve um evento que SE REPETE (diária, semanal ou
// mensalmente), não um período único. Vive aqui (não em eventParser.ts)
// porque é compartilhada entre o resultado do parser (`EventoExtraido`) e o
// que a tela de confirmação monta pra salvar (`NovoEvento`) — as duas
// pontas do mesmo fluxo precisam do mesmo formato.
export interface Recorrencia {
  frequencia: 'diaria' | 'semanal' | 'mensal';
  // diaSemana: só presente quando frequencia === 'semanal' e o dia da
  // semana é conhecido (0 = domingo ... 6 = sábado). Sem ele, a recorrência
  // semanal assume o mesmo dia da semana da data-base do evento.
  diaSemana?: number;
  // diaDoMes: só presente quando frequencia === 'mensal' com dia explícito
  // (ex: "todo dia 5"). Sem ele, assume o dia do mês da data-base.
  diaDoMes?: number;
}

// Dados que vêm do formulário (antes de existir na agenda nativa)
export interface NovoEvento {
  titulo: string;
  data: Date;       // já combinada com a hora
  descricao?: string;
  // MUDANÇA (item 4): tag única (string | null) virou lista de tags — um
  // evento pode ser, por exemplo, "Universidade" E "Urgente" ao mesmo
  // tempo. Lista vazia (`[]`) é o equivalente ao antigo `null`: "sem tag"
  // continua sendo um estado de primeira classe, não a ausência de dado.
  // Isso importa principalmente pros eventos importados via sincronização
  // com outros calendários: eles nunca vêm com tag nenhuma, e forçar uma
  // tag obrigatória nesse fluxo não faz sentido (ela não está criando o
  // evento pelo app).
  tags: string[];
  // MUDANÇA (item 1): duração e antecedência do alarme deixam de ser fixas
  // (1h / 30min antes, hardcoded em calendarService.ts) e passam a ser
  // configuráveis por evento. `undefined` em ambos os campos preserva o
  // comportamento antigo (retrocompatibilidade) — é assim que qualquer
  // código que ainda monta um NovoEvento sem esses campos continua
  // funcionando sem alteração.
  //
  // duracaoMinutos: undefined = usa o padrão (60min, ou o padrão global
  // definido em Configurações — ver item 8.1). Ignorado quando diaInteiro
  // for true.
  duracaoMinutos?: number;
  // antecedenciaAlarmeMinutos: undefined = usa o padrão (30min antes).
  // null = "Sem alarme", um estado explícito e diferente de "usar o
  // padrão" — por isso não dá pra reaproveitar `undefined` pros dois casos.
  antecedenciaAlarmeMinutos?: number | null;
  // diaInteiro: evento de dia inteiro (viagem, prova de múltiplos dias).
  // Quando true, duracaoMinutos é ignorado — o evento é criado com
  // `allDay: true` na agenda nativa, indo de `data` até `dataFimDiaInteiro`
  // (ou só o dia de `data`, se dataFimDiaInteiro não for informado).
  diaInteiro?: boolean;
  dataFimDiaInteiro?: Date;
  // MUDANÇA (item 2): undefined/ausente = evento único, sem repetição
  // (comportamento antigo, retrocompatível). Presente = evento recorrente,
  // mapeado pro `recurrenceRule` do expo-calendar em calendarService.ts.
  recorrencia?: Recorrencia | null;
}

// Evento já salvo: combina o que veio da agenda nativa (título/data/descrição)
// com o que vive só no nosso banco local (a tag).
export interface EventoApp {
  id: number;              // id da linha no SQLite
  nativeEventId: string;   // id do evento na agenda nativa do Android
  titulo: string;
  data: Date;
  descricao?: string;
  // MUDANÇA (item 4): idem NovoEvento.tags — lista vazia = sem tag.
  tags: string[];
  // MUDANÇA (item 2): vem direto da agenda nativa a cada carga (não é
  // persistido no banco local — ver buscarEventoDaAgenda), usado só pelo
  // Dashboard pra decidir se precisa perguntar "Somente este evento" ou
  // "Este e os futuros" antes de editar/apagar.
  recorrente?: boolean;
  // Detalhe da recorrência (frequência + dia), reconstruído a partir do
  // recurrenceRule nativo — ver buscarEventoDaAgenda. Usado só pra
  // pré-selecionar o seletor certo ao abrir esse evento pra editar.
  recorrencia?: Recorrencia | null;
  // MUDANÇA (item 5): evento fixado aparece sempre no topo do Dashboard,
  // independente da proximidade da data. Vem do registro local (é a
  // própria usuária quem fixa/desafixa, não algo derivado da agenda nativa).
  fixado: boolean;
}
