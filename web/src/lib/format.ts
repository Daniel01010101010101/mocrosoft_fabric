import { differenceInCalendarDays, format, formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DatePrecision } from '../../../shared/types';

export function formatDate(iso: string, pattern = "d MMM yyyy"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, pattern, { locale: es });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, "d MMM yyyy, HH:mm", { locale: es });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  if (Math.abs(diff) < 60_000) return diff >= 0 ? 'hace un momento' : 'en un momento';
  const s = formatDistanceToNowStrict(d, { locale: es, roundingMethod: 'floor' });
  return diff >= 0 ? `hace ${s}` : `en ${s}`;
}

/** Fecha de publicación respetando la precisión original de la fuente. */
export function formatPublished(iso: string, precision: DatePrecision): string {
  switch (precision) {
    case 'month':
      return capitalize(formatDate(iso, 'MMMM yyyy'));
    case 'quarter': {
      const d = new Date(iso);
      return `T${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    }
    case 'detected':
      return 'Sin fecha oficial';
    default:
      return formatDate(iso);
  }
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60} s`;
}

export function daysAgo(iso: string): number {
  return differenceInCalendarDays(new Date(), new Date(iso));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  return capitalize(format(new Date(`${key}-01T12:00:00Z`), 'MMMM yyyy', { locale: es }));
}

/** Convierte "Q3 2026" en "T3 2026" (trimestre). */
export function quarterLabel(releaseDate: string): string {
  const m = /Q([1-4])\s*(\d{4})/i.exec(releaseDate);
  return m ? `T${m[1]} ${m[2]}` : releaseDate || 'Sin fecha';
}

export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
