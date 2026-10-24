import { useState, type ReactNode } from 'react'
import { Button, Collapse } from 'antd'
import type { Announcement } from '../lib/types'

const EnvelopeIcon = () => (
  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="1.6" y="4" width="16.8" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2.2 5l7.8 6 7.8-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

function fmtDay(ts?: number): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
}

/** 公告列表：桌面放进通栏展开区，移动端放进页面卡片，共用同一份渲染 */
export function AnnouncementList({ items, defaultOpen = true, hideHeader = false, className = '' }: {
  items: Announcement[]
  defaultOpen?: boolean
  hideHeader?: boolean
  className?: string
}) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? items : items.slice(0, 5)
  const firstKey = items[0]?.id != null ? String(items[0].id) : '0'

  return (
    <div className={'ann-panel ' + className}>
      {!hideHeader && (
        <div className="ann-panel-h">
          <span>系统公告</span>
          {items.length > 5 && (
            <button type="button" onClick={() => setShowAll((v) => !v)}>
              {showAll ? '收起' : `全部 ${items.length} 条 ›`}
            </button>
          )}
        </div>
      )}
      <Collapse
        ghost
        size="small"
        defaultActiveKey={defaultOpen ? [firstKey] : []}
        items={shown.map((a, i) => ({
          key: String(a.id ?? i),
          label: (
            <div className="ann-item-label">
              {a.pinned && <em className="pin">置顶</em>}
              <b>{a.title || '（无标题）'}</b>
              <time>{fmtDay(a.published_at)}</time>
            </div>
          ),
          children: <div className="ann-body">{a.body || '暂无内容'}</div>,
        }))}
      />
    </div>
  )
}

/**
 * 桌面端通栏公告条（移动端隐藏，改用页面卡片）
 * 一行常驻：置顶标 + 最新公告标题 + 日期 + 全部 N 条；点击 inline 展开列表
 */
export function NoticeBar({ items }: { items: Announcement[] }) {
  const [open, setOpen] = useState(false)
  const first = items[0]
  if (!first) return null
  const hasMore = items.length > 1

  return (
    <div className="nbar">
      {/* 整行都是点击区：标签、标题、日期、右侧按钮任意位置都能展开/收起 */}
      <button
        type="button"
        className="wrap nbar-in"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nbar-pin">{first.pinned ? '置顶' : '公告'}</span>
        <span className="nbar-t">
          <b>系统公告</b>
          <span>{first.title || '（无标题）'}</span>
        </span>
        <span className="nbar-d">{fmtDay(first.published_at)}</span>
        <span className="nbar-more">
          {open ? '收起' : hasMore ? `全部 ${items.length} 条 ›` : '展开 ›'}
        </span>
      </button>
      {open && (
        <div className="wrap nbar-panel">
          <AnnouncementList items={items} hideHeader className="inline" />
        </div>
      )}
    </div>
  )
}

export function SiteHeader({ note, loginLink, onFeedback, demo }: {
  note?: string
  loginLink?: boolean
  onFeedback?: () => void
  demo?: boolean
}) {
  return (
    <header className="hd">
      <div className="hd-brand">
        <span className="hd-mark"><EnvelopeIcon /></span>
        <span className="hd-title">上海高中明信片邮路追踪</span>
        {demo && <span className="hd-demo">模拟页面</span>}
        {note && <span className="hd-cycle">{note}</span>}
      </div>
      <div className="hd-right">
        {onFeedback && (
          <Button type="text" className="hd-btn" onClick={onFeedback}>留言/反馈</Button>
        )}
        {loginLink && (
          <a className="hd-btn hd-link" href="/login"><span className="hide-sm">管理员</span>登录</a>
        )}
      </div>
    </header>
  )
}

export function SiteFooter({ progressNote = false, onFeedback }: {
  progressNote?: boolean
  onFeedback?: () => void
}) {
  return (
    <footer className="ft">
      {/* 桌面端：左侧说明 + 右侧链接组 */}
      <div className="ft-in ft-desk">
        {progressNote && <span>邮路进度仅供参考，以实际投递为准</span>}
        <div className="ft-r">
          {onFeedback && <button type="button" className="ft-link" onClick={onFeedback}>留言/反馈</button>}
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">沪ICP备2026049485号</a>
          <span>Designed &amp; Developed by linle_1222</span>
        </div>
      </div>

      {/* 移动端：与原站一致，三行居中 */}
      <div className="ft-in ft-mob">
        <span>SHHS Post · 邮路进度仅供参考</span>
        <span>Designed &amp; Developed by linle_1222</span>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">沪ICP备2026049485号</a>
      </div>
    </footer>
  )
}

export function Shell({ headerNote, progressNote, loginLink, onFeedback, demo, children }: {
  headerNote?: string
  progressNote?: boolean
  loginLink?: boolean
  onFeedback?: () => void
  demo?: boolean
  children: ReactNode
}) {
  return (
    <div className="page">
      <SiteHeader note={headerNote} loginLink={loginLink} onFeedback={onFeedback} demo={demo} />
      {children}
      <SiteFooter progressNote={progressNote} onFeedback={onFeedback} />
    </div>
  )
}
