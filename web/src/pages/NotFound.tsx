import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound({ title = 'Página no encontrada' }: { title?: string }) {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-ink text-brand">
          <Compass className="size-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          El enlace puede haber cambiado o la novedad ya no está disponible. Usa el buscador (Ctrl K) para encontrar lo que buscas.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-ink-fg dark:bg-brand dark:text-ink">
            Ir al dashboard
          </Link>
          <Link to="/historico" className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-fg">
            Ver histórico
          </Link>
        </div>
      </div>
    </div>
  );
}
