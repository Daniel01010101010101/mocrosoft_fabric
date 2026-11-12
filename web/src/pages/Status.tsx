import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  Fingerprint,
  History,
  Languages,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  XCircle,
  CalendarClock,
  DatabaseZap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { SCHEDULE } from '../../../shared/schedule';
import { SOURCES, type RunRecord, type RunStatus, type SourceRunResult } from '../../../shared/types';
import { PulseDot, useSync } from '../components/SyncStatus';
import { Badge, EmptyState, ErrorState, PageHeader, PageLoader } from '../components/ui';
import { useStatus } from '../lib/api';
import { formatDateTime, formatDuration, formatNumber, formatRelative } from '../lib/format';

const RUN_STATUS: Record<RunStatus, { label: string; tone: 'brand' | 'amber' | 'red' }> = {
  success: { label: 'Correcta', tone: 'brand' },
  partial: { label: 'Con incidencias', tone: 'amber' },
  failed: { label: 'Fallida', tone: 'red' },
};

const SOURCE_STATUS: Record<SourceRunResult['status'], { label: string; icon: typeof CheckCircle2; cls: string }> = {
  ok: { label: 'Correcta', icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
  'not-modified': { label: 'Sin cambios (304)', icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
  error: { label: 'Error', icon: XCircle, cls: 'text-red-600 dark:text-red-400' },
};

const TRIGGER: Record<RunRecord['trigger'], string> = {
  schedule: 'Programada',
  manual: 'Manual',
  local: 'Local',
  retry: 'Reintento',
};

function Countdown({ to }: { to: Date }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, to.getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <span className="tabular">
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Clock; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-fg-muted">
        <Icon className="size-4 text-fg-subtle" /> {label}
      </div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-fg">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-fg-subtle">{sub}</div>}
    </div>
  );
}

export default function Status() {
  const q = useStatus();
  const sync = useSync();
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <PageLoader label="Cargando el estado del sistema…" />;
  const status = q.data?.status ?? null;
  const runs = q.data?.runs ?? [];
  const last = status?.lastRun ?? null;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div>
      <PageHeader
        eyebrow="Control de actualizaciones y trazabilidad"
        icon={ServerCog}
        title="Estado del sistema"
        description="Cada ejecución automática queda registrada: cuándo se consultaron las fuentes, qué se encontró y qué errores hubo. Una ejecución solo se marca como correcta si todas las fuentes respondieron sin errores."
        actions={
          <button onClick={() => q.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-fg-muted hover:text-fg">
            <RefreshCw className={clsx('size-4', q.isFetching && 'animate-spin')} /> Actualizar
          </button>
        }
      />

      <div
        className={clsx(
          'card mb-6 flex flex-col gap-3 border-l-4 p-5 sm:flex-row sm:items-center',
          sync.health === 'ok' && 'border-l-emerald-500',
          (sync.health === 'degraded' || sync.health === 'stale') && 'border-l-amber-500',
          sync.health === 'failing' && 'border-l-red-500',
          sync.health === 'unknown' && 'border-l-zinc-400',
        )}
        role="status"
      >
        <PulseDot health={sync.health} className="mt-1 self-start sm:mt-0 sm:self-center" />
        <div className="flex-1">
          <div className="font-semibold text-fg">{sync.label}</div>
          <p className="text-sm text-fg-muted">{sync.detail}</p>
        </div>
        {last?.workflowRunUrl && (
          <a href={last.workflowRunUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline">
            Ver ejecución en GitHub Actions <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {!status ? (
        <EmptyState title="Aún no hay ejecuciones registradas" description="La primera ejecución programada poblará la base de datos y este panel." />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Stat icon={CheckCircle2} label="Última actualización exitosa" value={formatDateTime(status.lastSuccessfulRunAt)} sub={formatRelative(status.lastSuccessfulRunAt)} />
            <Stat icon={Clock} label="Última consulta" value={formatDateTime(last?.startedAt)} sub={last ? `Duración ${formatDuration(last.durationMs)}` : undefined} />
            <Stat icon={CalendarClock} label="Próxima ejecución" value={formatDateTime(sync.next.toISOString())} sub={<>En <Countdown to={sync.next} /></>} />
            <Stat
              icon={ServerCog}
              label="Estado del proceso"
              value={last ? <Badge tone={RUN_STATUS[last.status].tone}>{RUN_STATUS[last.status].label}</Badge> : '—'}
              sub={status.consecutiveFailures > 0 ? `${status.consecutiveFailures} fallo(s) consecutivo(s)` : 'Sin fallos consecutivos'}
            />
            <Stat
              icon={DatabaseZap}
              label="Encontradas (última)"
              value={last ? `${formatNumber(last.totals.newUpdates)} nuevas` : '—'}
              sub={last ? `${formatNumber(last.totals.updatedUpdates)} actualizadas · ${formatNumber(last.totals.newRoadmap)} roadmap` : undefined}
            />
            <Stat
              icon={AlertTriangle}
              label="Errores (última)"
              value={last ? formatNumber(last.issues.filter((i) => i.level === 'error').length) : '—'}
              sub={last ? `${last.issues.filter((i) => i.level === 'warning').length} avisos` : undefined}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <section className="card overflow-hidden">
              <div className="border-b border-line p-5">
                <h2 className="font-semibold text-fg">Fuentes consultadas en la última ejecución</h2>
                <p className="text-xs text-fg-muted">Fuentes oficiales de Microsoft. Cada consulta se reintenta automáticamente hasta 3 veces ante errores transitorios.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-surface-2 text-xs text-fg-subtle">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Fuente</th>
                      <th className="px-3 py-2.5 font-medium">Estado</th>
                      <th className="px-3 py-2.5 text-right font-medium">Consultadas</th>
                      <th className="px-3 py-2.5 text-right font-medium">Nuevas</th>
                      <th className="px-3 py-2.5 text-right font-medium">Actualizadas</th>
                      <th className="px-3 py-2.5 text-right font-medium">Descartadas</th>
                      <th className="px-5 py-2.5 text-right font-medium">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody className="tabular divide-y divide-line">
                    {(last?.sources ?? []).map((s) => {
                      const st = SOURCE_STATUS[s.status];
                      return (
                        <tr key={s.source} className="align-top">
                          <td className="min-w-[220px] px-5 py-3">
                            <a href={SOURCES[s.source].url} target="_blank" rel="noopener noreferrer" className="font-medium text-fg hover:text-brand-ink">
                              {SOURCES[s.source].name}
                            </a>
                            {s.error && <div className="mt-1 max-w-md text-xs text-red-600 dark:text-red-400">{s.error}</div>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium', st.cls)}>
                              <st.icon className="size-3.5" /> {st.label}
                            </span>
                            {s.attempts > 1 && <div className="text-[0.7rem] text-fg-subtle">con reintentos ({s.attempts} intentos)</div>}
                          </td>
                          <td className="px-3 py-3 text-right">{formatNumber(s.fetched)}</td>
                          <td className="px-3 py-3 text-right font-semibold text-fg">{formatNumber(s.created)}</td>
                          <td className="px-3 py-3 text-right">{formatNumber(s.updated)}</td>
                          <td className="px-3 py-3 text-right">{formatNumber(s.rejected)}</td>
                          <td className="whitespace-nowrap px-5 py-3 text-right text-fg-muted">{formatDuration(s.durationMs)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card p-5">
              <h2 className="mb-1 font-semibold text-fg">Programación automática</h2>
              <p className="mb-4 text-xs text-fg-muted">
                5 ejecuciones diarias con GitHub Actions, sin depender de que nadie abra la página. Horas mostradas en tu zona horaria ({tz}).
              </p>
              <ol className="space-y-2">
                {SCHEDULE.map((s) => {
                  const d = new Date();
                  d.setUTCHours(s.hourUtc, s.minuteUtc, 0, 0);
                  const isNext = sync.next.getUTCHours() === s.hourUtc && sync.next.getUTCMinutes() === s.minuteUtc;
                  return (
                    <li key={s.cron} className={clsx('flex items-start gap-3 rounded-xl border p-3', isNext ? 'border-brand/40 bg-brand-soft' : 'border-line')}>
                      <span className="tabular w-14 shrink-0 text-sm font-semibold text-fg">
                        {d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-fg">
                          {s.label} {isNext && <Badge tone="brand">Próxima</Badge>}
                        </span>
                        <span className="block text-xs text-fg-muted">{s.rationale}</span>
                      </span>
                      <span className="tabular shrink-0 font-mono text-[0.7rem] text-fg-subtle">{String(s.hourUtc).padStart(2, '0')}:{String(s.minuteUtc).padStart(2, '0')} UTC</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-fg">
                <Languages className="size-4 text-brand" /> Traducción y análisis con IA
              </h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-fg-muted">Servicio</dt>
                  <dd className="mt-1 font-medium text-fg">{status.ai.configured ? 'Configurado' : 'Pendiente de configurar'}</dd>
                  <dd className="text-xs text-fg-subtle">{status.ai.model ?? 'Secreto ANTHROPIC_API_KEY no definido'}</dd>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-fg-muted">Novedades analizadas</dt>
                  <dd className="tabular mt-1 font-medium text-fg">
                    {formatNumber(status.counts.aiDoneUpdates)} / {formatNumber(status.counts.updates)}
                  </dd>
                  <dd className="text-xs text-fg-subtle">
                    {formatNumber(status.counts.aiPendingUpdates)} pendientes · {formatNumber(status.counts.aiErrorUpdates)} con error
                  </dd>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-fg-muted">Roadmap traducido</dt>
                  <dd className="tabular mt-1 font-medium text-fg">
                    {formatNumber(status.counts.aiDoneRoadmap)} / {formatNumber(status.counts.roadmap)}
                  </dd>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-fg-muted">Última ejecución</dt>
                  <dd className="tabular mt-1 font-medium text-fg">{last ? `${last.ai.succeeded} análisis · ${last.ai.roadmapTranslated} trad.` : '—'}</dd>
                  <dd className="tabular text-xs text-fg-subtle">{last ? `${formatNumber(last.ai.inputTokens + last.ai.outputTokens)} tokens` : ''}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-fg-muted">
                Las traducciones se guardan junto a un hash del contenido original: solo se regeneran si Microsoft modifica la publicación, nunca de forma repetida.
              </p>
            </section>
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-fg">
                <ShieldCheck className="size-4 text-brand" /> Garantías de calidad de los datos
              </h2>
              <ul className="space-y-2.5 text-sm text-fg-muted">
                <li className="flex gap-2.5">
                  <Fingerprint className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                  <span><strong className="font-medium text-fg">Identificador único</strong> por novedad (id oficial del mensaje o hash estable) y fusión de la misma publicación vista en varias fuentes: sin duplicados.</span>
                </li>
                <li className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                  <span><strong className="font-medium text-fg">Validación</strong>: se descartan registros sin título, sin fecha válida, sin contenido o sin un enlace a un dominio oficial de Microsoft.</span>
                </li>
                <li className="flex gap-2.5">
                  <History className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                  <span><strong className="font-medium text-fg">Histórico protegido</strong>: nada se borra. Lo que desaparece de una fuente se marca y se conserva, con la fecha original de publicación y todo el historial en Git.</span>
                </li>
                <li className="flex gap-2.5">
                  <RefreshCw className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                  <span><strong className="font-medium text-fg">Reintentos</strong>: cada consulta se reintenta con espera progresiva y, si la ejecución completa falla, el workflow la repite y registra el error.</span>
                </li>
                <li className="flex gap-2.5">
                  <Cpu className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                  <span><strong className="font-medium text-fg">Estado honesto</strong>: una ejecución solo es «correcta» si todas las fuentes respondieron. Si una ejecución no llega a registrarse, este panel la marca como retrasada.</span>
                </li>
              </ul>
            </section>
          </div>

          {last && last.issues.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold text-fg">Incidencias de la última ejecución</h2>
              <ul className="space-y-2">
                {last.issues.map((i, k) => (
                  <li key={k} className={clsx('flex gap-3 rounded-xl border p-3 text-sm', i.level === 'error' ? 'border-red-200 bg-red-50/60 dark:border-red-500/20 dark:bg-red-500/5' : 'border-amber-200 bg-amber-50/50 dark:border-amber-400/20 dark:bg-amber-400/5')}>
                    {i.level === 'error' ? <XCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />}
                    <span className="min-w-0 flex-1">
                      <span className="text-fg">{i.message}</span>
                      <span className="mt-0.5 block text-xs text-fg-subtle">
                        {i.level === 'error' ? 'Error' : 'Aviso'} · etapa {i.stage}
                        {i.source ? ` · ${SOURCES[i.source].name}` : ''} · {formatDateTime(i.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="border-b border-line p-5">
              <h2 className="font-semibold text-fg">Historial de ejecuciones</h2>
              <p className="text-xs text-fg-muted">Últimas {runs.length} ejecuciones registradas.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface-2 text-xs text-fg-subtle">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Inicio</th>
                    <th className="px-3 py-2.5 font-medium">Origen</th>
                    <th className="px-3 py-2.5 font-medium">Estado</th>
                    <th className="px-3 py-2.5 text-right font-medium">Duración</th>
                    <th className="px-3 py-2.5 text-right font-medium">Nuevas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Actualizadas</th>
                    <th className="px-3 py-2.5 text-right font-medium">IA</th>
                    <th className="px-3 py-2.5 text-right font-medium">Errores</th>
                    <th className="px-5 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-line">
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-2.5 text-fg">{formatDateTime(r.startedAt)}</td>
                      <td className="px-3 py-2.5 text-fg-muted">{TRIGGER[r.trigger]}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={RUN_STATUS[r.status].tone}>{RUN_STATUS[r.status].label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right text-fg-muted">{formatDuration(r.durationMs)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-fg">{r.totals.newUpdates}</td>
                      <td className="px-3 py-2.5 text-right text-fg-muted">{r.totals.updatedUpdates}</td>
                      <td className="px-3 py-2.5 text-right text-fg-muted">{r.ai.succeeded + r.ai.roadmapTranslated}</td>
                      <td className={clsx('px-3 py-2.5 text-right', r.issues.some((i) => i.level === 'error') ? 'font-medium text-red-600 dark:text-red-400' : 'text-fg-muted')}>
                        {r.issues.filter((i) => i.level === 'error').length}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {r.workflowRunUrl && (
                          <a href={r.workflowRunUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-ink hover:underline">
                            Registro
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
