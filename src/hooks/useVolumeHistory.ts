import { useEffect, useMemo, useState } from 'react'
import { getPoolVolumeHistory } from '../services/api'
import type { PoolVolumeHistoryResponse, VolumeHistoryPointResponse } from '../services/api'

export type VolumeHistoryPoint = {
  time: number
  value: number
  feesUsd: number | null
}

export type VolumeHistoryStats = {
  min: number | null
  avg: number | null
  max: number | null
}

export type VolumeHistorySummary = {
  tvlUsd: number | null
  avgDailyFeesUsd: number | null
  dailyFeesTvlPct: number | null
  avgDailyVolumeUsd: number | null
  dailyVolumeTvlPct: number | null
  priceVolatilityPct: number | null
  correlation: number | null
  geometricMeanPrice: number | null
}

type UseVolumeHistoryOptions = {
  chainId?: number | null
  dexId?: number | null
  symbol0?: string | null
  symbol1?: string | null
  enabled?: boolean
}

const DAY_SECONDS = 24 * 60 * 60

const parseVolumeTimeToEpochSeconds = (raw: number | string): number | null => {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return null
    }
    return raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : Math.floor(raw)
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const numeric = Number(trimmed)
  if (Number.isFinite(numeric)) {
    return numeric > 1_000_000_000_000 ? Math.floor(numeric / 1000) : Math.floor(numeric)
  }

  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2])
    const day = Number(dateOnlyMatch[3])
    const parsedMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
    return Number.isFinite(parsedMs) ? Math.floor(parsedMs / 1000) : null
  }

  // Backend may return values like "2026-02-09 21:00:00.000 -0300".
  const normalized = trimmed
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T')
    .replace(/\s*([+-]\d{2})(\d{2})$/, '$1:$2')

  const parsedMs = new Date(normalized).getTime()
  if (!Number.isFinite(parsedMs)) {
    return null
  }
  return Math.floor(parsedMs / 1000)
}

const normalizePoint = (point: VolumeHistoryPointResponse): VolumeHistoryPoint | null => {
  const rawTime = parseVolumeTimeToEpochSeconds(point.time)
  const rawValue = Number(point.value)
  const rawFees = point.fees_usd
  const parsedFees =
    rawFees === null || rawFees === undefined
      ? null
      : Number.isFinite(Number(rawFees))
        ? Number(rawFees)
        : null

  if (rawTime === null || !Number.isFinite(rawValue)) {
    return null
  }

  const dayStartEpochSec = Math.floor(rawTime / DAY_SECONDS) * DAY_SECONDS

  return {
    time: dayStartEpochSec,
    value: rawValue,
    feesUsd: parsedFees,
  }
}

const aggregateByClosedUtcDay = (input: VolumeHistoryPoint[]): VolumeHistoryPoint[] => {
  const byDay = new Map<number, VolumeHistoryPoint>()
  input.forEach((point) => {
    const current = byDay.get(point.time)
    if (!current) {
      byDay.set(point.time, { ...point })
      return
    }
    current.value += point.value
    const currentFees = current.feesUsd ?? 0
    const nextFees = point.feesUsd ?? 0
    current.feesUsd = currentFees + nextFees
  })
  return Array.from(byDay.values()).sort((a, b) => a.time - b.time)
}

const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getVolumeHistorySummary = (
  response: PoolVolumeHistoryResponse | VolumeHistoryPointResponse[],
): VolumeHistorySummary | null => {
  if (Array.isArray(response) || !response.summary) {
    return null
  }
  return {
    tvlUsd: parseNullableNumber(response.summary.tvl_usd),
    avgDailyFeesUsd: parseNullableNumber(response.summary.avg_daily_fees_usd),
    dailyFeesTvlPct: parseNullableNumber(response.summary.daily_fees_tvl_pct),
    avgDailyVolumeUsd: parseNullableNumber(response.summary.avg_daily_volume_usd),
    dailyVolumeTvlPct: parseNullableNumber(response.summary.daily_volume_tvl_pct),
    priceVolatilityPct: parseNullableNumber(response.summary.price_volatility_pct),
    correlation: parseNullableNumber(response.summary.correlation),
    geometricMeanPrice: parseNullableNumber(response.summary.geometric_mean_price),
  }
}

const getVolumeHistoryItems = (
  response: PoolVolumeHistoryResponse | VolumeHistoryPointResponse[],
): VolumeHistoryPointResponse[] => {
  if (Array.isArray(response)) {
    return response
  }
  if (Array.isArray(response.volume_history)) {
    return response.volume_history
  }
  return []
}

export function useVolumeHistory(
  poolAddress: string,
  days: number,
  options: UseVolumeHistoryOptions = {},
) {
  const { chainId, dexId, symbol0, symbol1, enabled = true } = options
  const [data, setData] = useState<VolumeHistoryPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<VolumeHistorySummary | null>(null)

  useEffect(() => {
    if (!enabled || !poolAddress || !Number.isFinite(days) || days <= 0) {
      return
    }

    let isActive = true
    const controller = new AbortController()
    const startLoadingTimer = window.setTimeout(() => {
      if (!isActive) {
        return
      }
      setLoading(true)
      setError('')
    }, 0)

    // Backend contract: `days` means closed UTC days only (today excluded).
    getPoolVolumeHistory(
      poolAddress,
      {
        days,
        ...(Number.isFinite(chainId) ? { chainId: chainId as number } : {}),
        ...(Number.isFinite(dexId) ? { dexId: dexId as number } : {}),
        ...(symbol0?.trim() ? { symbol0: symbol0.trim() } : {}),
        ...(symbol1?.trim() ? { symbol1: symbol1.trim() } : {}),
      },
      controller.signal,
    )
      .then((response) => {
        if (!isActive) {
          return
        }
        const rawItems = getVolumeHistoryItems(response)
        const normalized = rawItems
          .map((point) => normalizePoint(point))
          .filter((point): point is VolumeHistoryPoint => point !== null)
        setData(aggregateByClosedUtcDay(normalized))
        setSummary(getVolumeHistorySummary(response))
      })
      .catch((err) => {
        if (!isActive) {
          return
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to load volume history.'
        setError(message)
        setData([])
        setSummary(null)
      })
      .finally(() => {
        if (!isActive) {
          return
        }
        setLoading(false)
      })

    return () => {
      isActive = false
      window.clearTimeout(startLoadingTimer)
      controller.abort()
    }
  }, [chainId, days, dexId, enabled, poolAddress, symbol0, symbol1])

  const stats = useMemo<VolumeHistoryStats>(() => {
    if (!data.length) {
      return {
        min: null,
        avg: null,
        max: null,
      }
    }
    const values = data.map((point) => point.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    return { min, avg, max }
  }, [data])

  return { data, loading, error, stats, summary }
}
