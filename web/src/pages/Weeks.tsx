import { CalendarRange, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORY_BY_ID, type CategoryId } from '../../../shared/categories';
import type { UpdateSummary } from '../../../shared/types';
import { BarList, ChartCard } from '../components/charts/charts';
import { CountUp } from '../components/Kpi';
import { CardsSkeleton, EmptyState, ErrorState, PageHeader, SectionTitle, SegmentedControl } from '../components/ui';
import { UpdateCard, UpdateRow } from '../components/UpdateCard';
import { useUpdates } from '../lib/api';
import { CATEGORY_ICON } from '../lib/labels';
import { byRecency, categoryActivity, withinDays } from '../lib/stats';

type Window = '7' | '15' | '30';

function CategoryGroup({ id, items }: { id: CategoryId; items: UpdateSummary[] }) {
  const [open, setOpen] = useState(items.length <= 4);
  const Icon = CATEGORY_ICON[id];
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface-2">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-ink">
          <Icon className="size-4" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-fg">{CATEGORY_BY_ID[id].name}</span>
          <span className="block text-xs text-fg-muted">{items.length === 1 ? '1 novedad' : `${items.length} novedades`}</span>
        </span>
        <ChevronDown className={`size-4 text-fg-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-line px-2 py-1">
              {items.map((u) => (
                <UpdateRow key={u.id} u={u} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Weeks() {
  const updates = useUpdates();
  const [sp, setSp] = useSearchParams();
  const win = (['7', '15', '30'].includes(sp.get('dias') ?? '') ? sp.get('dias') : '7') as Window;
  const days = Number(win);

  const inWindow = useMemo(() => (updates.data ?? []).filter((u) => withinDays(u, days)).sort(byRecency), [updates.data, days]);
  const prevWindow = useMemo(
    () => (updates.data ?? []).filter((u) => withinDays(u, days * 2) && !withinDays(u, days)).length,
    [updates.data, days],
  );
  const groups = useMemo(() => {
    const m = new Map<CategoryId, UpdateSummary[]>();
    for (const u of inWindow) m.set(u.primaryCategory, [...(m.get(u.primaryCategory) ?? []), u]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [inWindow]);
  const relevant = useMemo(() => [...inWindow].sort((a, b) => b.impactScore - a.impactScore).slice(0, 6), [inWindow]);
  const cats = useMemo(() => categoryActivity(inWindow, null), [inWindow]);
  const counts = useMemo(
    () => ({
      features: inWindow.filter((u) => u.type === 'feature').length,
      ga: inWindow.filter((u) => u.stage === 'ga').length,
      preview: inWindow.filter((u) => u.stage === 'preview').length,
      deprecations: inWindow.filter((u) => u.type === 'deprecation').length,
    }),
    [inWindow],
  );

  const delta = inWindow.length - prevWindow;

  return (
    <div>
      <PageHeader
        eyebrow="Novedades de las últimas semanas"
        icon={CalendarRange}
        title={`Lo que ha cambiado en los últimos ${days} días`}
        description="Resumen por periodo con las novedades clasificadas por categoría y los cambios más relevantes primero."
        actions={
          <SegmentedControl
            ariaLabel="Periodo"
            value={win}
            onChange={(v) => setSp({ dias: v }, { replace: true })}
            options={[
              { value: '7', label: '7 días' },
              { value: '15', label: '15 días' },
              { value: '30', label: '30 días' },
            ]}
          />
        }
      />

      {updates.isError ? (
        <ErrorState error={updates.error} onRetry={() => updates.refetch()} />
      ) : updates.isLoading ? (
        <CardsSkeleton />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {[
              { label: 'Novedades', value: inWindow.length, hint: `${delta >= 0 ? '+' : ''}${delta} frente a los ${days} días anteriores` },
              { label: 'Funcionalidades nuevas', value: counts.features },
              { label: 'Pasan a GA', value: counts.ga },
              { label: 'En Preview', value: counts.preview },
              { label: 'Retiradas o cambios', value: counts.deprecations },
            ].map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`card p-4 ${i === 0 ? 'col-span-2 border-brand/30 bg-gradient-to-br from-brand-soft to-surface lg:col-span-1' : ''}`}
              >
                <div className="text-xs font-medium text-fg-muted">{k.label}</div>
                <div className="mt-1.5 text-3xl font-semibold tracking-tight text-fg">
                  <CountUp value={k.value} className="tabular" />
                </div>
                {k.hint && <div className="mt-1 text-xs text-fg-subtle">{k.hint}</div>}
              </motion.div>
            ))}
          </div>

          {inWindow.length === 0 ? (
            <EmptyState title="Sin novedades en este periodo" description="No se han publicado novedades oficiales en este intervalo. Prueba con un periodo más amplio." />
          ) : (
            <>
              <section>
                <SectionTitle title="Lo más relevante del periodo" subtitle="Ordenado por impacto para profesionales de datos" />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {relevant.map((u, i) => (
                    <UpdateCard key={u.id} u={u} index={i} />
                  ))}
                </div>
              </section>
              <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
                <ChartCard title="Actividad por categoría" subtitle={`Últimos ${days} días`}>
                  <BarList items={cats} />
                </ChartCard>
                <section>
                  <SectionTitle title="Clasificación por categorías" subtitle="Todas las novedades del periodo agrupadas" />
                  <div className="space-y-3">
                    {groups.map(([id, items]) => (
                      <CategoryGroup key={id} id={id} items={items} />
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
