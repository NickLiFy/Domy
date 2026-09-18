import { accessSnapshotVersion, routeKeys, routeSnapshotVersion } from '../config/app'
import { applyWarnings, createLiveHome, routeSettingsKey, safetyFromCrime } from '../lib/home'
import type { AccessPayload, FuelPayload, ListingPayload, RoutesPayload, SafetyPayload } from '../types/api'
import type { AddressSettings, FuelType, Home, Journey, RouteKey } from '../types/home'
import { emptyAccess, unknownJourney } from '../types/home'
import { buildApiUrl, requestApi } from './client'

const coordinateParams = (home: Home) => {
  if (!home.coordinates) throw new Error('Data čekají na souřadnice domu.')
  return [
    ['lat', String(home.coordinates.lat)],
    ['lon', String(home.coordinates.lon)],
  ] as Array<[string, string]>
}

export const loadListing = async (home: Home, signal: AbortSignal): Promise<Home> => {
  const url = buildApiUrl('/api/listing', [['url', home.listingUrl]])
  const { data, warnings, error } = await requestApi<ListingPayload>(url, signal)
  if (!data) throw new Error(error?.message ?? 'Nabídku se nepodařilo načíst.')
  return createLiveHome(home, data, warnings)
}

export const loadSafety = async (home: Home, signal: AbortSignal): Promise<Home> => {
  const url = buildApiUrl('/api/safety', coordinateParams(home))
  const { data, warnings, error } = await requestApi<SafetyPayload>(url, signal)
  const crime = data?.crime ?? null
  const messages = error ? [...new Set([...warnings, error.message])] : warnings

  const withCrime: Home = crime
    ? {
        ...home,
        crime,
        safety: safetyFromCrime(crime),
        sources: {
          ...home.sources,
          safety: {
            label: 'Mapa kriminality Policie ČR',
            url: crime.sourceUrl,
            note: `${crime.count} případů v okruhu ${crime.radiusKm} km`,
          },
        },
      }
    : home

  return applyWarnings(withCrime, 'safety', messages)
}

export const loadAccess = async (home: Home, signal: AbortSignal): Promise<Home> => {
  const url = buildApiUrl('/api/access', coordinateParams(home))
  const { data, warnings, error } = await requestApi<AccessPayload>(url, signal)
  const messages = error ? [...new Set([...warnings, error.message])] : warnings
  // Keep the fallback places visible, but freeze the result after this first snapshot.
  const access = data?.access ?? (messages.length ? home.access : emptyAccess)
  const hasAccessSnapshot = data?.access !== null && data?.access !== undefined

  return applyWarnings(
    {
      ...home,
      access,
      accessSnapshotAt: hasAccessSnapshot ? data.snapshotAt ?? new Date().toISOString() : home.accessSnapshotAt,
      accessSnapshotVersion: hasAccessSnapshot ? accessSnapshotVersion : home.accessSnapshotVersion,
    },
    'access',
    messages,
  )
}

export const loadRoutes = async (
  home: Home,
  addressSettings: AddressSettings,
  signal: AbortSignal,
): Promise<Home> => {
  if (!home.coordinates) return home

  const routeAddresses: AddressSettings = {
    ...addressSettings,
    center: addressSettings.center.trim() || home.municipality.trim(),
  }
  const destinations = routeKeys
    .map((key) => ({ key, query: routeAddresses[key].trim() }))
    .filter((destination) => destination.query)

  const settingsKey = routeSettingsKey(routeAddresses)
  const frozenAt = new Date().toISOString()
  if (!destinations.length) {
    return {
      ...home,
      routesKey: settingsKey,
      routeAddresses,
      routesFrozenAt: frozenAt,
      routesSnapshotVersion: routeSnapshotVersion,
    }
  }

  const url = buildApiUrl('/api/routes', [
    ['lat', String(home.coordinates.lat)],
    ['lon', String(home.coordinates.lon)],
    ...destinations.map(({ key, query }) => ['to', `${key}:${query}`] as [string, string]),
  ])
  const { data, warnings, error } = await requestApi<RoutesPayload>(url, signal)
  const messages = error ? [...new Set([...warnings, error.message])] : warnings
  if (!data) {
    return applyWarnings(
      { ...home, routeAddresses, routesKey: settingsKey, routesFrozenAt: frozenAt, routesSnapshotVersion: routeSnapshotVersion },
      'routes',
      messages,
    )
  }

  const configured = new Set(destinations.map((destination) => destination.key))
  const routes = { ...home.routes } as Record<RouteKey, Journey>
  const routeDistances = { ...(home.routeDistances ?? {}) } as Record<RouteKey, number>

  for (const key of routeKeys) {
    const route = configured.has(key) ? data.routes[key] : undefined
    routes[key] = route ? { car: route.car, transit: route.transit, train: route.train } : { ...unknownJourney }
    routeDistances[key] = route?.distanceKm ?? 0
  }

  return applyWarnings(
    {
      ...home,
      routes,
      routeDistances,
      pragueKm: routeDistances.prague,
      routesKey: settingsKey,
      routeAddresses,
      routesFrozenAt: frozenAt,
      routesSnapshotVersion: routeSnapshotVersion,
    },
    'routes',
    messages,
  )
}

export type FuelOutcome = {
  prices: Record<FuelType, number> | null
  message: string | null
}

export const loadFuelPrices = async (): Promise<FuelOutcome> => {
  const { data, warnings, error } = await requestApi<FuelPayload>('/api/fuel')
  return {
    prices: data?.prices ?? null,
    message: error?.message ?? warnings[0] ?? null,
  }
}
