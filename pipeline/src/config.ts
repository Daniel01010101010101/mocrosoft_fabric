import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, '..', '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const API_OUT_DIR = path.join(ROOT_DIR, 'web', 'public', 'api');

export const APP_VERSION = '1.0.0';

/** Versión del parser: si cambia, se recalculan campos derivados de la fuente. */
export const PARSER_VERSION = 3;

/** Versión de los prompts de IA (se guarda en cada análisis para trazabilidad). */
export const PROMPT_VERSION = 1;

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export type AiProvider = 'anthropic' | 'none';

export interface PipelineConfig {
  anthropicApiKeyPresent: boolean;
  /**
   * Proveedor de IA para traducir y analizar:
   *  - anthropic: Claude (si existe ANTHROPIC_API_KEY).
   *  - none: sin IA (se usan las traducciones oficiales de Microsoft Learn y las ya guardadas).
   */
  aiProvider: AiProvider;
  /** Peticiones de IA como máximo por ejecución (control de coste). */
  aiMaxRequestsPerRun: number;
  aiModel: string;
  aiEffort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  aiRoadmapEffort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Máximo de análisis detallados por ejecución (controla coste y duración). */
  aiMaxUpdatesPerRun: number;
  /** Máximo de lotes de traducción de roadmap por ejecución. */
  aiMaxRoadmapBatchesPerRun: number;
  aiRoadmapBatchSize: number;
  /** Presupuesto de tiempo (ms) para la fase de IA de una ejecución. */
  aiTimeBudgetMs: number;
  aiConcurrency: number;
  /** Intentos máximos de IA por elemento antes de marcarlo como error permanente. */
  aiMaxAttemptsPerItem: number;
  httpTimeoutMs: number;
  httpRetries: number;
  userAgent: string;
  workflowRunUrl?: string;
}

export function loadConfig(): PipelineConfig {
  const effort = (process.env.AI_EFFORT ?? 'medium') as PipelineConfig['aiEffort'];
  const roadmapEffort = (process.env.AI_ROADMAP_EFFORT ?? 'low') as PipelineConfig['aiRoadmapEffort'];
  const server = process.env.GITHUB_SERVER_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  const anthropicApiKeyPresent = Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0);
  const requested = (process.env.AI_PROVIDER ?? 'auto').trim().toLowerCase();
  const aiProvider: AiProvider = requested !== 'none' && anthropicApiKeyPresent ? 'anthropic' : 'none';
  return {
    anthropicApiKeyPresent,
    aiProvider,
    aiMaxRequestsPerRun: intEnv('AI_MAX_REQUESTS_PER_RUN', 400),
    // Modelo por defecto: Claude Opus 5.5. Se puede cambiar con la variable AI_MODEL.
    aiModel: (process.env.AI_MODEL ?? '').trim() || 'claude-opus-5-5',
    aiEffort: ['low', 'medium', 'high', 'xhigh', 'max'].includes(effort) ? effort : 'medium',
    aiRoadmapEffort: ['low', 'medium', 'high', 'xhigh', 'max'].includes(roadmapEffort) ? roadmapEffort : 'low',
    aiMaxUpdatesPerRun: intEnv('AI_MAX_UPDATES_PER_RUN', 30),
    aiMaxRoadmapBatchesPerRun: intEnv('AI_MAX_ROADMAP_BATCHES_PER_RUN', 8),
    aiRoadmapBatchSize: Math.max(1, intEnv('AI_ROADMAP_BATCH_SIZE', 25)),
    aiTimeBudgetMs: intEnv('AI_TIME_BUDGET_MINUTES', 18) * 60_000,
    aiConcurrency: Math.max(1, Math.min(8, intEnv('AI_CONCURRENCY', 3))),
    aiMaxAttemptsPerItem: Math.max(1, intEnv('AI_MAX_ATTEMPTS_PER_ITEM', 5)),
    httpTimeoutMs: intEnv('HTTP_TIMEOUT_MS', 30_000),
    httpRetries: intEnv('HTTP_RETRIES', 3),
    userAgent: 'FabricRadar/1.0 (+monitor de novedades de Microsoft Fabric; GitHub Actions)',
    workflowRunUrl: server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : undefined,
  };
}
