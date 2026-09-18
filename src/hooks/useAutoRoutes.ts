import { useEffect, useRef } from 'react'
import { loadRoutes } from '../api/homeData'
import { routeSnapshotVersion } from '../config/app'
import { mergeRefreshedHome, routeSettingsKey } from '../lib/home'
import type { AddressSettings, Home } from '../types/home'

const needsRoutes = (home: Home) =>
  home.dataStatus === 'ready' &&
  Boolean(home.coordinates) &&
  (!home.routesFrozenAt || home.routesSnapshotVersion !== routeSnapshotVersion)

/** Recomputes routes whenever a home is ready or the destination addresses change. */
export const useAutoRoutes = (
  homes: Home[],
  addressSettings: AddressSettings,
  setHomes: React.Dispatch<React.SetStateAction<Home[]>>,
) => {
  const homesRef = useRef(homes)
  const addressSettingsRef = useRef(addressSettings)

  const settingsKey = routeSettingsKey(addressSettings)
  const isRefreshing = homes.some(needsRoutes)
  // Only these fields decide whether routes must be recalculated.
  const pendingSignature = homes
    .map((home) => [home.id, home.dataStatus, home.coordinates?.lat ?? '', home.coordinates?.lon ?? '', home.routesFrozenAt ?? ''].join(':'))
    .join('|')

  useEffect(() => {
    homesRef.current = homes
    addressSettingsRef.current = addressSettings
  }, [homes, addressSettings])

  useEffect(() => {
    const pendingHomes = homesRef.current.filter(needsRoutes)
    if (!pendingHomes.length) return

    const controller = new AbortController()
    let active = true

    void Promise.all(
      pendingHomes.map(async (home) => {
        try {
          const updatedHome = await loadRoutes(home, addressSettingsRef.current, controller.signal)
          return updatedHome
        } catch {
          if (controller.signal.aborted) return home
          return {
            ...home,
            routeAddresses: { ...addressSettingsRef.current },
            routesKey: settingsKey,
            routesFrozenAt: new Date().toISOString(),
            routesSnapshotVersion: routeSnapshotVersion,
          }
        }
      }),
    ).then((updatedHomes) => {
      if (!active) return

      const changed = updatedHomes.filter((home, index) => home !== pendingHomes[index])
      if (changed.length) {
        const updates = new Map(changed.map((home) => [home.id, home]))
        setHomes((current) =>
          current.map((home) => {
            const updated = updates.get(home.id)
            return updated ? mergeRefreshedHome(home, updated, 'routes') : home
          }),
        )
      }

    })

    return () => {
      active = false
      controller.abort()
    }
  }, [setHomes, settingsKey, pendingSignature])

  return { isRefreshing }
}
