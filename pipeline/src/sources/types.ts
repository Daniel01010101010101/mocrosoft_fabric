import type { CategoryId } from '../../../shared/categories';
import type { DatePrecision, SourceId, Stage, UpdateKind } from '../../../shared/types';
import type { PipelineConfig } from '../config';
import type { HttpCacheEntry } from '../core/http';

/** Novedad tal como se extrae de la fuente, antes de normalizarla y almacenarla. */
export interface RawUpdate {
  id: string;
  kind: UpdateKind;
  source: SourceId;
  url: string;
  title: string;
  author?: string;
  publishedAt: string;
  datePrecision: DatePrecision;
  html: string;
  baseUrl: string;
  docsUrl?: string;
  stageHint?: Stage;
  categoryHint?: CategoryId;
  meta: Record<string, string>;
}

export interface RawRoadmapItem {
  releaseItemId: string;
  product: string;
  productId: string;
  productQuery: string;
  name: string;
  description: string;
  releaseType: string;
  releaseStatus: string;
  releaseDate: string;
  wave: string;
}

export interface FetchContext {
  config: PipelineConfig;
  httpCache: Record<string, HttpCacheEntry>;
  /** Registra una entrada de caché HTTP nueva (se persiste al final de la ejecución). */
  setCache: (url: string, entry: HttpCacheEntry) => void;
}

export interface SourceFetchResult<T> {
  items: T[];
  notModified: boolean;
  /** Máximo de intentos que necesitó cualquiera de las peticiones de la fuente. */
  attempts: number;
  /** Errores parciales no fatales (p. ej. un producto del roadmap que falló). */
  partialErrors: string[];
  /** Para fuentes multi-página: identificadores de las partes consultadas con éxito. */
  completeParts?: string[];
}
