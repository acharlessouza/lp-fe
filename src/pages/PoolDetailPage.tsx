import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type {
  AllocateResponse,
  LiquidityDistributionResponse,
  MatchTicksResponse,
  PoolDetail,
  PoolPriceResponse,
  SimulateAprResponse,
  SimulateAprV1Payload,
  SimulateAprV2Payload,
  SimulateAprVersion,
} from '../services/api'
import {
  getPoolByAddress,
  getPoolPrice,
  postAllocate,
  postLiquidityDistributionDefaultRange,
  postLiquidityDistribution,
  postMatchTicks,
  postSimulateApr,
} from '../services/api'
import { VolumeSummaryCard } from '../components/VolumeSummaryCard'
import { VolumeHistoryChart } from '../components/VolumeHistoryChart'
import { useVolumeHistory } from '../hooks/useVolumeHistory'
import './PoolDetailPage.css'

type RangeBounds = {
  min: number | null
  max: number | null
}

type CalculationMethod =
  | 'current'
  | 'avg_liquidity_in_range'
  | 'peak_liquidity_in_range'
  | 'custom'

const CALCULATION_METHOD_OPTIONS: Array<{ value: CalculationMethod; label: string }> = [
  { value: 'current', label: 'Current Price' },
  { value: 'avg_liquidity_in_range', label: 'Average Liquidity' },
  { value: 'peak_liquidity_in_range', label: 'Peak of Distribution (In-Range)' },
  { value: 'custom', label: 'Custom Price' },
]

const DEFAULT_CALCULATION_METHOD: CalculationMethod = 'avg_liquidity_in_range'
const APR_VERSION_OPTIONS: Array<{ value: SimulateAprVersion; label: string }> = [
  { value: 'v1', label: 'APR v1' },
  { value: 'v2', label: 'APR v2' },
]

type LiquidityChartProps = {
  apiData: LiquidityDistributionResponse | null
  loading: boolean
  error: string
  rangeMin: string
  rangeMax: string
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
  currentPriceOverride?: number | null
}

type EstimatedFeesProps = {
  data: SimulateAprResponse | null
  loading: boolean
  error: string
  depositUsd: string
}

type LiquidityPriceRangeProps = {
  rangeMin: string
  rangeMax: string
  setRangeMin: (value: string) => void
  setRangeMax: (value: string) => void
  isFullRange: boolean
  setIsFullRange: (value: boolean) => void
  bounds: RangeBounds
  timeframeDays: number
  setTimeframeDays: (value: number) => void
  feeTier: number | null
  token0Decimals: number | null
  token1Decimals: number | null
  poolTickSpacing: number | null
  minTickValue: number | null
  maxTickValue: number | null
  calculationMethod: CalculationMethod
  setCalculationMethod: (value: CalculationMethod) => void
  customCalculationPrice: string
  setCustomCalculationPrice: (value: string) => void
  aprVersion: SimulateAprVersion
  setAprVersion: (value: SimulateAprVersion) => void
  poolId: number | string | null
  onMatchTicks?: (data: MatchTicksResponse, matchedMin: string, matchedMax: string) => void
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

const FAVORITE_POOLS_STORAGE_KEY = 'favorite_pools'

const readFavoritePools = () => {
  if (typeof window === 'undefined') {
    return [] as string[]
  }
  try {
    const raw = window.localStorage.getItem(FAVORITE_POOLS_STORAGE_KEY)
    if (!raw) {
      return [] as string[]
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return [] as string[]
    }
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return [] as string[]
  }
}

const writeFavoritePools = (items: string[]) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(FAVORITE_POOLS_STORAGE_KEY, JSON.stringify(items))
}

const getPoolExplorerUrl = ({
  dexKey,
  chainKey,
  poolAddress,
}: {
  dexKey?: string
  chainKey?: string
  poolAddress: string
}) => {
  if (!poolAddress || !dexKey?.trim() || !chainKey?.trim()) {
    return ''
  }
  const normalizedDexKey = dexKey.trim().toLowerCase()
  const normalizedChainKey = chainKey.trim().toLowerCase()
  if (normalizedDexKey.includes('uniswap')) {
    return `https://app.uniswap.org/explore/pools/${normalizedChainKey}/${poolAddress}`
  }
  return ''
}

const formatFeeTierPercent = (value: number | string | null | undefined) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '--'
  }
  return `${(numeric / 10000).toFixed(2)}%`
}

const getSafeNumber = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return 0
    }
    let normalized = trimmed
    if (normalized.includes(',') && !normalized.includes('.')) {
      normalized = normalized.replace(/,/g, '.')
    } else {
      normalized = normalized.replace(/,/g, '')
    }
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const parsePriceInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return Number.NaN
  }
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const FULL_RANGE_MIN_INPUT = '0'
const FULL_RANGE_MAX_INPUT = '∞'

const resolveRangeValue = (value: string, fallback: number | null) => {
  const parsed = parsePriceInput(value)
  if (Number.isFinite(parsed)) {
    return parsed
  }
  return Number.isFinite(fallback) ? (fallback as number) : Number.NaN
}

const formatRangeNumber = (value: number) => value.toFixed(6).replace('.', ',')
const UNISWAP_MIN_TICK = -887272
const UNISWAP_MAX_TICK = 887272

const getPriceTick = (
  price: number,
  tickSpacing: number,
  decimalAdjust: number,
  roundDown: boolean,
) => {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(tickSpacing) ||
    tickSpacing <= 0 ||
    !Number.isFinite(decimalAdjust) ||
    decimalAdjust <= 0
  ) {
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
  const clampedTick = Math.min(UNISWAP_MAX_TICK, Math.max(UNISWAP_MIN_TICK, snappedTick))
  return Number.isFinite(clampedTick) ? clampedTick : null
}

function LiquidityChart({
  apiData,
  loading,
  error,
  rangeMin,
  rangeMax,
  currentTick,
  tickRange,
}: LiquidityChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [zoomRangeTicks, setZoomRangeTicks] = useState<number | null>(null)
  const [zoomCenterTick, setZoomCenterTick] = useState<number | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; center: number; range: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const points = useMemo(() => {
    if (!apiData?.data?.length) {
      return []
    }
    return apiData.data
      .map((point) => ({
        tick: Number(point.tick),
        liquidity: String(point.liquidity),
        liquidityValue: getSafeNumber(point.liquidity),
        price: getSafeNumber(point.price),
      }))
      .sort((a, b) => a.tick - b.tick)
  }, [apiData])

  const token0 = apiData?.pool?.token0 || 'TOKEN0'
  const token1 = apiData?.pool?.token1 || 'TOKEN1'
  const currentTickValue = apiData?.current_tick ?? currentTick
  const parsedRangeMin = parsePriceInput(rangeMin)
  const parsedRangeMax = parsePriceInput(rangeMax)
  const rangeMinValue = Number.isFinite(parsedRangeMin) ? parsedRangeMin : null
  const rangeMaxValue = Number.isFinite(parsedRangeMax) ? parsedRangeMax : null
  const hasRange = rangeMinValue !== null && rangeMaxValue !== null
  const rangeLow = hasRange ? Math.min(rangeMinValue, rangeMaxValue) : null
  const rangeHigh = hasRange ? Math.max(rangeMinValue, rangeMaxValue) : null

  const dataMinTick = points.length ? points[0].tick : currentTickValue - tickRange
  const dataMaxTick = points.length
    ? points[points.length - 1].tick
    : currentTickValue + tickRange
  const dataRange = Math.max(1, dataMaxTick - dataMinTick)
  const minZoomRange = 1
  const currentRange = Math.min(
    dataRange,
    Math.max(minZoomRange, zoomRangeTicks ?? dataRange),
  )
  const center = zoomCenterTick ?? (dataMinTick + dataMaxTick) / 2
  let viewMinTick = center - currentRange / 2
  let viewMaxTick = center + currentRange / 2
  if (viewMinTick < dataMinTick) {
    viewMinTick = dataMinTick
    viewMaxTick = dataMinTick + currentRange
  }
  if (viewMaxTick > dataMaxTick) {
    viewMaxTick = dataMaxTick
    viewMinTick = dataMaxTick - currentRange
  }

  useEffect(() => {
    if (zoomRangeTicks !== null || dataRange <= 0) {
      return
    }
    const timerId = window.setTimeout(() => {
      setZoomRangeTicks(Math.min(dataRange, 20000))
    }, 0)
    return () => {
      window.clearTimeout(timerId)
    }
  }, [dataRange, zoomRangeTicks])

  const pointsInView = useMemo(() => {
    if (!points.length) {
      return []
    }
    return points.filter((point) => point.tick >= viewMinTick && point.tick <= viewMaxTick)
  }, [points, viewMaxTick, viewMinTick])

  const renderPoints = pointsInView.length >= 2 ? pointsInView : points

  const defaultIndex = useMemo(() => {
    if (!renderPoints.length) {
      return null
    }
    let bestIndex = 0
    let bestDistance = Math.abs(renderPoints[0].tick - currentTickValue)
    renderPoints.forEach((point, idx) => {
      const distance = Math.abs(point.tick - currentTickValue)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = idx
      }
    })
    return bestIndex
  }, [renderPoints, currentTickValue])

  const hoverPoint =
    hoverIndex !== null && renderPoints[hoverIndex]
      ? renderPoints[hoverIndex]
      : renderPoints[defaultIndex ?? 0]

  const maxLiquidity = renderPoints.reduce((max, point) => {
    if (!Number.isFinite(point.liquidityValue)) {
      return max
    }
    return Math.max(max, point.liquidityValue)
  }, 0)

  const width = 820
  const height = 320
  const yPadding = 0
  const barWidth = renderPoints.length ? width / renderPoints.length : width
  const barThickness = Math.max(1, barWidth * 0.3)
  const chartHeight = height - yPadding * 2
  const extraGapPx = 2

  const minTickStep = useMemo(() => {
    if (renderPoints.length < 2) {
      return 1
    }
    let minStep = Number.POSITIVE_INFINITY
    for (let i = 1; i < renderPoints.length; i += 1) {
      const delta = renderPoints[i].tick - renderPoints[i - 1].tick
      if (delta > 0 && delta < minStep) {
        minStep = delta
      }
    }
    return Number.isFinite(minStep) ? minStep : 1
  }, [renderPoints])

  const xPositions = useMemo(() => {
    if (!renderPoints.length) {
      return []
    }
    if (renderPoints.length === 1) {
      return [barThickness / 2]
    }
    const threshold = minTickStep * 4
    const steps: number[] = []
    let totalUnits = 0
    let bigGapCount = 0
    for (let i = 1; i < renderPoints.length; i += 1) {
      const delta = renderPoints[i].tick - renderPoints[i - 1].tick
      const isBigGap = delta > threshold
      const units = isBigGap ? 1 : Math.max(1, delta / minTickStep)
      if (isBigGap) {
        bigGapCount += 1
      }
      totalUnits += units
      steps.push(units)
    }
    const availableWidth = Math.max(0, width - barThickness - bigGapCount * extraGapPx)
    const baseStep = totalUnits > 0 ? availableWidth / totalUnits : 0
    const positions: number[] = [barThickness / 2]
    let currentX = barThickness / 2
    for (let i = 0; i < steps.length; i += 1) {
      const delta = renderPoints[i + 1].tick - renderPoints[i].tick
      const isBigGap = delta > threshold
      const stepPx = steps[i] * baseStep + (isBigGap ? extraGapPx : 0)
      currentX += stepPx
      positions.push(currentX)
    }
    return positions
  }, [barThickness, extraGapPx, minTickStep, renderPoints, width])

  const getClosestIndexByX = (x: number) => {
    if (!xPositions.length) {
      return null
    }
    let bestIndex = 0
    let bestDistance = Math.abs(xPositions[0] - x)
    for (let i = 1; i < xPositions.length; i += 1) {
      const distance = Math.abs(xPositions[i] - x)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = i
      }
    }
    return bestIndex
  }

  const getXByTick = (tick: number) => {
    if (!renderPoints.length) {
      return barThickness / 2
    }
    let bestIndex = 0
    let bestDistance = Math.abs(renderPoints[0].tick - tick)
    for (let i = 1; i < renderPoints.length; i += 1) {
      const distance = Math.abs(renderPoints[i].tick - tick)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = i
      }
    }
    return xPositions[bestIndex] ?? barThickness / 2
  }

  const scaleX = (tick: number) => getXByTick(tick)

  const getPanMetrics = (clientX: number) => {
    const element = svgRef.current
    if (!element) {
      return null
    }
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0) {
      return null
    }
    const x = ((clientX - rect.left) / rect.width) * width
    return { x: Math.min(width, Math.max(0, x)), innerWidth: width }
  }

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length) {
      return
    }
    const metrics = getPanMetrics(event.clientX)
    if (!metrics) {
      return
    }
    const { x } = metrics
    const closestIndex = getClosestIndexByX(x)
    if (closestIndex === null) {
      return
    }
    setHoverX(xPositions[closestIndex] ?? x)
    setHoverIndex(closestIndex)
  }

  const handleMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !points.length) {
      return
    }
    event.preventDefault()
    const metrics = getPanMetrics(event.clientX)
    if (!metrics) {
      return
    }
    const { x } = metrics
    const centerPoint = viewMinTick + (viewMaxTick - viewMinTick) / 2
    panStartRef.current = {
      x,
      center: centerPoint,
      range: viewMaxTick - viewMinTick,
    }
    setIsPanning(true)
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    panStartRef.current = null
  }

  useEffect(() => {
    if (!isPanning) {
      return
    }
    const handleMove = (event: MouseEvent) => {
      if (!panStartRef.current) {
        return
      }
      const metrics = getPanMetrics(event.clientX)
      if (!metrics) {
        return
      }
      const { x, innerWidth } = metrics
      const deltaX = x - panStartRef.current.x
      const deltaRatio = innerWidth > 0 ? deltaX / innerWidth : 0
      const deltaTick = deltaRatio * panStartRef.current.range
      const halfRange = panStartRef.current.range / 2
      let nextCenter = panStartRef.current.center - deltaTick
      if (nextCenter - halfRange < dataMinTick) {
        nextCenter = dataMinTick + halfRange
      }
      if (nextCenter + halfRange > dataMaxTick) {
        nextCenter = dataMaxTick - halfRange
      }
      setZoomRangeTicks(panStartRef.current.range)
      setZoomCenterTick(nextCenter)
    }
    const handleUp = () => handleMouseUp()
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dataMaxTick, dataMinTick, isPanning, viewMaxTick, viewMinTick])

  useEffect(() => {
    const element = svgRef.current
    if (!element) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (!points.length) {
        return
      }
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0) {
        return
      }
      const x = ((event.clientX - rect.left) / rect.width) * width
      const clampedX = Math.min(width, Math.max(0, x))
      const ratio = width > 0 ? clampedX / width : 0
      const zoomFactor = event.deltaY < 0 ? 0.85 : 1.15
      const nextRangeUnclamped = (viewMaxTick - viewMinTick) * zoomFactor
      const nextRange = Math.max(minZoomRange, Math.min(dataRange, nextRangeUnclamped))
      console.log('[liquidity-chart] zoom range ticks:', nextRange)
      const anchorTick = viewMinTick + ratio * (viewMaxTick - viewMinTick)
      let nextMin = anchorTick - ratio * nextRange
      let nextMax = nextMin + nextRange
      if (nextMin < dataMinTick) {
        nextMin = dataMinTick
        nextMax = dataMinTick + nextRange
      }
      if (nextMax > dataMaxTick) {
        nextMax = dataMaxTick
        nextMin = dataMaxTick - nextRange
      }
      setZoomRangeTicks(nextRange)
      setZoomCenterTick((nextMin + nextMax) / 2)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
    }
  }, [
    dataMaxTick,
    dataMinTick,
    dataRange,
    minZoomRange,
    points.length,
    viewMaxTick,
    viewMinTick,
    width,
  ])

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

  const clampTick = (tick: number) =>
    Math.min(viewMaxTick, Math.max(viewMinTick, tick))

  return (
    <div className="card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Liquidity Distribution</div>
          <div className="chart-meta">
            <div className="price">
              1 {token0} = {hoverPoint ? hoverPoint.price.toFixed(2) : '--'} {token1}
            </div>
          </div>
        </div>
        <div className="subtitle">{loading ? 'Loading...' : error ? 'API error' : ''}</div>
      </div>

      <div className="chart-shell">
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoverIndex(null)
            setHoverX(null)
            handleMouseUp()
          }}
          className={isPanning ? 'liquidity-chart-svg is-panning' : 'liquidity-chart-svg'}
        >
          <rect x="0" y="0" width={width} height={height} rx="14" fill="var(--chart-bg)" />
          {renderPoints.map((point, idx) => {
            const liquidityValue = Math.max(0, point.liquidityValue)
            const adjustedScale =
              maxLiquidity > 0 ? Math.pow(liquidityValue / maxLiquidity, 0.6) : 0
            let barHeight = adjustedScale * chartHeight
            if (liquidityValue > 0) {
              barHeight = Math.max(3, barHeight)
            }
            const x = scaleX(point.tick) - barThickness / 2
            const y = height - yPadding - barHeight
            const barColor =
              point.tick < currentTickValue
                ? 'var(--bar-left)'
                : point.tick > currentTickValue
                  ? 'var(--bar-right)'
                  : 'var(--price-current)'
            return (
              <rect
                key={`${point.tick}-${idx}`}
                x={x}
                y={y}
                width={barThickness}
                height={barHeight}
                fill={barColor}
                opacity={hoverIndex === idx ? 0.9 : 0.6}
              />
            )
          })}
          {hoverX !== null && renderPoints.length ? (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={yPadding}
              y2={height - yPadding}
              className="liquidity-hover-line"
              strokeWidth="1"
            />
          ) : null}
          {hasRange && renderPoints.length ? (
            <rect
              x={scaleX(clampTick(findClosestTick(rangeLow ?? 0))) - barThickness / 2}
              y={yPadding}
              width={barThickness}
              height={height - yPadding * 2}
              fill="var(--range)"
              opacity={0.9}
            />
          ) : null}
          {hasRange && renderPoints.length ? (
            <rect
              x={scaleX(clampTick(findClosestTick(rangeHigh ?? 0))) - barThickness / 2}
              y={yPadding}
              width={barThickness}
              height={height - yPadding * 2}
              fill="var(--range)"
              opacity={0.9}
            />
          ) : null}
          <rect
            x={scaleX(clampTick(currentTickValue)) - barThickness / 2}
            y={yPadding}
            width={barThickness}
            height={height - yPadding * 2}
            fill="var(--price-current)"
            opacity={0.85}
          />
        </svg>
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
  currentPriceOverride,
}: PoolPriceChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [zoomRangeMs, setZoomRangeMs] = useState<number | null>(null)
  const [zoomCenterTs, setZoomCenterTs] = useState<number | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; center: number; range: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

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

  const stats = apiData?.status || apiData?.stats || {}
  const statMin = Number(stats.min)
  const statMax = Number(stats.max)
  const statAvg = Number(stats.avg)
  const statPriceRaw = Number(stats.price)
  const effectivePrice = Number.isFinite(currentPriceOverride)
    ? Number(currentPriceOverride)
    : statPriceRaw

  const minInput = parsePriceInput(rangeMin)
  const maxInput = parsePriceInput(rangeMax)

  const seriesPrices = points.map((point) => point.price)
  const fallbackPrices = [effectivePrice, minInput, maxInput].filter((value) =>
    Number.isFinite(value),
  )
  const pricesForScale = seriesPrices.length ? seriesPrices : fallbackPrices
  let minPrice = pricesForScale.length ? Math.min(...pricesForScale) : 0
  let maxPrice = pricesForScale.length ? Math.max(...pricesForScale) : 1
  if (minPrice === maxPrice) {
    minPrice -= 1
    maxPrice += 1
  }
  const isMinInRange =
    Number.isFinite(minInput) && minInput >= minPrice && minInput <= maxPrice
  const isMaxInRange =
    Number.isFinite(maxInput) && maxInput >= minPrice && maxInput <= maxPrice

  const dataMinTs = points.length ? points[0].tsMs ?? 0 : 0
  const dataMaxTs = points.length ? points[points.length - 1].tsMs ?? 1 : 1
  const dataRange = Math.max(1, dataMaxTs - dataMinTs)
  const minZoomRange = Math.min(dataRange, 60 * 60 * 1000)
  const currentRange = Math.min(
    dataRange,
    Math.max(minZoomRange, zoomRangeMs ?? dataRange),
  )
  const center = zoomCenterTs ?? (dataMinTs + dataMaxTs) / 2
  let viewMinTs = center - currentRange / 2
  let viewMaxTs = center + currentRange / 2
  if (viewMinTs < dataMinTs) {
    viewMinTs = dataMinTs
    viewMaxTs = dataMinTs + currentRange
  }
  if (viewMaxTs > dataMaxTs) {
    viewMaxTs = dataMaxTs
    viewMinTs = dataMaxTs - currentRange
  }

  const width = 820
  const height = 260
  const padding = 24
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const baseY = height - padding

  const scaleX = (timestamp: number) => {
    if (viewMaxTs === viewMinTs) {
      return padding
    }
    const ratio = (timestamp - viewMinTs) / (viewMaxTs - viewMinTs)
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

  const pointsInView = useMemo(() => {
    if (!points.length) {
      return []
    }
    return points.filter((point) => {
      const ts = point.tsMs ?? 0
      return ts >= viewMinTs && ts <= viewMaxTs
    })
  }, [points, viewMaxTs, viewMinTs])

  const renderPoints = pointsInView.length >= 2 ? pointsInView : points

  const linePath = renderPoints.length
    ? renderPoints
        .map((point, idx) => {
          const command = idx === 0 ? 'M' : 'L'
          return `${command} ${scaleX(point.tsMs ?? 0)} ${scaleY(point.price)}`
        })
        .join(' ')
    : ''

  const areaPath = renderPoints.length
    ? [
        `M ${scaleX(renderPoints[0].tsMs ?? 0)} ${baseY}`,
        `L ${scaleX(renderPoints[0].tsMs ?? 0)} ${scaleY(renderPoints[0].price)}`,
        ...renderPoints
          .slice(1)
          .map((point) => `L ${scaleX(point.tsMs ?? 0)} ${scaleY(point.price)}`),
        `L ${scaleX(renderPoints[renderPoints.length - 1].tsMs ?? 0)} ${baseY}`,
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
    if (innerWidth <= 0) {
      return
    }
    const ratio = innerWidth > 0 ? x / innerWidth : 0
    setHoverX(padding + ratio * chartWidth)
    if (isPanning && panStartRef.current) {
      const deltaX = x - panStartRef.current.x
      const deltaRatio = deltaX / innerWidth
      const deltaTime = deltaRatio * panStartRef.current.range
      const halfRange = panStartRef.current.range / 2
      let nextCenter = panStartRef.current.center - deltaTime
      if (nextCenter - halfRange < dataMinTs) {
        nextCenter = dataMinTs + halfRange
      }
      if (nextCenter + halfRange > dataMaxTs) {
        nextCenter = dataMaxTs - halfRange
      }
      setZoomRangeMs(panStartRef.current.range)
      setZoomCenterTs(nextCenter)
      return
    }
    const hoverTime = viewMinTs + ratio * (viewMaxTs - viewMinTs)
    let closestIndex = 0
    const candidates = renderPoints.length ? renderPoints : points
    let bestDistance = Math.abs((candidates[0].tsMs ?? 0) - hoverTime)
    candidates.forEach((point, idx) => {
      const distance = Math.abs((point.tsMs ?? 0) - hoverTime)
      if (distance < bestDistance) {
        bestDistance = distance
        closestIndex = idx
      }
    })
    setHoverIndex(closestIndex)
  }

  const handleMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !points.length) {
      return
    }
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const paddingPx = (padding / width) * rect.width
    const innerWidth = rect.width - paddingPx * 2
    const x = Math.min(innerWidth, Math.max(0, event.clientX - rect.left - paddingPx))
    const centerPoint = viewMinTs + (viewMaxTs - viewMinTs) / 2
    panStartRef.current = {
      x,
      center: centerPoint,
      range: viewMaxTs - viewMinTs,
    }
    setIsPanning(true)
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    panStartRef.current = null
  }

  useEffect(() => {
    const element = svgRef.current
    if (!element) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (!points.length) {
        return
      }
      const rect = element.getBoundingClientRect()
      const paddingPx = (padding / width) * rect.width
      const innerWidth = rect.width - paddingPx * 2
      if (innerWidth <= 0) {
        return
      }
      const x = Math.min(innerWidth, Math.max(0, event.clientX - rect.left - paddingPx))
      const ratio = innerWidth > 0 ? x / innerWidth : 0
      const zoomFactor = event.deltaY < 0 ? 0.85 : 1.15
      const nextRangeUnclamped = (viewMaxTs - viewMinTs) * zoomFactor
      const nextRange = Math.max(minZoomRange, Math.min(dataRange, nextRangeUnclamped))
      const anchorTime = viewMinTs + ratio * (viewMaxTs - viewMinTs)
      let nextMin = anchorTime - ratio * nextRange
      let nextMax = nextMin + nextRange
      if (nextMin < dataMinTs) {
        nextMin = dataMinTs
        nextMax = dataMinTs + nextRange
      }
      if (nextMax > dataMaxTs) {
        nextMax = dataMaxTs
        nextMin = dataMaxTs - nextRange
      }
      setZoomRangeMs(nextRange)
      setZoomCenterTs((nextMin + nextMax) / 2)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
    }
  }, [
    dataMaxTs,
    dataMinTs,
    dataRange,
    minZoomRange,
    padding,
    points.length,
    viewMaxTs,
    viewMinTs,
    width,
  ])

  const hoverPoint =
    hoverIndex !== null && renderPoints[hoverIndex]
      ? renderPoints[hoverIndex]
      : renderPoints[renderPoints.length - 1]

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

  const formatDayLabel = (timestampMs: number) => {
    const date = new Date(timestampMs)
    if (!Number.isFinite(date.getTime())) {
      return '--'
    }
    return String(date.getDate())
  }

  const formatStat = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '--')

  const axisTicks = useMemo(() => {
    if (!renderPoints.length || viewMaxTs <= viewMinTs) {
      return []
    }

    const dayMs = 24 * 60 * 60 * 1000
    const rangeDays = (viewMaxTs - viewMinTs) / dayMs
    const desiredTicks = 7
    const roughStepDays = Math.max(1, Math.round(rangeDays / (desiredTicks - 1)))
    const stepOptions = [1, 2, 3, 5, 7, 14, 30]
    const stepDays = stepOptions.find((value) => value >= roughStepDays) ?? roughStepDays
    const stepMs = stepDays * dayMs

    const minDate = new Date(viewMinTs)
    let firstTick = new Date(
      minDate.getFullYear(),
      minDate.getMonth(),
      minDate.getDate(),
    ).getTime()
    if (firstTick < viewMinTs) {
      firstTick += dayMs
    }

    const ticks: Array<{ ts: number; label: string }> = []
    ticks.push({ ts: viewMinTs, label: formatDayLabel(viewMinTs) })

    for (let ts = firstTick; ts < viewMaxTs; ts += stepMs) {
      ticks.push({ ts, label: formatDayLabel(ts) })
    }

    ticks.push({ ts: viewMaxTs, label: formatDayLabel(viewMaxTs) })

    const positioned = ticks
      .filter(
        (tick) =>
          Number.isFinite(tick.ts) && tick.ts >= viewMinTs && tick.ts <= viewMaxTs,
      )
      .map((tick) => {
        const ratio = (tick.ts - viewMinTs) / (viewMaxTs - viewMinTs)
        const x = padding + ratio * chartWidth
        const date = new Date(tick.ts)
        const dayKey = Number.isFinite(date.getTime())
          ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
          : tick.label
        return {
          label: tick.label,
          left: (x / width) * 100,
          ts: tick.ts,
          dayKey,
        }
      })
      .sort((a, b) => a.ts - b.ts)

    const deduped: Array<{ label: string; left: number; ts: number; dayKey: string }> = []
    const seenDays = new Set<string>()
    const minSpacing = 4
    positioned.forEach((tick) => {
      if (seenDays.has(tick.dayKey)) {
        return
      }
      const last = deduped[deduped.length - 1]
      if (!last || Math.abs(tick.left - last.left) >= minSpacing) {
        deduped.push(tick)
        seenDays.add(tick.dayKey)
      }
    })

    return deduped.map((tick, index, list) => ({
      ...tick,
      align: index === 0 ? 'start' : index === list.length - 1 ? 'end' : 'center',
    }))
  }, [chartWidth, padding, renderPoints.length, viewMaxTs, viewMinTs, width])

  return (
    <div className="card pool-price-card">
      <div className="chart-header">
        <div>
          <div className="price-title">
            {token0} / {token1} Pool Price
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
          <span className="stat-value">{formatStat(effectivePrice)}</span>
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
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoverIndex(null)
            setHoverX(null)
            handleMouseUp()
          }}
          className={isPanning ? 'price-chart-svg is-panning' : 'price-chart-svg'}
        >
          <defs>
            <linearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(231, 111, 81, 0.4)" />
              <stop offset="100%" stopColor="rgba(231, 111, 81, 0.05)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={width} height={height} rx="14" fill="var(--chart-bg)" />
          {isMinInRange ? (
            <line
              x1={padding}
              x2={width - padding}
              y1={clampY(scaleY(minInput))}
              y2={clampY(scaleY(minInput))}
              className="price-line--min"
              strokeWidth="1.5"
            />
          ) : null}
          {isMaxInRange ? (
            <line
              x1={padding}
              x2={width - padding}
              y1={clampY(scaleY(maxInput))}
              y2={clampY(scaleY(maxInput))}
              className="price-line--max"
              strokeWidth="1.5"
            />
          ) : null}
          {Number.isFinite(effectivePrice) ? (
            <line
              x1={padding}
              x2={width - padding}
              y1={clampY(scaleY(effectivePrice))}
              y2={clampY(scaleY(effectivePrice))}
              className="price-line--current"
              strokeWidth="1.5"
            />
          ) : null}
          {areaPath ? <path d={areaPath} fill="url(#priceFill)" /> : null}
          {linePath ? <path d={linePath} fill="none" stroke="var(--bar)" strokeWidth="2" /> : null}
          {hoverX !== null && renderPoints.length ? (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={padding}
              y2={height - padding}
              className="price-hover-line"
              strokeWidth="1"
            />
          ) : null}
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
        {axisTicks.map((tick) => (
          <span
            key={`${tick.label}-${tick.left}`}
            className={`price-axis-label price-axis-label--${tick.align}`}
            style={{ left: `${tick.left}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function EstimatedFees({ data, loading, error, depositUsd }: EstimatedFeesProps) {
  const estimated24h = Number(data?.estimated_fees_24h_usd)
  const monthlyValue = Number(data?.monthly_usd)
  const yearlyValue = Number(data?.yearly_usd)
  const feeApr = Number(data?.fee_apr)
  const parsedDeposit = Number(depositUsd)
  const monthlyPercent =
    Number.isFinite(monthlyValue) && Number.isFinite(parsedDeposit) && parsedDeposit > 0
      ? (monthlyValue / parsedDeposit) * 100
      : 0
  const yearlyPercent =
    Number.isFinite(yearlyValue) && Number.isFinite(parsedDeposit) && parsedDeposit > 0
      ? (yearlyValue / parsedDeposit) * 100
      : 0
  const display24h = Number.isFinite(estimated24h) ? estimated24h : 0
  const displayMonthlyValue = Number.isFinite(monthlyValue) ? monthlyValue : 0
  const displayMonthlyPercent = Number.isFinite(monthlyPercent) ? monthlyPercent : 0
  const displayYearlyValue = Number.isFinite(yearlyValue) ? yearlyValue : 0
  const displayYearlyPercent = Number.isFinite(yearlyPercent) ? yearlyPercent : 0
  const displayFeeApr = Number.isFinite(feeApr) ? feeApr : 0
  const aprPercent = displayFeeApr * 100
  const statusLabel = error ? 'Error' : ''
  const chipLabel = error
    ? 'Error'
    : loading
      ? 'Fee APR --'
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
          <strong>
            ${displayYearlyValue.toFixed(2)} ({displayYearlyPercent.toFixed(2)}%)
          </strong>
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
  isFullRange,
  setIsFullRange,
  bounds,
  timeframeDays,
  setTimeframeDays,
  feeTier,
  token0Decimals,
  token1Decimals,
  poolTickSpacing,
  minTickValue,
  maxTickValue,
  calculationMethod,
  setCalculationMethod,
  customCalculationPrice,
  setCustomCalculationPrice,
  aprVersion,
  setAprVersion,
  poolId,
  onMatchTicks,
}: LiquidityPriceRangeProps) {
  const [isMatching, setIsMatching] = useState(false)
  const fullRangePreviousRef = useRef<{ min: string; max: string } | null>(null)
  const minInputInitialValueRef = useRef<string | null>(null)
  const maxInputInitialValueRef = useRef<string | null>(null)
  const minInputDirtyRef = useRef(false)
  const maxInputDirtyRef = useRef(false)
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
  const parsedMin = parsePriceInput(rangeMin)
  const parsedMax = parsePriceInput(rangeMax)
  const minBound = Number.isFinite(bounds?.min) ? bounds.min : null
  const maxBound = Number.isFinite(bounds?.max) ? bounds.max : null
  const hasBounds =
    Number.isFinite(minBound) &&
    Number.isFinite(maxBound) &&
    maxBound !== null &&
    minBound !== null &&
    maxBound !== minBound
  const middleBound =
    hasBounds && Number.isFinite(minBound) && Number.isFinite(maxBound)
      ? ((minBound as number) + (maxBound as number)) / 2
      : null
  const hasMiddleBound = Number.isFinite(middleBound)
  let lowPercent = 0.18
  let highPercent = 0.82
  const tickSpacingMap: Record<number, number> = {
    100: 1,
    500: 10,
    3000: 60,
    10000: 200,
  }
  const resolvedPoolTickSpacing = Number(poolTickSpacing)
  const tickSpacing =
    Number.isFinite(resolvedPoolTickSpacing) && resolvedPoolTickSpacing > 0
      ? resolvedPoolTickSpacing
      : (tickSpacingMap[resolvedFeeTier] ?? 1)
  const decimalAdjust = Math.pow(10, resolvedToken0Decimals - resolvedToken1Decimals)
  const minTick = UNISWAP_MIN_TICK
  const maxTick = UNISWAP_MAX_TICK
  const showCalculationMethod = false
  const showAprVersion = true
  const hasSecondaryMetaCard = showCalculationMethod || showAprVersion

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
    return formatRangeNumber(value)
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
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(tickSpacing) ||
      tickSpacing <= 0
    ) {
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

    // Make snapping stable/idempotent: avoid dropping an extra tick due to floating-point drift
    // when the input is already very close to a tick boundary.
    const tickFloat = rawTick / tickSpacing
    const rounded = Math.round(tickFloat)
    const EPS = 1e-8
    const isExact = Math.abs(tickFloat - rounded) < EPS

    const snappedTick = isExact
      ? rounded * tickSpacing
      : roundDown
        ? Math.floor(tickFloat) * tickSpacing
        : Math.ceil(tickFloat) * tickSpacing

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
    const parsed = parsePriceInput(value)
    if (!Number.isFinite(parsed)) {
      return
    }
    const snapped = snapPriceToTick(parsed, roundDown)
    const nextValue = snapped === null ? parsed : snapped
    setter(formatRangeValue(nextValue))
  }

  const stepRangeValue = (
    value: string,
    direction: -1 | 1,
    setter: (next: string) => void,
  ) => {
    const parsed = parsePriceInput(value)
    if (!Number.isFinite(parsed)) {
      return
    }
    const adjusted = parsed / decimalAdjust
    if (!Number.isFinite(adjusted) || adjusted <= 0) {
      return
    }
    const rawTick = Math.log(adjusted) / Math.log(1.0001)
    if (!Number.isFinite(rawTick)) {
      return
    }
    const tickFloat = rawTick / tickSpacing
    const rounded = Math.round(tickFloat)
    const isExact = Math.abs(tickFloat - rounded) < 1e-6
    const lowerTick = Math.floor(tickFloat) * tickSpacing
    const upperTick = Math.ceil(tickFloat) * tickSpacing
    const baseTick =
      direction > 0
        ? (isExact ? rounded * tickSpacing : lowerTick)
        : (isExact ? rounded * tickSpacing : upperTick)
    const nextTick = baseTick + direction * tickSpacing
    const clampedTick = Math.min(maxTick, Math.max(minTick, nextTick))
    const nextPrice = Math.pow(1.0001, clampedTick) * decimalAdjust
    if (!Number.isFinite(nextPrice)) {
      return
    }
    setter(formatRangeValue(nextPrice))
  }

  const toggleFullRange = (nextValue: boolean) => {
    if (nextValue) {
      fullRangePreviousRef.current = { min: rangeMin, max: rangeMax }
      setRangeMin(FULL_RANGE_MIN_INPUT)
      setRangeMax(FULL_RANGE_MAX_INPUT)
      setIsFullRange(true)
      return
    }
    setIsFullRange(false)
    const previousRange = fullRangePreviousRef.current
    fullRangePreviousRef.current = null
    if (previousRange) {
      setRangeMin(previousRange.min)
      setRangeMax(previousRange.max)
    }
  }

  const handleCalculationMethodChange = (value: string) => {
    const selected = CALCULATION_METHOD_OPTIONS.find((option) => option.value === value)
    const nextMethod = selected?.value ?? DEFAULT_CALCULATION_METHOD
    setCalculationMethod(nextMethod)
    if (nextMethod !== 'custom') {
      setCustomCalculationPrice('')
    }
  }

  const handleAprVersionChange = (value: string) => {
    const selected = APR_VERSION_OPTIONS.find((option) => option.value === value)
    setAprVersion(selected?.value ?? 'v1')
  }

  useEffect(() => {
    if (!isFullRange) {
      return
    }
    if (rangeMin !== FULL_RANGE_MIN_INPUT) {
      setRangeMin(FULL_RANGE_MIN_INPUT)
    }
    if (rangeMax !== FULL_RANGE_MAX_INPUT) {
      setRangeMax(FULL_RANGE_MAX_INPUT)
    }
  }, [isFullRange, rangeMax, rangeMin, setRangeMax, setRangeMin])

  const handleMatchTicks = async () => {
    if (poolId === null || poolId === undefined || poolId === '') {
      return
    }
    const parsedMin = parsePriceInput(rangeMin)
    const parsedMax = parsePriceInput(rangeMax)
    if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax)) {
      return
    }
    fullRangePreviousRef.current = null
    setIsFullRange(false)
    setIsMatching(true)
    try {
      const response: MatchTicksResponse = await postMatchTicks({
        pool_id: poolId,
        min_price: parsedMin,
        max_price: parsedMax,
      })
      const nextMin = Number(response.min_price_matched)
      const nextMax = Number(response.max_price_matched)
      const nextMinValue = Number.isFinite(nextMin) ? formatRangeValue(nextMin) : rangeMin
      const nextMaxValue = Number.isFinite(nextMax) ? formatRangeValue(nextMax) : rangeMax
      if (Number.isFinite(nextMin)) {
        setRangeMin(nextMinValue)
      }
      if (Number.isFinite(nextMax)) {
        setRangeMax(nextMaxValue)
      }
      onMatchTicks?.(response, nextMinValue, nextMaxValue)
    } finally {
      setIsMatching(false)
    }
  }

  if (hasBounds && Number.isFinite(parsedMin) && Number.isFinite(parsedMax)) {
    const low = Math.min(parsedMin, parsedMax)
    const high = Math.max(parsedMin, parsedMax)
    const clamp = (value: number) =>
      Math.min(maxBound as number, Math.max(minBound as number, value))
    const clampedLow = hasMiddleBound
      ? Math.min(middleBound as number, clamp(low))
      : clamp(low)
    const clampedHigh = hasMiddleBound
      ? Math.max(middleBound as number, clamp(high))
      : clamp(high)
    lowPercent = (clampedLow - (minBound as number)) / ((maxBound as number) - (minBound as number))
    highPercent =
      (clampedHigh - (minBound as number)) / ((maxBound as number) - (minBound as number))
  }

  if (isFullRange) {
    lowPercent = 0
    highPercent = 1
  }

  const lowPercentClamped = Math.max(0, Math.min(100, lowPercent * 100))
  const highPercentClamped = Math.max(0, Math.min(100, highPercent * 100))
  const safeMin = getSafeValue(parsedMin, minBound)
  const safeMax = getSafeValue(parsedMax, maxBound)
  const sliderMinRaw =
    isFullRange && hasBounds && Number.isFinite(minBound) ? (minBound as number) : Math.min(safeMin, safeMax)
  const sliderMaxRaw =
    isFullRange && hasBounds && Number.isFinite(maxBound) ? (maxBound as number) : Math.max(safeMin, safeMax)
  const sliderMin = hasMiddleBound
    ? Math.min(middleBound as number, sliderMinRaw)
    : sliderMinRaw
  const sliderMax = hasMiddleBound
    ? Math.max(middleBound as number, sliderMaxRaw)
    : sliderMaxRaw

  return (
    <div className="card range-card">
      <input type="hidden" name="fee_tier" value={resolvedFeeTier} />
      <input type="hidden" name="token0_decimals" value={resolvedToken0Decimals} />
      <input type="hidden" name="token1_decimals" value={resolvedToken1Decimals} />
      <input type="hidden" name="min_tick" value={minTickValue ?? ''} />
      <input type="hidden" name="max_tick" value={maxTickValue ?? ''} />
      <div className="range-header">
        <div>
          <div className="range-title">Liquidity Price Range</div>
          <div className="range-subtitle">Suggested range for balanced exposure</div>
        </div>
        <div className="range-badges">
          <button
            className="chip is-active match-ticks"
            type="button"
            onClick={handleMatchTicks}
            disabled={!poolId || !hasBounds || isMatching}
            title="Match ticks"
          >
            Match Ticks
          </button>
          <label className={`chip chip-toggle${!hasBounds ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={isFullRange}
              onChange={(event) => toggleFullRange(event.target.checked)}
              disabled={!hasBounds}
            />
            <span>Full Range</span>
          </label>
        </div>
      </div>
      <div className={`range-meta${hasSecondaryMetaCard ? '' : ' range-meta--single'}`}>
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
        {showCalculationMethod ? (
          <div className="range-meta-card">
            <span>Calculation Method</span>
            <select
              value={calculationMethod}
              onChange={(event) => handleCalculationMethodChange(event.target.value)}
              aria-label="Calculation Method"
            >
              {CALCULATION_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {calculationMethod === 'custom' ? (
              <div className="custom-calculation-field">
                <label htmlFor="customCalculationPrice">Custom Calculation Price</label>
                <input
                  id="customCalculationPrice"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={customCalculationPrice}
                  onChange={(event) => setCustomCalculationPrice(event.target.value)}
                  placeholder="0.00"
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {showAprVersion ? (
          <div className="range-meta-card">
            <span>APR Version</span>
            <select
              value={aprVersion}
              onChange={(event) => handleAprVersionChange(event.target.value)}
              aria-label="APR Version"
            >
              {APR_VERSION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="range-inputs">
        <div className="range-input">
          <label htmlFor="rangeMinInput">Min Price</label>
          <div className="range-input-control">
            <button
              type="button"
              className="range-step"
              onClick={() => stepRangeValue(rangeMin, -1, setRangeMin)}
              disabled={!hasBounds || isFullRange}
              aria-label="Decrease min price"
            >
              -
            </button>
            <input
              id="rangeMinInput"
              value={rangeMin}
              onFocus={() => {
                minInputInitialValueRef.current = rangeMin
                minInputDirtyRef.current = false
              }}
              onChange={(event) => {
                if (isFullRange) {
                  setIsFullRange(false)
                }
                minInputDirtyRef.current = true
                setRangeMin(event.target.value.replace(/\./g, ','))
              }}
              onBlur={(event) => {
                const didEdit = minInputDirtyRef.current
                minInputDirtyRef.current = false

                const initialValue = minInputInitialValueRef.current
                minInputInitialValueRef.current = null

                // If the user didn't type in this input, don't snap on blur.
                if (!didEdit) {
                  return
                }

                if (initialValue !== null && event.target.value === initialValue) {
                  return
                }
                commitRangeValue(event.target.value, true, setRangeMin)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
              }}
            />
            <button
              type="button"
              className="range-step"
              onClick={() => stepRangeValue(rangeMin, 1, setRangeMin)}
              disabled={!hasBounds || isFullRange}
              aria-label="Increase min price"
            >
              +
            </button>
          </div>
        </div>

        <div className="range-input">
          <label htmlFor="rangeMaxInput">Max Price</label>
          <div className="range-input-control">
            <button
              type="button"
              className="range-step"
              onClick={() => stepRangeValue(rangeMax, -1, setRangeMax)}
              disabled={!hasBounds || isFullRange}
              aria-label="Decrease max price"
            >
              -
            </button>
            <input
              id="rangeMaxInput"
              value={rangeMax}
              onFocus={() => {
                maxInputInitialValueRef.current = rangeMax
                maxInputDirtyRef.current = false
              }}
              onChange={(event) => {
                if (isFullRange) {
                  setIsFullRange(false)
                }
                maxInputDirtyRef.current = true
                setRangeMax(event.target.value.replace(/\./g, ','))
              }}
              onBlur={(event) => {
                const didEdit = maxInputDirtyRef.current
                maxInputDirtyRef.current = false

                const initialValue = maxInputInitialValueRef.current
                maxInputInitialValueRef.current = null

                // If the user didn't type in this input, don't snap on blur.
                if (!didEdit) {
                  return
                }

                if (initialValue !== null && event.target.value === initialValue) {
                  return
                }
                commitRangeValue(event.target.value, false, setRangeMax)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
              }}
            />
            <button
              type="button"
              className="range-step"
              onClick={() => stepRangeValue(rangeMax, 1, setRangeMax)}
              disabled={!hasBounds || isFullRange}
              aria-label="Increase max price"
            >
              +
            </button>
          </div>
        </div>
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
            const direction: -1 | 1 =
              Number.isFinite(parsedMin) && value < parsedMin ? -1 : 1
            const snapped = snapPriceToTick(value, direction < 0)
            const nextValue =
              snapped === null
                ? value
                : hasBounds && Number.isFinite(minBound) && Number.isFinite(maxBound)
                  ? Math.min(maxBound as number, Math.max(minBound as number, snapped))
                  : snapped
            const limitedValue = hasMiddleBound
              ? Math.min(middleBound as number, nextValue)
              : nextValue
            if (Number.isFinite(parsedMax) && limitedValue > parsedMax) {
              setRangeMax(formatRangeValue(limitedValue))
            }
            setRangeMin(formatRangeValue(limitedValue))
          }}
          disabled={!hasBounds || isFullRange}
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
            const direction: -1 | 1 =
              Number.isFinite(parsedMax) && value < parsedMax ? -1 : 1
            const snapped = snapPriceToTick(value, direction < 0)
            const nextValue =
              snapped === null
                ? value
                : hasBounds && Number.isFinite(minBound) && Number.isFinite(maxBound)
                  ? Math.min(maxBound as number, Math.max(minBound as number, snapped))
                  : snapped
            const limitedValue = hasMiddleBound
              ? Math.max(middleBound as number, nextValue)
              : nextValue
            if (Number.isFinite(parsedMin) && limitedValue < parsedMin) {
              setRangeMin(formatRangeValue(limitedValue))
            }
            setRangeMax(formatRangeValue(limitedValue))
          }}
          disabled={!hasBounds || isFullRange}
        />
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
  const amount0 = allocateData ? Number(allocateData.amount_token0) : 0
  const amount1 = allocateData ? Number(allocateData.amount_token1) : 0
  const price0 = allocateData ? Number(allocateData.price_token0_usd) : 0
  const price1 = allocateData ? Number(allocateData.price_token1_usd) : 0
  const token0Usd = amount0 * price0
  const token1Usd = amount1 * price1
  const allocatedUsdTotal = token0Usd + token1Usd
  const token0SharePct = allocatedUsdTotal > 0 ? (token0Usd / allocatedUsdTotal) * 100 : 0
  const token1SharePct = allocatedUsdTotal > 0 ? (token1Usd / allocatedUsdTotal) * 100 : 0

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
          <div className="token-main">
            <strong className="token-symbol">{token0}</strong>
            <span className="token-allocation">
              {amount0.toFixed(4)} ({token0SharePct.toFixed(2)}%)
            </span>
          </div>
          <div className="token-value">
            <strong>${token0Usd.toFixed(2)}</strong>
          </div>
        </div>
        <div className="token-row">
          <div className="token-main">
            <strong className="token-symbol">{token1}</strong>
            <span className="token-allocation">
              {amount1.toFixed(4)} ({token1SharePct.toFixed(2)}%)
            </span>
          </div>
          <div className="token-value">
            <strong>${token1Usd.toFixed(2)}</strong>
          </div>
        </div>
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
  const chainId = networkIdParam ? Number(networkIdParam) : Number.NaN
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
  const [simulateAprData, setSimulateAprData] = useState<SimulateAprResponse | null>(null)
  const [simulateAprLoading, setSimulateAprLoading] = useState(false)
  const [simulateAprError, setSimulateAprError] = useState('')

  const [allocateData, setAllocateData] = useState<AllocateResponse | null>(null)
  const [allocateLoading, setAllocateLoading] = useState(false)
  const [allocateError, setAllocateError] = useState('')
  const [poolTickSpacing, setPoolTickSpacing] = useState<number | null>(null)

  const [matchedCurrentPrice, setMatchedCurrentPrice] = useState<number | null>(null)
  const [matchedRangeKey, setMatchedRangeKey] = useState<string | null>(null)

  const [rangeMin, setRangeMin] = useState('2833,5')
  const [rangeMax, setRangeMax] = useState('3242,4')
  const [isFullRange, setIsFullRange] = useState(false)
  const [depositUsd, setDepositUsd] = useState('1000')
  const [timeframeDays, setTimeframeDays] = useState(7)
  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>(
    DEFAULT_CALCULATION_METHOD,
  )
  const [customCalculationPrice, setCustomCalculationPrice] = useState('')
  const [aprVersion, setAprVersion] = useState<SimulateAprVersion>('v1')
  const [isPairInverted, setIsPairInverted] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [isFavoritePool, setIsFavoritePool] = useState(false)
  const distributionTickRange = 20000

  const allocateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const simulateAprDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const distributionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const defaultRangeKeyRef = useRef<string | null>(null)
  const initialRangeFetchKeyRef = useRef<string | null>(null)
  const latestRangeRef = useRef<{ min: string; max: string }>({
    min: rangeMin,
    max: rangeMax,
  })
  const latestDepositRef = useRef(depositUsd)
  const latestTimeframeRef = useRef(timeframeDays)
  const latestCalculationMethodRef = useRef<CalculationMethod>(calculationMethod)
  const latestCustomCalculationPriceRef = useRef(customCalculationPrice)
  const latestAprVersionRef = useRef<SimulateAprVersion>(aprVersion)
  const latestAllocateDataRef = useRef<AllocateResponse | null>(allocateData)
  const allocateResultKeyRef = useRef<string | null>(null)
  const lastAprKeyRef = useRef<string | null>(null)
  const hasMountedRef = useRef(false)
  const snapshotDateRef = useRef(new Date().toISOString().slice(0, 10))

  const hasContext = Boolean(normalizedPoolAddress && Number.isFinite(chainId) && Number.isFinite(exchangeId))
  const activeKey = hasContext
    ? `${normalizedPoolAddress}|${chainId}|${exchangeId}`
    : ''
  const showPool = poolKey === activeKey && pool !== null
  const showError = poolErrorKey === activeKey && poolError !== ''
  const isLoading = hasContext && !showPool && !showError

  const token0Label =
    distributionData?.pool?.token0 || allocateData?.token0_symbol || pool?.token0_symbol || 'TOKEN0'
  const token1Label =
    distributionData?.pool?.token1 || allocateData?.token1_symbol || pool?.token1_symbol || 'TOKEN1'
  const displayToken0 = isPairInverted ? token1Label : token0Label
  const displayToken1 = isPairInverted ? token0Label : token1Label

  const feeTier =
    distributionData?.pool?.fee_tier ?? (Number.isFinite(pool?.fee_tier) ? pool?.fee_tier : null)
  const token0Decimals =
    distributionData?.pool?.token0_decimals ??
    (Number.isFinite(pool?.token0_decimals) ? pool?.token0_decimals : null)
  const token1Decimals =
    distributionData?.pool?.token1_decimals ??
    (Number.isFinite(pool?.token1_decimals) ? pool?.token1_decimals : null)
  const fallbackFeeTier = 3000
  const fallbackToken0Decimals = 18
  const fallbackToken1Decimals = 6
  const resolvedFeeTier = Number.isFinite(Number(feeTier)) ? Number(feeTier) : fallbackFeeTier
  const resolvedToken0Decimals = Number.isFinite(Number(token0Decimals))
    ? Number(token0Decimals)
    : fallbackToken0Decimals
  const resolvedToken1Decimals = Number.isFinite(Number(token1Decimals))
    ? Number(token1Decimals)
    : fallbackToken1Decimals
  const tickSpacingMap: Record<number, number> = {
    100: 1,
    500: 10,
    3000: 60,
    10000: 200,
  }
  const resolvedPoolTickSpacing = Number(poolTickSpacing)
  const effectiveTickSpacing =
    Number.isFinite(resolvedPoolTickSpacing) && resolvedPoolTickSpacing > 0
      ? resolvedPoolTickSpacing
      : (tickSpacingMap[resolvedFeeTier] ?? 1)
  const decimalAdjust = Math.pow(10, resolvedToken0Decimals - resolvedToken1Decimals)
  const minTickValue = useMemo(
    () => getPriceTick(parsePriceInput(rangeMin), effectiveTickSpacing, decimalAdjust, true),
    [decimalAdjust, effectiveTickSpacing, rangeMin],
  )
  const maxTickValue = useMemo(
    () => getPriceTick(parsePriceInput(rangeMax), effectiveTickSpacing, decimalAdjust, false),
    [decimalAdjust, effectiveTickSpacing, rangeMax],
  )
  const exchangeLabel =
    pool?.dex_name?.trim() ||
    exchangeNameParam?.trim() ||
    (Number.isFinite(exchangeId) ? `Exchange ${exchangeId}` : 'Unknown exchange')
  const networkLabel =
    pool?.chain_name?.trim() ||
    networkNameParam?.trim() ||
    network.trim() ||
    (Number.isFinite(chainId) ? `Network ${chainId}` : 'Unknown network')
  const feeTierLabel = formatFeeTierPercent(feeTier)
  const poolFavoriteKey = useMemo(() => {
    if (!normalizedPoolAddress) {
      return ''
    }
    return `${normalizedPoolAddress.toLowerCase()}|${pool?.dex_key ?? exchangeIdParam ?? ''}|${
      pool?.chain_key ?? networkIdParam ?? network
    }`
  }, [exchangeIdParam, network, networkIdParam, normalizedPoolAddress, pool?.chain_key, pool?.dex_key])
  const poolExplorerUrl = useMemo(
    () =>
      getPoolExplorerUrl({
        dexKey: pool?.dex_key,
        chainKey: pool?.chain_key,
        poolAddress: normalizedPoolAddress,
      }),
    [normalizedPoolAddress, pool?.chain_key, pool?.dex_key],
  )

  const {
    data: volumeHistoryData,
    loading: volumeHistoryLoading,
    error: volumeHistoryError,
    stats: volumeHistoryStats,
    summary: volumeHistorySummary,
  } = useVolumeHistory(normalizedPoolAddress, timeframeDays, {
    chainId: Number.isFinite(chainId) ? chainId : null,
    dexId: Number.isFinite(exchangeId) ? exchangeId : null,
    symbol0: pool?.token0_symbol ?? null,
    symbol1: pool?.token1_symbol ?? null,
    enabled: showPool && Boolean(normalizedPoolAddress),
  })

  const rangeBounds = useMemo<RangeBounds>(() => {
    const currentPrice = Number(poolPriceData?.status?.price ?? poolPriceData?.stats?.price)
    if (Number.isFinite(currentPrice) && currentPrice > 0) {
      return {
        min: currentPrice * 0.2,
        max: currentPrice * 1.8,
      }
    }
    return { min: null, max: null }
  }, [poolPriceData])

  const resolveRequestRange = useCallback(
    (minValue: string, maxValue: string, isFullRangeSelected: boolean) => {
      const fallbackMin = isFullRangeSelected ? rangeBounds.min : null
      const fallbackMax = isFullRangeSelected ? rangeBounds.max : null
      const parsedMin = resolveRangeValue(minValue, fallbackMin)
      const parsedMax = resolveRangeValue(maxValue, fallbackMax)
      return { parsedMin, parsedMax }
    },
    [rangeBounds.max, rangeBounds.min],
  )

  const fetchDistribution = useCallback(async () => {
    if (!pool) {
      return
    }
    setDistributionLoading(true)
    setDistributionError('')
    try {
      const { parsedMin, parsedMax } = resolveRequestRange(rangeMin, rangeMax, isFullRange)
      const payload = {
        pool_id: pool.id,
        snapshot_date: snapshotDateRef.current,
        current_tick: 0,
        tick_range: distributionTickRange,
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
  }, [isFullRange, pool, rangeMax, rangeMin, resolveRequestRange])

  const fetchAllocate = useCallback(async () => {
    if (!normalizedPoolAddress || !Number.isFinite(chainId) || !Number.isFinite(exchangeId)) {
      return
    }

    const { min: minValue, max: maxValue } = latestRangeRef.current
    const amountValue = latestDepositRef.current

    const { parsedMin, parsedMax } = resolveRequestRange(minValue, maxValue, isFullRange)
    if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax)) {
      return
    }

    const requestKey = `${normalizedPoolAddress}|${chainId}|${exchangeId}|${amountValue}|${parsedMin}|${parsedMax}|${isFullRange}`

    setAllocateLoading(true)
    setAllocateError('')
    // mark as not ready for APR until this allocation completes
    allocateResultKeyRef.current = null

    try {
      const payload = {
        pool_address: normalizedPoolAddress,
        chain_id: chainId,
        dex_id: exchangeId,
        amount: amountValue,
        range1: String(parsedMin),
        range2: String(parsedMax),
        full_range: isFullRange,
      }
      const data = await postAllocate(payload)
      setAllocateData(data)
      allocateResultKeyRef.current = requestKey
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load allocation.'
      setAllocateError(message)
      setAllocateData(null)
      allocateResultKeyRef.current = null
    } finally {
      setAllocateLoading(false)
    }
  }, [chainId, exchangeId, isFullRange, normalizedPoolAddress, resolveRequestRange])

  const fetchPoolPrice = useCallback(async () => {
    if (
      !pool ||
      !normalizedPoolAddress ||
      !Number.isFinite(chainId) ||
      !Number.isFinite(exchangeId)
    ) {
      return
    }
    setPoolPriceLoading(true)
    setPoolPriceError('')
    try {
      const requestRangeKey = `${latestRangeRef.current.min}|${latestRangeRef.current.max}`
      const data = await getPoolPrice({
        poolAddress: normalizedPoolAddress,
        chainId,
        dexId: exchangeId,
        days: timeframeDays,
      })
      setPoolPriceData(data)

      const initialPrice = Number(data?.status?.price ?? data?.stats?.price)
      const defaultRangeKey = `${normalizedPoolAddress}|${chainId}|${exchangeId}|${snapshotDateRef.current}`

      if (Number.isFinite(initialPrice) && defaultRangeKeyRef.current !== defaultRangeKey) {
        try {
          const defaultRange = await postLiquidityDistributionDefaultRange({
            pool_id: normalizedPoolAddress,
            chain_id: chainId,
            dex_id: exchangeId,
            snapshot_date: snapshotDateRef.current,
            preset: 'stable',
            initial_price: initialPrice,
            center_tick: null,
            swapped_pair: false,
          })
          const defaultTickSpacing = Number(defaultRange.tick_spacing)
          if (Number.isFinite(defaultTickSpacing) && defaultTickSpacing > 0) {
            setPoolTickSpacing(defaultTickSpacing)
          }
          const defaultMin = Number(defaultRange.min_price)
          const defaultMax = Number(defaultRange.max_price)
          if (Number.isFinite(defaultMin) && Number.isFinite(defaultMax)) {
            const currentRangeKey = `${latestRangeRef.current.min}|${latestRangeRef.current.max}`
            if (currentRangeKey !== requestRangeKey) {
              defaultRangeKeyRef.current = defaultRangeKey
              return
            }
            setRangeMin(formatRangeNumber(defaultMin))
            setRangeMax(formatRangeNumber(defaultMax))
            defaultRangeKeyRef.current = defaultRangeKey
          }
        } catch {
          // Keep existing range values when default-range is unavailable.
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load price.'
      setPoolPriceError(message)
      setPoolPriceData(null)
    } finally {
      setPoolPriceLoading(false)
    }
  }, [chainId, exchangeId, normalizedPoolAddress, pool, timeframeDays])

  useEffect(() => {
    latestRangeRef.current = { min: rangeMin, max: rangeMax }
  }, [rangeMax, rangeMin])

  useEffect(() => {
    latestDepositRef.current = depositUsd
  }, [depositUsd])

  useEffect(() => {
    latestTimeframeRef.current = timeframeDays
  }, [timeframeDays])

  useEffect(() => {
    latestCalculationMethodRef.current = calculationMethod
  }, [calculationMethod])

  useEffect(() => {
    latestCustomCalculationPriceRef.current = customCalculationPrice
  }, [customCalculationPrice])

  useEffect(() => {
    latestAprVersionRef.current = aprVersion
  }, [aprVersion])

  useEffect(() => {
    if (calculationMethod !== 'custom' && customCalculationPrice !== '') {
      setCustomCalculationPrice('')
    }
  }, [calculationMethod, customCalculationPrice])

  useEffect(() => {
    if (copyStatus === 'idle') {
      return
    }
    const timerId = window.setTimeout(() => {
      setCopyStatus('idle')
    }, 1600)
    return () => {
      window.clearTimeout(timerId)
    }
  }, [copyStatus])

  useEffect(() => {
    if (!poolFavoriteKey) {
      setIsFavoritePool(false)
      return
    }
    const favorites = readFavoritePools()
    setIsFavoritePool(favorites.includes(poolFavoriteKey))
  }, [poolFavoriteKey])

  useEffect(() => {
    latestAllocateDataRef.current = allocateData
  }, [allocateData])

  const fetchSimulateApr = useCallback(async () => {
    if (!normalizedPoolAddress || !Number.isFinite(chainId) || !Number.isFinite(exchangeId)) {
      return
    }

    const { min: minValue, max: maxValue } = latestRangeRef.current
    const depositValue = latestDepositRef.current
    const daysValue = latestTimeframeRef.current
    const selectedCalculationMethod = latestCalculationMethodRef.current
    const customPriceValueRaw = latestCustomCalculationPriceRef.current
    const selectedAprVersion = latestAprVersionRef.current
    const alloc = latestAllocateDataRef.current

    const parsedDays = Math.max(1, Math.round(daysValue))
    const parsedDeposit = Number(depositValue)
    const hasDeposit = Number.isFinite(parsedDeposit) && parsedDeposit > 0

    const { parsedMin, parsedMax } = resolveRequestRange(minValue, maxValue, isFullRange)
    const hasPriceRange = Number.isFinite(parsedMin) && Number.isFinite(parsedMax)

    if (!hasPriceRange) {
      return
    }

    let customCalculationPriceValue: number | null = null
    if (selectedCalculationMethod === 'custom') {
      const parsedCustomCalculationPrice = parsePriceInput(customPriceValueRaw)
      if (
        !Number.isFinite(parsedCustomCalculationPrice) ||
        parsedCustomCalculationPrice <= 0
      ) {
        setSimulateAprError('Custom calculation price must be greater than 0.')
        setSimulateAprData(null)
        lastAprKeyRef.current = null
        return
      }
      customCalculationPriceValue = parsedCustomCalculationPrice
    }

    // Only run APR when the allocation result matches the current inputs.
    const requestKey = `${normalizedPoolAddress}|${chainId}|${exchangeId}|${depositValue}|${parsedMin}|${parsedMax}|${isFullRange}`
    if (allocateResultKeyRef.current !== requestKey) {
      return
    }

    const amountToken0 = getSafeNumber(alloc?.amount_token0)
    const amountToken1 = getSafeNumber(alloc?.amount_token1)
    const hasAmountToken0 = Number.isFinite(amountToken0) && amountToken0 > 0
    const hasAmountToken1 = Number.isFinite(amountToken1) && amountToken1 > 0
    const tickLowerValue = getPriceTick(parsedMin, effectiveTickSpacing, decimalAdjust, true)
    const tickUpperValue = getPriceTick(parsedMax, effectiveTickSpacing, decimalAdjust, false)
    const hasTickRange =
      Number.isFinite(tickLowerValue) &&
      Number.isFinite(tickUpperValue) &&
      tickLowerValue !== null &&
      tickUpperValue !== null

    const aprKey = `${requestKey}|${selectedAprVersion}|${parsedDays}|${amountToken0}|${amountToken1}|${selectedCalculationMethod}|${customCalculationPriceValue ?? ''}`
    if (lastAprKeyRef.current === aprKey) {
      return
    }
    lastAprKeyRef.current = aprKey

    const basePayload = {
      pool_address: normalizedPoolAddress,
      chain_id: chainId,
      dex_id: exchangeId,
      ...(hasDeposit ? { deposit_usd: String(parsedDeposit) } : {}),
      ...(hasAmountToken0 ? { amount_token0: String(amountToken0) } : {}),
      ...(hasAmountToken1 ? { amount_token1: String(amountToken1) } : {}),
    }

    setSimulateAprLoading(true)
    setSimulateAprError('')
    try {
      const useTickRange = !isFullRange && hasTickRange
      const sharedPayload = {
        ...basePayload,
        tick_lower: useTickRange ? tickLowerValue : null,
        tick_upper: useTickRange ? tickUpperValue : null,
        min_price: useTickRange ? null : parsedMin,
        max_price: useTickRange ? null : parsedMax,
        full_range: isFullRange,
        horizon: `${parsedDays}d`,
        lookback_days: parsedDays,
        calculation_method: selectedCalculationMethod,
      }
      const data =
        selectedAprVersion === 'v2'
          ? await postSimulateApr(
              {
                ...sharedPayload,
                custom_calculation_price:
                  selectedCalculationMethod === 'custom' ? customCalculationPriceValue : null,
                apr_method: 'exact',
              } as SimulateAprV2Payload,
              { version: 'v2' },
            )
          : await postSimulateApr(
              {
                ...sharedPayload,
                ...(selectedCalculationMethod === 'custom'
                  ? { custom_calculation_price: customCalculationPriceValue }
                  : {}),
                mode: 'B',
              } as SimulateAprV1Payload,
              { version: 'v1' },
            )
      setSimulateAprData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to simulate APR.'
      setSimulateAprError(message)
      setSimulateAprData(null)
      // allow retry
      lastAprKeyRef.current = null
    } finally {
      setSimulateAprLoading(false)
    }
  }, [
    chainId,
    decimalAdjust,
    effectiveTickSpacing,
    exchangeId,
    isFullRange,
    normalizedPoolAddress,
    resolveRequestRange,
  ])

  useEffect(() => {
    defaultRangeKeyRef.current = null
    setPoolTickSpacing(null)
    setSimulateAprData(null)
    setSimulateAprError('')
    setSimulateAprLoading(false)
    setIsFullRange(false)
  }, [activeKey])

  useEffect(() => {
    if (!showPool || !pool) {
      return
    }
    if (distributionDebounceRef.current) {
      clearTimeout(distributionDebounceRef.current)
    }
    distributionDebounceRef.current = setTimeout(() => {
      fetchDistribution()
    }, 350)
    return () => {
      if (distributionDebounceRef.current) {
        clearTimeout(distributionDebounceRef.current)
      }
    }
  }, [fetchDistribution, pool, rangeMax, rangeMin, showPool])

  useEffect(() => {
    if (!hasContext || !normalizedPoolAddress || !Number.isFinite(chainId) || !Number.isFinite(exchangeId)) {
      return
    }

    const controller = new AbortController()

    getPoolByAddress(normalizedPoolAddress, chainId, exchangeId, controller.signal)
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
  }, [activeKey, chainId, exchangeId, hasContext, normalizedPoolAddress])

  useEffect(() => {
    if (!showPool || !pool) {
      return
    }

    // Fetch once when the pool context becomes ready (or when switching pools).
    // Avoid re-fetching here on every range change; range-driven refresh is handled by the debounced effects.
    if (initialRangeFetchKeyRef.current === activeKey) {
      return
    }

    initialRangeFetchKeyRef.current = activeKey
    fetchDistribution()
    fetchAllocate()
  }, [activeKey, fetchAllocate, fetchDistribution, pool, showPool])

  useEffect(() => {
    if (!showPool || !pool) {
      return
    }
    fetchPoolPrice()
  }, [fetchPoolPrice, pool, showPool, timeframeDays])

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
  }, [depositUsd, rangeMin, rangeMax, fetchAllocate, pool, showPool])

  useEffect(() => {
    if (!showPool || !pool) {
      return
    }
    if (simulateAprDebounceRef.current) {
      clearTimeout(simulateAprDebounceRef.current)
    }
    simulateAprDebounceRef.current = setTimeout(() => {
      fetchSimulateApr()
    }, 400)
    return () => {
      if (simulateAprDebounceRef.current) {
        clearTimeout(simulateAprDebounceRef.current)
      }
    }
  }, [
    allocateData,
    depositUsd,
    rangeMin,
    rangeMax,
    timeframeDays,
    calculationMethod,
    customCalculationPrice,
    aprVersion,
    fetchSimulateApr,
    pool,
    showPool,
  ])

  useEffect(() => {
    if (!showPool) {
      return
    }
    const rangeKey = `${rangeMin}|${rangeMax}`
    if (matchedRangeKey && matchedRangeKey !== rangeKey) {
      setMatchedCurrentPrice(null)
      setMatchedRangeKey(null)
    }
  }, [matchedRangeKey, rangeMax, rangeMin, showPool])

  const handleMatchTicks = (data: MatchTicksResponse, matchedMin: string, matchedMax: string) => {
    const currentMatched = Number(data.current_price_matched)
    if (Number.isFinite(currentMatched)) {
      setMatchedCurrentPrice(currentMatched)
    }
    setMatchedRangeKey(`${matchedMin}|${matchedMax}`)
  }

  const handleToggleFavoritePool = () => {
    if (!poolFavoriteKey) {
      return
    }
    const favorites = readFavoritePools()
    const exists = favorites.includes(poolFavoriteKey)
    const nextFavorites = exists
      ? favorites.filter((item) => item !== poolFavoriteKey)
      : [...favorites, poolFavoriteKey]
    writeFavoritePools(nextFavorites)
    setIsFavoritePool(!exists)
  }

  const handleCopyPoolAddress = async () => {
    if (!normalizedPoolAddress) {
      return
    }

    const copyWithFallback = () => {
      try {
        const textArea = document.createElement('textarea')
        textArea.value = normalizedPoolAddress
        textArea.setAttribute('readonly', '')
        textArea.style.position = 'absolute'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textArea)
        return copied
      } catch {
        return false
      }
    }

    let copied = false
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(normalizedPoolAddress)
        copied = true
      } catch {
        copied = false
      }
    }

    if (!copied) {
      copied = copyWithFallback()
    }

    setCopyStatus(copied ? 'done' : 'error')
  }

  return (
    <main className="pool-detail">
      <header className="pool-detail-header">
        <div className="pool-header-main">
          <Link className="back-link" to={backHref}>
            &larr; Back to pools
          </Link>
          <div className="pool-info-row">
            <span className="pool-pair-token">{displayToken0}</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => setIsPairInverted((prev) => !prev)}
              aria-label="Switch token direction"
              title="Switch token direction"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            <span className="pool-pair-token">{displayToken1}</span>
            <span className="badge">Exchange: {exchangeLabel}</span>
            <span className="badge">Network: {networkLabel}</span>
            <span className="badge">Fee Tier: {feeTierLabel}</span>
            <span className="badge badge-address">
              Pool: <span className="mono">{shortAddress(normalizedPoolAddress)}</span>
              <button
                type="button"
                className={`icon-button icon-button--small${
                  copyStatus === 'done'
                    ? ' icon-button--success'
                    : copyStatus === 'error'
                      ? ' icon-button--error'
                      : ''
                }`}
                onClick={handleCopyPoolAddress}
                aria-label="Copy pool address"
                title={
                  copyStatus === 'done'
                    ? 'Copied'
                    : copyStatus === 'error'
                      ? 'Copy failed'
                      : 'Copy pool address'
                }
              >
                {copyStatus === 'done' ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 13.5 9.5 18 19 7.5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect
                      x="9"
                      y="9"
                      width="11"
                      height="11"
                      rx="2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <rect
                      x="4"
                      y="4"
                      width="11"
                      height="11"
                      rx="2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                  </svg>
                )}
              </button>
            </span>
            {poolExplorerUrl ? (
              <a
                className="icon-button"
                href={poolExplorerUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open pool on exchange"
                title="Open pool on exchange"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M9 15 20 4m0 0h-7m7 0v7M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </a>
            ) : (
              <button
                type="button"
                className="icon-button"
                disabled
                aria-label="Open pool unavailable"
                title="Open pool unavailable"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M9 15 20 4m0 0h-7m7 0v7M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`icon-button favorite-icon-button${isFavoritePool ? ' is-active' : ''}`}
              onClick={handleToggleFavoritePool}
              aria-label={isFavoritePool ? 'Unfavorite pool' : 'Favorite pool'}
              title={isFavoritePool ? 'Unfavorite pool' : 'Favorite pool'}
            >
              <svg className="star-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12 3.5 2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.76 6.8 19.51l.99-5.79-4.21-4.1 5.82-.85L12 3.5z" />
              </svg>
            </button>
          </div>
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
              data={simulateAprData}
              loading={simulateAprLoading}
              error={simulateAprError}
              depositUsd={depositUsd}
            />
            <LiquidityPriceRange
              rangeMin={rangeMin}
              rangeMax={rangeMax}
              setRangeMin={setRangeMin}
              setRangeMax={setRangeMax}
              isFullRange={isFullRange}
              setIsFullRange={setIsFullRange}
              bounds={rangeBounds}
              timeframeDays={timeframeDays}
              setTimeframeDays={setTimeframeDays}
              feeTier={feeTier ?? null}
              token0Decimals={token0Decimals ?? null}
              token1Decimals={token1Decimals ?? null}
              poolTickSpacing={poolTickSpacing}
              minTickValue={minTickValue}
              maxTickValue={maxTickValue}
              calculationMethod={calculationMethod}
              setCalculationMethod={setCalculationMethod}
              customCalculationPrice={customCalculationPrice}
              setCustomCalculationPrice={setCustomCalculationPrice}
              aprVersion={aprVersion}
              setAprVersion={setAprVersion}
              poolId={pool?.id ?? null}
              onMatchTicks={handleMatchTicks}
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
            <VolumeSummaryCard
              summary={volumeHistorySummary}
              loading={volumeHistoryLoading}
              error={volumeHistoryError}
            />
          </div>
          <div className="stack">
            <LiquidityChart
              apiData={distributionData}
              loading={distributionLoading}
              error={distributionError}
              rangeMin={rangeMin}
              rangeMax={rangeMax}
              currentTick={0}
              tickRange={distributionTickRange}
            />
            <PoolPriceChart
              apiData={poolPriceData}
              loading={poolPriceLoading}
              error={poolPriceError}
              rangeMin={rangeMin}
              rangeMax={rangeMax}
              token0={token0Label}
              token1={token1Label}
              currentPriceOverride={matchedCurrentPrice}
            />
            <VolumeHistoryChart
              data={volumeHistoryData}
              loading={volumeHistoryLoading}
              error={volumeHistoryError}
              stats={volumeHistoryStats}
            />
          </div>
        </div>
      )}
    </main>
  )
}

export default PoolDetailPage
