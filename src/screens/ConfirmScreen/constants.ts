// Opções exibidas nos seletores do formulário de confirmação de evento.
export const OPCOES_DURACAO: { valor: '30' | '60' | '120' | 'diaInteiro' | 'personalizado'; label: string }[] = [
  { valor: '30', label: '30 min' },
  { valor: '60', label: '1h' },
  { valor: '120', label: '2h' },
  { valor: 'diaInteiro', label: 'Dia inteiro' },
  { valor: 'personalizado', label: 'Personalizado' },
];

export const OPCOES_ANTECEDENCIA: { valor: '10' | '30' | '60' | '1440' | 'sem'; label: string }[] = [
  { valor: '10', label: '10 min' },
  { valor: '30', label: '30 min' },
  { valor: '60', label: '1h' },
  { valor: '1440', label: '1 dia' },
  { valor: 'sem', label: 'Sem alarme' },
];

export const OPCOES_RECORRENCIA: { valor: 'nenhuma' | 'diaria' | 'semanal' | 'mensal'; label: string }[] = [
  { valor: 'nenhuma', label: 'Não repete' },
  { valor: 'diaria', label: 'Todo dia' },
  { valor: 'semanal', label: 'Toda semana' },
  { valor: 'mensal', label: 'Todo mês' },
];

export const NOMES_DIA_SEMANA_EXTENSO = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];
