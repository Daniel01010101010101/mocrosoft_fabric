import { fetchText, HttpError } from '../core/http';
import type { FetchContext, RawRoadmapItem, SourceFetchResult } from './types';

export const ROADMAP_BASE = 'https://roadmap.fabric.microsoft.com';

export interface RoadmapProduct {
  id: string;
  name: string;
  query: string;
}

/** Productos publicados en el roadmap oficial (se detectan dinámicamente; esta lista es el respaldo). */
export const FALLBACK_PRODUCTS: RoadmapProduct[] = [
  { id: 'a821f83f-dbd6-ee11-9079-000d3a310f67', name: 'Data Factory', query: 'datafactory' },
  { id: '0522b590-dcd6-ee11-9079-000d3a310f67', name: 'Data Science', query: 'datascience' },
  { id: 'fa3a73cd-dcd6-ee11-9079-000d3a310f67', name: 'Data Warehouse', query: 'datawarehouse' },
  { id: '338c69fe-dcd6-ee11-9079-000d3a310f67', name: 'OneLake', query: 'onelake' },
  { id: 'c6da6b3b-ded6-ee11-9079-000d3a310f67', name: 'Fabric Developer Experiences', query: 'fabricdeveloperexperiences' },
  { id: '796a0af7-2dc7-ee11-9079-000d3a3419a8', name: 'Administration, Governance and Security', query: 'administration,governanceandsecurity' },
  { id: 'a731518f-36ca-ee11-9079-000d3a341a60', name: 'Data Engineering', query: 'dataengineering' },
  { id: '642a8375-05fc-ee11-a1ff-000d3a341a60', name: 'Power BI', query: 'powerbi' },
  { id: '58cb90aa-4203-ef11-a1fd-000d3a36eea4', name: 'Real-Time Intelligence', query: 'real-timeintelligence' },
  { id: '0e17459c-141b-f011-998a-00224804b6c3', name: 'Cosmos DB', query: 'cosmosdb' },
  { id: '94e84e43-aa69-f011-bec2-00224804b6c3', name: 'Fabric Ecosystem', query: 'fabricecosystem' },
  { id: '0d409704-5dd2-f111-a059-0022480a4cb7', name: 'Fabric HorizonDB', query: 'fabrichorizondb' },
  { id: '347da228-ea54-ef11-a317-0022480a694f', name: 'SQL database', query: 'sqldatabase' },
  { id: '951b64e0-a663-f111-a826-6045bd00f798', name: 'Conversational Analytics', query: 'conversationalanalytics' },
  { id: 'cef5a30d-562f-f011-8c4d-6045bd096d8f', name: 'IQ', query: 'iq' },
];

export function parseProducts(html: string): RoadmapProduct[] {
  const re = /ProductFamily\.id\s*=\s*"([^"]+)";\s*ProductFamily\.name\s*=\s*"([^"]+)";\s*ProductFamily\.queryString\s*=\s*"([^"]+)"/g;
  const out: RoadmapProduct[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push({ id: m[1]!, name: m[2]!, query: m[3]! });
  return out;
}

/**
 * El endpoint devuelve "JSON" generado por plantilla con caracteres de control sin escapar
 * y escapes no válidos (p. ej. "\_"). Se reparan solo dentro de las cadenas.
 */
export function repairJson(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (ch === '\\') {
      const next = text[i + 1];
      if (next !== undefined && '"\\/bfnrtu'.includes(next)) {
        out += ch + next;
        i++;
      }
      // Escape no válido: se descarta la barra y el carácter siguiente se procesa normalmente.
      continue;
    }
    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 0x20) {
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : `\\u${code.toString(16).padStart(4, '0')}`;
      continue;
    }
    out += ch;
  }
  return out;
}

interface RoadmapJsonItem {
  ReleaseItemID?: string;
  FeatureName?: string;
  ReleaseDate?: string;
  ReleaseType?: string;
  ReleaseStatus?: string;
  ReleaseSemester?: string;
  ProductID?: string;
  ProductName?: string;
  isPublishExternally?: string;
  FeatureDescription?: string;
}

const ENTITIES: Record<string, string> = { quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#39': "'" };

/** Decodifica las entidades HTML que el roadmap incrusta en sus textos. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&(quot|amp|apos|lt|gt|nbsp|#39);/g, (_, k: string) => ENTITIES[k] ?? _)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

export function parseRoadmapJson(body: string, product: RoadmapProduct): RawRoadmapItem[] {
  const data = JSON.parse(repairJson(body)) as { results?: RoadmapJsonItem[] };
  if (!Array.isArray(data.results)) throw new Error(`Formato inesperado del roadmap para ${product.name}`);
  return data.results
    .filter((r) => r.ReleaseItemID && r.FeatureName && r.isPublishExternally !== 'false')
    .map((r) => ({
      releaseItemId: r.ReleaseItemID!.toLowerCase(),
      product: r.ProductName?.trim() || product.name,
      productId: r.ProductID ?? product.id,
      productQuery: product.query,
      name: decodeEntities(r.FeatureName!).trim(),
      description: decodeEntities(r.FeatureDescription ?? '').trim(),
      releaseType: (r.ReleaseType ?? '').trim(),
      releaseStatus: (r.ReleaseStatus ?? '').trim(),
      releaseDate: (r.ReleaseDate ?? '').trim(),
      wave: (r.ReleaseSemester ?? '').replace(/\s*[([]\s*public\s*[)\]]\s*/i, '').replace(/\s*-\s*$/, '').trim(),
    }));
}

export function roadmapItemUrl(productQuery: string, releaseItemId: string): string {
  const u = new URL(ROADMAP_BASE + '/');
  u.searchParams.set('product', productQuery);
  u.searchParams.set('releaseItem', releaseItemId);
  return u.toString();
}

export async function fetchRoadmap(ctx: FetchContext): Promise<SourceFetchResult<RawRoadmapItem>> {
  const opts = {
    timeoutMs: ctx.config.httpTimeoutMs,
    retries: ctx.config.httpRetries,
    userAgent: ctx.config.userAgent,
  };
  let attempts = 0;
  let products = FALLBACK_PRODUCTS;
  const partialErrors: string[] = [];
  try {
    const home = await fetchText(`${ROADMAP_BASE}/`, { ...opts, accept: 'text/html' });
    attempts = Math.max(attempts, home.attempts);
    const detected = parseProducts(home.body);
    if (detected.length > 0) products = detected;
    else partialErrors.push('No se pudo detectar la lista de productos del roadmap; se usa la lista de respaldo.');
  } catch (err) {
    partialErrors.push(`Lista de productos del roadmap no disponible: ${(err as Error).message}`);
  }

  const items: RawRoadmapItem[] = [];
  const completeParts: string[] = [];
  for (const product of products) {
    const url = `${ROADMAP_BASE}/fabric-json/?productId=${product.id}`;
    try {
      const res = await fetchText(url, { ...opts, accept: 'application/json, text/html' });
      attempts = Math.max(attempts, res.attempts);
      items.push(...parseRoadmapJson(res.body, product));
      completeParts.push(product.id);
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : `${product.name}: ${(err as Error).message}`;
      partialErrors.push(msg);
    }
  }
  if (completeParts.length === 0) {
    throw new Error(`No se pudo consultar ningún producto del roadmap. ${partialErrors.join(' | ')}`);
  }
  return { items, notModified: false, attempts, partialErrors, completeParts };
}
