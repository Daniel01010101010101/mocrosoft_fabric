import clsx from 'clsx';
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Code2,
  Cog,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  Languages,
  Lightbulb,
  ListChecks,
  Puzzle,
  Radar,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CATEGORY_BY_ID } from '../../../shared/categories';
import { AUDIENCE_LABELS, SOURCES, UPDATE_TYPE_LABELS, type UpdateDetail as Detail } from '../../../shared/types';
import { CodeBlock, DetailSection, FlowDiagram, Paragraphs } from '../components/DetailParts';
import { AiBadge, Badge, CategoryChip, ErrorState, ExternalLinkButton, ImpactRing, PageLoader, StageBadge } from '../components/ui';
import { displayTitle, UpdateRow } from '../components/UpdateCard';
import { ApiError, useAliases, useUpdateDetail } from '../lib/api';
import { formatDate, formatDateTime, formatPublished } from '../lib/format';
import { STAGE_SHORT } from '../lib/labels';
import NotFound from './NotFound';

const SECTIONS = [
  { id: 'resumen', label: 'Resumen ejecutivo' },
  { id: 'que-es', label: '¿Qué es?' },
  { id: 'como-funciona', label: '¿Cómo funciona?' },
  { id: 'problema', label: '¿Qué problema resuelve?' },
  { id: 'ventajas', label: 'Ventajas' },
  { id: 'implementacion', label: '¿Cómo implementarla?' },
  { id: 'casos', label: 'Ejemplos de uso' },
  { id: 'impacto', label: 'Impacto para empresas' },
  { id: 'codigo', label: 'Ejemplo técnico' },
  { id: 'fuentes', label: 'Fuentes oficiales' },
];

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5">
      <dt className="text-[0.7rem] font-medium uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}

function PendingAnalysis({ d }: { d: Detail }) {
  const translated = d.translated && d.summaryEs;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line bg-amber-50/60 p-5 dark:bg-amber-400/5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
          <Languages className="size-4" />
        </span>
        <div>
          <h2 className="font-semibold text-fg">
            {d.aiStatus === 'error' ? 'No se pudo completar el análisis' : translated ? 'Análisis detallado en preparación' : 'Traducción en preparación'}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">
            {d.aiStatus === 'error'
              ? 'El análisis automático falló varias veces para esta novedad. El error quedó registrado en el panel de estado. Mientras tanto se muestra el resumen disponible y el contenido original verificado.'
              : translated
                ? 'Ya tienes el resumen en español. La ficha completa (qué es, cómo funciona, cómo implementarla, casos de uso e impacto) se genera automáticamente en las próximas ejecuciones programadas.'
                : 'Esta novedad ya está verificada y almacenada. La traducción y el análisis se generan automáticamente en las próximas ejecuciones programadas; mientras tanto se muestra el contenido oficial original.'}
          </p>
        </div>
      </div>
      <div className="p-5">
        {translated ? (
          <>
            <div className="eyebrow mb-2">Resumen en español</div>
            <p className="text-[1.02rem] leading-relaxed text-fg">{d.summaryEs}</p>
          </>
        ) : (
          <>
            <div className="eyebrow mb-2">Extracto original ({d.originalLanguage === 'en' ? 'inglés' : d.originalLanguage})</div>
            <p className="text-sm leading-relaxed text-fg-muted" lang={d.originalLanguage}>
              {d.excerptOriginal}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function UpdateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const aliases = useAliases();
  const alias = id ? aliases.data?.[id] : undefined;
  const q = useUpdateDetail(alias ? undefined : id);
  const [showOriginal, setShowOriginal] = useState(false);
  const d = q.data;
  const a = d?.analysis ?? null;

  const sectionIds = useMemo(
    () => SECTIONS.filter((s) => (s.id === 'codigo' ? Boolean(a?.codeExample || d?.content.codeBlocks.length) : true)).map((s) => s.id),
    [a, d],
  );
  const active = useActiveSection(a ? sectionIds : []);

  useEffect(() => {
    if (d) document.title = `${displayTitle(d)} · Fabric Radar`;
    return () => {
      document.title = 'Fabric Radar · Novedades de Microsoft Fabric';
    };
  }, [d]);

  if (alias) return <Navigate to={`/novedad/${alias}`} replace />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) return <NotFound title="Esta novedad no existe" />;
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  }
  if (q.isLoading || !d) return <PageLoader label="Cargando el análisis…" />;

  const published = d.undated ? 'Sin fecha oficial en la fuente' : formatPublished(d.publishedAt, d.datePrecision);
  const source = SOURCES[d.source];
  let n = 0;

  return (
    <div>
      <button
        onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/novedades'))}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Volver
      </button>

      {/* Cabecera */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative mb-6 overflow-hidden p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <CategoryChip id={d.primaryCategory} size="md" />
              <StageBadge stage={d.stage} />
              <Badge>{UPDATE_TYPE_LABELS[d.type]}</Badge>
              {d.transformative && (
                <Badge tone="dark">
                  <Sparkles className="size-3 text-brand" /> Transformadora
                </Badge>
              )}
              <AiBadge status={d.aiStatus} original={d.originalLanguage} translated={d.translated} />
            </div>
            <h1 className="text-[1.6rem] font-semibold leading-tight tracking-tight text-fg sm:text-[2.1rem]">{displayTitle(d)}</h1>
            {d.titleEs && d.titleEs !== d.titleOriginal && (
              <p className="mt-2 text-sm text-fg-subtle" lang="en">
                Título original: {d.titleOriginal}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-fg-subtle" /> Publicada: <strong className="font-medium text-fg">{published}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Radar className="size-4 text-fg-subtle" /> Detectada: <strong className="font-medium text-fg">{formatDateTime(d.detectedAt)}</strong>
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <ExternalLinkButton href={d.url} variant="solid">
                <FileText className="size-4" /> Publicación original <ExternalLink className="size-3.5" />
              </ExternalLinkButton>
              {d.docsUrl && (
                <ExternalLinkButton href={d.docsUrl}>
                  <BookOpen className="size-4" /> Documentación oficial <ExternalLink className="size-3.5" />
                </ExternalLinkButton>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-line bg-surface-2 p-4 lg:w-72 lg:flex-col lg:items-start">
            <ImpactRing score={d.impactScore} size={64} />
            <div>
              <div className="text-sm font-semibold capitalize text-fg">Impacto {d.impactLevel}</div>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                {a?.impactRationale ?? 'Puntuación provisional basada en la fase, el tipo y el alcance de la novedad.'}
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0 space-y-10">
          {!a ? (
            <PendingAnalysis d={d} />
          ) : (
            <>
              <DetailSection id="resumen" n={++n} title="Resumen ejecutivo" icon={Info}>
                <p className="text-[1.04rem] leading-relaxed text-fg">{a.executiveSummary}</p>
                {a.keyPoints.length > 0 && (
                  <ul className="mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
                    {a.keyPoints.map((k, i) => (
                      <li key={i} className="m-0 flex gap-2 rounded-xl border border-line bg-surface p-3 text-sm leading-snug">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                        <span>{k}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>
              <DetailSection id="que-es" n={++n} title="¿Qué es esta funcionalidad?" icon={Lightbulb}>
                <Paragraphs text={a.whatIsIt} />
              </DetailSection>
              <DetailSection id="como-funciona" n={++n} title="¿Cómo funciona?" icon={Cog}>
                <Paragraphs text={a.howItWorks} />
                {a.flow.length > 0 && (
                  <div className="mt-5 not-prose">
                    <FlowDiagram steps={a.flow} />
                  </div>
                )}
              </DetailSection>
              <DetailSection id="problema" n={++n} title="¿Qué problema resuelve?" icon={Target}>
                <Paragraphs text={a.problemSolved} />
              </DetailSection>
              <DetailSection id="ventajas" n={++n} title="Ventajas" icon={TrendingUp}>
                <ul>
                  {a.advantages.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </DetailSection>
              <DetailSection id="implementacion" n={++n} title="¿Cómo se puede implementar?" icon={ListChecks}>
                <ol className="!list-none !pl-0">
                  {a.implementationSteps.map((s, i) => (
                    <li key={i} className="relative !my-0 flex gap-3 pb-4 last:pb-0">
                      <span className="tabular z-10 grid size-7 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand-soft text-xs font-semibold text-brand-ink">
                        {i + 1}
                      </span>
                      {i < a.implementationSteps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-line" aria-hidden="true" />}
                      <span className="pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
              </DetailSection>
              <DetailSection id="casos" n={++n} title="Ejemplos de uso en escenarios reales" icon={Puzzle}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {a.useCases.map((u, i) => (
                    <div key={i} className="rounded-2xl border border-line bg-surface p-4">
                      <div className="mb-1 text-sm font-semibold text-fg">{u.title}</div>
                      <p className="!m-0 text-sm leading-relaxed text-fg-muted">{u.scenario}</p>
                    </div>
                  ))}
                </div>
              </DetailSection>
              <DetailSection id="impacto" n={++n} title="Impacto para empresas y equipos de datos" icon={Briefcase}>
                <Paragraphs text={a.businessImpact} />
                {a.audiences.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {a.audiences.map((au) => (
                      <Badge key={au} tone="brand">
                        {AUDIENCE_LABELS[au]}
                      </Badge>
                    ))}
                  </div>
                )}
                {a.considerations.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-400/20 dark:bg-amber-400/5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
                      <ShieldAlert className="size-4 text-amber-600 dark:text-amber-300" /> Consideraciones
                    </div>
                    <ul className="!mb-0 text-sm">
                      {a.considerations.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </DetailSection>
            </>
          )}

          {(a?.codeExample || d.content.codeBlocks.length > 0) && (
            <DetailSection id="codigo" n={a ? ++n : undefined} title="Ejemplo técnico" icon={Code2}>
              <div className="space-y-4">
                {a?.codeExample && (
                  <CodeBlock
                    code={a.codeExample.code}
                    language={a.codeExample.language}
                    caption={
                      <>
                        <strong className="text-white/80">{a.codeExample.origin === 'source' ? 'Código de la publicación oficial.' : 'Ejemplo ilustrativo.'}</strong>{' '}
                        {a.codeExample.explanation}
                      </>
                    }
                  />
                )}
                {!a?.codeExample &&
                  d.content.codeBlocks.slice(0, 3).map((c, i) => (
                    <CodeBlock key={i} code={c.code} language={c.language} caption="Código incluido en la publicación oficial." />
                  ))}
              </div>
            </DetailSection>
          )}

          {d.content.images.length > 0 && (
            <DetailSection id="imagenes" title="Imágenes oficiales" icon={ImageIcon}>
              <div className="grid gap-3 sm:grid-cols-2">
                {d.content.images.slice(0, 4).map((img) => (
                  <a key={img.src} href={img.src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line bg-surface-2">
                    <img
                      src={img.src}
                      alt={img.alt || 'Imagen de la publicación oficial'}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="!m-0 w-full !rounded-none !border-0 object-cover"
                      onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = 'none')}
                    />
                  </a>
                ))}
              </div>
            </DetailSection>
          )}

          <DetailSection id="fuentes" n={a ? ++n : undefined} title="Fuentes oficiales y trazabilidad" icon={BookOpen}>
            <ul className="!list-none space-y-2 !pl-0">
              <li className="!m-0">
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 !no-underline hover:border-brand/40">
                  <span>
                    <span className="block text-sm font-medium text-fg">Publicación original</span>
                    <span className="block text-xs text-fg-muted">{source.name}</span>
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-fg-subtle" />
                </a>
              </li>
              {d.docsUrl && (
                <li className="!m-0">
                  <a href={d.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 !no-underline hover:border-brand/40">
                    <span>
                      <span className="block text-sm font-medium text-fg">Documentación oficial</span>
                      <span className="block break-all text-xs text-fg-muted">{d.docsUrl.replace('https://', '')}</span>
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-fg-subtle" />
                  </a>
                </li>
              )}
              {d.relatedSources.map((s) => (
                <li key={s.url} className="!m-0">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 !no-underline hover:border-brand/40">
                    <span>
                      <span className="block text-sm font-medium text-fg">También publicada en {SOURCES[s.source].name}</span>
                      <span className="block text-xs text-fg-muted">{s.title}</span>
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-fg-subtle" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="!mt-3 text-xs text-fg-subtle">
              Identificador único: <code>{d.id}</code> · Detectada el {formatDateTime(d.detectedAt)} · Última actualización del registro: {formatDateTime(d.updatedAt)}
              {d.aiModel && d.aiGeneratedAt && <> · Análisis generado con IA ({d.aiModel}) el {formatDate(d.aiGeneratedAt)} a partir de la fuente oficial.</>}
            </p>
          </DetailSection>

          {d.content.html && (
            <section className="card overflow-hidden">
              <button onClick={() => setShowOriginal((v) => !v)} aria-expanded={showOriginal} className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-surface-2">
                <span>
                  <span className="block font-semibold text-fg">Contenido original de la publicación</span>
                  <span className="block text-xs text-fg-muted">Texto oficial sin traducir ({d.originalLanguage === 'en' ? 'inglés' : d.originalLanguage}), tal como lo publicó Microsoft.</span>
                </span>
                <ChevronDown className={clsx('size-5 shrink-0 text-fg-subtle transition-transform', showOriginal && 'rotate-180')} />
              </button>
              {showOriginal && (
                <div className="prose-fr border-t border-line p-5 sm:p-7" lang={d.originalLanguage} dangerouslySetInnerHTML={{ __html: d.content.html }} />
              )}
            </section>
          )}

          {d.related.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-fg">Novedades relacionadas</h2>
              <div className="card divide-y divide-line px-2 py-1">
                {d.related.map((r) => (
                  <UpdateRow key={r.id} u={r} />
                ))}
              </div>
            </section>
          )}
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {a && (
            <nav className="card hidden p-4 lg:block" aria-label="En esta ficha">
              <div className="eyebrow mb-2">En esta ficha</div>
              <ul className="space-y-0.5">
                {SECTIONS.filter((s) => sectionIds.includes(s.id)).map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={clsx(
                        'block rounded-lg px-2.5 py-1.5 text-sm transition',
                        active === s.id ? 'bg-brand-soft font-medium text-brand-ink' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                      )}
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div className="card p-4">
            <div className="eyebrow mb-1">Ficha técnica</div>
            <dl className="divide-y divide-line">
              <Fact label="Fecha de publicación">{published}</Fact>
              <Fact label="Detectada por la plataforma">{formatDateTime(d.detectedAt)}</Fact>
              <Fact label="Categoría tecnológica">
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {d.categories.map((c) => (
                    <CategoryChip key={c} id={c} />
                  ))}
                </div>
              </Fact>
              <Fact label="Fase">{d.stage === 'none' ? '—' : STAGE_SHORT[d.stage]}</Fact>
              <Fact label="Tipo">{UPDATE_TYPE_LABELS[d.type]}</Fact>
              <Fact label="Fuente">{source.name}</Fact>
              {d.author && <Fact label="Autor">{d.author}</Fact>}
              {d.technologies.length > 0 && (
                <Fact label="Tecnologías">
                  <div className="flex flex-wrap gap-1 pt-1">
                    {d.technologies.map((t) => (
                      <Link key={t} to={`/historico?tec=${encodeURIComponent(t)}`} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-fg-muted hover:text-fg">
                        {t}
                      </Link>
                    ))}
                  </div>
                </Fact>
              )}
              <Fact label="Idioma original">{d.originalLanguage === 'en' ? 'Inglés (traducido al español)' : d.originalLanguage === 'es' ? 'Español' : 'Otro'}</Fact>
            </dl>
          </div>
          <div className="card p-4 text-xs leading-relaxed text-fg-muted">
            <div className="mb-1.5 flex items-center gap-1.5 font-medium text-fg">
              <Info className="size-3.5" /> Sobre este análisis
            </div>
            La ficha se elabora automáticamente a partir de la publicación oficial de Microsoft y su documentación enlazada. Los nombres técnicos se mantienen en su forma original. Consulta siempre la{' '}
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-brand-ink underline">
              fuente original
            </a>{' '}
            antes de tomar decisiones.
          </div>
          {CATEGORY_BY_ID[d.primaryCategory] && (
            <Link to={`/categorias/${d.primaryCategory}`} className="card card-hover block p-4 text-sm">
              <span className="text-fg-muted">Más novedades de</span>
              <span className="block font-semibold text-fg">{CATEGORY_BY_ID[d.primaryCategory].name} →</span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
