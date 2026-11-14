import clsx from 'clsx';
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  Database,
  ExternalLink,
  Gauge,
  GitFork,
  Info,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  Map as MapIcon,
  PencilLine,
  Rocket,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Table2,
  Target,
  TriangleAlert,
  Wallet,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HOURS_PER_SESSION,
  POWERTABLE_CHECKLIST,
  POWERTABLE_FACTS,
  POWERTABLE_FAQ,
  POWERTABLE_GUIDE,
  POWERTABLE_PATTERN,
  POWERTABLE_RESOURCES,
  SESSION_CU_HOURS,
  type GuideBlock,
  type GuideSection,
} from '../content/powertable';
import { Badge, CategoryChip, EmptyState } from '../components/ui';
import { UpdateCard } from '../components/UpdateCard';
import { useRoadmap, useUpdates } from '../lib/api';
import { formatNumber, quarterLabel } from '../lib/format';
import { byRecency } from '../lib/stats';

const ICONS: Record<string, LucideIcon> = {
  Lightbulb,
  Target,
  ListChecks,
  Wallet,
  Rocket,
  GitFork,
  Database,
  PencilLine,
  ShieldCheck,
  Zap,
  LayoutGrid,
  Workflow,
  Gauge,
  TriangleAlert,
  Route,
};

const EXTRA_TOC = [
  { id: 'checklist', title: 'Checklist de puesta en marcha' },
  { id: 'faq', title: 'Preguntas frecuentes' },
  { id: 'recursos', title: 'Recursos oficiales' },
];

/* ------------------------------------------------------------------ */
/* Bloques de contenido                                                */
/* ------------------------------------------------------------------ */

function Callout({ tone, title, text }: { tone: 'tip' | 'warning' | 'info'; title: string; text: string }) {
  const styles = {
    tip: { box: 'border-brand/30 bg-brand-soft', icon: Lightbulb, iconCls: 'text-brand-ink', label: 'Consejo' },
    warning: {
      box: 'border-amber-300/60 bg-amber-50/70 dark:border-amber-400/25 dark:bg-amber-400/5',
      icon: TriangleAlert,
      iconCls: 'text-amber-600 dark:text-amber-300',
      label: 'Atención',
    },
    info: {
      box: 'border-blue-200 bg-blue-50/60 dark:border-blue-400/25 dark:bg-blue-500/5',
      icon: Info,
      iconCls: 'text-blue-600 dark:text-blue-300',
      label: 'Importante',
    },
  }[tone];
  return (
    <div className={clsx('rounded-2xl border p-4 sm:p-5', styles.box)} role="note">
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-fg">
        <styles.icon className={clsx('size-4', styles.iconCls)} />
        <span className="sr-only">{styles.label}: </span>
        {title}
      </div>
      <p className="text-sm leading-relaxed text-fg-muted">{text}</p>
    </div>
  );
}

function CostCalculator() {
  const [planners, setPlanners] = useState(1);
  const [stakeholders, setStakeholders] = useState(8);
  const [viewers, setViewers] = useState(30);
  const cuHours = planners * SESSION_CU_HOURS.planner + stakeholders * SESSION_CU_HOURS.stakeholder + viewers * SESSION_CU_HOURS.viewer;
  const avgCu = cuHours / HOURS_PER_SESSION;
  const withBuffer = avgCu * 1.3;
  const sku = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].find((n) => n >= withBuffer) ?? 2048;
  const field = (label: string, hint: string, value: number, set: (n: number) => void) => (
    <label className="block">
      <span className="text-sm font-medium text-fg">{label}</span>
      <span className="block text-xs text-fg-subtle">{hint}</span>
      <input
        type="number"
        min={0}
        max={100000}
        value={value}
        onChange={(e) => set(Math.max(0, Math.min(100000, Number(e.target.value) || 0)))}
        className="tabular mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
      />
    </label>
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-fg">
        <Calculator className="size-4 text-brand" /> Calculadora orientativa de capacidad
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-1">
          {field('Planners', 'Diseñan modelos de planificación', planners, setPlanners)}
          {field('Stakeholders', 'Crean apps, introducen y aprueban datos', stakeholders, setStakeholders)}
          {field('Viewers', 'Solo consultan', viewers, setViewers)}
        </div>
        <div className="rounded-2xl bg-ink p-5 text-white">
          <div className="text-xs uppercase tracking-[0.12em] text-white/50">Consumo mensual estimado</div>
          <div className="tabular mt-1 text-3xl font-semibold">{formatNumber(Math.round(cuHours))} CU-hora</div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/[0.06] p-3">
              <dt className="text-[0.7rem] text-white/55">CU medias necesarias</dt>
              <dd className="tabular mt-0.5 font-semibold">{avgCu.toFixed(1)} CU</dd>
            </div>
            <div className="rounded-xl bg-white/[0.06] p-3">
              <dt className="text-[0.7rem] text-white/55">Con margen del 30 %</dt>
              <dd className="tabular mt-0.5 font-semibold">{withBuffer.toFixed(1)} CU</dd>
            </div>
          </dl>
          <div className="mt-4 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
            <div className="text-[0.7rem] text-white/60">Capacidad mínima orientativa solo para Planning</div>
            <div className="text-xl font-semibold text-[#4ade80]">F{sku}</div>
          </div>
          <p className="mt-3 text-[0.72rem] leading-relaxed text-white/50">
            Cálculo: sesiones de 30 días (Planner 847, Stakeholder 168 y Viewer 37 CU-hora) entre 730 horas, más un 30 % para Fabric SQL, OneLake y
            XMLA. No incluye otras cargas que compartan la capacidad ni las automatizaciones. Confírmalo con el estimador oficial.
          </p>
        </div>
      </div>
    </div>
  );
}

function Block({ b }: { b: GuideBlock }) {
  switch (b.kind) {
    case 'p':
      return <p className="text-[0.97rem] leading-relaxed text-fg-muted">{b.text}</p>;
    case 'list':
      return (
        <ul className="space-y-2.5">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed text-fg-muted">
              <Check className="mt-1 size-4 shrink-0 text-brand" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case 'steps':
      return (
        <ol className="relative space-y-0">
          {b.items.map((s, i) => (
            <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {i < b.items.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-line" aria-hidden="true" />}
              <span className="tabular z-10 grid size-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-brand ring-4 ring-bg">
                {i + 1}
              </span>
              <div className="pt-1">
                <div className="font-semibold text-fg">{s.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-surface-2 text-xs text-fg-subtle">
              <tr>
                {b.columns.map((c) => (
                  <th key={c} className="px-4 py-2.5 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {b.rows.map((r, i) => (
                <tr key={i} className="align-top">
                  {r.map((cell, j) => (
                    <td key={j} className={clsx('px-4 py-3 leading-relaxed', j === 0 ? 'font-medium text-fg' : 'text-fg-muted')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'callout':
      return <Callout tone={b.tone} title={b.title} text={b.text} />;
    case 'cards':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {b.items.map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/30">
              <div className="mb-1 text-sm font-semibold text-fg">{c.title}</div>
              <p className="text-sm leading-relaxed text-fg-muted">{c.text}</p>
            </div>
          ))}
        </div>
      );
    case 'calc':
      return <CostCalculator />;
    case 'sources':
      return (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-fg-subtle">Fuentes oficiales:</span>
          {b.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-fg-muted transition hover:border-brand/40 hover:text-fg"
            >
              {l.label} <ExternalLink className="size-3" />
            </a>
          ))}
        </div>
      );
  }
}

function Section({ s, index }: { s: GuideSection; index: number }) {
  const Icon = ICONS[s.icon] ?? Lightbulb;
  return (
    <section id={s.id} className="scroll-mt-24">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-brand ring-1 ring-ink-line">
          <Icon className="size-5" />
        </span>
        <div>
          <div className="tabular text-xs font-semibold text-fg-subtle">{String(index + 1).padStart(2, '0')}</div>
          <h2 className="text-xl font-semibold tracking-tight text-fg">{s.title}</h2>
          <p className="mt-0.5 text-sm text-fg-muted">{s.summary}</p>
        </div>
      </div>
      <div className="space-y-4">
        {s.blocks.map((b, i) => (
          <Block key={i} b={b} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Checklist interactiva (se recuerda en este navegador)               */
/* ------------------------------------------------------------------ */

const CHECK_KEY = 'fr-powertable-checklist';

function Checklist() {
  const all = POWERTABLE_CHECKLIST.flatMap((g) => g.items);
  const [done, setDone] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CHECK_KEY) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(CHECK_KEY, JSON.stringify([...done]));
    } catch {
      /* almacenamiento no disponible: el progreso solo dura la sesión */
    }
  }, [done]);
  const toggle = (item: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  const pct = Math.round((done.size / all.length) * 100);
  return (
    <section id="checklist" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-fg">Checklist de puesta en marcha</h2>
          <p className="mt-0.5 text-sm text-fg-muted">Marca cada punto a medida que lo completes. El progreso se guarda en este navegador.</p>
        </div>
        <button
          onClick={() => setDone(new Set())}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <RotateCcw className="size-3.5" /> Reiniciar
        </button>
      </div>
      <div className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <motion.div className="h-full rounded-full bg-brand" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
          </div>
          <span className="tabular text-sm font-semibold text-fg">
            {done.size}/{all.length}
          </span>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {POWERTABLE_CHECKLIST.map((g) => (
            <div key={g.group}>
              <div className="eyebrow mb-2">{g.group}</div>
              <ul className="space-y-1.5">
                {g.items.map((item) => {
                  const checked = done.has(item);
                  return (
                    <li key={item}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-surface-2">
                        <input type="checkbox" checked={checked} onChange={() => toggle(item)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                        <span className={clsx('text-sm leading-snug', checked ? 'text-fg-subtle line-through' : 'text-fg')}>{item}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-24">
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-fg">Preguntas frecuentes</h2>
      <div className="card divide-y divide-line">
        {POWERTABLE_FAQ.map((f, i) => (
          <div key={f.q}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-2"
            >
              <span className="font-medium text-fg">{f.q}</span>
              <ChevronDown className={clsx('size-4 shrink-0 text-fg-subtle transition-transform', open === i && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <p className="px-5 pb-4 text-sm leading-relaxed text-fg-muted">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function PowerTable() {
  const updates = useUpdates();
  const roadmap = useRoadmap();
  const [active, setActive] = useState(POWERTABLE_GUIDE[0]!.id);

  const news = useMemo(
    () =>
      (updates.data ?? [])
        .filter((u) => POWERTABLE_PATTERN.test(`${u.titleOriginal} ${u.titleEs ?? ''} ${u.excerptOriginal}`))
        .sort(byRecency),
    [updates.data],
  );
  const roadmapItems = useMemo(
    () =>
      (roadmap.data ?? [])
        .filter((r) => !r.removedFromSource && POWERTABLE_PATTERN.test(`${r.name} ${r.description}`))
        .sort((a, b) => (b.releaseQuarterStart ?? '').localeCompare(a.releaseQuarterStart ?? '')),
    [roadmap.data],
  );

  const toc = [...POWERTABLE_GUIDE.map((s) => ({ id: s.id, title: s.title })), ...EXTRA_TOC];

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    toc.forEach((t) => {
      const el = document.getElementById(t.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-10">
      {/* Cabecera */}
      <section className="hero-glow relative overflow-hidden rounded-[1.5rem] text-white ring-1 ring-white/10">
        <div className="grid-pattern absolute inset-0 [mask-image:radial-gradient(70%_80%_at_70%_20%,black,transparent)]" />
        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
            <Table2 className="size-3.5 text-[#4ade80]" /> Sección especial · Guía completa en español
          </div>
          <h1 className="max-w-3xl text-[1.9rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.6rem]">
            PowerTable en Microsoft Fabric: <span className="text-gradient">de cero a producción.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-white/70">
            Qué es, cuánto cuesta, cómo crear tu primera app paso a paso y cómo implantarlo bien: seguridad, aprobaciones, automatizaciones, límites y errores a
            evitar. Basado en la documentación oficial de Microsoft, con enlaces a cada fuente.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {POWERTABLE_FACTS.map((f) => (
              <span key={f} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/80">
                {f}
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => go('primeros-pasos')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#22c55e] px-4 py-2.5 text-sm font-semibold text-[#052e14] shadow-[0_10px_30px_-10px_rgba(34,197,94,0.8)] transition hover:bg-[#4ade80]"
            >
              Crear mi primera app <ArrowRight className="size-4" />
            </button>
            <button
              onClick={() => go('que-es')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Leer la guía desde el principio
            </button>
          </div>
        </div>
      </section>

      {/* Novedades en vivo */}
      <section aria-labelledby="pt-news">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand">
              <Sparkles className="size-3.5" /> Actualizado automáticamente
            </div>
            <h2 id="pt-news" className="text-xl font-semibold tracking-tight text-fg">
              Novedades de PowerTable y Planning
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted">
              Detectadas en las fuentes oficiales en cada ejecución: {formatNumber(news.length)} novedades y {formatNumber(roadmapItems.length)} elementos del
              roadmap.
            </p>
          </div>
          <Link to="/historico?q=powertable" className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">
            Buscar en el histórico <ArrowRight className="size-4" />
          </Link>
        </div>
        {updates.isLoading ? null : news.length === 0 ? (
          <EmptyState title="Aún no hay novedades específicas" description="En cuanto Microsoft publique novedades de PowerTable o Planning aparecerán aquí automáticamente." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {news.slice(0, 6).map((u, i) => (
              <UpdateCard key={u.id} u={u} index={i} />
            ))}
          </div>
        )}
        {roadmapItems.length > 0 && (
          <div className="card mt-4 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
              <MapIcon className="size-4 text-brand" /> En el roadmap oficial
            </div>
            <ul className="divide-y divide-line">
              {roadmapItems.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link to={`/roadmap?item=${r.id}`} className="flex flex-wrap items-center gap-2 py-2.5 hover:text-brand-ink">
                    <Badge tone={r.releaseType === 'ga' ? 'brand' : 'blue'}>{r.releaseType === 'ga' ? 'GA' : 'Preview'}</Badge>
                    <Badge tone={r.releaseStatus === 'shipped' ? 'neutral' : 'amber'}>{r.releaseStatus === 'shipped' ? 'Entregada' : 'Planificada'}</Badge>
                    <span className="min-w-0 flex-1 text-sm text-fg">{r.nameEs ?? r.name}</span>
                    <span className="tabular text-xs text-fg-subtle">{quarterLabel(r.releaseDate)}</span>
                    <CategoryChip id={r.category} link={false} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Guía */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Índice de la guía" className="card hidden p-3 lg:block">
            <div className="eyebrow mb-2 flex items-center gap-1.5 px-2">
              <BookOpen className="size-3.5" /> Índice de la guía
            </div>
            <ol className="space-y-0.5">
              {toc.map((t, i) => (
                <li key={t.id}>
                  <button
                    onClick={() => go(t.id)}
                    className={clsx(
                      'flex w-full gap-2 rounded-lg px-2 py-1.5 text-left text-[0.83rem] transition',
                      active === t.id ? 'bg-brand-soft font-medium text-brand-ink' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    <span className="tabular w-5 shrink-0 text-fg-subtle">{i + 1}</span>
                    <span>{t.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
            {toc.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted"
              >
                {t.title}
              </button>
            ))}
          </div>
        </aside>
        <div className="min-w-0 space-y-14">
          {POWERTABLE_GUIDE.map((s, i) => (
            <Section key={s.id} s={s} index={i} />
          ))}
          <Checklist />
          <Faq />
          <section id="recursos" className="scroll-mt-24">
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-fg">Recursos oficiales</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {POWERTABLE_RESOURCES.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card card-hover group flex items-start justify-between gap-3 p-4"
                >
                  <span>
                    <span className="block text-sm font-semibold text-fg group-hover:text-brand-ink">{r.label}</span>
                    <span className="block text-xs text-fg-muted">{r.note}</span>
                  </span>
                  <ExternalLink className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                </a>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
              Guía elaborada a partir de la documentación oficial de Microsoft Learn (consultada en noviembre de 2026). Las capacidades, precios y límites pueden
              cambiar: revisa siempre la fuente enlazada antes de tomar decisiones.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
