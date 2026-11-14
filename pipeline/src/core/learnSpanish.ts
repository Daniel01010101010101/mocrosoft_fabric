import type { UpdateItem } from '../../../shared/types';
import type { RawUpdate } from '../sources/types';
import { collapseWhitespace, extractContent, truncate } from './text';

export const LEARN_ES_MODEL = 'microsoft-learn-es';

/** Normaliza un enlace para comparar la versión inglesa y la española (sin configuración regional). */
export function normalizeLink(url: string): string {
  return url
    .toLowerCase()
    .replace(/\/(en-us|es-es|es-mx)\//, '/')
    .replace(/\/$/, '');
}

/**
 * Aplica la traducción oficial de Microsoft Learn (página "Novedades de Microsoft Fabric" en
 * español) a las novedades de Learn. Cada fila se empareja por sección y posición y solo se
 * acepta si apunta al mismo enlace oficial que la fila en inglés.
 */
export function applyLearnSpanish(updates: Map<string, UpdateItem>, esRows: RawUpdate[], now: string): number {
  const byPosition = new Map(esRows.map((r) => [r.meta.position, r]));
  let applied = 0;
  for (const item of updates.values()) {
    if (item.source !== 'learn-whats-new' || item.removedFromSourceAt || !item.meta.position) continue;
    const es = byPosition.get(item.meta.position);
    if (!es || normalizeLink(es.url) !== normalizeLink(item.url)) continue;
    // No sustituye una traducción hecha con IA sobre el contenido vigente.
    if (item.tr?.status === 'done' && item.tr.model !== LEARN_ES_MODEL && item.tr.sourceHash === item.contentHash) continue;
    const titleEs = collapseWhitespace(es.title);
    const summaryEs = truncate(extractContent(es.html, { baseUrl: es.baseUrl }).text.replace(/\s+/g, ' '), 600);
    if (!titleEs || !summaryEs) continue;
    const current = item.tr?.result;
    if (
      item.tr?.status === 'done' &&
      item.tr.sourceHash === item.contentHash &&
      current?.titleEs === titleEs &&
      current?.summaryEs === summaryEs
    ) {
      continue;
    }
    item.tr = {
      status: 'done',
      sourceHash: item.contentHash,
      model: LEARN_ES_MODEL,
      generatedAt: now,
      attempts: 0,
      result: { titleEs, summaryEs },
    };
    item.updatedAt = now;
    applied++;
  }
  return applied;
}
