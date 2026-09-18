import type { Coordinates, CrimeReport, FuelPrices, Listing, RouteResult } from './types.js'
import {
  badRequest,
  degraded,
  methodNotAllowed,
  notFound,
  ok,
  readCoordinates,
  readNumber,
  type ApiResponse,
} from './lib/http.js'
import { describeNetworkError } from './lib/net.js'
import { getNearbyAccess } from './sources/access.js'
import { getCrimeReport } from './sources/crime.js'
import { getFuelPrices } from './sources/fuel.js'
import { fetchListing, parseListingUrl } from './sources/listing.js'
import { geocodeAddress } from './sources/geocode.js'
import { getRoutes, maxDestinations, type RouteRequest } from './sources/routes.js'

export type RouteContext = {
  params: URLSearchParams
}

type RouteHandler = (context: RouteContext) => Promise<ApiResponse<unknown>>

const handleListing: RouteHandler = async ({ params }) => {
  const listingUrl = parseListingUrl(params.get('url') ?? '')
  if (!listingUrl) return badRequest('Použijte přímý odkaz na detail z www.eurobydleni.cz.')

  let listing: Listing
  try {
    listing = await fetchListing(listingUrl)
  } catch (error) {
    return degraded<{ listing: Listing; coordinates: Coordinates | null }>(null, {
      code: 'listing_unavailable',
      message: `Nabídku se nepodařilo načíst – ${describeNetworkError(error)}.`,
    })
  }

  const { coordinates, rateLimited } = await geocodeAddress(listing.address, listing.municipality)
  const warnings = coordinates
    ? []
    : [
        rateLimited
          ? 'Souřadnice se nepodařilo načíst – geokodér Nominatim dočasně odmítá požadavky. Zkuste obnovit za chvíli.'
          : 'Adresu z nabídky se nepodařilo najít na mapě, proto chybí okolí, kriminalita i dojezdy.',
      ]

  return ok({ listing, coordinates }, warnings)
}

const handleSafety: RouteHandler = async ({ params }) => {
  const coordinates = readCoordinates(params)
  if (!coordinates) return badRequest('Neplatné souřadnice domu.')

  const radiusKm = readNumber(params, 'radiusKm', 3, 0.5, 20)
  const { report, warnings } = await getCrimeReport(coordinates, radiusKm)

  return report
    ? ok<{ crime: CrimeReport | null }>({ crime: report }, warnings)
    : degraded<{ crime: CrimeReport | null }>(
        { crime: null },
        { code: 'crime_unavailable', message: warnings[0] ?? 'Data o kriminalitě nejsou dostupná.' },
        warnings,
      )
}

const handleAccess: RouteHandler = async ({ params }) => {
  const coordinates = readCoordinates(params)
  if (!coordinates) return badRequest('Neplatné souřadnice domu.')

  const radiusMeters = readNumber(params, 'radiusM', 1500, 200, 5000)
  const { access, warnings } = await getNearbyAccess(coordinates, radiusMeters)
  const payload = { access, snapshotAt: new Date().toISOString() }

  return warnings.length
    ? degraded<typeof payload>(
        payload,
        { code: 'access_unavailable', message: warnings[0] },
        warnings,
      )
    : ok<typeof payload>(payload)
}

/** Destinations arrive as repeated `to=key:query` pairs — no JSON blob inside a query string. */
const readDestinations = (params: URLSearchParams): RouteRequest[] | null => {
  const destinations: RouteRequest[] = []
  const seen = new Set<string>()

  for (const entry of params.getAll('to')) {
    const separator = entry.indexOf(':')
    if (separator <= 0) return null
    const key = entry.slice(0, separator).trim()
    const query = entry.slice(separator + 1).trim()
    if (!key || !query || query.length > 200 || seen.has(key)) return null
    seen.add(key)
    destinations.push({ key, query })
  }

  return destinations.length > maxDestinations ? null : destinations
}

const handleRoutes: RouteHandler = async ({ params }) => {
  const origin = readCoordinates(params)
  if (!origin) return badRequest('Neplatný počátek trasy.')

  const destinations = readDestinations(params)
  if (!destinations) return badRequest(`Cíle musí být ve tvaru to=klíč:adresa, nejvýše ${maxDestinations}.`)
  if (!destinations.length) return ok<{ routes: Record<string, RouteResult> }>({ routes: {} })

  const { routes, warnings } = await getRoutes(origin, destinations)
  return ok<{ routes: Record<string, RouteResult> }>({ routes }, warnings)
}

const handleFuel: RouteHandler = async () => {
  const { prices, warnings } = await getFuelPrices()
  return prices
    ? ok<{ prices: FuelPrices | null }>({ prices })
    : degraded<{ prices: FuelPrices | null }>(
        { prices: null },
        { code: 'fuel_unavailable', message: warnings[0] ?? 'Cena paliva není dostupná.' },
        warnings,
      )
}

const routeTable: Record<string, Record<string, RouteHandler>> = {
  '/api/listing': { GET: handleListing },
  '/api/safety': { GET: handleSafety },
  '/api/access': { GET: handleAccess },
  '/api/routes': { GET: handleRoutes },
  '/api/fuel': { GET: handleFuel },
}

export const apiPathPrefix = '/api/'

export const resolveApiRoute = async (
  method: string,
  pathname: string,
  params: URLSearchParams,
): Promise<ApiResponse<unknown>> => {
  const handlers = routeTable[pathname.replace(/\/+$/, '') || pathname]
  if (!handlers) return notFound(`Endpoint ${pathname} neexistuje.`)

  const handler = handlers[method]
  if (!handler) return methodNotAllowed(Object.keys(handlers))

  try {
    return await handler({ params })
  } catch (error) {
    // A handler throwing is a bug, not an upstream outage — still answer in the envelope shape.
    return degraded(null, { code: 'internal_error', message: describeNetworkError(error) })
  }
}
