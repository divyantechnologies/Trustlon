const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
  }

  get retryAfterSeconds(): number | undefined {
    const value = this.data.retryAfterSeconds;
    return typeof value === 'number' ? value : undefined;
  }

  /** Name of the form field the error belongs to, when the API reports one. */
  get field(): string | undefined {
    const value = this.data.field;
    return typeof value === 'string' ? value : undefined;
  }

  get attemptsLeft(): number | undefined {
    const value = this.data.attemptsLeft;
    return typeof value === 'number' ? value : undefined;
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Registered by the auth provider so expired access tokens are renewed transparently. */
export function setRefreshHandler(handler: () => Promise<string | null>): void {
  refreshHandler = handler;
}

function refreshOnce(): Promise<string | null> {
  if (!refreshHandler) return Promise.resolve(null);
  refreshInFlight ??= refreshHandler().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  /** Extra request headers, e.g. the guest token. */
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = (token: string | null) =>
    fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      signal: options.signal,
      headers: {
        Accept: 'application/json',
        ...options.headers,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let response = await send(accessToken);
  if (response.status === 401 && options.auth) {
    const renewed = await refreshOnce();
    if (renewed) response = await send(renewed);
  }

  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const raw = data.message;
    const message = Array.isArray(raw) ? String(raw[0]) : typeof raw === 'string' ? raw : '';
    throw new ApiError(response.status, message, data);
  }
  return data as T;
}
