const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const RAW_BEARER_TOKEN = import.meta.env.VITE_API_BEARER_TOKEN ?? ''
const API_BEARER_TOKEN =
  RAW_BEARER_TOKEN && RAW_BEARER_TOKEN !== 'seu_token_aqui' ? RAW_BEARER_TOKEN : 'dev-token'

type ApiError = {
  message?: string
}

type FetchOptions = {
  signal?: AbortSignal
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

async function fetchJson<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { signal, method = 'GET', body, headers: customHeaders } = options
  const headers: Record<string, string> = {
    ...(customHeaders ?? {}),
  }

  if (API_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${API_BEARER_TOKEN}`
  }

  let payload: string | undefined

  if (body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
    payload = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    signal,
    method,
    headers,
    body: payload,
  })
  if (!response.ok) {
    const message = await getErrorMessage(response)
    throw new Error(message)
  }
  return (await response.json()) as T
}

async function getErrorMessage(response: Response) {
  try {
    const text = await response.text()
    if (text) {
      try {
        const data = JSON.parse(text) as ApiError
        if (data?.message) {
          return data.message
        }
      } catch {
        return text
      }
    }
  } catch {
    return `Unable to reach ${response.url}`
  }
  return `Unable to reach ${response.url}`
}

export type Exchange = {
  id: number
  name: string
}

export type Network = {
  id: number
  name: string
  chain_id?: number
}

export type Token = {
  address: string
  symbol?: string
  name?: string
  decimals?: number
}

export type Pool = {
  id?: number | string
  address?: string
  name?: string
  fee?: number | string
  token0?: Token
  token1?: Token
  [key: string]: unknown
}

export type PoolDetail = {
  id: number
  fee_tier: number
  token0_address: string
  token0_symbol: string
  token0_decimals: number
  token1_address: string
  token1_symbol: string
  token1_decimals: number
}

export type LiquidityDistributionPoint = {
  tick: number | string
  liquidity: number | string
  price: number | string
}

export type LiquidityDistributionResponse = {
  data?: LiquidityDistributionPoint[]
  pool?: {
    token0?: string
    token1?: string
    fee_tier?: number
    token0_decimals?: number
    token1_decimals?: number
  }
  current_tick?: number
}

export type PoolPriceResponse = {
  series?: Array<{
    timestamp: string
    price: number | string
  }>
  stats?: {
    min?: number | string
    max?: number | string
    avg?: number | string
    price?: number | string
  }
}

export type AllocateResponse = {
  amount_token0?: number | string
  amount_token1?: number | string
  price_token0_usd?: number | string
  price_token1_usd?: number | string
  token0_symbol?: string
  token1_symbol?: string
  taxa?: number | string
  [key: string]: unknown
}

export type EstimatedFeesResponse = {
  estimated_fees_24h?: number | string
  monthly?: {
    value?: number | string
    percent?: number | string
  }
  yearly?: {
    value?: number | string
    apr?: number | string
  }
}

export type DiscoverPool = {
  pool_id: number
  pool_name: string
  pool_address?: string
  network?: string
  exchange?: string
  fee_tier: number | string
  average_apr: number | string
  price_volatility: number | string | null
  tvl_usd: number | string
  correlation: number | string | null
  avg_daily_fees_usd: number | string
  daily_fees_tvl_pct: number | string
  avg_daily_volume_usd: number | string
  daily_volume_tvl_pct: number | string
}

export type DiscoverPoolsResponse = {
  page: number
  page_size: number
  total: number
  data: DiscoverPool[]
}

export type MatchTicksResponse = {
  min_price_matched: number | string
  max_price_matched: number | string
  current_price_matched?: number | string
}

export const getExchanges = (signal?: AbortSignal) =>
  fetchJson<Exchange[]>('/v1/exchanges', { signal })

export const getNetworks = (exchangeId: number, signal?: AbortSignal) =>
  fetchJson<Network[]>(`/v1/exchanges/${exchangeId}/networks`, { signal })

export const getTokens = (
  exchangeId: number,
  networkId: number,
  options: { token?: string; signal?: AbortSignal } = {},
) => {
  const query = options.token
    ? `?token=${encodeURIComponent(options.token)}`
    : ''
  return fetchJson<Token[]>(
    `/v1/exchanges/${exchangeId}/networks/${networkId}/tokens${query}`,
    { signal: options.signal },
  )
}

export const getPools = (
  exchangeId: number,
  networkId: number,
  token0: string,
  token1: string,
  signal?: AbortSignal,
) =>
  fetchJson<Pool[]>(
    `/v1/exchanges/${exchangeId}/networks/${networkId}/pools?token0=${encodeURIComponent(
      token0,
    )}&token1=${encodeURIComponent(token1)}`,
    { signal },
  )

export const getPoolByAddress = (
  poolAddress: string,
  network: string,
  exchangeId: number,
  signal?: AbortSignal,
) =>
  fetchJson<PoolDetail>(
    `/v1/pools/by-address/${encodeURIComponent(
      poolAddress,
    )}?network=${encodeURIComponent(network)}&exchange_id=${exchangeId}`,
    { signal },
  )

export const postLiquidityDistribution = (
  payload: {
    pool_id: number
    snapshot_date: string
    current_tick: number
    tick_range: number
    range_min: number | null
    range_max: number | null
  },
  signal?: AbortSignal,
) =>
  fetchJson<LiquidityDistributionResponse>('/v1/liquidity-distribution', {
    method: 'POST',
    body: payload,
    signal,
  })

export const postAllocate = (
  payload: {
    pool_address: string
    rede: string
    amount: string
    range1: string
    range2: string
  },
  signal?: AbortSignal,
) =>
  fetchJson<AllocateResponse>('/v1/allocate', {
    method: 'POST',
    body: payload,
    signal,
  })

export const getPoolPrice = (
  poolId: number,
  days: number,
  signal?: AbortSignal,
) =>
  fetchJson<PoolPriceResponse>(
    `/v1/pool-price?pool_id=${poolId}&days=${days}`,
    { signal },
  )

export const postEstimatedFees = (
  payload: {
    pool_id: number
    days: number
    min_price: number
    max_price: number
    deposit_usd: number
    amount_token0: number
    amount_token1: number
  },
  signal?: AbortSignal,
) =>
  fetchJson<EstimatedFeesResponse>('/v1/estimated-fees', {
    method: 'POST',
    body: payload,
    signal,
  })

export const postMatchTicks = (
  payload: {
    pool_id: number
    min_price: number
    max_price: number
  },
  signal?: AbortSignal,
) =>
  fetchJson<MatchTicksResponse>('/v1/match-ticks', {
    method: 'POST',
    body: payload,
    signal,
  })

export const getDiscoverPools = (
  params: {
    network_id?: number
    exchange_id?: number
    token_symbol?: string
    timeframe_days?: number
    page?: number
    page_size?: number
    order_by?: string
    order_dir?: 'asc' | 'desc'
  },
  signal?: AbortSignal,
) => {
  const search = new URLSearchParams()
  if (Number.isFinite(params.network_id)) {
    search.set('network_id', String(params.network_id))
  }
  if (Number.isFinite(params.exchange_id)) {
    search.set('exchange_id', String(params.exchange_id))
  }
  if (params.token_symbol) {
    search.set('token_symbol', params.token_symbol)
  }
  if (Number.isFinite(params.timeframe_days)) {
    search.set('timeframe_days', String(params.timeframe_days))
  }
  if (Number.isFinite(params.page)) {
    search.set('page', String(params.page))
  }
  if (Number.isFinite(params.page_size)) {
    search.set('page_size', String(params.page_size))
  }
  if (params.order_by) {
    search.set('order_by', params.order_by)
  }
  if (params.order_dir) {
    search.set('order_dir', params.order_dir)
  }
  const query = search.toString()
  return fetchJson<DiscoverPoolsResponse>(`/v1/discover/pools${query ? `?${query}` : ''}`, {
    signal,
  })
}
