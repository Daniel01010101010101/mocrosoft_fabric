import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RoadmapItem, UpdateItem } from '../../shared/types';
import { upsertRoadmap, upsertUpdate } from '../src/core/ingest';
import { applyLearnSpanish, LEARN_ES_MODEL, normalizeLink } from '../src/core/learnSpanish';
import { applyStoredTranslations, descriptionHash, STORED_MODEL } from '../src/core/storedTranslations';
import { parseWhatsNew } from '../src/sources/learnWhatsNew';

const EN = `<h2 id="features-currently-in-preview">Features currently in preview</h2><table><tbody>
<tr><td><strong>Activator rule management (Preview)</strong></td><td><a href="https://community.fabric.microsoft.com/t5/B/S/ba-p/1#x">Rule management</a> provides a central view.</td></tr>
<tr><td><strong>Event Schema Registry (Preview)</strong></td><td>Registers schemas. See <a href="../real-time-hub/schema">docs</a>.</td></tr>
</tbody></table>`;
const ES = `<h2 id="features-currently-in-preview">Características en versión preliminar</h2><table><tbody>
<tr><td><strong>Gestión de reglas del activador (versión preliminar)</strong></td><td><a href="https://community.fabric.microsoft.com/t5/B/S/ba-p/1#x">Gestión de reglas</a> ofrece una vista central.</td></tr>
<tr><td><strong>Registro de esquemas de eventos (versión preliminar)</strong></td><td>Registra esquemas. Consulte <a href="../real-time-hub/schema">documentación</a>.</td></tr>
</tbody></table>`;

describe('Traducción oficial de Microsoft Learn', () => {
  it('normaliza enlaces sin configuración regional', () => {
    expect(normalizeLink('https://learn.microsoft.com/es-es/fabric/x/')).toBe(normalizeLink('https://learn.microsoft.com/en-us/fabric/x'));
  });

  it('aplica la versión en español emparejando posición y enlace', () => {
    const store = new Map<string, UpdateItem>();
    const now = '2026-11-14T00:00:00.000Z';
    for (const raw of parseWhatsNew(EN, now)) upsertUpdate(store, raw, now);
    const esRows = parseWhatsNew(ES, now).map((r) => ({
      ...r,
      url: r.url.replace('/en-us/', '/es-es/'),
    }));
    expect(applyLearnSpanish(store, esRows, now)).toBe(2);
    const items = [...store.values()];
    const rule = items.find((i) => i.title.startsWith('Activator'))!;
    expect(rule.tr?.model).toBe(LEARN_ES_MODEL);
    expect(rule.tr?.result?.titleEs).toBe('Gestión de reglas del activador (versión preliminar)');
    expect(rule.tr?.result?.summaryEs).toContain('vista central');
    // Idempotente
    expect(applyLearnSpanish(store, esRows, now)).toBe(0);
  });

  it('no aplica filas cuyo enlace no coincide', () => {
    const store = new Map<string, UpdateItem>();
    const now = '2026-11-14T00:00:00.000Z';
    for (const raw of parseWhatsNew(EN, now)) upsertUpdate(store, raw, now);
    const esRows = parseWhatsNew(ES, now).map((r) => ({ ...r, url: 'https://learn.microsoft.com/es-es/otra-cosa' }));
    expect(applyLearnSpanish(store, esRows, now)).toBe(0);
  });
});

describe('Traducciones guardadas en el repositorio', () => {
  it('aplica nombres y descripciones solo si el original no ha cambiado', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fr-tr-'));
    const now = '2026-11-14T00:00:00.000Z';
    const roadmap = new Map<string, RoadmapItem>();
    const base = { product: 'Data Factory', productId: 'p', productQuery: 'df', releaseType: 'General availability', releaseStatus: 'Planned', releaseDate: 'Q1 2027', wave: 'w' };
    upsertRoadmap(roadmap, { ...base, releaseItemId: 'a', name: 'Copy job CDC', description: 'Captures changes.' }, now);
    upsertRoadmap(roadmap, { ...base, releaseItemId: 'b', name: 'Old name', description: 'Desc' }, now);
    const updates = new Map<string, UpdateItem>();
    await fs.mkdir(path.join(dir, 'translations'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'translations', 'roadmap.json'),
      JSON.stringify({
        'rm-a': { en: 'Copy job CDC', nameEs: 'CDC en Copy job', descriptionEs: 'Captura cambios.', descHash: descriptionHash('Captures changes.') },
        'rm-b': { en: 'Different name', nameEs: 'Nombre' },
      }),
    );
    const res = await applyStoredTranslations(dir, updates, roadmap, now);
    expect(res.roadmap).toBe(1);
    const a = roadmap.get('rm-a')!;
    expect(a.ai.status).toBe('done');
    expect(a.ai.model).toBe(STORED_MODEL);
    expect(a.ai.result).toEqual({ nameEs: 'CDC en Copy job', descriptionEs: 'Captura cambios.' });
    expect(roadmap.get('rm-b')!.ai.result).toBeUndefined();
    await fs.rm(dir, { recursive: true, force: true });
  });
});
