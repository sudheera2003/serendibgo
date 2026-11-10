import { Platform } from 'react-native';
import { API } from './config';
import { useAuth } from './auth-store';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[] | undefined> | unknown,
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
  /** First validation message for a field, if the server sent one. */
  field(name: string) {
    const d = this.details as Record<string, string[] | undefined> | undefined;
    return d && typeof d === 'object' ? d[name]?.[0] : undefined;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;
interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  auth?: boolean;
}

const qs = (q?: Query) => {
  if (!q) return '';
  const parts = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh: concurrent 401s share one refresh request. */
async function refreshTokens(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuth.getState();
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
      if (!res.ok) {
        await clear();
        return false;
      }
      const data = await res.json();
      await setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function raw(path: string, init: RequestInit, auth: boolean, retry = true): Promise<Response> {
  const token = useAuth.getState().accessToken;
  const headers = new Headers(init.headers);
  if (auth && token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the SerendibGO server. Check your internet connection and that the API is running.');
  }
  if (res.status === 401 && auth && retry && useAuth.getState().refreshToken) {
    if (await refreshTokens()) return raw(path, init, auth, false);
  }
  return res;
}

export async function request<T>(path: string, o: Options = {}): Promise<T> {
  const init: RequestInit = { method: o.method ?? 'GET' };
  if (o.body !== undefined) {
    init.body = JSON.stringify(o.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const res = await raw(`${path}${qs(o.query)}`, init, o.auth !== false);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (data as { error?: { code: string; message: string; details?: unknown } }).error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong', e?.details, data as Record<string, unknown>);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  public: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body, auth: false }),
};

/** Uploads an image or PDF picked on the device and returns its public URL. */
export async function uploadFile(file: { uri: string; name?: string; mimeType?: string | null }): Promise<string> {
  const form = new FormData();
  const name = file.name ?? `upload-${Date.now()}.jpg`;
  const type = file.mimeType ?? (name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append('file', new File([blob], name, { type }));
  } else {
    form.append('file', { uri: file.uri, name, type } as unknown as Blob);
  }
  const res = await raw('/uploads', { method: 'POST', body: form }, true);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'UPLOAD', data?.error?.message ?? 'Upload failed');
  return data.url as string;
}

export const errorMessage = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong');
