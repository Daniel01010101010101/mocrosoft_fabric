import clsx from 'clsx';
import { Check, ChevronRight, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import type { FlowStep } from '../../../shared/types';

export function CodeBlock({ code, language, caption }: { code: string; language: string; caption?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <figure className="overflow-hidden rounded-2xl border border-ink-line bg-[#0b0f0d]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
            <span className="size-2.5 rounded-full bg-white/10" />
          </span>
          <span className="font-mono text-[0.7rem] uppercase tracking-wider text-[#4ade80]">{language || 'code'}</span>
        </div>
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/60 transition hover:bg-white/5 hover:text-white" aria-label="Copiar código">
          {copied ? <Check className="size-3.5 text-[#4ade80]" /> : <Copy className="size-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-4 font-mono text-[0.82rem] leading-relaxed text-[#d8e6dd]">
        <code>{code}</code>
      </pre>
      {caption && <figcaption className="border-t border-white/5 px-4 py-2.5 text-xs leading-relaxed text-white/60">{caption}</figcaption>}
    </figure>
  );
}

/** Diagrama de flujo generado a partir del análisis (pasos del funcionamiento). */
export function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-4 sm:p-5" role="list" aria-label="Diagrama de funcionamiento">
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-col items-stretch gap-3 md:flex-1 md:flex-row md:items-center" role="listitem">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className={clsx(
                'relative flex-1 rounded-xl border bg-surface p-3.5',
                i === 0 ? 'border-brand/40' : i === steps.length - 1 ? 'border-brand/60 shadow-[0_0_0_3px_var(--brand-soft)]' : 'border-line',
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="tabular grid size-5 place-items-center rounded-full bg-ink text-[0.65rem] font-semibold text-brand">{i + 1}</span>
                <span className="text-sm font-semibold text-fg">{s.label}</span>
              </div>
              <p className="text-xs leading-relaxed text-fg-muted">{s.detail}</p>
            </motion.div>
            {i < steps.length - 1 && (
              <ChevronRight className="mx-auto size-5 shrink-0 rotate-90 text-brand md:rotate-0" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSection({
  id,
  n,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  n?: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(n ?? 0, 8) * 0.04 }}
      className="scroll-mt-24"
    >
      <h2 className="mb-3 flex items-center gap-2.5 text-[1.08rem] font-semibold tracking-tight text-fg">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-ink">
          <Icon className="size-4" />
        </span>
        {n !== undefined && <span className="tabular text-fg-subtle">{String(n).padStart(2, '0')}</span>}
        {title}
      </h2>
      <div className="prose-fr">{children}</div>
    </motion.section>
  );
}

export function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}|\n(?=[A-ZÁÉÍÓÚÑ¿¡])/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </>
  );
}
