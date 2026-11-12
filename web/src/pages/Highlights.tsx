import { Sparkles, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AUDIENCE_LABELS, type Audience } from '../../../shared/types';
import { CardsSkeleton, Badge, CategoryChip, EmptyState, ErrorState, ImpactRing, PageHeader, SegmentedControl, StageBadge, AiBadge } from '../components/ui';
import { DateMeta, displaySummary, displayTitle, UpdateCard } from '../components/UpdateCard';
import { useUpdates } from '../lib/api';
import { byRecency, withinDays } from '../lib/stats';

type Win = '30' | '90' | '365' | 'all';

export default function Highlights() {
  const updates = useUpdates();
  const [sp, setSp] = useSearchParams();
  const audience = (sp.get('perfil') ?? 'all') as Audience | 'all';
  const win = (sp.get('periodo') ?? '90') as Win;

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    n.set(k, v);
    setSp(n, { replace: true });
  };

  const pool = useMemo(
    () =>
      (updates.data ?? []).filter(
        (u) => (win === 'all' || withinDays(u, Number(win))) && (audience === 'all' || u.audiences.includes(audience)) && u.type !== 'event',
      ),
    [updates.data, win, audience],
  );
  const ranking = useMemo(() => [...pool].sort((a, b) => b.impactScore - a.impactScore || byRecency(a, b)).slice(0, 30), [pool]);
  const transformative = useMemo(() => pool.filter((u) => u.transformative).sort(byRecency).slice(0, 6), [pool]);

  return (
    <div>
      <PageHeader
        eyebrow="Novedades más importantes"
        icon={Star}
        title="Las actualizaciones de mayor impacto"
        description="Ranking de las novedades que más afectan a profesionales de datos, desarrolladores, arquitectos y administradores de Microsoft Fabric. El impacto combina el análisis de IA de cada novedad con señales objetivas (fase, tipo, alcance)."
        actions={
          <SegmentedControl
            ariaLabel="Periodo"
            size="sm"
            value={win}
            onChange={(v) => set('periodo', v)}
            options={[
              { value: '30', label: '30 d' },
              { value: '90', label: '90 d' },
              { value: '365', label: '12 m' },
              { value: 'all', label: 'Todo' },
            ]}
          />
        }
      />
      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {(['all', ...Object.keys(AUDIENCE_LABELS)] as (Audience | 'all')[]).map((a) => (
          <button
            key={a}
            onClick={() => set('perfil', a)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              audience === a ? 'border-ink bg-ink text-ink-fg dark:border-brand dark:bg-brand dark:text-ink' : 'border-line bg-surface text-fg-muted hover:text-fg'
            }`}
          >
            {a === 'all' ? 'Todos los perfiles' : AUDIENCE_LABELS[a]}
          </button>
        ))}
      </div>

      {updates.isError ? (
        <ErrorState error={updates.error} onRetry={() => updates.refetch()} />
      ) : updates.isLoading ? (
        <CardsSkeleton />
      ) : ranking.length === 0 ? (
        <EmptyState title="No hay novedades para este perfil y periodo" description="Amplía el periodo o elige otro perfil." />
      ) : (
        <div className="space-y-10">
          {transformative.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-fg">
                <Sparkles className="size-4 text-brand" /> Pueden cambiar la forma de trabajar con datos e IA
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {transformative.map((u, i) => (
                  <UpdateCard key={u.id} u={u} index={i} />
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-4 text-base font-semibold text-fg">Ranking por impacto</h2>
            <ol className="space-y-3">
              {ranking.map((u, i) => (
                <motion.li key={u.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
                  <Link to={`/novedad/${u.id}`} className="card card-hover group flex gap-4 p-4 sm:p-5">
                    <span className="tabular hidden w-8 shrink-0 text-2xl font-semibold text-fg-subtle group-hover:text-brand sm:block">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <CategoryChip id={u.primaryCategory} link={false} />
                        <StageBadge stage={u.stage} />
                        {u.transformative && (
                          <Badge tone="dark">
                            <Sparkles className="size-3 text-brand" /> Transformadora
                          </Badge>
                        )}
                        <AiBadge status={u.aiStatus} original={u.originalLanguage} />
                      </div>
                      <h3 className="text-[1rem] font-semibold leading-snug text-fg group-hover:text-brand-ink">{displayTitle(u)}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{displaySummary(u)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <DateMeta u={u} compact />
                        {u.audiences.length > 0 && (
                          <span className="text-[0.72rem] text-fg-subtle">Para: {u.audiences.map((a) => AUDIENCE_LABELS[a]).join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <ImpactRing score={u.impactScore} size={48} />
                  </Link>
                </motion.li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
