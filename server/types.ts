export type Coordinates = {
  lat: number
  lon: number
}

export type ListingFact = {
  label: string
  value: string
}

export type Listing = {
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
  description: string
  facts: ListingFact[]
  address: string
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

export type CrimeReport = {
  count: number
  radiusKm: number
  month: string
  cases: CrimeCase[]
  sourceUrl: string
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

export type RouteResult = {
  car: string
  transit: string
  train: string
  distanceKm: number
}

export type FuelPrices = {
  'Natural 95': number
  Nafta: number
}

export const emptyAccess: AccessInfo = { transit: [], schools: [], shops: [] }

export const unknownRoute: RouteResult = { car: '—', transit: '—', train: '—', distanceKm: 0 }
