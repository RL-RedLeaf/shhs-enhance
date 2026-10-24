import { useEffect, useState } from 'react'
import { get, type ApiError } from './lib/api'
import type { Account, MeResp } from './lib/types'
import { HomePage } from './pages/Home'
import { Shell } from './components/Shell'

/** 服务器页面路由表：/ 与 /workbench 出本入口；其余路径不会到达这里 */
function AppPublic() {
  const [path, setPath] = useState(normalize(location.pathname))
  useEffect(() => {
    const onPop = () => setPath(normalize(location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (path !== '/' && path !== '/workbench') {
    return (
      <Shell>
        <main className="wrap" style={{ padding: '64px 0', flex: 1 }}>
          <p style={{ color: 'var(--muted)' }}>页面不存在</p>
        </main>
      </Shell>
    )
  }
  if (path === '/') return <HomePage />
  return <WorkbenchGate />
}

function WorkbenchGate() {
  const [acc, setAcc] = useState<Account | null | undefined>(undefined)
  const [err, setErr] = useState<ApiError | null>(null)

  useEffect(() => {
    get<MeResp>('auth/me')
      .then((r) => {
        if (!r.account) { location.replace('/login'); return }
        if (r.account.must_change_password) { location.replace('/change-password'); return }
        setAcc(r.account)
      })
      .catch((e: ApiError) => setErr(e))
  }, [])

  if (err) {
    return (
      <Shell headerNote="SHHS Post">
        <main className="wrap" style={{ padding: '48px 0', flex: 1 }}>
          <p style={{ color: 'var(--muted)' }}>登录状态获取失败（{err.code}）</p>
        </main>
      </Shell>
    )
  }
  if (acc === undefined) {
    return (
      <Shell headerNote="SHHS Post">
        <main className="wrap" style={{ padding: '48px 0', flex: 1, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)' }}>…</p>
        </main>
      </Shell>
    )
  }
  return (
    <Shell headerNote="SHHS Post">
      <main className="wrap" style={{ padding: '32px 0', flex: 1 }}>
        <div className="panel" style={{ maxWidth: 560 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--green)', margin: '0 0 12px' }}>学校工作台</h2>
          <p style={{ color: 'var(--muted)' }}>
            工作台界面随下一批次迁移；当前阶段请继续使用原入口。
          </p>
        </div>
      </main>
    </Shell>
  )
}

const BASE = ((import.meta as unknown as { env?: Record<string, string> }).env?.BASE_URL || '/').replace(/\/$/, '')

/** 去掉部署子路径（如 GitHub Pages 的 /shhs-enhance）与 index.html 后缀 */
function normalize(path: string): string {
  let p = path
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length)
  if (p.endsWith('/index.html')) p = p.slice(0, p.length - '/index.html'.length)
  return p || '/'
}

export { AppPublic }
