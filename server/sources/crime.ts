import type { CrimeCase, CrimeReport, Coordinates } from '../types.js'
import { createSingleFlight, readSnapshot, writeSnapshot } from '../lib/cache.js'
import { fetchJson } from '../lib/net.js'
import { haversineDistanceKm, roundKm } from '../lib/geo.js'

const apiUrl = 'https://kriminalita.policie.gov.cz/api/v2/'
const snapshotName = 'police-crime'
const refreshIntervalMs = 12 * 60 * 60 * 1000

type CrimePoint = {
  id: number
  date: string
  state: number
  types: number[]
  lat: number
  lon: number
}

type CrimeDataset = {
  month: string
  fetchedAt: number
  points: CrimePoint[]
  typeLabels: Record<string, string>
  stateLabels: Record<string, string>
}

type DownloadsResponse = { data?: Array<{ name?: string }> }
type ListsResponse = {
  data?: {
    types?: Array<{ id?: number; label?: string }>
    states?: Array<{ id?: number; label?: string }>
  }
}
type CrimeGeoJson = {
  features?: Array<{
    geometry?: { coordinates?: [number, number] }
    properties?: { id?: number; date?: string; state?: number; types?: number[] }
  }>
}

const singleFlight = createSingleFlight()

let dataset: CrimeDataset | null = null
let snapshotLoaded = false

const toLabelMap = (items: Array<{ id?: number; label?: string }> = []) =>
  Object.fromEntries(
    items.filter((item) => typeof item.id === 'number').map((item) => [String(item.id), item.label ?? 'Neurčeno']),
  )

const downloadDataset = async (): Promise<CrimeDataset> => {
  const downloads = await fetchJson<DownloadsResponse>(`${apiUrl}downloads`, 15000)
  const month = (downloads.data ?? [])
    .map((item) => item.name ?? '')
    .filter((name) => /^\d{6}$/.test(name))
    .sort()
    .at(-1)
  if (!month) throw new Error('Police API nevrátilo žádný měsíc ke stažení.')

  const [geoJson, lists] = await Promise.all([
    fetchJson<CrimeGeoJson>(`${apiUrl}downloads/${month}.geojson`, 120000),
    fetchJson<ListsResponse>(`${apiUrl}lists`, 15000),
  ])

  // Only the five fields actually used are kept; the raw GeoJSON is an order of magnitude bigger.
  const points: CrimePoint[] = []
  for (const feature of geoJson.features ?? []) {
    const [lon, lat] = feature.geometry?.coordinates ?? []
    const properties = feature.properties
    if (!properties?.id || typeof lat !== 'number' || typeof lon !== 'number') continue
    points.push({
      id: properties.id,
      date: properties.date ?? '',
      state: properties.state ?? 0,
      types: properties.types ?? [],
      lat,
      lon,
    })
  }

  return {
    month,
    fetchedAt: Date.now(),
    points,
    typeLabels: toLabelMap(lists.data?.types),
    stateLabels: toLabelMap(lists.data?.states),
  }
}

const refreshDataset = () =>
  singleFlight('crime-dataset', async () => {
    const downloaded = await downloadDataset()
    dataset = downloaded
    await writeSnapshot(snapshotName, downloaded)
    return downloaded
  })

const loadFromSnapshot = async () => {
  if (snapshotLoaded) return dataset
  snapshotLoaded = true
  dataset ??= await readSnapshot<CrimeDataset>(snapshotName)
  return dataset
}

const buildReport = (source: CrimeDataset, center: Coordinates, radiusKm: number): CrimeReport => {
  const cases: CrimeCase[] = []

  for (const point of source.points) {
    const distanceKm = haversineDistanceKm(center, point)
    if (distanceKm > radiusKm) continue
    const typeLabels = point.types.map((typeId) => source.typeLabels[String(typeId)] ?? `Typ ${typeId}`)
    cases.push({
      id: point.id,
      date: point.date,
      state: point.state,
      stateLabel: source.stateLabels[String(point.state)] ?? 'Stav neuveden',
      typeLabels,
      description: typeLabels.length ? typeLabels.join(', ') : 'Typ případu nebyl uveden.',
      distanceKm: roundKm(distanceKm),
    })
  }

  cases.sort((first, second) => first.date.localeCompare(second.date))

  return {
    count: cases.length,
    radiusKm,
    month: source.month,
    cases,
    sourceUrl: `${apiUrl}downloads/${source.month}.geojson`,
  }
}

export type CrimeOutcome = {
  report: CrimeReport | null
  warnings: string[]
}

export const getCrimeReport = async (
  center: Coordinates,
  radiusKm: number,
  waitMs = 8000,
): Promise<CrimeOutcome> => {
  const cached = await loadFromSnapshot()
  const isStale = !cached || Date.now() - cached.fetchedAt > refreshIntervalMs

  if (cached && !isStale) return { report: buildReport(cached, center, radiusKm), warnings: [] }

  const refresh = refreshDataset()
  if (cached) {
    // Serve the snapshot immediately; the newer month lands in the next request.
    refresh.catch(() => undefined)
    return { report: buildReport(cached, center, radiusKm), warnings: [] }
  }

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), waitMs),
    )
    const downloaded = await Promise.race([refresh, timeout])
    return { report: buildReport(downloaded, center, radiusKm), warnings: [] }
  } catch (error) {
    refresh.catch(() => undefined)
    const message =
      error instanceof Error && error.message === 'timeout'
        ? 'Data Policie ČR se právě stahují na pozadí – zkuste obnovit kriminalitu za chvíli.'
        : 'Data Policie ČR se nepodařilo načíst z veřejného API.'
    return { report: null, warnings: [message] }
  }
}
