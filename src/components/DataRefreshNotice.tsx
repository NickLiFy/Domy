import { refreshSourceLabels } from '../config/app'
import type { RefreshSource } from '../types/home'

export function DataRefreshNotice({ sources }: { sources: RefreshSource[] }) {
  if (!sources.length) return null
  const uniqueSources = [...new Set(sources)]

  return (
    <div className="data-refresh-notice" role="status" aria-live="polite">
      <div className="data-refresh-copy">
        <span className="data-refresh-spinner" aria-hidden="true" />
        <span><strong>Načítají se data</strong><small>{uniqueSources.map((source) => refreshSourceLabels[source]).join(' · ')}</small></span>
      </div>
      <div className="data-refresh-progress" aria-hidden="true"><span /></div>
    </div>
  )
}
