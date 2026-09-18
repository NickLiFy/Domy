import type { ApiEnvelope, ApiResult } from '../types/api'

const inFlight = new Map<string, Promise<ApiResult<unknown>>>()

const failure = <T>(message: string, code = 'network_error'): ApiResult<T> => ({
  data: null,
  warnings: [],
  error: { code, message },
})

const toResult = <T>(envelope: Partial<ApiEnvelope<T>> | null): ApiResult<T> => ({
  data: envelope?.data ?? null,
  warnings: Array.isArray(envelope?.warnings) ? envelope.warnings : [],
  error: envelope?.error ?? null,
})

const send = async <T>(url: string): Promise<ApiResult<T>> => {
  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    return failure<T>('Server aplikace neodpovídá. Běží `npm run dev`?')
  }

  let envelope: Partial<ApiEnvelope<T>> | null = null
  try {
    envelope = (await response.json()) as Partial<ApiEnvelope<T>>
  } catch {
    return failure<T>(`Odpověď API nešla přečíst (HTTP ${response.status}).`, 'invalid_response')
  }

  const result = toResult<T>(envelope)
  if (!response.ok && !result.error) {
    return { ...result, error: { code: 'http_error', message: `API vrátilo HTTP ${response.status}.` } }
  }
  return result
}

/**
 * Always resolves to an envelope — callers decide what a missing `data` means. Identical
 * concurrent URLs share one request; an aborted caller therefore cannot cancel someone else's.
 */
export const requestApi = async <T>(url: string, signal?: AbortSignal): Promise<ApiResult<T>> => {
  if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')

  let request = inFlight.get(url) as Promise<ApiResult<T>> | undefined
  if (!request) {
    request = send<T>(url).finally(() => {
      if (inFlight.get(url) === request) inFlight.delete(url)
    })
    inFlight.set(url, request as Promise<ApiResult<unknown>>)
  }

  const result = await request
  if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
  return result
}

export const buildApiUrl = (path: string, params: Array<[string, string]>) => {
  const search = new URLSearchParams()
  for (const [name, value] of params) search.append(name, value)
  const query = search.toString()
  return query ? `${path}?${query}` : path
}
