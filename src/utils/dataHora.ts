import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

// MUDANÇA (item 3): extraído de ConfirmScreen.tsx (onde nasceu no item 9.1)
// pra cá, porque ConfirmMultiplosScreen.tsx precisa do mesmo padrão de
// picker de data/hora pra editar cada evento extraído — duplicar essas
// ~50 linhas nas duas telas ia divergir com o tempo (ex: uma corrigir um
// bug do outro lado sem lembrar de replicar). ConfirmScreen.tsx foi
// atualizada pra importar daqui em vez de manter sua própria cópia.

export function formatarData(data?: Date): string {
  if (!data) return '';
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${data.getFullYear()}`;
}

export function formatarHora(data?: Date): string {
  if (!data) return '';
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

// Helpers puros de combinação de data/hora — um DateTimePicker em modo
// 'date' só devolve a parte de dia/mês/ano (a hora que ele devolve junto é
// lixo/meia-noite, dependendo da implementação nativa), e o modo 'time' só
// devolve hora/minuto. Por isso sempre combinamos o pedaço novo com o
// valor atual, em vez de substituir o `Date` inteiro.
export function combinarDataEHora(base: Date, novaData: Date): Date {
  const resultado = new Date(base);
  resultado.setFullYear(novaData.getFullYear(), novaData.getMonth(), novaData.getDate());
  return resultado;
}

export function combinarComHora(base: Date, novaHora: Date): Date {
  const resultado = new Date(base);
  resultado.setHours(novaHora.getHours(), novaHora.getMinutes(), 0, 0);
  return resultado;
}

// API imperativa do @react-native-community/datetimepicker
// (`DateTimePickerAndroid.open`) em vez da API de componente — é a
// recomendada pela própria documentação da lib pro Android (abre/fecha um
// diálogo nativo sozinha, sem precisar de estado extra tipo "mostrarPicker"
// pra controlar visibilidade), e o app já é Android-only por decisão
// anterior (ver comentário em calendarService.ts sobre isLocalAccount).
// `event.type === 'set'` é o Android avisando que ela confirmou uma opção
// (em vez de cancelar o diálogo) — só aí aplicamos a mudança.
export function abrirDatePicker(valorAtual: Date, aoSelecionar: (novaData: Date) => void): void {
  DateTimePickerAndroid.open({
    value: valorAtual,
    mode: 'date',
    onChange: (evento, novaData) => {
      if (evento.type === 'set' && novaData) aoSelecionar(novaData);
    },
  });
}

export function abrirTimePicker(valorAtual: Date, aoSelecionar: (novaHora: Date) => void): void {
  DateTimePickerAndroid.open({
    value: valorAtual,
    mode: 'time',
    is24Hour: true,
    onChange: (evento, novaHora) => {
      if (evento.type === 'set' && novaHora) aoSelecionar(novaHora);
    },
  });
}
