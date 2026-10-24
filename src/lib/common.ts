const BASE = ((import.meta as unknown as { env?: Record<string, string> }).env?.BASE_URL || '/').replace(/\/$/, '')

export function normalizePath(path: string): string {
  let p = path
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length)
  if (p.endsWith('/login.html')) {
    return (p.slice(0, p.length - '/login.html'.length) + '/login') || '/login'
  }
  return p || '/'
}
