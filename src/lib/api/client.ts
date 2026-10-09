import { supabase } from '@/integrations/supabase/client';

/** Error response from the API (RFC 9457 problem details). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

async function accessToken(refresh: boolean): Promise<string | null> {
  const { data } = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function send(path: string, options: ApiRequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

async function toError(response: Response): Promise<ApiError> {
  let problem: { detail?: string; title?: string; code?: string; errors?: unknown } = {};
  try {
    problem = await response.json();
  } catch {
    // Non-JSON error body (e.g. a proxy error page)
  }
  return new ApiError(
    response.status,
    problem.detail || problem.title || `Request failed (${response.status})`,
    problem.code,
    problem.errors,
  );
}

/**
 * Calls the Love Islander API with the signed-in user's access token. On a 401 the session is refreshed once and
 * the request retried, so an expired access token does not surface as an error.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response = await send(path, options, await accessToken(false));
  if (response.status === 401) {
    const refreshed = await accessToken(true);
    if (refreshed) {
      response = await send(path, options, refreshed);
    }
  }
  if (!response.ok) {
    throw await toError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
