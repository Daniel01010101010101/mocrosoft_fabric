import clsx from 'clsx';
import {
  CalendarRange,
  ChevronDown,
  History,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Moon,
  Newspaper,
  Search,
  ServerCog,
  Star,
  Sun,
  X,
  Shapes,
  Table2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { CATEGORIES } from '../../../shared/categories';
import { useUpdates } from '../lib/api';
import { formatRelative } from '../lib/format';
import { CATEGORY_ICON } from '../lib/labels';
import { withinDays } from '../lib/stats';
import { useTheme } from '../lib/theme';
import { CommandPalette } from './CommandPalette';
import { PulseDot, SyncPill, useSync } from './SyncStatus';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/novedades', label: 'Últimas novedades', icon: Newspaper },
  { to: '/semanas', label: 'Últimas semanas', icon: CalendarRange },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/roadmap', label: 'Roadmap y próximas', icon: MapIcon },
  { to: '/destacadas', label: 'Más importantes', icon: Star },
  { to: '/powertable', label: 'PowerTable · Guía', icon: Table2 },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="Fabric Radar, inicio">
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#123b23] to-[#0a120d] ring-1 ring-white/10">
        <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#22c55e" strokeOpacity=".35" strokeWidth="1.6" />
          <circle cx="16" cy="16" r="5.5" fill="none" stroke="#22c55e" strokeOpacity=".6" strokeWidth="1.6" />
          <g className="origin-center animate-sweep" style={{ transformOrigin: '16px 16px' }}>
            <path d="M16 16 L16 5 A11 11 0 0 1 25.5 10.5 Z" fill="url(#sweep)" />
          </g>
          <circle cx="16" cy="16" r="2.2" fill="#4ade80" />
          <defs>
            <linearGradient id="sweep" x1="16" y1="5" x2="25" y2="12">
              <stop offset="0" stopColor="#4ade80" stopOpacity=".7" />
              <stop offset="1" stopColor="#4ade80" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[0.98rem] font-semibold tracking-tight text-white">Fabric Radar</span>
          <span className="block text-[0.68rem] text-ink-muted">Inteligencia de Microsoft Fabric</span>
        </span>
      )}
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const updates = useUpdates();
  const sync = useSync();
  const location = useLocation();
  const [catsOpen, setCatsOpen] = useState(() => location.pathname.startsWith('/categorias'));
  const recentByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of updates.data ?? []) if (withinDays(u, 30)) m.set(u.primaryCategory, (m.get(u.primaryCategory) ?? 0) + 1);
    return m;
  }, [updates.data]);
  const weekCount = useMemo(() => (updates.data ?? []).filter((u) => withinDays(u, 7)).length, [updates.data]);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[0.88rem] font-medium transition',
      isActive ? 'bg-white/[0.07] text-white' : 'text-ink-muted hover:bg-white/[0.04] hover:text-white',
    );

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <Logo />
      </div>
      <nav className="ink-scroll flex-1 space-y-6 overflow-y-auto px-3 pb-6" aria-label="Navegación principal">
        <div>
          <div className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-muted/70">Explorar</div>
          <ul className="space-y-0.5">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.end} className={linkCls} onClick={onNavigate}>
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand" />
                      )}
                      <n.icon className={clsx('size-[1.05rem]', isActive ? 'text-brand' : 'text-ink-muted group-hover:text-white')} />
                      <span className="flex-1">{n.label}</span>
                      {n.to === '/powertable' && (
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white/70">Nuevo</span>
                      )}
                      {n.to === '/novedades' && weekCount > 0 && (
                        <span className="tabular rounded-md bg-brand/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand">{weekCount}</span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <button
            onClick={() => setCatsOpen((v) => !v)}
            className="mb-2 flex w-full items-center justify-between px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-muted/70 hover:text-ink-muted"
            aria-expanded={catsOpen}
          >
            Categorías
            <ChevronDown className={clsx('size-3.5 transition-transform', catsOpen && 'rotate-180')} />
          </button>
          <NavLink to="/categorias" end className={linkCls} onClick={onNavigate}>
            <Shapes className="size-[1.05rem]" />
            <span className="flex-1">Todas las categorías</span>
          </NavLink>
          <AnimatePresence initial={false}>
            {catsOpen && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-0.5 space-y-0.5 overflow-hidden"
              >
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICON[c.id];
                  const n = recentByCat.get(c.id) ?? 0;
                  return (
                    <li key={c.id}>
                      <NavLink to={`/categorias/${c.id}`} className={linkCls} onClick={onNavigate}>
                        <Icon className="size-4 opacity-80" />
                        <span className="flex-1 truncate text-[0.83rem]">{c.name}</span>
                        {n > 0 && <span className="tabular text-[0.65rem] text-ink-muted">{n}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </nav>
      <div className="border-t border-ink-line p-3">
        <NavLink to="/estado" className={linkCls} onClick={onNavigate}>
          <ServerCog className="size-[1.05rem]" />
          <span className="flex-1">
            <span className="block">Estado del sistema</span>
            <span className="block text-[0.7rem] font-normal text-ink-muted">
              {sync.isLoading ? 'Cargando…' : sync.status?.lastRun ? `${sync.label} · ${formatRelative(sync.status.lastRun.finishedAt)}` : sync.label}
            </span>
          </span>
          <PulseDot health={sync.health} />
        </NavLink>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const location = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] bg-ink lg:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[288px] max-w-[85vw] bg-ink lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-5 rounded-lg p-2 text-ink-muted hover:bg-white/5 hover:text-white"
                aria-label="Cerrar menú"
              >
                <X className="size-5" />
              </button>
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </button>
            <div className="lg:hidden">
              <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-fg">
                <span className="grid size-7 place-items-center rounded-lg bg-ink">
                  <span className="size-2 rounded-full bg-brand shadow-[0_0_10px_2px_rgba(34,197,94,0.6)]" />
                </span>
                <span className="hidden sm:inline">Fabric Radar</span>
              </Link>
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              className="group ml-auto flex h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm text-fg-subtle shadow-card transition hover:border-line-strong lg:ml-0"
              aria-label="Buscar novedades (Ctrl+K)"
            >
              <Search className="size-4" />
              <span className="flex-1 truncate text-left">Buscar novedades…</span>
              <kbd className="hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.65rem] text-fg-muted sm:inline">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <SyncPill />
              <button
                onClick={toggle}
                className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-fg-muted transition hover:border-line-strong hover:text-fg"
                aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
                title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              >
                {theme === 'dark' ? <Sun className="size-[1.05rem]" /> : <Moon className="size-[1.05rem]" />}
              </button>
            </div>
          </div>
        </header>
        <main id="contenido" className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
        <footer className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 text-xs text-fg-subtle sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Fabric Radar es un proyecto independiente, no afiliado a Microsoft. Microsoft Fabric y Power BI son marcas de Microsoft
              Corporation. Toda la información procede de fuentes oficiales y se enlaza a su publicación original.
            </p>
            <Link to="/estado" className="shrink-0 hover:text-fg">
              Trazabilidad y fuentes →
            </Link>
          </div>
        </footer>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
