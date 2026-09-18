import { load } from 'cheerio'
import type { AccessInfo, Coordinates, NearbyPlace } from '../types.js'
import { TtlCache } from '../lib/cache.js'
import { boundingBox, haversineDistanceKm, roundKm } from '../lib/geo.js'
import { createLimiter, describeNetworkError, fetchText, fetchWithTimeout, withRetry, withTimeout } from '../lib/net.js'
import { cleanText } from '../lib/text.js'
import { mapyMatrix } from './mapy.js'

type MapElement = {
  type?: string
  id?: number
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string>
}

// Tried in order; corporate networks sometimes block the main instance (406/hang).
const overpassEndpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const overpassLimiter = createLimiter(600)
const accessCache = new TtlCache<AccessInfo>(6 * 60 * 60 * 1000, 200)
const accessCacheVersion = 'osm-access-v2'
const walkRouteBatchSize = 10

type AccessCandidate = {
  group: keyof AccessInfo
  coordinates: Coordinates
  place: NearbyPlace
}

const elementCoordinates = (element: MapElement): Coordinates | null => {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lon: element.lon }
  }
  if (typeof element.center?.lat === 'number' && typeof element.center?.lon === 'number') {
    return { lat: element.center.lat, lon: element.center.lon }
  }
  return null
}

const categorise = (tags: Record<string, string>) => {
  if (tags.shop) return { group: 'shops' as const, fallbackName: 'Obchod' }
  if (tags.amenity === 'kindergarten') return { group: 'schools' as const, fallbackName: 'Mateřská škola' }
  if (tags.amenity === 'school') return { group: 'schools' as const, fallbackName: 'Škola' }
  if (tags.amenity === 'college' || tags.amenity === 'university') {
    return { group: 'schools' as const, fallbackName: 'Škola' }
  }
  if (
    tags.highway === 'bus_stop' ||
    tags.public_transport === 'platform' ||
    tags.public_transport === 'stop_position' ||
    tags.railway === 'tram_stop' ||
    tags.railway === 'platform'
  ) {
    return { group: 'transit' as const, fallbackName: 'Zastávka MHD' }
  }
  if (tags.railway === 'station' || tags.railway === 'halt') {
    return { group: 'transit' as const, fallbackName: 'Vlaková stanice' }
  }
  return null
}

const sourceUrlForElement = (element: MapElement, coordinates: Coordinates) => {
  const isOsmElement = element.type === 'node' || element.type === 'way' || element.type === 'relation'
  if (isOsmElement && Number.isInteger(element.id)) {
    return `https://www.openstreetmap.org/${element.type}/${element.id}`
  }

  const lat = coordinates.lat.toFixed(6)
  const lon = coordinates.lon.toFixed(6)
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=19/${lat}/${lon}`
}

const nearestUnique = (places: AccessCandidate[]) => {
  const seen = new Set<string>()
  return [...places]
    .sort((first, second) => first.place.distanceKm - second.place.distanceKm)
    .filter((place) => {
      const key = place.place.sourceUrl ?? `${place.place.name}:${place.coordinates.lat}:${place.coordinates.lon}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const buildAccessInfo = (elements: MapElement[], center: Coordinates) => {
  const groups: Record<keyof AccessInfo, AccessCandidate[]> = { transit: [], schools: [], shops: [] }

  for (const element of elements) {
    const coordinates = elementCoordinates(element)
    const tags = element.tags ?? {}
    const isInactive =
      tags.disused === 'yes' ||
      tags.abandoned === 'yes' ||
      tags.shop === 'vacant' ||
      Boolean(tags['disused:shop']) ||
      Boolean(tags['abandoned:shop'])
    const category = coordinates ? categorise(tags) : null
    if (!coordinates || !category || isInactive) continue

    const distanceKm = roundKm(haversineDistanceKm(center, coordinates))
    groups[category.group].push({
      group: category.group,
      coordinates,
      place: {
        name: cleanText(tags.name) || category.fallbackName,
        distanceKm,
        coordinates,
        sourceUrl: sourceUrlForElement(element, coordinates),
      },
    })
  }

  return groups
}

const asAccessInfo = (groups: Record<keyof AccessInfo, AccessCandidate[]>): AccessInfo => ({
  transit: nearestUnique(groups.transit).map(({ place }) => place),
  schools: nearestUnique(groups.schools).map(({ place }) => place),
  shops: nearestUnique(groups.shops).map(({ place }) => place),
})

const enrichWalkRoutes = async (groups: Record<keyof AccessInfo, AccessCandidate[]>, center: Coordinates) => {
  const candidates = (Object.keys(groups) as Array<keyof AccessInfo>).flatMap((group) => groups[group])
  if (!candidates.length) return { access: asAccessInfo(groups), warning: null }

  try {
    let incomplete = false
    for (let start = 0; start < candidates.length; start += walkRouteBatchSize) {
      const batch = candidates.slice(start, start + walkRouteBatchSize)
      const matrix = await mapyMatrix(
        center,
        batch.map((candidate) => candidate.coordinates),
        'foot_fast',
      )
      batch.forEach((candidate, index) => {
        const result = matrix[index]
        if (!result) {
          incomplete = true
          return
        }
        candidate.place.distanceKm = roundKm(result.length / 1000)
        candidate.place.walkMinutes = Math.max(1, Math.round(result.duration / 60))
      })
    }
    return {
      access: asAccessInfo(groups),
      warning: incomplete ? 'Pěší trasa nebyla dostupná ke všem místům v okolí.' : null,
    }
  } catch (error) {
    return { access: asAccessInfo(groups), warning: `Pěší dostupnost přes Mapy.com není dostupná – ${describeNetworkError(error)}.` }
  }
}

const overpassQuery = (center: Coordinates, radiusMeters: number) => {
  const around = `around:${radiusMeters},${center.lat},${center.lon}`
  return `
    [out:json][timeout:20];
    (
      node["highway"="bus_stop"](${around});
      way["highway"="bus_stop"](${around});
      node["public_transport"="platform"](${around});
      way["public_transport"="platform"](${around});
      node["public_transport"="stop_position"](${around});
      way["public_transport"="stop_position"](${around});
      node["railway"="tram_stop"](${around});
      way["railway"="tram_stop"](${around});
      node["railway"="platform"](${around});
      way["railway"="platform"](${around});
      node["railway"="station"](${around});
      way["railway"="station"](${around});
      node["railway"="halt"](${around});
      way["railway"="halt"](${around});
      node["amenity"="kindergarten"](${around});
      way["amenity"="kindergarten"](${around});
      node["amenity"="school"](${around});
      way["amenity"="school"](${around});
      node["amenity"="college"](${around});
      way["amenity"="college"](${around});
      node["amenity"="university"](${around});
      way["amenity"="university"](${around});
      node["shop"](${around});
      way["shop"](${around});
    );
    out center tags;
  `.trim()
}

const queryOverpass = async (query: string) => {
  let lastError: unknown
  for (const endpoint of overpassEndpoints) {
    try {
      return await overpassLimiter(() =>
        withRetry(
          async () => {
            const response = await fetchWithTimeout(
              endpoint,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
                body: `data=${encodeURIComponent(query)}`,
              },
              7000,
            )
            if (!response.ok) throw new Error(`Overpass API returned ${response.status}`)
            return (await response.json()) as { elements?: MapElement[] }
          },
          1,
          600,
        ),
      )
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Overpass API unavailable')
}

/** Raw OSM map data works where Overpass is blocked; it needs way centroids computed locally. */
const queryOsmMap = async (center: Coordinates, radiusMeters: number) => {
  const box = boundingBox(center, radiusMeters)
  const mapUrl = new URL('https://api.openstreetmap.org/api/0.6/map')
  mapUrl.searchParams.set('bbox', [box.minLon, box.minLat, box.maxLon, box.maxLat].join(','))

  const document = load(await fetchText(mapUrl, 'application/xml', 15000), { xmlMode: true })
  const nodeCoordinates = new Map<string, Coordinates>()
  const elements: MapElement[] = []

  document('node').each((_, element) => {
    const node = document(element)
    const id = node.attr('id')
    const lat = Number(node.attr('lat'))
    const lon = Number(node.attr('lon'))
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) return
    nodeCoordinates.set(id, { lat, lon })

    const tags: Record<string, string> = {}
    node.children('tag').each((_, tag) => {
      const key = document(tag).attr('k')
      const value = document(tag).attr('v')
      if (key && value) tags[key] = value
    })
    if (Object.keys(tags).length) elements.push({ type: 'node', id: Number(id), lat, lon, tags })
  })

  document('way').each((_, element) => {
    const way = document(element)
    const points: Coordinates[] = []
    way.children('nd').each((_, node) => {
      const reference = document(node).attr('ref')
      const point = reference ? nodeCoordinates.get(reference) : undefined
      if (point) points.push(point)
    })
    if (!points.length) return

    const tags: Record<string, string> = {}
    way.children('tag').each((_, tag) => {
      const key = document(tag).attr('k')
      const value = document(tag).attr('v')
      if (key && value) tags[key] = value
    })
    if (!Object.keys(tags).length) return

    elements.push({
      type: 'way',
      id: Number(way.attr('id')),
      center: {
        lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
        lon: points.reduce((sum, point) => sum + point.lon, 0) / points.length,
      },
      tags,
    })
  })

  const radiusKm = radiusMeters / 1000
  return elements.filter((element) => {
    const coordinates = elementCoordinates(element)
    return coordinates ? haversineDistanceKm(center, coordinates) <= radiusKm : false
  })
}

export type AccessOutcome = {
  access: AccessInfo | null
  warnings: string[]
}

export const getNearbyAccess = async (center: Coordinates, radiusMeters: number): Promise<AccessOutcome> => {
  const cacheKey = `${accessCacheVersion}:${center.lat.toFixed(4)}:${center.lon.toFixed(4)}:${radiusMeters}`
  const cached = accessCache.get(cacheKey)
  if (cached) return { access: cached, warnings: [] }

  const attempts: Array<() => Promise<MapElement[]>> = [
    async () => (await withTimeout(queryOverpass(overpassQuery(center, radiusMeters)), 8000, 'Overpass neodpověděl včas')).elements ?? [],
    () => withTimeout(queryOsmMap(center, radiusMeters), 15000, 'OpenStreetMap neodpověděl včas'),
  ]

  const failures: string[] = []
  for (const attempt of attempts) {
    try {
      const groups = buildAccessInfo(await attempt(), center)
      const enriched = await enrichWalkRoutes(groups, center)
      accessCache.set(cacheKey, enriched.access)
      return { access: enriched.access, warnings: enriched.warning ? [enriched.warning] : [] }
    } catch (error) {
      failures.push(describeNetworkError(error))
    }
  }

  return {
    access: null,
    warnings: [`Okolní místa z OpenStreetMap nejsou dostupná – ${failures.join('; ')}.`],
  }
}
