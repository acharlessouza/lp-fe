import { useMemo, useState } from 'react'
import type { VolumeHistoryPoint, VolumeHistoryStats } from '../hooks/useVolumeHistory'
import './VolumeHistoryChart.css'

type VolumeHistoryChartProps = {
  data: VolumeHistoryPoint[]
  loading: boolean
  error: string
  stats: VolumeHistoryStats
}

const formatDateUtc = (epochSeconds: number) => {
  const date = new Date(epochSeconds * 1000)
  if (!Number.isFinite(date.getTime())) {
    return '--'
  }
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatUtcDay = (epochSeconds: number) => {
  const date = new Date(epochSeconds * 1000)
  if (!Number.isFinite(date.getTime())) {
    return '--'
  }
  return String(date.getUTCDate())
}

const compactUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
})

const fullUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const formatCompactUsd = (value: number | null) =>
  value === null || !Number.isFinite(value) ? '--' : compactUsdFormatter.format(value)

const formatFullUsd = (value: number | null) =>
  value === null || !Number.isFinite(value) ? '--' : fullUsdFormatter.format(value)

const formatAxisVolume = (value: number) => {
  if (!Number.isFinite(value)) {
    return '--'
  }
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}b`
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}m`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(2)}k`
  }
  return value.toFixed(2)
}

export function VolumeHistoryChart({ data, loading, error, stats }: VolumeHistoryChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const chartModel = useMemo(() => {
    const labels = data.map((point) => formatDateUtc(point.time))
    const dayLabels = data.map((point) => formatUtcDay(point.time))
    const dataset = data.map((point) => point.value)
    return { labels, dayLabels, dataset }
  }, [data])

  const width = 820
  const height = 300
  const paddingLeft = 60
  const paddingRight = 16
  const paddingTop = 24
  const paddingBottom = 42
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const maxValue = chartModel.dataset.length ? Math.max(...chartModel.dataset, 1) : 1
  const slotWidth = chartModel.dataset.length ? chartWidth / chartModel.dataset.length : chartWidth
  const barWidth = Math.max(2, slotWidth * 0.72)
  const tickStep = Math.max(1, Math.ceil(chartModel.dayLabels.length / 7))
  const axisTickIndexes = chartModel.dayLabels
    .map((_, index) => index)
    .filter(
      (index) =>
        index === 0 || index === chartModel.dayLabels.length - 1 || index % tickStep === 0,
    )

  const yAxisTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => {
    const value = maxValue * ratio
    const y = paddingTop + (1 - ratio) * chartHeight
    return { value, y }
  })

  const hoverPoint =
    hoverIndex !== null && data[hoverIndex]
      ? {
          ...data[hoverIndex],
          label: chartModel.labels[hoverIndex] ?? '--',
          x: paddingLeft + hoverIndex * slotWidth + slotWidth / 2,
        }
      : null

  return (
    <div className="card volume-history-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Volume History</div>
          <div className="subtitle">Closed UTC days only (today excluded)</div>
        </div>
      </div>

      <div className="volume-stats">
        <div className="volume-stat">
          <span>MIN</span>
          <strong>{formatCompactUsd(stats.min)}</strong>
        </div>
        <div className="volume-stat">
          <span>AVG</span>
          <strong>{formatCompactUsd(stats.avg)}</strong>
        </div>
        <div className="volume-stat">
          <span>MAX</span>
          <strong>{formatCompactUsd(stats.max)}</strong>
        </div>
      </div>

      {loading ? <div className="volume-state">Loading...</div> : null}
      {!loading && error ? <div className="volume-state error">{error}</div> : null}
      {!loading && !error && !data.length ? (
        <div className="volume-state">No data in selected period.</div>
      ) : null}

      {!loading && !error && data.length ? (
        <div className="volume-chart">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="volume-chart-svg"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <rect x="0" y="0" width={width} height={height} rx="14" fill="var(--chart-bg)" />
            {yAxisTicks.map((tick, index) => (
              <g key={`y-axis-${index}`}>
                <line
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={tick.y}
                  y2={tick.y}
                  className="volume-grid-line"
                />
                <text
                  x={paddingLeft - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--muted)"
                >
                  {formatAxisVolume(tick.value)}
                </text>
              </g>
            ))}
            {chartModel.dataset.map((value, index) => {
              const xCenter = paddingLeft + index * slotWidth + slotWidth / 2
              const barHeight = Math.max(1, (value / maxValue) * chartHeight)
              const y = paddingTop + (chartHeight - barHeight)
              const x = xCenter - barWidth / 2
              const isActive = hoverIndex === index
              return (
                <g key={`${chartModel.labels[index]}-${index}`} onMouseEnter={() => setHoverIndex(index)}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="3"
                    fill={isActive ? 'rgba(42, 157, 143, 0.95)' : 'rgba(42, 157, 143, 0.72)'}
                  />
                </g>
              )
            })}
            {hoverPoint ? (
              <line
                x1={hoverPoint.x}
                x2={hoverPoint.x}
                y1={paddingTop}
                y2={height - paddingBottom}
                className="volume-hover-line"
                strokeWidth="1"
              />
            ) : null}
            {axisTickIndexes.map((index) => {
              const label = chartModel.dayLabels[index]
              const xCenter = paddingLeft + index * slotWidth + slotWidth / 2
              return (
                <text
                  key={`${label}-${index}`}
                  x={xCenter}
                  y={height - 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--muted)"
                >
                  {label}
                </text>
              )
            })}
          </svg>

          {hoverPoint ? (
            <div className="volume-tooltip" style={{ left: `${hoverPoint.x}px` }}>
              <div className="volume-tooltip-date">{hoverPoint.label}</div>
              <div>Volume: {formatFullUsd(hoverPoint.value)}</div>
              <div>Fees: {formatFullUsd(hoverPoint.feesUsd)}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
