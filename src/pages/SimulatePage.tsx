import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Exchange, Network, Pool, Token } from '../services/api'
import { getExchanges, getNetworks, getPools, getTokens } from '../services/api'
import './SimulatePage.css'

type Mode = 'pair' | 'address'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

const shortAddress = (address: string) => {
  if (!address) {
    return ''
  }
  if (address.length <= 10) {
    return address
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const tokenLabel = (token: Token) => {
  if (token.symbol) {
    return `${token.symbol} · ${shortAddress(token.address)}`
  }
  return shortAddress(token.address)
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
    return items
      .filter((item) => item.search.includes(normalizedQuery))
      .slice(0, 80)
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

const poolPairLabel = (
  pool: Pool,
  token0Selection: Token | undefined,
  token1Selection: Token | undefined,
  token0Address: string,
  token1Address: string,
) => {
  if (pool.token0 && pool.token1) {
    return `${tokenLabel(pool.token0)} / ${tokenLabel(pool.token1)}`
  }
  const left = token0Selection
    ? tokenLabel(token0Selection)
    : shortAddress(token0Address)
  const right = token1Selection
    ? tokenLabel(token1Selection)
    : shortAddress(token1Address)
  if (!left || !right) {
    return 'Selected pair'
  }
  return `${left} / ${right}`
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

function SimulatePage() {
  const [mode, setMode] = useState<Mode>('pair')
  const [searchParams] = useSearchParams()

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

  const [pools, setPools] = useState<Pool[]>([])
  const [poolsStatus, setPoolsStatus] = useState<LoadStatus>(initialPoolsStatus)
  const [poolsError, setPoolsError] = useState('')

  const sameToken = token0 !== '' && token0 === token1

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
      })),
    [orderedPairTokens],
  )

  const selectedToken0 = tokens.find((token) => token.address === token0)
  const selectedToken1 =
    pairTokens.find((token) => token.address === token1) ??
    tokens.find((token) => token.address === token1)
  const selectedExchange = exchanges.find((exchange) => exchange.id === exchangeId)
  const selectedNetwork = networks.find((network) => network.id === networkId)

  const poolDetailsQuery = useMemo(() => {
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
    if (token0) {
      params.set('token0', token0)
    }
    if (token1) {
      params.set('token1', token1)
    }
    if (selectedExchange?.name) {
      params.set('exchange_name', selectedExchange.name)
    }
    if (selectedNetwork?.name) {
      params.set('network_name', selectedNetwork.name)
    }
    if (selectedToken0) {
      params.set('token0_symbol', tokenOptionLabel(selectedToken0))
    }
    if (selectedToken1) {
      params.set('token1_symbol', tokenOptionLabel(selectedToken1))
    }
    return params.toString()
  }, [
    exchangeId,
    networkId,
    selectedExchange,
    selectedNetwork,
    selectedToken0,
    selectedToken1,
    token0,
    token1,
  ])

  const resolvePoolAddress = (pool: Pool) =>
    pool.address ?? (pool as { pool_address?: string }).pool_address ?? ''

  const getPoolDetailsHref = (address?: string) => {
    if (!address || !poolDetailsQuery) {
      return ''
    }
    return `/simulate/pools/${encodeURIComponent(address)}?${poolDetailsQuery}`
  }

  const resetPools = () => {
    setPools([])
    setPoolsStatus('idle')
    setPoolsError('')
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
    setNetworkId(item.data.id)
    setNetworkQuery(item.data.name)
    setTokensStatus('loading')
    setTokensError('')
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
    if (!exchangeId || !networkId) {
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
  }, [exchangeId, networkId])

  useEffect(() => {
    if (!exchangeId || !networkId || !token0) {
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
  }, [exchangeId, networkId, token0])

  useEffect(() => {
    if (!exchangeId || !networkId || !token0 || !token1 || sameToken) {
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
  }, [exchangeId, networkId, token0, token1, sameToken])

  return (
    <main className="simulate-page">
      <section className="hero reveal">
        <div className="hero-content">
          <span className="eyebrow">Liquidity Radar</span>
          <h1>Map liquidity pools with confidence before simulating</h1>
          <p>
            Select the exchange, network, and token pair. The panel returns the
            available pools so you can plan your next step.
          </p>
          <div className="hero-actions">
            <div className="mode-toggle" role="tablist" aria-label="Filter mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'pair'}
                className={mode === 'pair' ? 'active' : ''}
                onClick={() => setMode('pair')}
              >
                Pair
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={false}
                className="disabled"
                disabled
                aria-disabled="true"
              >
                Address
                <span>coming soon</span>
              </button>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-card-title">Selection checklist</div>
          <div className="hero-steps">
            <div className="hero-step">
              <span>1</span>
              <div>
                <strong>Exchange</strong>
                <p>Pick the primary marketplace.</p>
              </div>
            </div>
            <div className="hero-step">
              <span>2</span>
              <div>
                <strong>Network</strong>
                <p>Choose the chain where the pool lives.</p>
              </div>
            </div>
            <div className="hero-step">
              <span>3</span>
              <div>
                <strong>Tokens</strong>
                <p>Define the target pair.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="filters reveal delay-1">
        <div className="section-header">
          <div>
            <h2>Pair filter</h2>
            <p>Complete each step to unlock the pool list.</p>
          </div>
          <div className="status-indicator">
            <span className="dot" />
            <span>Active mode: {mode === 'pair' ? 'Pair' : 'Address'}</span>
          </div>
        </div>

        <div className="filter-card">
          <div className="form-grid">
            <label className="field">
              <span>Exchange</span>
              <SearchableCombobox
                id="exchange"
                placeholder={
                  exchangesStatus === 'loading'
                    ? 'Loading exchanges...'
                    : 'Select exchange'
                }
                items={exchangeItems}
                query={exchangeQuery}
                disabled={exchangesStatus === 'loading' || exchangesStatus === 'error'}
                isLoading={exchangesStatus === 'loading'}
                emptyMessage="No exchanges found."
                onQueryChange={handleExchangeQueryChange}
                onSelect={handleExchangeSelect}
              />
              {exchangesStatus === 'error' && (
                <span className="field-error">
                  {exchangesError || 'Unable to load exchanges.'}
                </span>
              )}
            </label>

            <label className="field">
              <span>Network</span>
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
                disabled={
                  !exchangeId ||
                  networksStatus === 'loading' ||
                  networksStatus === 'error'
                }
                isLoading={networksStatus === 'loading'}
                emptyMessage="No networks found."
                onQueryChange={handleNetworkQueryChange}
                onSelect={handleNetworkSelect}
              />
              {networksStatus === 'error' && (
                <span className="field-error">
                  {networksError || 'Unable to load networks.'}
                </span>
              )}
            </label>

            <div className="field">
              <span>Select Pair</span>
              <div className="field-row">
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
                  disabled={
                    !networkId || tokensStatus === 'loading' || tokensStatus === 'error'
                  }
                  isLoading={tokensStatus === 'loading'}
                  emptyMessage="No tokens found."
                  onQueryChange={handleToken0QueryChange}
                  onSelect={handleToken0Select}
                />
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
                    !token0 ||
                    pairTokensStatus === 'loading' ||
                    pairTokensStatus === 'error'
                  }
                  isLoading={pairTokensStatus === 'loading'}
                  emptyMessage="No token pairs found."
                  onQueryChange={handleToken1QueryChange}
                  onSelect={handleToken1Select}
                />
              </div>
              {tokensStatus === 'error' && (
                <span className="field-error">
                  {tokensError || 'Unable to load tokens.'}
                </span>
              )}
              {pairTokensStatus === 'error' && (
                <span className="field-error">
                  {pairTokensError || 'Unable to load token pairs.'}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="pools reveal delay-2">
        <div className="section-header">
          <div>
            <h2>Pool list</h2>
            <p>Pick a pool to continue to simulation.</p>
          </div>
          <div className="status-indicator">
            <span className="dot" />
            <span>
              {poolsStatus === 'loading'
                ? 'Fetching pools...'
                : `${pools.length} pools found`}
            </span>
          </div>
        </div>

        {sameToken && (
          <div className="status-message error">
            Token A and Token B must be different to search pools.
          </div>
        )}

        {!token0 || !token1 ? (
          <div className="status-message">Select token A and token B.</div>
        ) : null}

        {poolsStatus === 'error' && (
          <div className="status-message error">
            {poolsError || 'Unable to load pools.'}
          </div>
        )}

        {poolsStatus === 'loading' && (
          <div className="status-message">Looking up available pools...</div>
        )}

        {poolsStatus === 'success' && pools.length === 0 && (
          <div className="status-message">No pools found for this pair.</div>
        )}

        {pools.length > 0 && (
          <div className="pools-grid">
            {pools.map((pool, index) => {
              const poolAddress = resolvePoolAddress(pool)
              const href = getPoolDetailsHref(poolAddress)
              const content = (
                <article
                  className={`pool-card${href ? '' : ' disabled'}`}
                  aria-disabled={!href}
                >
                  <div className="pool-title">{poolLabel(pool, index)}</div>
                  <div className="pool-meta">
                    <span className="meta-chip">{formatFeeTier(pool)}</span>
                  </div>
                </article>
              )

              if (!href) {
                return (
                  <div key={`${pool.id ?? poolAddress ?? index}`}>{content}</div>
                )
              }

              return (
                <Link
                  key={`${pool.id ?? poolAddress ?? index}`}
                  className="pool-card-link"
                  to={href}
                >
                  {content}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

export default SimulatePage
