export const userAgent = 'domy-live-data/1.0 (local property research tool)'

/** Thrown for HTTP 429 so callers can honour Retry-After instead of guessing a backoff. */
export class RateLimitedError extends Error {
  readonly retryAfterMs: number

  constructor(message: string, retryAfterMs: number) {
    super(message)
    this.name = 'RateLimitedError'
    this.retryAfterMs = retryAfterMs
  }
}

const parseRetryAfterMs = (response: Response) => {
  const header = response.headers.get('retry-after')
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const dateMs = Date.parse(header)
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Serialises tasks with a minimum gap; Nominatim's policy forbids parallel requests. */
export const createLimiter = (minIntervalMs: number) => {
  let chain = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(async () => {
      const result = await task()
      await sleep(minIntervalMs)
      return result
    })
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}

export const withRetry = async <T>(task: () => Promise<T>, attempts = 2, delayMs = 400): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt >= attempts) break
      await sleep(error instanceof RateLimitedError ? error.retryAfterMs : delayMs * (attempt + 1))
    }
  }
  throw lastError
}

export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export const fetchWithTimeout = async (input: string | URL, init: RequestInit = {}, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: { 'User-Agent': userAgent, ...init.headers },
    })
    if (response.status === 429) {
      throw new RateLimitedError(`${new URL(input).host} returned 429`, parseRetryAfterMs(response) ?? 2000)
    }
    return response
  } finally {
    clearTimeout(timeout)
  }
}

export const fetchJson = async <T>(input: string | URL, timeoutMs = 15000): Promise<T> => {
  const response = await fetchWithTimeout(input, { headers: { Accept: 'application/json' } }, timeoutMs)
  if (!response.ok) throw new Error(`${new URL(input).host} returned ${response.status}`)
  return (await response.json()) as T
}

export const fetchText = async (input: string | URL, accept: string, timeoutMs = 15000) => {
  const response = await fetchWithTimeout(input, { headers: { Accept: accept } }, timeoutMs)
  if (!response.ok) throw new Error(`${new URL(input).host} returned ${response.status}`)
  return response.text()
}

export const describeNetworkError = (error: unknown) => {
  if (error instanceof RateLimitedError) return 'zdroj je dočasně přetížený (429)'
  if (error instanceof Error) {
    if (/abort|timed out|trvá/i.test(error.message)) return 'zdroj neodpověděl včas'
    if (/406/.test(error.message)) return 'zdroj v této síti odmítl požadavek (406)'
    return error.message
  }
  return 'neznámá chyba zdroje'
}
