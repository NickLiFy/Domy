export type AppRoute =
  | { name: 'catalog'; editMode: boolean }
  | { name: 'detail'; homeId: string }

export const catalogPath = (options: { editMode?: boolean } = {}) =>
  options.editMode ? '/?edit=1' : '/'

export const detailPath = (homeId: string) => `/dum/${encodeURIComponent(homeId)}`

/** `?home=<id>` is the pre-router URL shape; old bookmarks and open tabs still use it. */
export const parseAppRoute = (pathname: string, search: string): AppRoute => {
  const params = new URLSearchParams(search)
  const legacyHomeId = params.get('home')
  if (legacyHomeId) return { name: 'detail', homeId: legacyHomeId }

  const detailMatch = pathname.match(/^\/dum\/([^/]+)\/?$/)
  if (detailMatch) return { name: 'detail', homeId: decodeURIComponent(detailMatch[1]) }

  return { name: 'catalog', editMode: params.get('edit') === '1' }
}

export const isLegacyDetailUrl = (search: string) => new URLSearchParams(search).has('home')
