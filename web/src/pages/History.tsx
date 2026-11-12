import clsx from 'clsx';
import { ExternalLink, History as HistoryIcon, Map as MapIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RoadmapSummary, UpdateSummary } from '../../../shared/types';
import { FilterBar } from '../components/FilterBar';
import { Badge, CategoryChip, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';
import { UpdateRow } from '../components/UpdateCard';
import { useRoadmap, useUpdates } from '../lib/api';
import { applyFilters, topTechnologies, useUrlFilters } from '../lib/filters';
import { formatNumber, monthKey, monthLabel, quarterLabel } from '../lib/format';
import { windowDate } from '../lib/stats';

type Entry = { kind: 'update'; u: UpdateSummary } | { kind: 'roadmap'; r: RoadmapSummary };

interface Group {
  key: string;
  label: string;
  sortKey: string;
  entries: Entry[];
}

function RoadmapRow({ r }: { r: RoadmapSummary }) {
  return (
    <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3.5 rounded-xl px-3 py-3 transition hover:bg-surface-2">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-subtle">
        <MapIcon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <CategoryChip id={r.category} link={false} />
          <Badge tone={r.releaseType === 'ga' ? 'brand' : 'blue'}>{r.releaseType === 'ga' ? 'GA' : 'Preview'} entregada</Badge>
          <Badge>Roadmap · {quarterLabel(r.releaseDate)}</Badge>
        </div>
        <p className="line-clamp-2 text-[0.92rem] font-medium leading-snug text-fg group-hover:text-brand-ink">{r.nameEs ?? r.name}</p>
      </div>
      <ExternalLink className="mt-1 size-3.5 shrink-0 text-fg-subtle" />
    </a>
  );
}

export default function History() {
  const updates = useUpdates();
  const roadmap = useRoadmap();
  const { filters, setFilters, reset } = useUrlFilters();
  const [withRoadmap, setWithRoadmap] = useState(true);
  const [limit, setLimit] = useState(240);

  const all = updates.data ?? [];
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const techs = useMemo(() => topTechnologies(all), [all]);

  const roadmapShipped = useMemo(() => {
    if (!withRoadmap || filters.q || filters.types.length || filters.sources.length || filters.tech) return [];
    const from = filters.from ? Date.parse(filters.from) : null;
    const to = filters.to ? Date.parse(`${filters.to}T23:59:59`) : null;
    return (roadmap.data ?? []).filter((r) => {
      if (r.releaseStatus !== 'shipped' || !r.releaseQuarterStart) return false;
      if (filters.categories.length && !filters.categories.includes(r.category)) return false;
      if (filters.stages.length && !filters.stages.includes(r.releaseType)) return false;
      const t = Date.parse(r.releaseQuarterStart);
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
      return true;
    });
  }, [roadmap.data, withRoadmap, filters]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    const add = (key: string, label: string, sortKey: string, e: Entry) => {
      const g = map.get(key) ?? { key, label, sortKey, entries: [] };
      g.entries.push(e);
      map.set(key, g);
    };
    for (const u of filtered) {
      const t = windowDate(u);
      if (t === null) add('undated', 'Sin fecha oficial en la fuente', '0000', { kind: 'update', u });
      else {
        const k = monthKey(new Date(t).toISOString());
        add(k, monthLabel(k), `${k}-2`, { kind: 'update', u });
      }
    }
    for (const r of roadmapShipped) {
      const k = `q-${r.releaseDate}`;
      add(k, `${quarterLabel(r.releaseDate)} · entregas del roadmap`, `${r.releaseQuarterStart!.slice(0, 7)}-1`, { kind: 'roadmap', r });
    }
    const list = [...map.values()];
    list.sort((a, b) => (filters.sort === 'asc' ? a.sortKey.localeCompare(b.sortKey) : b.sortKey.localeCompare(a.sortKey)));
    // "Sin fecha" siempre al final
    return [...list.filter((g) => g.key !== 'undated'), ...list.filter((g) => g.key === 'undated')];
  }, [filtered, roadmapShipped, filters.sort]);

  const years = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of all) {
      const t = windowDate(u);
      if (t !== null) {
        const y = String(new Date(t).getFullYear());
        m.set(y, (m.get(y) ?? 0) + 1);
      }
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [all]);

  const totalEntries = filtered.length + roadmapShipped.length;
  let budget = limit;

  return (
    <div>
      <PageHeader
        eyebrow="Histórico de novedades"
        icon={HistoryIcon}
        title="Todo lo publicado, organizado en el tiempo"
        description="Novedades de los últimos meses y de años anteriores, agrupadas por mes. Filtra por fecha, categoría y tecnología o busca cualquier actualización anterior."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Año</span>
        {years.map(([y, n]) => {
          const active = filters.from === `${y}-01-01` && filters.to === `${y}-12-31`;
          return (
            <button
              key={y}
              onClick={() => (active ? setFilters({ from: '', to: '' }) : setFilters({ from: `${y}-01-01`, to: `${y}-12-31` }))}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                active ? 'border-brand/50 bg-brand-soft text-brand-ink' : 'border-line bg-surface text-fg-muted hover:text-fg',
              )}
            >
              {y} <span className="tabular text-fg-subtle">· {n}</span>
            </button>
          );
        })}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
          <input type="checkbox" checked={withRoadmap} onChange={(e) => setWithRoadmap(e.target.checked)} className="size-4 accent-[var(--brand)]" />
          Incluir entregas del roadmap oficial
        </label>
      </div>
      <FilterBar filters={filters} setFilters={setFilters} reset={reset} total={all.length} shown={filtered.length} techOptions={techs} />

      {updates.isError ? (
        <ErrorState error={updates.error} onRetry={() => updates.refetch()} />
      ) : updates.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState title="No se encontraron novedades" description="No hay resultados con estos criterios. Ajusta la búsqueda o los filtros." />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            if (budget <= 0) return null;
            const shown = g.entries.slice(0, budget);
            budget -= shown.length;
            return (
              <section key={g.key} aria-label={g.label}>
                <div className="sticky top-16 z-10 -mx-1 mb-2 flex items-center justify-between bg-bg/90 px-1 py-2 backdrop-blur">
                  <h2 className="text-sm font-semibold text-fg">{g.label}</h2>
                  <span className="tabular text-xs text-fg-subtle">{formatNumber(g.entries.length)}</span>
                </div>
                <div className="card divide-y divide-line px-2 py-1">
                  {shown.map((e) => (e.kind === 'update' ? <UpdateRow key={e.u.id} u={e.u} /> : <RoadmapRow key={e.r.id} r={e.r} />))}
                </div>
              </section>
            );
          })}
          {limit < totalEntries && (
            <div className="flex justify-center">
              <button
                onClick={() => setLimit((l) => l + 240)}
                className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium text-fg shadow-card hover:border-line-strong"
              >
                Cargar más ({formatNumber(totalEntries - limit)} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
