import { CATEGORIES, type CategoryId } from '../../../shared/categories';
import type { Audience, Impact, Stage, UpdateKind, UpdateType } from '../../../shared/types';

const CATEGORY_REGEX = CATEGORIES.map((c) => ({
  id: c.id,
  patterns: c.keywords.map((k) => new RegExp(k, 'gi')),
}));

export interface Classification {
  primary: CategoryId;
  categories: CategoryId[];
  scores: Partial<Record<CategoryId, number>>;
}

function countMatches(re: RegExp, text: string, cap: number): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text) !== null && n < cap) n++;
  re.lastIndex = 0;
  return n;
}

/**
 * Clasificación heurística por palabras clave: el título pesa más que el cuerpo.
 * La IA refina después la categoría cuando está disponible.
 */
export function classifyCategories(title: string, body: string, hint?: CategoryId): Classification {
  const scores: Partial<Record<CategoryId, number>> = {};
  const bodySample = body.slice(0, 8000);
  for (const { id, patterns } of CATEGORY_REGEX) {
    let score = 0;
    for (const re of patterns) {
      score += countMatches(re, title, 3) * 4;
      score += Math.min(countMatches(re, bodySample, 6), 6) * 0.6;
    }
    if (score > 0) scores[id] = Math.round(score * 10) / 10;
  }
  if (hint) scores[hint] = (scores[hint] ?? 0) + 6;

  // "platform" solo gana si no hay nada más específico
  const ranked = (Object.entries(scores) as [CategoryId, number][])
    .filter(([id]) => id !== 'platform')
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || top[1] < 2) {
    return { primary: hint ?? 'platform', categories: [hint ?? 'platform'], scores };
  }
  const categories = ranked.filter(([, s]) => s >= Math.max(2.5, top[1] * 0.45)).map(([id]) => id).slice(0, 4);
  return { primary: top[0], categories, scores };
}

export function detectStage(title: string, body = ''): Stage {
  const t = title.toLowerCase();
  if (/\b(generally available|general availability|\(ga\)|now ga\b|is ga\b|\bga\b:)/.test(t)) return 'ga';
  if (/\bpreview\b/.test(t)) return 'preview';
  const b = body.slice(0, 1500).toLowerCase();
  if (/\b(generally available|general availability)\b/.test(b)) return 'ga';
  if (/\b(public preview|private preview|in preview|\(preview\))/.test(b)) return 'preview';
  return 'none';
}

export function detectType(title: string, kind: UpdateKind, body = ''): UpdateType {
  const t = title.toLowerCase();
  if (/feature summary|monthly update|what'?s new in|recap/.test(t)) return 'summary';
  if (/deprecat|retire|retirement|end of support|sunset|will be removed|breaking change|upcoming changes?/.test(t)) return 'deprecation';
  if (/\b(fabcon|sqlcon|conference|webinar|ignite|summit|meetup|livestream)\b|build 20\d\d|register (now|today)|join us|ask me anything|\bama\b/.test(t)) return 'event';
  if (/best practices?|how to|guide|tutorial|deep dive|lessons|tips|patterns|architecture|step-by-step|walkthrough|behind the scenes|understanding/.test(t))
    return 'guidance';
  if (/\b(preview|generally available|general availability|introducing|now available|new|announcing|launch|available)\b/.test(t))
    return 'feature';
  if (/improve|enhance|faster|performance|updates? to|better|support for|now supports|expanded|extends?/.test(t)) return 'improvement';
  if (kind === 'whats-new' || kind === 'azure-update') return 'feature';
  if (/leader|gartner|forrester|magic quadrant|partner|customer stor/.test(t) || /announc/.test(body.slice(0, 400).toLowerCase()))
    return 'announcement';
  return 'announcement';
}

const HIGH_IMPACT = [
  /copilot|agent|\bai\b|\biq\b|ontology/i,
  /direct lake/i,
  /onelake security|row-level|column-level|private link|customer-managed key|encryption/i,
  /mirroring|mirrored/i,
  /ci\/cd|git integration|deployment pipelines?/i,
  /capacit(y|ies)|pricing|licens|billing|sku/i,
  /deprecat|retire|breaking/i,
  /sql database|cosmos db|real-time|eventhouse/i,
  /performance|faster|\d+x\b/i,
];

const AUDIENCE_RULES: { re: RegExp; audience: Audience }[] = [
  { re: /pipeline|dataflow|spark|lakehouse|notebook|mirroring|copy job|delta|etl|elt|ingest/i, audience: 'data-engineers' },
  { re: /power bi|report|dax|semantic model|visual|dashboard|direct lake/i, audience: 'data-analysts' },
  { re: /machine learning|\bml\b|mlflow|model|data science|ai functions|notebook/i, audience: 'data-scientists' },
  { re: /api|sdk|cli|git|ci\/cd|rest|developer|vs code|python|t-sql|graphql|extensibility/i, audience: 'developers' },
  { re: /architecture|onelake|medallion|governance|integration|scal|shortcut|migration/i, audience: 'architects' },
  { re: /admin|capacity|tenant|security|governance|purview|license|monitor|permission|network|compliance/i, audience: 'administrators' },
  { re: /copilot|business|teams|excel|app|self-service|natural language/i, audience: 'business-users' },
];

export function inferAudiences(text: string): Audience[] {
  const found = AUDIENCE_RULES.filter((r) => r.re.test(text)).map((r) => r.audience);
  return [...new Set(found)].slice(0, 4);
}

export function levelFromScore(score: number): Impact['level'] {
  if (score >= 70) return 'alto';
  if (score >= 45) return 'medio';
  return 'bajo';
}

/** Puntuación heurística de impacto (0-100) usada hasta que la IA la refina. */
export function heuristicImpact(input: {
  title: string;
  text: string;
  kind: UpdateKind;
  type: UpdateType;
  stage: Stage;
}): Impact {
  const base: Record<UpdateType, number> = {
    feature: 42,
    improvement: 32,
    announcement: 30,
    deprecation: 48,
    event: 12,
    guidance: 22,
    summary: 40,
  };
  let score = base[input.type];
  if (input.stage === 'ga') score += 14;
  else if (input.stage === 'preview') score += 7;
  const hay = `${input.title}\n${input.text.slice(0, 3000)}`;
  let kw = 0;
  for (const re of HIGH_IMPACT) {
    if (re.test(input.title)) kw += 8;
    else if (re.test(hay)) kw += 3;
  }
  score += Math.min(kw, 26);
  if (input.kind === 'blog' && input.text.length > 5000) score += 5;
  score = Math.max(1, Math.min(100, Math.round(score)));
  return {
    score,
    level: levelFromScore(score),
    transformative: false,
    audiences: inferAudiences(hay),
    basis: 'heuristic',
  };
}

/** Combina la evaluación de la IA (1-10) con la heurística para una puntuación estable. */
export function blendImpact(heuristic: Impact, aiScore10: number, transformative: boolean, audiences: Audience[]): Impact {
  const ai = Math.max(1, Math.min(10, aiScore10)) * 10;
  const score = Math.round(ai * 0.75 + heuristic.score * 0.25);
  return {
    score,
    level: levelFromScore(score),
    transformative: transformative && score >= 60,
    audiences: audiences.length ? audiences : heuristic.audiences,
    basis: 'ai',
  };
}
