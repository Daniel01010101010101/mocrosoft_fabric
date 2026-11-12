/**
 * Calendario de ejecuciones automáticas (UTC).
 *
 * Debe coincidir EXACTAMENTE con los `cron` de .github/workflows/ingest.yml
 * (un test lo verifica). Las horas se eligieron para cubrir la ventana en la que
 * Microsoft publica habitualmente (mañana y tarde del Pacífico) y para que los
 * equipos de España y Latinoamérica vean las novedades al empezar su jornada.
 * Se evitan los minutos :00 y :30 porque GitHub Actions retrasa los cron más demandados.
 */

export interface ScheduleSlot {
  /** Expresión cron de 5 campos en UTC. */
  cron: string;
  hourUtc: number;
  minuteUtc: number;
  label: string;
  rationale: string;
}

export const SCHEDULE: ScheduleSlot[] = [
  {
    cron: '17 6 * * *',
    hourUtc: 6,
    minuteUtc: 17,
    label: 'Madrugada (Europa)',
    rationale: 'Recoge lo publicado durante la noche europea antes del inicio de jornada en España.',
  },
  {
    cron: '17 11 * * *',
    hourUtc: 11,
    minuteUtc: 17,
    label: 'Mediodía (Europa)',
    rationale: 'Actualización de media mañana para Europa y primera hora en Latinoamérica.',
  },
  {
    cron: '47 16 * * *',
    hourUtc: 16,
    minuteUtc: 47,
    label: 'Mañana (EE. UU.)',
    rationale: 'Tras la ventana principal de publicación de Microsoft (mañana del Pacífico).',
  },
  {
    cron: '47 19 * * *',
    hourUtc: 19,
    minuteUtc: 47,
    label: 'Mediodía (EE. UU.)',
    rationale: 'Captura anuncios de mediodía en EE. UU. y actualizaciones de documentación.',
  },
  {
    cron: '17 23 * * *',
    hourUtc: 23,
    minuteUtc: 17,
    label: 'Cierre del día',
    rationale: 'Cierre de la jornada en EE. UU.; deja todo listo para la tarde en Latinoamérica.',
  },
];

/** Margen tras la hora programada antes de considerar una ejecución como retrasada. */
export const RUN_GRACE_MINUTES = 75;

/** Próxima ejecución programada a partir de `from`. */
export function nextScheduledRun(from: Date = new Date()): Date {
  const candidates: Date[] = [];
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const slot of SCHEDULE) {
      const d = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + dayOffset, slot.hourUtc, slot.minuteUtc, 0, 0),
      );
      if (d.getTime() > from.getTime()) candidates.push(d);
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0]!;
}

/** Última ejecución que debería haberse producido antes de `from`. */
export function previousScheduledRun(from: Date = new Date()): Date {
  const candidates: Date[] = [];
  for (let dayOffset = -1; dayOffset <= 0; dayOffset++) {
    for (const slot of SCHEDULE) {
      const d = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + dayOffset, slot.hourUtc, slot.minuteUtc, 0, 0),
      );
      if (d.getTime() <= from.getTime()) candidates.push(d);
    }
  }
  candidates.sort((a, b) => b.getTime() - a.getTime());
  return candidates[0]!;
}
