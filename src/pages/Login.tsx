import { App as AntApp, Button, Form, Input, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { get, post, ApiError } from '../lib/api'
import type { Account, MeResp } from '../lib/types'

export const homeOf = (a: Account): string =>
  a.role === 'organizer_admin' ? '/admin/accounts' : '/workbench'

type Pending = { username: string; password: string }

function norm(res: unknown): Account | null {
  if (res && typeof res === 'object' && 'account' in res) return (res as MeResp).account
  return (res as Account) ?? null
}

/** 登录 与（首登强制）改密同一 bundle 内切换视图；/change-password 直达时走独立改密表单 */
export function LoginPage() {
  const { message } = AntApp.useApp()
  const [form] = Form.useForm()
  const [view, setView] = useState<'loading' | 'login' | 'change'>('loading')
  const [pending, setPending] = useState<Pending | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    get<MeResp>('auth/me')
      .then((r) => {
        if (!r.account) { setView('login'); return }
        if (r.account.must_change_password) { setView('change'); return }
        location.replace(homeOf(r.account))
      })
      .catch(() => setView('login'))
  }, [])

  const submitLogin = (v: { username: string; password: string }) => {
    setSubmitting(true)
    setLoginError(null)
    post<{ account?: Account } | Account>('auth/login', { username: v.username, password: v.password })
      .then((res) => {
        const acc = norm(res)
        if (!acc) { setLoginError('用户名或密码错误'); return }
        if (acc.must_change_password) {
          setPending({ username: v.username, password: v.password })
          setView('change')
          return
        }
        location.replace(homeOf(acc))
      })
      .catch((e: ApiError) => {
        if (e.status === 401 && e.code === 'INVALID_CREDENTIALS') setLoginError('用户名或密码错误')
        else if (e.code === 'RATE_LIMITED') {
          const m = e.retryAfter != null ? `请约 ${Math.ceil(e.retryAfter / 60)} 分钟后重试` : '请稍后重试'
          setLoginError(`尝试次数较多，${m}`)
        } else setLoginError(e.message)
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        {view === 'loading' && <div style={{ padding: 40, textAlign: 'center' }}><AntSpin /></div>}
        {view === 'login' && (
          <>
            <h1>SHHS Post · 学校账号</h1>
            <p className="sub">使用组织发放的账号登录</p>
            <Form form={form} layout="vertical" onFinish={submitLogin} requiredMark={false}>
              <Form.Item name="username" label="账号" rules={[{ required: true }]}>
                <Input autoComplete="username" autoFocus />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true }]}>
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              {loginError && (
                <Typography.Text type="danger" style={{ display: 'block', marginBottom: 14 }} role="alert">
                  {loginError}
                </Typography.Text>
              )}
              <Button type="primary" htmlType="submit" block loading={submitting}>登录</Button>
            </Form>
          </>
        )}
        {view === 'change' && (
          <>
            <h1>SHHS Post · 修改密码</h1>
            <p className="sub">首次登录需修改初始密码</p>
            <ChangePasswordForm pending={pending} submitting={submitting} setSubmitting={setSubmitting} message={message} />
          </>
        )}
      </div>
    </div>
  )
}

export function ChangePasswordPage() {
  const { message } = AntApp.useApp()
  const [state, setState] = useState<'loading' | 'ready'>('loading')
  const [account, setAccount] = useState<Account | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    get<MeResp>('auth/me')
      .then((r) => {
        if (!r.account) { location.replace('/login'); return }
        setAccount(r.account)
        setState('ready')
      })
      .catch(() => location.replace('/login'))
  }, [])

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        {state === 'loading' && <div style={{ padding: 40, textAlign: 'center' }}><AntSpin /></div>}
        {state === 'ready' && (
          <>
            <h1>SHHS Post · 修改密码</h1>
            {account?.must_change_password && <p className="sub">首次登录需修改初始密码</p>}
            <ChangePasswordForm pending={null} submitting={submitting} setSubmitting={setSubmitting} message={message} />
          </>
        )}
      </div>
    </div>
  )
}

function AntSpin() {
  return <span className="ant-spin-dot ant-spin-dot-spin" aria-label="加载中" />
}

function ChangePasswordForm({ pending, submitting, setSubmitting, message }: {
  pending: Pending | null
  submitting: boolean
  setSubmitting: (v: boolean) => void
  message: { error: (t: string) => void; success: (t: string) => void }
}) {
  const [form] = Form.useForm()

  const finish = (v: { current_password?: string; new_password: string }) => {
    setSubmitting(true)
    const req = pending
      ? post('auth/change-password', { username: pending.username, password: pending.password, new_password: v.new_password })
      : post('auth/change-password', { current_password: v.current_password ?? '', new_password: v.new_password })
    req.then(() => get<MeResp>('auth/me'))
      .then((r) => {
        message.success('密码已修改')
        location.replace(r.account ? homeOf(r.account) : '/login')
      })
      .catch((e: ApiError) => message.error(e.message))
      .finally(() => setSubmitting(false))
  }

  return (
    <Form form={form} layout="vertical" onFinish={finish} requiredMark={false}>
      {!pending && (
        <Form.Item name="current_password" label="当前密码" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
      )}
      <Form.Item name="new_password" label="新密码" extra="12–128 个字符" dependencies={['new_password']}
        rules={[{ required: true }, { min: 12, message: '至少 12 个字符' }, { max: 128 }]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item name="confirm" label="确认新密码" dependencies={['new_password']}
        rules={[{ required: true }, ({ getFieldValue }) => ({
          validator: (_, value: string) =>
            !value || value === getFieldValue('new_password')
              ? Promise.resolve()
              : Promise.reject(new Error('两次输入不一致')),
        })]}>
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={submitting}>确认修改</Button>
    </Form>
  )
}
