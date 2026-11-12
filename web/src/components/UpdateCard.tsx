import clsx from 'clsx';
import { ArrowUpRight, CalendarDays, Radar, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import type { UpdateSummary } from '../../../shared/types';
import { formatDate, formatPublished, formatRelative } from '../lib/format';
import { SOURCE_SHORT, TYPE_SHORT } from '../lib/labels';
import { AiBadge, Badge, CategoryChip, ImpactRing, StageBadge } from './ui';

export function displayTitle(u: Pick<UpdateSummary, 'titleEs' | 'titleOriginal'>): string {
  return u.titleEs ?? u.titleOriginal;
}

export function displaySummary(u: UpdateSummary): string {
  return u.summaryEs ?? u.excerptOriginal;
}

export function DateMeta({ u, compact = false }: { u: UpdateSummary; compact?: boolean }) {
  const published = u.undated ? 'Sin fecha oficial' : formatPublished(u.publishedAt, u.datePrecision);
  return (
    <div className={clsx('flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] text-fg-subtle', compact && 'gap-x-2')}>
      <span className="inline-flex items-center gap-1" title="Fecha de publicación original">
        <CalendarDays className="size-3" />
        <span className="tabular">{published}</span>
      </span>
      <span className="inline-flex items-center gap-1" title={`Detectada por la plataforma: ${formatDate(u.detectedAt, "d MMM yyyy, HH:mm")}`}>
        <Radar className="size-3" />
        <span className="tabular">Detectada {formatRelative(u.detectedAt)}</span>
      </span>
    </div>
  );
}

export function UpdateCard({ u, index = 0 }: { u: UpdateSummary; index?: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.035, ease: [0.2, 0.7, 0.2, 1] }}
      className="group relative"
    >
      <Link
        to={`/novedad/${u.id}`}
        className="card card-hover flex h-full flex-col p-5 outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryChip id={u.primaryCategory} link={false} />
            <StageBadge stage={u.stage} />
            {u.transformative && (
              <Badge tone="dark">
                <Sparkles className="size-3 text-brand" /> Transformadora
              </Badge>
            )}
          </div>
          <ImpactRing score={u.impactScore} size={36} />
        </div>
        <h3 className="line-clamp-3 text-[1rem] font-semibold leading-snug tracking-tight text-fg group-hover:text-brand-ink">
          {displayTitle(u)}
        </h3>
        {u.titleEs && u.titleEs !== u.titleOriginal && (
          <p className="mt-1 line-clamp-1 text-xs text-fg-subtle" lang="en">
            {u.titleOriginal}
          </p>
        )}
        <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-fg-muted" lang={u.summaryEs ? 'es' : u.originalLanguage}>
          {displaySummary(u)}
        </p>
        <div className="mt-auto pt-4">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <Badge>{TYPE_SHORT[u.type]}</Badge>
            <Badge>{SOURCE_SHORT[u.source]}</Badge>
            <AiBadge status={u.aiStatus} original={u.originalLanguage} />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <DateMeta u={u} compact />
            <ArrowUpRight className="size-4 shrink-0 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export function UpdateRow({ u, rank, showImpact = true }: { u: UpdateSummary; rank?: number; showImpact?: boolean }) {
  return (
    <Link
      to={`/novedad/${u.id}`}
      className="group flex items-start gap-3.5 rounded-xl px-3 py-3 transition hover:bg-surface-2 focus-visible:bg-surface-2"
    >
      {rank !== undefined && (
        <span className="tabular mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-semibold text-fg-muted group-hover:bg-brand-soft group-hover:text-brand-ink">
          {rank}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <CategoryChip id={u.primaryCategory} link={false} />
          <StageBadge stage={u.stage} />
          <AiBadge status={u.aiStatus} original={u.originalLanguage} />
        </div>
        <p className="line-clamp-2 text-[0.92rem] font-medium leading-snug text-fg group-hover:text-brand-ink">{displayTitle(u)}</p>
        <div className="mt-1.5">
          <DateMeta u={u} compact />
        </div>
      </div>
      {showImpact && <ImpactRing score={u.impactScore} size={34} />}
    </Link>
  );
}

export function UpdateGrid({ items }: { items: UpdateSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((u, i) => (
        <UpdateCard key={u.id} u={u} index={i} />
      ))}
    </div>
  );
}
