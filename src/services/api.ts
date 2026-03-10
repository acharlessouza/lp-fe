const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const REFRESH_ENDPOINT = '/v1/auth/refresh'
let accessToken: string | null = null
let onUnauthorizedHandler: (() => void) | null = null
let hasTriggeredUnauthorized = false
type RefreshSessionPayload = {
  access_token?: unknown
  [key: string]: unknown
}
let refreshRequest: Promise<RefreshSessionPayload | null> | null = null

export const setAccessToken = (token: string | null) => {
  accessToken = token
}

export const getAccessToken = () => accessToken

export const setOnUnauthorized = (handler: (() => void) | null) => {
  onUnauthorizedHandler = handler
}

type ApiError = {
  message?: string
  error?: string
  detail?: unknown
}

type FetchOptions = {
  signal?: AbortSignal
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  authenticated?: boolean
  retryAfterRefresh?: boolean
}

const notifyUnauthorized = () => {
  if (!onUnauthorizedHandler || hasTriggeredUnauthorized) {
    return
  }
  hasTriggeredUnauthorized = true
  onUnauthorizedHandler()
  queueMicrotask(() => {
    hasTriggeredUnauthorized = false
  })
}

const parseResponseBody = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T
  }
  const text = await response.text()
  if (!text.trim()) {
    return undefined as T
  }
  return JSON.parse(text) as T
}

const isAbortError = (error: unknown) => {
  if (error instanceof DOMException) {
    return error.name === 'AbortError'
  }
  if (!error || typeof error !== 'object') {
    return false
  }
  const candidate = error as { name?: unknown }
  return candidate.name === 'AbortError'
}

const readAccessTokenFromRefreshPayload = (payload: RefreshSessionPayload | null) => {
  if (!payload) {
    return null
  }
  const candidate = payload.access_token
  if (typeof candidate !== 'string') {
    return null
  }
  const normalized = candidate.trim()
  return normalized || null
}

const requestRefreshSession = async (): Promise<RefreshSessionPayload | null> => {
  if (refreshRequest) {
    return refreshRequest
  }

  refreshRequest = (async () => {
    try {
      const response = await fetch(`${API_BASE}${REFRESH_ENDPOINT}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })
      if (!response.ok) {
        return null
      }

      const payload = await parseResponseBody<RefreshSessionPayload>(response)
      const token = readAccessTokenFromRefreshPayload(payload)
      if (!token) {
        return null
      }
      accessToken = token
      return payload
    } catch {
      return null
    } finally {
      refreshRequest = null
    }
  })()

  return refreshRequest
}

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshed = await requestRefreshSession()
  const token = readAccessTokenFromRefreshPayload(refreshed)
  if (!token) {
    return null
  }
  accessToken = token
  return token
}

export async function fetchJson<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const {
    signal,
    method = 'GET',
    body,
    headers: customHeaders,
    authenticated = true,
    retryAfterRefresh = false,
  } = options

  const isDirectRefreshRequest = path === REFRESH_ENDPOINT && method === 'POST' && !authenticated
  if (isDirectRefreshRequest) {
    const refreshed = await requestRefreshSession()
    if (!refreshed) {
      throw new Error('Unable to refresh session.')
    }
    return refreshed as T
  }

  const headers: Record<string, string> = {
    ...(customHeaders ?? {}),
  }

  if (authenticated && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  let payload: string | undefined

  if (body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal,
      method,
      headers,
      body: payload,
      credentials: 'include',
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new Error('Unable to reach the server.')
  }

  const isAuthEndpoint = path.startsWith('/v1/auth/')
  if (response.status === 401 && authenticated && !isAuthEndpoint) {
    if (!retryAfterRefresh) {
      const nextAccessToken = await refreshAccessToken()
      if (nextAccessToken) {
        return fetchJson<T>(path, {
          ...options,
          retryAfterRefresh: true,
        })
      }
    }
    notifyUnauthorized()
  }

  if (!response.ok) {
    const message = await getErrorMessage(response)
    throw new Error(message)
  }
  return parseResponseBody<T>(response)
}

async function getErrorMessage(response: Response) {
  const extractMessage = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') {
      return null
    }

    const candidate = value as ApiError

    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message.trim()
    }

    if (typeof candidate.error === 'string' && candidate.error.trim()) {
      return candidate.error.trim()
    }

    if (typeof candidate.detail === 'string' && candidate.detail.trim()) {
      return candidate.detail.trim()
    }

    if (Array.isArray(candidate.detail)) {
      const messages = candidate.detail
        .map((item) => {
          if (typeof item === 'string') {
            return item.trim()
          }
          if (item && typeof item === 'object') {
            const obj = item as { msg?: unknown; message?: unknown }
            if (typeof obj.msg === 'string' && obj.msg.trim()) {
              return obj.msg.trim()
            }
            if (typeof obj.message === 'string' && obj.message.trim()) {
              return obj.message.trim()
            }
          }
          return ''
        })
        .filter(Boolean)
      if (messages.length) {
        return messages.join('; ')
      }
    }

    if (candidate.detail && typeof candidate.detail === 'object') {
      const detail = candidate.detail as { msg?: unknown; message?: unknown }
      if (typeof detail.msg === 'string' && detail.msg.trim()) {
        return detail.msg.trim()
      }
      if (typeof detail.message === 'string' && detail.message.trim()) {
        return detail.message.trim()
      }
    }

    return null
  }

  try {
    const text = await response.text()
    if (text) {
      try {
        const data = JSON.parse(text) as unknown
        const extracted = extractMessage(data)
        if (extracted) {
          return extracted
        }
      } catch {
        return text
      }
    }
  } catch {
    return 'Unable to complete request.'
  }
  return 'Unable to complete request.'
}

export type Exchange = {
  id: number
  name: string
  icon_url?: string | null
}

export type Network = {
  id: number
  name: string
  chain_id?: number
  icon_url?: string | null
}

export type Token = {
  address: string
  symbol?: string
  name?: string
  decimals?: number
  icon_url?: string | null
}

export type Pool = {
  id?: number | string
  address?: string
  pool_address?: string
  name?: string
  fee?: number | string
  fee_tier?: number | string
  tvl_usd?: number | string | null
  avg_daily_fees_usd?: number | string | null
  daily_fees_tvl_pct?: number | string | null
  avg_daily_volume_usd?: number | string | null
  daily_volume_tvl_pct?: number | string | null
  price_volatility_pct?: number | string | null
  correlation?: number | string | null
  geometric_mean_price?: number | string | null
  token0?: Token
  token1?: Token
  [key: string]: unknown
}

export type MarketMetric = {
  value: number
  displayValue: string
  updatedAt: string
  source: string
}

export type MarketSummaryResponse = {
  data: {
    defiMarketCap: MarketMetric
    dexVolume24h: MarketMetric
    stablecoinMarketCap: MarketMetric
    dexFees24h: MarketMetric
  }
  meta: {
    updatedAt: string
    isStale: boolean
  }
}

export type PoolFavoriteResponse = {
  isFavorited: boolean
}

export type PoolDetail = {
  id: string
  dex_key: string
  dex_name: string
  dex_version: string
  chain_key: string
  chain_name: string
  fee_tier: number
  token0_address: string
  token0_symbol: string
  token0_decimals: number
  token0_icon_url?: string | null
  token1_address: string
  token1_symbol: string
  token1_decimals: number
  token1_icon_url?: string | null
  token0?: Token
  token1?: Token
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

export type LiquidityDistributionDefaultRangeResponse = {
  min_price: number | string
  max_price: number | string
  min_tick?: number | string
  max_tick?: number | string
  tick_spacing?: number | string
}

export type PoolPriceResponse = {
  series?: Array<{
    timestamp: string
    price: number | string
  }>
  status?: {
    min?: number | string
    max?: number | string
    avg?: number | string
    price?: number | string
  }
  stats?: {
    min?: number | string
    max?: number | string
    avg?: number | string
    price?: number | string
  }
}

export type VolumeHistoryPointResponse = {
  time: number | string
  value: number | string
  fees_usd?: number | string | null
}

export type VolumeHistorySummaryResponse = {
  tvl_usd?: number | string | null
  avg_daily_fees_usd?: number | string | null
  daily_fees_tvl_pct?: number | string | null
  avg_daily_volume_usd?: number | string | null
  daily_volume_tvl_pct?: number | string | null
  price_volatility_pct?: number | string | null
  correlation?: number | string | null
  geometric_mean_price?: number | string | null
}

export type PoolVolumeHistoryResponse = {
  volume_history: VolumeHistoryPointResponse[]
  summary?: VolumeHistorySummaryResponse
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

export type SimulateAprResponse = {
  estimated_fees_period_usd?: number | string
  estimated_fees_24h_usd?: number | string
  monthly_usd?: number | string
  yearly_usd?: number | string
  fee_apr?: number | string
  meta?: {
    block_a_number?: number | string
    block_b_number?: number | string
    ts_a?: number | string
    ts_b?: number | string
    seconds_delta?: number | string
    used_price?: number | string
    warnings?: string[]
  }
  diagnostics?: {
    hours_total?: number
    hours_in_range?: number
    percent_time_in_range?: number | string
    avg_share_in_range?: number | string
    assumptions?: {
      mode?: string
      annualization?: string
      horizon_hours?: number | string
    }
    warnings?: string[]
  }
}

export type DiscoverPool = {
  pool_id: number
  pool_name: string
  pool_address?: string
  network?: string
  exchange?: string
  dex_id?: number
  chain_id?: number
  token0_address?: string
  token1_address?: string
  token0_symbol?: string
  token1_symbol?: string
  token0_icon_url?: string | null
  token1_icon_url?: string | null
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

export type SimulateAprVersion = 'v1' | 'v2'

export type SimulateAprV1Payload = {
  pool_address: string
  chain_id: number
  dex_id: number
  swapped_pair?: boolean
  deposit_usd?: string
  amount_token0?: string
  amount_token1?: string
  tick_lower: number | null
  tick_upper: number | null
  min_price: number | null
  max_price: number | null
  full_range: boolean
  horizon: string
  mode: 'A' | 'B'
  lookback_days: number
  calculation_method: 'current' | 'avg_liquidity_in_range' | 'peak_liquidity_in_range' | 'custom'
  custom_calculation_price?: number | null
}

export type SimulateAprV2Payload = {
  pool_address: string
  chain_id: number
  dex_id: number
  swapped_pair?: boolean
  deposit_usd?: string
  amount_token0?: string
  amount_token1?: string
  min_price: number | null
  max_price: number | null
  full_range: boolean
  lookback_days: number
  calculation_method: 'current' | 'avg_liquidity_in_range' | 'peak_liquidity_in_range' | 'custom'
  custom_calculation_price?: number | null
}

export const getExchanges = (signal?: AbortSignal) =>
  fetchJson<Exchange[]>('/v1/exchanges', { signal })

export const getMarketSummary = (signal?: AbortSignal) =>
  fetchJson<MarketSummaryResponse>('/v1/market-summary', { signal })

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
  chainId: number,
  exchangeId: number,
  signal?: AbortSignal,
) =>
  fetchJson<PoolDetail>(
    `/v1/pools/by-address/${encodeURIComponent(
      poolAddress,
    )}?chain_id=${chainId}&exchange_id=${exchangeId}`,
    { signal },
  )

export const getPoolFavoriteStatus = (
  poolAddress: string,
  chainId: number,
  exchangeId: number,
  signal?: AbortSignal,
) =>
  fetchJson<PoolFavoriteResponse>(
    `/v1/pools/by-address/${encodeURIComponent(
      poolAddress,
    )}/favorite?chain_id=${chainId}&exchange_id=${exchangeId}`,
    { signal },
  )

export const favoritePool = (
  poolAddress: string,
  chainId: number,
  exchangeId: number,
  signal?: AbortSignal,
) =>
  fetchJson<PoolFavoriteResponse>(
    `/v1/pools/by-address/${encodeURIComponent(
      poolAddress,
    )}/favorite?chain_id=${chainId}&exchange_id=${exchangeId}`,
    {
      method: 'PUT',
      signal,
    },
  )

export const unfavoritePool = (
  poolAddress: string,
  chainId: number,
  exchangeId: number,
  signal?: AbortSignal,
) =>
  fetchJson<PoolFavoriteResponse>(
    `/v1/pools/by-address/${encodeURIComponent(
      poolAddress,
    )}/favorite?chain_id=${chainId}&exchange_id=${exchangeId}`,
    {
      method: 'DELETE',
      signal,
    },
  )

export const postLiquidityDistribution = (
  payload: {
    pool_id: number | string
    snapshot_date: string
    current_tick: number
    tick_range: number
    range_min: number | null
    range_max: number | null
    swapped_pair: boolean
  },
  signal?: AbortSignal,
) =>
  fetchJson<LiquidityDistributionResponse>('/v1/liquidity-distribution', {
    method: 'POST',
    body: payload,
    signal,
  })

export const postLiquidityDistributionDefaultRange = (
  payload: {
    pool_id: string
    chain_id: number
    dex_id: number
    snapshot_date: string
    preset: string
    initial_price: number
    center_tick: number | null
    swapped_pair: boolean
  },
  signal?: AbortSignal,
) =>
  fetchJson<LiquidityDistributionDefaultRangeResponse>(
    '/v1/liquidity-distribution/default-range',
    {
      method: 'POST',
      body: payload,
      signal,
    },
  )

export const postAllocate = (
  payload: {
    pool_address: string
    chain_id: number
    dex_id: number
    amount: string
    range1: string
    range2: string
    full_range: boolean
    swapped_pair: boolean
  },
  signal?: AbortSignal,
) =>
  fetchJson<AllocateResponse>('/v1/allocate', {
    method: 'POST',
    body: payload,
    signal,
  })

type PoolPriceParamsBase = {
  poolAddress: string
  chainId: number
  dexId: number
  swapped_pair?: boolean
}

type PoolPriceParams =
  | (PoolPriceParamsBase & {
      days: number
    })
  | (PoolPriceParamsBase & {
      start: string
      end: string
    })

export const getPoolPrice = (params: PoolPriceParams, signal?: AbortSignal) => {
  const query = new URLSearchParams({
    pool_address: params.poolAddress,
    chain_id: String(params.chainId),
    dex_id: String(params.dexId),
  })

  if ('days' in params) {
    query.set('days', String(params.days))
  } else {
    query.set('start', params.start)
    query.set('end', params.end)
  }
  if (typeof params.swapped_pair === 'boolean') {
    query.set('swapped_pair', String(params.swapped_pair))
  }

  return fetchJson<PoolPriceResponse>(`/v1/pool-price?${query.toString()}`, { signal })
}

export const getPoolVolumeHistory = (
  poolAddress: string,
  params: {
    days: number
    chainId?: number
    dexId?: number
    symbol0?: string
    symbol1?: string
  },
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams({
    days: String(params.days),
  })

  if (Number.isFinite(params.chainId)) {
    query.set('chainId', String(params.chainId))
  }
  if (Number.isFinite(params.dexId)) {
    query.set('dexId', String(params.dexId))
  }
  if (params.symbol0?.trim()) {
    query.set('symbol0', params.symbol0.trim())
  }
  if (params.symbol1?.trim()) {
    query.set('symbol1', params.symbol1.trim())
  }

  return fetchJson<PoolVolumeHistoryResponse | VolumeHistoryPointResponse[]>(
    `/v1/pools/${encodeURIComponent(poolAddress)}/volume-history?${query.toString()}`,
    { signal },
  )
}

export const postSimulateApr = (
  payload: SimulateAprV1Payload | SimulateAprV2Payload,
  options: {
    signal?: AbortSignal
    version?: SimulateAprVersion
  } = {},
) => {
  const { signal, version = 'v1' } = options
  const endpoint = version === 'v2' ? '/v2/simulate/apr' : '/v1/simulate/apr'
  return fetchJson<SimulateAprResponse>(endpoint, {
    method: 'POST',
    body: payload,
    signal,
  })
}

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
    pool_id: number | string
    min_price: number
    max_price: number
    swapped_pair?: boolean
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
  return fetchJson<DiscoverPoolsResponse>(`/v1/radar/pools${query ? `?${query}` : ''}`, {
    signal,
  })
}
