import {
  Activity,
  BrainCircuit,
  Building2,
  Cable,
  CodeXml,
  Database,
  FlaskConical,
  Gauge,
  Layers,
  ShieldCheck,
  Sparkles,
  Waves,
  Warehouse,
  Workflow,
  Zap,
  ChartColumn,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryId } from '../../../shared/categories';
import type { AiStatus, SourceId, Stage, UpdateType } from '../../../shared/types';

export const CATEGORY_ICON: Record<CategoryId, LucideIcon> = {
  'data-factory': Workflow,
  'data-engineering': Layers,
  'data-science': FlaskConical,
  'data-warehouse': Warehouse,
  'real-time-intelligence': Activity,
  'power-bi': ChartColumn,
  onelake: Waves,
  'direct-lake': Zap,
  'data-activator': Gauge,
  'copilot-ai': BrainCircuit,
  'admin-governance': Building2,
  security: ShieldCheck,
  'integrations-connectors': Cable,
  'developer-apis': CodeXml,
  databases: Database,
  platform: Sparkles,
};

export const STAGE_SHORT: Record<Stage, string> = {
  ga: 'GA',
  preview: 'Preview',
  planned: 'Planificada',
  none: '',
};

export const SOURCE_SHORT: Record<SourceId, string> = {
  'fabric-blog': 'Fabric Blog',
  'powerbi-blog': 'Power BI Blog',
  'learn-whats-new': 'Microsoft Learn',
  'azure-updates': 'Azure Updates',
  'fabric-roadmap': 'Roadmap',
};

export const TYPE_SHORT: Record<UpdateType, string> = {
  feature: 'Funcionalidad',
  improvement: 'Mejora',
  announcement: 'Anuncio',
  deprecation: 'Retirada / cambio',
  event: 'Evento',
  guidance: 'Guía',
  summary: 'Resumen',
};

export const AI_STATUS_LABEL: Record<AiStatus, string> = {
  done: 'Traducido y analizado',
  pending: 'Traducción pendiente',
  error: 'Error de traducción',
  skipped: 'Duplicado vinculado',
};
