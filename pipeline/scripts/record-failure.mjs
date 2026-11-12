#!/usr/bin/env node
// Registro de fallo sin dependencias externas: se usa cuando el pipeline ni siquiera pudo
// arrancar (p. ej. falló `npm ci`). Añade una ejecución "failed" al historial y actualiza
// data/status.json para que la plataforma nunca muestre como exitosa una ejecución fallida.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '..', '..', 'data');
const reason = process.argv[2] || 'La ejecución del workflow falló.';
const now = new Date().toISOString();

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const workflowRunUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined;

const run = {
  id: `run-${now.replace(/[-:.TZ]/g, '').slice(0, 14)}-fail`,
  trigger: process.env.TRIGGER || 'schedule',
  startedAt: now,
  finishedAt: now,
  durationMs: 0,
  status: 'failed',
  sources: [],
  ai: {
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: null,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    roadmapTranslated: 0,
    pendingUpdates: 0,
    pendingRoadmap: 0,
    inputTokens: 0,
    outputTokens: 0,
  },
  totals: { newUpdates: 0, updatedUpdates: 0, newRoadmap: 0, changedRoadmap: 0, duplicatesLinked: 0 },
  issues: [{ level: 'error', stage: 'workflow', message: reason.slice(0, 1000), at: now }],
  ...(workflowRunUrl ? { workflowRunUrl } : {}),
};

const runsFile = path.join(dataDir, 'runs', `${now.slice(0, 7)}.json`);
const runs = await readJson(runsFile, []);
runs.push(run);
await writeJson(runsFile, runs);

const statusFile = path.join(dataDir, 'status.json');
const status = await readJson(statusFile, null);
await writeJson(statusFile, {
  generatedAt: now,
  lastRun: run,
  lastSuccessfulRunAt: status?.lastSuccessfulRunAt ?? null,
  lastSuccessfulRunId: status?.lastSuccessfulRunId ?? null,
  lastAttemptAt: now,
  consecutiveFailures: (status?.lastRun?.status === 'failed' ? status.consecutiveFailures ?? 0 : 0) + 1,
  health: 'failing',
  counts: status?.counts ?? {
    updates: 0,
    roadmap: 0,
    aiDoneUpdates: 0,
    aiPendingUpdates: 0,
    aiErrorUpdates: 0,
    aiDoneRoadmap: 0,
    aiPendingRoadmap: 0,
  },
  ai: status?.ai ?? { configured: false, model: null },
});
console.log(`Fallo registrado: ${run.id}`);
