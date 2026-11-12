import { fetchText } from '../core/http';
import type { Stage } from '../../../shared/types';
import type { FetchContext, RawUpdate, SourceFetchResult } from './types';

const API = 'https://www.microsoft.com/releasecommunications/api/v2/azure';
const FILTER = "products/any(p: p eq 'Microsoft Fabric') or contains(title,'Fabric') or contains(title,'OneLake')";
/** Microsoft Fabric se anunció en mayo de 2023: lo anterior no es del ecosistema Fabric. */
const FABRIC_EPOCH = Date.parse('2023-05-01T00:00:00Z');
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

interface AzureUpdate {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  created: string;
  modified: string;
  products: string[] | null;
  tags: string[] | null;
  generalAvailabilityDate: string | null;
  previewAvailabilityDate: string | null;
}

interface AzurePage {
  value?: AzureUpdate[];
  '@odata.nextLink'?: string;
}

export function azureUpdateUrl(id: string): string {
  return `https://azure.microsoft.com/en-us/updates?id=${encodeURIComponent(id)}`;
}

function stageFromTitle(title: string, status: string | null): Stage | undefined {
  if (/^(generally available|ga)\b/i.test(title) || /available/i.test(status ?? '')) return 'ga';
  if (/preview/i.test(title) || /preview/i.test(status ?? '')) return 'preview';
  return undefined;
}

/**
 * Relevancia: el producto es Microsoft Fabric o el título menciona Fabric/OneLake.
 * Se excluyen productos homónimos (Azure Service Fabric, Hyperledger Fabric).
 */
export function isFabricRelevant(u: Pick<AzureUpdate, 'title' | 'products' | 'created'>): boolean {
  if (Date.parse(u.created) < FABRIC_EPOCH) return false;
  const title = u.title;
  if (/service fabric|hyperledger fabric|fabric controller|fabric network/i.test(title)) return false;
  if ((u.products ?? []).some((p) => /^microsoft fabric$/i.test(p.trim()))) return true;
  return /\b(microsoft fabric|onelake)\b/i.test(title) || /\b(in|to|into|with|for|from|on|across) fabric\b/i.test(title) || /\bfabric (data|warehouse|lakehouse|capacit|iq|mirroring|real-time|eventhouse|eventstream|notebook|sql|workspace|ontology|items?)\b/i.test(title);
}

export function mapAzureUpdates(values: AzureUpdate[]): RawUpdate[] {
  return values.filter(isFabricRelevant).map((u) => ({
    id: `az-${u.id}`,
    kind: 'azure-update' as const,
    source: 'azure-updates' as const,
    url: azureUpdateUrl(u.id),
    title: u.title.trim(),
    publishedAt: new Date(u.created).toISOString(),
    datePrecision: 'exact' as const,
    html: u.description ?? '',
    baseUrl: 'https://azure.microsoft.com/en-us/updates',
    stageHint: stageFromTitle(u.title, u.status),
    meta: {
      ...(u.status ? { azureStatus: u.status } : {}),
      ...(u.products?.length ? { products: u.products.join(', ') } : {}),
      ...(u.tags?.length ? { tags: u.tags.join(', ') } : {}),
      ...(u.generalAvailabilityDate ? { gaDate: u.generalAvailabilityDate } : {}),
      ...(u.previewAvailabilityDate ? { previewDate: u.previewAvailabilityDate } : {}),
      modified: u.modified,
    },
  }));
}

export async function fetchAzureUpdates(ctx: FetchContext): Promise<SourceFetchResult<RawUpdate>> {
  const all: AzureUpdate[] = [];
  let attempts = 0;
  let next: string | null = `${API}?${new URLSearchParams({
    $filter: FILTER,
    $orderby: 'created desc',
    $top: String(PAGE_SIZE),
    $count: 'true',
  }).toString()}`;
  let skip = 0;
  for (let page = 0; page < MAX_PAGES && next; page++) {
    const res = await fetchText(next, {
      timeoutMs: ctx.config.httpTimeoutMs,
      retries: ctx.config.httpRetries,
      userAgent: ctx.config.userAgent,
      accept: 'application/json',
    });
    attempts = Math.max(attempts, res.attempts);
    const data = JSON.parse(res.body) as AzurePage;
    if (!Array.isArray(data.value)) throw new Error('Respuesta inesperada de la API de Azure Updates');
    all.push(...data.value);
    if (data['@odata.nextLink']) {
      next = data['@odata.nextLink'];
    } else if (data.value.length === PAGE_SIZE) {
      skip += PAGE_SIZE;
      next = `${API}?${new URLSearchParams({
        $filter: FILTER,
        $orderby: 'created desc',
        $top: String(PAGE_SIZE),
        $skip: String(skip),
      }).toString()}`;
    } else {
      next = null;
    }
  }
  return { items: mapAzureUpdates(all), notModified: false, attempts, partialErrors: [] };
}
