export function normalizePath(path: string): string {
  if (path.endsWith('/login.html')) {
    return path.slice(0, path.length - '/login.html'.length) + '/login' || '/login'
  }
  return path
}
