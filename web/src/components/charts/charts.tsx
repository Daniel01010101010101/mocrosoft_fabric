import clsx from 'clsx';
import { Table2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CategoryId } from '../../../../shared/categories';
import { formatDate, formatNumber } from '../../lib/format';
import { CATEGORY_ICON } from '../../lib/labels';
import type { TimelinePoint } from '../../lib/stats';

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setW(Math.floor(entries[0]!.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={open}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium text-fg-muted transition hover:bg-surface-2 hover:text-fg"
    >
      <Table2 className="size-3.5" /> {open ? 'Ver gráfico' : 'Ver tabla'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Evolución semanal (área de una serie con cursor y desglose)         */
/* ------------------------------------------------------------------ */

export function TimelineChart({
  data,
  height = 230,
  granularity = 'month',
}: {
  data: TimelinePoint[];
  height?: number;
  granularity?: 'week' | 'month';
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 12, bottom: 26, left: 34 };
  const w = Math.max(width, 280);
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.total), 1));
  const x = (i: number) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.total).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const monthTicks = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    let last = '';
    data.forEach((d, i) => {
      const m = formatDate(new Date(d.start).toISOString(), granularity === 'month' ? (d.start === data[0]!.start || new Date(d.start).getMonth() === 0 ? 'MMM yy' : 'MMM') : 'MMM');
      if (m !== last) {
        out.push({ i, label: m });
        last = m;
      }
    });
    return out.filter((_, k) => (w < 520 ? k % 2 === 0 : true));
  }, [data, w, granularity]);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round((px / rect.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) - 90, 0), w - 180) : 0;

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={granularity === 'month' ? 'Novedades por mes' : 'Novedades por semana'}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setHover((v) => Math.min(data.length - 1, (v ?? -1) + 1));
          if (e.key === 'ArrowLeft') setHover((v) => Math.max(0, (v ?? data.length) - 1));
          if (e.key === 'Escape') setHover(null);
        }}
        onBlur={() => setHover(null)}
        className="overflow-visible outline-none"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-[10px] tabular">
              {formatNumber(Math.round(t))}
            </text>
          </g>
        ))}
        {monthTicks.map((m) => (
          <text key={m.i} x={x(m.i)} y={height - 6} textAnchor="middle" className="fill-fg-subtle text-[10px] capitalize">
            {m.label}
          </text>
        ))}
        <motion.path
          d={area}
          fill="var(--viz-single)"
          fillOpacity={0.1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="var(--viz-single)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
        />
        {data.length > 0 && (
          <circle cx={x(data.length - 1)} cy={y(data[data.length - 1]!.total)} r={4} fill="var(--viz-single)" stroke="var(--surface)" strokeWidth={2} />
        )}
        {h && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--fg-subtle)" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(h.total)} r={5} fill="var(--viz-single)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
        <rect
          x={pad.left}
          y={pad.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-[180px] rounded-xl border border-line bg-surface/95 p-3 text-xs shadow-pop backdrop-blur"
          style={{ left: tipLeft }}
          role="status"
        >
          <div className="mb-1.5 capitalize text-fg-subtle">
            {granularity === 'month' ? formatDate(new Date(h.start).toISOString(), 'MMMM yyyy') : `Semana del ${formatDate(new Date(h.start).toISOString(), "d 'de' MMM")}`}
          </div>
          <div className="mb-2 flex items-baseline gap-1.5">
            <span className="tabular text-lg font-semibold text-fg">{h.total}</span>
            <span className="text-fg-muted">novedades</span>
          </div>
          {[
            { k: 'GA', v: h.ga, c: 'var(--viz-ga)' },
            { k: 'Preview', v: h.preview, c: 'var(--viz-preview)' },
            { k: 'Otras', v: h.other, c: 'var(--viz-other)' },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5 text-fg-muted">
                <span className="h-0.5 w-3 rounded" style={{ background: r.c }} />
                {r.k}
              </span>
              <span className="tabular font-medium text-fg">{r.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TimelineTable({ data, granularity = 'month' }: { data: TimelinePoint[]; granularity?: 'week' | 'month' }) {
  return (
    <div className="max-h-[230px] overflow-auto scrollbar-thin">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-surface text-fg-subtle">
          <tr>
            <th className="py-1.5 font-medium">{granularity === 'month' ? 'Mes' : 'Semana'}</th>
            <th className="py-1.5 text-right font-medium">Total</th>
            <th className="py-1.5 text-right font-medium">GA</th>
            <th className="py-1.5 text-right font-medium">Preview</th>
            <th className="py-1.5 text-right font-medium">Otras</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {[...data].reverse().map((d) => (
            <tr key={d.start} className="border-t border-line">
              <td className="py-1.5 capitalize text-fg-muted">{formatDate(new Date(d.start).toISOString(), granularity === 'month' ? 'MMMM yyyy' : 'd MMM yyyy')}</td>
              <td className="py-1.5 text-right font-medium text-fg">{d.total}</td>
              <td className="py-1.5 text-right text-fg-muted">{d.ga}</td>
              <td className="py-1.5 text-right text-fg-muted">{d.preview}</td>
              <td className="py-1.5 text-right text-fg-muted">{d.other}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras horizontales (actividad por categoría)                       */
/* ------------------------------------------------------------------ */

export function BarList({
  items,
  max,
  linkPrefix = '/categorias/',
}: {
  items: { id: CategoryId; name: string; count: number }[];
  max?: number;
  linkPrefix?: string;
}) {
  const top = max ?? Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => {
        const Icon = CATEGORY_ICON[it.id];
        const pct = (it.count / top) * 100;
        return (
          <li key={it.id}>
            <Link
              to={`${linkPrefix}${it.id}`}
              className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand"
              title={`${it.name}: ${it.count} novedades`}
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-fg-muted group-hover:text-fg">
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{it.name}</span>
                </span>
                <span className="tabular text-sm font-semibold text-fg">{it.count}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="h-full rounded-r-[4px] bg-[var(--viz-single)] group-hover:brightness-110"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, 2)}%` }}
                  transition={{ duration: 0.8, delay: i * 0.04, ease: [0.2, 0.7, 0.2, 1] }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Barra segmentada (fases)                                            */
/* ------------------------------------------------------------------ */

export function SegmentedBar({ segments }: { segments: { key: string; label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const [active, setActive] = useState<string | null>(null);
  return (
    <div>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <motion.div
              key={s.key}
              title={`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)} %)`}
              onPointerEnter={() => setActive(s.key)}
              onPointerLeave={() => setActive(null)}
              className={clsx('h-full transition-opacity', active && active !== s.key && 'opacity-50')}
              style={{ background: s.color }}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: s.value }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
            />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {segments.map((s) => (
          <li
            key={s.key}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
            className={clsx('rounded-lg px-1 py-0.5 transition-opacity', active && active !== s.key && 'opacity-50')}
          >
            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
            </div>
            <div className="tabular mt-0.5 text-sm font-semibold text-fg">
              {formatNumber(s.value)} <span className="text-xs font-normal text-fg-subtle">· {Math.round((s.value / total) * 100)} %</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini serie para tarjetas KPI                                        */
/* ------------------------------------------------------------------ */

export function Sparkline({ values, className, color = 'var(--viz-single)' }: { values: number[]; className?: string; color?: string }) {
  const w = 120;
  const h = 32;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * w, h - 3 - (v / max) * (h - 6)] as const);
  const d = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={clsx('h-8 w-full', className)} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} fillOpacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function ChartCard({ title, subtitle, action, children, className }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('card p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[0.98rem] font-semibold tracking-tight text-fg">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
