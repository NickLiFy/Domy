import type { Coordinates, RouteResult } from '../types.js'
import { unknownRoute } from '../types.js'
import { TtlCache } from '../lib/cache.js'
import { formatDuration, roundKm } from '../lib/geo.js'
import { describeNetworkError } from '../lib/net.js'
import { geocodeDestination } from './geocode.js'
import { mapyMatrix, type MapyMatrixResult } from './mapy.js'

export const maxDestinations = 8

export type RouteRequest = {
  key: string
  query: string
}

export type RoutesOutcome = {
  routes: Record<string, RouteResult>
  warnings: string[]
}

const routeCache = new TtlCache<RouteResult>(6 * 60 * 60 * 1000, 300)

type ResolvedDestination = RouteRequest & {
  coordinates: Coordinates | null
  cached?: RouteResult
  rateLimited?: boolean
}

const routeFromMapy = (result: MapyMatrixResult): RouteResult => ({
  car: formatDuration(result.duration),
  transit: '—',
  train: '—',
  distanceKm: roundKm(result.length / 1000),
})

export const getRoutes = async (origin: Coordinates, destinations: RouteRequest[]): Promise<RoutesOutcome> => {
  const routes: Record<string, RouteResult> = {}
  const warnings: string[] = []

  const resolved: ResolvedDestination[] = await Promise.all(
    destinations.map(async ({ key, query }): Promise<ResolvedDestination> => {
      const cacheKey = `mapy-car-v1:${origin.lat.toFixed(5)}:${origin.lon.toFixed(5)}->${query}`
      const cached = routeCache.get(cacheKey)
      if (cached) return { key, query, coordinates: null, cached } satisfies ResolvedDestination

      try {
        const locality = key === 'work' || key === 'wife' ? 'Praha' : ''
        const { coordinates, rateLimited } = await geocodeDestination(query, locality)
        return { key, query, coordinates, rateLimited } satisfies ResolvedDestination
      } catch {
        return { key, query, coordinates: null } satisfies ResolvedDestination
      }
    }),
  )

  const pending = resolved.filter(
    (destination): destination is ResolvedDestination & { coordinates: Coordinates } =>
      !destination.cached && destination.coordinates !== null,
  )
  let matrix: Array<MapyMatrixResult | null> = []
  let matrixError: unknown = null

  if (pending.length) {
    try {
      matrix = await mapyMatrix(
        origin,
        pending.map((destination) => destination.coordinates),
        'car_fast_traffic',
      )
    } catch (error) {
      matrixError = error
    }
  }

  const matrixByKey = new Map<string, MapyMatrixResult | null>()
  pending.forEach((destination, index) => matrixByKey.set(destination.key, matrix[index] ?? null))

  for (const destination of resolved) {
    const { key, query, coordinates, cached, rateLimited } = destination
    if (cached) {
      routes[key] = cached
      continue
    }
    if (!coordinates) {
      routes[key] = unknownRoute
      warnings.push(
        rateLimited
          ? `Cíl „${query}" se nepodařilo najít – geokodér je dočasně přetížený.`
          : `Cíl „${query}" se nepodařilo najít na mapě.`,
      )
      continue
    }

    const result = matrixByKey.get(key)
    if (!result) {
      routes[key] = unknownRoute
      warnings.push(
        matrixError
          ? `Trasu k cíli „${query}": ${describeNetworkError(matrixError)}.`
          : `Trasu k cíli „${query}" se nepodařilo spočítat.`,
      )
      continue
    }

    const route = routeFromMapy(result)
    routes[key] = route
    routeCache.set(`mapy-car-v1:${origin.lat.toFixed(5)}:${origin.lon.toFixed(5)}->${query}`, route)
  }

  return { routes, warnings }
}
