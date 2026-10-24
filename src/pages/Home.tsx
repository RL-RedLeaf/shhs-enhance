import { App as AntApp, Button, Collapse, Drawer, Empty, Form, Input, Select, Spin } from 'antd'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { get, post, ApiError } from '../lib/api'
import { useMeta } from '../lib/meta'
import type { Announcement, RouteDetail, RouteInfo, Projection, RouteStep } from '../lib/types'
import { NoticeBar, Shell } from '../components/Shell'

const DEMO = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_DEMO === '1'

/* ────────────────────────── 响应式 ────────────────────────── */

/** 与 CSS 的 719px 断点保持一致，用于切换组件行为（不是样式） */
function useIsMobile(): boolean {
  const query = '(max-width: 719px)'
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

/**
 * 软键盘弹起高度（px）。iOS / Android 通用做法：
 * 布局视口高 - 可视视口高 - 可视视口偏移 = 键盘遮挡的高度
 * 结果写入 :root 的 --kb / --vvh，供 CSS 抬高底部弹层并限制最大高度
 */
function useKeyboardInset(enabled: boolean): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const update = () => {
      const h = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      setInset(h)
      root.style.setProperty('--kb', `${h}px`)
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      root.style.removeProperty('--kb')
      root.style.removeProperty('--vvh')
    }
  }, [enabled])
  return inset
}

/** 下拉展开时锁住页面滚动，避免手指在列表上滑动时把整页带走 */
function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const html = document.documentElement
    const prevHtml = html.style.overflow
    const prevBody = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [locked])
}

/* ────────────────────────── 工具函数 ────────────────────────── */

function normalize(code: string): string {
  const q = code.trim()
  if (/^\d+$/.test(q)) return 'R' + q
  const m = /^SH\d{2}-(\d+)$/i.exec(q)
  if (m) return 'R' + m[1]
  if (/^r[a-z0-9]+$/i.test(q)) return q.toUpperCase()
  return q
}

function fmtFull(iso?: string | null): string {
  if (!iso) return '暂无记录'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 「首批」/「2」→ 展示用批次名 */
function batchLabel(b?: string): string {
  if (!b) return ''
  return /^\d+$/.test(b) ? `第 ${b} 批` : b
}

/** 取「当前批次」：最后一个有已完成步骤的批次；都没有则取第一个 */
function pickProjection(ps?: Projection[]): Projection | null {
  const list = ps ?? []
  if (list.length === 0) return null
  for (let i = list.length - 1; i >= 0; i--) {
    if ((list[i].steps ?? []).some((s) => s.done)) return list[i]
  }
  return list[0]
}

/* ────────────────────────── 时间线 ────────────────────────── */

const CheckMark = () => (
  <svg width="10" height="8" viewBox="0 0 11 9" fill="none" aria-hidden="true">
    <path d="M1 4.4L4 7.4 10 1.4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function Timeline({ steps, nameOf }: { steps: RouteStep[]; nameOf: (id: string) => string }) {
  const lastDone = steps.reduce((acc, s, i) => (s.done ? i : acc), -1)
  return (
    <ol className="tl">
      {steps.map((s, i) => (
        <li key={i} className={s.done ? (i === lastDone ? 'done now' : 'done') : undefined}>
          <span className="dot">{s.done ? <CheckMark /> : i + 1}</span>
          <span className="nm">
            {s.label}
            {i === lastDone && <span className="cur">当前</span>}
          </span>
          <span className={s.done ? 'tm' : 'tm wait'}>{s.done ? (s.date || '日期未知') : '等待记录'}</span>
          <span className="sc">
            {nameOf(s.school)}
            {s.source === '系统推断' && (
              <em className="tag-push" title={s.inferenceReason || '根据后续节点状态推定，仅供参考'}>系统推定</em>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

/* ────────────────────────── 反馈抽屉 ────────────────────────── */

function FeedbackDrawer({ open, onClose }: {
  open: boolean
  onClose: () => void
}) {
  const { message } = AntApp.useApp()
  const isMobile = useIsMobile()
  // 键盘弹起时把弹层整体抬高（写入 --kb / --vvh），避免输入框被输入法遮住
  useKeyboardInset(isMobile && open)

  const [form] = Form.useForm()
  const [sending, setSending] = useState(false)

  useEffect(() => { if (open) form.resetFields() }, [open, form])

  const finish = (v: { category: string; body: string; contact?: string }) => {
    setSending(true)
    post('public/feedback', {
      category: v.category,
      body: v.body.trim(),
      contact: v.contact?.trim() || undefined,
    })
      .then(() => { message.success('已提交'); onClose() })
      .catch((e: ApiError) => message.error(e.message))
      .finally(() => setSending(false))
  }

  return (
    <Drawer
      title="留言/反馈"
      open={open}
      onClose={onClose}
      className="fb-drawer"
      placement={isMobile ? 'bottom' : 'right'}
      width={isMobile ? undefined : 420}
      height={isMobile ? 'auto' : undefined}
      rootClassName={isMobile ? 'fb-drawer-bottom' : undefined}
    >
      <Form form={form} layout="vertical" onFinish={finish} requiredMark={false} initialValues={{ category: 'bug' }}>
        <Form.Item name="category" label="类别">
          <Select
            options={[
              { value: 'bug', label: 'Bug 反馈' },
              { value: 'suggestion', label: '功能建议' },
              { value: 'question', label: '使用疑问' },
              { value: 'other', label: '其他' },
            ]}
          />
        </Form.Item>

        <Form.Item name="body" label="内容" rules={[{ required: true, message: '请填写内容' }]}>
          <Input.TextArea rows={5} maxLength={10000} />
        </Form.Item>

        <Collapse
          ghost
          size="small"
          className="fb-more"
          items={[{
            key: 'contact',
            label: '留个联系方式（选填）',
            children: (
              <Form.Item name="contact" style={{ marginBottom: 0 }}>
                <Input maxLength={200} placeholder="微信 / 邮箱，方便我们回访" />
              </Form.Item>
            ),
          }]}
        />

        <Button type="primary" htmlType="submit" block loading={sending} className="fb-submit">提交反馈</Button>
      </Form>
    </Drawer>
  )
}

/* ────────────────────────── 结果卡 ────────────────────────── */

function ResultCard({ detail, active, nameOf, virtual, onFeedback }: {
  detail: RouteDetail
  active: string | null
  nameOf: (id: string) => string
  virtual: boolean
  onFeedback: () => void
}) {
  const [qr, setQr] = useState<string | null>(null)
  const ri: RouteInfo | undefined = detail.routes?.find((r) => r.id === active) ?? detail.routes?.[0]
  const rid = ri?.id ?? null

  useEffect(() => {
    if (!rid) { setQr(null); return }
    let alive = true
    // 内容恒为 {origin}/?route={id}，约 31~33 字符 → 字节模式、纠错 M、版本 3、29×29 模块。
    // margin:4 = ISO/IEC 18004 要求的最小静区；width:185 = 37×5，保证缩放比为整数 5。
    import('qrcode')
      .then((m) => m.toDataURL(`${location.origin}/?route=${rid}`, { margin: 4, width: 185 }))
      .then((d) => { if (alive) setQr(d) })
      .catch(() => { if (alive) setQr(null) })
    return () => { alive = false }
  }, [rid])

  const projections = (active ? detail.projections?.[active] : detail.virtualProjection) ?? []
  const proj = pickProjection(projections)
  const steps = proj?.steps ?? []
  const doneCount = steps.filter((s) => s.done).length
  const total = steps.length
  const current = [...steps].reverse().find((s) => s.done) ?? null
  const status = current?.label ?? '还没开始投递'
  const code = ri?.code || rid || '—'

  // 移动端默认只显示到「下一站」，更远的站折起来（桌面端全展开）
  const isMobile = useIsMobile()
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => { setMoreOpen(false) }, [rid])
  const firstPending = steps.findIndex((s) => !s.done)
  const visibleCount = firstPending === -1 ? steps.length : firstPending + 1
  const collapsed = isMobile && !moreOpen && visibleCount < steps.length
  const shownSteps = collapsed ? steps.slice(0, visibleCount) : steps
  const hiddenCount = steps.length - visibleCount

  return (
    <div className="card">
      <div className="sum">
        <div className="sum-l">
          <div className="sum-top">
            <span className="code">{code}</span>
            {total > 0 && <span className="count"><b>{doneCount}</b>/{total}</span>}
          </div>

          <p className="pair">
            {nameOf(ri?.from ?? '')}
            <span className="to"><i>→</i>{nameOf(ri?.to ?? '')}</span>
          </p>

          <h1 className="st">{status}</h1>
          <p className="st-sub">{current ? (current.date || '日期未知') : '第一批寄出后这里会更新'}</p>

          {total > 0 && (
            <div className="prog">
              <span className="bar">
                {steps.map((s, i) => <i key={i} className={s.done ? 'on' : undefined} />)}
              </span>
            </div>
          )}
        </div>

        <div className="qrb">
          {qr && <img src={qr} width={92} height={92} alt="本邮路二维码" />}
          <div className="cd">{code}</div>
        </div>
      </div>

      {virtual && (
        <p className="virtual-note">该组合暂无实体投递记录，以下为按分拣拓扑推算的预计邮路。</p>
      )}

      <div className="divider" />

      <div className="sec">
        <h2>投递进度</h2>
        <span className="u">最后更新 {fmtFull(ri?.updatedAt)}</span>
      </div>

      {total === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} styles={{ image: { height: 40 } }}
          description={<span className="empty-tx">还没有投递记录 · 第一批预计 10 月中旬寄出</span>} />
      ) : (
        projections.map((p, i) => (
          <Fragment key={i}>
            {projections.length > 1 && <div className="batch-chip">{batchLabel(p.batch)}</div>}
            <Timeline steps={collapsed && i === projections.length - 1 ? shownSteps : p.steps} nameOf={nameOf} />
          </Fragment>
        ))
      )}

      {collapsed && (
        <button type="button" className="tl-more" onClick={() => setMoreOpen(true)}>
          还有 <b>{hiddenCount} 站</b> · 展开
        </button>
      )}

      <div className="m-qr">
        {qr && <img src={qr} width={64} height={64} alt="本邮路二维码" />}
        <div className="m-qr-tx">
          <b>{code}</b>
        </div>
      </div>

      <div className="fb-line">
        <span className="fb-ico">!</span>
        <span className="fb-tx">这条邮路的信息有误？</span>
        <Button size="small" className="fb-btn" onClick={onFeedback}>反馈</Button>
      </div>
    </div>
  )
}

/* ────────────────────────── 页面 ────────────────────────── */

export function HomePage() {
  const { meta, loading: metaLoading, nameOf } = useMeta()
  const { message } = AntApp.useApp()
  const isMobile = useIsMobile()

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

  // 移动端：出结果后把查询区收成一行，把屏幕让给结果
  const [qOpen, setQOpen] = useState(true)

  const [fbOpen, setFbOpen] = useState(false)
  const openFeedback = useCallback(() => setFbOpen(true), [])

  // 移动端下拉展开时锁住页面滚动；桌面端不锁，否则隐藏滚动条会引起横向跳动
  const [selOpen, setSelOpen] = useState(false)
  useScrollLock(isMobile && selOpen)

  /* 深链 /?route=R1 直达 */
  const loadRoute = useCallback((raw: string) => {
    const id = normalize(raw)
    if (!id) return
    setLoadingRoute(true)
    setNotFound(false)
    setPairVirtual(false)
    setPairResults(null)
    get<RouteDetail>(`public/routes/${encodeURIComponent(id)}`)
      .then((d) => {
        setDetail(d)
        setActive(d.routes?.[0]?.id ?? id)
        setQOpen(false)
      })
      .catch((e: ApiError) => {
        setDetail(null)
        setActive(null)
        if (e.status === 404) setNotFound(true)
        else message.error(e.message)
      })
      .finally(() => setLoadingRoute(false))
  }, [message])

  useEffect(() => {
    const initial = new URLSearchParams(location.search).get('route')
    if (initial) loadRoute(initial)
  }, [loadRoute])

  useEffect(() => {
    get<{ items?: Announcement[] }>('public/announcements?limit=50&offset=0')
      .then((r) => setAnnouncements(r.items ?? []))
      .catch(() => setAnnouncements([]))
  }, [])

  /* 深链进入时回填查询条件，避免「下面写着 A→B，上面四个下拉却是空的」 */
  useEffect(() => {
    if (!detail || !meta) return
    const r = detail.routes?.[0]
    if (!r) return
    const fs = meta.schools.find((s) => s.id === r.from)
    const ts = meta.schools.find((s) => s.id === r.to)
    if (fs) { setFromDistrict(fs.district); setFrom(fs.id) }
    if (ts) { setToDistrict(ts.district); setTo(ts.id) }
  }, [detail, meta])

  const searchPair = useCallback(() => {
    if (!meta || !from || !to) return
    setLoadingRoute(true)
    setNotFound(false)
    setPairVirtual(false)
    setPairResults(null)
    setActive(null)
    get<RouteDetail>(
      `public/routes?cycle=${encodeURIComponent(meta.cycle)}` +
      `&from_school=${encodeURIComponent(from)}&to_school=${encodeURIComponent(to)}`,
    )
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
        setActive(materialized.length === 1 ? materialized[0].id : null)
        setQOpen(false)
      })
      .catch((e: ApiError) => {
        setDetail(null)
        setPairResults([])
        message.error(e.message)
      })
      .finally(() => setLoadingRoute(false))
  }, [meta, from, to, message, nameOf])

  const clearAll = () => {
    setFromDistrict(undefined); setFrom(undefined)
    setToDistrict(undefined); setTo(undefined)
    setDetail(null); setActive(null)
    setNotFound(false); setPairResults(null); setPairVirtual(false)
    setQOpen(true)
    if (location.search) history.replaceState(null, '', location.pathname)
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

  const annList = useMemo(
    () => (announcements ?? []).slice().sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true)),
    [announcements],
  )

  const hasQuery = Boolean(from && to)
  const sameSchool = Boolean(from && to && from === to)
  const hintText = sameSchool ? '寄件与收件学校不能相同' : !hasQuery ? '请先选择寄件与收件学校' : null
  const idle = !loadingRoute && !notFound && detail === null
  const showResult = !loadingRoute && !notFound && detail !== null && (active !== null || pairVirtual)

  return (
    <Shell
      headerNote={meta ? `${meta.cycle} 届` : undefined}
      progressNote
      loginLink={!DEMO}
      demo={DEMO}
      onFeedback={openFeedback}
    >
      {/* 公告：桌面为通栏条，移动端同一组件加边框变成单行卡片 */}
      <NoticeBar items={annList} />

      {/* 查询带 */}
      <div className={'band' + (isMobile && !qOpen ? ' collapsed' : '')}>
        <div className="wrap band-in">
          <div className="q-full">
          <div className="qrow">
            <div className="qgrp">
              <span className="gl">寄件</span>
              <div className="qf">
                <label htmlFor="q-from-d">寄件区</label>
                <Select id="q-from-d" showSearch={!isMobile} optionFilterProp="label" placeholder="请选择"
                  options={districtOptions} value={fromDistrict} onChange={onFromDistrict}
                  onOpenChange={setSelOpen}
                  notFoundContent={metaLoading ? <Spin size="small" /> : '无匹配'} />
              </div>
              <div className="qf wide">
                <label htmlFor="q-from">寄件学校</label>
                <Select id="q-from" showSearch={!isMobile} optionFilterProp="label" placeholder="请选择"
                  options={schoolsIn(fromDistrict)} value={from} onChange={setFrom}
                  onOpenChange={setSelOpen}
                  notFoundContent={metaLoading ? <Spin size="small" /> : '无匹配'} />
              </div>
            </div>

            <span className="qar" aria-hidden="true">
              <svg width="17" height="9" viewBox="0 0 18 10" fill="none">
                <path d="M1 5h14M12 1.5L15.5 5 12 8.5" stroke="currentColor" strokeWidth="1.3"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>

            <div className="qgrp">
              <span className="gl">收件</span>
              <div className="qf">
                <label htmlFor="q-to-d">收件区</label>
                <Select id="q-to-d" showSearch={!isMobile} optionFilterProp="label" placeholder="请选择"
                  options={districtOptions} value={toDistrict} onChange={onToDistrict}
                  onOpenChange={setSelOpen}
                  notFoundContent={metaLoading ? <Spin size="small" /> : '无匹配'} />
              </div>
              <div className="qf wide">
                <label htmlFor="q-to">收件学校</label>
                <Select id="q-to" showSearch={!isMobile} optionFilterProp="label" placeholder="请选择"
                  options={schoolsIn(toDistrict)} value={to} onChange={setTo}
                  onOpenChange={setSelOpen}
                  notFoundContent={metaLoading ? <Spin size="small" /> : '无匹配'} />
              </div>
            </div>

            <div className="qacts">
              <Button type="primary" className="qbtn" loading={loadingRoute}
                disabled={!hasQuery || sameSchool} onClick={searchPair}>查询邮路</Button>
              {(hasQuery || detail) && <Button className="qbtn ghost" onClick={clearAll}>清空</Button>}
            </div>
          </div>

          {hintText && <div className="q-hint">{hintText}</div>}
          </div>

          <button type="button" className="q-mini" onClick={() => setQOpen(true)}>
            <span className="mini-t">
              {nameOf(from ?? '')}<i>→</i>{nameOf(to ?? '')}
            </span>
            <em>修改</em>
          </button>
        </div>
      </div>

      <main className="wrap main">
        {metaLoading && <div className="center-pad"><Spin /></div>}

        {!metaLoading && !meta && (
          <p className="load-fail">数据加载失败，请刷新重试</p>
        )}

        {loadingRoute && <div className="center-pad"><Spin /></div>}

        {idle && (
          <div className="empty-wrap">
            <h3>选择寄件与收件学校后查询邮路</h3>
            <p>
              每条邮路有 6 个站点：
              <span>寄件学校 →</span> <span>寄件区分拣校 →</span> <span>目标区分拣校 →</span> <span>收件学校</span>
            </p>
          </div>
        )}

        {notFound && !loadingRoute && (
          <div className="empty-wrap">
            <h3>没找到这条邮路</h3>
            <p>检查编号是否输错，或该批次还没开始。也可以直接在上方按学校查询。</p>
          </div>
        )}

        {showResult && detail && (
          <>
            {pairResults && pairResults.length > 1 && (
              <div className="pair-row">
                <span className="k">匹配到 {pairResults.length} 条邮路</span>
                {pairResults.map((r, i) => (
                  <button key={r.id ?? r.code ?? i} type="button"
                    className={'chip' + (r.id && r.id === active ? ' on' : '')}
                    disabled={!r.id}
                    onClick={() => { if (r.id) setActive(r.id) }}>
                    <b>{r.code}</b>
                  </button>
                ))}
              </div>
            )}
            <ResultCard detail={detail} active={active} nameOf={nameOf}
              virtual={pairVirtual} onFeedback={openFeedback} />
          </>
        )}
      </main>

      <FeedbackDrawer open={fbOpen} onClose={() => setFbOpen(false)} />

    </Shell>
  )
}
