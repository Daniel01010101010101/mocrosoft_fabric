import clsx from 'clsx';
import { AlertTriangle, Inbox, Languages, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_BY_ID, type CategoryId } from '../../../shared/categories';
import type { AiStatus, Stage } from '../../../shared/types';
import { CATEGORY_ICON, STAGE_SHORT } from '../lib/labels';

export function Card({ className, children, hover = false }: { className?: string; children: ReactNode; hover?: boolean }) {
  return <div className={clsx('card', hover && 'card-hover', className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
      className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between"
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand">
            {Icon && <Icon className="size-3.5" />}
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[1.05rem] font-semibold tracking-tight text-balance text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BadgeTone = 'neutral' | 'brand' | 'blue' | 'amber' | 'red' | 'violet' | 'dark';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-muted ring-line',
  brand: 'bg-brand-soft text-brand-ink ring-brand/25',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/25',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25',
  red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/25',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/25',
  dark: 'bg-ink text-ink-fg ring-ink-line',
};

export function Badge({ tone = 'neutral', children, className, title }: { tone?: BadgeTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  if (stage === 'none') return null;
  const tone: BadgeTone = stage === 'ga' ? 'brand' : stage === 'preview' ? 'blue' : 'amber';
  return (
    <Badge tone={tone}>
      <span className={clsx('size-1.5 rounded-full', stage === 'ga' ? 'bg-viz-ga' : stage === 'preview' ? 'bg-viz-preview' : 'bg-amber-500')} />
      {STAGE_SHORT[stage]}
    </Badge>
  );
}

export function CategoryChip({ id, link = true, size = 'sm' }: { id: CategoryId; link?: boolean; size?: 'sm' | 'md' }) {
  const Icon = CATEGORY_ICON[id];
  const cat = CATEGORY_BY_ID[id];
  const cls = clsx(
    'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface font-medium text-fg-muted transition-colors',
    size === 'sm' ? 'px-2 py-0.5 text-[0.72rem]' : 'px-3 py-1 text-sm',
    link && 'hover:border-brand/40 hover:text-fg',
  );
  const content = (
    <>
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      {cat?.name ?? id}
    </>
  );
  return link ? (
    <Link to={`/categorias/${id}`} className={cls} onClick={(e) => e.stopPropagation()}>
      {content}
    </Link>
  ) : (
    <span className={cls}>{content}</span>
  );
}

export function AiBadge({ status, original }: { status: AiStatus; original?: string }) {
  if (status === 'done') return null;
  return (
    <Badge tone={status === 'error' ? 'red' : 'amber'} title="El texto se muestra en su idioma original hasta que se complete la traducción automática.">
      <Languages className="size-3" />
      {status === 'error' ? 'Error de traducción' : `Traducción pendiente${original === 'en' ? ' · EN' : ''}`}
    </Badge>
  );
}

export function ImpactRing({ score, size = 44, label = true }: { score: number; size?: number; label?: boolean }) {
  const stroke = size > 40 ? 4 : 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const tone = score >= 70 ? 'var(--brand)' : score >= 45 ? '#84cc16' : 'var(--fg-subtle)';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`Impacto ${score}/100`} aria-label={`Impacto ${score} de 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </svg>
      {label && (
        <span className="tabular absolute inset-0 grid place-items-center text-[0.72rem] font-semibold text-fg">{score}</span>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden="true" />;
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Cargando novedades">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3 p-5">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function PageLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center text-fg-muted" role="status">
      <div className="flex items-center gap-3 text-sm">
        <Loader2 className="size-5 animate-spin text-brand" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-2 text-fg-subtle">
        <Inbox className="size-6" />
      </div>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'No se pudieron cargar los datos' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const message = error instanceof Error ? error.message : 'Se produjo un error inesperado.';
  return (
    <div className="card flex flex-col items-center border-red-200 px-6 py-12 text-center dark:border-red-500/20" role="alert">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-fg-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-ink-fg transition hover:bg-ink-3 dark:bg-surface-3"
        >
          <RefreshCw className="size-4" /> Reintentar
        </button>
      )}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  ariaLabel: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="relative inline-flex rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              'relative z-10 whitespace-nowrap rounded-lg font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${ariaLabel}`}
                className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-card ring-1 ring-line"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ButtonLink({ to, children, variant = 'ghost', className }: { to: string; children: ReactNode; variant?: 'ghost' | 'solid'; className?: string }) {
  return (
    <Link
      to={to}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition',
        variant === 'solid'
          ? 'bg-ink text-ink-fg hover:bg-ink-3 dark:bg-brand dark:text-ink dark:hover:bg-brand-strong'
          : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function ExternalLinkButton({ href, children, variant = 'outline' }: { href: string; children: ReactNode; variant?: 'outline' | 'solid' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition',
        variant === 'solid'
          ? 'bg-brand text-white shadow-[0_8px_24px_-8px_var(--brand-glow)] hover:bg-brand-strong dark:text-ink'
          : 'border border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2',
      )}
    >
      {children}
    </a>
  );
}
