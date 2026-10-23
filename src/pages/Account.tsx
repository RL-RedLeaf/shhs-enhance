import { App as AntApp, Button, Descriptions, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { get, post } from '../lib/api'
import type { Account, MeResp } from '../lib/types'

export function AccountPage() {
  const { message } = AntApp.useApp()
  const [acc, setAcc] = useState<Account | null | undefined>(undefined)

  useEffect(() => {
    get<MeResp>('auth/me').then((r) => {
      if (!r.account) { location.replace('/login'); return }
      if (r.account.must_change_password) { location.replace('/change-password'); return }
      setAcc(r.account)
    }).catch(() => location.replace('/login'))
  }, [])

  if (acc == null) {
    return <div className="auth-shell"><Spin /></div>
  }

  const roleText = acc.role === 'organizer_admin' ? '管理员' : '学校账号'

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <h1>SHHS Post · 账号</h1>
        <p className="sub">{acc.username}</p>
        <Descriptions column={1} size="small" style={{ marginBottom: 22 }}
          items={[
            { key: 'role', label: '角色', children: roleText },
            ...(acc.school_id ? [{ key: 'school', label: '所属学校', children: acc.school_id }] : []),
          ]} />
        <Button block onClick={() => {
          post('auth/logout').finally(() => {
            message.success('已退出')
            location.replace('/login')
          })
        }}>退出登录</Button>
      </div>
    </div>
  )
}
