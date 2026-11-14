import { z } from 'zod';
import type { PipelineConfig } from '../config';
import {
  AiFatalError,
  AiItemError,
  type ProviderLimits,
  type StructuredCallResult,
  type StructuredClient,
  type StructuredRequest,
} from './client';

const INFERENCE_URL = 'https://models.github.ai/inference/chat/completions';
const CATALOG_URL = 'https://models.github.ai/catalog/models';

/** Modelos preferidos, en orden, si el configurado no está disponible en el catálogo. */
const PREFERRED_MODELS = [
  'openai/gpt-4.1-mini',
  'openai/gpt-4o-mini',
  'openai/gpt-4.1',
  'openai/gpt-4o',
  'mistral-ai/mistral-medium-2505',
  'meta/llama-4-maverick-17b-128e-instruct-fp8',
];

/**
 * Límites conservadores: el nivel gratuito de GitHub Models admite ~8.000 tokens de entrada
 * y ~4.000 de salida por petición, con un número limitado de peticiones al día.
 */
export const GITHUB_LIMITS: ProviderLimits = {
  maxSourceChars: 9_000,
  maxDocChars: 2_500,
  maxDocs: 1,
  translateBatchChars: 9_000,
  translateBatchItems: 12,
  roadmapBatchChars: 6_500,
  roadmapBatchItems: 15,
  brief: true,
  concurrency: 2,
};

interface CatalogModel {
  id?: string;
  name?: string;
  rate_limit_tier?: string;
  supported_output_modalities?: string[];
}

type Fetch = typeof fetch;

/**
 * Cliente de GitHub Models: usa el token del propio workflow de GitHub Actions
 * (permiso `models: read`), sin claves ni cuentas adicionales.
 */
export class GitHubModelsClient implements StructuredClient {
  readonly provider = 'github' as const;
  readonly limits = GITHUB_LIMITS;
  private resolvedModel: string;
  private jsonSchemaSupported = true;

  constructor(
    private readonly config: PipelineConfig,
    private readonly fetchImpl: Fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    this.resolvedModel = config.githubModel;
  }

  get model(): string {
    return this.resolvedModel;
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.config.githubToken ?? ''}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    };
  }

  /** Comprueba en el catálogo que el modelo existe; si no, elige el mejor disponible. */
  async init(log: (m: string) => void = () => {}): Promise<void> {
    try {
      const res = await this.fetchImpl(CATALOG_URL, { headers: this.headers() });
      if (!res.ok) {
        log(`Catálogo de GitHub Models no disponible (HTTP ${res.status}); se usa ${this.resolvedModel}.`);
        return;
      }
      const models = (await res.json()) as CatalogModel[];
      const ids = new Set(models.map((m) => m.id ?? m.name ?? '').filter(Boolean));
      if (ids.has(this.config.githubModel)) return;
      const pick =
        PREFERRED_MODELS.find((m) => ids.has(m)) ??
        models.find((m) => (m.id ?? '').startsWith('openai/') && (m.supported_output_modalities ?? ['text']).includes('text'))?.id;
      if (pick) {
        log(`El modelo ${this.config.githubModel} no está en el catálogo; se usa ${pick}.`);
        this.resolvedModel = pick;
      }
    } catch (err) {
      log(`No se pudo leer el catálogo de GitHub Models: ${(err as Error).message}`);
    }
  }

  async structured<S extends z.ZodType>(opts: StructuredRequest<S>): Promise<StructuredCallResult<z.infer<S>>> {
    const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    const schemaHint = this.jsonSchemaSupported
      ? ''
      : `\n\nResponde ÚNICAMENTE con un objeto JSON válido que cumpla este JSON Schema:\n${JSON.stringify(jsonSchema)}`;

    const body: Record<string, unknown> = {
      model: this.resolvedModel,
      messages: [
        { role: 'system', content: opts.system + schemaHint },
        { role: 'user', content: opts.user },
      ],
      temperature: 0.2,
      max_tokens: Math.min(opts.maxTokens, 4000),
      response_format: this.jsonSchemaSupported
        ? { type: 'json_schema', json_schema: { name: 'respuesta', strict: true, schema: jsonSchema } }
        : { type: 'json_object' },
    };

    let res: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await this.fetchImpl(INFERENCE_URL, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
      } catch (err) {
        if (attempt === 3) throw new AiItemError(`Error de red con GitHub Models: ${(err as Error).message}`);
        await this.sleep(2000 * attempt);
        continue;
      }
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after') ?? '0');
        await res.text().catch(() => '');
        // Límite por minuto: se espera y se reintenta. Límite diario: se continúa en la próxima ejecución.
        if (retryAfter > 0 && retryAfter <= 65 && attempt < 3) {
          await this.sleep(retryAfter * 1000);
          continue;
        }
        throw new AiFatalError('Se alcanzó el límite de uso de GitHub Models; la traducción continuará en la próxima ejecución.');
      }
      if (res.status >= 500 && attempt < 3) {
        await res.text().catch(() => '');
        await this.sleep(3000 * attempt);
        continue;
      }
      break;
    }
    if (!res) throw new AiItemError('Sin respuesta de GitHub Models.');

    if (res.status === 401 || res.status === 403) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new AiFatalError(
        `GitHub Models rechazó el acceso (HTTP ${res.status}). El workflow necesita el permiso "models: read". ${detail}`.trim(),
      );
    }
    if (res.status === 404) {
      throw new AiFatalError(`Modelo de GitHub Models no disponible: "${this.resolvedModel}". Revisa la variable GH_MODELS_MODEL.`);
    }
    if (res.status === 400 || res.status === 422) {
      const text = await res.text().catch(() => '');
      if (this.jsonSchemaSupported && /response_format|json_schema|schema/i.test(text)) {
        // El modelo no admite salida con esquema estricto: se repite en modo JSON simple.
        this.jsonSchemaSupported = false;
        return this.structured(opts);
      }
      if (/tokens?_limit|too large|maximum context|max.*tokens/i.test(text)) {
        throw new AiItemError('El contenido supera el tamaño máximo admitido por GitHub Models.');
      }
      throw new AiItemError(`GitHub Models rechazó la petición (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }
    if (!res.ok) {
      throw new AiItemError(`Error de GitHub Models (HTTP ${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`);
    }

    const payload = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = payload.choices?.[0];
    if (choice?.message?.refusal) throw new AiItemError(`El modelo declinó la petición: ${choice.message.refusal.slice(0, 200)}`);
    if (choice?.finish_reason === 'length') throw new AiItemError('La respuesta superó el límite de tokens y quedó incompleta.');
    const content = choice?.message?.content ?? '';
    let raw: unknown;
    try {
      raw = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      throw new AiItemError('La respuesta de GitHub Models no es un JSON válido.');
    }
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) throw new AiItemError(`La respuesta no cumple el esquema esperado: ${parsed.error.message.slice(0, 200)}`);
    return {
      data: parsed.data as z.infer<S>,
      model: `github:${payload.model ?? this.resolvedModel}`,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
    };
  }
}
