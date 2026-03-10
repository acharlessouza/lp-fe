import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  DiscoverPool,
  DiscoverPoolsResponse,
  Exchange,
  Network,
} from '../services/api'
import { favoritePool, getDiscoverPools, getExchanges, getNetworks, unfavoritePool } from '../services/api'
import './DiscoverPage.css'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

type TabOption = {
  id: 'overview' | 'fees' | 'liquidity'
  label: string
  orderBy: string
  orderDir: 'asc' | 'desc'
}

type OptionalColumnKey = 'col-vol' | 'col-fees' | 'col-feespc' | 'col-corr' | 'col-vol2'

type ColumnVisibility = Record<OptionalColumnKey, boolean>

const TABS: TabOption[] = [
  { id: 'overview', label: 'Overview', orderBy: 'average_apr', orderDir: 'desc' },
  { id: 'fees', label: 'Fees', orderBy: 'avg_daily_fees_usd', orderDir: 'desc' },
  { id: 'liquidity', label: 'Liquidity', orderBy: 'tvl_usd', orderDir: 'desc' },
]

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  'col-vol': true,
  'col-fees': true,
  'col-feespc': true,
  'col-corr': true,
  'col-vol2': true,
}

const OPTIONAL_COLUMNS: Array<{ id: OptionalColumnKey; label: string }> = [
  { id: 'col-vol', label: 'Daily Vol/TVL' },
  { id: 'col-fees', label: 'Avg Daily Fees' },
  { id: 'col-feespc', label: 'Daily Fees/TVL' },
  { id: 'col-corr', label: 'Correlation' },
  { id: 'col-vol2', label: 'Avg Daily Volume' },
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

const formatPercent = (value: number | string | null, digits = 2) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return '--'
  }
  return `${parsed.toFixed(digits)}%`
}

const formatNumber = (value: number | string | null, digits = 2) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return '--'
  }
  return parsed.toFixed(digits)
}

const getSortLabel = (orderBy: string, orderDir: 'asc' | 'desc') => {
  const labels: Record<string, string> = {
    average_apr: 'Average APR',
    avg_daily_fees_usd: 'Average Daily Fees',
    tvl_usd: 'TVL',
    price_volatility: 'Price Volatility',
    correlation: 'Correlation',
    daily_fees_tvl_pct: 'Fees/TVL',
    avg_daily_volume_usd: 'Average Daily Volume',
    daily_volume_tvl_pct: 'Volume/TVL',
  }

  const name = labels[orderBy] ?? orderBy.replace(/_/g, ' ')
  return `${name} (${orderDir})`
}

const parsePoolTokens = (poolName: string) => {
  const separators = ['/', '-', ':']
  for (const separator of separators) {
    if (poolName.includes(separator)) {
      const [left, right] = poolName.split(separator).map((item) => item.trim())
      if (left && right) {
        return [left, right] as const
      }
    }
  }
  return [poolName.trim() || 'Token A', 'Token B'] as const
}

const getPoolTokenSymbols = (pool: DiscoverPool) => {
  const token0 = pool.token0_symbol?.trim()
  const token1 = pool.token1_symbol?.trim()
  if (token0 && token1) {
    return [token0, token1] as const
  }
  return parsePoolTokens(pool.pool_name)
}

const parseOptionalNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getFavoritePoolKey = (pool: DiscoverPool) => {
  const poolAddress = pool.pool_address?.trim()
  const chainId = parseOptionalNumber(pool.chain_id)
  const exchangeId = parseOptionalNumber(pool.dex_id)

  if (!poolAddress || !chainId || !exchangeId) {
    return ''
  }

  return `${poolAddress}|${chainId}|${exchangeId}`
}

const getTokenClass = (symbol: string) => {
  const normalized = symbol.toLowerCase()
  if (normalized.includes('eth')) {
    return 'eth'
  }
  if (normalized.includes('usdc') || normalized.includes('usd')) {
    return 'usdc'
  }
  if (normalized.includes('btc')) {
    return 'btc'
  }
  if (normalized.includes('arb')) {
    return 'arb'
  }
  if (normalized.includes('usdt')) {
    return 'usdt'
  }
  return ''
}

const getVisiblePages = (currentPage: number, totalPages: number) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
  return Array.from(pages)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b)
}

function DiscoverPage() {
  const [timeframeDays, setTimeframeDays] = useState(14)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [orderBy, setOrderBy] = useState('average_apr')
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab] = useState<TabOption['id']>('overview')
  const [searchQuery, setSearchQuery] = useState('')

  const [data, setData] = useState<DiscoverPoolsResponse | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState('')

  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [exchangesStatus, setExchangesStatus] = useState<LoadStatus>('loading')
  const [exchangesError, setExchangesError] = useState('')
  const [networks, setNetworks] = useState<Network[]>([])
  const [networksStatus, setNetworksStatus] = useState<LoadStatus>('idle')
  const [networksError, setNetworksError] = useState('')

  const [exchangeId, setExchangeId] = useState<number | ''>('')
  const [networkId, setNetworkId] = useState<number | ''>('')

  const [showFavorites, setShowFavorites] = useState(false)
  const [topPoolsTotal, setTopPoolsTotal] = useState<number | null>(null)
  const [favoritePoolsTotal, setFavoritePoolsTotal] = useState<number | null>(null)
  const [favoriteError, setFavoriteError] = useState('')
  const [favoritePendingKeys, setFavoritePendingKeys] = useState<Set<string>>(() => new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibility>(DEFAULT_COLUMN_VISIBILITY)
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false)

  const columnMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!columnMenuRef.current) {
        return
      }
      if (!columnMenuRef.current.contains(event.target as Node)) {
        setIsColumnMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const requestParams = {
      network_id: networkId ? Number(networkId) : undefined,
      exchange_id: exchangeId ? Number(exchangeId) : undefined,
      token_symbol: searchQuery.trim() || undefined,
      timeframe_days: timeframeDays,
      page,
      page_size: pageSize,
      order_by: orderBy,
      order_dir: orderDir,
      favorites_only: showFavorites,
    }

    setStatus('loading')
    setFavoriteError('')

    getDiscoverPools(
      requestParams,
      controller.signal,
    )
      .then((response) => {
        setData(response)
        setStatus('success')
        if (showFavorites) {
          setFavoritePoolsTotal(response.total)
        } else {
          setTopPoolsTotal(response.total)
        }
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load pools.')
        setStatus('error')
      })

    return () => controller.abort()
  }, [
    exchangeId,
    networkId,
    orderBy,
    orderDir,
    page,
    pageSize,
    refreshKey,
    searchQuery,
    showFavorites,
    timeframeDays,
  ])

  useEffect(() => {
    const controller = new AbortController()

    setExchangesStatus('loading')
    setExchangesError('')

    getExchanges(controller.signal)
      .then((response) => {
        setExchanges(response)
        setExchangesStatus('success')
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }
        setExchangesStatus('error')
        setExchangesError(
          fetchError instanceof Error ? fetchError.message : 'Unable to load exchanges.',
        )
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!exchangeId) {
      setNetworks([])
      setNetworksStatus('idle')
      setNetworksError('')
      return
    }

    const controller = new AbortController()

    setNetworksStatus('loading')
    setNetworksError('')

    getNetworks(Number(exchangeId), controller.signal)
      .then((response) => {
        setNetworks(response)
        setNetworksStatus('success')
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }
        setNetworksStatus('error')
        setNetworksError(
          fetchError instanceof Error ? fetchError.message : 'Unable to load networks.',
        )
      })

    return () => controller.abort()
  }, [exchangeId])

  useEffect(() => {
    const controller = new AbortController()

    getDiscoverPools(
      {
        network_id: networkId ? Number(networkId) : undefined,
        exchange_id: exchangeId ? Number(exchangeId) : undefined,
        token_symbol: searchQuery.trim() || undefined,
        timeframe_days: timeframeDays,
        page: 1,
        page_size: 1,
        favorites_only: !showFavorites,
      },
      controller.signal,
    )
      .then((response) => {
        if (showFavorites) {
          setTopPoolsTotal(response.total)
          return
        }
        setFavoritePoolsTotal(response.total)
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }
        if (showFavorites) {
          setTopPoolsTotal(null)
          return
        }
        setFavoritePoolsTotal(null)
      })

    return () => controller.abort()
  }, [exchangeId, networkId, refreshKey, searchQuery, showFavorites, timeframeDays])

  const rows = data?.data ?? []

  const totalPages = useMemo(() => {
    if (status !== 'success' || !data?.total || data.total <= 0) {
      return 1
    }
    return Math.max(1, Math.ceil(data.total / pageSize))
  }, [data?.total, pageSize, status])

  const topPoolsCount =
    !showFavorites && status === 'success' ? (data?.total ?? topPoolsTotal ?? rows.length) : topPoolsTotal
  const favoriteCount =
    showFavorites && status === 'success'
      ? (data?.total ?? favoritePoolsTotal ?? rows.length)
      : favoritePoolsTotal

  const searchedRows = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) {
      return rows
    }

    return rows.filter((pool) => {
      const poolName = pool.pool_name?.toLowerCase() ?? ''
      const exchangeName = pool.exchange?.toLowerCase() ?? ''
      const networkName = pool.network?.toLowerCase() ?? ''
      return (
        poolName.includes(normalized) ||
        exchangeName.includes(normalized) ||
        networkName.includes(normalized)
      )
    })
  }, [rows, searchQuery])

  const visibleRows = status === 'success' ? searchedRows : []

  const currentExchange = useMemo(
    () => exchanges.find((exchange) => exchange.id === exchangeId) ?? null,
    [exchangeId, exchanges],
  )

  const currentNetwork = useMemo(
    () => networks.find((network) => network.id === networkId) ?? null,
    [networkId, networks],
  )

  const visibleOptionalColumnCount = OPTIONAL_COLUMNS.filter(
    (column) => columnVisibility[column.id],
  ).length

  const selectedColumnCount = 3 + visibleOptionalColumnCount

  const visiblePages = getVisiblePages(page, totalPages)

  const getSortIndicator = (key: string) => {
    if (orderBy !== key) {
      return '↕'
    }
    return orderDir === 'asc' ? '▲' : '▼'
  }

  const handleSort = (key: string) => {
    setStatus('loading')
    setError('')

    if (orderBy === key) {
      setOrderDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setOrderBy(key)
    setOrderDir('desc')
  }

  const handleTabSelect = (tab: TabOption) => {
    setActiveTab(tab.id)
    setOrderBy(tab.orderBy)
    setOrderDir(tab.orderDir)
    setPage(1)
    setStatus('loading')
    setError('')
  }

  const handlePageChange = (nextPage: number) => {
    const clampedPage = Math.max(1, Math.min(totalPages, nextPage))
    if (clampedPage === page) {
      return
    }
    setPage(clampedPage)
    setStatus('loading')
    setError('')
  }

  const toggleColumn = (columnId: OptionalColumnKey) => {
    setColumnVisibility((current) => ({
      ...current,
      [columnId]: !current[columnId],
    }))
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setExchangeId('')
    setNetworkId('')
    setTimeframeDays(14)
    setPage(1)
    setPageSize(10)
    setShowFavorites(false)
    setStatus('loading')
    setError('')
    setFavoriteError('')
  }

  const handleFavoritesTabChange = (nextShowFavorites: boolean) => {
    if (nextShowFavorites === showFavorites) {
      return
    }

    setShowFavorites(nextShowFavorites)
    setPage(1)
    setStatus('loading')
    setError('')
    setFavoriteError('')
  }

  const getPoolDetailsHref = (pool: DiscoverPool) => {
    if (!pool.pool_address) {
      return ''
    }

    const resolvedExchangeId = parseOptionalNumber(pool.dex_id) ?? parseOptionalNumber(exchangeId)
    const resolvedNetworkId = parseOptionalNumber(pool.chain_id) ?? parseOptionalNumber(networkId)

    if (!resolvedExchangeId || !resolvedNetworkId) {
      return ''
    }

    const [token0Symbol, token1Symbol] = getPoolTokenSymbols(pool)

    const query = new URLSearchParams({
      exchange_id: String(resolvedExchangeId),
      network_id: String(resolvedNetworkId),
      token0_symbol: token0Symbol,
      token1_symbol: token1Symbol,
    })

    if (pool.token0_address?.trim()) {
      query.set('token0', pool.token0_address.trim())
    }
    if (pool.token1_address?.trim()) {
      query.set('token1', pool.token1_address.trim())
    }
    if (pool.token0_icon_url?.trim()) {
      query.set('token0_icon_url', pool.token0_icon_url.trim())
    }
    if (pool.token1_icon_url?.trim()) {
      query.set('token1_icon_url', pool.token1_icon_url.trim())
    }

    const exchangeName = pool.exchange?.trim() || currentExchange?.name?.trim()
    if (exchangeName) {
      query.set('exchange_name', exchangeName)
    }

    const networkName = pool.network?.trim() || currentNetwork?.name?.trim()
    if (networkName) {
      query.set('network_name', networkName)
    }

    return `/simulate/pools/${encodeURIComponent(pool.pool_address)}?${query.toString()}`
  }

  const handleToggleFavorite = async (pool: DiscoverPool) => {
    const poolAddress = pool.pool_address?.trim()
    const chainId = parseOptionalNumber(pool.chain_id)
    const exchangeIdValue = parseOptionalNumber(pool.dex_id)
    const favoriteKey = getFavoritePoolKey(pool)

    if (!poolAddress || !chainId || !exchangeIdValue || !favoriteKey) {
      return
    }

    if (favoritePendingKeys.has(favoriteKey)) {
      return
    }

    setFavoriteError('')
    setFavoritePendingKeys((current) => {
      const next = new Set(current)
      next.add(favoriteKey)
      return next
    })

    try {
      const response = pool.isFavorited
        ? await unfavoritePool(poolAddress, chainId, exchangeIdValue)
        : await favoritePool(poolAddress, chainId, exchangeIdValue)

      const nextIsFavorited = response.isFavorited
      const favoriteDelta = nextIsFavorited === pool.isFavorited ? 0 : nextIsFavorited ? 1 : -1
      const removingFromFavoritesView = showFavorites && pool.isFavorited && !nextIsFavorited
      const removedLastVisibleRow = removingFromFavoritesView && visibleRows.length === 1 && page > 1

      setData((current) => {
        if (!current) {
          return current
        }

        const nextRows = removingFromFavoritesView
          ? current.data.filter((row) => getFavoritePoolKey(row) !== favoriteKey)
          : current.data.map((row) =>
              getFavoritePoolKey(row) === favoriteKey ? { ...row, isFavorited: nextIsFavorited } : row,
            )

        return {
          ...current,
          total: removingFromFavoritesView ? Math.max(0, current.total - 1) : current.total,
          data: nextRows,
        }
      })

      if (favoriteDelta !== 0) {
        setFavoritePoolsTotal((current) =>
          current === null ? current : Math.max(0, current + favoriteDelta),
        )
      }

      if (removedLastVisibleRow) {
        setPage((current) => Math.max(1, current - 1))
      }

      setRefreshKey((current) => current + 1)
    } catch (actionError) {
      setFavoriteError(
        actionError instanceof Error ? actionError.message : 'Unable to update favorite.',
      )
    } finally {
      setFavoritePendingKeys((current) => {
        const next = new Set(current)
        next.delete(favoriteKey)
        return next
      })
    }
  }

  const topPoolsCountLabel = topPoolsCount ?? '...'
  const favoriteCountLabel = favoriteCount ?? '...'

  return (
    <main className="discover-page">
      <div className="discover-wrap">
        <div className="flex aic jb mb16 discover-header-row">
          <div className="flex aic g12 discover-title-wrap">
            <h1 className="discover-title">Radar</h1>
            <div className="tabs" id="discoverTabs" role="tablist" aria-label="Radar tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`tb${activeTab === tab.id ? ' on' : ''}`}
                  onClick={() => handleTabSelect(tab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <span className="dim small mono">
            {showFavorites ? favoriteCountLabel : topPoolsCountLabel} pools
          </span>
        </div>

        <div className="flex aic g8 mb16 discover-filters-row">
          <div className="inp-icon-wrap discover-search">
            <svg
              className="inp-icon"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="inp"
              type="text"
              placeholder="Search token or pool..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setPage(1)
                setStatus('loading')
                setError('')
              }}
            />
          </div>

          <div className="sel-wrap discover-select">
            <select
              className="inp sel"
              value={exchangeId}
              onChange={(event) => {
                const nextExchangeId = event.target.value ? Number(event.target.value) : ''
                setExchangeId(nextExchangeId)
                setNetworkId('')
                setPage(1)
                setStatus('loading')
                setError('')
              }}
              disabled={exchangesStatus === 'loading'}
            >
              <option value="">
                {exchangesStatus === 'loading' ? 'Loading exchanges...' : 'All Exchanges'}
              </option>
              {exchanges.map((exchange) => (
                <option key={exchange.id} value={exchange.id}>
                  {exchange.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sel-wrap discover-select discover-select-network">
            <select
              className="inp sel"
              value={networkId}
              onChange={(event) => {
                const nextNetworkId = event.target.value ? Number(event.target.value) : ''
                setNetworkId(nextNetworkId)
                setPage(1)
                setStatus('loading')
                setError('')
              }}
              disabled={!exchangeId || networksStatus === 'loading' || networksStatus === 'error'}
            >
              <option value="">
                {!exchangeId
                  ? 'All Networks'
                  : networksStatus === 'loading'
                    ? 'Loading networks...'
                    : networksStatus === 'error'
                      ? 'Unable to load networks'
                      : 'All Networks'}
              </option>
              {networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sel-wrap discover-select discover-select-timeframe">
            <select
              className="inp sel"
              value={timeframeDays}
              onChange={(event) => {
                const value = Number(event.target.value)
                setTimeframeDays(value)
                setPage(1)
                setStatus('loading')
                setError('')
              }}
            >
              <option value={14}>Timeframe: 14 days</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          <button type="button" className="btn btn-ghost btn-sm" onClick={handleResetFilters}>
            Reset
          </button>
        </div>

        {(exchangesStatus === 'error' || networksStatus === 'error') && (
          <div className="discover-state error mb16">
            {exchangesStatus === 'error' ? exchangesError : networksError}
          </div>
        )}

        {favoriteError && <div className="discover-state error mb16">{favoriteError}</div>}

        <div className="card discover-table-card">
          <div className="discover-table-toolbar">
            <div className="flex g8 aic">
              <button
                type="button"
                className={`tb${showFavorites ? '' : ' on'}`}
                onClick={() => handleFavoritesTabChange(false)}
              >
                Top Pools (<span>{topPoolsCountLabel}</span>)
              </button>
              <button
                type="button"
                className={`tb${showFavorites ? ' on' : ''}`}
                onClick={() => handleFavoritesTabChange(true)}
              >
                ⭐ Favorites (<span>{favoriteCountLabel}</span>)
              </button>
            </div>

            <div className="col-wrap" ref={columnMenuRef}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsColumnMenuOpen((current) => !current)}
              >
                Columns (<span>{selectedColumnCount}</span>/8) ▾
              </button>
              <div className={`col-dropdown${isColumnMenuOpen ? ' open' : ''}`}>
                <div className="col-dropdown-title">Toggle columns</div>
                {OPTIONAL_COLUMNS.map((column) => (
                  <button
                    key={column.id}
                    type="button"
                    className="col-row"
                    onClick={() => toggleColumn(column.id)}
                  >
                    <span>{column.label}</span>
                    <div className={`col-check${columnVisibility[column.id] ? ' on' : ''}`}>
                      {columnVisibility[column.id] ? '✓' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="tbl-wrap mt8" id="tableArea">
            <div className="discover-tab-hint">
              Sorted by: <span>{getSortLabel(orderBy, orderDir)}</span>
            </div>

            {status === 'loading' && <div className="discover-state">Loading pools...</div>}
            {status === 'error' && <div className="discover-state error">{error}</div>}
            {status === 'success' && visibleRows.length === 0 && (
              <div className="discover-state">No pools found for this filter.</div>
            )}

            {visibleRows.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 28 }} />
                    <th>Pool</th>
                    <th
                      className={orderBy === 'average_apr' ? 'sort-on' : ''}
                      onClick={() => handleSort('average_apr')}
                    >
                      Avg APR <span className="sarr">{getSortIndicator('average_apr')}</span>
                    </th>
                    <th
                      className={orderBy === 'price_volatility' ? 'sort-on' : ''}
                      onClick={() => handleSort('price_volatility')}
                    >
                      Price Volatility <span className="sarr">{getSortIndicator('price_volatility')}</span>
                    </th>
                    <th
                      className={orderBy === 'tvl_usd' ? 'sort-on' : ''}
                      onClick={() => handleSort('tvl_usd')}
                    >
                      TVL <span className="sarr">{getSortIndicator('tvl_usd')}</span>
                    </th>
                    <th
                      className={`${columnVisibility['col-corr'] ? '' : 'hidden-col'} ${orderBy === 'correlation' ? 'sort-on' : ''}`.trim()}
                      onClick={() => handleSort('correlation')}
                    >
                      Correlation <span className="sarr">{getSortIndicator('correlation')}</span>
                    </th>
                    <th
                      className={`${columnVisibility['col-fees'] ? '' : 'hidden-col'} ${orderBy === 'avg_daily_fees_usd' ? 'sort-on' : ''}`.trim()}
                      onClick={() => handleSort('avg_daily_fees_usd')}
                    >
                      Avg Daily Fees <span className="sarr">{getSortIndicator('avg_daily_fees_usd')}</span>
                    </th>
                    <th
                      className={`${columnVisibility['col-feespc'] ? '' : 'hidden-col'} ${orderBy === 'daily_fees_tvl_pct' ? 'sort-on' : ''}`.trim()}
                      onClick={() => handleSort('daily_fees_tvl_pct')}
                    >
                      Fees/TVL <span className="sarr">{getSortIndicator('daily_fees_tvl_pct')}</span>
                    </th>
                    <th
                      className={`${columnVisibility['col-vol2'] ? '' : 'hidden-col'} ${orderBy === 'avg_daily_volume_usd' ? 'sort-on' : ''}`.trim()}
                      onClick={() => handleSort('avg_daily_volume_usd')}
                    >
                      Avg Daily Vol <span className="sarr">{getSortIndicator('avg_daily_volume_usd')}</span>
                    </th>
                    <th
                      className={`${columnVisibility['col-vol'] ? '' : 'hidden-col'} ${orderBy === 'daily_volume_tvl_pct' ? 'sort-on' : ''}`.trim()}
                      onClick={() => handleSort('daily_volume_tvl_pct')}
                    >
                      Vol/TVL <span className="sarr">{getSortIndicator('daily_volume_tvl_pct')}</span>
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((pool) => {
                    const isFavorite = pool.isFavorited
                    const favoriteKey = getFavoritePoolKey(pool)
                    const isFavoritePending = favoritePendingKeys.has(favoriteKey)
                    const [token0Symbol, token1Symbol] = getPoolTokenSymbols(pool)
                    const detailsHref = getPoolDetailsHref(pool)
                    const simulateHref = detailsHref || '/simulate'
                    const hasDirectSimulationRoute = Boolean(detailsHref)

                    return (
                      <tr key={pool.pool_id}>
                        <td>
                          <button
                            type="button"
                            className={`fav-btn${isFavorite ? ' on' : ''}`}
                            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            onClick={() => {
                              void handleToggleFavorite(pool)
                            }}
                            disabled={isFavoritePending}
                          >
                            {isFavorite ? '★' : '☆'}
                          </button>
                        </td>
                        <td>
                          <div className="pool-cell">
                            <div className="tikons" aria-hidden="true">
                              <div className={`tikon ${getTokenClass(token0Symbol)}`}>
                                {pool.token0_icon_url ? (
                                  <img src={pool.token0_icon_url} alt="" loading="lazy" />
                                ) : (
                                  token0Symbol.slice(0, 1).toUpperCase()
                                )}
                              </div>
                              <div className={`tikon ${getTokenClass(token1Symbol)}`}>
                                {pool.token1_icon_url ? (
                                  <img src={pool.token1_icon_url} alt="" loading="lazy" />
                                ) : (
                                  token1Symbol.slice(0, 1).toUpperCase()
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="bold">{pool.pool_name || `${token0Symbol} / ${token1Symbol}`}</div>
                              <div className="dim small">{pool.exchange ?? '--'} · {pool.network ?? '--'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="apr-v">{formatPercent(pool.average_apr)}</td>
                        <td className="vol-v">{formatPercent(pool.price_volatility)}</td>
                        <td className="tvl-v">{formatCurrency(pool.tvl_usd)}</td>
                        <td className={columnVisibility['col-corr'] ? '' : 'hidden-col'}>
                          {formatNumber(pool.correlation)}
                        </td>
                        <td className={columnVisibility['col-fees'] ? '' : 'hidden-col'}>
                          {formatCurrency(pool.avg_daily_fees_usd)}
                        </td>
                        <td className={columnVisibility['col-feespc'] ? '' : 'hidden-col'}>
                          {formatPercent(pool.daily_fees_tvl_pct)}
                        </td>
                        <td className={columnVisibility['col-vol2'] ? '' : 'hidden-col'}>
                          {formatCurrency(pool.avg_daily_volume_usd)}
                        </td>
                        <td className={columnVisibility['col-vol'] ? '' : 'hidden-col'}>
                          {formatPercent(pool.daily_volume_tvl_pct)}
                        </td>
                        <td>
                          <Link
                            className={`row-act-btn${hasDirectSimulationRoute ? '' : ' row-act-btn-fallback'}`}
                            to={simulateHref}
                            aria-label={
                              hasDirectSimulationRoute
                                ? 'Open simulation for this pool'
                                : 'Open simulation page'
                            }
                          >
                            Simulate →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="discover-pagination-wrap">
            <div className="pag">
              <button
                type="button"
                className="pgb"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                ‹
              </button>

              {visiblePages.map((visiblePage, index) => {
                const previousPage = visiblePages[index - 1]
                const shouldRenderGap = previousPage !== undefined && visiblePage - previousPage > 1

                return (
                  <div key={visiblePage} className="pag-item">
                    {shouldRenderGap ? <span className="dim pag-gap">…</span> : null}
                    <button
                      type="button"
                      className={`pgb${page === visiblePage ? ' on' : ''}`}
                      onClick={() => handlePageChange(visiblePage)}
                    >
                      {visiblePage}
                    </button>
                  </div>
                )
              })}

              <button
                type="button"
                className="pgb"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                ›
              </button>

              <div className="sel-wrap discover-page-size-wrap">
                <select
                  className="inp sel discover-page-size"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(1)
                    setStatus('loading')
                    setError('')
                  }}
                >
                  <option value={10}>10/page</option>
                  <option value={25}>25/page</option>
                  <option value={50}>50/page</option>
                  <option value={100}>100/page</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default DiscoverPage
