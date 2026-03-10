import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMarketSummary } from '../hooks/useMarketSummary'
import type { Exchange, Network, Pool, RecentlyViewedPool, Token } from '../services/api'
import {
  getExchanges,
  getNetworks,
  getPoolByAddress,
  getPools,
  getRecentlyViewedPools,
  getTokens,
} from '../services/api'
import './SimulatePage.css'

type Mode = 'pair' | 'address'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

const MARKET_SUMMARY_ITEMS = [
  { key: 'defiMarketCap', title: 'DeFi Market Cap' },
  { key: 'dexVolume24h', title: 'DEX Volume (24h)' },
  { key: 'stablecoinMarketCap', title: 'Stablecoin Market Cap' },
  { key: 'dexFees24h', title: 'DEX Fees (24h)' },
] as const

const shortAddress = (address: string) => {
  if (!address) {
    return ''
  }
  if (address.length <= 10) {
    return address
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const tokenDisplayValue = (token: Token) =>
  token.symbol ?? token.name ?? 'Unknown token'

const tokenOptionLabel = (token: Token) => {
  if (token.symbol) {
    return token.symbol
  }
  return token.name ?? 'Unknown token'
}

const tokenSearchValue = (token: Token) =>
  `${token.symbol ?? ''} ${token.name ?? ''} ${token.address}`.toLowerCase()

const getIconUrl = (value: { icon_url?: string | null } | { iconUrl?: string | null }) => {
  const raw =
    ('icon_url' in value ? value.icon_url : undefined) ??
    ('iconUrl' in value ? value.iconUrl : undefined)
  if (typeof raw !== 'string') {
    return null
  }
  const trimmed = raw.trim()
  return trimmed ? trimmed : null
}

const getTokenIconUrl = (token: Token) => getIconUrl(token)

type ComboItem<T> = {
  value: string
  label: string
  search: string
  data: T
  iconUrl?: string | null
}

type SearchableComboboxProps<T> = {
  id: string
  placeholder: string
  items: ComboItem<T>[]
  query: string
  disabled: boolean
  isLoading: boolean
  emptyMessage?: string
  showIcons?: boolean
  selectedIconUrl?: string | null
  selectedIconAlt?: string
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
  showIcons = false,
  selectedIconUrl,
  selectedIconAlt,
  onQueryChange,
  onSelect,
}: SearchableComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const normalizedQuery = query.trim().toLowerCase()

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items.slice(0, 80)
    }
    return items
      .filter((item) => item.search.includes(normalizedQuery))
      .slice(0, 80)
  }, [items, normalizedQuery])

  return (
    <div className="combo">
      {showIcons && selectedIconUrl ? (
        <span className="combo-leading-icon" aria-hidden="true">
          <img src={selectedIconUrl} alt={selectedIconAlt ?? ''} />
        </span>
      ) : null}
      <input
        className={`combo-input${showIcons && selectedIconUrl ? ' has-leading-icon' : ''}`}
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
                {showIcons ? (
                  <span className="combo-option-media" aria-hidden="true">
                    {item.iconUrl ? (
                      <img src={item.iconUrl} alt="" />
                    ) : (
                      <span className="combo-option-fallback">
                        {item.label.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                ) : null}
                <span>{item.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const poolLabel = (pool: Pool, fallbackIndex: number) => {
  if (pool.name) {
    return pool.name
  }
  if (pool.address) {
    return shortAddress(pool.address)
  }
  if (pool.id !== undefined && pool.id !== null) {
    return `Pool ${pool.id}`
  }
  return `Pool ${fallbackIndex + 1}`
}

const formatFeeTier = (pool: Pool) => {
  const rawFee =
    (pool as { fee_tier?: number | string }).fee_tier ??
    (pool as { feeTier?: number | string }).feeTier ??
    pool.fee
  const feeValue = Number(rawFee)
  if (!Number.isFinite(feeValue)) {
    return 'Fee --'
  }
  const percentage = feeValue / 10000
  return `Fee ${percentage.toFixed(2)}%`
}

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

const getViewedLabel = (viewedAt: string, now: number) => {
  const timestamp = new Date(viewedAt).getTime()
  if (!Number.isFinite(timestamp)) {
    return 'Viewed recently'
  }

  const diffMinutes = Math.max(0, Math.floor((now - timestamp) / 60000))

  if (diffMinutes < 1) {
    return 'Viewed just now'
  }

  if (diffMinutes < 60) {
    return `Viewed ${diffMinutes} min ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `Viewed ${diffHours} hr ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `Viewed ${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

const getPoolPairText = (
  pool: Pool,
  fallbackToken0?: string,
  fallbackToken1?: string,
  fallbackIndex?: number,
) => {
  const poolToken0 =
    ((pool as { token0_symbol?: string }).token0_symbol as string | undefined) ??
    (pool.token0?.symbol as string | undefined)
  const poolToken1 =
    ((pool as { token1_symbol?: string }).token1_symbol as string | undefined) ??
    (pool.token1?.symbol as string | undefined)

  if (poolToken0 && poolToken1) {
    return `${poolToken0} / ${poolToken1}`
  }
  if (fallbackToken0 && fallbackToken1) {
    return `${fallbackToken0} / ${fallbackToken1}`
  }
  return poolLabel(pool, fallbackIndex ?? 0)
}

const getPoolSubLabel = (pool: Pool) => {
  const name = typeof pool.name === 'string' ? pool.name : ''
  if (name && !name.includes('/')) {
    return name
  }
  const address =
    typeof pool.address === 'string'
      ? pool.address
      : typeof (pool as { pool_address?: string }).pool_address === 'string'
        ? ((pool as { pool_address?: string }).pool_address as string)
        : ''
  if (address) {
    return shortAddress(address)
  }
  return 'Pool details'
}

function SimulatePage() {
  const [mode, setMode] = useState<Mode>('pair')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { data: marketSummary, loading: marketSummaryLoading, error: marketSummaryError } =
    useMarketSummary()

  const exchangeParam = searchParams.get('exchange_id')
  const networkParam = searchParams.get('network_id')
  const token0Param = searchParams.get('token0') ?? ''
  const token1Param = searchParams.get('token1') ?? ''
  const exchangeValue = exchangeParam ? Number(exchangeParam) : Number.NaN
  const networkValue = networkParam ? Number(networkParam) : Number.NaN
  const initialExchangeId = Number.isFinite(exchangeValue) ? exchangeValue : ''
  const initialNetworkId = Number.isFinite(networkValue) ? networkValue : ''
  const initialExchangeQuery = searchParams.get('exchange_name') ?? ''
  const initialNetworkQuery = searchParams.get('network_name') ?? ''
  const initialToken0Query =
    searchParams.get('token0_symbol') ?? (token0Param ? shortAddress(token0Param) : '')
  const initialToken1Query =
    searchParams.get('token1_symbol') ?? (token1Param ? shortAddress(token1Param) : '')
  const initialPoolsStatus: LoadStatus =
    token0Param && token1Param && token0Param !== token1Param ? 'loading' : 'idle'

  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [exchangesStatus, setExchangesStatus] = useState<LoadStatus>('loading')
  const [exchangesError, setExchangesError] = useState('')

  const [exchangeId, setExchangeId] = useState<number | ''>(initialExchangeId)
  const [exchangeQuery, setExchangeQuery] = useState(initialExchangeQuery)

  const [networks, setNetworks] = useState<Network[]>([])
  const [networksStatus, setNetworksStatus] = useState<LoadStatus>('idle')
  const [networksError, setNetworksError] = useState('')

  const [networkId, setNetworkId] = useState<number | ''>(initialNetworkId)
  const [networkQuery, setNetworkQuery] = useState(initialNetworkQuery)

  const [tokens, setTokens] = useState<Token[]>([])
  const [tokensStatus, setTokensStatus] = useState<LoadStatus>('idle')
  const [tokensError, setTokensError] = useState('')
  const [pairTokens, setPairTokens] = useState<Token[]>([])
  const [pairTokensStatus, setPairTokensStatus] = useState<LoadStatus>('idle')
  const [pairTokensError, setPairTokensError] = useState('')

  const [token0, setToken0] = useState(token0Param)
  const [token1, setToken1] = useState(token1Param)
  const [token0Query, setToken0Query] = useState(initialToken0Query)
  const [token1Query, setToken1Query] = useState(initialToken1Query)
  const [poolAddressQuery, setPoolAddressQuery] = useState('')
  const [addressSearchStatus, setAddressSearchStatus] = useState<LoadStatus>('idle')
  const [addressSearchError, setAddressSearchError] = useState('')

  const [pools, setPools] = useState<Pool[]>([])
  const [poolsStatus, setPoolsStatus] = useState<LoadStatus>(initialPoolsStatus)
  const [poolsError, setPoolsError] = useState('')
  const [recentlyViewedPools, setRecentlyViewedPools] = useState<RecentlyViewedPool[]>([])
  const [recentlyViewedStatus, setRecentlyViewedStatus] = useState<LoadStatus>('idle')
  const addressSearchAbortRef = useRef<AbortController | null>(null)
  const [marketNow, setMarketNow] = useState(() => Date.now())

  const sameToken = token0 !== '' && token0 === token1
  const trimmedPoolAddressQuery = poolAddressQuery.trim()

  const orderedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => {
      const left = a.symbol ?? a.name ?? a.address
      const right = b.symbol ?? b.name ?? b.address
      return left.localeCompare(right)
    })
  }, [tokens])

  const orderedPairTokens = useMemo(() => {
    return [...pairTokens].sort((a, b) => {
      const left = a.symbol ?? a.name ?? a.address
      const right = b.symbol ?? b.name ?? b.address
      return left.localeCompare(right)
    })
  }, [pairTokens])

  const exchangeItems = useMemo(
    () =>
      exchanges.map((exchange) => ({
        value: String(exchange.id),
        label: exchange.name,
        search: exchange.name.toLowerCase(),
        data: exchange,
        iconUrl: getIconUrl(exchange),
      })),
    [exchanges],
  )

  const networkItems = useMemo(
    () =>
      networks.map((network) => ({
        value: String(network.id),
        label: network.name,
        search: network.name.toLowerCase(),
        data: network,
        iconUrl: getIconUrl(network),
      })),
    [networks],
  )

  const tokenItems = useMemo(
    () =>
      orderedTokens.map((token) => ({
        value: token.address,
        label: tokenOptionLabel(token),
        search: tokenSearchValue(token),
        data: token,
        iconUrl: getTokenIconUrl(token),
      })),
    [orderedTokens],
  )

  const pairTokenItems = useMemo(
    () =>
      orderedPairTokens.map((token) => ({
        value: token.address,
        label: tokenOptionLabel(token),
        search: tokenSearchValue(token),
        data: token,
        iconUrl: getTokenIconUrl(token),
      })),
    [orderedPairTokens],
  )

  const selectedToken0 = tokens.find((token) => token.address === token0)
  const selectedToken1 =
    pairTokens.find((token) => token.address === token1) ??
    tokens.find((token) => token.address === token1)
  const selectedExchange = exchanges.find((exchange) => exchange.id === exchangeId)
  const selectedNetwork = networks.find((network) => network.id === networkId)

  const getRecentlyViewedPoolHref = (pool: RecentlyViewedPool) => {
    const params = new URLSearchParams({
      exchange_id: String(pool.exchange_id),
      network: pool.pool.chain_name || String(pool.chain_id),
      network_id: String(pool.chain_id),
      token0: pool.pool.token0_address,
      token1: pool.pool.token1_address,
      token0_symbol: pool.pool.token0_symbol,
      token1_symbol: pool.pool.token1_symbol,
    })

    if (pool.pool.dex_name?.trim()) {
      params.set('exchange_name', pool.pool.dex_name.trim())
    }
    if (pool.pool.chain_name?.trim()) {
      params.set('network_name', pool.pool.chain_name.trim())
    }
    if (pool.pool.token0_icon_url?.trim()) {
      params.set('token0_icon_url', pool.pool.token0_icon_url.trim())
    }
    if (pool.pool.token1_icon_url?.trim()) {
      params.set('token1_icon_url', pool.pool.token1_icon_url.trim())
    }

    return `/simulate/pools/${encodeURIComponent(pool.pool_address)}?${params.toString()}`
  }

  const basePoolDetailsQuery = useMemo(() => {
    if (!exchangeId) {
      return ''
    }
    const networkParam =
      selectedNetwork?.name ||
      (selectedNetwork?.chain_id ? String(selectedNetwork.chain_id) : '') ||
      (networkId ? String(networkId) : '')
    if (!networkParam) {
      return ''
    }
    const params = new URLSearchParams({
      exchange_id: String(exchangeId),
      network: networkParam,
    })
    if (networkId) {
      params.set('network_id', String(networkId))
    }
    if (selectedExchange?.name) {
      params.set('exchange_name', selectedExchange.name)
    }
    if (selectedNetwork?.name) {
      params.set('network_name', selectedNetwork.name)
    }
    return params.toString()
  }, [exchangeId, networkId, selectedExchange, selectedNetwork])

  const poolDetailsQuery = useMemo(() => {
    if (!basePoolDetailsQuery) {
      return ''
    }
    const params = new URLSearchParams(basePoolDetailsQuery)
    if (token0) {
      params.set('token0', token0)
    }
    if (token1) {
      params.set('token1', token1)
    }
    if (selectedToken0) {
      params.set('token0_symbol', tokenOptionLabel(selectedToken0))
      const token0IconUrl = getTokenIconUrl(selectedToken0)
      if (token0IconUrl) {
        params.set('token0_icon_url', token0IconUrl)
      }
    }
    if (selectedToken1) {
      params.set('token1_symbol', tokenOptionLabel(selectedToken1))
      const token1IconUrl = getTokenIconUrl(selectedToken1)
      if (token1IconUrl) {
        params.set('token1_icon_url', token1IconUrl)
      }
    }
    return params.toString()
  }, [
    basePoolDetailsQuery,
    selectedToken0,
    selectedToken1,
    token0,
    token1,
  ])

  const resolvePoolAddress = (pool: Pool) =>
    pool.address ?? (pool as { pool_address?: string }).pool_address ?? ''

  const getPoolDetailsHref = (address?: string, query = poolDetailsQuery) => {
    if (!address || !query) {
      return ''
    }
    return `/simulate/pools/${encodeURIComponent(address)}?${query}`
  }

  const resetPools = () => {
    setPools([])
    setPoolsStatus('idle')
    setPoolsError('')
  }

  const resetAddressSearchFeedback = () => {
    setAddressSearchStatus('idle')
    setAddressSearchError('')
  }

  const resetPairTokens = () => {
    setPairTokens([])
    setPairTokensStatus('idle')
    setPairTokensError('')
    setToken1('')
    setToken1Query('')
  }

  const resetTokens = () => {
    setTokens([])
    setTokensStatus('idle')
    setTokensError('')
    setToken0('')
    setToken1('')
    setToken0Query('')
    setToken1Query('')
    setPairTokens([])
    setPairTokensStatus('idle')
    setPairTokensError('')
    resetPools()
  }

  const resetNetworks = () => {
    setNetworks([])
    setNetworksStatus('idle')
    setNetworksError('')
    setNetworkId('')
    setNetworkQuery('')
    resetTokens()
  }

  const handleExchangeQueryChange = (value: string) => {
    setExchangeQuery(value)

    if (!exchangeId) {
      return
    }

    const normalized = value.trim().toLowerCase()
    if (!selectedExchange || selectedExchange.name.toLowerCase() !== normalized) {
      setExchangeId('')
      resetNetworks()
    }
  }

  const handleExchangeSelect = (item: ComboItem<Exchange>) => {
    resetNetworks()
    resetAddressSearchFeedback()
    setExchangeId(item.data.id)
    setExchangeQuery(item.data.name)
    setNetworksStatus('loading')
    setNetworksError('')
  }

  const handleNetworkQueryChange = (value: string) => {
    setNetworkQuery(value)

    if (!networkId) {
      return
    }

    const normalized = value.trim().toLowerCase()
    if (!selectedNetwork || selectedNetwork.name.toLowerCase() !== normalized) {
      setNetworkId('')
      resetTokens()
    }
  }

  const handleNetworkSelect = (item: ComboItem<Network>) => {
    resetTokens()
    resetAddressSearchFeedback()
    setNetworkId(item.data.id)
    setNetworkQuery(item.data.name)
    if (mode === 'pair') {
      setTokensStatus('loading')
      setTokensError('')
    }
  }

  const maybeStartPoolsFetch = (nextToken0: string, nextToken1: string) => {
    if (nextToken0 && nextToken1 && nextToken0 !== nextToken1) {
      setPoolsStatus('loading')
    }
  }

  const matchesSelectedToken = (value: string, token: Token | undefined) => {
    if (!token) {
      return false
    }
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return false
    }
    if (token.address.toLowerCase() === normalized) {
      return true
    }
    if (token.symbol && token.symbol.toLowerCase() === normalized) {
      return true
    }
    if (token.name && token.name.toLowerCase() === normalized) {
      return true
    }
    if (tokenDisplayValue(token).toLowerCase() === normalized) {
      return true
    }
    if (tokenOptionLabel(token).toLowerCase() === normalized) {
      return true
    }
    return false
  }

  const handleToken0QueryChange = (value: string) => {
    setToken0Query(value)
    resetPools()

    if (matchesSelectedToken(value, selectedToken0)) {
      return
    }

    if (!value.trim()) {
      setToken0('')
      resetPairTokens()
      return
    }

    setToken0('')
    resetPairTokens()
  }

  const handleToken1QueryChange = (value: string) => {
    setToken1Query(value)
    resetPools()

    if (matchesSelectedToken(value, selectedToken1)) {
      return
    }

    if (!value.trim()) {
      setToken1('')
      return
    }

    setToken1('')
  }

  const handleToken0Select = (item: ComboItem<Token>) => {
    setToken0(item.data.address)
    setToken0Query(tokenDisplayValue(item.data))
    resetPairTokens()
    setPairTokensStatus('loading')
    setPairTokensError('')
    resetPools()
  }

  const handleToken1Select = (item: ComboItem<Token>) => {
    setToken1(item.data.address)
    setToken1Query(tokenDisplayValue(item.data))
    resetPools()
    maybeStartPoolsFetch(token0, item.data.address)
  }

  const handleModeChange = (nextMode: Mode) => {
    if (nextMode === mode) {
      return
    }

    setMode(nextMode)

    if (nextMode !== 'pair') {
      return
    }

    if (exchangeId && networkId && tokensStatus === 'idle') {
      setTokensStatus('loading')
      setTokensError('')
    }

    if (exchangeId && networkId && token0 && pairTokensStatus === 'idle') {
      setPairTokensStatus('loading')
      setPairTokensError('')
    }

    if (exchangeId && networkId && token0 && token1 && !sameToken && poolsStatus === 'idle') {
      setPoolsStatus('loading')
      setPoolsError('')
    }
  }

  const handlePoolAddressQueryChange = (value: string) => {
    setPoolAddressQuery(value)
    if (addressSearchStatus !== 'idle' || addressSearchError) {
      resetAddressSearchFeedback()
    }
  }

  const getAddressSearchErrorMessage = (message: string) => {
    const normalized = message.trim().toLowerCase()
    if (!normalized) {
      return 'Unable to find this pool. Please try again.'
    }
    if (normalized.includes('not found') || normalized.includes('404')) {
      return 'No pool was found for this address on the selected exchange and network.'
    }
    if (normalized.includes('unable to reach the server')) {
      return 'Unable to reach the server. Please try again.'
    }
    return message
  }

  const handleAddressSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!exchangeId || !networkId) {
      setAddressSearchStatus('error')
      setAddressSearchError('Select an exchange and a network before searching by address.')
      return
    }

    if (!trimmedPoolAddressQuery) {
      setAddressSearchStatus('error')
      setAddressSearchError('Enter a pool address.')
      return
    }

    addressSearchAbortRef.current?.abort()
    const controller = new AbortController()
    addressSearchAbortRef.current = controller

    setAddressSearchStatus('loading')
    setAddressSearchError('')

    getPoolByAddress(trimmedPoolAddressQuery, networkId, exchangeId, controller.signal)
      .then(() => {
        if (controller.signal.aborted) {
          return
        }
        addressSearchAbortRef.current = null
        setAddressSearchStatus('success')
        const href = getPoolDetailsHref(trimmedPoolAddressQuery, basePoolDetailsQuery)
        navigate(href || `/simulate/pools/${encodeURIComponent(trimmedPoolAddressQuery)}`)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        addressSearchAbortRef.current = null
        setAddressSearchStatus('error')
        setAddressSearchError(
          getAddressSearchErrorMessage(
            error instanceof Error ? error.message : 'Unable to find this pool. Please try again.',
          ),
        )
      })
  }

  useEffect(() => {
    return () => {
      addressSearchAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMarketNow(Date.now())
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setRecentlyViewedPools([])
      setRecentlyViewedStatus('idle')
      return
    }

    const controller = new AbortController()

    setRecentlyViewedStatus('loading')

    getRecentlyViewedPools(10, controller.signal)
      .then((response) => {
        setRecentlyViewedPools(response.data ?? [])
        setRecentlyViewedStatus('success')
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setRecentlyViewedPools([])
        setRecentlyViewedStatus('error')
      })

    return () => controller.abort()
  }, [authLoading, isAuthenticated])

  useEffect(() => {
    const controller = new AbortController()

    getExchanges(controller.signal)
      .then((data) => {
        setExchanges(data)
        setExchangesStatus('success')
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setExchangesStatus('error')
        setExchangesError(error.message)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!exchangeId) {
      return
    }

    const controller = new AbortController()

    getNetworks(exchangeId, controller.signal)
      .then((data) => {
        setNetworks(data)
        setNetworksStatus('success')
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setNetworksStatus('error')
        setNetworksError(error.message)
      })

    return () => controller.abort()
  }, [exchangeId])

  useEffect(() => {
    if (mode !== 'pair' || !exchangeId || !networkId) {
      return
    }

    const controller = new AbortController()

    getTokens(exchangeId, networkId, { signal: controller.signal })
      .then((data) => {
        setTokens(data)
        setTokensStatus('success')
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setTokensStatus('error')
        setTokensError(error.message)
      })

    return () => controller.abort()
  }, [exchangeId, mode, networkId])

  useEffect(() => {
    if (mode !== 'pair' || !exchangeId || !networkId || !token0) {
      return
    }

    const controller = new AbortController()

    getTokens(exchangeId, networkId, {
      token: token0,
      signal: controller.signal,
    })
      .then((data) => {
        setPairTokens(data)
        setPairTokensStatus('success')
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setPairTokensStatus('error')
        setPairTokensError(error.message)
      })

    return () => controller.abort()
  }, [exchangeId, mode, networkId, token0])

  useEffect(() => {
    if (mode !== 'pair' || !exchangeId || !networkId || !token0 || !token1 || sameToken) {
      return
    }

    const controller = new AbortController()

    getPools(exchangeId, networkId, token0, token1, controller.signal)
      .then((data) => {
        setPools(data)
        setPoolsStatus('success')
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setPoolsStatus('error')
        setPoolsError(error.message)
      })

    return () => controller.abort()
  }, [exchangeId, mode, networkId, token0, token1, sameToken])

  const selectedToken0Label = selectedToken0 ? tokenOptionLabel(selectedToken0) : ''
  const selectedToken1Label = selectedToken1 ? tokenOptionLabel(selectedToken1) : ''
  const selectedPairLabel =
    selectedToken0Label && selectedToken1Label
      ? `${selectedToken0Label} / ${selectedToken1Label}`
      : 'Select a token pair'
  const poolFoundMessage =
    mode === 'address'
      ? !exchangeId || !networkId
        ? 'Select an exchange and a network to search by pool address.'
        : !trimmedPoolAddressQuery
          ? 'Enter a pool address to open the simulation.'
          : addressSearchStatus === 'loading'
            ? 'Looking up the pool address...'
            : addressSearchStatus === 'error'
              ? addressSearchError || 'Unable to find this pool.'
              : 'Open the simulation directly when you know the exact pool address.'
      : !token0 || !token1
        ? 'Select token A and token B to search pools.'
        : sameToken
          ? 'Token A and Token B must be different.'
          : poolsStatus === 'loading'
            ? `Searching pools for ${selectedPairLabel}...`
            : poolsStatus === 'success'
              ? `${pools.length} pool${pools.length === 1 ? '' : 's'} found for ${selectedPairLabel}`
              : 'Matching pools will appear here.'

  const poolsReady = poolsStatus === 'success' && pools.length > 0
  const shouldShowRecentlyViewedSection =
    recentlyViewedStatus === 'loading' ||
    (recentlyViewedStatus === 'success' && recentlyViewedPools.length > 0)
  const marketCards = useMemo(
    () =>
      MARKET_SUMMARY_ITEMS.map((item) => {
        const metric = marketSummary?.data[item.key]
        return {
          key: item.key,
          title: item.title,
          value: metric?.displayValue ?? '--',
          updatedLabel: metric
            ? getUpdatedLabel(metric.updatedAt, marketNow)
            : marketSummaryError
              ? 'Temporarily unavailable'
              : 'Updated recently',
        }
      }),
    [marketNow, marketSummary, marketSummaryError],
  )

  return (
    <main className="simulate-page simulate-screen">
      <section className="simulate-head reveal">
        <div className="simulate-head-row">
          <h1>Simulate</h1>
          <div className="simulate-tabs" role="tablist" aria-label="Simulation products">
            <button type="button" className="simulate-tab is-active" role="tab" aria-selected="true">
              Liquidity Pools
            </button>
            <button type="button" className="simulate-tab" disabled aria-disabled="true">
              Options <span className="soon-badge">soon</span>
            </button>
          </div>
          <div className="simulate-view-toggle" role="tablist" aria-label="Simulation mode">
            <button
              type="button"
              className={`simulate-view-btn${mode === 'pair' ? ' is-active' : ''}`}
              onClick={() => setMode('pair')}
            >
              Pair
            </button>
            <button type="button" className="simulate-view-btn" disabled aria-disabled="true">
              Build
            </button>
          </div>
        </div>
      </section>

      <section className="simulate-market-wrap reveal delay-1" aria-label="Market indicators">
        {marketSummaryError ? (
          <div className="simulate-market-notice simulate-market-notice-error" role="status">
            Market summary is temporarily unavailable. Showing fallback values.
          </div>
        ) : null}
        {marketSummary?.meta.isStale ? (
          <div className="simulate-market-notice" role="status">
            Market data may be delayed.
          </div>
        ) : null}

        <div className="simulate-market">
          {marketCards.map((item) => (
            <div className="market-card" key={item.key}>
              {marketSummaryLoading ? (
                <div className="market-skeleton-group" aria-hidden="true">
                  <div className="market-skeleton market-skeleton-label" />
                  <div className="market-skeleton market-skeleton-value" />
                  <div className="market-skeleton market-skeleton-sub" />
                </div>
              ) : (
                <>
                  <div className="market-label">{item.title}</div>
                  <div className="market-value">{item.value}</div>
                  <div className="market-sub">{item.updatedLabel}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="simulate-layout reveal delay-2">
        <div className="simulate-panel">
          <div className="simulate-panel-title">Pool Selection</div>

          <div className="simulate-seg" role="tablist" aria-label="Selection method">
            <button
              type="button"
              className={`simulate-seg-btn${mode === 'pair' ? ' is-active' : ''}`}
              onClick={() => handleModeChange('pair')}
            >
              By Pair
            </button>
            <button
              type="button"
              className={`simulate-seg-btn${mode === 'address' ? ' is-active' : ''}`}
              onClick={() => handleModeChange('address')}
            >
              By Address
            </button>
          </div>

          <div className="simulate-field">
            <label htmlFor="exchange">Exchange</label>
            <SearchableCombobox
              id="exchange"
              placeholder={
                exchangesStatus === 'loading' ? 'Loading exchanges...' : 'Select exchange'
              }
              items={exchangeItems}
              query={exchangeQuery}
              disabled={exchangesStatus === 'loading' || exchangesStatus === 'error'}
              isLoading={exchangesStatus === 'loading'}
              emptyMessage="No exchanges found."
              showIcons
              selectedIconUrl={selectedExchange ? getIconUrl(selectedExchange) : null}
              selectedIconAlt={selectedExchange?.name ?? 'Exchange'}
              onQueryChange={handleExchangeQueryChange}
              onSelect={handleExchangeSelect}
            />
            {exchangesStatus === 'error' && (
              <span className="simulate-field-error">
                {exchangesError || 'Unable to load exchanges.'}
              </span>
            )}
          </div>

          <div className="simulate-field">
            <label htmlFor="network">Network</label>
            <SearchableCombobox
              id="network"
              placeholder={
                !exchangeId
                  ? 'Select an exchange first'
                  : networksStatus === 'loading'
                    ? 'Loading networks...'
                    : 'Select network'
              }
              items={networkItems}
              query={networkQuery}
              disabled={!exchangeId || networksStatus === 'loading' || networksStatus === 'error'}
              isLoading={networksStatus === 'loading'}
              emptyMessage="No networks found."
              showIcons
              selectedIconUrl={selectedNetwork ? getIconUrl(selectedNetwork) : null}
              selectedIconAlt={selectedNetwork?.name ?? 'Network'}
              onQueryChange={handleNetworkQueryChange}
              onSelect={handleNetworkSelect}
            />
            {networksStatus === 'error' && (
              <span className="simulate-field-error">
                {networksError || 'Unable to load networks.'}
              </span>
            )}
          </div>

          {mode === 'pair' ? (
            <>
              <div className="simulate-token-grid">
                <div className="simulate-field">
                  <label htmlFor="token0">Token A</label>
                  <SearchableCombobox
                    id="token0"
                    placeholder={
                      !networkId
                        ? 'Select a network first'
                        : tokensStatus === 'loading'
                          ? 'Loading tokens...'
                          : 'Select token A'
                    }
                    items={tokenItems}
                    query={token0Query}
                    disabled={!networkId || tokensStatus === 'loading' || tokensStatus === 'error'}
                    isLoading={tokensStatus === 'loading'}
                    emptyMessage="No tokens found."
                    showIcons
                    selectedIconUrl={selectedToken0 ? getTokenIconUrl(selectedToken0) : null}
                    selectedIconAlt={selectedToken0Label}
                    onQueryChange={handleToken0QueryChange}
                    onSelect={handleToken0Select}
                  />
                </div>
                <div className="simulate-field">
                  <label htmlFor="token1">Token B</label>
                  <SearchableCombobox
                    id="token1"
                    placeholder={
                      !token0
                        ? 'Select token A first'
                        : pairTokensStatus === 'loading'
                          ? 'Loading related tokens...'
                          : 'Select token B'
                    }
                    items={pairTokenItems}
                    query={token1Query}
                    disabled={
                      !token0 || pairTokensStatus === 'loading' || pairTokensStatus === 'error'
                    }
                    isLoading={pairTokensStatus === 'loading'}
                    emptyMessage="No token pairs found."
                    showIcons
                    selectedIconUrl={selectedToken1 ? getTokenIconUrl(selectedToken1) : null}
                    selectedIconAlt={selectedToken1Label}
                    onQueryChange={handleToken1QueryChange}
                    onSelect={handleToken1Select}
                  />
                </div>
              </div>

              {tokensStatus === 'error' && (
                <div className="simulate-inline-error">
                  {tokensError || 'Unable to load tokens.'}
                </div>
              )}
              {pairTokensStatus === 'error' && (
                <div className="simulate-inline-error">
                  {pairTokensError || 'Unable to load token pairs.'}
                </div>
              )}
            </>
          ) : (
            <form className="simulate-address-form" onSubmit={handleAddressSubmit}>
              <div className="simulate-field">
                <label htmlFor="pool-address">Pool Address</label>
                <input
                  id="pool-address"
                  className="combo-input"
                  type="text"
                  placeholder="Enter pool address"
                  value={poolAddressQuery}
                  onChange={(event) => handlePoolAddressQueryChange(event.target.value)}
                  disabled={addressSearchStatus === 'loading'}
                  autoComplete="off"
                />
                {addressSearchStatus === 'error' && addressSearchError && (
                  <span className="simulate-field-error">{addressSearchError}</span>
                )}
              </div>
              <button
                type="submit"
                className="simulate-submit-btn"
                disabled={
                  addressSearchStatus === 'loading' ||
                  !exchangeId ||
                  !networkId ||
                  !trimmedPoolAddressQuery
                }
              >
                {addressSearchStatus === 'loading' ? 'Opening simulation...' : 'Open simulation'}
              </button>
            </form>
          )}

          <div className="simulate-divider" />
          <div className="simulate-panel-foot">{poolFoundMessage}</div>
        </div>

        <div className="simulate-panel">
          <div className="simulate-panel-title">Matching Pools</div>

          {mode === 'address' ? (
            <>
              <div className="simulate-status">
                Select an exchange, a network, and enter the exact pool address to open the
                simulation directly.
              </div>
              {addressSearchStatus === 'loading' && (
                <div className="simulate-status">Looking up the selected pool address...</div>
              )}
              {addressSearchStatus === 'error' && addressSearchError && (
                <div className="simulate-status simulate-status-error">{addressSearchError}</div>
              )}
              {addressSearchStatus === 'success' && (
                <div className="simulate-status">Pool found. Opening the simulation...</div>
              )}
            </>
          ) : (
            <>
              {sameToken && (
                <div className="simulate-status simulate-status-error">
                  Token A and Token B must be different to search pools.
                </div>
              )}
              {!token0 || !token1 ? (
                <div className="simulate-status">
                  Select token A and token B to list matching pools.
                </div>
              ) : null}
              {poolsStatus === 'error' && (
                <div className="simulate-status simulate-status-error">
                  {poolsError || 'Unable to load pools.'}
                </div>
              )}
              {poolsStatus === 'loading' && (
                <div className="simulate-status">Looking up available pools...</div>
              )}
              {poolsStatus === 'success' && pools.length === 0 && (
                <div className="simulate-status">No pools found for this pair.</div>
              )}

              {poolsReady && (
                <div className="simulate-pool-list">
                  {pools.map((pool, index) => {
                    const poolAddress = resolvePoolAddress(pool)
                    const href = getPoolDetailsHref(poolAddress)
                    const pairText = getPoolPairText(
                      pool,
                      selectedToken0Label || undefined,
                      selectedToken1Label || undefined,
                      index,
                    )
                    const subtitle = getPoolSubLabel(pool)

                    const content = (
                      <article
                        className={`simulate-pool-card${index === 0 ? ' is-featured' : ''}${href ? '' : ' is-disabled'}`}
                        aria-disabled={!href}
                      >
                        <div className="simulate-pool-top">
                          <div className="simulate-pool-main">
                            <div className="simulate-token-icons" aria-hidden="true">
                              <span>{(selectedToken0Label || 'A').slice(0, 1)}</span>
                              <span>{(selectedToken1Label || 'B').slice(0, 1)}</span>
                            </div>
                            <div>
                              <div className="simulate-pool-pair">{pairText}</div>
                              <div className="simulate-pool-subtitle">{subtitle}</div>
                              <div className="simulate-pool-tags">
                                <span className="simulate-tag">
                                  {selectedExchange?.name ?? 'Exchange'}
                                </span>
                                <span className="simulate-tag">
                                  {selectedNetwork?.name ?? 'Network'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="simulate-pool-side">
                            <span className="simulate-fee-pill">
                              {formatFeeTier(pool).replace('Fee ', '')}
                            </span>
                          </div>
                        </div>

                        {href && (
                          <div className="simulate-card-action">
                            <span className="simulate-action-btn">Simulate →</span>
                          </div>
                        )}
                      </article>
                    )

                    if (!href) {
                      return <div key={`${pool.id ?? poolAddress ?? index}`}>{content}</div>
                    }

                    return (
                      <Link
                        key={`${pool.id ?? poolAddress ?? index}`}
                        className="simulate-pool-link"
                        to={href}
                      >
                        {content}
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {shouldShowRecentlyViewedSection && (
        <section className="simulate-recent reveal delay-2">
          <div className="simulate-recent-head">
            <h2>Recently Viewed</h2>
            {recentlyViewedStatus === 'success' && (
              <span className="simulate-recent-count">
                {recentlyViewedPools.length} pool{recentlyViewedPools.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {recentlyViewedStatus === 'loading' && (
            <div className="simulate-status">Loading recently viewed pools...</div>
          )}

          {recentlyViewedStatus === 'success' && recentlyViewedPools.length > 0 && (
            <div className="simulate-pool-list">
              {recentlyViewedPools.map((recentPool, index) => {
                const href = getRecentlyViewedPoolHref(recentPool)
                const pairText = `${recentPool.pool.token0_symbol} / ${recentPool.pool.token1_symbol}`
                const subtitle = getViewedLabel(recentPool.last_viewed_at, marketNow)

                return (
                  <Link
                    key={`${recentPool.pool_address}-${recentPool.chain_id}-${recentPool.exchange_id}`}
                    className="simulate-pool-link"
                    to={href}
                  >
                    <article
                      className={`simulate-pool-card${index === 0 ? ' is-featured' : ''}`}
                    >
                      <div className="simulate-pool-top">
                        <div className="simulate-pool-main">
                          <div className="simulate-token-icons" aria-hidden="true">
                            <span>
                              {recentPool.pool.token0_icon_url ? (
                                <img src={recentPool.pool.token0_icon_url} alt="" loading="lazy" />
                              ) : (
                                recentPool.pool.token0_symbol.slice(0, 1).toUpperCase()
                              )}
                            </span>
                            <span>
                              {recentPool.pool.token1_icon_url ? (
                                <img src={recentPool.pool.token1_icon_url} alt="" loading="lazy" />
                              ) : (
                                recentPool.pool.token1_symbol.slice(0, 1).toUpperCase()
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="simulate-pool-pair">{pairText}</div>
                            <div className="simulate-pool-subtitle">{subtitle}</div>
                            <div className="simulate-pool-tags">
                              <span className="simulate-tag">{recentPool.pool.dex_name}</span>
                              <span className="simulate-tag">{recentPool.pool.chain_name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="simulate-pool-side">
                          <span className="simulate-fee-pill">
                            {(recentPool.pool.fee_tier / 10000).toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      <div className="simulate-card-action">
                        <span className="simulate-action-btn">Simulate →</span>
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default SimulatePage
