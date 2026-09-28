const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  tenantId?: string | null;
  query?: Record<string, string | number | undefined>;
}

function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Thin fetch wrapper: attaches the JWT + X-Tenant-Id, maps error responses to ApiError. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId;

  const res = await fetch(`${API_BASE}${path}${buildQuery(options.query)}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (isJson) {
      const data = (await res.json()) as { code?: string; message?: string };
      throw new ApiError(res.status, data.code ?? 'UNKNOWN', data.message ?? '請求失敗');
    }
    throw new ApiError(res.status, 'UNKNOWN', await res.text());
  }

  if (isJson) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

/** CSV export needs the auth header too, so a plain <a href> won't work — fetch as a blob and trigger a download. */
export async function downloadCsv(
  path: string,
  options: { token: string; tenantId: string; query?: RequestOptions['query'] },
  filename: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.token}`,
    'X-Tenant-Id': options.tenantId,
  };
  const res = await fetch(`${API_BASE}${path}${buildQuery(options.query)}`, { headers });
  if (!res.ok) throw new ApiError(res.status, 'EXPORT_FAILED', '匯出失敗');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
