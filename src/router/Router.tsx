import { type AnchorHTMLAttributes, type MouseEvent, useMemo, useSyncExternalStore } from 'react'
import { parseAppRoute, type AppRoute } from './paths'

const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

const getSnapshot = () => `${window.location.pathname}${window.location.search}`

export const navigate = (to: string, options: { replace?: boolean } = {}) => {
  if (to === getSnapshot()) return
  window.history[options.replace ? 'replaceState' : 'pushState'](null, '', to)
  notify()
  if (!options.replace) window.scrollTo({ top: 0 })
}

export const useAppRoute = (): AppRoute => {
  const location = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return useMemo(() => {
    const [pathname, search = ''] = location.split('?')
    return parseAppRoute(pathname, search)
  }, [location])
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string
  replace?: boolean
}

const opensElsewhere = (event: MouseEvent<HTMLAnchorElement>, target?: string) =>
  event.defaultPrevented ||
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey ||
  (target !== undefined && target !== '_self')

/** Renders a real `<a>`, so Ctrl/⌘/middle click still opens the route in a new tab. */
export function Link({ to, replace, onClick, target, ...anchorProps }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (opensElsewhere(event, target)) return
    event.preventDefault()
    navigate(to, { replace })
  }

  return <a href={to} target={target} onClick={handleClick} {...anchorProps} />
}
