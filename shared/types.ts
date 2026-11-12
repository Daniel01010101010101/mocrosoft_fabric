import type { CategoryId } from './categories';

/* ------------------------------------------------------------------ */
/* Fuentes                                                             */
/* ------------------------------------------------------------------ */

export type SourceId = 'fabric-blog' | 'powerbi-blog' | 'learn-whats-new' | 'azure-updates' | 'fabric-roadmap';

export interface SourceInfo {
  id: SourceId;
  name: string;
  url: string;
  description: string;
}

export const SOURCES: Record<SourceId, SourceInfo> = {
  'fabric-blog': {
    id: 'fabric-blog',
    name: 'Microsoft Fabric Updates Blog',
    url: 'https://blog.fabric.microsoft.com/en-us/blog/',
    description: 'Blog oficial de novedades de Microsoft Fabric (feed RSS oficial).',
  },
  'powerbi-blog': {
    id: 'powerbi-blog',
    name: 'Power BI Updates Blog',
    url: 'https://powerbi.microsoft.com/en-us/blog/',
    description: 'Blog oficial de novedades de Power BI dentro de Microsoft Fabric.',
  },
  'learn-whats-new': {
    id: 'learn-whats-new',
    name: "Microsoft Learn · What's new in Microsoft Fabric",
    url: 'https://learn.microsoft.com/en-us/fabric/fundamentals/whats-new',
    description: 'Documentación oficial con las funcionalidades en Preview y en disponibilidad general.',
  },
  'azure-updates': {
    id: 'azure-updates',
    name: 'Azure Updates (Microsoft Fabric)',
    url: 'https://azure.microsoft.com/en-us/updates/',
    description: 'Anuncios oficiales de Azure relacionados con Microsoft Fabric y OneLake.',
  },
  'fabric-roadmap': {
    id: 'fabric-roadmap',
    name: 'Microsoft Fabric Roadmap',
    url: 'https://roadmap.fabric.microsoft.com/',
    description: 'Plan de lanzamientos oficial: funcionalidades planificadas y entregadas.',
  },
};

/* ------------------------------------------------------------------ */
/* Novedades                                                           */
/* ------------------------------------------------------------------ */

export type UpdateKind = 'blog' | 'whats-new' | 'azure-update';
export type UpdateType = 'feature' | 'improvement' | 'announcement' | 'deprecation' | 'event' | 'guidance' | 'summary';
export type Stage = 'preview' | 'ga' | 'planned' | 'none';
export type DatePrecision = 'exact' | 'day' | 'month' | 'quarter' | 'detected';
export type Audience =
  | 'data-engineers'
  | 'data-analysts'
  | 'data-scientists'
  | 'developers'
  | 'architects'
  | 'administrators'
  | 'business-users';

export const AUDIENCE_LABELS: Record<Audience, string> = {
  'data-engineers': 'Ingenieros de datos',
  'data-analysts': 'Analistas de datos',
  'data-scientists': 'Científicos de datos',
  developers: 'Desarrolladores',
  architects: 'Arquitectos',
  administrators: 'Administradores',
  'business-users': 'Usuarios de negocio',
};

export const UPDATE_TYPE_LABELS: Record<UpdateType, string> = {
  feature: 'Nueva funcionalidad',
  improvement: 'Mejora',
  announcement: 'Anuncio',
  deprecation: 'Retirada / cambio importante',
  event: 'Evento',
  guidance: 'Guía y buenas prácticas',
  summary: 'Resumen de novedades',
};

export const STAGE_LABELS: Record<Stage, string> = {
  preview: 'Preview',
  ga: 'Disponibilidad general (GA)',
  planned: 'Planificada',
  none: 'Sin fase',
};

export interface CodeBlock {
  language: string;
  code: string;
}

export interface ImageRef {
  src: string;
  alt: string;
}

export interface LinkRef {
  label: string;
  url: string;
}

export interface UpdateContent {
  /** Texto plano completo extraído de la fuente oficial. */
  text: string;
  /** HTML saneado de la publicación original (para la vista "contenido original"). */
  html: string;
  excerpt: string;
  images: ImageRef[];
  codeBlocks: CodeBlock[];
  links: LinkRef[];
}

export interface CodeExample {
  language: string;
  code: string;
  explanation: string;
  origin: 'source' | 'illustrative';
}

export interface FlowStep {
  label: string;
  detail: string;
}

export interface UseCase {
  title: string;
  scenario: string;
}

/** Análisis detallado en español generado por IA a partir de la fuente oficial. */
export interface Analysis {
  detectedLanguage: 'en' | 'es' | 'other';
  titleEs: string;
  executiveSummary: string;
  keyPoints: string[];
  whatIsIt: string;
  howItWorks: string;
  flow: FlowStep[];
  problemSolved: string;
  advantages: string[];
  implementationSteps: string[];
  useCases: UseCase[];
  businessImpact: string;
  considerations: string[];
  codeExample: CodeExample | null;
  audiences: Audience[];
  primaryCategory: CategoryId;
  secondaryCategories: CategoryId[];
  updateType: UpdateType;
  stage: Stage;
  technologies: string[];
  impactScore: number;
  impactRationale: string;
  transformative: boolean;
}

export type AiStatus = 'pending' | 'done' | 'error' | 'skipped';

export interface AiState<T> {
  status: AiStatus;
  /** Hash del contenido fuente con el que se generó (evita retraducir sin cambios). */
  sourceHash?: string;
  model?: string;
  promptVersion?: number;
  generatedAt?: string;
  attempts: number;
  lastError?: string;
  lastAttemptAt?: string;
  result?: T;
}

export interface Impact {
  /** 0-100 */
  score: number;
  level: 'alto' | 'medio' | 'bajo';
  transformative: boolean;
  audiences: Audience[];
  basis: 'heuristic' | 'ai';
}

export interface SourceRef {
  source: SourceId;
  url: string;
  title: string;
  seenAt: string;
}

export interface UpdateItem {
  id: string;
  kind: UpdateKind;
  source: SourceId;
  url: string;
  docsUrl?: string;
  title: string;
  author?: string;
  originalLanguage: 'en' | 'es' | 'other';
  languageConfidence: number;
  publishedAt: string;
  datePrecision: DatePrecision;
  detectedAt: string;
  updatedAt: string;
  removedFromSourceAt?: string;
  /** Si es duplicado de otra novedad, id de la principal (se conserva para trazabilidad). */
  duplicateOf?: string;
  relatedSources: SourceRef[];
  relatedIds: string[];
  content: UpdateContent;
  contentHash: string;
  categories: CategoryId[];
  primaryCategory: CategoryId;
  type: UpdateType;
  stage: Stage;
  technologies: string[];
  impact: Impact;
  ai: AiState<Analysis>;
  /** Datos específicos de la fuente (sección de Learn, mes, etc.). */
  meta: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

export type RoadmapStatus = 'planned' | 'shipped';
export type RoadmapReleaseType = 'preview' | 'ga';

export interface RoadmapTranslation {
  nameEs: string;
  descriptionEs: string;
}

export interface RoadmapChange {
  at: string;
  field: 'releaseStatus' | 'releaseType' | 'releaseDate' | 'name' | 'description';
  from: string;
  to: string;
}

export interface RoadmapItem {
  id: string;
  releaseItemId: string;
  product: string;
  productId: string;
  category: CategoryId;
  name: string;
  description: string;
  releaseType: RoadmapReleaseType;
  releaseStatus: RoadmapStatus;
  /** Ej. "Q3 2026" */
  releaseDate: string;
  /** Inicio del trimestre estimado (ISO) para ordenar y filtrar. */
  releaseQuarterStart: string | null;
  wave: string;
  url: string;
  detectedAt: string;
  updatedAt: string;
  removedFromSourceAt?: string;
  history: RoadmapChange[];
  contentHash: string;
  ai: AiState<RoadmapTranslation>;
}

/* ------------------------------------------------------------------ */
/* Ejecuciones y estado                                                */
/* ------------------------------------------------------------------ */

export type RunStatus = 'success' | 'partial' | 'failed';
export type RunTrigger = 'schedule' | 'manual' | 'local' | 'retry';

export interface SourceRunResult {
  source: SourceId;
  status: 'ok' | 'not-modified' | 'error';
  attempts: number;
  durationMs: number;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  error?: string;
}

export interface RunIssue {
  level: 'error' | 'warning';
  stage: 'fetch' | 'parse' | 'validate' | 'ai' | 'store' | 'workflow' | 'config';
  source?: SourceId;
  message: string;
  at: string;
}

export interface AiRunStats {
  configured: boolean;
  model: string | null;
  attempted: number;
  succeeded: number;
  failed: number;
  roadmapTranslated: number;
  pendingUpdates: number;
  pendingRoadmap: number;
  inputTokens: number;
  outputTokens: number;
}

export interface RunRecord {
  id: string;
  trigger: RunTrigger;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: RunStatus;
  sources: SourceRunResult[];
  ai: AiRunStats;
  totals: {
    newUpdates: number;
    updatedUpdates: number;
    newRoadmap: number;
    changedRoadmap: number;
    duplicatesLinked: number;
  };
  issues: RunIssue[];
  workflowRunUrl?: string;
  commit?: string;
}

export interface SystemStatus {
  generatedAt: string;
  lastRun: RunRecord | null;
  lastSuccessfulRunAt: string | null;
  lastSuccessfulRunId: string | null;
  lastAttemptAt: string | null;
  consecutiveFailures: number;
  health: 'ok' | 'degraded' | 'failing' | 'unknown';
  counts: {
    updates: number;
    roadmap: number;
    aiDoneUpdates: number;
    aiPendingUpdates: number;
    aiErrorUpdates: number;
    aiDoneRoadmap: number;
    aiPendingRoadmap: number;
  };
  ai: { configured: boolean; model: string | null };
}

/* ------------------------------------------------------------------ */
/* API estática consumida por el frontend                              */
/* ------------------------------------------------------------------ */

export interface UpdateSummary {
  id: string;
  kind: UpdateKind;
  source: SourceId;
  url: string;
  titleEs: string | null;
  titleOriginal: string;
  summaryEs: string | null;
  excerptOriginal: string;
  publishedAt: string;
  datePrecision: DatePrecision;
  /** true si la fuente no indica fecha y la novedad se incorporó en la carga inicial (fecha real desconocida). */
  undated: boolean;
  detectedAt: string;
  primaryCategory: CategoryId;
  categories: CategoryId[];
  type: UpdateType;
  stage: Stage;
  technologies: string[];
  impactScore: number;
  impactLevel: Impact['level'];
  transformative: boolean;
  audiences: Audience[];
  image: string | null;
  aiStatus: AiStatus;
  originalLanguage: UpdateItem['originalLanguage'];
}

export interface UpdateDetail extends UpdateSummary {
  docsUrl: string | null;
  author: string | null;
  updatedAt: string;
  analysis: Analysis | null;
  aiModel: string | null;
  aiGeneratedAt: string | null;
  content: UpdateContent;
  relatedSources: SourceRef[];
  related: UpdateSummary[];
  meta: Record<string, string>;
}

export interface RoadmapSummary {
  id: string;
  product: string;
  category: CategoryId;
  name: string;
  nameEs: string | null;
  description: string;
  descriptionEs: string | null;
  releaseType: RoadmapReleaseType;
  releaseStatus: RoadmapStatus;
  releaseDate: string;
  releaseQuarterStart: string | null;
  wave: string;
  url: string;
  detectedAt: string;
  updatedAt: string;
  removedFromSource: boolean;
  history: RoadmapChange[];
  aiStatus: AiStatus;
}

export interface ApiMeta {
  generatedAt: string;
  appVersion: string;
  updates: number;
  roadmap: number;
}

export interface StatusResponse {
  status: SystemStatus;
  runs: RunRecord[];
}
