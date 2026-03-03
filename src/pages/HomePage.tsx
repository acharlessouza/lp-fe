import { Link } from 'react-router-dom'
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

const HOME_STATS = [
  { value: '$78.7B', label: 'DeFi Market Cap' },
  { value: '$2.69B', label: 'DeFi Volume 24h' },
  { value: '202', label: 'Tracked Pools' },
  { value: '6 DEXs', label: 'Exchanges' },
]

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

function HomePage() {
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

      <div className="home-stats">
        {HOME_STATS.map((item) => (
          <article className="home-stat" key={item.label}>
            <div className="home-stat-value">{item.value}</div>
            <div className="home-stat-label">{item.label}</div>
          </article>
        ))}
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
