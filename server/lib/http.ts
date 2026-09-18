import type { ServerResponse } from 'node:http'
import type { Coordinates } from '../types.js'
import { isValidCoordinates } from './geo.js'

export type ApiError = {
  code: string
  message: string
}

/**
 * Every endpoint answers with this shape, including failures, so the client always has
 * something renderable and can show `error`/`warnings` next to whatever it already had.
 */
export type ApiEnvelope<T> = {
  data: T | null
  warnings: string[]
  error?: ApiError
}

export type ApiResponse<T> = {
  status: number
  body: ApiEnvelope<T>
}

export const ok = <T>(data: T, warnings: string[] = []): ApiResponse<T> => ({
  status: 200,
  body: { data, warnings },
})

/** Upstream failed but the request itself was fine — the client keeps its cached data. */
export const degraded = <T>(
  data: T | null,
  error: ApiError,
  warnings: string[] = [],
): ApiResponse<T> => ({
  status: 200,
  body: { data, warnings, error },
})

export const badRequest = (message: string, code = 'bad_request'): ApiResponse<never> => ({
  status: 400,
  body: { data: null, warnings: [], error: { code, message } },
})

export const notFound = (message: string): ApiResponse<never> => ({
  status: 404,
  body: { data: null, warnings: [], error: { code: 'not_found', message } },
})

export const methodNotAllowed = (allowed: string[]): ApiResponse<never> => ({
  status: 405,
  body: {
    data: null,
    warnings: [],
    error: { code: 'method_not_allowed', message: `Povolené metody: ${allowed.join(', ')}.` },
  },
})

export const sendApiResponse = (response: ServerResponse, result: ApiResponse<unknown>) => {
  response.statusCode = result.status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(result.body))
}

export const readCoordinates = (params: URLSearchParams): Coordinates | null => {
  const coordinates = { lat: Number(params.get('lat')), lon: Number(params.get('lon')) }
  return isValidCoordinates(coordinates) ? coordinates : null
}

export const readNumber = (
  params: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number,
) => {
  const raw = params.get(name)
  if (raw === null) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}
