import type { FuelPrices } from '../types.js'
import { TtlCache, createSingleFlight } from '../lib/cache.js'
import { describeNetworkError, fetchText } from '../lib/net.js'

export const fuelSourceUrl = 'https://www.mbenzin.cz/'

const readerUrl = 'https://r.jina.ai/http://www.mbenzin.cz/'
const cache = new TtlCache<FuelPrices>(60 * 60 * 1000, 1)
const singleFlight = createSingleFlight()

/**
 * Labels are captured alongside the value: matching by position alone swapped Natural 95
 * and Nafta whenever the source page changed their order.
 */
export const parseFuelPrices = (text: string): FuelPrices => {
  const found = new Map<string, number>()

  for (const match of text.matchAll(/(Natural\s*95|Nafta)[^\d]{0,40}(\d{2}[,.]\d{2})/gi)) {
    const label = /nafta/i.test(match[1]) ? 'Nafta' : 'Natural 95'
    const value = Number(match[2].replace(',', '.'))
    if (!found.has(label) && Number.isFinite(value)) found.set(label, value)
  }

  const natural = found.get('Natural 95')
  const diesel = found.get('Nafta')
  if (natural === undefined || diesel === undefined) {
    throw new Error('Ceny paliva se na stránce zdroje nenašly.')
  }
  return { 'Natural 95': natural, Nafta: diesel }
}

export type FuelOutcome = {
  prices: FuelPrices | null
  warnings: string[]
}

export const getFuelPrices = async (): Promise<FuelOutcome> => {
  const cached = cache.get('current')
  if (cached) return { prices: cached, warnings: [] }

  try {
    const prices = await singleFlight('fuel', async () =>
      parseFuelPrices(await fetchText(readerUrl, 'text/plain', 15000)),
    )
    cache.set('current', prices)
    return { prices, warnings: [] }
  } catch (error) {
    return { prices: null, warnings: [`Cena paliva není dostupná – ${describeNetworkError(error)}.`] }
  }
}
