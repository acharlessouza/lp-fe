import { useEffect, useState } from 'react'
import { getMarketSummary } from '../services/api'
import type { MarketSummaryResponse } from '../services/api'

export function useMarketSummary() {
  const [data, setData] = useState<MarketSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    getMarketSummary(controller.signal)
      .then((response) => {
        if (!isActive) {
          return
        }
        setData(response)
        setError('')
      })
      .catch((err) => {
        if (!isActive) {
          return
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        const message = err instanceof Error ? err.message : 'Unable to load market summary.'
        setError(message)
        setData(null)
      })
      .finally(() => {
        if (!isActive) {
          return
        }
        setLoading(false)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  return { data, loading, error }
}
