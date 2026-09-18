import type { Coordinates } from '../types.js'
import { fetchWithTimeout } from '../lib/net.js'
import { mapyApiKey } from '../config.js'

export type MapyRouteType = 'car_fast_traffic' | 'foot_fast'

export type MapyMatrixResult = {
  length: number
  duration: number
}

type MapyMatrixResponse = {
  matrix?: Array<Array<{ length?: number; duration?: number }>>
}

const coordinateParam = (coordinates: Coordinates) => `${coordinates.lon},${coordinates.lat}`

/** One matrix request handles all destinations for one transport mode. */
export const mapyMatrix = async (
  origin: Coordinates,
  destinations: Coordinates[],
  routeType: MapyRouteType,
): Promise<Array<MapyMatrixResult | null>> => {
  if (!destinations.length) return []
  if (!mapyApiKey) throw new Error('Mapy API klíč není nastavený.')

  const url = new URL('https://api.mapy.com/v1/routing/matrix-m')
  url.searchParams.set('routeType', routeType)
  url.searchParams.set('lang', 'cs')
  url.searchParams.append('starts', coordinateParam(origin))
  for (const destination of destinations) url.searchParams.append('ends', coordinateParam(destination))

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: 'application/json',
        'X-MAPY-API-KEY': mapyApiKey,
      },
    },
    15000,
  )
  if (!response.ok) throw new Error(`Mapy API returned ${response.status}`)

  const payload = (await response.json()) as MapyMatrixResponse
  const row = payload.matrix?.[0]
  if (!row || row.length !== destinations.length) throw new Error('Mapy API vrátilo neúplnou matici tras.')

  return row.map((result) => {
    if (
      typeof result.length !== 'number' ||
      typeof result.duration !== 'number' ||
      result.length < 0 ||
      result.duration < 0
    ) {
      return null
    }
    return { length: result.length, duration: result.duration }
  })
}