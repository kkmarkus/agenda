// Helpers de formatação de data/hora em pt-BR e wrappers pros pickers
// nativos de data/hora do Android.
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

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

// Troca só o dia/mês/ano de `base`, mantendo a hora que já estava nela.
export function combinarDataEHora(base: Date, novaData: Date): Date {
  const resultado = new Date(base);
  resultado.setFullYear(novaData.getFullYear(), novaData.getMonth(), novaData.getDate());
  return resultado;
}

// Troca só a hora/minuto de `base`, mantendo o dia/mês/ano que já estava nela.
export function combinarComHora(base: Date, novaHora: Date): Date {
  const resultado = new Date(base);
  resultado.setHours(novaHora.getHours(), novaHora.getMinutes(), 0, 0);
  return resultado;
}

export function abrirDatePicker(valorAtual: Date, aoSelecionar: (novaData: Date) => void): void {
  DateTimePickerAndroid.open({
    value: valorAtual,
    mode: 'date',
    onChange: (evento, novaData) => {
      // type === 'set': usuário confirmou (não cancelou o picker).
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
