import * as cheerio from 'cheerio';
import { CATEGORY_BY_ID } from '../../../shared/categories';
import { SOURCES, type UpdateItem } from '../../../shared/types';
import type { PipelineConfig } from '../config';
import { fetchText } from '../core/http';
import type { Store } from '../core/store';
import { collapseWhitespace, extractLearnArticle } from '../core/text';

const MAX_SOURCE_CHARS = 40_000;
const MAX_DOC_CHARS = 6_000;
const DOC_CACHE_DAYS = 30;

/** Descarga (con caché de 30 días) el texto de una página de Microsoft Learn. */
export async function getLearnDoc(store: Store, config: PipelineConfig, url: string): Promise<{ title: string; text: string } | null> {
  const clean = url.split('#')[0]!;
  if (!clean.startsWith('https://learn.microsoft.com/')) return null;
  const cached = await store.getDoc(clean, DOC_CACHE_DAYS);
  if (cached) return { title: cached.title, text: cached.text };
  try {
    const res = await fetchText(clean, {
      timeoutMs: config.httpTimeoutMs,
      retries: 1,
      userAgent: config.userAgent,
      accept: 'text/html',
    });
    const article = extractLearnArticle(res.body, clean);
    const text = article.text.slice(0, 20_000);
    await store.putDoc({ url: clean, fetchedAt: new Date().toISOString(), title: article.title, text });
    return { title: article.title, text };
  } catch {
    return null; // El contexto adicional es opcional: su fallo no bloquea el análisis.
  }
}

/** Extrae de un resumen mensual del blog la sección a la que apunta un ancla. */
export function extractSectionByAnchor(html: string, anchorUrl: string): string | null {
  const hash = anchorUrl.split('#')[1];
  if (!hash) return null;
  const key = hash.replace(/^community-\d+-/, '');
  const $ = cheerio.load(`<div id="__root">${html}</div>`);
  const heading = $('#__root')
    .find('[id],[name]')
    .filter((_, el) => {
      const id = $(el).attr('id') ?? $(el).attr('name') ?? '';
      return id === hash || id === key || id.endsWith(key);
    })
    .first();
  if (heading.length === 0) return null;
  const start = heading.is('h1,h2,h3,h4,h5,h6') ? heading : heading.closest('h1,h2,h3,h4,h5,h6');
  const anchorEl = start.length ? start : heading;
  const level = Number((anchorEl.prop('tagName') ?? 'H3').toString().replace(/\D/g, '')) || 3;
  const parts: string[] = [anchorEl.text()];
  let node = anchorEl.next();
  while (node.length) {
    const tag = (node.prop('tagName') ?? '').toString().toLowerCase();
    const m = /^h([1-6])$/.exec(tag);
    if (m && Number(m[1]) <= level) break;
    parts.push(node.text());
    node = node.next();
  }
  const text = collapseWhitespace(parts.join('\n'));
  return text.length > 40 ? text.slice(0, MAX_DOC_CHARS) : null;
}

function dateLabel(item: UpdateItem): string {
  const d = item.publishedAt.slice(0, 10);
  switch (item.datePrecision) {
    case 'month':
      return `${item.publishedAt.slice(0, 7)} (precisión mensual)`;
    case 'detected':
      return `sin fecha en la fuente; detectada el ${d}`;
    default:
      return d;
  }
}

export async function buildUpdatePrompt(item: UpdateItem, store: Store, config: PipelineConfig): Promise<string> {
  const parts: string[] = [];
  parts.push('# Publicación oficial a analizar');
  parts.push(
    [
      `Título original: ${item.title}`,
      `Fuente: ${SOURCES[item.source].name}`,
      `URL: ${item.url}`,
      `Fecha de publicación: ${dateLabel(item)}`,
      `Idioma detectado automáticamente: ${item.originalLanguage}`,
      `Categoría estimada (heurística): ${CATEGORY_BY_ID[item.primaryCategory].name}`,
      item.meta.section ? `Sección en Microsoft Learn: ${item.meta.section === 'ga' ? 'Generally available features' : 'Features currently in preview'}` : '',
      item.meta.azureStatus ? `Estado en Azure Updates: ${item.meta.azureStatus}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  let body = item.content.text;
  let truncatedNote = '';
  if (body.length > MAX_SOURCE_CHARS) {
    body = body.slice(0, MAX_SOURCE_CHARS);
    truncatedNote = '\n[Nota: el contenido original es muy extenso y se ha recortado al llegar al límite de análisis.]';
  }
  parts.push(`## Contenido\n${body}${truncatedNote}`);

  if (item.content.codeBlocks.length > 0) {
    parts.push(
      `## Bloques de código presentes en la fuente\n${item.content.codeBlocks
        .slice(0, 4)
        .map((c) => `\`\`\`${c.language}\n${c.code.slice(0, 2500)}\n\`\`\``)
        .join('\n\n')}`,
    );
  }

  // Contexto: sección del resumen mensual del blog (si la novedad apunta a un ancla)
  const blogUrl = item.meta.blogUrl ?? (item.kind !== 'blog' && item.url.includes('/ba-p/') ? item.url : undefined);
  if (blogUrl && blogUrl.includes('#')) {
    const mid = /\/ba-p\/(\d+)/.exec(blogUrl)?.[1];
    const blog = mid ? store.updates.get(`cm-${mid}`) : undefined;
    const section = blog ? extractSectionByAnchor(blog.content.html, blogUrl) : null;
    if (section) parts.push(`## Extracto del anuncio oficial en el blog de Fabric\n${section}`);
  }

  // Contexto: documentación oficial de Microsoft Learn enlazada
  const docUrls = [
    item.docsUrl,
    ...item.content.links.map((l) => l.url).filter((u) => u.startsWith('https://learn.microsoft.com/')),
  ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i && !u!.includes('/whats-new'));
  let docsAdded = 0;
  for (const url of docUrls.slice(0, 3)) {
    if (docsAdded >= 2) break;
    const doc = await getLearnDoc(store, config, url);
    if (!doc || doc.text.length < 80) continue;
    parts.push(`## Documentación oficial relacionada: ${doc.title}\nURL: ${url}\n${doc.text.slice(0, MAX_DOC_CHARS)}`);
    docsAdded++;
  }

  parts.push(
    '## Tarea\nElabora la ficha de análisis en español siguiendo las reglas. Si el contenido ya está en español, no lo traduzcas: resúmelo y analízalo.',
  );
  return parts.join('\n\n');
}
