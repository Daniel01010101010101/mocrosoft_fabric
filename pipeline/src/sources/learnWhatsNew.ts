import * as cheerio from 'cheerio';
import { fetchText } from '../core/http';
import { normalizeTitle, sha1 } from '../core/text';
import type { FetchContext, RawUpdate, SourceFetchResult } from './types';

export const WHATS_NEW_URL = 'https://learn.microsoft.com/en-us/fabric/fundamentals/whats-new';
/** Versión oficial en español de la misma página (traducción de Microsoft). */
export const WHATS_NEW_ES_URL = 'https://learn.microsoft.com/es-es/fabric/fundamentals/whats-new';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function monthToIso(text: string): string | null {
  const m = /\b(January|February|March|April|May|June|July|August|September|October|November|December)[\s-]+(\d{4})\b/i.exec(text);
  if (!m) return null;
  const month = MONTHS[m[1]!.toLowerCase()]!;
  return new Date(Date.UTC(Number(m[2]), month - 1, 1)).toISOString();
}

export function whatsNewId(section: string, feature: string): string {
  return `wn-${sha1(`${section}|${normalizeTitle(feature)}`).slice(0, 14)}`;
}

function resolve(href: string): string | null {
  try {
    return new URL(href, WHATS_NEW_URL).toString();
  } catch {
    return null;
  }
}

/**
 * Analiza las tablas "Features currently in preview" y "Generally available features"
 * de la página oficial What's new in Microsoft Fabric.
 */
export function parseWhatsNew(html: string, detectedAt: string): RawUpdate[] {
  const $ = cheerio.load(html);
  const counters: Record<string, number> = { preview: 0, ga: 0 };
  const out: RawUpdate[] = [];
  const sections: { anchor: string; section: 'preview' | 'ga' }[] = [
    { anchor: 'features-currently-in-preview', section: 'preview' },
    { anchor: 'generally-available-features', section: 'ga' },
  ];

  for (const { anchor, section } of sections) {
    const heading = $(`h2#${anchor}`);
    if (heading.length === 0) continue;
    const tables = heading.nextUntil('h2').filter('table').add(heading.nextUntil('h2').find('table'));
    tables.find('tbody tr, tr').each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 2) return;
      let monthText = '';
      let featureCell: cheerio.Cheerio<any>;
      let descCell: cheerio.Cheerio<any>;
      if (section === 'ga' && cells.length >= 3) {
        monthText = $(cells[0]).text().trim();
        featureCell = $(cells[1]);
        descCell = $(cells[2]);
      } else {
        featureCell = $(cells[0]);
        descCell = $(cells[1]);
      }
      const feature = featureCell.text().replace(/\s+/g, ' ').trim();
      if (!feature || /^(feature|característica|caracteristica|funcionalidad)$/i.test(feature)) return;
      const position = `${section}:${counters[section]!++}`;

      const links = descCell
        .find('a[href]')
        .toArray()
        .map((a) => resolve($(a).attr('href') ?? ''))
        .filter((u): u is string => Boolean(u));
      const blogLink = links.find((u) => /community\.fabric\.microsoft\.com|blog\.fabric\.microsoft\.com|powerbi\.microsoft\.com\/.+\/blog/.test(u));
      const docsLink = links.find((u) => u.startsWith('https://learn.microsoft.com/') && !u.includes('/fundamentals/whats-new'));
      const otherOfficial = links.find((u) => /^https:\/\/(azure\.microsoft\.com|www\.microsoft\.com|techcommunity\.microsoft\.com)/.test(u));

      let publishedAt: string | null = null;
      let precision: RawUpdate['datePrecision'] = 'detected';
      const monthIso = monthText ? monthToIso(monthText) : null;
      if (monthIso) {
        publishedAt = monthIso;
        precision = 'month';
      } else if (blogLink) {
        const fromSlug = monthToIso(blogLink.replace(/-/g, ' '));
        if (fromSlug && /feature[\s-]summary/i.test(blogLink)) {
          publishedAt = fromSlug;
          precision = 'month';
        }
      }

      const url = blogLink ?? docsLink ?? otherOfficial ?? `${WHATS_NEW_URL}#${anchor}`;
      out.push({
        id: whatsNewId(section, feature),
        kind: 'whats-new',
        source: 'learn-whats-new',
        url,
        title: feature,
        publishedAt: publishedAt ?? detectedAt,
        datePrecision: precision,
        html: descCell.html() ?? '',
        baseUrl: WHATS_NEW_URL,
        docsUrl: docsLink,
        stageHint: section,
        meta: {
          section,
          position,
          ...(monthText ? { month: monthText } : {}),
          page: `${WHATS_NEW_URL}#${anchor}`,
          ...(blogLink ? { blogUrl: blogLink } : {}),
        },
      });
    });
  }
  return out;
}

export async function fetchWhatsNew(ctx: FetchContext): Promise<SourceFetchResult<RawUpdate>> {
  const res = await fetchText(WHATS_NEW_URL, {
    timeoutMs: ctx.config.httpTimeoutMs,
    retries: ctx.config.httpRetries,
    userAgent: ctx.config.userAgent,
    accept: 'text/html',
    cache: ctx.httpCache[WHATS_NEW_URL],
  });
  if (res.notModified) return { items: [], notModified: true, attempts: res.attempts, partialErrors: [] };
  const items = parseWhatsNew(res.body, new Date().toISOString());
  if (items.length === 0) {
    throw new Error("No se encontraron tablas de novedades en la página What's new (¿cambió el formato?)");
  }
  ctx.setCache(WHATS_NEW_URL, { etag: res.etag, lastModified: res.lastModified, fetchedAt: new Date().toISOString() });
  return { items, notModified: false, attempts: res.attempts, partialErrors: [] };
}

/** Descarga la versión oficial en español de la página (sin caché condicional: se mapea por posición). */
export async function fetchWhatsNewSpanish(ctx: FetchContext): Promise<RawUpdate[]> {
  const res = await fetchText(WHATS_NEW_ES_URL, {
    timeoutMs: ctx.config.httpTimeoutMs,
    retries: ctx.config.httpRetries,
    userAgent: ctx.config.userAgent,
    accept: 'text/html',
  });
  return parseWhatsNew(res.body, new Date().toISOString());
}
