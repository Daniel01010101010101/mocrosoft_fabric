import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  Database,
  FlaskConical,
  Languages,
  Radar,
  Rocket,
  Sparkles,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarList, ChartCard, SegmentedBar, TableToggle, TimelineChart, TimelineTable } from '../components/charts/charts';
import { KpiCard } from '../components/Kpi';
import { PulseDot, useSync } from '../components/SyncStatus';
import { ErrorState, SectionTitle, SegmentedControl, Skeleton } from '../components/ui';
import { displaySummary, displayTitle, UpdateCard, UpdateRow } from '../components/UpdateCard';
import { useRoadmap, useUpdates } from '../lib/api';
import { formatDateTime, formatNumber, formatRelative } from '../lib/format';
import { CATEGORY_ICON } from '../lib/labels';
import { byRecency, categoryActivity, computeKpis, monthlyTimeline, stageBreakdown, topImportant, weeklyTimeline, windowDate } from '../lib/stats';
import type { UpdateSummary } from '../../../shared/types';

function Hero() {
  const sync = useSync();
  const run = sync.status?.lastRun;
  return (
    <section className="hero-glow relative overflow-hidden rounded-[1.5rem] text-white ring-1 ring-white/10">
      <div className="grid-pattern absolute inset-0 [mask-image:radial-gradient(70%_80%_at_70%_20%,black,transparent)]" />
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.35fr_1fr] lg:p-10">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
          >
            <Radar className="size-3.5 text-[#4ade80]" /> Centro de inteligencia · Microsoft Fabric
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-[1.9rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.6rem]"
          >
            Todo lo que cambia en Microsoft Fabric, <span className="text-gradient">explicado en español.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-white/70"
          >
            Monitorizamos automáticamente el blog oficial, Microsoft Learn, Azure Updates y el roadmap de Fabric cinco veces al día.
            Cada novedad se traduce, se clasifica y se analiza para que entiendas qué es, cómo funciona y qué impacto tiene.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/novedades"
              className="inline-flex items-center gap-2 rounded-xl bg-[#22c55e] px-4 py-2.5 text-sm font-semibold text-[#052e14] shadow-[0_10px_30px_-10px_rgba(34,197,94,0.8)] transition hover:bg-[#4ade80]"
            >
              Ver últimas novedades <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/roadmap"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Próximas funcionalidades
            </Link>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="self-end rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Estado de la monitorización</span>
            <Link to="/estado" className="text-xs text-[#4ade80] hover:underline">
              Detalles
            </Link>
          </div>
          {sync.isLoading ? (
            <div className="space-y-3">
              <div className="h-6 w-2/3 animate-pulse rounded bg-white/10" />
              <div className="h-16 animate-pulse rounded bg-white/5" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <PulseDot health={sync.isError ? 'unknown' : sync.health} />
                <span className="text-lg font-semibold">{sync.isError ? 'Estado no disponible' : sync.label}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/55">{sync.detail}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <dt className="text-[0.7rem] text-white/50">Última actualización exitosa</dt>
                  <dd className="mt-1 font-medium tabular">{formatDateTime(sync.status?.lastSuccessfulRunAt)}</dd>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <dt className="text-[0.7rem] text-white/50">Última consulta</dt>
                  <dd className="mt-1 font-medium tabular">{formatDateTime(run?.startedAt)}</dd>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <dt className="text-[0.7rem] text-white/50">Próxima ejecución</dt>
                  <dd className="mt-1 font-medium tabular">{formatDateTime(sync.next.toISOString())}</dd>
                  <dd className="text-[0.7rem] text-white/45">{formatRelative(sync.next.toISOString())}</dd>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <dt className="text-[0.7rem] text-white/50">Encontradas en la última</dt>
                  <dd className="mt-1 font-medium tabular">
                    {run ? `${formatNumber(run.totals.newUpdates)} nuevas` : '—'}
                  </dd>
                  <dd className="text-[0.7rem] text-white/45">
                    {run ? `${formatNumber(run.totals.updatedUpdates)} actualizadas · ${formatNumber(run.totals.newRoadmap)} roadmap` : ''}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function Spotlight({ items, heuristic }: { items: UpdateSummary[]; heuristic: boolean }) {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return (
    <section className="relative overflow-hidden rounded-[1.5rem] bg-ink p-6 text-white ring-1 ring-white/10 sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#22c55e]/20 blur-3xl" />
      <div className="relative mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#4ade80]">
            <Sparkles className="size-3.5" /> Novedades transformadoras
          </div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Lo que puede cambiar tu forma de trabajar con datos e IA</h2>
          <p className="mt-1 text-sm text-white/55">
            {heuristic
              ? 'Selección provisional por puntuación de impacto; se refinará automáticamente con el análisis de IA.'
              : 'Identificadas por el análisis de impacto de cada novedad.'}
          </p>
        </div>
        <Link to="/destacadas" className="inline-flex items-center gap-1.5 text-sm text-[#4ade80] hover:underline">
          Ver todas las destacadas <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="relative grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {first && (
          <Link
            to={`/novedad/${first.id}`}
            className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 transition hover:border-[#22c55e]/40"
          >
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs text-white/60">
                {(() => {
                  const Icon = CATEGORY_ICON[first.primaryCategory];
                  return <Icon className="size-3.5" />;
                })()}
                Impacto {first.impactScore}/100
              </div>
              <h3 className="text-xl font-semibold leading-snug tracking-tight group-hover:text-[#bbf7d0]">{displayTitle(first)}</h3>
              <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-white/65">{displaySummary(first)}</p>
            </div>
            <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#4ade80]">
              Leer el análisis completo <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        )}
        <div className="grid gap-3">
          {rest.slice(0, 3).map((u) => (
            <Link
              key={u.id}
              to={`/novedad/${u.id}`}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[#22c55e]/40 hover:bg-white/[0.06]"
            >
              <div className="mb-1 text-[0.7rem] text-white/50">Impacto {u.impactScore}/100</div>
              <h4 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-[#bbf7d0]">{displayTitle(u)}</h4>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const updates = useUpdates();
  const roadmap = useRoadmap();
  const [catWindow, setCatWindow] = useState<'30' | '90' | 'all'>('90');
  const [showTable, setShowTable] = useState(false);

  const data = updates.data;
  const kpis = useMemo(() => (data ? computeKpis(data) : null), [data]);
  const timeline = useMemo(() => (data ? monthlyTimeline(data, 12) : []), [data]);
  const weekly = useMemo(() => (data ? weeklyTimeline(data, 12) : []), [data]);
  const cats = useMemo(() => (data ? categoryActivity(data, catWindow === 'all' ? null : Number(catWindow)).slice(0, 8) : []), [data, catWindow]);
  const top5 = useMemo(() => (data ? topImportant(data, 5) : []), [data]);
  const latest = useMemo(() => (data ? data.filter((u) => windowDate(u) !== null).sort(byRecency).slice(0, 6) : []), [data]);
  const stages = useMemo(() => (data ? stageBreakdown(data) : []), [data]);
  const spotlight = useMemo(() => {
    if (!data) return { items: [] as UpdateSummary[], heuristic: false };
    const t = data.filter((u) => u.transformative).sort(byRecency);
    if (t.length >= 2) return { items: t.slice(0, 4), heuristic: false };
    return { items: [...data].sort((a, b) => b.impactScore - a.impactScore || byRecency(a, b)).slice(0, 4), heuristic: true };
  }, [data]);
  const upcoming = useMemo(() => (roadmap.data ?? []).filter((r) => r.releaseStatus === 'planned' && !r.removedFromSource).length, [roadmap.data]);

  if (updates.isError) return <ErrorState error={updates.error} onRetry={() => updates.refetch()} />;

  const weekSpark = weekly.map((p) => p.total);
  const monthSpark = timeline.map((p) => p.total);

  return (
    <div className="space-y-6 sm:space-y-8">
      <Hero />

      <section aria-label="Indicadores principales">
        {!kpis ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-[1.125rem]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <KpiCard index={0} label="Total recopiladas" value={kpis.total} icon={Database} hint="Novedades oficiales únicas" to="/historico" accent />
            <KpiCard index={1} label="Novedades de hoy" value={kpis.today} icon={Sun} hint="Publicadas hoy" to="/novedades" />
            <KpiCard index={2} label="Última semana" value={kpis.week} icon={CalendarDays} hint="Últimos 7 días" spark={weekSpark} to="/semanas?dias=7" />
            <KpiCard index={3} label="Último mes" value={kpis.month} icon={TrendingUp} hint="Últimos 30 días" spark={monthSpark} to="/semanas?dias=30" />
            <KpiCard index={4} label="Funcionalidades nuevas" value={kpis.newFeatures30} icon={Rocket} hint="Últimos 30 días" to="/novedades?tipo=feature" />
            <KpiCard index={5} label="En Preview" value={kpis.preview} icon={FlaskConical} hint="Versión preliminar" to="/historico?fase=preview" />
            <KpiCard index={6} label="En disponibilidad general" value={kpis.ga} icon={BadgeCheck} hint="Generally Available (GA)" to="/historico?fase=ga" />
            <KpiCard index={7} label="Próximas en roadmap" value={upcoming} icon={CalendarClock} hint="Planificadas oficialmente" to="/roadmap" />
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Evolución de las actualizaciones"
          subtitle="Novedades publicadas por mes · últimos 12 meses"
          action={<TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />}
        >
          {!data ? <Skeleton className="h-[230px]" /> : showTable ? <TimelineTable data={timeline} /> : <TimelineChart data={timeline} />}
        </ChartCard>
        <ChartCard title="Fase de las novedades" subtitle="Sobre el total recopilado">
          {!data ? (
            <Skeleton className="h-24" />
          ) : (
            <SegmentedBar
              segments={stages.map((s) => ({
                key: s.stage,
                label: s.stage === 'ga' ? 'GA' : s.stage === 'preview' ? 'Preview' : 'Otras',
                value: s.count,
                color: s.stage === 'ga' ? 'var(--viz-ga)' : s.stage === 'preview' ? 'var(--viz-preview)' : 'var(--viz-other)',
              }))}
            />
          )}
          {kpis && (
            <div className="mt-6 rounded-xl border border-line bg-surface-2 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-fg">
                <Languages className="size-4 text-brand" /> Traducción y análisis en español
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  className="h-full rounded-full bg-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${kpis.total ? (kpis.translated / kpis.total) * 100 : 0}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
              <p className="mt-2 text-xs text-fg-muted">
                {formatNumber(kpis.translated)} de {formatNumber(kpis.total)} novedades en español · {formatNumber(kpis.aiDone)} con análisis completo.
                {kpis.aiDone < kpis.total && ' El resto se procesa automáticamente en las próximas ejecuciones.'}
              </p>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <SectionTitle
            title="Las 5 novedades más importantes"
            subtitle="Mayor impacto entre las publicaciones recientes"
            action={
              <Link to="/destacadas" className="shrink-0 whitespace-nowrap text-sm font-medium text-brand-ink hover:underline">
                Ver ranking
              </Link>
            }
          />
          {!data ? (
            <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <div className="-mx-3">
              {top5.map((u, i) => (
                <UpdateRow key={u.id} u={u} rank={i + 1} />
              ))}
            </div>
          )}
        </section>
        <ChartCard
          title="Categorías con mayor actividad"
          subtitle="Número de novedades por categoría principal"
          action={
            <SegmentedControl
              size="sm"
              ariaLabel="Ventana de actividad"
              value={catWindow}
              onChange={setCatWindow}
              options={[
                { value: '30', label: '30 d' },
                { value: '90', label: '90 d' },
                { value: 'all', label: 'Todo' },
              ]}
            />
          }
        >
          {!data ? <Skeleton className="h-64" /> : cats.length ? <BarList items={cats} /> : <p className="text-sm text-fg-muted">Sin actividad en este periodo.</p>}
        </ChartCard>
      </div>

      {data && <Spotlight items={spotlight.items} heuristic={spotlight.heuristic} />}

      <section>
        <SectionTitle
          title="Lo último publicado"
          subtitle="Novedades más recientes de las fuentes oficiales"
          action={
            <Link to="/novedades" className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">
              Ver todas <ArrowRight className="size-4" />
            </Link>
          }
        />
        {!data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-64 rounded-[1.125rem]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {latest.map((u, i) => (
              <UpdateCard key={u.id} u={u} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
