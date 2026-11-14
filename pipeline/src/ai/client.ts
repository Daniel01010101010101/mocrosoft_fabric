import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import type { PipelineConfig } from '../config';

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
}

export class AiFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiFatalError';
  }
}

export class AiItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiItemError';
  }
}

export interface StructuredCallResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredRequest<S extends z.ZodType> {
  system: string;
  user: string;
  schema: S;
  effort: PipelineConfig['aiEffort'];
  maxTokens: number;
}

/** Límites de tamaño de las peticiones según el proveedor de IA. */
export interface ProviderLimits {
  maxSourceChars: number;
  maxDocChars: number;
  maxDocs: number;
  /** Caracteres de entrada por lote de traducción rápida de novedades. */
  translateBatchChars: number;
  translateBatchItems: number;
  /** Caracteres de entrada por lote de traducción del roadmap. */
  roadmapBatchChars: number;
  roadmapBatchItems: number;
  /** Pide respuestas más breves (proveedores con límite de tokens de salida). */
  brief: boolean;
  concurrency: number;
}

/** Interfaz común a los proveedores de IA (Claude y GitHub Models). */
export interface StructuredClient {
  readonly provider: 'anthropic' | 'github';
  readonly model: string;
  readonly limits: ProviderLimits;
  structured<S extends z.ZodType>(opts: StructuredRequest<S>): Promise<StructuredCallResult<z.infer<S>>>;
}

export const ANTHROPIC_LIMITS: ProviderLimits = {
  maxSourceChars: 40_000,
  maxDocChars: 6_000,
  maxDocs: 2,
  translateBatchChars: 30_000,
  translateBatchItems: 25,
  roadmapBatchChars: 40_000,
  roadmapBatchItems: 25,
  brief: false,
  concurrency: 3,
};

/**
 * Envoltorio del SDK de Anthropic para peticiones con salida estructurada.
 *
 * - Usa streaming (respuestas largas sin riesgo de timeout HTTP).
 * - Activa el respaldo del lado del servidor (`fallbacks: "default"`): si el modelo
 *   declina una petición por política, la API la reintenta en el modelo de respaldo.
 * - Clasifica los errores: los de configuración/autenticación detienen la fase de IA;
 *   los demás afectan solo al elemento (se reintenta en ejecuciones posteriores).
 */
export class AiClient implements StructuredClient {
  readonly provider = 'anthropic' as const;
  readonly limits: ProviderLimits;
  private readonly client: Anthropic;

  constructor(private readonly config: PipelineConfig) {
    this.client = new Anthropic({ maxRetries: 3, timeout: 10 * 60 * 1000 });
    this.limits = { ...ANTHROPIC_LIMITS, concurrency: config.aiConcurrency };
  }

  get model(): string {
    return this.config.aiModel;
  }

  async structured<S extends z.ZodType>(opts: StructuredRequest<S>): Promise<StructuredCallResult<z.infer<S>>> {
    try {
      const stream = this.client.beta.messages.stream({
        model: this.config.aiModel,
        max_tokens: opts.maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: opts.user }],
        output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      });
      const message = await stream.finalMessage();

      if (message.stop_reason === 'refusal') {
        const category = message.stop_details?.category ?? 'sin categoría';
        throw new AiItemError(`El modelo declinó la petición (${category}).`);
      }
      if (message.stop_reason === 'max_tokens') {
        throw new AiItemError('La respuesta superó el límite de tokens y quedó incompleta.');
      }
      const parsed = message.parsed_output as z.infer<S> | null;
      if (!parsed) throw new AiItemError('La respuesta no cumple el esquema esperado.');
      return {
        data: parsed,
        model: message.model,
        inputTokens:
          (message.usage.input_tokens ?? 0) +
          (message.usage.cache_read_input_tokens ?? 0) +
          (message.usage.cache_creation_input_tokens ?? 0),
        outputTokens: message.usage.output_tokens ?? 0,
      };
    } catch (err) {
      if (err instanceof AiItemError) throw err;
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new AiFatalError(`Credenciales de IA no válidas o sin permisos (${err.status}). Revisa el secreto ANTHROPIC_API_KEY.`);
      }
      if (err instanceof Anthropic.NotFoundError) {
        throw new AiFatalError(`Modelo de IA no disponible: "${this.config.aiModel}". Revisa la variable AI_MODEL.`);
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new AiFatalError('Límite de uso de la API de IA alcanzado; se continuará en la próxima ejecución.');
      }
      if (err instanceof Anthropic.BadRequestError) {
        throw new AiItemError(`Petición rechazada por la API (400): ${err.message.slice(0, 300)}`);
      }
      if (err instanceof Anthropic.APIError) {
        throw new AiItemError(`Error de la API de IA (${err.status ?? 'red'}): ${err.message.slice(0, 300)}`);
      }
      throw new AiItemError(`Error inesperado en la llamada de IA: ${(err as Error).message?.slice(0, 300)}`);
    }
  }
}
