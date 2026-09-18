import type { AccessInfo, Coordinates, CrimeData, FuelType, ListingFact, RouteKey } from './home'

export type ApiError = {
  code: string
  message: string
}

/** Mirrors the server envelope: there is always a body, even when the upstream source failed. */
export type ApiEnvelope<T> = {
  data: T | null
  warnings: string[]
  error?: ApiError
}

export type ApiResult<T> = {
  data: T | null
  warnings: string[]
  error: ApiError | null
}

export type ApiListing = {
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

export type ListingPayload = {
  listing: ApiListing
  coordinates: Coordinates | null
}

export type SafetyPayload = {
  crime: CrimeData | null
}

export type AccessPayload = {
  access: AccessInfo | null
  snapshotAt?: string
}

export type FuelPayload = {
  prices: Record<FuelType, number> | null
}

export type ApiRoute = {
  car: string
  transit: string
  train: string
  distanceKm: number
}

export type RoutesPayload = {
  routes: Partial<Record<RouteKey, ApiRoute>>
}
