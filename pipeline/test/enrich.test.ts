import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { RunIssue } from '../../shared/types';
import { AiFatalError, AiItemError, ANTHROPIC_LIMITS } from '../src/ai/client';
import { batchBySize, enrich, needsAnalysis, needsTranslation } from '../src/ai/enrich';
import { RoadmapBatchSchema, UpdateTranslationBatchSchema, type AnalysisOutput } from '../src/ai/schema';
import { loadConfig, type PipelineConfig } from '../src/config';
import { upsertRoadmap, upsertUpdate } from '../src/core/ingest';
import { Store } from '../src/core/store';

const dirs: string[] = [];
afterEach(async () => {
  for (const d of dirs.splice(0)) await fs.rm(d, { recursive: true, force: true });
});

async function makeStore(): Promise<Store> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fabric-radar-ai-'));
  dirs.push(dir);
  const store = await Store.load(dir);
  upsertUpdate(
    store.updates,
    {
      id: 'cm-10',
      kind: 'blog',
      source: 'fabric-blog',
      url: 'https://community.fabric.microsoft.com/t5/Fabric-Updates-Blog/Post/ba-p/10',
      title: 'Copilot for Data Factory is now generally available',
      publishedAt: new Date().toISOString(),
      datePrecision: 'exact',
      html: '<p>Copilot helps you build pipelines and dataflows with natural language. It is now generally available.</p>',
      baseUrl: 'https://community.fabric.microsoft.com/',
      meta: {},
    },
    new Date().toISOString(),
  );
  upsertRoadmap(
    store.roadmap,
    {
      releaseItemId: 'r1',
      product: 'Data Factory',
      productId: 'p',
      productQuery: 'datafactory',
      name: 'Copy job incremental copy',
      description: 'Copy job supports incremental copy.',
      releaseType: 'General availability',
      releaseStatus: 'Planned',
      releaseDate: 'Q1 2027',
      wave: '2026 Wave 2',
    },
    new Date().toISOString(),
  );
  return store;
}

const ANALYSIS: AnalysisOutput = {
  detectedLanguage: 'en',
  titleEs: 'Copilot para Data Factory ya está en disponibilidad general',
  executiveSummary: 'Resumen.',
  keyPoints: ['Punto'],
  whatIsIt: 'Qué es',
  howItWorks: 'Cómo funciona',
  flow: [{ label: 'Petición', detail: 'El usuario describe la tarea' }],
  problemSolved: 'Problema',
  advantages: ['Ventaja'],
  implementationSteps: ['Paso 1'],
  useCases: [{ title: 'Caso', scenario: 'Escenario' }],
  businessImpact: 'Impacto',
  considerations: [],
  codeExample: null,
  audiences: ['data-engineers'],
  primaryCategory: 'data-factory',
  secondaryCategories: ['copilot-ai', 'data-factory'],
  updateType: 'feature',
  stage: 'ga',
  technologies: ['Copilot', 'Data Factory', 'Copilot'],
  impactScore: 9.4,
  impactRationale: 'Muy relevante',
  transformative: true,
};

function config(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return { ...loadConfig(), anthropicApiKeyPresent: true, aiProvider: 'anthropic', aiMaxRequestsPerRun: 100, aiConcurrency: 1, ...overrides };
}

const base = { provider: 'anthropic' as const, model: 'claude-opus-5-5', limits: { ...ANTHROPIC_LIMITS, concurrency: 1 } };

describe('Traducción y análisis con IA', () => {
  it('sin clave configurada deja todo pendiente y lo avisa (no lo marca como traducido)', async () => {
    const store = await makeStore();
    const issues: RunIssue[] = [];
    const stats = await enrich({ store, config: config({ anthropicApiKeyPresent: false, aiProvider: 'none' }), issues });
    expect(stats.configured).toBe(false);
    expect(stats.pendingUpdates).toBe(1);
    expect(store.updates.get('cm-10')!.ai.status).toBe('pending');
    expect(issues[0]!.message).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('aplica el análisis, las categorías y el impacto; no repite la traducción si no hay cambios', async () => {
    const store = await makeStore();
    let calls = 0;
    const client = {
      ...base,
      structured: async (opts: { schema: unknown; user: string }) => {
        calls++;
        if (opts.schema === UpdateTranslationBatchSchema) {
          return {
            data: { items: [{ id: 'cm-10', titleEs: 'Copilot para Data Factory, disponible', summaryEs: 'Resumen breve.' }] },
            model: 'claude-opus-5-5',
            inputTokens: 5,
            outputTokens: 5,
          };
        }
        if (opts.schema === RoadmapBatchSchema) {
          return {
            data: { items: [{ id: 'rm-r1', nameEs: 'Copia incremental en Copy job', descriptionEs: 'Copy job admite copia incremental.' }] },
            model: 'claude-opus-5-5',
            inputTokens: 10,
            outputTokens: 10,
          };
        }
        return { data: ANALYSIS, model: 'claude-opus-5-5', inputTokens: 100, outputTokens: 200 };
      },
    };
    const issues: RunIssue[] = [];
    const stats = await enrich({ store, config: config(), issues, client: client as never });
    const item = store.updates.get('cm-10')!;
    expect(stats.succeeded).toBe(1);
    expect(stats.translated).toBe(1);
    expect(item.tr?.result?.titleEs).toMatch(/Copilot para Data Factory/);
    expect(stats.roadmapTranslated).toBe(1);
    expect(item.ai.status).toBe('done');
    expect(item.ai.sourceHash).toBe(item.contentHash);
    expect(item.ai.result!.titleEs).toMatch(/Copilot para Data Factory/);
    expect(item.categories).toEqual(['data-factory', 'copilot-ai']);
    expect(item.ai.result!.technologies).toEqual(['Copilot', 'Data Factory']);
    expect(item.ai.result!.impactScore).toBe(9);
    expect(item.impact.basis).toBe('ai');
    expect(item.impact.transformative).toBe(true);
    expect(store.roadmap.get('rm-r1')!.ai.result!.nameEs).toBe('Copia incremental en Copy job');

    // Segunda ejecución: nada pendiente, ninguna llamada nueva (caché por hash de contenido)
    const before = calls;
    await enrich({ store, config: config(), issues: [], client: client as never });
    expect(calls).toBe(before);
    expect(needsAnalysis(item, 5)).toBe(false);
    expect(needsTranslation(item, 5)).toBe(false);
  });

  it('registra los errores por elemento y los reintenta en ejecuciones posteriores', async () => {
    const store = await makeStore();
    const client = {
      ...base,
      structured: async () => {
        throw new AiItemError('respuesta incompleta');
      },
    };
    const issues: RunIssue[] = [];
    const stats = await enrich({ store, config: config({ aiMaxAttemptsPerItem: 2 }), issues, client: client as never });
    const item = store.updates.get('cm-10')!;
    expect(stats.failed).toBe(1);
    expect(item.ai.status).toBe('pending');
    expect(item.ai.lastError).toMatch(/incompleta/);
    expect(issues.some((i) => i.stage === 'ai' && i.level === 'error')).toBe(true);
    await enrich({ store, config: config({ aiMaxAttemptsPerItem: 2 }), issues: [], client: client as never });
    expect(item.ai.status).toBe('error');
    expect(needsAnalysis(item, 2)).toBe(false);
  });

  it('un error de credenciales detiene la fase de IA sin penalizar los elementos', async () => {
    const store = await makeStore();
    const client = {
      ...base,
      structured: async () => {
        throw new AiFatalError('Credenciales de IA no válidas');
      },
    };
    const issues: RunIssue[] = [];
    await enrich({ store, config: config(), issues, client: client as never });
    expect(store.updates.get('cm-10')!.ai.attempts).toBe(0);
    expect(issues.some((i) => /Credenciales/.test(i.message))).toBe(true);
  });
});

describe('Lotes de traducción', () => {
  it('agrupa respetando el número de elementos y el tamaño', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ id: i, size: 100 }));
    expect(batchBySize(items, (x) => x.size, 250, 10).map((b) => b.length)).toEqual([2, 2, 2, 1]);
    expect(batchBySize(items, (x) => x.size, 10_000, 3).map((b) => b.length)).toEqual([3, 3, 1]);
    // Un elemento mayor que el límite va solo en su lote
    expect(batchBySize([{ size: 500 }], (x) => x.size, 100, 3)).toHaveLength(1);
  });

  it('respeta el presupuesto de peticiones por ejecución', async () => {
    const store = await makeStore();
    let calls = 0;
    const client = {
      ...base,
      structured: async () => {
        calls++;
        throw new AiItemError('x');
      },
    };
    await enrich({ store, config: config({ aiMaxRequestsPerRun: 1 }), issues: [], client: client as never });
    expect(calls).toBe(1);
  });
});

