import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isCategoryId, type CategoryId } from '../../../shared/categories';
import type { SourceId, Stage, UpdateSummary, UpdateType } from '../../../shared/types';
import { matchingUpdateIds } from './search';
import { byRecency, sortDate, windowDate } from './stats';

export interface UpdateFilters {
  q: string;
  categories: CategoryId[];
  stages: Stage[];
  types: UpdateType[];
  sources: SourceId[];
  tech: string;
  from: string;
  to: string;
  sort: 'desc' | 'asc' | 'impact';
  includeUndated: boolean;
}

export const EMPTY_FILTERS: UpdateFilters = {
  q: '',
  categories: [],
  stages: [],
  types: [],
  sources: [],
  tech: '',
  from: '',
  to: '',
  sort: 'desc',
  includeUndated: true,
};

function list<T extends string>(sp: URLSearchParams, key: string, guard?: (v: string) => boolean): T[] {
  const raw = sp.get(key);
  if (!raw) return [];
  return raw.split(',').filter((v) => v && (!guard || guard(v))) as T[];
}

/** Estado de filtros sincronizado con la URL (enlaces compartibles y navegación atrás/adelante). */
export function useUrlFilters(defaults: Partial<UpdateFilters> = {}) {
  const [sp, setSp] = useSearchParams();
  const filters: UpdateFilters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      ...defaults,
      q: sp.get('q') ?? defaults.q ?? '',
      categories: sp.has('cat') ? list<CategoryId>(sp, 'cat', isCategoryId) : (defaults.categories ?? []),
      stages: sp.has('fase') ? list<Stage>(sp, 'fase') : (defaults.stages ?? []),
      types: sp.has('tipo') ? list<UpdateType>(sp, 'tipo') : (defaults.types ?? []),
      sources: sp.has('fuente') ? list<SourceId>(sp, 'fuente') : (defaults.sources ?? []),
      tech: sp.get('tec') ?? defaults.tech ?? '',
      from: sp.get('desde') ?? defaults.from ?? '',
      to: sp.get('hasta') ?? defaults.to ?? '',
      sort: (sp.get('orden') as UpdateFilters['sort']) ?? defaults.sort ?? 'desc',
      includeUndated: sp.has('sinfecha') ? sp.get('sinfecha') !== '0' : (defaults.includeUndated ?? true),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp],
  );

  const setFilters = useCallback(
    (patch: Partial<UpdateFilters>) => {
      const next = { ...filters, ...patch };
      const out = new URLSearchParams(sp);
      const put = (key: string, value: string, isDefault: boolean) => {
        if (isDefault || !value) out.delete(key);
        else out.set(key, value);
      };
      put('q', next.q, !next.q);
      put('cat', next.categories.join(','), next.categories.length === 0);
      put('fase', next.stages.join(','), next.stages.length === 0);
      put('tipo', next.types.join(','), next.types.length === 0);
      put('fuente', next.sources.join(','), next.sources.length === 0);
      put('tec', next.tech, !next.tech);
      put('desde', next.from, !next.from);
      put('hasta', next.to, !next.to);
      put('orden', next.sort, next.sort === 'desc');
      put('sinfecha', next.includeUndated ? '1' : '0', next.includeUndated);
      setSp(out, { replace: true });
    },
    [filters, sp, setSp],
  );

  const reset = useCallback(() => setSp(new URLSearchParams(), { replace: true }), [setSp]);
  return { filters, setFilters, reset };
}

export function activeFilterCount(f: UpdateFilters): number {
  return (
    (f.q ? 1 : 0) +
    f.categories.length +
    f.stages.length +
    f.types.length +
    f.sources.length +
    (f.tech ? 1 : 0) +
    (f.from ? 1 : 0) +
    (f.to ? 1 : 0) +
    (f.includeUndated ? 0 : 1)
  );
}

export function applyFilters(updates: UpdateSummary[], f: UpdateFilters): UpdateSummary[] {
  const ids = matchingUpdateIds(updates, f.q);
  const from = f.from ? Date.parse(`${f.from}T00:00:00`) : null;
  const to = f.to ? Date.parse(`${f.to}T23:59:59`) : null;
  const tech = f.tech.trim().toLowerCase();
  const out = updates.filter((u) => {
    if (ids && !ids.has(u.id)) return false;
    if (f.categories.length && !f.categories.some((c) => u.categories.includes(c))) return false;
    if (f.stages.length && !f.stages.includes(u.stage)) return false;
    if (f.types.length && !f.types.includes(u.type)) return false;
    if (f.sources.length && !f.sources.includes(u.source)) return false;
    if (tech && !u.technologies.some((t) => t.toLowerCase() === tech)) return false;
    const t = windowDate(u);
    if (t === null && !f.includeUndated) return false;
    if (from !== null && (t === null || t < from)) return false;
    if (to !== null && (t === null || t > to)) return false;
    return true;
  });
  if (f.sort === 'asc') return out.sort((a, b) => sortDate(a) - sortDate(b));
  if (f.sort === 'impact') return out.sort((a, b) => b.impactScore - a.impactScore || byRecency(a, b));
  return out.sort(byRecency);
}

/** Tecnologías más mencionadas (para el filtro por tecnología). */
export function topTechnologies(updates: UpdateSummary[], n = 40): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const u of updates) for (const t of u.technologies) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n);
}
