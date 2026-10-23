import { useEffect, useState } from 'react'
import { normalizePath } from './lib/common'
import { LoginPage, ChangePasswordPage } from './pages/Login'
import { AccountPage } from './pages/Account'
import { AdminAccountsPage } from './pages/AdminAccounts'

/** 服务器页面路由表：{/login,/account,/change-password,/admin/accounts} 出本入口 */
function AppAuth() {
  const [path, setPath] = useState(normalizePath(location.pathname))
  useEffect(() => {
    const onPop = () => setPath(normalizePath(location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  switch (path) {
    case '/login': return <LoginPage />
    case '/change-password': return <ChangePasswordPage />
    case '/account': return <AccountPage />
    case '/admin/accounts': return <AdminAccountsPage />
    default: return <LoginPage />
  }
}

export { AppAuth }
