export type FuelType = 'Natural 95' | 'Nafta'
export type WeightKey = 'commute' | 'safety' | 'price' | 'access'
export type RouteKey = 'work' | 'wife' | 'prague' | 'center' | 'sapa'
export type AddressSettings = Record<RouteKey, string>
export type Weights = Record<WeightKey, number>

export type HomeDataStatus = 'idle' | 'loading' | 'ready' | 'error'
export type RefreshSource = 'listing' | 'safety' | 'access' | 'routes' | 'fuel'
export type HomeRefreshSource = Exclude<RefreshSource, 'fuel'>
export type RemovalAction = 'archive' | 'delete'

export type Coordinates = {
  lat: number
  lon: number
}

export type ListingFact = {
  label: string
  value: string
}

export type Journey = {
  car: string
  transit: string
  train: string
}

export type NearbyPlace = {
  name: string
  distanceKm: number
  walkMinutes?: number
  coordinates?: Coordinates
  sourceUrl?: string
}

export type AccessInfo = {
  transit: NearbyPlace[]
  schools: NearbyPlace[]
  shops: NearbyPlace[]
}

export type CrimeCase = {
  id: number
  date: string
  state: number
  stateLabel: string
  typeLabels: string[]
  description: string
  distanceKm: number
}

export type CrimeData = {
  count: number
  radiusKm: number
  month: string
  cases: CrimeCase[]
  sourceUrl: string
}

export type SafetySummary = {
  level: string
  detail: string
  percentile: number
  metricMax?: number
  metricUnit?: string
  count?: number
}

export type DataSource = {
  label: string
  url: string
  note?: string
}

export type HomeSources = Partial<Record<'listing' | 'safety' | 'distance' | 'access', DataSource>>

export type Home = {
  id: string
  title: string
  location: string
  municipality: string
  price: number
  area: number
  plot: number
  rooms: string
  year: number
  status: string
  images: string[]
  aiImages: string[]
  coverSelection: number[]
  coverMain: number
  routes: Record<RouteKey, Journey>
  pragueKm: number
  access: AccessInfo
  safety: SafetySummary
  description: string
  listingUrl: string
  address?: string
  sources?: HomeSources
  verifiedAt?: string
  facts?: ListingFact[]
  coordinates?: Coordinates | null
  crime?: CrimeData | null
  dataStatus?: HomeDataStatus
  dataError?: string
  dataWarnings?: string[]
  warningsBySource?: Partial<Record<HomeRefreshSource, string[]>>
  routeDistances?: Record<RouteKey, number>
  routesKey?: string
  routeAddresses?: AddressSettings
  routesFrozenAt?: string
  routesSnapshotVersion?: string
  accessSnapshotAt?: string
  accessSnapshotVersion?: string
}

export const emptyAccess: AccessInfo = { transit: [], schools: [], shops: [] }

export const unknownJourney: Journey = { car: '—', transit: '—', train: '—' }
