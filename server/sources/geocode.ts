import type { Coordinates } from '../types.js'
import { TtlCache, createSingleFlight } from '../lib/cache.js'
import { RateLimitedError, createLimiter, fetchJson, withRetry } from '../lib/net.js'
import { cleanText } from '../lib/text.js'

const nominatimLimiter = createLimiter(1100)
const geocodeCache = new TtlCache<Coordinates | null>(24 * 60 * 60 * 1000, 500)
const singleFlight = createSingleFlight()

export type GeocodeResult = {
  coordinates: Coordinates | null
  rateLimited: boolean
}

const lookup = async (query: string): Promise<Coordinates | null> => {
  const cached = geocodeCache.get(query)
  if (cached !== undefined) return cached

  const coordinates = await singleFlight(query, () =>
    nominatimLimiter(() =>
      withRetry(
        async () => {
          const url = new URL('https://nominatim.openstreetmap.org/search')
          url.searchParams.set('format', 'jsonv2')
          url.searchParams.set('limit', '1')
          url.searchParams.set('q', query)
          const results = await fetchJson<Array<{ lat?: string; lon?: string }>>(url, 12000)
          const first = results[0]
          return first?.lat && first.lon ? { lat: Number(first.lat), lon: Number(first.lon) } : null
        },
        2,
        800,
      ),
    ),
  )

  geocodeCache.set(query, coordinates)
  return coordinates
}

const dedupe = (candidates: string[]) => {
  const seen = new Set<string>()
  return candidates
    .map(cleanText)
    .filter((candidate) => candidate.length > 2 && !seen.has(candidate) && seen.add(candidate))
}

/** Scraped addresses are often too precise for the geocoder, so simpler variants follow. */
const addressCandidates = (address: string, municipality: string) => {
  const trimmed = cleanText(address)
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean)
  return dedupe([
    trimmed && `${trimmed}, Česko`,
    trimmed,
    parts.length > 1 ? `${parts.slice(1).join(', ')}, Česko` : '',
    municipality && municipality !== '—' ? `${municipality}, Česko` : '',
  ].filter(Boolean))
}

/** Route destinations are user-typed and may carry a `Label: address` prefix. */
const destinationCandidates = (query: string, locality = '') => {
  const trimmed = cleanText(query)
  const withoutLabel = trimmed.includes(':') ? trimmed.slice(trimmed.indexOf(':') + 1).trim() : ''
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean)
  const variants = [trimmed, withoutLabel, parts.slice(1).join(', '), parts.slice(-2).join(', ')]
  const candidates = variants.flatMap((variant) =>
    variant ? (/česk|czech/i.test(variant) ? [variant] : [variant, `${variant}, Česko`]) : [],
  )
  const contextual = locality
    ? variants.flatMap((variant) => (variant ? [`${variant}, ${locality}, Česko`] : []))
    : []
  return dedupe([...contextual, ...candidates])
}

const resolveFirst = async (candidates: string[]): Promise<GeocodeResult> => {
  let rateLimited = false
  for (const candidate of candidates) {
    try {
      const coordinates = await lookup(candidate)
      if (coordinates) return { coordinates, rateLimited: false }
    } catch (error) {
      if (error instanceof RateLimitedError) rateLimited = true
    }
  }
  return { coordinates: null, rateLimited }
}

export const geocodeAddress = (address: string, municipality: string) =>
  resolveFirst(addressCandidates(address, municipality))

export const geocodeDestination = (query: string, locality = '') =>
  resolveFirst(destinationCandidates(query, locality))
