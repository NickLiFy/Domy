import { useCallback, useEffect, useRef, useState } from 'react'
import { loadAccess, loadListing, loadRoutes, loadSafety } from '../api/homeData'
import { accessSnapshotVersion, routeSnapshotVersion } from '../config/app'
import { createErrorHome, mergeRefreshedHome } from '../lib/home'
import { loadArchivedHomes, loadHomes, saveArchivedHomes, saveHomes } from '../lib/storage'
import type { AddressSettings, Home, HomeRefreshSource } from '../types/home'
import { useRefreshTracker } from './useRefreshTracker'

type HomeLoader = (home: Home, signal: AbortSignal) => Promise<Home>

export const useHomes = (addressSettings: AddressSettings) => {
  const [homes, setHomes] = useState<Home[]>(loadHomes)
  const [archivedHomes, setArchivedHomes] = useState<Home[]>(loadArchivedHomes)
  const { activeSources, markRefreshing } = useRefreshTracker()

  const homesRef = useRef(homes)
  const addressSettingsRef = useRef(addressSettings)
  useEffect(() => {
    homesRef.current = homes
    addressSettingsRef.current = addressSettings
  }, [homes, addressSettings])

  useEffect(() => {
    saveHomes(homes)
  }, [homes])

  useEffect(() => {
    saveArchivedHomes(archivedHomes)
  }, [archivedHomes])

  const replaceHome = useCallback((updatedHome: Home, source: HomeRefreshSource) => {
    const apply = (current: Home[]) =>
      current.some((home) => home.id === updatedHome.id)
        ? current.map((home) =>
            home.id === updatedHome.id ? mergeRefreshedHome(home, updatedHome, source) : home,
          )
        : [...current, updatedHome]

    homesRef.current = apply(homesRef.current)
    setHomes(apply)
  }, [])

  const runRefresh = useCallback(
    async (source: HomeRefreshSource, homeId: string, loader: HomeLoader, fallbackHome?: Home) => {
      const home = homesRef.current.find((item) => item.id === homeId) ?? fallbackHome
      if (!home) return null

      const controller = new AbortController()
      markRefreshing(source, true)
      if (source === 'listing') replaceHome({ ...home, dataStatus: 'loading', dataError: undefined }, source)

      try {
        const updatedHome = await loader(home, controller.signal)
        replaceHome(updatedHome, source)
        return updatedHome
      } catch (error) {
        if (source === 'listing') replaceHome(createErrorHome(home, error), source)
        return null
      } finally {
        markRefreshing(source, false)
      }
    },
    [markRefreshing, replaceHome],
  )

  const refreshListing = useCallback(
    (homeId: string, fallbackHome?: Home) => runRefresh('listing', homeId, loadListing, fallbackHome),
    [runRefresh],
  )
  const refreshSafety = useCallback((homeId: string) => runRefresh('safety', homeId, loadSafety), [runRefresh])
  const refreshAccess = useCallback((homeId: string) => runRefresh('access', homeId, loadAccess), [runRefresh])
  const refreshRoutes = useCallback(
    (homeId: string) => {
      const home = homesRef.current.find((item) => item.id === homeId)
      return home?.routesFrozenAt && home.routesSnapshotVersion === routeSnapshotVersion
        ? Promise.resolve(home)
        : runRefresh('routes', homeId, (currentHome, signal) => loadRoutes(currentHome, addressSettingsRef.current, signal))
    },
    [runRefresh],
  )

  // Homes restored from storage show cached values first, then quietly re-check map sources.
  const initialHomesRef = useRef(homes)
  useEffect(() => {
    const controller = new AbortController()

    const refreshInBackground = async (source: HomeRefreshSource, home: Home, loader: HomeLoader) => {
      markRefreshing(source, true)
      try {
        const updatedHome = await loader(home, controller.signal)
        if (!controller.signal.aborted) replaceHome(updatedHome, source)
      } catch {
        // Cached data stays visible when a background source is unavailable.
      } finally {
        markRefreshing(source, false)
      }
    }

    for (const home of initialHomesRef.current) {
      if (home.dataStatus !== 'ready' || !home.coordinates) continue
      void refreshInBackground('safety', home, loadSafety)
      if (!home.accessSnapshotAt || home.accessSnapshotVersion !== accessSnapshotVersion) {
        void refreshInBackground('access', home, loadAccess)
      }
    }

    return () => controller.abort()
  }, [markRefreshing, replaceHome])

  return {
    homes,
    setHomes,
    archivedHomes,
    setArchivedHomes,
    activeSources,
    refreshListing,
    refreshSafety,
    refreshAccess,
    refreshRoutes,
  }
}
