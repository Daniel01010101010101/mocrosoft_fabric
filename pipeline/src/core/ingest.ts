import { ROADMAP_PRODUCT_CATEGORY, type CategoryId } from '../../../shared/categories';
import type {
  RoadmapChange,
  RoadmapItem,
  RoadmapReleaseType,
  RoadmapStatus,
  UpdateItem,
} from '../../../shared/types';
import { PARSER_VERSION } from '../config';
import { roadmapItemUrl } from '../sources/roadmap';
import type { RawRoadmapItem, RawUpdate } from '../sources/types';
import { blendImpact, classifyCategories, detectStage, detectType, heuristicImpact } from './classify';
import { detectLanguage } from './language';
import { canonicalUrl, validateCandidate } from './validate';
import { extractContent, sha256, titleSimilarity } from './text';

export type UpsertOutcome = 'created' | 'updated' | 'unchanged' | 'rejected';

export interface UpsertResult {
  outcome: UpsertOutcome;
  reason?: string;
  id: string;
}

/** Construye una novedad normalizada a partir del registro bruto de la fuente. */
export function buildUpdate(raw: RawUpdate, now: string): UpdateItem | { rejected: string } {
  const content = extractContent(raw.html, { baseUrl: raw.baseUrl });
  const invalid = validateCandidate({ url: raw.url, title: raw.title, publishedAt: raw.publishedAt, text: content.text });
  if (invalid) return { rejected: invalid };

  // Todas las fuentes consultadas son de la configuración regional en-us.
  const lang = detectLanguage(`${raw.title}\n${content.text}`, 'en');
  const cls = classifyCategories(raw.title, content.text, raw.categoryHint);
  const stage = raw.stageHint ?? detectStage(raw.title, content.text);
  const type = detectType(raw.title, raw.kind, content.text);
  const docsUrl =
    raw.docsUrl ?? content.links.find((l) => l.url.startsWith('https://learn.microsoft.com/') && !l.url.includes('/whats-new'))?.url;

  // El hash del contenido determina si hay que regenerar la traducción/análisis.
  const contentHash = sha256(JSON.stringify([raw.title, content.text, PARSER_VERSION]));

  return {
    id: raw.id,
    kind: raw.kind,
    source: raw.source,
    url: raw.url,
    ...(docsUrl ? { docsUrl } : {}),
    title: raw.title,
    ...(raw.author ? { author: raw.author } : {}),
    originalLanguage: lang.lang,
    languageConfidence: lang.confidence,
    publishedAt: raw.publishedAt,
    datePrecision: raw.datePrecision,
    detectedAt: now,
    updatedAt: now,
    relatedSources: [],
    relatedIds: [],
    content,
    contentHash,
    categories: cls.categories,
    primaryCategory: cls.primary,
    type,
    stage,
    technologies: [],
    impact: heuristicImpact({ title: raw.title, text: content.text, kind: raw.kind, type, stage }),
    ai: { status: 'pending', attempts: 0 },
    meta: raw.meta,
  };
}

/**
 * Inserta o actualiza una novedad conservando la fecha de detección, el análisis de IA,
 * los vínculos de duplicados y la fecha original de publicación.
 */
export function upsertUpdate(store: Map<string, UpdateItem>, raw: RawUpdate, now: string): UpsertResult {
  const built = buildUpdate(raw, now);
  if ('rejected' in built) return { outcome: 'rejected', reason: built.rejected, id: raw.id };

  const existing = store.get(built.id);
  if (!existing) {
    store.set(built.id, built);
    return { outcome: 'created', id: built.id };
  }

  const merged: UpdateItem = {
    ...existing,
    kind: built.kind,
    source: existing.source,
    url: built.url,
    ...(built.docsUrl ? { docsUrl: built.docsUrl } : {}),
    title: built.title,
    ...(built.author ? { author: built.author } : {}),
    originalLanguage: built.originalLanguage,
    languageConfidence: built.languageConfidence,
    content: built.content,
    contentHash: built.contentHash,
    meta: { ...existing.meta, ...built.meta },
  };
  delete merged.removedFromSourceAt;

  // La fecha original nunca se sustituye por una menos precisa ni por la fecha de detección.
  const precisionRank = { exact: 4, day: 3, month: 2, quarter: 1, detected: 0 } as const;
  if (precisionRank[built.datePrecision] > precisionRank[existing.datePrecision]) {
    merged.publishedAt = built.publishedAt;
    merged.datePrecision = built.datePrecision;
  } else if (built.datePrecision === existing.datePrecision && built.datePrecision !== 'detected') {
    merged.publishedAt = built.publishedAt;
  }

  // Campos derivados: si la IA ya analizó, se respetan sus categorías y fase.
  if (existing.ai.status !== 'done') {
    merged.categories = built.categories;
    merged.primaryCategory = built.primaryCategory;
    merged.type = built.type;
    merged.stage = built.stage;
    merged.impact = built.impact;
  } else if (existing.ai.result && built.contentHash !== existing.contentHash) {
    const r = existing.ai.result;
    merged.impact = blendImpact(built.impact, r.impactScore, r.transformative, r.audiences);
  }

  if (built.contentHash !== existing.contentHash) {
    // El contenido cambió: hay que volver a analizar (se conserva el análisis previo hasta entonces).
    merged.ai = { ...existing.ai, status: 'pending', attempts: 0 };
    delete merged.ai.lastError;
  }

  const before = JSON.stringify({ ...existing, updatedAt: '' });
  const after = JSON.stringify({ ...merged, updatedAt: '' });
  if (before === after) return { outcome: 'unchanged', id: built.id };
  merged.updatedAt = now;
  store.set(built.id, merged);
  return { outcome: 'updated', id: built.id };
}

/** Marca como retiradas de la fuente las novedades que ya no aparecen (nunca se borran). */
export function markRemoved(store: Map<string, UpdateItem>, source: UpdateItem['source'], seenIds: Set<string>, now: string): number {
  let n = 0;
  for (const item of store.values()) {
    if (item.source === source && !seenIds.has(item.id) && !item.removedFromSourceAt && item.kind === 'whats-new') {
      item.removedFromSourceAt = now;
      item.updatedAt = now;
      n++;
    }
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Deduplicación entre fuentes                                         */
/* ------------------------------------------------------------------ */

function messageId(url: string): string | null {
  const m = /\/ba-p\/(\d+)/.exec(url);
  return m ? `cm-${m[1]}` : null;
}

/**
 * Vincula registros que describen la misma publicación desde distintas fuentes.
 * El registro secundario se conserva (trazabilidad) pero se marca con `duplicateOf`
 * y su fuente se añade a `relatedSources` del principal.
 */
export function linkDuplicates(store: Map<string, UpdateItem>, now: string): number {
  let linked = 0;
  const items = [...store.values()];
  const blogs = items.filter((i) => i.kind === 'blog');
  const blogById = new Map(blogs.map((b) => [b.id, b]));

  const attach = (dup: UpdateItem, primary: UpdateItem): boolean => {
    if (dup.id === primary.id || dup.duplicateOf === primary.id) return false;
    dup.duplicateOf = primary.id;
    dup.updatedAt = now;
    if (!primary.relatedSources.some((s) => s.url === dup.url && s.source === dup.source)) {
      primary.relatedSources.push({ source: dup.source, url: dup.url, title: dup.title, seenAt: now });
      primary.updatedAt = now;
    }
    if (dup.docsUrl && !primary.docsUrl) primary.docsUrl = dup.docsUrl;
    return true;
  };

  for (const item of items) {
    if (item.duplicateOf) continue;

    // 1) Learn "What's new" que enlaza a un post del blog con el mismo título.
    if (item.kind === 'whats-new') {
      const blogUrl = item.meta.blogUrl ?? (item.url.includes('/ba-p/') ? item.url : undefined);
      const mid = blogUrl ? messageId(blogUrl) : null;
      const blog = mid ? blogById.get(mid) : undefined;
      if (blog) {
        // Fecha original: la del post del blog si la entrada no tenía fecha precisa.
        if (item.datePrecision === 'detected' || item.datePrecision === 'month') {
          if (!/feature[\s-]summary/i.test(blog.title)) {
            item.publishedAt = blog.publishedAt;
            item.datePrecision = 'day';
          }
        }
        if (!item.relatedIds.includes(blog.id)) item.relatedIds.push(blog.id);
        if (titleSimilarity(item.title, blog.title) >= 0.55 && attach(item, blog)) linked++;
      }
    }

    // 2) Azure Update con título equivalente a un post del blog en ±45 días.
    if (item.kind === 'azure-update') {
      const t = Date.parse(item.publishedAt);
      const match = blogs.find(
        (b) => Math.abs(Date.parse(b.publishedAt) - t) <= 45 * 86_400_000 && titleSimilarity(item.title, b.title) >= 0.6,
      );
      if (match && attach(item, match)) linked++;
    }
  }
  return linked;
}

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

export function quarterStart(releaseDate: string): string | null {
  const m = /Q([1-4])\s*(\d{4})/i.exec(releaseDate);
  if (!m) return null;
  const q = Number(m[1]);
  return new Date(Date.UTC(Number(m[2]), (q - 1) * 3, 1)).toISOString();
}

function normType(t: string): RoadmapReleaseType {
  return /general/i.test(t) ? 'ga' : 'preview';
}

function normStatus(s: string): RoadmapStatus {
  return /ship/i.test(s) ? 'shipped' : 'planned';
}

export function upsertRoadmap(store: Map<string, RoadmapItem>, raw: RawRoadmapItem, now: string): UpsertResult {
  const id = `rm-${raw.releaseItemId}`;
  if (!raw.name) return { outcome: 'rejected', reason: 'elemento sin nombre', id };
  const category: CategoryId =
    ROADMAP_PRODUCT_CATEGORY[raw.product] ?? classifyCategories(raw.name, raw.description).primary;
  // Afinar categorías transversales dentro de un producto (Direct Lake, Activator, Copilot, seguridad)
  const refined = classifyCategories(raw.name, '', category);
  const special: CategoryId[] = ['direct-lake', 'data-activator', 'copilot-ai', 'security'];
  const finalCategory = special.includes(refined.primary) && (refined.scores[refined.primary] ?? 0) >= 4 ? refined.primary : category;

  const next = {
    product: raw.product,
    productId: raw.productId,
    category: finalCategory,
    name: raw.name,
    description: raw.description,
    releaseType: normType(raw.releaseType),
    releaseStatus: normStatus(raw.releaseStatus),
    releaseDate: raw.releaseDate,
    releaseQuarterStart: quarterStart(raw.releaseDate),
    wave: raw.wave,
    url: roadmapItemUrl(raw.productQuery, raw.releaseItemId),
    contentHash: sha256(JSON.stringify([raw.name, raw.description])),
  };

  const existing = store.get(id);
  if (!existing) {
    store.set(id, {
      id,
      releaseItemId: raw.releaseItemId,
      ...next,
      detectedAt: now,
      updatedAt: now,
      history: [],
      ai: { status: 'pending', attempts: 0 },
    });
    return { outcome: 'created', id };
  }

  const changes: RoadmapChange[] = [];
  const track = ['releaseStatus', 'releaseType', 'releaseDate', 'name', 'description'] as const;
  for (const field of track) {
    if (existing[field] !== next[field]) {
      changes.push({
        at: now,
        field,
        from: String(existing[field]).slice(0, 300),
        to: String(next[field]).slice(0, 300),
      });
    }
  }
  const merged: RoadmapItem = { ...existing, ...next, history: [...existing.history, ...changes] };
  delete merged.removedFromSourceAt;
  if (next.contentHash !== existing.contentHash) {
    merged.ai = { ...existing.ai, status: 'pending', attempts: 0 };
    delete merged.ai.lastError;
  }
  const before = JSON.stringify({ ...existing, updatedAt: '' });
  const after = JSON.stringify({ ...merged, updatedAt: '' });
  if (before === after) return { outcome: 'unchanged', id };
  merged.updatedAt = now;
  store.set(id, merged);
  return { outcome: 'updated', id };
}

export function markRoadmapRemoved(
  store: Map<string, RoadmapItem>,
  completeProductIds: Set<string>,
  seenIds: Set<string>,
  now: string,
): number {
  let n = 0;
  for (const item of store.values()) {
    if (completeProductIds.has(item.productId) && !seenIds.has(item.id) && !item.removedFromSourceAt) {
      item.removedFromSourceAt = now;
      item.updatedAt = now;
      n++;
    }
  }
  return n;
}

export { canonicalUrl };
