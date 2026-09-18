import { routeKeys } from '../config/app'
import type { Home, Journey, Weights } from '../types/home'
import { durationInMinutes } from './format'

export const bestRouteMinutes = (journey: Journey) =>
  Math.min(durationInMinutes(journey.car), durationInMinutes(journey.train))

const clampScore = (value: number) => Math.max(0, Math.min(10, value))

/** 15 min or less is a perfect 10, 90+ min trails to 0. */
const commuteScore = (home: Home) => {
  const minutes = routeKeys.map((key) => bestRouteMinutes(home.routes[key])).filter(Number.isFinite)
  if (!minutes.length) return 0
  const average = minutes.reduce((sum, value) => sum + value, 0) / minutes.length
  return clampScore(10 - ((average - 15) / 75) * 10)
}

/** 0 recorded cases nearby is a perfect 10, 40+ trails to 0. */
const safetyScore = (home: Home) => (home.crime ? clampScore(10 - (home.crime.count / 40) * 10) : 0)

/** Based on the nearest transit stop, school and shop found on the map, not on the description. */
const accessScore = (home: Home) => {
  const distances = [
    home.access.transit.find((place) => typeof place.walkMinutes === 'number')?.distanceKm,
    home.access.schools.find((place) => typeof place.walkMinutes === 'number')?.distanceKm,
    home.access.shops.find((place) => typeof place.walkMinutes === 'number')?.distanceKm,
  ].filter((distance): distance is number => typeof distance === 'number')
  if (!distances.length) return 0
  const average = distances.reduce((sum, distance) => sum + distance, 0) / distances.length
  return clampScore(10 - (average / 2) * 10)
}

/** Relative to the other homes currently being compared. */
const priceScore = (home: Home, referenceHomes: Home[]) => {
  const prices = referenceHomes.filter((item) => item.price > 0).map((item) => item.price)
  if (home.price <= 0 || !prices.length) return 0
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (max === min) return 10
  return clampScore(10 - ((home.price - min) / (max - min)) * 10)
}

export const homeMetrics = (home: Home, referenceHomes: Home[]) => ({
  commute: commuteScore(home),
  safety: safetyScore(home),
  price: priceScore(home, referenceHomes),
  access: accessScore(home),
})

export const scoreFor = (home: Home, weights: Weights, referenceHomes: Home[]) => {
  const metrics = homeMetrics(home, referenceHomes)
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0)
  if (!totalWeight) return 0
  const weighted =
    metrics.commute * weights.commute +
    metrics.safety * weights.safety +
    metrics.price * weights.price +
    metrics.access * weights.access
  return weighted / totalWeight
}

export const scoreEmoji = (score: number) => {
  if (score >= 8.5) return '🤩'
  if (score >= 7.5) return '🙂'
  if (score >= 6.5) return '😌'
  return '🤔'
}

export const scoreLabel = (score: number) => {
  if (score >= 8.5) return 'Výborná shoda'
  if (score >= 7.5) return 'Silný kandidát'
  if (score >= 6.5) return 'Stojí za prověření'
  return 'Více kompromisů'
}
