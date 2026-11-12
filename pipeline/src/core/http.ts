/**
 * Cliente HTTP con timeout, reintentos con backoff exponencial y peticiones condicionales
 * (ETag / Last-Modified) para no descargar contenido que no ha cambiado.
 */

export interface HttpCacheEntry {
  etag?: string;
  lastModified?: string;
  fetchedAt: string;
}

export interface FetchOptions {
  timeoutMs: number;
  retries: number;
  userAgent: string;
  accept?: string;
  cache?: HttpCacheEntry;
  /** Para tests: espera entre reintentos. */
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

export interface FetchResult {
  url: string;
  status: number;
  notModified: boolean;
  body: string;
  etag?: string;
  lastModified?: string;
  attempts: number;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status: number | null,
    readonly attempts: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function backoffDelay(attempt: number): number {
  const base = 1000 * 3 ** (attempt - 1); // 1s, 3s, 9s, 27s
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(base, 30_000) + jitter;
}

export async function fetchText(url: string, opts: FetchOptions): Promise<FetchResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const maxAttempts = Math.max(1, opts.retries + 1);
  let lastError: unknown = null;
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const headers: Record<string, string> = {
        'user-agent': opts.userAgent,
        accept: opts.accept ?? '*/*',
        'accept-language': 'en-US,en;q=0.9',
      };
      if (opts.cache?.etag) headers['if-none-match'] = opts.cache.etag;
      if (opts.cache?.lastModified) headers['if-modified-since'] = opts.cache.lastModified;

      const res = await doFetch(url, { headers, signal: controller.signal, redirect: 'follow' });
      lastStatus = res.status;

      if (res.status === 304) {
        return {
          url,
          status: 304,
          notModified: true,
          body: '',
          etag: opts.cache?.etag,
          lastModified: opts.cache?.lastModified,
          attempts: attempt,
        };
      }
      if (res.ok) {
        const body = await res.text();
        return {
          url,
          status: res.status,
          notModified: false,
          body,
          etag: res.headers.get('etag') ?? undefined,
          lastModified: res.headers.get('last-modified') ?? undefined,
          attempts: attempt,
        };
      }
      // Consumir el cuerpo para liberar la conexión.
      await res.text().catch(() => '');
      lastError = new Error(`HTTP ${res.status} ${res.statusText}`.trim());
      if (!RETRYABLE_STATUS.has(res.status)) {
        throw new HttpError(`HTTP ${res.status} al consultar ${url}`, url, res.status, attempt);
      }
    } catch (err) {
      if (err instanceof HttpError) throw err;
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < maxAttempts) await sleep(backoffDelay(attempt));
  }

  const reason =
    lastError instanceof Error
      ? lastError.name === 'AbortError'
        ? `tiempo de espera agotado (${opts.timeoutMs} ms)`
        : (lastError.cause instanceof Error ? `${lastError.message}: ${lastError.cause.message}` : lastError.message)
      : String(lastError);
  throw new HttpError(`Fallo tras ${maxAttempts} intentos al consultar ${url}: ${reason}`, url, lastStatus, maxAttempts);
}
