import { LayoutGrid, List, Newspaper } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FilterBar } from '../components/FilterBar';
import { CardsSkeleton, EmptyState, ErrorState, PageHeader, SegmentedControl } from '../components/ui';
import { UpdateCard, UpdateRow } from '../components/UpdateCard';
import { useUpdates } from '../lib/api';
import { applyFilters, topTechnologies, useUrlFilters } from '../lib/filters';

const PAGE = 24;

export default function Latest() {
  const updates = useUpdates();
  const { filters, setFilters, reset } = useUrlFilters({ includeUndated: false });
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [orderBy, setOrderBy] = useState<'published' | 'detected'>('published');
  const [limit, setLimit] = useState(PAGE);

  const all = updates.data ?? [];
  const filtered = useMemo(() => {
    const out = applyFilters(all, filters);
    return orderBy === 'detected' ? [...out].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)) : out;
  }, [all, filters, orderBy]);
  const techs = useMemo(() => topTechnologies(all), [all]);

  return (
    <div>
      <PageHeader
        eyebrow="Últimas novedades"
        icon={Newspaper}
        title="Lo más reciente de Microsoft Fabric"
        description="Nuevas funcionalidades, anuncios oficiales, mejoras y cambios importantes, con su fecha de publicación original y la fecha en que la plataforma los detectó."
        actions={
          <>
            <SegmentedControl
              ariaLabel="Ordenar por fecha"
              size="sm"
              value={orderBy}
              onChange={setOrderBy}
              options={[
                { value: 'published', label: 'Por publicación' },
                { value: 'detected', label: 'Por detección' },
              ]}
            />
            <SegmentedControl
              ariaLabel="Vista"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', label: <LayoutGrid className="size-4" aria-label="Cuadrícula" /> },
                { value: 'list', label: <List className="size-4" aria-label="Lista" /> },
              ]}
            />
          </>
        }
      />
      <FilterBar filters={filters} setFilters={setFilters} reset={reset} total={all.length} shown={filtered.length} techOptions={techs} />

      {updates.isError ? (
        <ErrorState error={updates.error} onRetry={() => updates.refetch()} />
      ) : updates.isLoading ? (
        <CardsSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No hay novedades con estos filtros"
          description="Prueba a ampliar el rango de fechas, quitar algún filtro o incluir las novedades sin fecha oficial."
          action={
            <button onClick={reset} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-ink-fg dark:bg-surface-3">
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <>
          {view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.slice(0, limit).map((u, i) => (
                <UpdateCard key={u.id} u={u} index={i % PAGE} />
              ))}
            </div>
          ) : (
            <div className="card divide-y divide-line px-2 py-1">
              {filtered.slice(0, limit).map((u) => (
                <UpdateRow key={u.id} u={u} />
              ))}
            </div>
          )}
          {limit < filtered.length && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setLimit((l) => l + PAGE)}
                className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium text-fg shadow-card transition hover:border-line-strong"
              >
                Cargar más ({filtered.length - limit} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
