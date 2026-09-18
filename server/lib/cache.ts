import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Entry<T> = {
  value: T
  expiresAt: number
}

/** Bounded, TTL-based memory cache; the previous unbounded Maps never evicted anything. */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>()
  private readonly ttlMs: number
  private readonly maxEntries: number

  constructor(ttlMs: number, maxEntries = 500) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key)
      return undefined
    }
    // Refresh insertion order so the map stays roughly least-recently-used.
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: T) {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey !== undefined) this.entries.delete(oldestKey)
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }
}

/** Collapses concurrent calls for the same key into one upstream request. */
export const createSingleFlight = () => {
  const pending = new Map<string, Promise<unknown>>()
  return <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const existing = pending.get(key) as Promise<T> | undefined
    if (existing) return existing
    const request = task().finally(() => {
      if (pending.get(key) === request) pending.delete(key)
    })
    pending.set(key, request)
    return request
  }
}

const snapshotDirectory = path.resolve(process.cwd(), '.cache')

const snapshotPath = (name: string) => path.join(snapshotDirectory, `${name.replace(/[^\w.-]/g, '_')}.json`)

export const readSnapshot = async <T>(name: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(snapshotPath(name), 'utf8')) as T
  } catch {
    return null
  }
}

export const writeSnapshot = async (name: string, value: unknown) => {
  const target = snapshotPath(name)
  try {
    await mkdir(snapshotDirectory, { recursive: true })
    // Write-then-rename so a crashed download never leaves a truncated snapshot behind.
    const temporary = `${target}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(value), 'utf8')
    await rename(temporary, target)
  } catch {
    // A missing snapshot only costs one extra download next time.
  }
}
