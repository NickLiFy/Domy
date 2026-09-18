import {
  addressSettingsVersion,
  defaultAddressSettings,
  eurobydleniListingUrl,
  fuelDefaults,
  isSupportedListingUrl,
} from '../config/app'
import type { AddressSettings, FuelType, Home } from '../types/home'
import { createPendingHome, normalizeSavedHome } from './home'

const keys = {
  homes: 'domy-homes',
  archivedHomes: 'domy-archived-homes',
  addressSettings: 'domy-address-settings',
  addressSettingsVersion: 'domy-address-settings-version',
  fuelPrices: 'domy-fuel-prices',
  coverSettings: 'domy-cover-settings',
} as const

/** Crime cases are the bulkiest part of a home; keeping them all overflowed the storage quota. */
const persistedCaseLimit = 50

const readJson = <T>(key: string): T | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const writeJson = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage being full or blocked must never break the running session.
  }
}

const normalizeHomes = (homes: Home[]) =>
  homes.filter((home) => isSupportedListingUrl(home.listingUrl)).map(normalizeSavedHome)

const trimForStorage = (home: Home): Home =>
  home.crime && home.crime.cases.length > persistedCaseLimit
    ? { ...home, crime: { ...home.crime, cases: home.crime.cases.slice(0, persistedCaseLimit) } }
    : home

export const loadHomes = (): Home[] => {
  const defaults = () => [createPendingHome(eurobydleniListingUrl)]
  const saved = readJson<Home[]>(keys.homes)
  if (Array.isArray(saved) && saved.length) {
    const normalized = normalizeHomes(saved)
    if (normalized.length) return normalized
  }

  const coverSettings = readJson<Record<string, { coverSelection?: number[]; coverMain?: number }>>(
    keys.coverSettings,
  )
  return defaults().map((home) => ({ ...home, ...(coverSettings?.[home.id] ?? {}) }))
}

export const loadArchivedHomes = (): Home[] => {
  const saved = readJson<Home[]>(keys.archivedHomes)
  return Array.isArray(saved) ? normalizeHomes(saved) : []
}

export const loadAddressSettings = (): AddressSettings => {
  const saved = readJson<Partial<AddressSettings>>(keys.addressSettings) ?? {}
  const version = readJson<string>(keys.addressSettingsVersion)
  const migrated =
    version === addressSettingsVersion
      ? saved
      : {
          ...saved,
          work: saved.work?.trim() ? saved.work : defaultAddressSettings.work,
          wife: saved.wife?.trim() ? saved.wife : defaultAddressSettings.wife,
        }

  return { ...defaultAddressSettings, ...migrated }
}

export const loadFuelPrices = (): Record<FuelType, number> => {
  const saved = readJson<Partial<Record<FuelType, number>>>(keys.fuelPrices)
  if (typeof saved?.['Natural 95'] !== 'number' || typeof saved.Nafta !== 'number') return fuelDefaults
  return { 'Natural 95': saved['Natural 95'], Nafta: saved.Nafta }
}

export const saveHomes = (homes: Home[]) => writeJson(keys.homes, homes.map(trimForStorage))

export const saveArchivedHomes = (homes: Home[]) => writeJson(keys.archivedHomes, homes.map(trimForStorage))

export const saveAddressSettings = (settings: AddressSettings) => {
  writeJson(keys.addressSettings, settings)
  writeJson(keys.addressSettingsVersion, addressSettingsVersion)
}

export const saveFuelPrices = (prices: Record<FuelType, number>) => writeJson(keys.fuelPrices, prices)
