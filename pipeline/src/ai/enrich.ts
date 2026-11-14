import { CATEGORY_IDS, type CategoryId } from '../../../shared/categories';
import type { AiRunStats, Analysis, RoadmapItem, RunIssue, UpdateItem } from '../../../shared/types';
import { PROMPT_VERSION, type PipelineConfig } from '../config';
import { blendImpact, heuristicImpact } from '../core/classify';
import type { Store } from '../core/store';
import { truncate } from '../core/text';
import { AiClient, AiFatalError, type StructuredClient } from './client';
import { buildUpdatePrompt } from './context';
import { ANALYSIS_SYSTEM_PROMPT, BRIEF_ANALYSIS_NOTE, ROADMAP_SYSTEM_PROMPT, TRANSLATE_SYSTEM_PROMPT } from './prompts';
import { AnalysisSchema, RoadmapBatchSchema, UpdateTranslationBatchSchema, type AnalysisOutput } from './schema';

export function needsAnalysis(item: UpdateItem, maxAttempts: number): boolean {
  if (item.duplicateOf) return false;
  if (item.ai.status === 'done' && item.ai.sourceHash === item.contentHash) return false;
  if (item.ai.status === 'skipped') return false;
  return item.ai.attempts < maxAttempts;
}

/** Traducción rápida pendiente: sin análisis vigente ni traducción para el contenido actual. */
export function needsTranslation(item: UpdateItem, maxAttempts: number): boolean {
  if (item.duplicateOf) return false;
  if (item.ai.status === 'done' && item.ai.sourceHash === item.contentHash) return false;
  if (item.tr?.status === 'done' && item.tr.sourceHash === item.contentHash) return false;
  return (item.tr?.attempts ?? 0) < maxAttempts;
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
    if (b.impact.score !== a.impact.score && Math.abs(tb - ta) < 7 * 86_400_000) return b.impact.score - a.impact.score;
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

/** Agrupa elementos en lotes limitados por número y por tamaño de texto. */
export function batchBySize<T>(items: T[], size: (item: T) => number, maxChars: number, maxItems: number): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let chars = 0;
  for (const item of items) {
    const n = size(item);
    if (current.length > 0 && (current.length >= maxItems || chars + n > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += n;
  }
  if (current.length) batches.push(current);
  return batches;
}

export interface EnrichOptions {
  store: Store;
  config: PipelineConfig;
  issues: RunIssue[];
  /** Permite inyectar un cliente simulado en tests. */
  client?: StructuredClient;
  log?: (m: string) => void;
}

function translationInput(item: UpdateItem, maxChars: number): { id: string; title: string; excerpt: string } {
  return { id: item.id, title: item.title, excerpt: truncate(item.content.text.replace(/\s+/g, ' '), maxChars) };
}

export async function enrich({ store, config, issues, client, log = () => {} }: EnrichOptions): Promise<AiRunStats> {
  const provider = client?.provider ?? (config.aiProvider === 'none' ? null : config.aiProvider);
  const stats: AiRunStats = {
    configured: provider !== null,
    provider: provider ?? 'none',
    model: null,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    translated: 0,
    requests: 0,
    roadmapTranslated: 0,
    pendingUpdates: 0,
    pendingRoadmap: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  const pendingTranslations = () => [...store.updates.values()].filter((i) => needsTranslation(i, config.aiMaxAttemptsPerItem));
  const pendingUpdates = () => [...store.updates.values()].filter((i) => needsAnalysis(i, config.aiMaxAttemptsPerItem));
  const pendingRoadmap = () => [...store.roadmap.values()].filter((i) => needsRoadmapTranslation(i, config.aiMaxAttemptsPerItem));

  // Los duplicados no se analizan: se muestran a través de la novedad principal.
  for (const item of store.updates.values()) {
    if (item.duplicateOf && item.ai.status === 'pending') item.ai.status = 'skipped';
  }

  if (!provider) {
    stats.pendingUpdates = pendingUpdates().length;
    stats.pendingRoadmap = pendingRoadmap().length;
    if (stats.pendingUpdates + stats.pendingRoadmap > 0) {
      issues.push({
        level: 'warning',
        stage: 'config',
        message:
          'Análisis con IA pendiente: falta configurar el secreto ANTHROPIC_API_KEY. Mientras tanto se usan las traducciones oficiales de Microsoft Learn y las traducciones ya guardadas; el resto se traducirá automáticamente en cuanto se configure la clave.',
        at: new Date().toISOString(),
      });
    }
    return stats;
  }

  const ai: StructuredClient = client ?? new AiClient(config);
  stats.model = ai.model;
  const limits = ai.limits;

  const deadline = Date.now() + config.aiTimeBudgetMs;
  let fatal: string | null = null;
  const budgetLeft = () => config.aiMaxRequestsPerRun - (stats.requests ?? 0);
  const stop = () => fatal !== null || Date.now() > deadline || budgetLeft() <= 0;
  const call: StructuredClient['structured'] = async (opts) => {
    stats.requests = (stats.requests ?? 0) + 1;
    const res = await ai.structured(opts);
    stats.inputTokens += res.inputTokens;
    stats.outputTokens += res.outputTokens;
    return res;
  };

  /* -------------- 1) Traducción rápida (título + resumen) en lotes -------------- */
  {
    const pending = prioritizeUpdates(pendingTranslations());
    const excerptChars = Math.min(700, Math.floor(limits.translateBatchChars / limits.translateBatchItems));
    const batches = batchBySize(
      pending,
      (i) => i.title.length + Math.min(i.content.text.length, excerptChars) + 40,
      limits.translateBatchChars,
      limits.translateBatchItems,
    );
    await runPool(
      batches,
      limits.concurrency,
      async (batch) => {
        if (stop()) return;
        const now = new Date().toISOString();
        for (const item of batch) {
          item.tr = { ...(item.tr ?? { status: 'pending', attempts: 0 }), attempts: (item.tr?.attempts ?? 0) + 1, lastAttemptAt: now };
        }
        try {
          const res = await call({
            system: TRANSLATE_SYSTEM_PROMPT,
            user: `Traduce estas ${batch.length} novedades de Microsoft Fabric. Devuelve un elemento por id.\n\n${JSON.stringify(
              batch.map((i) => translationInput(i, excerptChars)),
              null,
              1,
            )}`,
            schema: UpdateTranslationBatchSchema,
            effort: 'low',
            maxTokens: 8_000,
          });
          const byId = new Map(res.data.items.map((r) => [r.id, r]));
          for (const item of batch) {
            const t = byId.get(item.id);
            if (!t || !t.titleEs.trim()) {
              item.tr = { ...item.tr!, status: 'pending', lastError: 'La respuesta no incluyó este elemento.' };
              continue;
            }
            item.tr = {
              status: 'done',
              sourceHash: item.contentHash,
              model: res.model,
              promptVersion: PROMPT_VERSION,
              generatedAt: new Date().toISOString(),
              attempts: item.tr?.attempts ?? 1,
              lastAttemptAt: now,
              result: { titleEs: t.titleEs.trim(), summaryEs: t.summaryEs.trim() },
            };
            stats.translated = (stats.translated ?? 0) + 1;
          }
        } catch (err) {
          const message = (err as Error).message;
          if (err instanceof AiFatalError) {
            fatal = message;
            for (const item of batch) item.tr = { ...item.tr!, attempts: Math.max(0, (item.tr?.attempts ?? 1) - 1) };
            return;
          }
          for (const item of batch) item.tr = { ...item.tr!, status: 'pending', lastError: message };
          issues.push({ level: 'error', stage: 'ai', message: `Lote de traducción: ${message}`, at: now });
        }
      },
      stop,
    );
  }

  /* ------------- 2) Roadmap planificado (próximas novedades) ------------- */
  const translateRoadmap = async (filter: (r: RoadmapItem) => boolean) => {
    if (stop()) return;
    const pending = pendingRoadmap().filter(filter).sort((a, b) => {
      // Primero lo planificado (próximas novedades) y lo más reciente
      if (a.releaseStatus !== b.releaseStatus) return a.releaseStatus === 'planned' ? -1 : 1;
      return (b.releaseQuarterStart ?? '').localeCompare(a.releaseQuarterStart ?? '');
    });
    const batches = batchBySize(
      pending,
      (r) => r.name.length + r.description.length + 60,
      limits.roadmapBatchChars,
      Math.min(limits.roadmapBatchItems, config.aiRoadmapBatchSize),
    ).slice(0, config.aiMaxRoadmapBatchesPerRun);
    await runPool(
      batches,
      limits.concurrency,
      async (batch) => {
        if (stop()) return;
        const now = new Date().toISOString();
        for (const item of batch) {
          item.ai.attempts += 1;
          item.ai.lastAttemptAt = now;
        }
        const payload = batch.map((i) => ({ id: i.id, product: i.product, name: i.name, description: i.description }));
        try {
          const res = await call({
            system: ROADMAP_SYSTEM_PROMPT,
            user: `Traduce estos ${batch.length} elementos del roadmap de Microsoft Fabric. Devuelve un elemento por id.\n\n${JSON.stringify(payload, null, 1)}`,
            schema: RoadmapBatchSchema,
            effort: config.aiRoadmapEffort,
            maxTokens: 32_000,
          });
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
  };

  await translateRoadmap((r) => r.releaseStatus === 'planned');

  /* ------------------------- 3) Análisis detallado ------------------------- */
  const queue = prioritizeUpdates(pendingUpdates()).slice(0, config.aiMaxUpdatesPerRun);
  await runPool(
    queue,
    limits.concurrency,
    async (item) => {
      if (stop()) return;
      stats.attempted++;
      const now = new Date().toISOString();
      item.ai.attempts += 1;
      item.ai.lastAttemptAt = now;
      try {
        const user = await buildUpdatePrompt(item, store, config, limits, limits.brief ? BRIEF_ANALYSIS_NOTE : '');
        const res = await call({
          system: ANALYSIS_SYSTEM_PROMPT,
          user,
          schema: AnalysisSchema,
          effort: config.aiEffort,
          maxTokens: 32_000,
        });
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

  /* --------------------- 4) Resto del roadmap (entregado) --------------------- */
  await translateRoadmap(() => true);

  if (fatal) {
    // Un límite de uso alcanzado no es un fallo del proceso: se reanuda en la siguiente ejecución.
    const isQuota = /límite de uso/i.test(fatal);
    issues.push({ level: isQuota ? 'warning' : 'error', stage: 'ai', message: fatal, at: new Date().toISOString() });
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
  log(
    `· IA (${stats.model}): ${stats.translated} traducciones rápidas, ${stats.succeeded} análisis, ${stats.roadmapTranslated} elementos de roadmap, ${stats.requests} peticiones.`,
  );
  return stats;
}
