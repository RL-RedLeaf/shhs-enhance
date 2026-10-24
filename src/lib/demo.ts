/**
 * 演示模式（VITE_DEMO=1）
 *
 * 线上接口不带 Access-Control-Allow-Origin，GitHub Pages 这类纯静态托管无法跨域读取，
 * 所以演示版改为拦截 fetch、用本地快照数据应答：
 *   - /api/public/metadata       → fixtures/metadata.json（真实学校目录快照）
 *   - /api/public/announcements  → fixtures/announcements.json
 *   - /api/public/routes[/{id}]  → 按所选学校现场合成一条 6 站邮路
 *   - /api/public/feedback       → 204，不真正提交
 *
 * 真实站点不受影响：这段代码只在构建时带 VITE_DEMO=1 才会被打进产物。
 */
import type { Announcement, Metadata, Projection, RouteDetail, RouteStep, School } from './types'
import metadataJson from './fixtures/metadata.json'
import announcementsJson from './fixtures/announcements.json'

const META = metadataJson as unknown as Metadata
const ANNS = announcementsJson as unknown as { items: Announcement[] }

const ROUTE_ID = 'R1'
const ROUTE_CODE = 'SH26-001'

const LABELS = [
  '寄件学校已发出',
  '寄件区分拣校已接收',
  '寄件区分拣校已发出',
  '目标区分拣校已接收',
  '目标区分拣校已发出',
  '目标学校已接收',
]

/** 分拣节点 id 形如 sorting:2026:浦东新区:26shpd02，nameOf 会渲染成「校名（分拣）」 */
const sortingId = (s: School) => `sorting:${META.cycle}:${s.district}:${s.id}`

function pickHub(district: string, excludeId: string): School | undefined {
  return META.schools.find((s) => s.district === district && s.id !== excludeId)
    ?? META.schools.find((s) => s.district === district)
}

/** 按寄件/收件学校合成一条邮路：前两站已完成，其余等待记录 */
function buildSteps(fromId: string, toId: string): RouteStep[] {
  const from = META.schools.find((s) => s.id === fromId)
  const to = META.schools.find((s) => s.id === toId)
  const hubA = from ? sortingId(from) : fromId
  const hubBSchool = to ? pickHub(to.district, to.id) : undefined
  const hubB = hubBSchool ? sortingId(hubBSchool) : to ? sortingId(to) : toId
  const schools = [fromId, hubA, hubA, hubB, hubB, toId]

  return LABELS.map((label, i) => {
    const done = i < 2
    return {
      school: schools[i],
      label,
      done,
      source: done ? '自动同步' : '暂无记录',
      date: done ? '2026-10-12' : null,
    }
  })
}

function buildDetail(fromId: string, toId: string): RouteDetail {
  const projection: Projection = { batch: '首批', steps: buildSteps(fromId, toId) }
  return {
    ...META,
    routes: [{
      id: ROUTE_ID,
      code: ROUTE_CODE,
      from: fromId,
      to: toId,
      cycle: META.cycle,
      active: true,
      materialized: true,
      updatedAt: '2026-10-23T17:17:00+08:00',
    }],
    projections: { [ROUTE_ID]: [projection] },
  }
}

const DEFAULT_FROM =
  META.schools.find((s) => s.name.includes('上海外国语大学附属浦东外国语学校')) ?? META.schools[0]
const DEFAULT_TO =
  META.schools.find((s) => s.name.includes('宝山中学')) ?? META.schools[1] ?? META.schools[0]

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function installDemo() {
  const original = window.fetch.bind(window)

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : input.url
    const url = new URL(raw, location.href)
    const at = url.pathname.indexOf('/api/')
    if (at < 0) return original(input as RequestInfo, init)

    const api = url.pathname.slice(at + '/api/'.length)
    const method = (init?.method ?? 'GET').toUpperCase()

    if (method === 'POST' && api.startsWith('public/feedback')) {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    if (api.startsWith('public/metadata')) return Promise.resolve(json(META))
    if (api.startsWith('public/announcements')) return Promise.resolve(json(ANNS))
    if (api.startsWith('public/routes')) {
      const from = url.searchParams.get('from_school')
      const to = url.searchParams.get('to_school')
      return Promise.resolve(
        from && to ? json(buildDetail(from, to)) : json(buildDetail(DEFAULT_FROM.id, DEFAULT_TO.id)),
      )
    }
    return Promise.resolve(json({ code: 'DEMO_UNAVAILABLE', error: '演示版不提供该接口' }, 404))
  }
}
