import type { AiRunStats, RunIssue, RunRecord, RunStatus, RunTrigger, SourceRunResult, SystemStatus } from '../../shared/types';
import { enrich } from './ai/enrich';
import { DATA_DIR, loadConfig, type PipelineConfig } from './config';
import { linkDuplicates, markRemoved, markRoadmapRemoved, upsertRoadmap, upsertUpdate } from './core/ingest';
import { Store } from './core/store';
import { fetchAzureUpdates } from './sources/azureUpdates';
import { fetchWhatsNew } from './sources/learnWhatsNew';
import { fetchRoadmap } from './sources/roadmap';
import { fetchRssFeed, RSS_FEEDS } from './sources/rss';
import type { FetchContext, RawUpdate, SourceFetchResult } from './sources/types';

export interface RunOptions {
  trigger: RunTrigger;
  ai: boolean;
  dataDir?: string;
  config?: PipelineConfig;
  log?: (msg: string) => void;
}

function emptyAiStats(config: PipelineConfig): AiRunStats {
  return {
    configured: config.aiProvider !== 'none',
    provider: config.aiProvider,
    model: null,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    roadmapTranslated: 0,
    pendingUpdates: 0,
    pendingRoadmap: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

/** Estado global del run: éxito solo si TODAS las fuentes respondieron y no hubo errores. */
export function computeRunStatus(sources: SourceRunResult[], issues: RunIssue[]): RunStatus {
  const failedSources = sources.filter((s) => s.status === 'error').length;
  if (sources.length > 0 && failedSources === sources.length) return 'failed';
  if (issues.some((i) => i.level === 'error' && i.stage === 'store')) return 'failed';
  if (failedSources > 0) return 'partial';
  if (issues.some((i) => i.level === 'error')) return 'partial';
  return 'success';
}

export async function runPipeline(opts: RunOptions): Promise<RunRecord> {
  const config = opts.config ?? loadConfig();
  const dataDir = opts.dataDir ?? DATA_DIR;
  const log = opts.log ?? ((m: string) => console.log(m));
  const startedAt = new Date();
  const now = startedAt.toISOString();
  const issues: RunIssue[] = [];
  const sources: SourceRunResult[] = [];
  const totals = { newUpdates: 0, updatedUpdates: 0, newRoadmap: 0, changedRoadmap: 0, duplicatesLinked: 0 };

  const store = await Store.load(dataDir);
  log(`Base de datos cargada: ${store.updates.size} novedades, ${store.roadmap.size} elementos de roadmap.`);

  const newCache: FetchContext['httpCache'] = {};
  const ctx: FetchContext = {
    config,
    httpCache: store.httpCache,
    setCache: (url, entry) => {
      newCache[url] = entry;
    },
  };

  async function ingestUpdates(source: SourceRunResult['source'], fetcher: () => Promise<SourceFetchResult<RawUpdate>>) {
    const t0 = Date.now();
    const result: SourceRunResult = {
      source,
      status: 'ok',
      attempts: 0,
      durationMs: 0,
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      rejected: 0,
    };
    // Primera carga de una fuente: las novedades sin fecha en origen se marcan como "carga inicial"
    // para no presentarlas como publicadas hoy.
    const initialLoad = ![...store.updates.values()].some((u) => u.source === source);
    try {
      const res = await fetcher();
      result.attempts = res.attempts;
      result.fetched = res.items.length;
      if (res.notModified) result.status = 'not-modified';
      const seen = new Set<string>();
      for (const raw of res.items) {
        const r = upsertUpdate(store.updates, raw, now);
        seen.add(r.id);
        if (r.outcome === 'created') {
          result.created++;
          const created = store.updates.get(r.id);
          if (initialLoad && created && created.datePrecision === 'detected') created.meta = { ...created.meta, backfill: 'true' };
        } else if (r.outcome === 'updated') result.updated++;
        else if (r.outcome === 'unchanged') result.unchanged++;
        else {
          result.rejected++;
          if (result.rejected <= 5) {
            issues.push({ level: 'warning', stage: 'validate', source, message: `Registro descartado (${r.reason}): ${raw.title.slice(0, 120)}`, at: now });
          }
        }
      }
      if (source === 'learn-whats-new' && !res.notModified && res.items.length > 0) {
        markRemoved(store.updates, source, seen, now);
      }
      for (const e of res.partialErrors) issues.push({ level: 'warning', stage: 'fetch', source, message: e, at: now });
    } catch (err) {
      result.status = 'error';
      result.error = (err as Error).message;
      issues.push({ level: 'error', stage: 'fetch', source, message: result.error, at: new Date().toISOString() });
    }
    result.durationMs = Date.now() - t0;
    totals.newUpdates += result.created;
    totals.updatedUpdates += result.updated;
    sources.push(result);
    log(`· ${source}: ${result.status} — ${result.fetched} consultadas, ${result.created} nuevas, ${result.updated} actualizadas${result.error ? ` — ${result.error}` : ''}`);
  }

  /* ------------------------------ 1) Fuentes ------------------------------ */
  // El orden importa: los blogs primero para que Learn/Azure puedan vincularse a ellos.
  for (const feed of RSS_FEEDS) await ingestUpdates(feed.source, () => fetchRssFeed(feed, ctx));
  await ingestUpdates('learn-whats-new', () => fetchWhatsNew(ctx));
  await ingestUpdates('azure-updates', () => fetchAzureUpdates(ctx));

  {
    const t0 = Date.now();
    const result: SourceRunResult = {
      source: 'fabric-roadmap',
      status: 'ok',
      attempts: 0,
      durationMs: 0,
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      rejected: 0,
    };
    try {
      const res = await fetchRoadmap(ctx);
      result.attempts = res.attempts;
      result.fetched = res.items.length;
      const seen = new Set<string>();
      for (const raw of res.items) {
        const r = upsertRoadmap(store.roadmap, raw, now);
        seen.add(r.id);
        if (r.outcome === 'created') result.created++;
        else if (r.outcome === 'updated') result.updated++;
        else if (r.outcome === 'unchanged') result.unchanged++;
        else result.rejected++;
      }
      markRoadmapRemoved(store.roadmap, new Set(res.completeParts ?? []), seen, now);
      let productFailures = 0;
      for (const e of res.partialErrors) {
        // Un producto que no se pudo consultar es un fallo parcial real (la fuente quedó incompleta).
        const isProductFailure = !/lista de productos/i.test(e);
        if (isProductFailure) productFailures++;
        issues.push({ level: isProductFailure ? 'error' : 'warning', stage: 'fetch', source: 'fabric-roadmap', message: e, at: now });
      }
      if (productFailures > 0) result.error = `${productFailures} producto(s) del roadmap no se pudieron consultar`;
    } catch (err) {
      result.status = 'error';
      result.error = (err as Error).message;
      issues.push({ level: 'error', stage: 'fetch', source: 'fabric-roadmap', message: result.error, at: new Date().toISOString() });
    }
    result.durationMs = Date.now() - t0;
    totals.newRoadmap += result.created;
    totals.changedRoadmap += result.updated;
    sources.push(result);
    log(`· fabric-roadmap: ${result.status} — ${result.fetched} elementos, ${result.created} nuevos, ${result.updated} con cambios${result.error ? ` — ${result.error}` : ''}`);
  }

  /* ---------------------------- 2) Duplicados ---------------------------- */
  totals.duplicatesLinked = linkDuplicates(store.updates, now);

  /* ----------------------- 3) Traducción y análisis ----------------------- */
  let ai = emptyAiStats(config);
  if (opts.ai) {
    try {
      ai = await enrich({ store, config, issues, log });
      log(`· IA: ${ai.succeeded} análisis, ${ai.roadmapTranslated} traducciones de roadmap, ${ai.failed} errores, pendientes ${ai.pendingUpdates}/${ai.pendingRoadmap}`);
    } catch (err) {
      issues.push({ level: 'error', stage: 'ai', message: `Fase de IA interrumpida: ${(err as Error).message}`, at: new Date().toISOString() });
    }
  } else {
    issues.push({ level: 'warning', stage: 'config', message: 'Ejecución sin fase de IA (--no-ai).', at: now });
  }

  /* ------------------------------ 4) Guardado ------------------------------ */
  // La caché HTTP solo se actualiza para las fuentes que se procesaron correctamente.
  for (const [url, entry] of Object.entries(newCache)) store.httpCache[url] = entry;
  let saved = { updates: 0, roadmap: 0 };
  try {
    saved = await store.save();
  } catch (err) {
    issues.push({ level: 'error', stage: 'store', message: `No se pudo guardar la base de datos: ${(err as Error).message}`, at: new Date().toISOString() });
  }

  const finishedAt = new Date();
  const run: RunRecord = {
    id: `run-${startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
    trigger: opts.trigger,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    status: computeRunStatus(sources, issues),
    sources,
    ai,
    totals,
    issues: issues.slice(0, 60),
    ...(config.workflowRunUrl ? { workflowRunUrl: config.workflowRunUrl } : {}),
  };
  await store.appendRun(run);
  await store.writeStatus(await buildStatus(store, run, config));
  log(`Ejecución ${run.id}: ${run.status.toUpperCase()} — ${saved.updates} novedades y ${saved.roadmap} elementos de roadmap escritos.`);
  return run;
}

export async function buildStatus(store: Store, run: RunRecord, config: PipelineConfig): Promise<SystemStatus> {
  const runs = await store.recentRuns(50);
  const lastSuccess = runs.find((r) => r.status === 'success');
  let consecutiveFailures = 0;
  for (const r of runs) {
    if (r.status === 'failed') consecutiveFailures++;
    else break;
  }
  const updates = [...store.updates.values()].filter((u) => !u.duplicateOf);
  const roadmap = [...store.roadmap.values()];
  return {
    generatedAt: new Date().toISOString(),
    lastRun: run,
    lastSuccessfulRunAt: lastSuccess?.finishedAt ?? null,
    lastSuccessfulRunId: lastSuccess?.id ?? null,
    lastAttemptAt: run.startedAt,
    consecutiveFailures,
    health: run.status === 'success' ? 'ok' : run.status === 'partial' ? 'degraded' : 'failing',
    counts: {
      updates: updates.length,
      roadmap: roadmap.length,
      aiDoneUpdates: updates.filter((u) => u.ai.status === 'done').length,
      aiPendingUpdates: updates.filter((u) => u.ai.status === 'pending').length,
      aiErrorUpdates: updates.filter((u) => u.ai.status === 'error').length,
      aiDoneRoadmap: roadmap.filter((r) => r.ai.status === 'done').length,
      aiPendingRoadmap: roadmap.filter((r) => r.ai.status !== 'done').length,
      translatedUpdates: updates.filter((u) => u.ai.status === 'done' || u.tr?.status === 'done').length,
    },
    ai: {
      configured: run.ai.configured || config.aiProvider !== 'none',
      provider: run.ai.provider ?? config.aiProvider,
      model: run.ai.model ?? (config.aiProvider === 'anthropic' ? config.aiModel : null),
    },
  };
}
