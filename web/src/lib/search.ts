import MiniSearch from 'minisearch';
import { CATEGORY_BY_ID } from '../../../shared/categories';
import type { RoadmapSummary, UpdateSummary } from '../../../shared/types';

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const STOP = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'del', 'para', 'con', 'por', 'un', 'una', 'the', 'and', 'of', 'to', 'in', 'for', 'on']);

interface Doc {
  id: string;
  kind: 'update' | 'roadmap';
  title: string;
  alt: string;
  body: string;
  tags: string;
}

const updateOnlyCache = new WeakMap<object, MiniSearch<Doc>>();
const combinedCache = new WeakMap<object, { updates: object; ms: MiniSearch<Doc> }>();

function build(updates: UpdateSummary[], roadmap: RoadmapSummary[]): MiniSearch<Doc> {
  const ms = new MiniSearch<Doc>({
    fields: ['title', 'alt', 'body', 'tags'],
    storeFields: ['kind'],
    processTerm: (term) => {
      const t = normalize(term);
      return t.length < 2 || STOP.has(t) ? null : t;
    },
    searchOptions: { boost: { title: 3, alt: 2, tags: 1.5 }, prefix: true, fuzzy: 0.18, combineWith: 'AND' },
  });
  ms.addAll([
    ...updates.map((u) => ({
      id: u.id,
      kind: 'update' as const,
      title: u.titleEs ?? u.titleOriginal,
      alt: u.titleOriginal,
      body: `${u.summaryEs ?? ''} ${u.excerptOriginal}`,
      tags: [...u.technologies, ...u.categories.map((c) => CATEGORY_BY_ID[c]?.name ?? c)].join(' '),
    })),
    ...roadmap.map((r) => ({
      id: r.id,
      kind: 'roadmap' as const,
      title: r.nameEs ?? r.name,
      alt: r.name,
      body: `${r.descriptionEs ?? ''} ${r.description}`.slice(0, 1200),
      tags: `${r.product} ${CATEGORY_BY_ID[r.category]?.name ?? ''}`,
    })),
  ]);
  return ms;
}

export function getIndex(updates: UpdateSummary[], roadmap: RoadmapSummary[]): MiniSearch<Doc> {
  if (roadmap.length === 0) {
    const existing = updateOnlyCache.get(updates);
    if (existing) return existing;
    const ms = build(updates, []);
    updateOnlyCache.set(updates, ms);
    return ms;
  }
  const hit = combinedCache.get(roadmap);
  if (hit && hit.updates === updates) return hit.ms;
  const ms = build(updates, roadmap);
  combinedCache.set(roadmap, { updates, ms });
  return ms;
}

export interface SearchHit {
  id: string;
  kind: 'update' | 'roadmap';
  score: number;
}

export function search(updates: UpdateSummary[], roadmap: RoadmapSummary[], query: string, limit = 50): SearchHit[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const ms = getIndex(updates, roadmap);
  let results = ms.search(q);
  if (results.length === 0) results = ms.search(q, { combineWith: 'OR' });
  return results.slice(0, limit).map((r) => ({ id: String(r.id), kind: r.kind as SearchHit['kind'], score: r.score }));
}

/** Ids de novedades que coinciden con la búsqueda (para filtrar listados). */
export function matchingUpdateIds(updates: UpdateSummary[], query: string): Set<string> | null {
  const q = query.trim();
  if (q.length < 2) return null;
  const ms = getIndex(updates, []);
  let results = ms.search(q, { filter: (r) => r.kind === 'update' });
  if (results.length === 0) results = ms.search(q, { combineWith: 'OR', filter: (r) => r.kind === 'update' });
  return new Set(results.map((r) => String(r.id)));
}
