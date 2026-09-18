import type { AddressSettings, FuelType, RefreshSource, RouteKey, WeightKey, Weights } from '../types/home'

export const routeKeys: RouteKey[] = ['work', 'wife', 'prague', 'center', 'sapa']

/** Bump when a frozen route snapshot needs one migration/recalculation. */
export const routeSnapshotVersion = 'mapy-car-v3'

export const accessSnapshotVersion = 'osm-access-v2'

/** Bump when saved address defaults need a one-time migration. */
export const addressSettingsVersion = 'v2'

export const routeLabels: Record<RouteKey, string> = {
  work: 'Moje práce',
  wife: 'Práce manželky',
  prague: 'Centrum Prahy',
  center: 'Centrum obce',
  sapa: 'SAPA / Tamda Foods',
}

export const routePlaceholders: Record<RouteKey, string> = {
  work: 'např. Karlovo náměstí, Praha',
  wife: 'např. Anděl, Praha',
  prague: 'např. Václavské náměstí, Praha',
  center: 'např. úřad obce nebo centrum',
  sapa: 'např. SAPA, Libušská 319/126, Praha 4',
}

export const defaultAddressSettings: AddressSettings = {
  work: 'A. Staška 1292/32',
  wife: 'Sokolovská 694/100a, 186 00 Karlín',
  prague: 'Václavské náměstí, Praha',
  center: '',
  sapa: 'SAPA, Libušská 319/126, Praha 4',
}

export const weightLabels: Record<WeightKey, string> = {
  commute: 'Dojezdy',
  safety: 'Bezpečnost',
  price: 'Cena',
  access: 'Dostupnost',
}

export const defaultWeights: Weights = {
  commute: 45,
  safety: 25,
  price: 15,
  access: 15,
}

export const fuelDefaults: Record<FuelType, number> = {
  'Natural 95': 0,
  Nafta: 0,
}

export const fuelSourceUrl = 'https://www.mbenzin.cz/'

/** Litres per 100 km used for the fuel cost estimate shown on cards and in the detail. */
export const fuelConsumptionPer100Km = 7.2

export const eurobydleniListingUrl =
  'https://www.eurobydleni.cz/rodinny-dum-prodej-konetopska-cecelice-melnik/detail/10189797/'

export const refreshSourceLabels: Record<RefreshSource, string> = {
  listing: 'nabídka domu',
  safety: 'bezpečnost',
  access: 'okolí domu',
  routes: 'dojezdy',
  fuel: 'ceny paliva',
}

export const isSupportedListingUrl = (listingUrl: string) => {
  try {
    const parsedUrl = new URL(listingUrl)
    const hostname = parsedUrl.hostname.toLocaleLowerCase('cs-CZ')
    const isEurobydleni = hostname === 'eurobydleni.cz' || hostname === 'www.eurobydleni.cz'
    return isEurobydleni && parsedUrl.pathname.includes('/detail/')
  } catch {
    return false
  }
}
