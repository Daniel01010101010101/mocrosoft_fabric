import { XMLParser } from 'fast-xml-parser';
import type { SourceId } from '../../../shared/types';
import { fetchText } from '../core/http';
import { canonicalUrl } from '../core/validate';
import { sha1 } from '../core/text';
import type { FetchContext, RawUpdate, SourceFetchResult } from './types';

export interface RssFeedDef {
  source: SourceId;
  url: string;
}

export const RSS_FEEDS: RssFeedDef[] = [
  { source: 'fabric-blog', url: 'https://blog.fabric.microsoft.com/en-us/blog/feed/' },
  { source: 'powerbi-blog', url: 'https://powerbi.microsoft.com/en-us/blog/feed/' },
];

interface RssItem {
  title?: unknown;
  link?: unknown;
  description?: unknown;
  'content:encoded'?: unknown;
  pubDate?: unknown;
  'dc:date'?: unknown;
  'dc:creator'?: unknown;
  guid?: unknown;
}

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) return str((v as Record<string, unknown>)['#text']);
  return '';
}

/** Id estable: el identificador numérico del mensaje en la comunidad oficial de Fabric. */
export function communityPostId(url: string): string {
  const m = /\/ba-p\/(\d+)/.exec(url);
  if (m) return `cm-${m[1]}`;
  return `rss-${sha1(canonicalUrl(url)).slice(0, 16)}`;
}

export function parseRss(xml: string, source: SourceId): RawUpdate[] {
  const parser = new XMLParser({
    ignoreAttributes: true,
    processEntities: true,
    htmlEntities: true,
    trimValues: true,
    parseTagValue: false,
  });
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
  const raw = doc.rss?.channel?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: RawUpdate[] = [];
  for (const it of items) {
    const link = str(it.link).trim() || str(it.guid).trim();
    const title = str(it.title).trim();
    if (!link || !title) continue;
    const date = str(it['dc:date']) || str(it.pubDate);
    const parsed = Date.parse(date);
    const html = str(it['content:encoded']) || str(it.description);
    out.push({
      id: communityPostId(link),
      kind: 'blog',
      source,
      url: canonicalUrl(link),
      title,
      author: str(it['dc:creator']).trim() || undefined,
      publishedAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : '',
      datePrecision: 'exact',
      html,
      baseUrl: link,
      meta: {},
    });
  }
  return out;
}

export async function fetchRssFeed(feed: RssFeedDef, ctx: FetchContext): Promise<SourceFetchResult<RawUpdate>> {
  const res = await fetchText(feed.url, {
    timeoutMs: ctx.config.httpTimeoutMs,
    retries: ctx.config.httpRetries,
    userAgent: ctx.config.userAgent,
    accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
    cache: ctx.httpCache[feed.url],
  });
  if (res.notModified) return { items: [], notModified: true, attempts: res.attempts, partialErrors: [] };
  if (!/<rss[\s>]/i.test(res.body)) {
    throw new Error(`La respuesta de ${feed.url} no es un feed RSS válido`);
  }
  const items = parseRss(res.body, feed.source);
  ctx.setCache(feed.url, { etag: res.etag, lastModified: res.lastModified, fetchedAt: new Date().toISOString() });
  return { items, notModified: false, attempts: res.attempts, partialErrors: [] };
}
