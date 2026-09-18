import { useCallback, useRef, useState } from 'react'
import type { RefreshSource } from '../types/home'

/** Counts overlapping refreshes per source so a finishing request cannot clear a running one. */
export const useRefreshTracker = () => {
  const [activeSources, setActiveSources] = useState<RefreshSource[]>([])
  const counts = useRef(new Map<RefreshSource, number>())

  const markRefreshing = useCallback((source: RefreshSource, active: boolean) => {
    const current = counts.current.get(source) ?? 0
    const next = active ? current + 1 : Math.max(0, current - 1)
    counts.current.set(source, next)

    setActiveSources((sources) => {
      const listed = sources.includes(source)
      if (next > 0) return listed ? sources : [...sources, source]
      return listed ? sources.filter((item) => item !== source) : sources
    })
  }, [])

  return { activeSources, markRefreshing }
}
