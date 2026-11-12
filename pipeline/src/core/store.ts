import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RoadmapItem, RunRecord, SystemStatus, UpdateItem } from '../../../shared/types';
import type { HttpCacheEntry } from './http';
import { sha1 } from './text';

/**
 * Base de datos documental persistente basada en ficheros JSON versionados en Git.
 *
 * - Un documento por novedad (data/updates/<id>.json) y por elemento del roadmap
 *   (data/roadmap/<id>.json): los cambios se ven en el historial de Git y nunca se
 *   pierde información (los registros no se borran, solo se marcan).
 * - Escrituras atómicas (fichero temporal + rename) y solo de los documentos modificados.
 * - Registro de ejecuciones mensual en data/runs/AAAA-MM.json y estado en data/status.json.
 */

export interface DocCacheEntry {
  url: string;
  fetchedAt: string;
  title: string;
  text: string;
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(`No se pudo leer ${file}: ${(err as Error).message}`);
  }
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, stableStringify(value), 'utf8');
  await fs.rename(tmp, file);
}

async function listJson(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export class Store {
  readonly updates = new Map<string, UpdateItem>();
  readonly roadmap = new Map<string, RoadmapItem>();
  httpCache: Record<string, HttpCacheEntry> = {};
  private readonly snapshot = new Map<string, string>();

  private constructor(readonly dataDir: string) {}

  static async load(dataDir: string): Promise<Store> {
    const store = new Store(dataDir);
    for (const file of await listJson(path.join(dataDir, 'updates'))) {
      const item = await readJson<UpdateItem>(file);
      if (item?.id) {
        store.updates.set(item.id, item);
        store.snapshot.set(`u:${item.id}`, stableStringify(item));
      }
    }
    for (const file of await listJson(path.join(dataDir, 'roadmap'))) {
      const item = await readJson<RoadmapItem>(file);
      if (item?.id) {
        store.roadmap.set(item.id, item);
        store.snapshot.set(`r:${item.id}`, stableStringify(item));
      }
    }
    store.httpCache = (await readJson<Record<string, HttpCacheEntry>>(path.join(dataDir, 'state', 'http-cache.json'))) ?? {};
    return store;
  }

  /** Persiste únicamente los documentos que han cambiado. Devuelve cuántos se escribieron. */
  async save(): Promise<{ updates: number; roadmap: number }> {
    let u = 0;
    let r = 0;
    for (const [id, item] of this.updates) {
      const json = stableStringify(item);
      if (this.snapshot.get(`u:${id}`) !== json) {
        await writeJsonAtomic(path.join(this.dataDir, 'updates', `${id}.json`), item);
        this.snapshot.set(`u:${id}`, json);
        u++;
      }
    }
    for (const [id, item] of this.roadmap) {
      const json = stableStringify(item);
      if (this.snapshot.get(`r:${id}`) !== json) {
        await writeJsonAtomic(path.join(this.dataDir, 'roadmap', `${id}.json`), item);
        this.snapshot.set(`r:${id}`, json);
        r++;
      }
    }
    await writeJsonAtomic(path.join(this.dataDir, 'state', 'http-cache.json'), sortKeys(this.httpCache));
    return { updates: u, roadmap: r };
  }

  /* ------------------------- caché de documentación ------------------------- */

  async getDoc(url: string, maxAgeDays: number): Promise<DocCacheEntry | null> {
    const entry = await readJson<DocCacheEntry>(this.docPath(url));
    if (!entry) return null;
    const age = Date.now() - Date.parse(entry.fetchedAt);
    return age <= maxAgeDays * 86_400_000 ? entry : null;
  }

  async putDoc(entry: DocCacheEntry): Promise<void> {
    await writeJsonAtomic(this.docPath(entry.url), entry);
  }

  private docPath(url: string): string {
    return path.join(this.dataDir, 'cache', 'docs', `${sha1(url).slice(0, 20)}.json`);
  }

  /* ------------------------- ejecuciones y estado ------------------------- */

  async appendRun(run: RunRecord): Promise<void> {
    const month = run.startedAt.slice(0, 7);
    const file = path.join(this.dataDir, 'runs', `${month}.json`);
    const runs = (await readJson<RunRecord[]>(file)) ?? [];
    runs.push(run);
    await writeJsonAtomic(file, runs);
  }

  async recentRuns(limit: number): Promise<RunRecord[]> {
    return Store.readRecentRuns(this.dataDir, limit);
  }

  static async readRecentRuns(dataDir: string, limit: number): Promise<RunRecord[]> {
    const files = (await listJson(path.join(dataDir, 'runs'))).sort().reverse();
    const out: RunRecord[] = [];
    for (const file of files) {
      const runs = (await readJson<RunRecord[]>(file)) ?? [];
      for (const run of [...runs].reverse()) {
        out.push(run);
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  async writeStatus(status: SystemStatus): Promise<void> {
    await writeJsonAtomic(path.join(this.dataDir, 'status.json'), status);
  }

  static async readStatus(dataDir: string): Promise<SystemStatus | null> {
    return readJson<SystemStatus>(path.join(dataDir, 'status.json'));
  }
}

function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) as T;
}

export { readJson, writeJsonAtomic };
