import clsx from 'clsx';
import { ArrowDownWideNarrow, Search, SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CATEGORIES, CATEGORY_BY_ID } from '../../../shared/categories';
import type { SourceId, Stage, UpdateType } from '../../../shared/types';
import { activeFilterCount, type UpdateFilters } from '../lib/filters';
import { formatNumber } from '../lib/format';
import { CATEGORY_ICON, SOURCE_SHORT, TYPE_SHORT } from '../lib/labels';

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
        active ? 'border-brand/50 bg-brand-soft text-brand-ink' : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const STAGES: { v: Stage; label: string }[] = [
  { v: 'ga', label: 'GA' },
  { v: 'preview', label: 'Preview' },
  { v: 'planned', label: 'Planificada' },
  { v: 'none', label: 'Sin fase' },
];

const SOURCES: SourceId[] = ['fabric-blog', 'powerbi-blog', 'learn-whats-new', 'azure-updates'];

export interface FilterBarProps {
  filters: UpdateFilters;
  setFilters: (p: Partial<UpdateFilters>) => void;
  reset: () => void;
  total: number;
  shown: number;
  techOptions?: { name: string; count: number }[];
  hideCategories?: boolean;
  showDates?: boolean;
  defaultOpen?: boolean;
  placeholder?: string;
}

export function FilterBar({
  filters,
  setFilters,
  reset,
  total,
  shown,
  techOptions = [],
  hideCategories = false,
  showDates = true,
  defaultOpen = false,
  placeholder = 'Buscar por título, tecnología o contenido…',
}: FilterBarProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState(filters.q);
  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (q !== filters.q) setFilters({ q });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const count = activeFilterCount(filters) - (filters.q ? 1 : 0);

  return (
    <div className="card mb-6 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-9 text-sm text-fg outline-none transition placeholder:text-fg-subtle focus:border-brand/50 focus:bg-surface focus:ring-4 focus:ring-brand/10"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-fg-subtle hover:text-fg" aria-label="Borrar búsqueda">
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Ordenar</span>
            <ArrowDownWideNarrow className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ sort: e.target.value as UpdateFilters['sort'] })}
              className="h-10 appearance-none rounded-xl border border-line bg-surface pl-8 pr-8 text-sm text-fg outline-none focus:border-brand/50"
            >
              <option value="desc">Más recientes primero</option>
              <option value="asc">Más antiguas primero</option>
              <option value="impact">Mayor impacto</option>
            </select>
          </label>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={clsx(
              'inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition',
              open || count > 0 ? 'border-brand/40 bg-brand-soft text-brand-ink' : 'border-line bg-surface text-fg-muted hover:text-fg',
            )}
          >
            <SlidersHorizontal className="size-4" /> Filtros
            {count > 0 && <span className="tabular rounded-md bg-brand px-1.5 text-[0.7rem] text-white dark:text-ink">{count}</span>}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 grid gap-5 border-t border-line pt-4 lg:grid-cols-2">
              {!hideCategories && (
                <fieldset className="lg:col-span-2">
                  <legend className="eyebrow mb-2">Tecnología / categoría</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => {
                      const Icon = CATEGORY_ICON[c.id];
                      return (
                        <Chip key={c.id} active={filters.categories.includes(c.id)} onClick={() => setFilters({ categories: toggle(filters.categories, c.id) })}>
                          <Icon className="size-3" /> {c.name}
                        </Chip>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <fieldset>
                <legend className="eyebrow mb-2">Fase</legend>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map((s) => (
                    <Chip key={s.v} active={filters.stages.includes(s.v)} onClick={() => setFilters({ stages: toggle(filters.stages, s.v) })}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="eyebrow mb-2">Tipo</legend>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TYPE_SHORT) as UpdateType[]).map((t) => (
                    <Chip key={t} active={filters.types.includes(t)} onClick={() => setFilters({ types: toggle(filters.types, t) })}>
                      {TYPE_SHORT[t]}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="eyebrow mb-2">Fuente oficial</legend>
                <div className="flex flex-wrap gap-1.5">
                  {SOURCES.map((s) => (
                    <Chip key={s} active={filters.sources.includes(s)} onClick={() => setFilters({ sources: toggle(filters.sources, s) })}>
                      {SOURCE_SHORT[s]}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              {techOptions.length > 0 && (
                <fieldset>
                  <legend className="eyebrow mb-2">Producto o tecnología mencionada</legend>
                  <select
                    value={filters.tech}
                    onChange={(e) => setFilters({ tech: e.target.value })}
                    className="h-9 w-full rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-brand/50"
                  >
                    <option value="">Cualquiera</option>
                    {techOptions.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.count})
                      </option>
                    ))}
                  </select>
                </fieldset>
              )}
              {showDates && (
                <fieldset className="lg:col-span-2">
                  <legend className="eyebrow mb-2">Fecha de publicación</legend>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { label: '7 días', days: 7 },
                      { label: '30 días', days: 30 },
                      { label: '90 días', days: 90 },
                      { label: '12 meses', days: 365 },
                    ].map((p) => (
                      <Chip key={p.days} active={filters.from === isoDaysAgo(p.days) && !filters.to} onClick={() => setFilters({ from: isoDaysAgo(p.days), to: '' })}>
                        {p.label}
                      </Chip>
                    ))}
                    <div className="flex items-center gap-2 text-sm text-fg-muted">
                      <input
                        type="date"
                        value={filters.from}
                        onChange={(e) => setFilters({ from: e.target.value })}
                        aria-label="Desde"
                        className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-fg outline-none focus:border-brand/50"
                      />
                      <span>—</span>
                      <input
                        type="date"
                        value={filters.to}
                        onChange={(e) => setFilters({ to: e.target.value })}
                        aria-label="Hasta"
                        className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-fg outline-none focus:border-brand/50"
                      />
                    </div>
                    <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
                      <input
                        type="checkbox"
                        checked={filters.includeUndated}
                        onChange={(e) => setFilters({ includeUndated: e.target.checked })}
                        className="size-4 accent-[var(--brand)]"
                      />
                      Incluir novedades sin fecha oficial
                    </label>
                  </div>
                </fieldset>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        <span className="tabular">
          {shown === total ? `${formatNumber(total)} resultados` : `${formatNumber(shown)} de ${formatNumber(total)} resultados`}
        </span>
        {filters.categories.map((c) => (
          <button key={c} onClick={() => setFilters({ categories: filters.categories.filter((x) => x !== c) })} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 hover:text-fg">
            {CATEGORY_BY_ID[c]?.name} <X className="size-3" />
          </button>
        ))}
        {filters.tech && (
          <button onClick={() => setFilters({ tech: '' })} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 hover:text-fg">
            {filters.tech} <X className="size-3" />
          </button>
        )}
        {activeFilterCount(filters) > 0 && (
          <button onClick={reset} className="ml-auto font-medium text-brand-ink hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
