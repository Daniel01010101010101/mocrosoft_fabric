import type { RunRecord, RunTrigger } from '../../shared/types';
import { DATA_DIR, type PipelineConfig } from './config';
import { Store } from './core/store';
import { buildStatus } from './run';

/** Registra una ejecución fallida (p. ej. el workflow falló antes o durante la ingesta). */
export async function recordWorkflowFailure(opts: {
  reason: string;
  trigger: RunTrigger;
  config: PipelineConfig;
  dataDir?: string;
}): Promise<RunRecord> {
  const dataDir = opts.dataDir ?? DATA_DIR;
  const store = await Store.load(dataDir);
  const now = new Date().toISOString();
  const run: RunRecord = {
    id: `run-${now.replace(/[-:.TZ]/g, '').slice(0, 14)}-fail`,
    trigger: opts.trigger,
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    status: 'failed',
    sources: [],
    ai: {
      configured: opts.config.aiProvider !== 'none',
      provider: opts.config.aiProvider,
      model: null,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      roadmapTranslated: 0,
      pendingUpdates: 0,
      pendingRoadmap: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
    totals: { newUpdates: 0, updatedUpdates: 0, newRoadmap: 0, changedRoadmap: 0, duplicatesLinked: 0 },
    issues: [{ level: 'error', stage: 'workflow', message: opts.reason.slice(0, 1000), at: now }],
    ...(opts.config.workflowRunUrl ? { workflowRunUrl: opts.config.workflowRunUrl } : {}),
  };
  await store.appendRun(run);
  await store.writeStatus(await buildStatus(store, run, opts.config));
  return run;
}
