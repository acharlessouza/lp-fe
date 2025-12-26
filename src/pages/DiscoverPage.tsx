import { useEffect, useMemo, useState } from 'react'
import type {
  DiscoverPool,
  DiscoverPoolsResponse,
  Exchange,
  Network,
} from '../services/api'
import { getDiscoverPools, getExchanges, getNetworks } from '../services/api'
import './DiscoverPage.css'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

type TabOption = {
  id: 'overview' | 'fees' | 'liquidity'
  label: string
  orderBy: string
  orderDir: 'asc' | 'desc'
}

const tabs: TabOption[] = [
  { id: 'overview', label: 'Overview', orderBy: 'average_apr', orderDir: 'desc' },
  { id: 'fees', label: 'Fees', orderBy: 'avg_daily_fees_usd', orderDir: 'desc' },
  { id: 'liquidity', label: 'Liquidity', orderBy: 'tvl_usd', orderDir: 'desc' },
]

const formatCurrency = (value: number | string | null) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return '--'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(parsed)
}

const formatNumber = (value: number | string | null, digits = 2) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return '--'
  }
  return parsed.toFixed(digits)
}

const formatPercent = (value: number | string | null, digits = 2) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return '--'
  }
  return `${parsed.toFixed(digits)}%`
}

const formatFeeTier = (value: number | string) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return value || '--'
  }
  return `${(parsed / 10000).toFixed(2)}%`
}

const getSortState = (
  key: string,
  orderBy: string,
  orderDir: 'asc' | 'desc',
) => {
  if (orderBy !== key) {
    return ''
  }
  return orderDir === 'asc' ? 'asc' : 'desc'
}

type ComboItem<T> = {
  value: string
  label: string
  search: string
  data: T
}

type SearchableComboboxProps<T> = {
  id: string
  placeholder: string
  items: ComboItem<T>[]
  query: string
  disabled: boolean
  isLoading: boolean
  emptyMessage?: string
  onQueryChange: (value: string) => void
  onSelect: (item: ComboItem<T>) => void
}

function SearchableCombobox<T>({
  id,
  placeholder,
  items,
  query,
  disabled,
  isLoading,
  emptyMessage,
  onQueryChange,
  onSelect,
}: SearchableComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const normalizedQuery = query.trim().toLowerCase()

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items.slice(0, 80)
    }
    return items.filter((item) => item.search.includes(normalizedQuery)).slice(0, 80)
  }, [items, normalizedQuery])

  return (
    <div className="combo">
      <input
        className="combo-input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && !disabled}
        aria-controls={`${id}-list`}
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value)
          if (!open) {
            setOpen(true)
          }
        }}
        onFocus={() => {
          if (!disabled) {
            setOpen(true)
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120)
        }}
        disabled={disabled}
        autoComplete="off"
      />
      {open && !disabled && (
        <div className="combo-list" role="listbox" id={`${id}-list`}>
          {isLoading ? (
            <div className="combo-empty">Loading options...</div>
          ) : filteredItems.length === 0 ? (
            <div className="combo-empty">{emptyMessage ?? 'No matches found.'}</div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.value}
                type="button"
                className="combo-option"
                role="option"
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(item)
                  setOpen(false)
                }}
              >
                <span>{item.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function DiscoverPage() {
  const [timeframeDays, setTimeframeDays] = useState(14)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [orderBy, setOrderBy] = useState('average_apr')
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab] = useState<TabOption['id']>('overview')
  const [symbolQuery, setSymbolQuery] = useState('')

  const [data, setData] = useState<DiscoverPoolsResponse | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState('')

  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [exchangesStatus, setExchangesStatus] = useState<LoadStatus>('loading')
  const [networks, setNetworks] = useState<Network[]>([])
  const [networksStatus, setNetworksStatus] = useState<LoadStatus>('idle')
  const [exchangeId, setExchangeId] = useState<number | ''>('')
  const [exchangeQuery, setExchangeQuery] = useState('')
  const [networkId, setNetworkId] = useState<number | ''>('')
  const [networkQuery, setNetworkQuery] = useState('')

  const totalPages = useMemo(() => {
    if (!data?.total || data.total <= 0) {
      return 1
    }
    return Math.max(1, Math.ceil(data.total / pageSize))
  }, [data?.total, pageSize])

  const rows = data?.data ?? []

  const exchangeItems = useMemo(
    () =>
      exchanges.map((item) => ({
        value: String(item.id),
        label: item.name,
        search: item.name.toLowerCase(),
        data: item,
      })),
    [exchanges],
  )

  const networkItems = useMemo(
    () =>
      networks.map((item) => ({
        value: String(item.id),
        label: item.name,
        search: item.name.toLowerCase(),
        data: item,
      })),
    [networks],
  )

  useEffect(() => {
    const controller = new AbortController()
    getDiscoverPools(
      {
        network_id: networkId ? Number(networkId) : undefined,
        exchange_id: exchangeId ? Number(exchangeId) : undefined,
        token_symbol: symbolQuery.trim() || undefined,
        timeframe_days: timeframeDays,
        page,
        page_size: pageSize,
        order_by: orderBy,
        order_dir: orderDir,
      },
      controller.signal,
    )
      .then((response) => {
        setData(response)
        setStatus('success')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        const message = err instanceof Error ? err.message : 'Unable to load pools.'
        setError(message)
        setStatus('error')
      })
    return () => controller.abort()
  }, [exchangeId, networkId, orderBy, orderDir, page, pageSize, symbolQuery, timeframeDays])

  useEffect(() => {
    const controller = new AbortController()
    getExchanges(controller.signal)
      .then((response) => {
        setExchanges(response)
        setExchangesStatus('success')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setExchangesStatus('error')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!exchangeId) {
      return
    }
    const controller = new AbortController()
    getNetworks(exchangeId, controller.signal)
      .then((response) => {
        setNetworks(response)
        setNetworksStatus('success')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setNetworksStatus('error')
      })
    return () => controller.abort()
  }, [exchangeId])

  const handleExchangeQueryChange = (value: string) => {
    setExchangeQuery(value)
    if (!exchangeId) {
      return
    }
    const normalized = value.trim().toLowerCase()
    const selected = exchanges.find((item) => item.id === exchangeId)
    if (!selected || selected.name.toLowerCase() !== normalized) {
      setExchangeId('')
      setNetworkId('')
      setNetworkQuery('')
      setNetworks([])
      setNetworksStatus('idle')
    }
  }

  const handleExchangeSelect = (item: ComboItem<Exchange>) => {
    setExchangeId(item.data.id)
    setExchangeQuery(item.data.name)
    setNetworkId('')
    setNetworkQuery('')
    setNetworks([])
    setNetworksStatus('loading')
    setStatus('loading')
    setError('')
    setPage(1)
  }

  const handleNetworkQueryChange = (value: string) => {
    setNetworkQuery(value)
    if (!networkId) {
      return
    }
    const normalized = value.trim().toLowerCase()
    const selected = networks.find((item) => item.id === networkId)
    if (!selected || selected.name.toLowerCase() !== normalized) {
      setNetworkId('')
    }
  }

  const handleNetworkSelect = (item: ComboItem<Network>) => {
    setNetworkId(item.data.id)
    setNetworkQuery(item.data.name)
    setStatus('loading')
    setError('')
    setPage(1)
  }

  const handleSort = (key: string) => {
    setStatus('loading')
    setError('')
    if (orderBy === key) {
      setOrderDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setOrderBy(key)
    setOrderDir('desc')
  }

  const handleTabSelect = (tab: TabOption) => {
    setStatus('loading')
    setError('')
    setActiveTab(tab.id)
    setOrderBy(tab.orderBy)
    setOrderDir(tab.orderDir)
  }

  const handlePageChange = (nextPage: number) => {
    setStatus('loading')
    setError('')
    const clamped = Math.max(1, Math.min(totalPages, nextPage))
    setPage(clamped)
  }

  const getPoolUrl = (pool: DiscoverPool) => {
    if (!pool.pool_address || !pool.network || !pool.exchange) {
      return ''
    }
    const exchange = pool.exchange.toLowerCase()
    if (exchange.includes('uniswap')) {
      return `https://app.uniswap.org/explore/pools/${pool.network}/${pool.pool_address}`
    }
    return ''
  }

  return (
    <main className="discover-page">
      <header className="discover-hero">
        <div>
          <p className="eyebrow">Discover</p>
          <h1>Liquidity Pools</h1>
          <p className="subtext">
            Compare pools across exchanges using real-time performance metrics.
          </p>
        </div>
        <div className="hero-note">
          <span>Data freshness</span>
          <strong>Live</strong>
        </div>
      </header>

      <section className="discover-card">
        <div className="card-header">
          <div>
            <h2>Filters</h2>
            <p>Refine the discovery feed using network and exchange.</p>
          </div>
          <div className="tab-group" role="tablist" aria-label="Discover views">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => handleTabSelect(tab)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filters-grid">
          <label className="field">
            <span>Exchange</span>
            <SearchableCombobox
              id="discover-exchange"
              placeholder={
                exchangesStatus === 'loading' ? 'Loading exchanges...' : 'Select exchange'
              }
              items={exchangeItems}
              query={exchangeQuery}
              disabled={exchangesStatus === 'loading' || exchangesStatus === 'error'}
              isLoading={exchangesStatus === 'loading'}
              emptyMessage="No exchanges found."
              onQueryChange={handleExchangeQueryChange}
              onSelect={handleExchangeSelect}
            />
          </label>
          <label className="field">
            <span>Network</span>
            <SearchableCombobox
              id="discover-network"
              placeholder={
                !exchangeId
                  ? 'Select exchange first'
                  : networksStatus === 'loading'
                    ? 'Loading networks...'
                    : 'Select network'
              }
              items={networkItems}
              query={networkQuery}
              disabled={!exchangeId || networksStatus === 'loading' || networksStatus === 'error'}
              isLoading={networksStatus === 'loading'}
              emptyMessage="No networks found."
              onQueryChange={handleNetworkQueryChange}
              onSelect={handleNetworkSelect}
            />
          </label>
          <label className="field">
            <span>Timeframe (Days)</span>
            <input
              type="number"
              min="1"
              max="365"
              value={timeframeDays}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isFinite(value)) {
                  return
                }
                setTimeframeDays(Math.min(365, Math.max(1, Math.round(value))))
                setStatus('loading')
                setError('')
                setPage(1)
              }}
            />
          </label>
          <label className="field">
            <span>Token Symbol</span>
            <input
              type="text"
              value={symbolQuery}
              placeholder="Filter by symbol"
              onChange={(event) => {
                setSymbolQuery(event.target.value)
                setPage(1)
                setStatus('loading')
                setError('')
              }}
            />
          </label>
        </div>
      </section>

      <section className="discover-card">
        <div className="card-header">
          <div>
            <h2>Pools</h2>
            <p>Sorted by {orderBy.replace(/_/g, ' ')}.</p>
          </div>
          <div className="pagination-meta">
            <span>
              Page {page} of {totalPages}
            </span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setStatus('loading')
                setError('')
                setPage(1)
              }}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
          </div>
        </div>

        {status === 'loading' && <div className="state">Loading pools...</div>}
        {status === 'error' && <div className="state error">{error}</div>}
        {status === 'success' && rows.length === 0 && (
          <div className="state">No pools found for this filter.</div>
        )}

        {rows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('pool_name')}
                    >
                      Pool
                      <span
                        className={`sort-indicator ${getSortState(
                          'pool_name',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('fee_tier')}
                    >
                      Fee Tier
                      <span
                        className={`sort-indicator ${getSortState(
                          'fee_tier',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('average_apr')}
                    >
                      Avg APR
                      <span
                        className={`sort-indicator ${getSortState(
                          'average_apr',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('price_volatility')}
                    >
                      Price Volatility
                      <span
                        className={`sort-indicator ${getSortState(
                          'price_volatility',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('tvl_usd')}
                    >
                      TVL
                      <span
                        className={`sort-indicator ${getSortState(
                          'tvl_usd',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('correlation')}
                    >
                      Correlation
                      <span
                        className={`sort-indicator ${getSortState(
                          'correlation',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('avg_daily_fees_usd')}
                    >
                      AVG Daily Fees
                      <span
                        className={`sort-indicator ${getSortState(
                          'avg_daily_fees_usd',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('daily_fees_tvl_pct')}
                    >
                      Daily Fees/TVL
                      <span
                        className={`sort-indicator ${getSortState(
                          'daily_fees_tvl_pct',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('avg_daily_volume_usd')}
                    >
                      AVG Daily Volume
                      <span
                        className={`sort-indicator ${getSortState(
                          'avg_daily_volume_usd',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => handleSort('daily_volume_tvl_pct')}
                    >
                      Daily Volume/TVL
                      <span
                        className={`sort-indicator ${getSortState(
                          'daily_volume_tvl_pct',
                          orderBy,
                          orderDir,
                        )}`}
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pool: DiscoverPool) => {
                  const poolUrl = getPoolUrl(pool)
                  return (
                    <tr key={pool.pool_id}>
                      <td className="pool-name">
                        <strong>{pool.pool_name}</strong>
                      </td>
                      <td className="fee-tier-cell">
                        <div className="fee-tier-content">
                          <span>{formatFeeTier(pool.fee_tier)}</span>
                          {poolUrl ? (
                            <a
                              className="fee-tier-link"
                              href={poolUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Open pool on exchange"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zm-9 4h6v2H7v8h8v-4h2v6H5V7z"
                                  fill="currentColor"
                                />
                              </svg>
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td>{formatPercent(pool.average_apr)}</td>
                      <td>{formatPercent(pool.price_volatility)}</td>
                      <td>{formatCurrency(pool.tvl_usd)}</td>
                      <td>{formatNumber(pool.correlation)}</td>
                      <td>{formatCurrency(pool.avg_daily_fees_usd)}</td>
                      <td>{formatPercent(pool.daily_fees_tvl_pct)}</td>
                      <td>{formatCurrency(pool.avg_daily_volume_usd)}</td>
                      <td>{formatPercent(pool.daily_volume_tvl_pct)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button type="button" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
            Previous
          </button>
          <div className="page-numbers">
            {[1, 2, 3].filter((value) => value <= totalPages).map((value) => (
              <button
                key={value}
                type="button"
                className={page === value ? 'active' : ''}
                onClick={() => handlePageChange(value)}
              >
                {value}
              </button>
            ))}
            {totalPages > 4 && <span className="ellipsis">...</span>}
            {totalPages > 3 && (
              <button
                type="button"
                className={page === totalPages ? 'active' : ''}
                onClick={() => handlePageChange(totalPages)}
              >
                {totalPages}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  )
}

export default DiscoverPage
