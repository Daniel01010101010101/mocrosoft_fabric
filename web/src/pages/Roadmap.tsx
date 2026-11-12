import clsx from 'clsx';
import { ArrowRight, CalendarClock, ExternalLink, FlaskConical, GitCompareArrows, Map as MapIcon, PackageCheck, Rocket, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORY_BY_ID } from '../../../shared/categories';
import type { RoadmapChange, RoadmapSummary } from '../../../shared/types';
import { CountUp } from '../components/Kpi';
import { MiniMarkdown } from '../components/MiniMarkdown';
import { AiBadge, Badge, CategoryChip, EmptyState, ErrorState, PageHeader, SegmentedControl, Skeleton } from '../components/ui';
import { UpdateRow } from '../components/UpdateCard';
import { useRoadmap, useUpdates } from '../lib/api';
import { formatDate, formatNumber, quarterLabel } from '../lib/format';
import { normalize } from '../lib/search';
import { byRecency } from '../lib/stats';

type Tab = 'proximas' | 'ga' | 'preview' | 'entregado' | 'cambios';

const FIELD_LABEL: Record<RoadmapChange['field'], string> = {
  releaseStatus: 'Estado',
  releaseType: 'Tipo de lanzamiento',
  releaseDate: 'Fecha estimada',
  name: 'Nombre',
  description: 'Descripción',
};

function valueLabel(field: RoadmapChange['field'], v: string): string {
  if (field === 'releaseStatus') return v === 'shipped' ? 'Entregada' : 'Planificada';
  if (field === 'releaseType') return v === 'ga' ? 'GA' : 'Preview';
  if (field === 'releaseDate') return quarterLabel(v);
  return v.length > 80 ? `${v.slice(0, 80)}…` : v;
}

function RoadmapCard({ r, highlight }: { r: RoadmapSummary; highlight?: boolean }) {
  const [open, setOpen] = useState(false);
  const desc = r.descriptionEs ?? r.description;
  return (
    <motion.article
      id={r.id}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('card p-4 transition', highlight && 'ring-2 ring-brand')}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <CategoryChip id={r.category} link={false} />
        <Badge tone={r.releaseType === 'ga' ? 'brand' : 'blue'}>{r.releaseType === 'ga' ? 'GA' : 'Preview'}</Badge>
        <Badge tone={r.releaseStatus === 'shipped' ? 'neutral' : 'amber'}>{r.releaseStatus === 'shipped' ? 'Entregada' : 'Planificada'}</Badge>
        <AiBadge status={r.aiStatus} original="en" />
      </div>
      <h3 className="text-[0.95rem] font-semibold leading-snug text-fg">{r.nameEs ?? r.name}</h3>
      {r.nameEs && r.nameEs !== r.name && <p className="mt-0.5 text-xs text-fg-subtle">{r.name}</p>}
      {desc && (
        <div className={clsx('prose-fr mt-2 text-sm text-fg-muted', !open && 'line-clamp-3')}>
          <MiniMarkdown text={desc} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-fg-subtle">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-3.5" />
          <span className="tabular">{quarterLabel(r.releaseDate)}</span> · {r.product}
        </span>
        <span className="flex items-center gap-3">
          {desc && desc.length > 160 && (
            <button onClick={() => setOpen((v) => !v)} className="font-medium text-fg-muted hover:text-fg">
              {open ? 'Ver menos' : 'Ver más'}
            </button>
          )}
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline">
            Roadmap oficial <ExternalLink className="size-3" />
          </a>
        </span>
      </div>
      {r.history.length > 0 && (
        <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[0.72rem] text-fg-muted">
          Último cambio: {FIELD_LABEL[r.history[r.history.length - 1]!.field]} · {valueLabel(r.history[r.history.length - 1]!.field, r.history[r.history.length - 1]!.from)} →{' '}
          {valueLabel(r.history[r.history.length - 1]!.field, r.history[r.history.length - 1]!.to)}
        </div>
      )}
    </motion.article>
  );
}

const OVERDUE_KEY = '__overdue__';

/** Agrupa por trimestre. Con `splitOverdue`, lo planificado para trimestres ya cerrados va en un grupo aparte al final. */
function groupByQuarter(items: RoadmapSummary[], asc: boolean, splitOverdue = false) {
  const m = new Map<string, RoadmapSummary[]>();
  const qStart = currentQuarterStart();
  for (const r of items) {
    const overdue = splitOverdue && r.releaseQuarterStart !== null && Date.parse(r.releaseQuarterStart) < qStart;
    const key = overdue ? OVERDUE_KEY : r.releaseDate || 'Sin fecha';
    m.set(key, [...(m.get(key) ?? []), r]);
  }
  const keyOf = (rd: string) => (rd === OVERDUE_KEY ? 'zzzz' : (/Q([1-4])\s*(\d{4})/i.exec(rd)?.slice(1).reverse().join('-') ?? '9999'));
  return [...m.entries()].sort((a, b) => {
    if (a[0] === OVERDUE_KEY) return 1;
    if (b[0] === OVERDUE_KEY) return -1;
    return asc ? keyOf(a[0]).localeCompare(keyOf(b[0])) : keyOf(b[0]).localeCompare(keyOf(a[0]));
  });
}

function currentQuarterStart(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1);
}

export default function Roadmap() {
  const roadmap = useRoadmap();
  const updates = useUpdates();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('vista') as Tab) || 'proximas';
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [product, setProduct] = useState<string>('');
  const highlight = sp.get('item');

  useEffect(() => {
    if (highlight) setTimeout(() => document.getElementById(highlight)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
  }, [highlight, roadmap.data]);

  const all = useMemo(() => (roadmap.data ?? []).filter((r) => !r.removedFromSource), [roadmap.data]);
  const products = useMemo(() => [...new Set(all.map((r) => r.product))].sort(), [all]);
  const matches = useMemo(() => {
    const nq = normalize(q.trim());
    return all.filter((r) => {
      if (product && r.product !== product) return false;
      if (!nq) return true;
      return normalize(`${r.name} ${r.nameEs ?? ''} ${r.description} ${r.descriptionEs ?? ''}`).includes(nq);
    });
  }, [all, q, product]);

  const qStart = currentQuarterStart();
  const planned = matches.filter((r) => r.releaseStatus === 'planned');
  const nextGa = planned
    .filter((r) => r.releaseType === 'ga' && (!r.releaseQuarterStart || Date.parse(r.releaseQuarterStart) <= qStart + 200 * 86_400_000))
    .sort((a, b) => (a.releaseQuarterStart ?? '').localeCompare(b.releaseQuarterStart ?? ''));
  const plannedPreview = planned.filter((r) => r.releaseType === 'preview');
  const shipped = matches.filter((r) => r.releaseStatus === 'shipped');
  const changes = useMemo(
    () =>
      matches
        .flatMap((r) => r.history.filter((h) => h.field !== 'description').map((h) => ({ r, h })))
        .sort((a, b) => b.h.at.localeCompare(a.h.at)),
    [matches],
  );
  const learnPreview = useMemo(
    () => (updates.data ?? []).filter((u) => u.stage === 'preview' && u.source === 'learn-whats-new').sort(byRecency),
    [updates.data],
  );

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(sp);
    next.set('vista', t);
    next.delete('item');
    setSp(next, { replace: true });
  };

  const stats = [
    { label: 'Planificadas', value: all.filter((r) => r.releaseStatus === 'planned').length, icon: CalendarClock },
    { label: 'Próximas a GA', value: all.filter((r) => r.releaseStatus === 'planned' && r.releaseType === 'ga').length, icon: Rocket },
    { label: 'Preview anunciadas', value: all.filter((r) => r.releaseStatus === 'planned' && r.releaseType === 'preview').length, icon: FlaskConical },
    { label: 'Entregadas', value: all.filter((r) => r.releaseStatus === 'shipped').length, icon: PackageCheck },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Próximas novedades y roadmap"
        icon={MapIcon}
        title="Qué viene en Microsoft Fabric"
        description="Funcionalidades anunciadas, mejoras en desarrollo, características en Preview y las que están próximas a disponibilidad general, con su estado y fecha estimada según el roadmap oficial."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={clsx('card p-4', i === 0 && 'border-brand/30 bg-gradient-to-br from-brand-soft to-surface')}>
            <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
              {s.label}
              <s.icon className="size-4 text-fg-subtle" />
            </div>
            <div className="mt-1.5 text-3xl font-semibold tracking-tight text-fg">
              {roadmap.isLoading ? <Skeleton className="h-8 w-16" /> : <CountUp value={s.value} className="tabular" />}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <SegmentedControl
            ariaLabel="Vista del roadmap"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'proximas', label: 'Próximamente' },
              { value: 'ga', label: 'Próximas a GA' },
              { value: 'preview', label: 'En Preview' },
              { value: 'entregado', label: 'Entregado' },
              { value: 'cambios', label: 'Cambios' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar en el roadmap…"
              className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-brand/50 sm:w-64"
            />
          </label>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-brand/50"
            aria-label="Producto"
          >
            <option value="">Todos los productos</option>
            {products.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {roadmap.isError ? (
        <ErrorState error={roadmap.error} onRetry={() => roadmap.refetch()} />
      ) : roadmap.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-[1.125rem]" />
          ))}
        </div>
      ) : tab === 'cambios' ? (
        changes.length === 0 ? (
          <EmptyState
            title="Aún no se han detectado cambios"
            description="Cada ejecución compara el roadmap con la versión anterior. Aquí aparecerán los cambios de estado, fecha o tipo de lanzamiento en cuanto se produzcan."
          />
        ) : (
          <div className="card divide-y divide-line">
            {changes.slice(0, 200).map(({ r, h }, i) => (
              <div key={`${r.id}-${i}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="tabular w-28 shrink-0 text-xs text-fg-subtle">{formatDate(h.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{r.nameEs ?? r.name}</span>
                  <span className="text-xs text-fg-muted">
                    <GitCompareArrows className="mr-1 inline size-3" />
                    {FIELD_LABEL[h.field]}: {valueLabel(h.field, h.from)} <ArrowRight className="inline size-3" /> <strong>{valueLabel(h.field, h.to)}</strong>
                  </span>
                </span>
                <CategoryChip id={r.category} />
              </div>
            ))}
          </div>
        )
      ) : tab === 'preview' ? (
        <div className="space-y-8">
          <section>
            <h2 className="mb-1 text-base font-semibold text-fg">Características actualmente en Preview</h2>
            <p className="mb-4 text-sm text-fg-muted">Según la documentación oficial de Microsoft Learn ({formatNumber(learnPreview.length)} funcionalidades).</p>
            {learnPreview.length === 0 ? (
              <EmptyState title="Sin datos de Preview" />
            ) : (
              <div className="card divide-y divide-line px-2 py-1">
                {learnPreview.slice(0, 120).map((u) => (
                  <UpdateRow key={u.id} u={u} />
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-4 text-base font-semibold text-fg">Previews anunciadas en el roadmap ({formatNumber(plannedPreview.length)})</h2>
            <QuarterColumns groups={groupByQuarter(plannedPreview, true, true)} highlight={highlight} />
          </section>
        </div>
      ) : (
        <QuarterColumns
          groups={
            tab === 'ga'
              ? groupByQuarter(nextGa, true, true)
              : tab === 'entregado'
                ? groupByQuarter(shipped, false)
                : groupByQuarter(planned, true, true)
          }
          highlight={highlight}
        />
      )}
    </div>
  );
}

function QuarterColumns({ groups, highlight }: { groups: [string, RoadmapSummary[]][]; highlight: string | null }) {
  const [limits, setLimits] = useState<Record<string, number>>({});
  if (groups.length === 0) return <EmptyState title="No hay elementos" description="No hay elementos del roadmap con estos criterios." />;
  return (
    <div className="space-y-8">
      {groups.map(([quarter, items]) => {
        const limit = limits[quarter] ?? 9;
        const byCat = items.reduce<Record<string, number>>((acc, r) => ((acc[r.category] = (acc[r.category] ?? 0) + 1), acc), {});
        const topCats = Object.entries(byCat)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([c, n]) => `${CATEGORY_BY_ID[c as keyof typeof CATEGORY_BY_ID]?.name ?? c} (${n})`);
        const sorted = highlight && items.some((r) => r.id === highlight) ? [items.find((r) => r.id === highlight)!, ...items.filter((r) => r.id !== highlight)] : items;
        return (
          <section key={quarter}>
            {quarter === OVERDUE_KEY && (
              <p className="mb-3 max-w-3xl text-sm text-fg-muted">
                Microsoft las mantiene como planificadas aunque su trimestre estimado ya terminó: pueden estar retrasadas o pendientes de actualizar en el roadmap oficial.
              </p>
            )}
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-fg">
                {quarter === OVERDUE_KEY ? 'Planificadas con la fecha estimada ya superada' : quarterLabel(quarter)}
              </h2>
              <span className="tabular text-sm text-fg-muted">{formatNumber(items.length)} funcionalidades</span>
              <span className="text-xs text-fg-subtle">{topCats.join(' · ')}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sorted.slice(0, limit).map((r) => (
                <RoadmapCard key={r.id} r={r} highlight={r.id === highlight} />
              ))}
            </div>
            {limit < items.length && (
              <button
                onClick={() => setLimits((l) => ({ ...l, [quarter]: limit + 12 }))}
                className="mt-4 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-fg-muted hover:text-fg"
              >
                Ver {Math.min(12, items.length - limit)} más{quarter === OVERDUE_KEY ? '' : ` de ${quarterLabel(quarter)}`}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
