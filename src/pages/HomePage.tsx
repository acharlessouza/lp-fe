import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMarketSummary } from '../hooks/useMarketSummary'
import './HomePage.css'

const TICKER_ITEMS = [
  { pair: 'ETH/USDC', delta: '▲ 2.34%', trend: 'up' },
  { pair: 'WBTC/ETH', delta: '▼ 0.78%', trend: 'down' },
  { pair: 'USDT/USDC', delta: '▲ 0.01%', trend: 'up' },
  { pair: 'ARB/ETH', delta: '▲ 5.12%', trend: 'up' },
  { pair: 'OP/USDC', delta: '▼ 1.44%', trend: 'down' },
  { pair: 'LINK/ETH', delta: '▲ 3.20%', trend: 'up' },
  { pair: 'UNI/USDC', delta: '▲ 1.87%', trend: 'up' },
  { pair: 'MATIC/USDC', delta: '▲ 4.55%', trend: 'up' },
]

const MARKET_SUMMARY_ITEMS = [
  { key: 'defiMarketCap', title: 'DeFi Market Cap' },
  { key: 'dexVolume24h', title: 'DEX Volume (24h)' },
  { key: 'stablecoinMarketCap', title: 'Stablecoin Market Cap' },
  { key: 'dexFees24h', title: 'DEX Fees (24h)' },
] as const

const FEATURE_CARDS = [
  {
    icon: '🔭',
    title: 'Radar',
    description:
      'Browse pools ranked by APR, TVL, and fee efficiency across multiple DEXs and EVM networks.',
  },
  {
    icon: '⚡',
    title: 'Simulate',
    description:
      'Model any Uniswap V3 position with realistic fee projections based on historical on-chain volume.',
  },
  {
    icon: '📊',
    title: 'Track',
    description:
      'Monitor all your open positions in real time. Fees earned, impermanent loss, and rebalance alerts.',
    soon: true,
  },
]

const getUpdatedLabel = (updatedAt: string, now: number) => {
  const timestamp = new Date(updatedAt).getTime()
  if (!Number.isFinite(timestamp)) {
    return 'Updated recently'
  }

  const diffMinutes = Math.max(0, Math.floor((now - timestamp) / 60000))

  if (diffMinutes < 1) {
    return 'Updated just now'
  }

  if (diffMinutes < 60) {
    return `Updated ${diffMinutes} min ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `Updated ${diffHours} hr ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `Updated ${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

function HomePage() {
  const { data: marketSummary, loading: marketSummaryLoading, error: marketSummaryError } =
    useMarketSummary()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const marketCards = useMemo(
    () =>
      MARKET_SUMMARY_ITEMS.map((item) => {
        const metric = marketSummary?.data[item.key]
        return {
          key: item.key,
          title: item.title,
          value: metric?.displayValue ?? '--',
          updatedLabel: metric
            ? getUpdatedLabel(metric.updatedAt, now)
            : marketSummaryError
              ? 'Temporarily unavailable'
              : 'Updated recently',
        }
      }),
    [marketSummary, marketSummaryError, now],
  )

  return (
    <section className="home-page">
      <div className="home-ticker" aria-hidden="true">
        <div className="home-ticker-inner">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
            <span className="home-tick-item" key={`${item.pair}-${index}`}>
              {item.pair}{' '}
              <span className={item.trend === 'up' ? 'home-tick-up' : 'home-tick-down'}>
                {item.delta}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="home-hero">
        <div className="home-hero-beam" />
        <div className="home-hero-beam2" />
        <div className="home-pill">⬡ Professional LP Workspace</div>
        <h1>
          LP smarter on
          <br />
          <span>every chain</span>
        </h1>
        <p className="home-hero-sub">
          Radar top liquidity pools, model your APR scenarios and track performance, all from
          one focused workspace.
        </p>
        <div className="home-hero-ctas">
          <Link className="btn btn-cta btn-lg" to="/radar">
            Explore Pools →
          </Link>
          <Link className="btn btn-outline btn-lg" to="/simulate">
            Run Simulation
          </Link>
        </div>
      </div>

      <div className="home-stats-wrap">
        {marketSummaryError ? (
          <div className="home-stats-notice home-stats-notice-error" role="status">
            Market summary is temporarily unavailable. Showing fallback values.
          </div>
        ) : null}
        {marketSummary?.meta.isStale ? (
          <div className="home-stats-notice" role="status">
            Market data may be delayed.
          </div>
        ) : null}

        <div className="home-stats" aria-busy={marketSummaryLoading}>
          {marketCards.map((item) => (
            <article className="home-stat" key={item.key}>
              {marketSummaryLoading ? (
                <>
                  <div className="home-stat-skeleton home-stat-skeleton-title" />
                  <div className="home-stat-skeleton home-stat-skeleton-value" />
                  <div className="home-stat-skeleton home-stat-skeleton-meta" />
                </>
              ) : (
                <>
                  <div className="home-stat-title">{item.title}</div>
                  <div className="home-stat-value">{item.value}</div>
                  <div className="home-stat-meta">{item.updatedLabel}</div>
                </>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="home-features-wrap">
        <h2>Everything you need to LP smarter</h2>
        <div className="home-features-grid">
          {FEATURE_CARDS.map((feature) => (
            <article className="home-feature" key={feature.title}>
              <div className="home-feature-icon">{feature.icon}</div>
              <h3>
                {feature.title}{' '}
                {feature.soon ? <span className="home-feature-badge">soon</span> : null}
              </h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HomePage
