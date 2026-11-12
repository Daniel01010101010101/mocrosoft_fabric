import { useQuery } from '@tanstack/react-query';
import type { ApiMeta, RoadmapSummary, StatusResponse, UpdateDetail, UpdateSummary } from '../../../shared/types';

const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}api/${path}`, { headers: { accept: 'application/json' } });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', null);
  }
  if (res.status === 404) throw new ApiError('El recurso solicitado no existe.', 404);
  if (!res.ok) throw new ApiError(`El servidor respondió con un error (${res.status}).`, res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('Los datos recibidos no tienen un formato válido.', res.status);
  }
}

const STALE = 5 * 60 * 1000;

export function useUpdates() {
  return useQuery({ queryKey: ['updates'], queryFn: () => getJson<UpdateSummary[]>('updates.json'), staleTime: STALE });
}

export function useRoadmap() {
  return useQuery({ queryKey: ['roadmap'], queryFn: () => getJson<RoadmapSummary[]>('roadmap.json'), staleTime: STALE });
}

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: () => getJson<StatusResponse | { status: null; runs: [] }>('status.json'),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => getJson<ApiMeta>('meta.json'), staleTime: STALE });
}

export function useAliases() {
  return useQuery({ queryKey: ['aliases'], queryFn: () => getJson<Record<string, string>>('aliases.json'), staleTime: STALE });
}

export function useUpdateDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['update', id],
    queryFn: () => getJson<UpdateDetail>(`updates/${encodeURIComponent(id!)}.json`),
    enabled: Boolean(id),
    staleTime: STALE,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}
