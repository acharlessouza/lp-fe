import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DiscoverPage from './DiscoverPage'
import type { DiscoverPool, DiscoverPoolsResponse, Exchange, Network } from '../services/api'

const mockGetDiscoverPools = vi.fn()
const mockGetExchanges = vi.fn()
const mockGetNetworks = vi.fn()
const mockFavoritePool = vi.fn()
const mockUnfavoritePool = vi.fn()

vi.mock('../services/api', () => ({
  getDiscoverPools: (...args: unknown[]) => mockGetDiscoverPools(...args),
  getExchanges: (...args: unknown[]) => mockGetExchanges(...args),
  getNetworks: (...args: unknown[]) => mockGetNetworks(...args),
  favoritePool: (...args: unknown[]) => mockFavoritePool(...args),
  unfavoritePool: (...args: unknown[]) => mockUnfavoritePool(...args),
}))

type RadarParams = {
  network_id?: number
  exchange_id?: number
  token_symbol?: string
  timeframe_days?: number
  page?: number
  page_size?: number
  order_by?: string
  order_dir?: 'asc' | 'desc'
  favorites_only?: boolean
}

const exchanges: Exchange[] = [{ id: 1, name: 'Uniswap' }]
const networks: Network[] = [{ id: 1, name: 'Ethereum', chain_id: 1 }]

const createPool = ({
  pool_id,
  pool_name,
  pool_address,
  ...overrides
}: Partial<DiscoverPool> & Pick<DiscoverPool, 'pool_id' | 'pool_name' | 'pool_address'>): DiscoverPool => ({
  pool_id,
  pool_name,
  pool_address,
  network: 'Ethereum',
  exchange: 'Uniswap',
  dex_id: 1,
  chain_id: 1,
  token0_address: `${pool_address}-token0`,
  token1_address: `${pool_address}-token1`,
  token0_symbol: 'WETH',
  token1_symbol: 'USDC',
  token0_icon_url: null,
  token1_icon_url: null,
  fee_tier: 500,
  average_apr: '12.34',
  price_volatility: '1.23',
  tvl_usd: '1000000',
  correlation: '0.98',
  avg_daily_fees_usd: '123.45',
  daily_fees_tvl_pct: '0.12',
  avg_daily_volume_usd: '9876.54',
  daily_volume_tvl_pct: '0.98',
  isFavorited: false,
  ...overrides,
})

const createRadarBackend = (seedPools?: DiscoverPool[]) => {
  const pools =
    seedPools?.map((pool) => ({ ...pool })) ??
    [
      createPool({
        pool_id: 1,
        pool_name: 'WETH / USDC',
        pool_address: '0xpool-1',
        token0_symbol: 'WETH',
        token1_symbol: 'USDC',
        isFavorited: true,
      }),
      createPool({
        pool_id: 2,
        pool_name: 'WBTC / USDC',
        pool_address: '0xpool-2',
        token0_symbol: 'WBTC',
        token1_symbol: 'USDC',
      }),
      createPool({
        pool_id: 3,
        pool_name: 'ARB / USDT',
        pool_address: '0xpool-3',
        token0_symbol: 'ARB',
        token1_symbol: 'USDT',
      }),
    ]

  const findPool = (poolAddress: string, chainId: number, exchangeId: number) =>
    pools.find(
      (pool) =>
        pool.pool_address === poolAddress && pool.chain_id === chainId && pool.dex_id === exchangeId,
    )

  const getDiscoverPools = async (params: RadarParams): Promise<DiscoverPoolsResponse> => {
    const page = params.page ?? 1
    const pageSize = params.page_size ?? 10
    const tokenFilter = params.token_symbol?.trim().toLowerCase()

    let filtered = pools.map((pool) => ({ ...pool }))

    if (typeof params.exchange_id === 'number') {
      filtered = filtered.filter((pool) => pool.dex_id === params.exchange_id)
    }
    if (typeof params.network_id === 'number') {
      filtered = filtered.filter((pool) => pool.chain_id === params.network_id)
    }
    if (tokenFilter) {
      filtered = filtered.filter((pool) => {
        const fields = [pool.pool_name, pool.exchange, pool.network, pool.token0_symbol, pool.token1_symbol]
        return fields.some((value) => value?.toLowerCase().includes(tokenFilter))
      })
    }
    if (params.favorites_only) {
      filtered = filtered.filter((pool) => pool.isFavorited)
    }

    const start = (page - 1) * pageSize
    return {
      page,
      page_size: pageSize,
      total: filtered.length,
      data: filtered.slice(start, start + pageSize),
    }
  }

  const favoritePool = async (poolAddress: string, chainId: number, exchangeId: number) => {
    const pool = findPool(poolAddress, chainId, exchangeId)
    if (!pool) {
      throw new Error('Pool not found.')
    }
    pool.isFavorited = true
    return { isFavorited: true }
  }

  const unfavoritePool = async (poolAddress: string, chainId: number, exchangeId: number) => {
    const pool = findPool(poolAddress, chainId, exchangeId)
    if (!pool) {
      throw new Error('Pool not found.')
    }
    pool.isFavorited = false
    return { isFavorited: false }
  }

  return { getDiscoverPools, favoritePool, unfavoritePool }
}

const renderDiscoverPage = () =>
  render(
    <MemoryRouter>
      <DiscoverPage />
    </MemoryRouter>,
  )

describe('DiscoverPage favorites integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetExchanges.mockResolvedValue(exchanges)
    mockGetNetworks.mockResolvedValue(networks)
  })

  it('shows the real favorites counter and star state from the radar API', async () => {
    const backend = createRadarBackend()
    mockGetDiscoverPools.mockImplementation(backend.getDiscoverPools)
    mockFavoritePool.mockImplementation(backend.favoritePool)
    mockUnfavoritePool.mockImplementation(backend.unfavoritePool)

    renderDiscoverPage()

    expect(await screen.findByText('WETH / USDC')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /top pools/i })).toHaveTextContent(
        'Top Pools (3)',
      )
      expect(screen.getByRole('button', { name: /^⭐ Favorites/ })).toHaveTextContent(
        '⭐ Favorites (1)',
      )
    })

    const favoriteRow = screen.getByText('WETH / USDC').closest('tr')
    const nonFavoriteRow = screen.getByText('WBTC / USDC').closest('tr')

    expect(within(favoriteRow as HTMLTableRowElement).getByRole('button', { name: /remove from favorites/i })).toBeInTheDocument()
    expect(within(nonFavoriteRow as HTMLTableRowElement).getByRole('button', { name: /add to favorites/i })).toBeInTheDocument()
  })

  it('switches between top pools and favorites and keeps pagination working', async () => {
    const backend = createRadarBackend(
      Array.from({ length: 11 }, (_, index) =>
        createPool({
          pool_id: index + 1,
          pool_name: index === 0 ? 'WETH / USDC' : index === 1 ? 'WBTC / USDC' : `Pool ${index + 1}`,
          pool_address: `0xpool-${index + 1}`,
          token0_symbol: index === 0 ? 'WETH' : index === 1 ? 'WBTC' : `T${index + 1}`,
          token1_symbol: index === 0 ? 'USDC' : index === 1 ? 'USDC' : 'USDT',
          isFavorited: index < 2,
        }),
      ),
    )
    mockGetDiscoverPools.mockImplementation(backend.getDiscoverPools)
    mockFavoritePool.mockImplementation(backend.favoritePool)
    mockUnfavoritePool.mockImplementation(backend.unfavoritePool)

    const user = userEvent.setup()
    renderDiscoverPage()

    expect(await screen.findByText('WETH / USDC')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('Timeframe: 14 days'), { target: { value: '30' } })

    await waitFor(() => {
      expect(mockGetDiscoverPools).toHaveBeenCalledWith(
        expect.objectContaining({ favorites_only: false, timeframe_days: 30 }),
        expect.any(AbortSignal),
      )
    })

    await user.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => {
      expect(mockGetDiscoverPools).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites_only: false,
          page: 2,
          page_size: 10,
          timeframe_days: 30,
        }),
        expect.any(AbortSignal),
      )
      expect(screen.getByText('Pool 11')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /^⭐ Favorites/ }))

    await waitFor(() => {
      expect(mockGetDiscoverPools).toHaveBeenCalledWith(
        expect.objectContaining({
          favorites_only: true,
          page: 1,
          page_size: 10,
          timeframe_days: 30,
        }),
        expect.any(AbortSignal),
      )
      expect(screen.getByText('WETH / USDC')).toBeInTheDocument()
    })
  })

  it('favorites a pool using address, chain and exchange and updates the counter', async () => {
    const backend = createRadarBackend()
    mockGetDiscoverPools.mockImplementation(backend.getDiscoverPools)
    mockFavoritePool.mockImplementation(backend.favoritePool)
    mockUnfavoritePool.mockImplementation(backend.unfavoritePool)

    const user = userEvent.setup()
    renderDiscoverPage()

    const row = (await screen.findByText('WBTC / USDC')).closest('tr') as HTMLTableRowElement

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^⭐ Favorites/ })).toHaveTextContent(
        '⭐ Favorites (1)',
      )
    })

    await user.click(within(row).getByRole('button', { name: /add to favorites/i }))

    expect(mockFavoritePool).toHaveBeenCalledWith('0xpool-2', 1, 1)

    await waitFor(() => {
      const updatedRow = screen.getByText('WBTC / USDC').closest('tr') as HTMLTableRowElement
      expect(within(updatedRow).getByRole('button', { name: /remove from favorites/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^⭐ Favorites/ })).toHaveTextContent(
        '⭐ Favorites (2)',
      )
    })
  })

  it('removes an unfavorited item immediately from the favorites tab and updates the counter', async () => {
    const backend = createRadarBackend([
      createPool({ pool_id: 1, pool_name: 'WETH / USDC', pool_address: '0xpool-1', isFavorited: true }),
    ])
    mockGetDiscoverPools.mockImplementation(backend.getDiscoverPools)
    mockFavoritePool.mockImplementation(backend.favoritePool)
    mockUnfavoritePool.mockImplementation(backend.unfavoritePool)

    const user = userEvent.setup()
    renderDiscoverPage()

    await screen.findByText('WETH / USDC')
    await user.click(screen.getByRole('button', { name: /^⭐ Favorites/ }))

    const row = (await screen.findByText('WETH / USDC')).closest('tr') as HTMLTableRowElement
    await user.click(within(row).getByRole('button', { name: /remove from favorites/i }))

    expect(mockUnfavoritePool).toHaveBeenCalledWith('0xpool-1', 1, 1)

    await waitFor(() => {
      expect(screen.queryByText('WETH / USDC')).not.toBeInTheDocument()
      expect(screen.getByText('No pools found for this filter.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^⭐ Favorites/ })).toHaveTextContent(
        '⭐ Favorites (0)',
      )
    })
  })
})
