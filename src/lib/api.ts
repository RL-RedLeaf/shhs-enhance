export class ApiError extends Error {
  status: number
  code: string
  retryAfter?: number
  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST'
  body?: unknown
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await fetch('/api/' + path, {
    method: opts.method ?? 'GET',
    credentials: 'same-origin',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    let code = 'UNKNOWN'
    let message = '请求失败'
    try {
      const data = (await res.json()) as { code?: string; error?: string }
      if (data.code) code = data.code
      if (data.error) message = data.error
    } catch {
      // nginx 原生错误页（HTML），忽略解析失败
    }
    throw new ApiError(res.status, code, message, Number(res.headers.get('Retry-After') ?? undefined) || undefined)
  }
  if (res.status === 204) return undefined as T
  try {
    return (await res.json()) as T
  } catch {
    return undefined as T
  }
}

export const get = <T = unknown>(path: string) => api<T>(path)
export const post = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body ?? {} })
