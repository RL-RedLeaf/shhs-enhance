import { App as AntApp, Button, Form, Input, Modal, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { get, post, ApiError } from '../lib/api'
import type { Account, MeResp, School } from '../lib/types'

interface AdminRow {
  id?: string
  username?: string
  school_id?: string
  role?: string
  enabled?: boolean
  [k: string]: unknown
}

function rowsOf(res: unknown): AdminRow[] {
  if (Array.isArray(res)) return res as AdminRow[]
  const o = res as { items?: AdminRow[]; accounts?: AdminRow[]; rows?: AdminRow[] }
  return o.items ?? o.accounts ?? o.rows ?? []
}

function tempPasswordOf(res: unknown): string | null {
  const o = res as Record<string, unknown>
  for (const k of ['temporary_password', 'temp_password', 'one_time_password', 'password']) {
    if (typeof o?.[k] === 'string') return o[k] as string
  }
  return null
}

export function AdminAccountsPage() {
  const { message } = AntApp.useApp()
  const [state, setState] = useState<'loading' | 'ready'>('loading')
  const [schools, setSchools] = useState<School[]>([])
  const [schoolMap, setSchoolMap] = useState<Map<string, string>>(new Map())
  const [filter, setFilter] = useState<string | undefined>()
  const [rows, setRows] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(false)
  const [tempPwd, setTempPwd] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    get<MeResp>('auth/me')
      .then((r) => {
        if (!r.account || r.account.role !== 'organizer_admin') { location.replace('/login'); return }
        return get<unknown>('auth/admin/schools')
          .then((s) => {
            const list = Array.isArray(s) ? (s as School[]) : ((s as { items?: School[]; schools?: School[] }).items ?? (s as { schools?: School[] }).schools ?? [])
            setSchools(list)
            setSchoolMap(new Map(list.map((x) => [x.id, x.name])))
          })
          .catch(() => { /* 学校目录缺失时不阻塞列表 */ })
          .then(() => setState('ready'))
      })
      .catch(() => location.replace('/login'))
  }, [])

  const load = useCallback((schoolId?: string) => {
    setLoading(true)
    const q = schoolId ? `?school_id=${encodeURIComponent(schoolId)}&offset=0&limit=50` : '?offset=0&limit=50'
    get<unknown>('auth/admin/accounts' + q)
      .then((r) => setRows(rowsOf(r)))
      .catch((e: ApiError) => message.error(e.message))
      .finally(() => setLoading(false))
  }, [message])

  useEffect(() => { if (state === 'ready') load(filter) }, [state, filter, load])

  if (state === 'loading') {
    return <div className="auth-shell"><Spin /></div>
  }

  const rowsList = rows
  const roleText = (r?: string) => (r === 'organizer_admin' ? '管理员' : '学校账号')

  const doReset = (row: AdminRow) => {
    if (!row.id) return
    post('auth/admin/accounts/' + encodeURIComponent(row.id) + '/reset-password', {})
      .then((res) => {
        const tp = tempPasswordOf(res)
        if (tp) setTempPwd(tp)
        else message.success('已重置')
        load(filter)
      })
      .catch((e: ApiError) => message.error(e.message))
  }

  const doToggle = (row: AdminRow) => {
    if (!row.id) return
    post('auth/admin/accounts/' + encodeURIComponent(row.id) + '/enabled', { enabled: !row.enabled })
      .then(() => load(filter))
      .catch((e: ApiError) => message.error(e.message))
  }

  return (
    <div className="auth-shell" style={{ display: 'block', padding: '24px 3.3%' }}>
      <header className="site-header" style={{ borderTop: 0, padding: '0 0 16px' }}>
        <strong className="brand">账号管理</strong>
        <Space>
          <Button onClick={() => { setCreating(true) }}>新建账号</Button>
        </Space>
      </header>
      <Table<AdminRow>
        rowKey={(r) => String(r.id ?? r.username ?? Math.random())}
        size="middle"
        loading={loading}
        dataSource={rowsList}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: true }}
        columns={[
          { title: '账号', dataIndex: 'username', key: 'username',
            render: (v: unknown) => <Typography.Text code>{String(v ?? '—')}</Typography.Text> },
          { title: '学校', key: 'school', render: (_, r) => schoolMap.get(r.school_id ?? '') ?? r.school_id ?? '—' },
          { title: '角色', key: 'role', render: (_, r) => roleText(r.role) },
          { title: '状态', key: 'enabled', render: (_, r) =>
            r.enabled === false ? <Tag color="error">已停用</Tag> : <Tag color="green">启用中</Tag> },
          { title: '操作', key: 'actions', width: 240, render: (_, r) => (
            <Space>
              <Button size="small" onClick={() => doReset(r)}>重置密码</Button>
              <Button size="small" onClick={() => doToggle(r)}>{r.enabled === false ? '启用' : '停用'}</Button>
            </Space>
          ) },
        ]}
      />
      <TempPwdModal value={tempPwd} onClose={() => setTempPwd(null)} />
      <CreateAccountModal open={creating} schools={schools} onClose={() => setCreating(false)}
        onCreated={(tp) => { setCreating(false); if (tp) setTempPwd(tp); load(filter) }} />
      <div style={{ marginTop: 18 }}>
        <a href="/" style={{ color: 'var(--muted)', fontSize: 13 }}>← 返回查询页</a>
      </div>
    </div>
  )
}

function TempPwdModal({ value, onClose }: { value: string | null; onClose: () => void }) {
  return (
    <Modal open={!!value} onCancel={onClose} footer={null} title="一次性临时密码" width={480}>
      <Typography.Paragraph copyable={value ? { text: value } : undefined}
        style={{ fontSize: 20, fontFamily: 'ui-monospace, monospace', marginBottom: 8 }}>
        {value}
      </Typography.Paragraph>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        仅显示一次，5 分钟内有效；首次登录时必须修改密码。
      </Typography.Text>
    </Modal>
  )
}

function CreateAccountModal({ open, schools, onClose, onCreated }: {
  open: boolean
  schools: School[]
  onClose: () => void
  onCreated: (temp?: string) => void
}) {
  const { message } = AntApp.useApp()
  const [form] = Form.useForm()
  const [sending, setSubmitting] = useState(false)
  const role = Form.useWatch('role', form) ?? 'school'

  const finish = (v: { username: string; school_id?: string; role: string }) => {
    setSubmitting(true)
    post<unknown>('auth/admin/accounts', { username: v.username, school_id: v.school_id, role: v.role })
      .then((res) => { form.resetFields(); message.success('已创建'); onCreated(tempPasswordOf(res) ?? undefined) })
      .catch((e: ApiError) => message.error(e.message))
      .finally(() => setSubmitting(false))
  }

  return (
    <Modal open={open} onCancel={onClose} title="新建账号" footer={null} width={460}>
      <Form form={form} layout="vertical" onFinish={finish} initialValues={{ role: 'school' }}>
        <Form.Item name="username" label="账号" rules={[
          { required: true },
          { pattern: /^[a-zA-Z0-9._-]{3,64}$/, message: '3–64 位字母、数字、点、下划线或短横线' },
        ]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="role" label="角色">
          <Select options={[{ value: 'school', label: '学校账号' }, { value: 'organizer_admin', label: '管理员' }]} />
        </Form.Item>
        {role === 'school' && (
          <Form.Item name="school_id" label="学校" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={schools.map((s) => ({ value: s.id, label: `${s.name}（${s.district}）` }))} />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" block loading={sending}>创建</Button>
      </Form>
    </Modal>
  )
}
