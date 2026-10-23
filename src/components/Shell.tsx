import type { ReactNode } from 'react'

export function SiteFooter({ progressNote = false }: { progressNote?: boolean }) {
  return (
    <footer className="site-footer">
      {progressNote && <span>邮路进度仅供参考</span>}
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">沪ICP备2026049485号</a>
      <span>Designed &amp; Developed by linle_1222</span>
    </footer>
  )
}

export function SiteHeader({ note, loginLink }: { note?: string; loginLink?: boolean }) {
  return (
    <header className="site-header">
      <strong className="brand">上海高中明信片邮路追踪</strong>
      <div className="header-right">
        {note && <span className="brand-note">{note}</span>}
        {loginLink && <a className="login-link" href="/login">管理员登录</a>}
      </div>
    </header>
  )
}

export function Shell({ headerNote, progressNote, loginLink, children }: {
  headerNote?: string
  progressNote?: boolean
  loginLink?: boolean
  children: ReactNode
}) {
  return (
    <>
      <SiteHeader note={headerNote} loginLink={loginLink} />
      <main className="site-main">{children}</main>
      <SiteFooter progressNote={progressNote} />
    </>
  )
}
