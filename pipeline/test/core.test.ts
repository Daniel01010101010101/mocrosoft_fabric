import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { nextScheduledRun, previousScheduledRun, SCHEDULE } from '../../shared/schedule';
import type { RoadmapItem, SourceRunResult, UpdateItem } from '../../shared/types';
import { classifyCategories, detectStage, detectType } from '../src/core/classify';
import { fetchText, HttpError } from '../src/core/http';
import { linkDuplicates, upsertRoadmap, upsertUpdate } from '../src/core/ingest';
import { detectLanguage } from '../src/core/language';
import { Store } from '../src/core/store';
import { extractContent, titleSimilarity } from '../src/core/text';
import { canonicalUrl, isOfficialUrl, validateCandidate } from '../src/core/validate';
import { computeRunStatus } from '../src/run';
import type { RawRoadmapItem, RawUpdate } from '../src/sources/types';

function raw(overrides: Partial<RawUpdate> = {}): RawUpdate {
  return {
    id: 'cm-1',
    kind: 'blog',
    source: 'fabric-blog',
    url: 'https://community.fabric.microsoft.com/t5/Fabric-Updates-Blog/Post/ba-p/1',
    title: 'Direct Lake on OneLake is now generally available',
    publishedAt: '2026-11-01T10:00:00.000Z',
    datePrecision: 'exact',
    html: '<p>Direct Lake semantic models can now read Delta tables from OneLake. This is generally available.</p>',
    baseUrl: 'https://community.fabric.microsoft.com/t5/Fabric-Updates-Blog/Post/ba-p/1',
    meta: {},
    ...overrides,
  };
}

describe('Validación y fuentes verificables', () => {
  it('solo acepta dominios oficiales de Microsoft por HTTPS', () => {
    expect(isOfficialUrl('https://learn.microsoft.com/en-us/fabric/')).toBe(true);
    expect(isOfficialUrl('https://community.fabric.microsoft.com/t5/x/ba-p/1')).toBe(true);
    expect(isOfficialUrl('http://learn.microsoft.com/')).toBe(false);
    expect(isOfficialUrl('https://example.com/fabric')).toBe(false);
  });

  it('rechaza registros incompletos', () => {
    const ok = { url: 'https://learn.microsoft.com/x', title: 'Título válido', publishedAt: '2026-01-01', text: 'Contenido suficiente para validar.' };
    expect(validateCandidate(ok)).toBeNull();
    expect(validateCandidate({ ...ok, title: '' })).toMatch(/título/);
    expect(validateCandidate({ ...ok, url: 'https://evil.example/x' })).toMatch(/fuente oficial/);
    expect(validateCandidate({ ...ok, publishedAt: 'nope' })).toMatch(/fecha/);
    expect(validateCandidate({ ...ok, text: 'corto' })).toMatch(/contenido/);
  });

  it('normaliza URLs eliminando parámetros de seguimiento', () => {
    expect(canonicalUrl('https://Learn.microsoft.com/a/?utm_source=x&id=1#frag')).toBe('https://learn.microsoft.com/a?id=1');
  });
});

describe('Detección de idioma', () => {
  it('distingue inglés y español', () => {
    expect(detectLanguage('This is the new feature and you can use it with your data in the lakehouse.').lang).toBe('en');
    expect(detectLanguage('Esta es la nueva funcionalidad que se puede usar con los datos del lakehouse para la empresa.').lang).toBe('es');
  });
  it('usa el idioma declarado por la fuente en textos muy cortos', () => {
    expect(detectLanguage('Eventstream Private Link', 'en').lang).toBe('en');
  });
});

describe('Clasificación heurística', () => {
  it('asigna categorías por palabras clave', () => {
    expect(classifyCategories('Direct Lake on OneLake', '').categories).toContain('direct-lake');
    expect(classifyCategories('New Eventhouse capabilities for KQL', '').primary).toBe('real-time-intelligence');
    expect(classifyCategories('Copilot in Power BI reports', '').categories).toEqual(expect.arrayContaining(['power-bi', 'copilot-ai']));
    expect(classifyCategories('Something unrelated', '').primary).toBe('platform');
  });
  it('detecta fase y tipo', () => {
    expect(detectStage('Feature X (Preview)')).toBe('preview');
    expect(detectStage('Feature X is now generally available')).toBe('ga');
    expect(detectType('Announcing the retirement of R visuals', 'blog')).toBe('deprecation');
    expect(detectType('Fabric September 2026 Feature Summary', 'blog')).toBe('summary');
    expect(detectType('Join us at FabCon 2027', 'blog')).toBe('event');
  });
});

describe('Extracción de contenido', () => {
  it('extrae texto, código y enlaces, y sanea el HTML', () => {
    const c = extractContent(
      '<P>Hola <A href="/fabric/x">docs</A></P><LI-CODE lang="python">df = spark.read.table("x")</LI-CODE><img><script>alert(1)</script>',
      { baseUrl: 'https://learn.microsoft.com/en-us/fabric/a' },
    );
    expect(c.text).toContain('Hola docs');
    expect(c.codeBlocks[0]).toEqual({ language: 'python', code: 'df = spark.read.table("x")' });
    expect(c.links[0]!.url).toBe('https://learn.microsoft.com/fabric/x');
    expect(c.images).toHaveLength(0);
    expect(c.html).not.toContain('script');
    expect(c.html).toContain('target="_blank"');
  });
  it('compara títulos por similitud', () => {
    expect(titleSimilarity('OneLake security (Preview)', 'Announcing OneLake security preview')).toBeGreaterThan(0.6);
    expect(titleSimilarity('OneLake security', 'Copilot in Notebooks')).toBe(0);
  });
});

describe('Ingesta, duplicados e histórico', () => {
  it('inserta, no duplica y es idempotente', () => {
    const store = new Map<string, UpdateItem>();
    expect(upsertUpdate(store, raw(), '2026-11-02T00:00:00.000Z').outcome).toBe('created');
    expect(upsertUpdate(store, raw(), '2026-11-03T00:00:00.000Z').outcome).toBe('unchanged');
    expect(store.size).toBe(1);
    expect(store.get('cm-1')!.detectedAt).toBe('2026-11-02T00:00:00.000Z');
  });

  it('conserva el análisis de IA si el contenido no cambia y lo invalida si cambia', () => {
    const store = new Map<string, UpdateItem>();
    upsertUpdate(store, raw(), '2026-11-02T00:00:00.000Z');
    const item = store.get('cm-1')!;
    item.ai = { status: 'done', attempts: 1, sourceHash: item.contentHash };
    expect(upsertUpdate(store, raw(), '2026-11-03T00:00:00.000Z').outcome).toBe('unchanged');
    expect(store.get('cm-1')!.ai.status).toBe('done');
    upsertUpdate(store, raw({ html: '<p>Contenido actualizado por Microsoft con nuevos detalles importantes.</p>' }), '2026-11-04T00:00:00.000Z');
    expect(store.get('cm-1')!.ai.status).toBe('pending');
    expect(store.get('cm-1')!.detectedAt).toBe('2026-11-02T00:00:00.000Z');
  });

  it('nunca sustituye una fecha original por la fecha de detección', () => {
    const store = new Map<string, UpdateItem>();
    const r = raw({ id: 'wn-1', kind: 'whats-new', source: 'learn-whats-new', datePrecision: 'detected', publishedAt: '2026-11-02T00:00:00.000Z' });
    upsertUpdate(store, r, '2026-11-02T00:00:00.000Z');
    upsertUpdate(store, { ...r, publishedAt: '2026-11-05T00:00:00.000Z' }, '2026-11-05T00:00:00.000Z');
    expect(store.get('wn-1')!.publishedAt).toBe('2026-11-02T00:00:00.000Z');
    upsertUpdate(store, { ...r, publishedAt: '2026-09-01T00:00:00.000Z', datePrecision: 'month' }, '2026-11-06T00:00:00.000Z');
    expect(store.get('wn-1')!.publishedAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('rechaza registros sin fuente verificable', () => {
    const store = new Map<string, UpdateItem>();
    const res = upsertUpdate(store, raw({ url: 'https://example.com/x' }), '2026-11-02T00:00:00.000Z');
    expect(res.outcome).toBe('rejected');
    expect(store.size).toBe(0);
  });

  it('vincula la entrada de Learn con el post del blog equivalente', () => {
    const store = new Map<string, UpdateItem>();
    upsertUpdate(store, raw({ id: 'cm-77', title: 'OneLake security is now generally available', url: 'https://community.fabric.microsoft.com/t5/B/x/ba-p/77' }), '2026-11-02T00:00:00.000Z');
    upsertUpdate(
      store,
      raw({
        id: 'wn-a',
        kind: 'whats-new',
        source: 'learn-whats-new',
        title: 'OneLake security (Generally Available)',
        url: 'https://community.fabric.microsoft.com/t5/B/x/ba-p/77',
        datePrecision: 'detected',
        meta: { section: 'ga', blogUrl: 'https://community.fabric.microsoft.com/t5/B/x/ba-p/77' },
      }),
      '2026-11-02T00:00:00.000Z',
    );
    expect(linkDuplicates(store, '2026-11-02T00:00:00.000Z')).toBe(1);
    expect(store.get('wn-a')!.duplicateOf).toBe('cm-77');
    expect(store.get('cm-77')!.relatedSources).toHaveLength(1);
    // Idempotente
    expect(linkDuplicates(store, '2026-11-03T00:00:00.000Z')).toBe(0);
  });

  it('registra el historial de cambios del roadmap', () => {
    const store = new Map<string, RoadmapItem>();
    const r: RawRoadmapItem = {
      releaseItemId: 'abc',
      product: 'Data Factory',
      productId: 'p',
      productQuery: 'datafactory',
      name: 'Copy job CDC',
      description: 'desc',
      releaseType: 'Public preview',
      releaseStatus: 'Planned',
      releaseDate: 'Q3 2026',
      wave: '2026 Wave 1',
    };
    expect(upsertRoadmap(store, r, '2026-07-01T00:00:00.000Z').outcome).toBe('created');
    expect(upsertRoadmap(store, r, '2026-07-02T00:00:00.000Z').outcome).toBe('unchanged');
    expect(upsertRoadmap(store, { ...r, releaseStatus: 'Shipped' }, '2026-09-01T00:00:00.000Z').outcome).toBe('updated');
    const item = store.get('rm-abc')!;
    expect(item.releaseStatus).toBe('shipped');
    expect(item.releaseQuarterStart).toBe('2026-07-01T00:00:00.000Z');
    expect(item.history).toEqual([{ at: '2026-09-01T00:00:00.000Z', field: 'releaseStatus', from: 'planned', to: 'shipped' }]);
  });
});

describe('Estado de la ejecución', () => {
  const ok = (source: SourceRunResult['source']): SourceRunResult => ({
    source,
    status: 'ok',
    attempts: 1,
    durationMs: 1,
    fetched: 1,
    created: 0,
    updated: 0,
    unchanged: 1,
    rejected: 0,
  });
  it('solo es exitosa si todas las fuentes respondieron sin errores', () => {
    expect(computeRunStatus([ok('fabric-blog'), ok('learn-whats-new')], [])).toBe('success');
    expect(computeRunStatus([ok('fabric-blog'), { ...ok('learn-whats-new'), status: 'error' }], [])).toBe('partial');
    expect(computeRunStatus([{ ...ok('fabric-blog'), status: 'error' }], [])).toBe('failed');
    expect(
      computeRunStatus([ok('fabric-blog')], [{ level: 'error', stage: 'ai', message: 'x', at: '' }]),
    ).toBe('partial');
    expect(
      computeRunStatus([ok('fabric-blog')], [{ level: 'error', stage: 'store', message: 'x', at: '' }]),
    ).toBe('failed');
  });
});

describe('Cliente HTTP con reintentos', () => {
  const opts = { timeoutMs: 1000, retries: 2, userAgent: 't', sleep: async () => {} };
  it('reintenta errores transitorios y devuelve el contenido', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return calls < 3 ? new Response('busy', { status: 503 }) : new Response('ok', { status: 200, headers: { etag: '"v1"' } });
    }) as unknown as typeof fetch;
    const res = await fetchText('https://x.test', { ...opts, fetchImpl });
    expect(res.body).toBe('ok');
    expect(res.attempts).toBe(3);
    expect(res.etag).toBe('"v1"');
  });
  it('no reintenta errores definitivos (404)', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response('nope', { status: 404 });
    }) as unknown as typeof fetch;
    await expect(fetchText('https://x.test', { ...opts, fetchImpl })).rejects.toBeInstanceOf(HttpError);
    expect(calls).toBe(1);
  });
  it('envía cabeceras condicionales y reconoce 304', async () => {
    let seen: Record<string, string> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      seen = init.headers as Record<string, string>;
      return new Response(null, { status: 304 });
    }) as unknown as typeof fetch;
    const res = await fetchText('https://x.test', { ...opts, fetchImpl, cache: { etag: '"v1"', fetchedAt: '' } });
    expect(seen['if-none-match']).toBe('"v1"');
    expect(res.notModified).toBe(true);
  });
});

describe('Calendario de ejecuciones', () => {
  it('programa 5 ejecuciones diarias', () => {
    expect(SCHEDULE).toHaveLength(5);
  });
  it('coincide con los cron del workflow de GitHub Actions', async () => {
    const yml = parseYaml(await fs.readFile(new URL('../../.github/workflows/ingest.yml', import.meta.url), 'utf8')) as {
      on: { schedule: { cron: string }[] };
    };
    expect(yml.on.schedule.map((s) => s.cron)).toEqual(SCHEDULE.map((s) => s.cron));
    for (const s of SCHEDULE) expect(s.cron).toBe(`${s.minuteUtc} ${s.hourUtc} * * *`);
  });
  it('calcula la próxima y la anterior ejecución', () => {
    const at = new Date('2026-11-12T12:00:00Z');
    expect(nextScheduledRun(at).toISOString()).toBe('2026-11-12T16:47:00.000Z');
    expect(previousScheduledRun(at).toISOString()).toBe('2026-11-12T11:17:00.000Z');
    expect(nextScheduledRun(new Date('2026-11-12T23:30:00Z')).toISOString()).toBe('2026-11-13T06:17:00.000Z');
  });
});

describe('Base de datos documental', () => {
  it('persiste solo lo modificado y conserva el historial de ejecuciones', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fabric-radar-'));
    const store = await Store.load(dir);
    upsertUpdate(store.updates, raw(), '2026-11-02T00:00:00.000Z');
    expect(await store.save()).toEqual({ updates: 1, roadmap: 0 });
    expect(await store.save()).toEqual({ updates: 0, roadmap: 0 });
    const reloaded = await Store.load(dir);
    expect(reloaded.updates.get('cm-1')!.title).toBe(raw().title);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
