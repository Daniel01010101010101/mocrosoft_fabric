import { loadConfig } from './config';
import { buildApi } from './export/buildApi';
import { recordWorkflowFailure } from './recordFailure';
import { runPipeline } from './run';
import { Store } from './core/store';
import { DATA_DIR } from './config';
import type { RunTrigger } from '../../shared/types';

/**
 * CLI del pipeline:
 *   run [--no-ai] [--trigger schedule|manual|local|retry]   Ejecuta una consulta completa de las fuentes.
 *   export                                                   Genera la API estática para el frontend.
 *   record-failure --reason "..."                            Registra un fallo de la ejecución del workflow.
 *   status                                                   Muestra el estado actual.
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const command = process.argv[2] ?? 'run';
  switch (command) {
    case 'run': {
      const trigger = (arg('trigger') ?? (process.env.GITHUB_ACTIONS ? 'schedule' : 'local')) as RunTrigger;
      const run = await runPipeline({ trigger, ai: !process.argv.includes('--no-ai') });
      // Código de salida != 0 solo si la ejecución falló por completo: el workflow reintenta.
      process.exitCode = run.status === 'failed' ? 1 : 0;
      break;
    }
    case 'export': {
      const meta = await buildApi();
      console.log(`API generada: ${meta.updates} novedades, ${meta.roadmap} elementos de roadmap.`);
      break;
    }
    case 'record-failure': {
      const reason = arg('reason') ?? 'La ejecución del workflow falló antes de completar la ingesta.';
      await recordWorkflowFailure({ reason, trigger: (arg('trigger') as RunTrigger) ?? 'schedule', config: loadConfig() });
      console.log('Fallo registrado en el historial de ejecuciones.');
      break;
    }
    case 'status': {
      const status = await Store.readStatus(DATA_DIR);
      console.log(JSON.stringify(status, null, 2));
      break;
    }
    default:
      console.error(`Comando desconocido: ${command}`);
      process.exitCode = 2;
  }
}

main().catch(async (err) => {
  console.error('Error fatal en el pipeline:', err);
  // Registrar el fallo para que la plataforma nunca muestre como exitosa una ejecución fallida.
  if ((process.argv[2] ?? 'run') === 'run') {
    try {
      await recordWorkflowFailure({
        reason: `Error fatal: ${(err as Error).message ?? String(err)}`,
        trigger: (arg('trigger') as RunTrigger) ?? 'schedule',
        config: loadConfig(),
      });
    } catch (inner) {
      console.error('Tampoco se pudo registrar el fallo:', inner);
    }
  }
  process.exitCode = 1;
});
