import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type {
  AllocateResponse,
  EstimatedFeesResponse,
  LiquidityDistributionResponse,
  PoolDetail,
  PoolPriceResponse,
} from '../services/api'
import {
  getPoolByAddress,
  getPoolPrice,
  postAllocate,
  postEstimatedFees,
  postLiquidityDistribution,
} from '../services/api'
import './PoolDetailPage.css'

type RangeBounds = {
  min: number | null
  max: number | null
}

type LiquidityChartProps = {
  apiData: LiquidityDistributionResponse | null
  loading: boolean
  error: string
  rangeMin: string
  rangeMax: string
  setRangeMin: (value: string) => void
  setRangeMax: (value: string) => void
  onApply: () => void
  currentTick: number
  tickRange: number
}

type PoolPriceChartProps = {
  apiData: PoolPriceResponse | null
  loading: boolean
  error: string
  rangeMin: string
  rangeMax: string
  token0: string
  token1: string
}

type EstimatedFeesProps = {
  data: EstimatedFeesResponse | null
  loading: boolean
  error: string
}

type LiquidityPriceRangeProps = {
  rangeMin: string
  rangeMax: string
  setRangeMin: (value: string) => void
  setRangeMax: (value: string) => void
  bounds: RangeBounds
  timeframeDays: number
  setTimeframeDays: (value: number) => void
  feeTier: number | null
  token0Decimals: number | null
  token1Decimals: number | null
}

type DepositAmountProps = {
  token0: string
  token1: string
  depositUsd: string
  setDepositUsd: (value: string) => void
  allocateData: AllocateResponse | null
  loading: boolean
  error: string
}

const shortAddress = (address: string) => {
  if (!address) {
    return ''
  }
  if (address.length <= 10) {
    return address
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const getSafeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function LiquidityChart({
  apiData,
  loading,
  error,
  rangeMin,
  rangeMax,
  setRangeMin,
  setRangeMax,
  onApply,
  currentTick,
  tickRange,
}: LiquidityChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const points = useMemo(() => {
    if (!apiData?.data?.length) {
      return []
    }
    return apiData.data
      .map((point) => ({
        tick: Number(point.tick),
        liquidity: String(point.liquidity),
        liquidityValue: Number(point.liquidity),
        price: Number(point.price),
      }))
      .sort((a, b) => a.tick - b.tick)
  }, [apiData])

  const token0 = apiData?.pool?.token0 || 'TOKEN0'
  const token1 = apiData?.pool?.token1 || 'TOKEN1'
  const currentTickValue = apiData?.current_tick ?? currentTick
  const rangeMinValue = Number.isFinite(Number(rangeMin)) ? Number(rangeMin) : null
  const rangeMaxValue = Number.isFinite(Number(rangeMax)) ? Number(rangeMax) : null
  const hasRange = rangeMinValue !== null && rangeMaxValue !== null
  const rangeLow = hasRange ? Math.min(rangeMinValue, rangeMaxValue) : null
  const rangeHigh = hasRange ? Math.max(rangeMinValue, rangeMaxValue) : null

  const defaultIndex = useMemo(() => {
    if (!points.length) {
      return null
    }
    let bestIndex = 0
    let bestDistance = Math.abs(points[0].tick - currentTickValue)
    points.forEach((point, idx) => {
      const distance = Math.abs(point.tick - currentTickValue)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = idx
      }
    })
    return bestIndex
  }, [points, currentTickValue])

  const hoverPoint =
    hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : points[defaultIndex ?? 0]

  const minTick = points.length ? points[0].tick : currentTickValue - tickRange
  const maxTick = points.length
    ? points[points.length - 1].tick
    : currentTickValue + tickRange
  const maxLiquidity = points.length
    ? Math.max(...points.map((point) => point.liquidityValue))
    : 0

  const width = 820
  const height = 260
  const padding = 24
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const barWidth = points.length ? chartWidth / points.length : chartWidth

  const scaleX = (tick: number) => {
    if (maxTick === minTick) {
      return padding
    }
    const ratio = (tick - minTick) / (maxTick - minTick)
    return padding + ratio * chartWidth
  }

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const paddingPx = (padding / width) * rect.width
    const innerWidth = rect.width - paddingPx * 2
    const x = Math.min(innerWidth, Math.max(0, event.clientX - rect.left - paddingPx))
    const idx = Math.round((x / innerWidth) * (points.length - 1))
    setHoverIndex(idx)
  }

  const findClosestTick = (targetPrice: number) => {
    if (!points.length) {
      return currentTickValue
    }
    return points.reduce((closest, point) =>
      Math.abs(point.price - targetPrice) < Math.abs(closest.price - targetPrice)
        ? point
        : closest,
    ).tick
  }

  return (
    <div className="card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Liquidity Distribution</div>
          <div className="chart-meta">
            <div className="price">
              1 {token0} = {hoverPoint ? hoverPoint.price.toFixed(2) : '--'} {token1}
            </div>
            <div className="range-controls">
              <label>
                Range min
                <input
                  value={rangeMin}
                  onChange={(event) => setRangeMin(event.target.value)}
                />
              </label>
              <label>
                Range max
                <input
                  value={rangeMax}
                  onChange={(event) => setRangeMax(event.target.value)}
                />
              </label>
              <button type="button" onClick={onApply}>
                Apply
              </button>
            </div>
          </div>
        </div>
        <div className="subtitle">{loading ? 'Loading...' : error ? 'API error' : ''}</div>
      </div>

      <div className="chart-shell">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <rect x="0" y="0" width={width} height={height} rx="14" fill="var(--chart-bg)" />
          {points.map((point, idx) => {
            const heightScale = maxLiquidity > 0 ? point.liquidityValue / maxLiquidity : 0
            const barHeight = heightScale * chartHeight
            const x = scaleX(point.tick) - barWidth / 2
            const y = height - padding - barHeight
            return (
              <rect
                key={`${point.tick}-${idx}`}
                x={x}
                y={y}
                width={Math.max(1, barWidth * 0.9)}
                height={barHeight}
                fill="var(--bar)"
                opacity={hoverIndex === idx ? 0.9 : 0.6}
              />
            )
          })}
          {hasRange && points.length ? (
            <line
              x1={scaleX(findClosestTick(rangeLow ?? 0))}
              x2={scaleX(findClosestTick(rangeLow ?? 0))}
              y1={padding}
              y2={height - padding}
              stroke="var(--range)"
              strokeWidth="2"
            />
          ) : null}
          {hasRange && points.length ? (
            <line
              x1={scaleX(findClosestTick(rangeHigh ?? 0))}
              x2={scaleX(findClosestTick(rangeHigh ?? 0))}
              y1={padding}
              y2={height - padding}
              stroke="var(--range)"
              strokeWidth="2"
            />
          ) : null}
          <line
            x1={scaleX(currentTickValue)}
            x2={scaleX(currentTickValue)}
            y1={padding}
            y2={height - padding}
            stroke="var(--current)"
            strokeWidth="1"
          />
        </svg>
        {hoverPoint ? (
          <div className="tooltip" style={{ left: `${scaleX(hoverPoint.tick)}px` }}>
            <div className="label">
              1 {token0} = {hoverPoint.price.toFixed(2)} {token1}
            </div>
          </div>
        ) : null}
      </div>

      <div className="axis-labels">
        <span>{minTick}</span>
        <span>{points.length ? 'Distribution' : 'No data'}</span>
        <span>{maxTick}</span>
      </div>
    </div>
  )
}

function PoolPriceChart({
  apiData,
  loading,
  error,
  rangeMin,
  rangeMax,
  token0,
  token1,
}: PoolPriceChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const points = useMemo(() => {
    if (!apiData?.series?.length) {
      return []
    }
    return apiData.series
      .map((point) => {
        const ts = new Date(point.timestamp)
        return {
          timestamp: point.timestamp,
          tsMs: Number.isFinite(ts.getTime()) ? ts.getTime() : null,
          price: Number(point.price),
        }
      })
      .filter((point) => Number.isFinite(point.tsMs) && Number.isFinite(point.price))
      .sort((a, b) => (a.tsMs ?? 0) - (b.tsMs ?? 0))
  }, [apiData])

  const stats = apiData?.stats || {}
  const statMin = Number(stats.min)
  const statMax = Number(stats.max)
  const statAvg = Number(stats.avg)
  const statPrice = Number(stats.price)

  const minInput = Number(rangeMin)
  const maxInput = Number(rangeMax)

  const seriesPrices = points.map((point) => point.price)
  const fallbackPrices = [statPrice, minInput, maxInput].filter((value) =>
    Number.isFinite(value),
  )
  const pricesForScale = seriesPrices.length ? seriesPrices : fallbackPrices
  let minPrice = pricesForScale.length ? Math.min(...pricesForScale) : 0
  let maxPrice = pricesForScale.length ? Math.max(...pricesForScale) : 1
  if (minPrice === maxPrice) {
    minPrice -= 1
    maxPrice += 1
  }

  const minTs = points.length ? points[0].tsMs ?? 0 : 0
  const maxTs = points.length ? points[points.length - 1].tsMs ?? 1 : 1

  const width = 820
  const height = 260
  const padding = 24
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const baseY = height - padding

  const scaleX = (timestamp: number) => {
    if (maxTs === minTs) {
      return padding
    }
    const ratio = (timestamp - minTs) / (maxTs - minTs)
    return padding + ratio * chartWidth
  }

  const scaleY = (price: number) => {
    if (maxPrice === minPrice) {
      return height / 2
    }
    const ratio = (price - minPrice) / (maxPrice - minPrice)
    return height - padding - ratio * chartHeight
  }

  const clampY = (value: number) => Math.min(baseY, Math.max(padding, value))

  const linePath = points.length
    ? points
        .map((point, idx) => {
          const command = idx === 0 ? 'M' : 'L'
          return `${command} ${scaleX(point.tsMs ?? 0)} ${scaleY(point.price)}`
        })
        .join(' ')
    : ''

  const areaPath = points.length
    ? [
        `M ${scaleX(points[0].tsMs ?? 0)} ${baseY}`,
        `L ${scaleX(points[0].tsMs ?? 0)} ${scaleY(points[0].price)}`,
        ...points
          .slice(1)
          .map((point) => `L ${scaleX(point.tsMs ?? 0)} ${scaleY(point.price)}`),
        `L ${scaleX(points[points.length - 1].tsMs ?? 0)} ${baseY}`,
        'Z',
      ].join(' ')
    : ''

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const paddingPx = (padding / width) * rect.width
    const innerWidth = rect.width - paddingPx * 2
    const x = Math.min(innerWidth, Math.max(0, event.clientX - rect.left - paddingPx))
    const ratio = innerWidth > 0 ? x / innerWidth : 0
    const hoverTime = minTs + ratio * (maxTs - minTs)
    let closestIndex = 0
    let bestDistance = Math.abs((points[0].tsMs ?? 0) - hoverTime)
    points.forEach((point, idx) => {
      const distance = Math.abs((point.tsMs ?? 0) - hoverTime)
      if (distance < bestDistance) {
        bestDistance = distance
        closestIndex = idx
      }
    })
    setHoverIndex(closestIndex)
  }

  const hoverPoint =
    hoverIndex !== null && points[hoverIndex]
      ? points[hoverIndex]
      : points[points.length - 1]

  const formatDateTime = (timestamp: string) => {
    if (!timestamp) {
      return '--'
    }
    const date = new Date(timestamp)
    if (!Number.isFinite(date.getTime())) {
      return '--'
    }
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const formatStat = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '--')

  const axisStart = points.length ? formatDateTime(points[0].timestamp) : 'No data'
  const axisEnd = points.length
    ? formatDateTime(points[points.length - 1].timestamp)
    : '--'

  return (
    <div className="card pool-price-card">
      <div className="chart-header">
        <div>
          <div className="price-title">Pool Price</div>
          <div className="subtitle">
            1 {token0} = {Number.isFinite(statPrice) ? statPrice.toFixed(2) : '--'} {token1}
          </div>
        </div>
        <div className="subtitle">{loading ? 'Loading...' : error ? 'API error' : ''}</div>
      </div>
      <div className="price-stats">
        <div className="stat-card">
          <span className="stat-label">MIN</span>
          <span className="stat-value">{formatStat(statMin)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">PRICE</span>
          <span className="stat-value">{formatStat(statPrice)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">AVG</span>
          <span className="stat-value">{formatStat(statAvg)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">MAX</span>
          <span className="stat-value">{formatStat(statMax)}</span>
        </div>
      </div>
      <div className="price-chart">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(231, 111, 81, 0.4)" />
              <stop offset="100%" stopColor="rgba(231, 111, 81, 0.05)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={width} height={height} rx="14" fill="var(--chart-bg)" />
          {Number.isFinite(minInput) ? (
            <line
              x1={padding}
              x2={width - padding}
              y1={clampY(scaleY(minInput))}
              y2={clampY(scaleY(minInput))}
              className="price-line--min"
              strokeWidth="1.5"
            />
          ) : null}
          {Number.isFinite(maxInput) ? (
            <line
              x1={padding}
              x2={width - padding}
              y1={clampY(scaleY(maxInput))}
              y2={clampY(scaleY(maxInput))}
              className="price-line--max"
              strokeWidth="1.5"
            />
          ) : null}
          {Number.isFinite(statPrice) ? (
            <line
              x1={padding}
              x2={width - padding}
              y1={clampY(scaleY(statPrice))}
              y2={clampY(scaleY(statPrice))}
              className="price-line--current"
              strokeWidth="1.5"
            />
          ) : null}
          {areaPath ? <path d={areaPath} fill="url(#priceFill)" /> : null}
          {linePath ? <path d={linePath} fill="none" stroke="var(--bar)" strokeWidth="2" /> : null}
        </svg>
        {hoverPoint ? (
          <div className="tooltip" style={{ left: `${scaleX(hoverPoint.tsMs ?? 0)}px` }}>
            <div className="label">
              1 {token0} = {hoverPoint.price.toFixed(2)} {token1}
            </div>
            <div>{formatDateTime(hoverPoint.timestamp)}</div>
          </div>
        ) : null}
      </div>
      <div className="price-axis">
        <span>{axisStart}</span>
        <span>{axisEnd}</span>
      </div>
    </div>
  )
}

function EstimatedFees({ data, loading, error }: EstimatedFeesProps) {
  const estimated24h = Number(data?.estimated_fees_24h)
  const monthlyValue = Number(data?.monthly?.value)
  const monthlyPercent = Number(data?.monthly?.percent)
  const yearlyValue = Number(data?.yearly?.value)
  const yearlyApr = Number(data?.yearly?.apr)
  const display24h = Number.isFinite(estimated24h) ? estimated24h : 0
  const displayMonthlyValue = Number.isFinite(monthlyValue) ? monthlyValue : 0
  const displayMonthlyPercent = Number.isFinite(monthlyPercent) ? monthlyPercent : 0
  const displayYearlyValue = Number.isFinite(yearlyValue) ? yearlyValue : 0
  const displayYearlyApr = Number.isFinite(yearlyApr) ? yearlyApr : 0
  const aprPercent = displayYearlyApr * 100
  const statusLabel = loading ? 'Calculating...' : error ? 'Error' : ''
  const chipLabel = loading
    ? 'Calculating...'
    : error
      ? 'Error'
      : `Fee APR ${aprPercent.toFixed(2)}%`

  return (
    <div className="card fees-card">
      <div className="fees-header">
        <div>
          <div className="fees-title">
            Estimated Fees <span>(24h)</span>
          </div>
          <div className="fees-value">${display24h.toFixed(2)}</div>
        </div>
        <div className="fees-chip">{chipLabel}</div>
      </div>
      <div className="fees-rows">
        <div className="fees-row">
          <span>Monthly</span>
          <strong>
            ${displayMonthlyValue.toFixed(2)} ({displayMonthlyPercent.toFixed(2)}%)
          </strong>
        </div>
        <div className="fees-row">
          <span>Yearly</span>
          <strong>${displayYearlyValue.toFixed(2)}</strong>
        </div>
      </div>
      {statusLabel ? <div className="subtitle">{statusLabel}</div> : null}
      <button className="action-button ghost-button" type="button">
        Simulate Position Performance
      </button>
    </div>
  )
}

function LiquidityPriceRange({
  rangeMin,
  rangeMax,
  setRangeMin,
  setRangeMax,
  bounds,
  timeframeDays,
  setTimeframeDays,
  feeTier,
  token0Decimals,
  token1Decimals,
}: LiquidityPriceRangeProps) {
  const fallbackFeeTier = 3000
  const fallbackToken0Decimals = 18
  const fallbackToken1Decimals = 6
  const resolvedFeeTier = Number.isFinite(Number(feeTier))
    ? Number(feeTier)
    : fallbackFeeTier
  const resolvedToken0Decimals = Number.isFinite(Number(token0Decimals))
    ? Number(token0Decimals)
    : fallbackToken0Decimals
  const resolvedToken1Decimals = Number.isFinite(Number(token1Decimals))
    ? Number(token1Decimals)
    : fallbackToken1Decimals
  const parsedMin = Number(rangeMin)
  const parsedMax = Number(rangeMax)
  const minBound = Number.isFinite(bounds?.min) ? bounds.min : null
  const maxBound = Number.isFinite(bounds?.max) ? bounds.max : null
  const hasBounds =
    Number.isFinite(minBound) &&
    Number.isFinite(maxBound) &&
    maxBound !== null &&
    minBound !== null &&
    maxBound !== minBound
  let lowPercent = 0.18
  let highPercent = 0.82
  const tickSpacingMap: Record<number, number> = {
    100: 1,
    500: 10,
    3000: 60,
    10000: 200,
  }
  const tickSpacing = tickSpacingMap[resolvedFeeTier] ?? 1
  const decimalAdjust = Math.pow(10, resolvedToken0Decimals - resolvedToken1Decimals)
  const minTick = -887272
  const maxTick = 887272

  const handleTimeframeChange = (value: string | number) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      return
    }
    const clamped = Math.min(365, Math.max(1, Math.round(parsed)))
    setTimeframeDays(clamped)
  }

  const step = 0.01

  const formatRangeValue = (value: number) => {
    if (!Number.isFinite(value)) {
      return ''
    }
    return value.toFixed(6)
  }

  const getSafeValue = (value: number, fallback: number | null) => {
    if (Number.isFinite(value)) {
      return value
    }
    if (Number.isFinite(fallback)) {
      return fallback ?? 0
    }
    return 0
  }

  const snapPriceToTick = (price: number, roundDown: boolean) => {
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(tickSpacing) || tickSpacing <= 0) {
      return null
    }
    const adjustedPrice = price / decimalAdjust
    if (!Number.isFinite(adjustedPrice) || adjustedPrice <= 0) {
      return null
    }
    const rawTick = Math.log(adjustedPrice) / Math.log(1.0001)
    if (!Number.isFinite(rawTick)) {
      return null
    }
    const snappedTick = roundDown
      ? Math.floor(rawTick / tickSpacing) * tickSpacing
      : Math.ceil(rawTick / tickSpacing) * tickSpacing
    const clampedTick = Math.min(maxTick, Math.max(minTick, snappedTick))
    const snappedPrice = Math.pow(1.0001, clampedTick) * decimalAdjust
    return Number.isFinite(snappedPrice) ? snappedPrice : null
  }

  const commitRangeValue = (
    value: string,
    roundDown: boolean,
    setter: (next: string) => void,
  ) => {
    if (value === '') {
      return
    }
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      return
    }
    const snapped = snapPriceToTick(parsed, roundDown)
    const nextValue = snapped === null ? parsed : snapped
    const clamped =
      hasBounds && Number.isFinite(minBound) && Number.isFinite(maxBound)
        ? Math.min(maxBound as number, Math.max(minBound as number, nextValue))
        : nextValue
    setter(formatRangeValue(clamped))
  }

  if (hasBounds && Number.isFinite(parsedMin) && Number.isFinite(parsedMax)) {
    const low = Math.min(parsedMin, parsedMax)
    const high = Math.max(parsedMin, parsedMax)
    const clamp = (value: number) =>
      Math.min(maxBound as number, Math.max(minBound as number, value))
    const clampedLow = clamp(low)
    const clampedHigh = clamp(high)
    lowPercent = (clampedLow - (minBound as number)) / ((maxBound as number) - (minBound as number))
    highPercent =
      (clampedHigh - (minBound as number)) / ((maxBound as number) - (minBound as number))
  }

  const displayMin = Number.isFinite(parsedMin)
    ? parsedMin
    : Number.isFinite(minBound)
      ? (minBound as number)
      : 0
  const displayMax = Number.isFinite(parsedMax)
    ? parsedMax
    : Number.isFinite(maxBound)
      ? (maxBound as number)
      : 0
  const lowPercentClamped = Math.max(0, Math.min(100, lowPercent * 100))
  const highPercentClamped = Math.max(0, Math.min(100, highPercent * 100))
  const safeMin = getSafeValue(parsedMin, minBound)
  const safeMax = getSafeValue(parsedMax, maxBound)
  const sliderMin = Math.min(safeMin, safeMax)
  const sliderMax = Math.max(safeMin, safeMax)

  return (
    <div className="card range-card">
      <input type="hidden" name="fee_tier" value={resolvedFeeTier} />
      <input type="hidden" name="token0_decimals" value={resolvedToken0Decimals} />
      <input type="hidden" name="token1_decimals" value={resolvedToken1Decimals} />
      <div className="range-header">
        <div>
          <div className="range-title">Liquidity Price Range</div>
          <div className="range-subtitle">Suggested range for balanced exposure</div>
        </div>
        <div className="range-badges">
          <button className="chip is-active" type="button">
            Most Ticks
          </button>
          <button className="chip" type="button">
            Full Range
          </button>
        </div>
      </div>
      <div className="range-meta">
        <div className="range-meta-card">
          <span>Calculation Timeframe (Days)</span>
          <div className="timeframe-controls">
            <button type="button" onClick={() => handleTimeframeChange(timeframeDays - 1)}>
              -
            </button>
            <input
              type="number"
              min="1"
              max="365"
              value={timeframeDays}
              onChange={(event) => handleTimeframeChange(event.target.value)}
            />
            <button type="button" onClick={() => handleTimeframeChange(timeframeDays + 1)}>
              +
            </button>
          </div>
        </div>
        <div className="range-meta-card">
          <span>Calculation Method</span>
          <strong>Average Liquidity (Simple)</strong>
        </div>
      </div>
      <div className="range-inputs">
        <label>
          Min Price
          <input
            value={rangeMin}
            onChange={(event) => setRangeMin(event.target.value)}
            onBlur={(event) => commitRangeValue(event.target.value, true, setRangeMin)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
          />
        </label>
        <label>
          Max Price
          <input
            value={rangeMax}
            onChange={(event) => setRangeMax(event.target.value)}
            onBlur={(event) => commitRangeValue(event.target.value, false, setRangeMax)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
          />
        </label>
      </div>
      <div className="range-sliders">
        <div className="range-slider">
          <div
            className="range-fill"
            style={{
              left: `${lowPercentClamped}%`,
              right: `${Math.max(0, Math.min(100, 100 - highPercentClamped))}%`,
            }}
          />
          <div className="range-handle" style={{ left: `${lowPercentClamped}%` }} />
          <div className="range-handle" style={{ left: `${highPercentClamped}%` }} />
        </div>
        <input
          type="range"
          min={hasBounds ? (minBound as number) : 0}
          max={hasBounds ? (maxBound as number) : 100}
          step={step}
          value={sliderMin}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (!Number.isFinite(value)) {
              return
            }
            const snapped = snapPriceToTick(value, true)
            const nextValue =
              snapped === null
                ? value
                : hasBounds && Number.isFinite(minBound) && Number.isFinite(maxBound)
                  ? Math.min(maxBound as number, Math.max(minBound as number, snapped))
                  : snapped
            if (Number.isFinite(parsedMax) && nextValue > parsedMax) {
              setRangeMax(formatRangeValue(nextValue))
            }
            setRangeMin(formatRangeValue(nextValue))
          }}
          disabled={!hasBounds}
        />
        <input
          type="range"
          min={hasBounds ? (minBound as number) : 0}
          max={hasBounds ? (maxBound as number) : 100}
          step={step}
          value={sliderMax}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (!Number.isFinite(value)) {
              return
            }
            const snapped = snapPriceToTick(value, false)
            const nextValue =
              snapped === null
                ? value
                : hasBounds && Number.isFinite(minBound) && Number.isFinite(maxBound)
                  ? Math.min(maxBound as number, Math.max(minBound as number, snapped))
                  : snapped
            if (Number.isFinite(parsedMin) && nextValue < parsedMin) {
              setRangeMin(formatRangeValue(nextValue))
            }
            setRangeMax(formatRangeValue(nextValue))
          }}
          disabled={!hasBounds}
        />
      </div>
      <div className="range-values">
        <span>${displayMin.toFixed(2)}</span>
        <span>${displayMax.toFixed(2)}</span>
      </div>
    </div>
  )
}

function DepositAmount({
  token0,
  token1,
  depositUsd,
  setDepositUsd,
  allocateData,
  loading,
  error,
}: DepositAmountProps) {
  const parsedDeposit = Number(depositUsd)
  const totalUsd = Number.isFinite(parsedDeposit) ? parsedDeposit : 0
  const amount0 = allocateData ? Number(allocateData.amount_token0) : 0
  const amount1 = allocateData ? Number(allocateData.amount_token1) : 0
  const price0 = allocateData ? Number(allocateData.price_token0_usd) : 0
  const price1 = allocateData ? Number(allocateData.price_token1_usd) : 0
  const token0Usd = amount0 * price0
  const token1Usd = amount1 * price1

  return (
    <div className="card deposit-card">
      <div className="deposit-header">
        <div className="deposit-title">Deposit Amount</div>
        <span className="subtitle">{loading ? 'Calculating...' : error ? 'Error' : ''}</span>
      </div>
      <div className="deposit-input">
        <label>Total deposit (USD)</label>
        <input
          value={depositUsd}
          onChange={(event) => setDepositUsd(event.target.value)}
          placeholder="1000"
        />
      </div>
      <div className="token-rows">
        <div className="token-row">
          <div>
            {token0}
            <span>Amount</span>
          </div>
          <div className="token-value">
            <strong>{amount0.toFixed(6)}</strong>
            <span>${token0Usd.toFixed(2)}</span>
          </div>
        </div>
        <div className="token-row">
          <div>
            {token1}
            <span>Amount</span>
          </div>
          <div className="token-value">
            <strong>{amount1.toFixed(6)}</strong>
            <span>${token1Usd.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="split-labels">
        <span>Input USD: ${totalUsd.toFixed(2)}</span>
        <span>Output USD: ${(token0Usd + token1Usd).toFixed(2)}</span>
      </div>
    </div>
  )
}

function PoolDetailPage() {
  const { poolAddress } = useParams<{ poolAddress: string }>()
  const [searchParams] = useSearchParams()
  const network = searchParams.get('network') ?? ''
  const networkIdParam = searchParams.get('network_id')
  const exchangeNameParam = searchParams.get('exchange_name')
  const networkNameParam = searchParams.get('network_name')
  const token0Param = searchParams.get('token0') ?? ''
  const token1Param = searchParams.get('token1') ?? ''
  const token0SymbolParam = searchParams.get('token0_symbol')
  const token1SymbolParam = searchParams.get('token1_symbol')
  const exchangeIdParam = searchParams.get('exchange_id')
  const exchangeId = exchangeIdParam ? Number(exchangeIdParam) : Number.NaN
  const normalizedPoolAddress = poolAddress ? decodeURIComponent(poolAddress) : ''
  const backSearch = new URLSearchParams()

  if (exchangeIdParam) {
    backSearch.set('exchange_id', exchangeIdParam)
  }

  if (networkIdParam) {
    backSearch.set('network_id', networkIdParam)
  }

  if (exchangeNameParam) {
    backSearch.set('exchange_name', exchangeNameParam)
  }

  if (networkNameParam) {
    backSearch.set('network_name', networkNameParam)
  }

  if (token0Param) {
    backSearch.set('token0', token0Param)
  }

  if (token1Param) {
    backSearch.set('token1', token1Param)
  }

  if (token0SymbolParam) {
    backSearch.set('token0_symbol', token0SymbolParam)
  }

  if (token1SymbolParam) {
    backSearch.set('token1_symbol', token1SymbolParam)
  }

  const backHref = backSearch.toString() ? `/simulate?${backSearch.toString()}` : '/simulate'

  const [pool, setPool] = useState<PoolDetail | null>(null)
  const [poolKey, setPoolKey] = useState<string | null>(null)
  const [poolError, setPoolError] = useState('')
  const [poolErrorKey, setPoolErrorKey] = useState<string | null>(null)

  const [distributionData, setDistributionData] = useState<LiquidityDistributionResponse | null>(
    null,
  )
  const [distributionLoading, setDistributionLoading] = useState(false)
  const [distributionError, setDistributionError] = useState('')

  const [poolPriceData, setPoolPriceData] = useState<PoolPriceResponse | null>(null)
  const [poolPriceLoading, setPoolPriceLoading] = useState(false)
  const [poolPriceError, setPoolPriceError] = useState('')

  const [estimatedFeesData, setEstimatedFeesData] = useState<EstimatedFeesResponse | null>(null)
  const [estimatedFeesLoading, setEstimatedFeesLoading] = useState(false)
  const [estimatedFeesError, setEstimatedFeesError] = useState('')

  const [allocateData, setAllocateData] = useState<AllocateResponse | null>(null)
  const [allocateLoading, setAllocateLoading] = useState(false)
  const [allocateError, setAllocateError] = useState('')

  const [rangeMin, setRangeMin] = useState('2833.5')
  const [rangeMax, setRangeMax] = useState('3242.4')
  const [depositUsd, setDepositUsd] = useState('1000')
  const [timeframeDays, setTimeframeDays] = useState(14)

  const allocateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const estimatedFeesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMountedRef = useRef(false)
  const snapshotDateRef = useRef(new Date().toISOString().slice(0, 10))

  const hasContext = Boolean(normalizedPoolAddress && network && Number.isFinite(exchangeId))
  const activeKey = hasContext
    ? `${normalizedPoolAddress}|${network}|${exchangeId}`
    : ''
  const showPool = poolKey === activeKey && pool !== null
  const showError = poolErrorKey === activeKey && poolError !== ''
  const isLoading = hasContext && !showPool && !showError

  const token0Label =
    distributionData?.pool?.token0 || allocateData?.token0_symbol || pool?.token0_symbol || 'TOKEN0'
  const token1Label =
    distributionData?.pool?.token1 || allocateData?.token1_symbol || pool?.token1_symbol || 'TOKEN1'

  const feeTier =
    distributionData?.pool?.fee_tier ?? (Number.isFinite(pool?.fee_tier) ? pool?.fee_tier : null)
  const token0Decimals =
    distributionData?.pool?.token0_decimals ??
    (Number.isFinite(pool?.token0_decimals) ? pool?.token0_decimals : null)
  const token1Decimals =
    distributionData?.pool?.token1_decimals ??
    (Number.isFinite(pool?.token1_decimals) ? pool?.token1_decimals : null)

  const rangeBounds = useMemo<RangeBounds>(() => {
    if (!distributionData?.data?.length) {
      return { min: null, max: null }
    }
    const prices = distributionData.data
      .map((point) => Number(point.price))
      .filter((value) => Number.isFinite(value))
    if (!prices.length) {
      return { min: null, max: null }
    }
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [distributionData])

  const fetchDistribution = async () => {
    if (!pool) {
      return
    }
    setDistributionLoading(true)
    setDistributionError('')
    try {
      const parsedMin = Number(rangeMin)
      const parsedMax = Number(rangeMax)
      const payload = {
        pool_id: pool.id,
        snapshot_date: snapshotDateRef.current,
        current_tick: 0,
        tick_range: 6000,
        range_min: Number.isFinite(parsedMin) ? parsedMin : null,
        range_max: Number.isFinite(parsedMax) ? parsedMax : null,
      }
      const data = await postLiquidityDistribution(payload)
      setDistributionData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load distribution.'
      setDistributionError(message)
      setDistributionData(null)
    } finally {
      setDistributionLoading(false)
    }
  }

  const fetchAllocate = async () => {
    if (!normalizedPoolAddress || !network) {
      return
    }
    setAllocateLoading(true)
    setAllocateError('')
    try {
      const payload = {
        pool_address: normalizedPoolAddress,
        rede: network,
        amount: depositUsd,
        range1: rangeMin,
        range2: rangeMax,
      }
      const data = await postAllocate(payload)
      setAllocateData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load allocation.'
      setAllocateError(message)
      setAllocateData(null)
    } finally {
      setAllocateLoading(false)
    }
  }

  const fetchPoolPrice = async () => {
    if (!pool) {
      return
    }
    setPoolPriceLoading(true)
    setPoolPriceError('')
    try {
      const data = await getPoolPrice(pool.id, timeframeDays)
      setPoolPriceData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load price.'
      setPoolPriceError(message)
      setPoolPriceData(null)
    } finally {
      setPoolPriceLoading(false)
    }
  }

  const fetchEstimatedFees = async () => {
    if (!pool) {
      return
    }
    setEstimatedFeesLoading(true)
    setEstimatedFeesError('')
    try {
      const parsedDeposit = Number(depositUsd)
      const parsedMin = Number(rangeMin)
      const parsedMax = Number(rangeMax)
      const parsedDays = Number(timeframeDays)
      if (
        !Number.isFinite(parsedDeposit) ||
        !Number.isFinite(parsedMin) ||
        !Number.isFinite(parsedMax) ||
        !Number.isFinite(parsedDays)
      ) {
        return
      }
      const amount0 = allocateData ? getSafeNumber(allocateData.amount_token0) : 0
      const amount1 = allocateData ? getSafeNumber(allocateData.amount_token1) : 0
      const payload = {
        pool_id: pool.id,
        days: parsedDays,
        min_price: parsedMin,
        max_price: parsedMax,
        deposit_usd: parsedDeposit,
        amount_token0: amount0,
        amount_token1: amount1,
      }
      const data = await postEstimatedFees(payload)
      setEstimatedFeesData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load fees.'
      setEstimatedFeesError(message)
      setEstimatedFeesData(null)
    } finally {
      setEstimatedFeesLoading(false)
    }
  }

  useEffect(() => {
    if (!hasContext || !normalizedPoolAddress || !network || !Number.isFinite(exchangeId)) {
      return
    }

    const controller = new AbortController()

    getPoolByAddress(normalizedPoolAddress, network, exchangeId, controller.signal)
      .then((data) => {
        setPool(data)
        setPoolKey(activeKey)
        setPoolError('')
        setPoolErrorKey(null)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        const message = err instanceof Error ? err.message : 'Unable to load pool details.'
        setPoolError(message)
        setPoolErrorKey(activeKey)
      })

    return () => controller.abort()
  }, [activeKey, exchangeId, hasContext, network, normalizedPoolAddress])

  useEffect(() => {
    if (!showPool || !pool) {
      return
    }
    fetchDistribution()
    fetchAllocate()
  }, [pool, showPool])

  useEffect(() => {
    if (!showPool || !pool) {
      return
    }
    fetchPoolPrice()
  }, [pool, showPool, timeframeDays])

  useEffect(() => {
    if (!showPool || !pool) {
      return
    }
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (allocateDebounceRef.current) {
      clearTimeout(allocateDebounceRef.current)
    }
    allocateDebounceRef.current = setTimeout(() => {
      if (!Number.isFinite(Number(depositUsd))) {
        return
      }
      fetchAllocate()
    }, 400)
    return () => {
      if (allocateDebounceRef.current) {
        clearTimeout(allocateDebounceRef.current)
      }
    }
  }, [depositUsd, pool, showPool])

  useEffect(() => {
    if (!showPool || !pool || !allocateData) {
      return
    }
    if (estimatedFeesDebounceRef.current) {
      clearTimeout(estimatedFeesDebounceRef.current)
    }
    estimatedFeesDebounceRef.current = setTimeout(() => {
      const parsedDeposit = Number(depositUsd)
      const parsedMin = Number(rangeMin)
      const parsedMax = Number(rangeMax)
      const parsedDays = Number(timeframeDays)
      if (
        !Number.isFinite(parsedDeposit) ||
        !Number.isFinite(parsedMin) ||
        !Number.isFinite(parsedMax) ||
        !Number.isFinite(parsedDays)
      ) {
        return
      }
      fetchEstimatedFees()
    }, 400)
    return () => {
      if (estimatedFeesDebounceRef.current) {
        clearTimeout(estimatedFeesDebounceRef.current)
      }
    }
  }, [allocateData, depositUsd, rangeMin, rangeMax, timeframeDays, pool, showPool])

  const pairLabel = useMemo(() => {
    if (!showPool || !pool) {
      return 'Pool details'
    }
    return `${pool.token0_symbol} / ${pool.token1_symbol}`
  }, [pool, showPool])

  return (
    <main className="pool-detail">
      <header className="pool-detail-header">
        <div>
          <Link className="back-link" to={backHref}>
            &larr; Back to pools
          </Link>
          <h1>{pairLabel}</h1>
          <p>
            Pool address: <span className="mono">{shortAddress(normalizedPoolAddress)}</span>
          </p>
        </div>
        <div className="header-badges">
          <span className="badge">Network {network || '--'}</span>
          <span className="badge">Exchange ID {exchangeIdParam ?? '--'}</span>
        </div>
      </header>

      {!hasContext && (
        <div className="detail-status error">
          Missing pool context. Please return to the pool list.
        </div>
      )}

      {isLoading && <div className="detail-status">Loading pool details...</div>}

      {showError && <div className="detail-status error">{poolError}</div>}

      {showPool && pool && (
        <div className="pool-detail-grid">
          <div className="stack">
            <EstimatedFees
              data={estimatedFeesData}
              loading={estimatedFeesLoading}
              error={estimatedFeesError}
            />
            <LiquidityPriceRange
              rangeMin={rangeMin}
              rangeMax={rangeMax}
              setRangeMin={setRangeMin}
              setRangeMax={setRangeMax}
              bounds={rangeBounds}
              timeframeDays={timeframeDays}
              setTimeframeDays={setTimeframeDays}
              feeTier={feeTier ?? null}
              token0Decimals={token0Decimals ?? null}
              token1Decimals={token1Decimals ?? null}
            />
            <DepositAmount
              token0={token0Label}
              token1={token1Label}
              depositUsd={depositUsd}
              setDepositUsd={setDepositUsd}
              allocateData={allocateData}
              loading={allocateLoading}
              error={allocateError}
            />
          </div>
          <div className="stack">
            <LiquidityChart
              apiData={distributionData}
              loading={distributionLoading}
              error={distributionError}
              rangeMin={rangeMin}
              rangeMax={rangeMax}
              setRangeMin={setRangeMin}
              setRangeMax={setRangeMax}
              onApply={fetchDistribution}
              currentTick={0}
              tickRange={6000}
            />
            <PoolPriceChart
              apiData={poolPriceData}
              loading={poolPriceLoading}
              error={poolPriceError}
              rangeMin={rangeMin}
              rangeMax={rangeMax}
              token0={token0Label}
              token1={token1Label}
            />
          </div>
        </div>
      )}
    </main>
  )
}

export default PoolDetailPage
