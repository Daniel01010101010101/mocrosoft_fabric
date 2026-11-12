import { ArrowLeft, ArrowRight, CalendarClock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CATEGORY_BY_ID, isCategoryId } from '../../../shared/categories';
import { ChartCard, TimelineChart } from '../components/charts/charts';
import { FilterBar } from '../components/FilterBar';
import { CountUp } from '../components/Kpi';
import { Badge, CardsSkeleton, EmptyState, ErrorState, PageHeader } from '../components/ui';
import { UpdateCard } from '../components/UpdateCard';
import { useRoadmap, useUpdates } from '../lib/api';
import { applyFilters, topTechnologies, useUrlFilters } from '../lib/filters';
import { quarterLabel } from '../lib/format';
import { CATEGORY_ICON } from '../lib/labels';
import NotFound from './NotFound';
import { monthlyTimeline, withinDays } from '../lib/stats';

export default function CategoryDetail() {
  const { id } = useParams();
  const updates = useUpdates();
  const roadmap = useRoadmap();
  const { filters, setFilters, reset } = useUrlFilters();
  const [limit, setLimit] = useState(18);
  const valid = isCategoryId(id);

  const inCat = useMemo(() => (valid ? (updates.data ?? []).filter((u) => u.categories.includes(id)) : []), [updates.data, id, valid]);
  const filtered = useMemo(() => applyFilters(inCat, filters), [inCat, filters]);
  const techs = useMemo(() => topTechnologies(inCat, 30), [inCat]);
  const timeline = useMemo(() => monthlyTimeline(inCat, 12), [inCat]);
  const upcoming = useMemo(
    () =>
      valid
        ? (roadmap.data ?? [])
            .filter((r) => r.category === id && r.releaseStatus === 'planned' && !r.removedFromSource)
            .sort((a, b) => (a.releaseQuarterStart ?? '').localeCompare(b.releaseQuarterStart ?? ''))
        : [],
    [roadmap.data, id, valid],
  );

  if (!valid) return <NotFound />;
  const cat = CATEGORY_BY_ID[id];
  const Icon = CATEGORY_ICON[id];

  return (
    <div>
      <Link to="/categorias" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Todas las categorías
      </Link>
      <PageHeader eyebrow="Categoría" icon={Icon} title={cat.name} description={cat.description} />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Novedades', value: inCat.length },
            { label: 'Últimos 30 días', value: inCat.filter((u) => withinDays(u, 30)).length },
            { label: 'En Preview', value: inCat.filter((u) => u.stage === 'preview').length },
            { label: 'Planificadas', value: upcoming.length },
          ].map((k) => (
            <div key={k.label} className="card p-4">
              <div className="text-xs font-medium text-fg-muted">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-fg">
                <CountUp value={k.value} className="tabular" />
              </div>
            </div>
          ))}
        </div>
        <ChartCard title="Actividad mensual" subtitle="Novedades de esta categoría por mes · últimos 12 meses">
          <TimelineChart data={timeline} height={170} />
        </ChartCard>
      </div>

      {upcoming.length > 0 && (
        <section className="card mb-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <CalendarClock className="size-4 text-brand" /> Próximamente en {cat.name}
            </h2>
            <Link to={`/roadmap`} className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline">
              Roadmap <ArrowRight className="size-4" />
            </Link>
          </div>
          <ul className="grid gap-2 md:grid-cols-2">
            {upcoming.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link to={`/roadmap?item=${r.id}`} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:bg-surface-2">
                  <Badge tone={r.releaseType === 'ga' ? 'brand' : 'blue'}>{r.releaseType === 'ga' ? 'GA' : 'Preview'}</Badge>
                  <span className="line-clamp-1 flex-1 text-sm text-fg">{r.nameEs ?? r.name}</span>
                  <span className="tabular text-xs text-fg-subtle">{quarterLabel(r.releaseDate)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FilterBar filters={filters} setFilters={setFilters} reset={reset} total={inCat.length} shown={filtered.length} techOptions={techs} hideCategories />
      {updates.isError ? (
        <ErrorState error={updates.error} onRetry={() => updates.refetch()} />
      ) : updates.isLoading ? (
        <CardsSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState title="Sin novedades" description="No hay novedades en esta categoría con los filtros actuales." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, limit).map((u, i) => (
              <UpdateCard key={u.id} u={u} index={i % 18} />
            ))}
          </div>
          {limit < filtered.length && (
            <div className="mt-8 flex justify-center">
              <button onClick={() => setLimit((l) => l + 18)} className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium shadow-card hover:border-line-strong">
                Cargar más ({filtered.length - limit} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
