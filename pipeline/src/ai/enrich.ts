import { CATEGORY_IDS, type CategoryId } from '../../../shared/categories';
import type { AiRunStats, Analysis, RoadmapItem, RunIssue, UpdateItem } from '../../../shared/types';
import { PROMPT_VERSION, type PipelineConfig } from '../config';
import { blendImpact, heuristicImpact } from '../core/classify';
import type { Store } from '../core/store';
import { AiClient, AiFatalError } from './client';
import { buildUpdatePrompt } from './context';
import { ANALYSIS_SYSTEM_PROMPT, ROADMAP_SYSTEM_PROMPT } from './prompts';
import { AnalysisSchema, RoadmapBatchSchema, type AnalysisOutput } from './schema';

export function needsAnalysis(item: UpdateItem, maxAttempts: number): boolean {
  if (item.duplicateOf) return false;
  if (item.ai.status === 'done' && item.ai.sourceHash === item.contentHash) return false;
  if (item.ai.status === 'skipped') return false;
  return item.ai.attempts < maxAttempts;
}

export function needsRoadmapTranslation(item: RoadmapItem, maxAttempts: number): boolean {
  if (item.ai.status === 'done' && item.ai.sourceHash === item.contentHash) return false;
  return item.ai.attempts < maxAttempts;
}

/** Orden de prioridad: primero lo más reciente; las novedades importantes antes que las menores. */
export function prioritizeUpdates(items: UpdateItem[]): UpdateItem[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.publishedAt);
    const tb = Date.parse(b.publishedAt);
    const recentA = Date.now() - ta < 30 * 86_400_000 ? 1 : 0;
    const recentB = Date.now() - tb < 30 * 86_400_000 ? 1 : 0;
    if (recentA !== recentB) return recentB - recentA;
    if (a.kind === 'blog' && b.kind !== 'blog') return -1;
    if (b.kind === 'blog' && a.kind !== 'blog') return 1;
    return tb - ta;
  });
}

function sanitizeAnalysis(out: AnalysisOutput): Analysis {
  const uniq = <T,>(arr: T[]) => [...new Set(arr)];
  const primary: CategoryId = (CATEGORY_IDS as readonly string[]).includes(out.primaryCategory) ? out.primaryCategory : 'platform';
  return {
    ...out,
    keyPoints: out.keyPoints.filter(Boolean).slice(0, 8),
    flow: out.flow.filter((s) => s.label.trim()).slice(0, 7),
    advantages: out.advantages.filter(Boolean).slice(0, 8),
    implementationSteps: out.implementationSteps.filter(Boolean).slice(0, 10),
    useCases: out.useCases.filter((u) => u.title.trim()).slice(0, 5),
    considerations: out.considerations.filter(Boolean).slice(0, 8),
    audiences: uniq(out.audiences).slice(0, 5),
    primaryCategory: primary,
    secondaryCategories: uniq(out.secondaryCategories.filter((c) => c !== primary)).slice(0, 3),
    technologies: uniq(out.technologies.map((t) => t.trim()).filter(Boolean)).slice(0, 12),
    impactScore: Math.max(1, Math.min(10, Math.round(out.impactScore))),
  };
}

/** Aplica el análisis a la novedad: categorías, fase, impacto y estado de IA. */
export function applyAnalysis(item: UpdateItem, analysis: Analysis, model: string, now: string): void {
  item.ai = {
    status: 'done',
    sourceHash: item.contentHash,
    model,
    promptVersion: PROMPT_VERSION,
    generatedAt: now,
    attempts: item.ai.attempts,
    lastAttemptAt: now,
    result: analysis,
  };
  item.primaryCategory = analysis.primaryCategory;
  item.categories = [analysis.primaryCategory, ...analysis.secondaryCategories];
  item.type = analysis.updateType;
  // La sección oficial (Learn/Azure) manda sobre la estimación de fase.
  if (!(item.kind === 'whats-new' && item.meta.section)) {
    if (analysis.stage !== 'none' || item.stage === 'none') item.stage = analysis.stage;
  }
  item.technologies = analysis.technologies;
  const heuristic = heuristicImpact({
    title: item.title,
    text: item.content.text,
    kind: item.kind,
    type: item.type,
    stage: item.stage,
  });
  item.impact = blendImpact(heuristic, analysis.impactScore, analysis.transformative, analysis.audiences);
  item.updatedAt = now;
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>, shouldStop: () => boolean) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length && !shouldStop()) {
      const current = items[index++]!;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export interface EnrichOptions {
  store: Store;
  config: PipelineConfig;
  issues: RunIssue[];
  /** Permite inyectar un cliente simulado en tests. */
  client?: Pick<AiClient, 'structured' | 'model'>;
}

export async function enrich({ store, config, issues, client }: EnrichOptions): Promise<AiRunStats> {
  const stats: AiRunStats = {
    configured: config.anthropicApiKeyPresent || Boolean(client),
    model: config.anthropicApiKeyPresent || client ? config.aiModel : null,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    roadmapTranslated: 0,
    pendingUpdates: 0,
    pendingRoadmap: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  const pendingUpdates = () => [...store.updates.values()].filter((i) => needsAnalysis(i, config.aiMaxAttemptsPerItem));
  const pendingRoadmap = () => [...store.roadmap.values()].filter((i) => needsRoadmapTranslation(i, config.aiMaxAttemptsPerItem));

  // Los duplicados no se analizan: se muestran a través de la novedad principal.
  for (const item of store.updates.values()) {
    if (item.duplicateOf && item.ai.status === 'pending') item.ai.status = 'skipped';
  }

  if (!stats.configured) {
    stats.pendingUpdates = pendingUpdates().length;
    stats.pendingRoadmap = pendingRoadmap().length;
    if (stats.pendingUpdates + stats.pendingRoadmap > 0) {
      issues.push({
        level: 'warning',
        stage: 'config',
        message:
          'Traducción y análisis con IA pendientes: falta configurar el secreto ANTHROPIC_API_KEY en el repositorio. Las novedades se guardan y se traducirán automáticamente en cuanto se configure.',
        at: new Date().toISOString(),
      });
    }
    return stats;
  }

  const ai = client ?? new AiClient(config);
  const deadline = Date.now() + config.aiTimeBudgetMs;
  let fatal: string | null = null;
  const stop = () => fatal !== null || Date.now() > deadline;

  /* ------------------------- 1) Análisis de novedades ------------------------- */
  const queue = prioritizeUpdates(pendingUpdates()).slice(0, config.aiMaxUpdatesPerRun);
  await runPool(
    queue,
    config.aiConcurrency,
    async (item) => {
      stats.attempted++;
      const now = new Date().toISOString();
      item.ai.attempts += 1;
      item.ai.lastAttemptAt = now;
      try {
        const user = await buildUpdatePrompt(item, store, config);
        const res = await ai.structured({
          system: ANALYSIS_SYSTEM_PROMPT,
          user,
          schema: AnalysisSchema,
          effort: config.aiEffort,
          maxTokens: 32_000,
        });
        stats.inputTokens += res.inputTokens;
        stats.outputTokens += res.outputTokens;
        applyAnalysis(item, sanitizeAnalysis(res.data), res.model, new Date().toISOString());
        stats.succeeded++;
      } catch (err) {
        const message = (err as Error).message;
        if (err instanceof AiFatalError) {
          fatal = message;
          item.ai.attempts -= 1; // no penalizar al elemento por un fallo general
          return;
        }
        stats.failed++;
        item.ai.lastError = message;
        item.ai.status = item.ai.attempts >= config.aiMaxAttemptsPerItem ? 'error' : 'pending';
        issues.push({ level: 'error', stage: 'ai', source: item.source, message: `${item.title}: ${message}`, at: now });
      }
    },
    stop,
  );

  /* ------------------------- 2) Traducción del roadmap ------------------------- */
  if (!fatal) {
    const pending = pendingRoadmap().sort((a, b) => {
      // Primero lo planificado (próximas novedades) y lo más reciente
      if (a.releaseStatus !== b.releaseStatus) return a.releaseStatus === 'planned' ? -1 : 1;
      return (b.releaseQuarterStart ?? '').localeCompare(a.releaseQuarterStart ?? '');
    });
    const batches: RoadmapItem[][] = [];
    for (let i = 0; i < pending.length && batches.length < config.aiMaxRoadmapBatchesPerRun; i += config.aiRoadmapBatchSize) {
      batches.push(pending.slice(i, i + config.aiRoadmapBatchSize));
    }
    await runPool(
      batches,
      config.aiConcurrency,
      async (batch) => {
        const now = new Date().toISOString();
        for (const item of batch) {
          item.ai.attempts += 1;
          item.ai.lastAttemptAt = now;
        }
        const payload = batch.map((i) => ({ id: i.id, product: i.product, name: i.name, description: i.description }));
        try {
          const res = await ai.structured({
            system: ROADMAP_SYSTEM_PROMPT,
            user: `Traduce estos ${batch.length} elementos del roadmap de Microsoft Fabric. Devuelve un elemento por id.\n\n${JSON.stringify(payload, null, 1)}`,
            schema: RoadmapBatchSchema,
            effort: config.aiRoadmapEffort,
            maxTokens: 32_000,
          });
          stats.inputTokens += res.inputTokens;
          stats.outputTokens += res.outputTokens;
          const byId = new Map(res.data.items.map((r) => [r.id, r]));
          for (const item of batch) {
            const t = byId.get(item.id);
            if (!t || !t.nameEs.trim()) {
              item.ai.status = item.ai.attempts >= config.aiMaxAttemptsPerItem ? 'error' : 'pending';
              item.ai.lastError = 'La respuesta no incluyó la traducción de este elemento.';
              continue;
            }
            item.ai = {
              status: 'done',
              sourceHash: item.contentHash,
              model: res.model,
              promptVersion: PROMPT_VERSION,
              generatedAt: new Date().toISOString(),
              attempts: item.ai.attempts,
              lastAttemptAt: now,
              result: { nameEs: t.nameEs.trim(), descriptionEs: t.descriptionEs.trim() },
            };
            item.updatedAt = new Date().toISOString();
            stats.roadmapTranslated++;
          }
        } catch (err) {
          const message = (err as Error).message;
          if (err instanceof AiFatalError) {
            fatal = message;
            for (const item of batch) item.ai.attempts -= 1;
            return;
          }
          for (const item of batch) {
            item.ai.lastError = message;
            item.ai.status = item.ai.attempts >= config.aiMaxAttemptsPerItem ? 'error' : 'pending';
          }
          issues.push({ level: 'error', stage: 'ai', source: 'fabric-roadmap', message: `Lote de roadmap: ${message}`, at: now });
        }
      },
      stop,
    );
  }

  if (fatal) {
    issues.push({ level: 'error', stage: 'ai', message: fatal, at: new Date().toISOString() });
  }
  if (Date.now() > deadline) {
    issues.push({
      level: 'warning',
      stage: 'ai',
      message: 'Se alcanzó el presupuesto de tiempo de IA de esta ejecución; el resto se procesará en la siguiente.',
      at: new Date().toISOString(),
    });
  }
  stats.pendingUpdates = pendingUpdates().length;
  stats.pendingRoadmap = pendingRoadmap().length;
  return stats;
}
