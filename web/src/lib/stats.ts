import { CATEGORIES, type CategoryId } from '../../../shared/categories';
import type { Stage, UpdateSummary } from '../../../shared/types';

const DAY = 86_400_000;

/** Fecha utilizable para ventanas temporales (null si la fecha real es desconocida). */
export function windowDate(u: UpdateSummary): number | null {
  if (u.undated) return null;
  const t = Date.parse(u.publishedAt);
  return Number.isFinite(t) ? t : null;
}

/** Fecha de ordenación: publicación; si es desconocida, la de detección (al final de su grupo). */
export function sortDate(u: UpdateSummary): number {
  return windowDate(u) ?? Date.parse(u.detectedAt) - 1;
}

/** true si la fecha solo tiene precisión mensual o trimestral. */
export function isCoarse(u: UpdateSummary): boolean {
  return u.datePrecision === 'month' || u.datePrecision === 'quarter';
}

export function withinDays(u: UpdateSummary, days: number, now = Date.now()): boolean {
  const t = windowDate(u);
  if (t === null) return false;
  // Una fecha mensual no permite afirmar que algo se publicó "esta semana".
  if (isCoarse(u) && days < 28) return false;
  return now - t <= days * DAY && t <= now + DAY;
}

export function isToday(u: UpdateSummary, now = new Date()): boolean {
  const t = windowDate(u);
  if (t === null || isCoarse(u)) return false;
  const d = new Date(t);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export interface Kpis {
  total: number;
  today: number;
  week: number;
  month: number;
  newFeatures30: number;
  preview: number;
  ga: number;
  transformative: number;
  aiDone: number;
}

export function computeKpis(updates: UpdateSummary[]): Kpis {
  const now = Date.now();
  return {
    total: updates.length,
    today: updates.filter((u) => isToday(u)).length,
    week: updates.filter((u) => withinDays(u, 7, now)).length,
    month: updates.filter((u) => withinDays(u, 30, now)).length,
    newFeatures30: updates.filter((u) => u.type === 'feature' && withinDays(u, 30, now)).length,
    preview: updates.filter((u) => u.stage === 'preview').length,
    ga: updates.filter((u) => u.stage === 'ga').length,
    transformative: updates.filter((u) => u.transformative).length,
    aiDone: updates.filter((u) => u.aiStatus === 'done').length,
  };
}

export interface CategoryCount {
  id: CategoryId;
  name: string;
  count: number;
}

export function categoryActivity(updates: UpdateSummary[], days: number | null): CategoryCount[] {
  const counts = new Map<CategoryId, number>();
  for (const u of updates) {
    if (days !== null && !withinDays(u, days)) continue;
    counts.set(u.primaryCategory, (counts.get(u.primaryCategory) ?? 0) + 1);
  }
  return CATEGORIES.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

export interface TimelinePoint {
  start: number;
  total: number;
  ga: number;
  preview: number;
  other: number;
}

function startOfWeek(t: number): number {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

/** Serie mensual de novedades (últimos `months` meses, incluido el actual). */
export function monthlyTimeline(updates: UpdateSummary[], months = 12): TimelinePoint[] {
  const now = new Date();
  const points: TimelinePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({ start: d.getTime(), total: 0, ga: 0, preview: 0, other: 0 });
  }
  const index = new Map(points.map((p, i) => [`${new Date(p.start).getFullYear()}-${new Date(p.start).getMonth()}`, i]));
  for (const u of updates) {
    const t = windowDate(u);
    if (t === null) continue;
    // Las fechas mensuales se guardan en UTC (día 1): se usa el mes UTC para no desplazarlas.
    const d = new Date(t);
    const key = isCoarse(u) ? `${d.getUTCFullYear()}-${d.getUTCMonth()}` : `${d.getFullYear()}-${d.getMonth()}`;
    const idx = index.get(key);
    if (idx === undefined) continue;
    const p = points[idx]!;
    p.total++;
    if (u.stage === 'ga') p.ga++;
    else if (u.stage === 'preview') p.preview++;
    else p.other++;
  }
  return points;
}

/** Serie semanal de novedades con fecha exacta (últimas `weeks` semanas, incluida la actual). */
export function weeklyTimeline(updates: UpdateSummary[], weeks = 26): TimelinePoint[] {
  const current = startOfWeek(Date.now());
  const points: TimelinePoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setDate(d.getDate() - i * 7);
    points.push({ start: d.getTime(), total: 0, ga: 0, preview: 0, other: 0 });
  }
  const first = points[0]!.start;
  for (const u of updates) {
    const t = windowDate(u);
    if (t === null || t < first || isCoarse(u)) continue;
    const idx = Math.min(points.length - 1, Math.floor((startOfWeek(t) - first) / (7 * DAY) + 0.01));
    const p = points[idx];
    if (!p) continue;
    p.total++;
    if (u.stage === 'ga') p.ga++;
    else if (u.stage === 'preview') p.preview++;
    else p.other++;
  }
  return points;
}

export function stageBreakdown(updates: UpdateSummary[]): { stage: Stage | 'other'; count: number }[] {
  const ga = updates.filter((u) => u.stage === 'ga').length;
  const preview = updates.filter((u) => u.stage === 'preview').length;
  return [
    { stage: 'ga', count: ga },
    { stage: 'preview', count: preview },
    { stage: 'other', count: updates.length - ga - preview },
  ];
}

/** Las novedades más importantes recientes (amplía la ventana si hay pocas). */
export function topImportant(updates: UpdateSummary[], n: number): UpdateSummary[] {
  for (const days of [30, 60, 120, null]) {
    const pool = updates.filter((u) => (days === null ? true : withinDays(u, days)));
    if (pool.length >= n || days === null) {
      return [...pool].sort((a, b) => b.impactScore - a.impactScore || sortDate(b) - sortDate(a)).slice(0, n);
    }
  }
  return [];
}

export function byRecency(a: UpdateSummary, b: UpdateSummary): number {
  return sortDate(b) - sortDate(a) || b.detectedAt.localeCompare(a.detectedAt);
}
