import type { EventoApp } from '../../types/event';

const MESES_COMPLETOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Fixados primeiro, e dentro de cada grupo (fixado/não fixado) por data
// crescente. Dois sorts em sequência porque Array.sort é estável: o
// segundo sort (por fixado) preserva a ordem por data já aplicada dentro
// de cada grupo.
export function ordenarEventos(lista: EventoApp[]): EventoApp[] {
  const copia = [...lista];
  copia.sort((a, b) => a.data.getTime() - b.data.getTime());
  copia.sort((a, b) => Number(b.fixado) - Number(a.fixado));
  return copia;
}

function formatarSaudacao(hora: number): string {
  if (hora < 5) return 'Boa noite';
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function formatarCabecalho(data: Date): string {
  return `${formatarSaudacao(data.getHours())} · ${data.getDate()} de ${MESES_COMPLETOS[data.getMonth()]}`;
}

export function formatarDataLegivel(data: Date): string {
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${data.getDate()} ${MESES_ABREV[data.getMonth()]}, ${hh}:${min}`;
}

export function formatarDiasRestantes(horas: number): string {
  if (horas < 0) return 'passou';
  if (horas < 24) return 'hoje';
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
