import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { get, ApiError } from './api'
import type { Metadata, School } from './types'

interface MetaCtx {
  meta: Metadata | null
  error: ApiError | null
  loading: boolean
  nameOf: (id: string) => string
  districtOf: (id: string) => string
  cycles: string[]
}

const Ctx = createContext<MetaCtx>({
  meta: null,
  error: null,
  loading: true,
  nameOf: (id) => id,
  districtOf: () => '',
  cycles: [],
})

export function MetadataProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Metadata | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    get<Metadata>('public/metadata')
      .then((m) => {
        setMeta(m)
        setError(null)
      })
      .catch((e: ApiError) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const schoolIndex = useMemo(() => {
    const map = new Map<string, School>()
    for (const s of meta?.schools ?? []) map.set(s.id, s)
    return map
  }, [meta])

  const nameOf = useCallback(
    (id: string) => {
      const s = schoolIndex.get(id)
      if (s) return `${s.name}`
      // 分拣节点 id 形如 sorting:2026:浦东新区:26shpd02
      const m = /^sorting:\d+:(.+?):([0-9a-z]+)$/i.exec(id)
      if (m) {
        const host = schoolIndex.get(m[2])
        return host ? `${host.name}（分拣）` : id
      }
      return id
    },
    [schoolIndex],
  )
  const districtOf = useCallback((id: string) => schoolIndex.get(id)?.district ?? '', [schoolIndex])

  const value = useMemo<MetaCtx>(
    () => ({ meta, error, loading, nameOf, districtOf, cycles: meta ? [meta.cycle] : [] }),
    [meta, error, loading, nameOf, districtOf],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useMeta = () => useContext(Ctx)
