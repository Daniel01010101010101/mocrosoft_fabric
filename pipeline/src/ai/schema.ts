import { z } from 'zod';
import { CATEGORY_IDS } from '../../../shared/categories';

const AUDIENCES = [
  'data-engineers',
  'data-analysts',
  'data-scientists',
  'developers',
  'architects',
  'administrators',
  'business-users',
] as const;

/**
 * Esquema de la ficha de análisis. Se usa como salida estructurada (JSON Schema) en la
 * petición a Claude y para validar la respuesta antes de guardarla.
 */
export const AnalysisSchema = z.object({
  detectedLanguage: z.enum(['en', 'es', 'other']).describe('Idioma original de la publicación'),
  titleEs: z.string().describe('Título en español, natural, conservando nombres técnicos en inglés'),
  executiveSummary: z.string().describe('Resumen ejecutivo de 2 a 4 frases'),
  keyPoints: z.array(z.string()).describe('3 a 6 puntos clave, una frase cada uno'),
  whatIsIt: z.string().describe('¿Qué es esta funcionalidad o novedad?'),
  howItWorks: z.string().describe('¿Cómo funciona? Explicación técnica clara'),
  flow: z
    .array(z.object({ label: z.string(), detail: z.string() }))
    .describe('Flujo de funcionamiento en 3 a 6 pasos para un diagrama; vacío si no aplica'),
  problemSolved: z.string().describe('¿Qué problema resuelve?'),
  advantages: z.array(z.string()).describe('Ventajas concretas (3 a 6)'),
  implementationSteps: z.array(z.string()).describe('Pasos para implementarla o empezar a usarla'),
  useCases: z.array(z.object({ title: z.string(), scenario: z.string() })).describe('2 a 4 escenarios reales'),
  businessImpact: z.string().describe('Impacto para empresas y equipos de datos'),
  considerations: z.array(z.string()).describe('Limitaciones, requisitos, regiones, licencias o advertencias citadas en la fuente'),
  codeExample: z
    .object({
      language: z.string(),
      code: z.string(),
      explanation: z.string(),
      origin: z.enum(['source', 'illustrative']),
    })
    .nullable()
    .describe('Ejemplo de código si la funcionalidad se usa con código; null si no aplica'),
  audiences: z.array(z.enum(AUDIENCES)).describe('Perfiles más afectados'),
  primaryCategory: z.enum(CATEGORY_IDS),
  secondaryCategories: z.array(z.enum(CATEGORY_IDS)),
  updateType: z.enum(['feature', 'improvement', 'announcement', 'deprecation', 'event', 'guidance', 'summary']),
  stage: z.enum(['preview', 'ga', 'planned', 'none']),
  technologies: z.array(z.string()).describe('Productos y tecnologías mencionados (nombres originales)'),
  impactScore: z.number().describe('Impacto de 1 (menor) a 10 (transformador)'),
  impactRationale: z.string().describe('Justificación breve del impacto'),
  transformative: z.boolean().describe('true solo si cambia de forma significativa cómo se trabaja con datos o IA'),
});

export type AnalysisOutput = z.infer<typeof AnalysisSchema>;

export const RoadmapBatchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      nameEs: z.string(),
      descriptionEs: z.string(),
    }),
  ),
});

export type RoadmapBatchOutput = z.infer<typeof RoadmapBatchSchema>;
