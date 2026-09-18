import { routeKeys } from '../config/app'
import type { ListingPayload } from '../types/api'
import type {
  AddressSettings,
  CrimeData,
  Coordinates,
  Home,
  HomeRefreshSource,
  Journey,
  RouteKey,
  SafetySummary,
} from '../types/home'
import { emptyAccess, unknownJourney } from '../types/home'
import { formatCrimeMonth } from './format'

const blankJourneys = () =>
  Object.fromEntries(routeKeys.map((key) => [key, { ...unknownJourney }])) as Record<RouteKey, Journey>

const blankDistances = () => Object.fromEntries(routeKeys.map((key) => [key, 0])) as Record<RouteKey, number>

/** Route results are only valid for one set of destination addresses; this key detects staleness. */
export const routeSettingsKey = (settings: AddressSettings) =>
  `route-v2:${routeKeys.map((key) => `${key}:${settings[key].trim()}`).join('|')}`

export const createPendingHome = (listingUrl: string, existingId?: string): Home => {
  const listingId = listingUrl.match(/\/detail\/(\d+)/)?.[1]

  return {
    id: existingId ?? `user-eurobydleni-${listingId ?? Date.now()}`,
    title: 'Načítám nabídku',
    location: 'Načítám lokalitu',
    municipality: '—',
    price: 0,
    area: 0,
    plot: 0,
    rooms: '—',
    year: 0,
    status: 'Čeká na načtení',
    images: [],
    aiImages: [],
    coverSelection: [],
    coverMain: 0,
    routes: blankJourneys(),
    pragueKm: 0,
    access: emptyAccess,
    safety: {
      level: 'Načítám',
      detail: 'Bezpečnostní data se načítají z veřejného zdroje.',
      percentile: 0,
    },
    description: 'Načítám přesný popis z původní nabídky.',
    listingUrl,
    facts: [],
    coordinates: null,
    crime: null,
    routeDistances: blankDistances(),
    dataStatus: 'idle',
  }
}

export const normalizeSavedHome = (home: Home): Home => {
  const pendingHome = createPendingHome(home.listingUrl, home.id)
  return {
    ...pendingHome,
    ...home,
    images: Array.isArray(home.images) ? home.images : [],
    aiImages: Array.isArray(home.aiImages) ? home.aiImages : [],
    coverSelection: Array.isArray(home.coverSelection) ? home.coverSelection : [],
    coverMain: typeof home.coverMain === 'number' ? home.coverMain : 0,
    routes: { ...pendingHome.routes, ...(home.routes ?? {}) },
    access: { ...emptyAccess, ...(home.access ?? {}) },
    safety: { ...pendingHome.safety, ...(home.safety ?? {}) },
    facts: Array.isArray(home.facts) ? home.facts : [],
    routeDistances: { ...blankDistances(), ...(home.routeDistances ?? {}) },
    dataStatus: home.dataStatus ?? (home.price > 0 ? 'ready' : 'idle'),
  }
}

export const safetyFromCrime = (crime: CrimeData | null | undefined): SafetySummary => {
  if (!crime) {
    return {
      level: 'Neověřeno',
      detail: 'Bezpečnostní data nebyla z veřejného zdroje načtena.',
      percentile: 0,
      count: 0,
    }
  }

  return {
    level: `${crime.count} případů`,
    detail: `${crime.count} evidovaných deliktů v okruhu ${crime.radiusKm} km za ${formatCrimeMonth(crime.month)}`,
    percentile: crime.count,
    metricMax: Math.max(crime.count, 1),
    metricUnit: `případů / ${crime.radiusKm} km`,
    count: crime.count,
  }
}

export const sameCoordinates = (first: Coordinates | null | undefined, second: Coordinates | null | undefined) =>
  first?.lat === second?.lat && first?.lon === second?.lon

export const createLiveHome = (shell: Home, payload: ListingPayload, warnings: string[]): Home => {
  const { listing, coordinates } = payload
  const moved = !sameCoordinates(shell.coordinates, coordinates)
  const crime = moved ? null : shell.crime

  const liveHome: Home = {
    ...shell,
    title: listing.title,
    location: listing.location,
    municipality: listing.municipality,
    price: listing.price,
    area: listing.area,
    plot: listing.plot,
    rooms: listing.rooms,
    year: listing.year,
    status: listing.status,
    images: listing.images,
    routes: moved ? blankJourneys() : shell.routes,
    pragueKm: moved ? 0 : shell.pragueKm,
    access: moved ? emptyAccess : shell.access,
    safety: moved ? safetyFromCrime(null) : shell.safety,
    description: listing.description,
    address: listing.address,
    facts: listing.facts ?? [],
    coordinates,
    crime,
    accessSnapshotAt: moved ? undefined : shell.accessSnapshotAt,
    accessSnapshotVersion: moved ? undefined : shell.accessSnapshotVersion,
    routeAddresses: moved ? undefined : shell.routeAddresses,
    routesFrozenAt: moved ? undefined : shell.routesFrozenAt,
    routesSnapshotVersion: moved ? undefined : shell.routesSnapshotVersion,
    dataStatus: 'ready',
    dataError: undefined,
    routeDistances: moved ? blankDistances() : shell.routeDistances,
    routesKey: moved ? undefined : shell.routesKey,
    sources: {
      listing: {
        label: `Eurobydlení · nabídka ${listing.id}`,
        url: shell.listingUrl,
        note: 'Cena, parametry, popis a fotografie',
      },
      access: {
        label: 'Mapy.com + OpenStreetMap',
        url: 'https://www.openstreetmap.org/',
        note: 'Místa v okolí a jednorázově uložený čas pěší trasy',
      },
      distance: {
        label: 'Mapy.com',
        url: `https://mapy.com/zakladni?q=${encodeURIComponent(listing.address)}`,
        note: 'Jednorázově uložené silniční vzdálenosti',
      },
      ...(crime
        ? {
            safety: {
              label: 'Mapa kriminality Policie ČR',
              url: crime.sourceUrl,
              note: `${crime.count} případů v okruhu ${crime.radiusKm} km`,
            },
          }
        : {}),
    },
    verifiedAt: new Date().toISOString().slice(0, 10),
  }

  return applyWarnings(liveHome, 'listing', warnings)
}

export const createErrorHome = (shell: Home, error: unknown): Home => ({
  ...shell,
  dataStatus: 'error',
  dataError: error instanceof Error ? error.message : 'Živá data se nepodařilo načíst.',
})

/** Each refresh source owns only its own slice, so a slow source never reverts a fresh one. */
export const mergeRefreshedHome = (current: Home, updated: Home, source: HomeRefreshSource): Home => {
  const warnings = {
    dataWarnings: updated.dataWarnings,
    warningsBySource: updated.warningsBySource,
  }

  if (source === 'listing') {
    const moved = !sameCoordinates(current.coordinates, updated.coordinates)
    return {
      ...updated,
      crime: moved ? updated.crime : current.crime,
      access: moved ? updated.access : current.access,
      safety: moved ? updated.safety : current.safety,
      routes: moved ? updated.routes : current.routes,
      routeDistances: moved ? updated.routeDistances : current.routeDistances,
      pragueKm: moved ? updated.pragueKm : current.pragueKm,
      routesKey: moved ? updated.routesKey : current.routesKey,
      routeAddresses: moved ? updated.routeAddresses : current.routeAddresses,
      routesFrozenAt: moved ? updated.routesFrozenAt : current.routesFrozenAt,
      routesSnapshotVersion: moved ? updated.routesSnapshotVersion : current.routesSnapshotVersion,
      accessSnapshotAt: moved ? updated.accessSnapshotAt : current.accessSnapshotAt,
      sources: moved ? updated.sources : { ...current.sources, ...updated.sources },
    }
  }

  if (source === 'safety') {
    return {
      ...current,
      ...warnings,
      crime: updated.crime,
      safety: updated.safety,
      sources: { ...current.sources, safety: updated.sources?.safety },
    }
  }

  if (source === 'access') {
    return {
      ...current,
      ...warnings,
      access: updated.access,
      accessSnapshotAt: updated.accessSnapshotAt ?? current.accessSnapshotAt,
      accessSnapshotVersion: updated.accessSnapshotVersion ?? current.accessSnapshotVersion,
    }
  }

  return {
    ...current,
    ...warnings,
    routes: updated.routes,
    routeDistances: updated.routeDistances,
    pragueKm: updated.pragueKm,
    routesKey: updated.routesKey,
    routeAddresses: updated.routeAddresses ?? current.routeAddresses,
    routesFrozenAt: updated.routesFrozenAt ?? current.routesFrozenAt,
    routesSnapshotVersion: updated.routesSnapshotVersion ?? current.routesSnapshotVersion,
  }
}

export const getCoverImages = (home: Home) => {
  if (!home.images.length) return []

  const validSelection = home.coverSelection.filter((index) => index >= 0 && index < home.images.length)
  const fallback = home.images.map((_, index) => index)
  const unique = [...new Set([...validSelection, ...fallback])].slice(0, 3)
  const main = unique.includes(home.coverMain) ? home.coverMain : unique[0]

  return [main, ...unique.filter((index) => index !== main)].map((index) => ({
    index,
    src: home.images[index],
  }))
}

/** Warnings are owned per source, so a failing map lookup cannot erase a listing warning. */
export const applyWarnings = (home: Home, source: HomeRefreshSource, warnings: string[]): Home => {
  const bySource = { ...(home.warningsBySource ?? {}) }
  if (warnings.length) bySource[source] = warnings
  else delete bySource[source]

  const combined = [...new Set(Object.values(bySource).flat())]
  return {
    ...home,
    warningsBySource: Object.keys(bySource).length ? bySource : undefined,
    dataWarnings: combined.length ? combined : undefined,
  }
}
