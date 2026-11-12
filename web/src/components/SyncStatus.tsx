import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { nextScheduledRun, previousScheduledRun, RUN_GRACE_MINUTES } from '../../../shared/schedule';
import type { SystemStatus } from '../../../shared/types';
import { useStatus } from '../lib/api';
import { formatDateTime, formatRelative } from '../lib/format';

export type SyncHealth = 'ok' | 'degraded' | 'failing' | 'stale' | 'unknown';

export interface SyncInfo {
  health: SyncHealth;
  label: string;
  detail: string;
  status: SystemStatus | null;
  next: Date;
  overdue: boolean;
}

/**
 * Calcula el estado de sincronización mostrado al usuario. Se considera "retrasada" si la
 * última ejecución registrada es anterior a la última programada (más un margen): así nunca
 * se muestra como al día una plataforma cuyo proceso dejó de ejecutarse o falló sin registrarse.
 */
export function computeSync(status: SystemStatus | null, now = new Date()): SyncInfo {
  const next = nextScheduledRun(now);
  if (!status?.lastRun) {
    return { health: 'unknown', label: 'Sin ejecuciones', detail: 'Aún no hay ejecuciones registradas.', status, next, overdue: false };
  }
  const prev = previousScheduledRun(now);
  const lastAttempt = Date.parse(status.lastAttemptAt ?? status.lastRun.startedAt);
  const overdue = now.getTime() - prev.getTime() > RUN_GRACE_MINUTES * 60_000 && lastAttempt < prev.getTime() - 5 * 60_000;
  const run = status.lastRun;
  if (run.status === 'failed') {
    return {
      health: 'failing',
      label: 'Última consulta fallida',
      detail: `La ejecución del ${formatDateTime(run.startedAt)} falló. Última actualización correcta: ${formatDateTime(status.lastSuccessfulRunAt)}.`,
      status,
      next,
      overdue,
    };
  }
  if (overdue) {
    return {
      health: 'stale',
      label: 'Actualización retrasada',
      detail: `La ejecución programada de las ${formatDateTime(prev.toISOString())} no se ha registrado todavía (puede estar en curso o retrasada por GitHub Actions).`,
      status,
      next,
      overdue,
    };
  }
  if (run.status === 'partial') {
    return {
      health: 'degraded',
      label: 'Actualizada con incidencias',
      detail: `Última consulta ${formatRelative(run.finishedAt)} con incidencias en alguna fuente o en la traducción.`,
      status,
      next,
      overdue,
    };
  }
  return { health: 'ok', label: 'Al día', detail: `Última consulta correcta ${formatRelative(run.finishedAt)}.`, status, next, overdue };
}

export function useSync(): SyncInfo & { isLoading: boolean; isError: boolean } {
  const q = useStatus();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const info = computeSync(q.data?.status ?? null, now);
  return { ...info, isLoading: q.isLoading, isError: q.isError };
}

export const HEALTH_COLOR: Record<SyncHealth, string> = {
  ok: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  stale: 'bg-amber-500',
  failing: 'bg-red-500',
  unknown: 'bg-zinc-400',
};

export function PulseDot({ health, className }: { health: SyncHealth; className?: string }) {
  return (
    <span className={clsx('relative inline-flex size-2.5', className)} aria-hidden="true">
      {health === 'ok' && <span className={clsx('absolute inset-0 rounded-full animate-pulse-ring', HEALTH_COLOR[health])} />}
      <span className={clsx('relative inline-flex size-2.5 rounded-full', HEALTH_COLOR[health])} />
    </span>
  );
}

export function SyncPill() {
  const sync = useSync();
  if (sync.isLoading) return <div className="skeleton hidden h-8 w-56 rounded-full md:block" />;
  const last = sync.status?.lastRun?.finishedAt;
  return (
    <Link
      to="/estado"
      title={sync.detail}
      className="hidden items-center gap-2.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-fg-muted transition hover:border-line-strong hover:text-fg md:inline-flex"
    >
      <PulseDot health={sync.isError ? 'unknown' : sync.health} />
      <span className="font-medium text-fg">{sync.isError ? 'Estado no disponible' : sync.label}</span>
      {last && <span className="hidden lg:inline">· consulta {formatRelative(last)}</span>}
      <span className="hidden xl:inline">· próxima {formatRelative(sync.next.toISOString())}</span>
    </Link>
  );
}
