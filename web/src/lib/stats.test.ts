import { describe, expect, it } from 'vitest';
import type { UpdateSummary } from '../../../shared/types';
import { computeKpis, isToday, monthlyTimeline, withinDays } from './stats';

function u(overrides: Partial<UpdateSummary>): UpdateSummary {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'blog',
    source: 'fabric-blog',
    url: 'https://community.fabric.microsoft.com/x',
    titleEs: null,
    titleOriginal: 'Title',
    summaryEs: null,
    excerptOriginal: 'Excerpt',
    publishedAt: new Date().toISOString(),
    datePrecision: 'exact',
    undated: false,
    detectedAt: new Date().toISOString(),
    primaryCategory: 'onelake',
    categories: ['onelake'],
    type: 'feature',
    stage: 'preview',
    technologies: [],
    impactScore: 50,
    impactLevel: 'medio',
    transformative: false,
    audiences: [],
    image: null,
    aiStatus: 'pending',
    translated: false,
    originalLanguage: 'en',
    ...overrides,
  };
}

describe('Indicadores del dashboard', () => {
  it('no cuenta como recientes las novedades sin fecha oficial de la carga inicial', () => {
    const undated = u({ undated: true, datePrecision: 'detected' });
    expect(withinDays(undated, 7)).toBe(false);
    expect(isToday(undated)).toBe(false);
  });

  it('las fechas mensuales no cuentan para "hoy" ni para la última semana', () => {
    const monthly = u({ datePrecision: 'month', publishedAt: new Date().toISOString() });
    expect(isToday(monthly)).toBe(false);
    expect(withinDays(monthly, 7)).toBe(false);
    expect(withinDays(monthly, 30)).toBe(true);
  });

  it('calcula los KPI principales', () => {
    const items = [
      u({ stage: 'ga' }),
      u({ stage: 'preview', type: 'improvement' }),
      u({ publishedAt: '2020-01-01T00:00:00.000Z' }),
    ];
    const k = computeKpis(items);
    expect(k.total).toBe(3);
    expect(k.today).toBe(2);
    expect(k.week).toBe(2);
    expect(k.ga).toBe(1);
    expect(k.preview).toBe(2);
    expect(k.newFeatures30).toBe(1);
  });

  it('agrupa por mes sin desplazar las fechas mensuales (UTC)', () => {
    const now = new Date();
    const firstOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString();
    const series = monthlyTimeline([u({ datePrecision: 'month', publishedAt: firstOfMonth, stage: 'ga' })], 3);
    expect(series).toHaveLength(3);
    expect(series[2]!.total).toBe(1);
    expect(series[2]!.ga).toBe(1);
  });
});
