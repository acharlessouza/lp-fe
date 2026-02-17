import type { VolumeHistorySummary } from '../hooks/useVolumeHistory'
import './VolumeSummaryCard.css'

type VolumeSummaryCardProps = {
  summary: VolumeHistorySummary | null
  loading: boolean
  error: string
}

const compactUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
})

const formatUsdCompact = (value: number | null) =>
  value === null || !Number.isFinite(value) ? '--' : compactUsdFormatter.format(value)

const formatPercent = (value: number | null) =>
  value === null || !Number.isFinite(value) ? '--' : `${value.toFixed(2)}%`

export function VolumeSummaryCard({ summary, loading, error }: VolumeSummaryCardProps) {
  return (
    <div className="card volume-summary-card">
      <div className="volume-summary-header">
        <div className="volume-summary-title">Volume Summary</div>
        <div className="subtitle">{loading ? 'Loading...' : error ? 'API error' : ''}</div>
      </div>

      {!loading && !error && !summary ? (
        <div className="volume-summary-empty">No summary data.</div>
      ) : null}

      {summary ? (
        <div className="volume-summary-grid">
          <div className="volume-summary-item">
            <span>TVL</span>
            <strong>{formatUsdCompact(summary.tvlUsd)}</strong>
          </div>
          <div className="volume-summary-item">
            <span>Avg Daily Fees</span>
            <strong>{formatUsdCompact(summary.avgDailyFeesUsd)}</strong>
          </div>
          <div className="volume-summary-item">
            <span>Daily Fees / TVL</span>
            <strong>{formatPercent(summary.dailyFeesTvlPct)}</strong>
          </div>
          <div className="volume-summary-item">
            <span>Avg Daily Volume</span>
            <strong>{formatUsdCompact(summary.avgDailyVolumeUsd)}</strong>
          </div>
          <div className="volume-summary-item">
            <span>Daily Volume / TVL</span>
            <strong>{formatPercent(summary.dailyVolumeTvlPct)}</strong>
          </div>
        </div>
      ) : null}
    </div>
  )
}
