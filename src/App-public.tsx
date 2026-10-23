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
    return <Shell><p style={{ color: 'var(--muted)' }}>404</p></Shell>
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
    return <Shell headerNote="SHHS Post">
      <p style={{ color: 'var(--muted)' }}>登录状态获取失败（{err.code}）</p>
    </Shell>
  }
  if (acc === undefined) {
    return <Shell headerNote="SHHS Post"><p style={{ color: 'var(--muted)', padding: '48px 0', textAlign: 'center' }}>…</p></Shell>
  }
  return (
    <Shell headerNote="SHHS Post">
      <div className="panel" style={{ maxWidth: 560 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--green)', margin: '0 0 12px' }}>学校工作台</h2>
        <p style={{ color: 'var(--muted)' }}>
          工作台界面随下一批次迁移；当前阶段请继续使用原入口。
        </p>
      </div>
    </Shell>
  )
}

function normalize(path: string): string {
  if (path.endsWith('/index.html')) return path.slice(0, path.length - '/index.html'.length) || '/'
  return path
}

export { AppPublic }
