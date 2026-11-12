import { ArrowUpRight, Shapes } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../../../shared/categories';
import { Sparkline } from '../components/charts/charts';
import { ErrorState, PageHeader, Skeleton } from '../components/ui';
import { useRoadmap, useUpdates } from '../lib/api';
import { formatNumber } from '../lib/format';
import { CATEGORY_ICON } from '../lib/labels';
import { monthlyTimeline, withinDays } from '../lib/stats';

export default function Categories() {
  const updates = useUpdates();
  const roadmap = useRoadmap();
  const stats = useMemo(() => {
    const all = updates.data ?? [];
    return CATEGORIES.map((c) => {
      const items = all.filter((u) => u.categories.includes(c.id));
      return {
        c,
        total: items.length,
        recent: items.filter((u) => withinDays(u, 30)).length,
        planned: (roadmap.data ?? []).filter((r) => r.category === c.id && r.releaseStatus === 'planned').length,
        spark: monthlyTimeline(items, 12).map((p) => p.total),
      };
    });
  }, [updates.data, roadmap.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Categorías tecnológicas"
        icon={Shapes}
        title="Explora Microsoft Fabric por componente"
        description="Cada categoría tiene su propia vista con sus novedades, filtros y funcionalidades planificadas en el roadmap."
      />
      {updates.isError ? (
        <ErrorState error={updates.error} onRetry={() => updates.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {stats.map(({ c, total, recent, planned, spark }, i) => {
            const Icon = CATEGORY_ICON[c.id];
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
                <Link to={`/categorias/${c.id}`} className="card card-hover group flex h-full flex-col p-5">
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-ink text-brand ring-1 ring-ink-line transition group-hover:shadow-[0_0_24px_-4px_var(--brand-glow)]">
                      <Icon className="size-5" />
                    </span>
                    <ArrowUpRight className="size-4 text-fg-subtle transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
                  </div>
                  <h2 className="mt-4 font-semibold text-fg">{c.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{c.description}</p>
                  <div className="mt-auto pt-4">
                    {updates.isLoading ? (
                      <Skeleton className="h-8" />
                    ) : (
                      <>
                        <Sparkline values={spark} />
                        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                          <div>
                            <div className="tabular text-sm font-semibold text-fg">{formatNumber(total)}</div>
                            <div className="text-[0.65rem] text-fg-subtle">Total</div>
                          </div>
                          <div>
                            <div className="tabular text-sm font-semibold text-fg">{formatNumber(recent)}</div>
                            <div className="text-[0.65rem] text-fg-subtle">30 días</div>
                          </div>
                          <div>
                            <div className="tabular text-sm font-semibold text-fg">{formatNumber(planned)}</div>
                            <div className="text-[0.65rem] text-fg-subtle">Planificadas</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
