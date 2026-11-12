import clsx from 'clsx';
import { ArrowRight, CornerDownLeft, Map as MapIcon, Newspaper, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../../../shared/categories';
import { useRoadmap, useUpdates } from '../lib/api';
import { formatPublished, quarterLabel } from '../lib/format';
import { CATEGORY_ICON } from '../lib/labels';
import { search } from '../lib/search';
import { normalize } from '../lib/search';

interface Result {
  key: string;
  title: string;
  subtitle: string;
  to: string;
  kind: 'update' | 'roadmap' | 'category';
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const updates = useUpdates();
  const roadmap = useRoadmap();

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results: Result[] = useMemo(() => {
    const u = updates.data ?? [];
    const r = roadmap.data ?? [];
    const query = q.trim();
    if (query.length < 2) {
      return [...u]
        .slice(0, 6)
        .map((x) => ({
          key: x.id,
          title: x.titleEs ?? x.titleOriginal,
          subtitle: `Novedad · ${x.undated ? 'Sin fecha oficial' : formatPublished(x.publishedAt, x.datePrecision)}`,
          to: `/novedad/${x.id}`,
          kind: 'update' as const,
        }));
    }
    const nq = normalize(query);
    const cats: Result[] = CATEGORIES.filter((c) => normalize(c.name).includes(nq)).map((c) => ({
      key: `cat-${c.id}`,
      title: c.name,
      subtitle: 'Categoría',
      to: `/categorias/${c.id}`,
      kind: 'category',
    }));
    const byId = new Map(u.map((x) => [x.id, x]));
    const rmById = new Map(r.map((x) => [x.id, x]));
    const hits = search(u, r, query, 30).flatMap<Result>((h) => {
      if (h.kind === 'update') {
        const x = byId.get(h.id);
        return x
          ? [{ key: x.id, title: x.titleEs ?? x.titleOriginal, subtitle: `Novedad · ${x.undated ? 'Sin fecha oficial' : formatPublished(x.publishedAt, x.datePrecision)}`, to: `/novedad/${x.id}`, kind: 'update' }]
          : [];
      }
      const x = rmById.get(h.id);
      return x
        ? [{ key: x.id, title: x.nameEs ?? x.name, subtitle: `Roadmap · ${x.product} · ${quarterLabel(x.releaseDate)}`, to: `/roadmap?q=${encodeURIComponent(query)}&item=${x.id}`, kind: 'roadmap' }]
        : [];
    });
    return [...cats.slice(0, 3), ...hits].slice(0, 14);
  }, [q, updates.data, roadmap.data]);

  useEffect(() => setActive(0), [q]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    navigate(r.to);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar novedades"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 text-fg-subtle" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive((a) => Math.min(results.length - 1, a + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive((a) => Math.max(0, a - 1));
                  } else if (e.key === 'Enter') {
                    if (results[active]) go(results[active]);
                    else if (q.trim()) {
                      navigate(`/historico?q=${encodeURIComponent(q.trim())}`);
                      onClose();
                    }
                  } else if (e.key === 'Escape') onClose();
                }}
                placeholder="Busca novedades, funcionalidades, categorías o el roadmap…"
                className="h-14 w-full bg-transparent text-[0.95rem] text-fg outline-none placeholder:text-fg-subtle"
                aria-label="Buscar"
              />
              <button onClick={onClose} className="rounded-lg p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label="Cerrar">
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
              {(updates.isLoading || roadmap.isLoading) && <div className="px-3 py-6 text-center text-sm text-fg-muted">Preparando el índice de búsqueda…</div>}
              {!updates.isLoading && results.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-fg-muted">Sin resultados para «{q}». Prueba con otro término o con el nombre en inglés.</div>
              )}
              {q.trim().length < 2 && results.length > 0 && <div className="eyebrow px-3 pb-1 pt-2">Lo más reciente</div>}
              <ul>
                {results.map((r, i) => {
                  const Icon =
                    r.kind === 'category'
                      ? CATEGORY_ICON[r.to.split('/').pop() as keyof typeof CATEGORY_ICON]
                      : r.kind === 'roadmap'
                        ? MapIcon
                        : Newspaper;
                  return (
                    <li key={r.key}>
                      <button
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(r)}
                        className={clsx(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                          i === active ? 'bg-surface-2' : 'hover:bg-surface-2',
                        )}
                      >
                        <span className={clsx('grid size-8 shrink-0 place-items-center rounded-lg', i === active ? 'bg-brand-soft text-brand-ink' : 'bg-surface-2 text-fg-subtle')}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-sm font-medium text-fg">{r.title}</span>
                          <span className="line-clamp-1 text-xs text-fg-subtle">{r.subtitle}</span>
                        </span>
                        {i === active && <CornerDownLeft className="size-4 text-fg-subtle" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {q.trim().length >= 2 && (
                <button
                  onClick={() => {
                    navigate(`/historico?q=${encodeURIComponent(q.trim())}`);
                    onClose();
                  }}
                  className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-brand-ink hover:bg-surface-2"
                >
                  Ver todos los resultados en el histórico <ArrowRight className="size-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[0.7rem] text-fg-subtle">
              <span>↑↓ navegar</span>
              <span>↵ abrir</span>
              <span>esc cerrar</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
