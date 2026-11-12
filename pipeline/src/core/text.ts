import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import type { CodeBlock, ImageRef, LinkRef, UpdateContent } from '../../../shared/types';

export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function collapseWhitespace(s: string): string {
  return s.replace(/ /g, ' ').replace(/[ \t\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Normaliza un título para comparar similitud (minúsculas, sin acentos ni puntuación). */
export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\((preview|public preview|generally available|ga|general availability)\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with', 'now', 'new', 'is', 'are', 'your', 'from', 'by',
  'at', 'into', 'microsoft', 'fabric', 'preview', 'public', 'generally', 'available', 'announcing', 'introducing',
]);

export function titleTokens(s: string): Set<string> {
  return new Set(
    normalizeTitle(s)
      .split(' ')
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

/** Similitud de Jaccard entre tokens significativos de dos títulos (0-1). */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'img', 'pre', 'code', 'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr', 'span', 'figure', 'figcaption', 'sup', 'sub',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    code: ['class'],
    pre: ['class'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
    }),
    'li-code': (_tag, attribs) => ({ tagName: 'pre', attribs: { class: `language-${attribs.lang ?? 'text'}` } }),
  },
  allowedClasses: { code: [/^language-/], pre: [/^language-/] },
  exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
};

export function sanitize(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

function absolutize(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export interface ExtractOptions {
  baseUrl: string;
  excerptLength?: number;
}

/**
 * Extrae texto, imágenes, bloques de código y enlaces de un fragmento HTML de la fuente
 * oficial, y genera una versión saneada para mostrarla en la plataforma.
 */
export function extractContent(html: string, opts: ExtractOptions): UpdateContent {
  const $ = cheerio.load(`<div id="__root">${html}</div>`);
  const root = $('#__root');

  // Bloques de código (Khoros usa <li-code lang="...">, otros <pre><code class="language-x">)
  const codeBlocks: CodeBlock[] = [];
  root.find('li-code, pre').each((_, el) => {
    const node = $(el);
    if (node.parents('pre').length > 0) return;
    const code = node.text().replace(/\r\n/g, '\n').replace(/ /g, ' ').trim();
    if (code.length < 8) return;
    const cls = (node.attr('class') ?? '') + ' ' + (node.find('code').attr('class') ?? '');
    const langMatch = /language-([\w#+-]+)/.exec(cls);
    const language = (node.attr('lang') ?? langMatch?.[1] ?? 'text').toLowerCase();
    codeBlocks.push({ language, code: code.slice(0, 6000) });
  });

  const images: ImageRef[] = [];
  const seenImg = new Set<string>();
  root.find('img').each((_, el) => {
    const rawSrc = ($(el).attr('src') ?? '').trim();
    if (!rawSrc || rawSrc.startsWith('data:')) return;
    const src = absolutize(rawSrc, opts.baseUrl);
    if (!src || !src.startsWith('https://') || seenImg.has(src)) return;
    if (/emoji|icon|avatar|spacer|pixel|\.svg(\?|$)/i.test(src)) return;
    const width = Number($(el).attr('width') ?? '0');
    if (width > 0 && width < 80) return;
    seenImg.add(src);
    images.push({ src, alt: collapseWhitespace($(el).attr('alt') ?? '').slice(0, 200) });
  });

  const links: LinkRef[] = [];
  const seenLink = new Set<string>();
  root.find('a[href]').each((_, el) => {
    const rawHref = ($(el).attr('href') ?? '').trim();
    if (!rawHref || rawHref.startsWith('#')) return;
    const href = absolutize(rawHref, opts.baseUrl);
    if (!href || seenLink.has(href)) return;
    seenLink.add(href);
    const label = collapseWhitespace($(el).text()).slice(0, 160);
    links.push({ label: label || href, url: href });
  });

  // Texto plano con saltos de párrafo razonables.
  root.find('br').replaceWith('\n');
  root.find('p, li, h1, h2, h3, h4, h5, h6, tr, pre, li-code, blockquote, div').each((_, el) => {
    $(el).append('\n');
  });
  root.find('li').each((_, el) => {
    $(el).prepend('• ');
  });
  const text = collapseWhitespace(root.text());

  // HTML saneado (las rutas relativas se resuelven contra la URL base)
  const $abs = cheerio.load(`<div id="__root">${html}</div>`);
  $abs('#__root a[href]').each((_, el) => {
    const href = absolutize($abs(el).attr('href') ?? '', opts.baseUrl);
    if (href) $abs(el).attr('href', href);
  });
  $abs('#__root img[src]').each((_, el) => {
    const src = absolutize($abs(el).attr('src') ?? '', opts.baseUrl);
    if (src) $abs(el).attr('src', src);
  });
  const cleanHtml = sanitize($abs('#__root').html() ?? '');

  return {
    text,
    html: cleanHtml.length > 120_000 ? cleanHtml.slice(0, 120_000) : cleanHtml,
    excerpt: truncate(text.replace(/\n+/g, ' '), opts.excerptLength ?? 320),
    images: images.slice(0, 12),
    codeBlocks: codeBlocks.slice(0, 10),
    links: links.slice(0, 60),
  };
}

/** Extrae el texto principal de una página de Microsoft Learn (para contexto de la IA). */
export function extractLearnArticle(html: string, baseUrl: string): { title: string; text: string; codeBlocks: CodeBlock[] } {
  const $ = cheerio.load(html);
  const title = collapseWhitespace($('h1').first().text() || $('title').text());
  const main = $('main .content, main#main, main').first();
  main.find('nav, script, style, .feedback-section, #ms--feedback, .page-metadata, #article-header, .alert.is-primary, [data-bi-name="feedback"], .action-bar').remove();
  const content = extractContent(main.html() ?? '', { baseUrl });
  return { title, text: content.text, codeBlocks: content.codeBlocks };
}
