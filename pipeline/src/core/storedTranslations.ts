import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RoadmapItem, UpdateItem } from '../../../shared/types';
import { sha1 } from './text';

/** Traducciones revisadas y guardadas en el repositorio (data/translations). */
export const STORED_MODEL = 'claude-traduccion-guardada';

export interface StoredUpdateTranslation {
  /** Título original con el que se hizo la traducción (si cambia, la traducción deja de aplicarse). */
  en: string;
  titleEs: string;
  summaryEs: string;
}

export interface StoredRoadmapTranslation {
  en: string;
  nameEs: string;
  descriptionEs?: string;
  /** sha1 de la descripción original traducida (solo si se tradujo la descripción). */
  descHash?: string;
}

async function readMap<T>(file: string): Promise<Record<string, T>> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, T>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

export function descriptionHash(description: string): string {
  return sha1(description.trim()).slice(0, 16);
}

export async function applyStoredTranslations(
  dataDir: string,
  updates: Map<string, UpdateItem>,
  roadmap: Map<string, RoadmapItem>,
  now: string,
): Promise<{ updates: number; roadmap: number }> {
  const dir = path.join(dataDir, 'translations');
  const u = await readMap<StoredUpdateTranslation>(path.join(dir, 'updates.json'));
  const r = await readMap<StoredRoadmapTranslation>(path.join(dir, 'roadmap.json'));
  let nu = 0;
  let nr = 0;

  for (const [id, t] of Object.entries(u)) {
    const item = updates.get(id);
    if (!item || item.title !== t.en) continue;
    // Una traducción con IA o la oficial de Microsoft sobre el contenido vigente tiene prioridad.
    if (item.tr?.status === 'done' && item.tr.sourceHash === item.contentHash && item.tr.model !== STORED_MODEL) continue;
    const same =
      item.tr?.model === STORED_MODEL &&
      item.tr.sourceHash === item.contentHash &&
      item.tr.result?.titleEs === t.titleEs &&
      item.tr.result?.summaryEs === t.summaryEs;
    if (same) continue;
    item.tr = {
      status: 'done',
      sourceHash: item.contentHash,
      model: STORED_MODEL,
      generatedAt: now,
      attempts: 0,
      result: { titleEs: t.titleEs, summaryEs: t.summaryEs },
    };
    item.updatedAt = now;
    nu++;
  }

  for (const [id, t] of Object.entries(r)) {
    const item = roadmap.get(id);
    if (!item || item.name !== t.en) continue;
    if (item.ai.status === 'done' && item.ai.sourceHash === item.contentHash && item.ai.model !== STORED_MODEL) continue;
    const descOk = !item.description.trim() || Boolean(t.descriptionEs && t.descHash && t.descHash === descriptionHash(item.description));
    const result = { nameEs: t.nameEs, descriptionEs: descOk ? t.descriptionEs! : '' };
    if (item.ai.result?.nameEs === result.nameEs && item.ai.result?.descriptionEs === result.descriptionEs) continue;
    item.ai = descOk
      ? { status: 'done', sourceHash: item.contentHash, model: STORED_MODEL, generatedAt: now, attempts: item.ai.attempts, result }
      : // Solo el nombre: queda pendiente para que la IA traduzca la descripción cuando esté disponible.
        { ...item.ai, status: item.ai.status === 'error' ? 'pending' : item.ai.status, model: STORED_MODEL, result };
    item.updatedAt = now;
    nr++;
  }
  return { updates: nu, roadmap: nr };
}
