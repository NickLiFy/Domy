import type { Coordinates } from '../types.js'

const earthRadiusKm = 6371
const walkingSpeedKmh = 4.8
const walkingDetourFactor = 1.25

export const haversineDistanceKm = (first: Coordinates, second: Coordinates) => {
  const radians = Math.PI / 180
  const latDelta = (second.lat - first.lat) * radians
  const lonDelta = (second.lon - first.lon) * radians
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(first.lat * radians) * Math.cos(second.lat * radians) * Math.sin(lonDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export const roundKm = (value: number) => Math.round(value * 10) / 10

export const estimateWalkMinutes = (distanceKm: number) =>
  Math.max(1, Math.round(((distanceKm * walkingDetourFactor) / walkingSpeedKmh) * 60))

export const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`
}

export const isValidCoordinates = (value: Coordinates) =>
  Number.isFinite(value.lat) &&
  Number.isFinite(value.lon) &&
  Math.abs(value.lat) <= 90 &&
  Math.abs(value.lon) <= 180

/** Bounding box in degrees around a point, used where an API takes a bbox instead of a radius. */
export const boundingBox = (center: Coordinates, radiusMeters: number) => {
  const latitudeDelta = radiusMeters / 111_320
  const longitudeDelta = latitudeDelta / Math.max(Math.cos((center.lat * Math.PI) / 180), 0.2)
  return {
    minLat: center.lat - latitudeDelta,
    maxLat: center.lat + latitudeDelta,
    minLon: center.lon - longitudeDelta,
    maxLon: center.lon + longitudeDelta,
  }
}
