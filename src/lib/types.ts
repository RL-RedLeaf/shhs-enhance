export interface School {
  id: string
  name: string
  district: string
}

export interface PudongNode {
  id: string
  district: string
  hostSchool: string
}

export interface PudongTopology {
  cycle: string
  nodes: PudongNode[]
  assignment: Record<string, string>
  ingress: Record<string, string>
}

export interface Metadata {
  cycle: string
  schools: School[]
  hubs: Record<string, string>
  pudongTopology?: PudongTopology
  defaultEligible?: boolean
  defaultRouteId?: string
  displayVerified: boolean
  [k: string]: unknown
}

export interface RouteStep {
  school: string
  label: string
  done: boolean
  source: string
  date: string | null
  inferenceReason?: string
}

export interface Projection {
  batch: string
  steps: RouteStep[]
}

export interface RouteInfo {
  id?: string | null
  code?: string
  from: string
  to: string
  cycle: string
  active?: boolean
  materialized?: boolean
  updatedAt?: string | null
}

export interface RouteDetail extends Metadata {
  routes?: RouteInfo[]
  projections?: Record<string, Projection[]>
  virtualProjection?: Projection[]
  effectiveDisplay?: unknown[]
}

export interface Announcement {
  id?: string | number
  title?: string
  body?: string
  createdAt?: string
  /** 线上实际字段：发布时间（Unix 毫秒） */
  published_at?: number
  pinned?: boolean
  [k: string]: unknown
}

export type Role = 'school' | 'organizer_admin'

export interface Account {
  username: string
  role: Role
  school_id?: string
  must_change_password?: boolean
  [k: string]: unknown
}

export interface MeResp {
  account: Account | null
  phase?: string
}


