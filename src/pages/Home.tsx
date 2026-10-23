import { App as AntApp, Button, Form, Input, Select, Spin, Empty } from 'antd'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { get, post, ApiError } from '../lib/api'
import { useMeta } from '../lib/meta'
import type { Announcement, RouteDetail, RouteInfo, Projection, RouteStep } from '../lib/types'
import { Shell } from '../components/Shell'

function normalize(code: string): string {
  const q = code.trim()
  if (/^\d+$/.test(q)) return 'R' + q
  const m = /^SH\d{2}-(\d+)$/i.exec(q)
  if (m) return 'R' + m[1]
  if (/^r[a-z0-9]+$/i.test(q)) return q.toUpperCase()
  return q
}

function fmtFull(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleString('zh-CN') : '暂无记录'
}

function statusOf(projections?: Projection[]): string | null {
  const done = (projections ?? []).flatMap((p) => p.steps ?? []).filter((s) => s.done)
  return done.length > 0 ? done[done.length - 1]?.label ?? null : null
}

// 原站同款时间线：dot 内已完成「✓」、未完成序号；li:before 连线随完成填充
function Timeline({ rows, subtitle }: { rows?: RouteStep[]; subtitle: (id: string) => string }) {
  return (
    <ol className="timeline">
      {(rows ?? []).map((s, i) => (
        <li key={i} className={s.done ? 'done' : ''}>
          <span className="dot">{i + 1}</span>
          <div className="timeline-body">
            <strong>{s.label}</strong>
            <small>
              {subtitle(s.school)}
              {s.date ? ` · ${s.date}` : s.done ? ' · 日期未知' : ' · 等待记录'}
            </small>
            {s.source === '系统推断' && (
              <small>{s.inferenceReason || '根据后续节点状态推定，仅供参考'}</small>
            )}
          </div>
          {s.source && s.source !== '暂无记录' && <span className="tag">{s.source}</span>}
        </li>
      ))}
    </ol>
  )
}

function ResultBox({ detail, active, nameOf, loading, notFound, idle, virtual }: {
  detail: RouteDetail | null
  active: string | null
  nameOf: (id: string) => string
  loading: boolean
  notFound: boolean
  idle: boolean
  virtual?: boolean
}) {
  const [qr, setQr] = useState<string | null>(null)

  const ri = detail?.routes?.find((r) => r.id === active) ?? detail?.routes?.[0]
  const rid = ri?.id ?? null

  useEffect(() => {
    if (!rid) {
      setQr(null)
      return
    }
    let alive = true
    // 内容恒为 {origin}/?route={id}，约 31~33 字符 → 字节模式、纠错 M、版本 3、29×29 模块。
    // margin:4 = ISO/IEC 18004 要求的最小静区（4 模块）；width:185 = (29+4×2)×5，
    // 保证缩放比为整数 5，模块宽度不再 5/6px 交替。img 仍按 160 显示（高分辨率下采样更清晰）。
    import('qrcode')
      .then((m) => m.toDataURL(`${location.origin}/?route=${rid}`, { margin: 4, width: 185 }))
      .then((d) => { if (alive) setQr(d) })
      .catch(() => { if (alive) setQr(null) })
    return () => { alive = false }
  }, [rid])

  if (loading) return <div style={{ padding: '32px 8px', textAlign: 'center' }}><Spin /></div>
  if (idle) {
    return (
      <div className="panel idle-panel" style={{ gridColumn: '1 / -1' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          styles={{ image: { height: 44 } }}
          description={<span style={{ color: 'var(--muted)' }}>选择寄件与收件学校后查询邮路</span>}
        />
      </div>
    )
  }
  if (notFound) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        styles={{ image: { height: 44 } }}
        description={<span style={{ color: 'var(--muted)' }}>未找到该邮路</span>}
      />
    )
  }
  if (!detail) return null
  if (!active && !virtual) return null

  const projections = active ? detail.projections?.[active] : detail.virtualProjection
  const status = statusOf(projections) ?? '暂无已确认进度'
  const firstBatch = (projections ?? [])[0]?.batch

  return (
    <>
      <div className="panel summary-card">
        <h2>邮路详情</h2>
        <p className="summary-pair">{nameOf(ri?.from ?? '')} → {nameOf(ri?.to ?? '')}</p>
        <p className="summary-cycle">{firstBatch ? `${detail.cycle} · ${firstBatch}` : detail.cycle}</p>
        <p className="muted-label">当前状态</p>
        <h1 className="summary-status">{status}</h1>
        <p className="summary-sub">最后更新时间：{fmtFull(ri?.updatedAt)}</p>
        {rid && (
          <details className="qr-details">
            <summary>分装袋二维码 / 短编号</summary>
            {qr && <img src={qr} width={160} height={160} alt="本邮路二维码" />}
            <p className="qr-code">{ri?.code ?? '—'} · {rid}</p>
          </details>
        )}
      </div>
      <div className="panel">
        {(projections ?? []).length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} styles={{ image: { height: 44 } }}
            description={<span style={{ color: 'var(--muted)' }}>暂无投递记录</span>} />
        ) : (
          <>
            <h2>投递进度</h2>
            {(projections ?? []).map((p, i) => (
              <Fragment key={i}>
                {(projections ?? []).length > 1 && (
                  <span className="batch-chip">{p.batch === '首批' ? '首批' : `逻辑批次 ${p.batch}`}</span>
                )}
                <Timeline rows={p.steps} subtitle={nameOf} />
              </Fragment>
            ))}
          </>
        )}
      </div>
    </>
  )
}

export function HomePage() {
  const { meta, loading: metaLoading, nameOf } = useMeta()
  const { message } = AntApp.useApp()
  const [fromDistrict, setFromDistrict] = useState<string>()
  const [from, setFrom] = useState<string>()
  const [toDistrict, setToDistrict] = useState<string>()
  const [to, setTo] = useState<string>()
  const [detail, setDetail] = useState<RouteDetail | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [pairResults, setPairResults] = useState<RouteInfo[] | null>(null)
  const [pairVirtual, setPairVirtual] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null)
  const [annShowAll, setAnnShowAll] = useState(false)

  const loadRoute = (raw: string) => {
    const id = normalize(raw)
    if (!id) return
    setLoadingRoute(true)
    setNotFound(false)
    setPairVirtual(false)
    setPairResults(null)
    get<RouteDetail>(`public/routes/${encodeURIComponent(id)}`)
      .then((d) => {
        setDetail(d)
        const rid = d.routes?.[0]?.id ?? id
        setActive(rid)
      })
      .catch((e: ApiError) => {
        setDetail(null)
        setActive(null)
        if (e.status === 404) setNotFound(true)
        else message.error(e.message)
      })
      .finally(() => setLoadingRoute(false))
  }

  useEffect(() => {
    // 仅深链 `?route=` 直达；初始不自动载默认邮路（未查询 = 空态页）
    const initial = new URLSearchParams(location.search).get('route')
    if (initial) loadRoute(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    get<{ items?: Announcement[] }>('public/announcements?limit=50&offset=0')
      .then((r) => setAnnouncements(r.items ?? []))
      .catch(() => setAnnouncements([]))
  }, [])

  const searchPair = () => {
    if (!meta || !from || !to) return
    setLoadingRoute(true)
    setNotFound(false)
    setPairVirtual(false)
    setPairResults(null)
    setActive(null)
    get<RouteDetail>(`public/routes?cycle=${encodeURIComponent(meta.cycle)}&from_school=${encodeURIComponent(from)}&to_school=${encodeURIComponent(to)}`)
      .then((d) => {
        const list = d.routes ?? []
        setPairResults(list)
        if (list.length === 0) {
          setDetail(null)
          setActive(null)
          setNotFound(true)
          return
        }
        setDetail(d)
        const materialized = list.filter(
          (r): r is RouteInfo & { id: string } => typeof r.id === 'string' && r.id !== '',
        )
        setPairVirtual(materialized.length === 0)
        if (materialized.length === 1) {
          setActive(materialized[0].id)
        } else {
          setActive(null)
        }
      })
      .catch((e: ApiError) => {
        setDetail(null)
        setPairResults([])
        message.error(e.message)
      })
      .finally(() => setLoadingRoute(false))
  }

  const districtOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const s of meta?.schools ?? []) seen.add(s.district)
    return [...seen].map((d) => ({ value: d, label: d }))
  }, [meta])

  const schoolsIn = useCallback(
    (d?: string) => (meta?.schools ?? []).filter((s) => s.district === d).map((s) => ({ value: s.id, label: s.name })),
    [meta],
  )

  // 选区后自动预置该区第一所学校（沿用原站行为）
  const onFromDistrict = (d?: string) => {
    setFromDistrict(d)
    setFrom((meta?.schools ?? []).find((s) => s.district === d)?.id)
  }
  const onToDistrict = (d?: string) => {
    setToDistrict(d)
    setTo((meta?.schools ?? []).find((s) => s.district === d)?.id)
  }

  // 置顶优先的展示顺序（字段级规范：pinned 靠前）
  const annList = useMemo(
    () => (announcements ?? []).slice().sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true)),
    [announcements],
  )

  return (
    <Shell headerNote={meta ? `SHHS Post · ${meta.cycle} 届` : 'SHHS Post'} progressNote loginLink>
      {annList.length > 0 && (
        <div className="panel announce-panel">
          <h2>系统公告</h2>
          {(annShowAll ? annList : annList.slice(0, 3)).map((a, i) => (
            <details key={a.id ?? i} className="ann-item">
              <summary>{a.pinned ? '置顶 · ' : ''}{a.title}</summary>
              {a.body && <div className="ann-body">{a.body}</div>}
              {typeof a.published_at === 'number' && (
                <small className="ann-date">{new Date(a.published_at).toLocaleString('zh-CN')}</small>
              )}
            </details>
          ))}
          {annList.length > 3 && (
            <Button style={{ marginTop: 12 }} onClick={() => setAnnShowAll((v) => !v)}>
              {annShowAll ? '收起公告' : '查看全部公告'}
            </Button>
          )}
        </div>
      )}
      <div className="query">
        <Form.Item label="寄件区" className="query-field" colon={false}>
          <Select showSearch optionFilterProp="label" options={districtOptions} value={fromDistrict}
            onChange={onFromDistrict} notFoundContent={metaLoading ? <Spin size="small" /> : '无匹配'} />
        </Form.Item>
        <Form.Item label="寄件学校" className="query-field query-field-school" colon={false}>
          <Select showSearch optionFilterProp="label" options={schoolsIn(fromDistrict)} value={from}
            onChange={setFrom} notFoundContent={metaLoading ? <Spin size="small" /> : '无匹配'} />
        </Form.Item>
        <Form.Item label="收件区" className="query-field" colon={false}>
          <Select showSearch optionFilterProp="label" options={districtOptions} value={toDistrict}
            onChange={onToDistrict} notFoundContent={metaLoading ? <Spin size="small" /> : '无匹配'} />
        </Form.Item>
        <Form.Item label="收件学校" className="query-field query-field-school" colon={false}>
          <Select showSearch optionFilterProp="label" options={schoolsIn(toDistrict)} value={to}
            onChange={setTo} notFoundContent={metaLoading ? <Spin size="small" /> : '无匹配'} />
        </Form.Item>
        <Button type="primary" className="query-tail"
          disabled={loadingRoute || !from || !to || from === to} onClick={searchPair}>查询邮路</Button>
      </div>

      {metaLoading && <div style={{ padding: '48px 0', textAlign: 'center' }}><Spin /></div>}
      {!metaLoading && !meta && <p style={{ color: 'var(--muted)' }}>数据加载失败，请刷新重试</p>}
      {meta && (
        <div className="result">
          <ResultBox detail={detail} active={active} nameOf={nameOf} loading={loadingRoute}
            notFound={notFound} idle={!loadingRoute && !notFound && detail === null} virtual={pairVirtual} />
          {pairResults !== null && pairResults.length > 1 && (
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h2>匹配的邮路（{pairResults.length}）</h2>
              {pairResults.map((r, i) => (
                <button key={r.id ?? r.code ?? String(i)} className="pair-chip" style={{ marginRight: 10, marginBottom: 10 }}
                  onClick={() => { if (r.id) setActive(r.id) }}>
                  <span className="pair-code">{r.code}</span>
                  <span>{nameOf(r.from)} → {nameOf(r.to)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <Feedback />
          </div>
        </div>
      )}
    </Shell>
  )
}

function Feedback() {
  const { message } = AntApp.useApp()
  const [form] = Form.useForm()
  const [sending, setSending] = useState(false)

  const finish = (v: { category: string; body: string; contact?: string }) => {
    setSending(true)
    post('public/feedback', { category: v.category, body: v.body.trim(), contact: v.contact?.trim() || undefined })
      .then(() => { message.success('已提交'); form.resetFields() })
      .catch((e: ApiError) => message.error(e.message))
      .finally(() => setSending(false))
  }

  return (
    <Form form={form} layout="vertical" onFinish={finish} requiredMark={false} style={{ maxWidth: 620 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--green)', margin: '0 0 16px' }}>问题反馈</h2>
      <Form.Item name="category" label="类别" rules={[{ required: true }]} initialValue="bug">
        <Select options={[
          { value: 'bug', label: 'Bug反馈' },
          { value: 'suggestion', label: '功能建议' },
          { value: 'question', label: '使用疑问' },
          { value: 'other', label: '其他' },
        ]} />
      </Form.Item>
      <Form.Item name="body" label="内容" rules={[{ required: true }]}>
        <Input.TextArea rows={4} maxLength={10000} showCount />
      </Form.Item>
      <Form.Item name="contact" label="联系方式（选填）">
        <Input maxLength={200} showCount={false} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={sending}>提交</Button>
    </Form>
  )
}
