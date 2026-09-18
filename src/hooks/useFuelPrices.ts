import { useCallback, useEffect, useState } from 'react'
import { loadFuelPrices as requestFuelPrices } from '../api/homeData'
import { loadFuelPrices, saveFuelPrices } from '../lib/storage'
import type { FuelType } from '../types/home'

export type FuelStatus = 'loading' | 'live' | 'fallback'

export const useFuelPrices = () => {
  const [prices, setPrices] = useState<Record<FuelType, number>>(loadFuelPrices)
  const [status, setStatus] = useState<FuelStatus>(() =>
    Object.values(loadFuelPrices()).some((price) => price > 0) ? 'live' : 'loading',
  )
  const [isRefreshing, setIsRefreshing] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const outcome = await requestFuelPrices()
      setMessage(outcome.message)
      if (outcome.prices) {
        setPrices(outcome.prices)
        setStatus('live')
        saveFuelPrices(outcome.prices)
      } else {
        setStatus((current) => (current === 'live' ? current : 'fallback'))
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { prices, status, message, refresh, isRefreshing }
}
