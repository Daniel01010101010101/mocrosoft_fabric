/**
 * Validación de registros: ninguna novedad entra en la base de datos sin una fuente
 * oficial verificable, un título, una fecha válida y contenido suficiente.
 */

export const OFFICIAL_HOSTS = [
  'community.fabric.microsoft.com',
  'blog.fabric.microsoft.com',
  'powerbi.microsoft.com',
  'learn.microsoft.com',
  'roadmap.fabric.microsoft.com',
  'azure.microsoft.com',
  'www.microsoft.com',
  'techcommunity.microsoft.com',
  'app.fabric.microsoft.com',
];

export function isOfficialUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && OFFICIAL_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Normaliza una URL para identificar duplicados (sin parámetros de tracking ni barra final). */
export function canonicalUrl(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|wt\.|ocid|cid|mc_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
  }
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString();
}

export interface CandidateRecord {
  url: string;
  title: string;
  publishedAt: string;
  text: string;
}

export function validateCandidate(c: CandidateRecord): string | null {
  if (!c.title || c.title.trim().length < 4) return 'título vacío o demasiado corto';
  if (!isOfficialUrl(c.url)) return `URL sin fuente oficial verificable (${c.url})`;
  const t = Date.parse(c.publishedAt);
  if (!Number.isFinite(t)) return 'fecha de publicación no válida';
  if (t > Date.now() + 1000 * 60 * 60 * 24 * 2) return 'fecha de publicación en el futuro';
  if (t < Date.parse('2015-01-01')) return 'fecha de publicación anterior a 2015';
  if (!c.text || c.text.trim().length < 20) return 'contenido insuficiente';
  return null;
}
