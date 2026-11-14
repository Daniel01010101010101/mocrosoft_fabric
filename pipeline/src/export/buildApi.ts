import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ApiMeta,
  RoadmapItem,
  RoadmapSummary,
  StatusResponse,
  UpdateDetail,
  UpdateItem,
  UpdateSummary,
} from '../../../shared/types';
import { API_OUT_DIR, APP_VERSION, DATA_DIR } from '../config';
import { Store } from '../core/store';

export function toSummary(item: UpdateItem): UpdateSummary {
  const analysis = item.ai.status === 'done' || item.ai.result ? item.ai.result : undefined;
  const tr = item.tr?.status === 'done' && item.tr.sourceHash === item.contentHash ? item.tr.result : undefined;
  return {
    id: item.id,
    kind: item.kind,
    source: item.source,
    url: item.url,
    titleEs: analysis?.titleEs ?? tr?.titleEs ?? null,
    titleOriginal: item.title,
    summaryEs: analysis?.executiveSummary ?? tr?.summaryEs ?? null,
    excerptOriginal: item.content.excerpt,
    publishedAt: item.publishedAt,
    datePrecision: item.datePrecision,
    undated: item.datePrecision === 'detected' && item.meta.backfill === 'true',
    detectedAt: item.detectedAt,
    primaryCategory: item.primaryCategory,
    categories: item.categories,
    type: item.type,
    stage: item.stage,
    technologies: item.technologies,
    impactScore: item.impact.score,
    impactLevel: item.impact.level,
    transformative: item.impact.transformative,
    audiences: item.impact.audiences,
    image: item.content.images[0]?.src ?? null,
    aiStatus: item.ai.status,
    translated: Boolean(analysis?.titleEs ?? tr?.titleEs),
    originalLanguage: item.originalLanguage,
  };
}

export function toRoadmapSummary(item: RoadmapItem): RoadmapSummary {
  return {
    id: item.id,
    product: item.product,
    category: item.category,
    name: item.name,
    nameEs: item.ai.result?.nameEs ?? null,
    description: item.description,
    descriptionEs: item.ai.result?.descriptionEs ?? null,
    releaseType: item.releaseType,
    releaseStatus: item.releaseStatus,
    releaseDate: item.releaseDate,
    releaseQuarterStart: item.releaseQuarterStart,
    wave: item.wave,
    url: item.url,
    detectedAt: item.detectedAt,
    updatedAt: item.updatedAt,
    removedFromSource: Boolean(item.removedFromSourceAt),
    history: item.history,
    aiStatus: item.ai.status,
  };
}

function relatedFor(item: UpdateItem, all: UpdateItem[], byId: Map<string, UpdateItem>): UpdateSummary[] {
  const picked = new Map<string, UpdateItem>();
  for (const id of item.relatedIds) {
    const r = byId.get(id);
    if (r && !r.duplicateOf && r.id !== item.id) picked.set(r.id, r);
  }
  const t = Date.parse(item.publishedAt);
  const sameCategory = all
    .filter((o) => o.id !== item.id && !o.duplicateOf && o.categories.includes(item.primaryCategory))
    .sort((a, b) => Math.abs(Date.parse(a.publishedAt) - t) - Math.abs(Date.parse(b.publishedAt) - t));
  for (const o of sameCategory) {
    if (picked.size >= 4) break;
    picked.set(o.id, o);
  }
  return [...picked.values()].slice(0, 4).map(toSummary);
}

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value), 'utf8');
}

/**
 * Genera la API estática (JSON) que consume el frontend a partir de la base de datos.
 * Se ejecuta en cada build: el frontend nunca lee directamente de las fuentes.
 */
export async function buildApi(opts: { dataDir?: string; outDir?: string } = {}): Promise<ApiMeta> {
  const dataDir = opts.dataDir ?? DATA_DIR;
  const outDir = opts.outDir ?? API_OUT_DIR;
  const store = await Store.load(dataDir);

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(path.join(outDir, 'updates'), { recursive: true });

  const all = [...store.updates.values()];
  const visible = all
    .filter((u) => !u.duplicateOf)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.detectedAt.localeCompare(a.detectedAt));
  const byId = new Map(all.map((u) => [u.id, u]));

  await writeJson(path.join(outDir, 'updates.json'), visible.map(toSummary));

  for (const item of visible) {
    const analysis = item.ai.result ?? null;
    const detail: UpdateDetail = {
      ...toSummary(item),
      docsUrl: item.docsUrl ?? null,
      author: item.author ?? null,
      updatedAt: item.updatedAt,
      analysis,
      aiModel: item.ai.model ?? null,
      aiGeneratedAt: item.ai.generatedAt ?? null,
      content: item.content,
      relatedSources: item.relatedSources,
      related: relatedFor(item, visible, byId),
      meta: item.meta,
    };
    await writeJson(path.join(outDir, 'updates', `${item.id}.json`), detail);
  }

  const aliases = Object.fromEntries(all.filter((u) => u.duplicateOf).map((u) => [u.id, u.duplicateOf!]));
  await writeJson(path.join(outDir, 'aliases.json'), aliases);

  const roadmap = [...store.roadmap.values()]
    .sort((a, b) => (b.releaseQuarterStart ?? '').localeCompare(a.releaseQuarterStart ?? '') || a.name.localeCompare(b.name))
    .map(toRoadmapSummary);
  await writeJson(path.join(outDir, 'roadmap.json'), roadmap);

  const status = await Store.readStatus(dataDir);
  const runs = await Store.readRecentRuns(dataDir, 40);
  const statusResponse: StatusResponse | { status: null; runs: [] } = status ? { status, runs } : { status: null, runs: [] };
  await writeJson(path.join(outDir, 'status.json'), statusResponse);

  const meta: ApiMeta = {
    generatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    updates: visible.length,
    roadmap: roadmap.length,
  };
  await writeJson(path.join(outDir, 'meta.json'), meta);
  return meta;
}
