/**
 * Detección de idioma ligera y determinista basada en frecuencia de palabras vacías.
 * Suficiente para distinguir inglés / español / otros en textos técnicos.
 */

const STOPWORDS: Record<'en' | 'es' | 'pt' | 'fr' | 'de', string[]> = {
  en: ['the', 'and', 'of', 'to', 'in', 'is', 'for', 'with', 'this', 'that', 'you', 'are', 'can', 'your', 'on', 'it', 'be', 'as', 'we', 'from', 'now', 'by', 'an', 'or', 'will', 'which', 'when', 'have', 'more', 'how'],
  es: ['el', 'la', 'de', 'que', 'y', 'en', 'los', 'las', 'del', 'para', 'con', 'por', 'una', 'un', 'es', 'se', 'su', 'al', 'como', 'más', 'puede', 'sus', 'este', 'esta', 'también', 'ahora', 'datos', 'sobre', 'cuando', 'nuevo'],
  pt: ['o', 'a', 'de', 'que', 'e', 'em', 'os', 'as', 'do', 'da', 'para', 'com', 'por', 'uma', 'um', 'não', 'você', 'mais', 'seu', 'sua', 'dos', 'das', 'agora', 'também', 'pode', 'são', 'está', 'isso', 'ao', 'nos'],
  fr: ['le', 'la', 'les', 'de', 'des', 'et', 'en', 'du', 'un', 'une', 'est', 'pour', 'avec', 'que', 'qui', 'dans', 'sur', 'par', 'vous', 'nous', 'pas', 'plus', 'ce', 'cette', 'sont', 'aux', 'ou', 'leur', 'mais', 'été'],
  de: ['der', 'die', 'das', 'und', 'ist', 'zu', 'den', 'mit', 'von', 'für', 'auf', 'ein', 'eine', 'nicht', 'sie', 'es', 'im', 'auch', 'werden', 'dem', 'des', 'oder', 'wir', 'kann', 'bei', 'sich', 'nach', 'wie', 'aus', 'jetzt'],
};

const SETS = Object.fromEntries(Object.entries(STOPWORDS).map(([k, v]) => [k, new Set(v)])) as Record<
  keyof typeof STOPWORDS,
  Set<string>
>;

export interface LanguageGuess {
  lang: 'en' | 'es' | 'other';
  confidence: number;
}

/**
 * @param fallback idioma declarado por la fuente (p. ej. páginas en-us) para textos muy cortos
 *                 en los que la estadística no es concluyente.
 */
export function detectLanguage(text: string, fallback?: 'en' | 'es'): LanguageGuess {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-záéíóúñüàâçèêëîïôûœäöß]+/gi, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 3000);
  if (words.length < 3) return fallback ? { lang: fallback, confidence: 0.3 } : { lang: 'other', confidence: 0 };

  const scores: Record<string, number> = { en: 0, es: 0, pt: 0, fr: 0, de: 0 };
  for (const w of words) {
    for (const [lang, set] of Object.entries(SETS)) if (set.has(w)) scores[lang]! += 1;
  }
  // Señales ortográficas propias del español
  scores.es! += (text.match(/[ñ¿¡]|ción\b|ciones\b/gi)?.length ?? 0) * 0.5;

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestLang, best] = ranked[0]!;
  const second = ranked[1]![1];
  const total = ranked.reduce((acc, [, v]) => acc + v, 0);
  if (best < 2) return fallback ? { lang: fallback, confidence: 0.3 } : { lang: 'other', confidence: 0 };
  const confidence = Math.min(1, (best - second) / Math.max(1, total) + best / Math.max(words.length, 1));
  const lang = bestLang === 'en' || bestLang === 'es' ? bestLang : 'other';
  return { lang, confidence: Math.round(confidence * 100) / 100 };
}
