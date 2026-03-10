import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PoolDetailPage from './PoolDetailPage'
import type {
  AllocateResponse,
  LiquidityDistributionDefaultRangeResponse,
  LiquidityDistributionResponse,
  PoolDetail,
  PoolFavoriteResponse,
  PoolPriceResponse,
  SimulateAprResponse,
} from '../services/api'

const mockGetPoolByAddress = vi.fn()
const mockGetPoolFavoriteStatus = vi.fn()
const mockGetPoolPrice = vi.fn()
const mockPostAllocate = vi.fn()
const mockPostLiquidityDistribution = vi.fn()
const mockPostLiquidityDistributionDefaultRange = vi.fn()
const mockPostMatchTicks = vi.fn()
const mockPostPoolRecentView = vi.fn()
const mockPostSimulateApr = vi.fn()
const mockFavoritePool = vi.fn()
const mockUnfavoritePool = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')

  return {
    ...actual,
    getPoolByAddress: (...args: unknown[]) => mockGetPoolByAddress(...args),
    getPoolFavoriteStatus: (...args: unknown[]) => mockGetPoolFavoriteStatus(...args),
    getPoolPrice: (...args: unknown[]) => mockGetPoolPrice(...args),
    postAllocate: (...args: unknown[]) => mockPostAllocate(...args),
    postLiquidityDistribution: (...args: unknown[]) => mockPostLiquidityDistribution(...args),
    postLiquidityDistributionDefaultRange: (...args: unknown[]) =>
      mockPostLiquidityDistributionDefaultRange(...args),
    postMatchTicks: (...args: unknown[]) => mockPostMatchTicks(...args),
    postPoolRecentView: (...args: unknown[]) => mockPostPoolRecentView(...args),
    postSimulateApr: (...args: unknown[]) => mockPostSimulateApr(...args),
    favoritePool: (...args: unknown[]) => mockFavoritePool(...args),
    unfavoritePool: (...args: unknown[]) => mockUnfavoritePool(...args),
  }
})

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../hooks/useVolumeHistory', () => ({
  useVolumeHistory: () => ({
    data: [],
    loading: false,
    error: '',
    stats: null,
    summary: null,
  }),
}))

vi.mock('../components/VolumeSummaryCard', () => ({
  VolumeSummaryCard: () => <div data-testid="volume-summary-card" />,
}))

vi.mock('../components/VolumeHistoryChart', () => ({
  VolumeHistoryChart: () => <div data-testid="volume-history-chart" />,
}))

const basePoolDetail: PoolDetail = {
  id: 'pool-1',
  dex_key: 'uniswap',
  dex_name: 'Uniswap',
  dex_version: 'v3',
  chain_key: 'ethereum',
  chain_name: 'Ethereum',
  fee_tier: 500,
  token0_address: '0xToken0',
  token0_symbol: 'WETH',
  token0_decimals: 18,
  token0_icon_url: null,
  token1_address: '0xToken1',
  token1_symbol: 'USDC',
  token1_decimals: 6,
  token1_icon_url: null,
  external_position_action: {
    available: true,
    provider: 'uniswap',
    product: 'positions',
    version: 'v3',
    chain: {
      id: 1,
      key: 'ethereum',
    },
    pool_tokens: {
      token0_address: '0xToken0',
      token1_address: '0xToken1',
    },
    fee: {
      is_dynamic: false,
      fee_amount: 500,
      tick_spacing: 10,
    },
    hook: null,
    url_template: 'https://app.uniswap.org/positions/create/{version}',
    deeplink_payload: {
      chain: 'ethereum',
      fee: {
        is_dynamic: false,
        fee_amount: 500,
        tick_spacing: 10,
      },
      hook: null,
    },
  },
}

const poolPriceResponse: PoolPriceResponse = {
  status: {
    price: 3000,
  },
}

const distributionResponse: LiquidityDistributionResponse = {
  data: [],
  pool: {
    token0: 'WETH',
    token1: 'USDC',
    fee_tier: 500,
    token0_decimals: 18,
    token1_decimals: 6,
  },
  current_tick: 0,
}

const defaultRangeResponse: LiquidityDistributionDefaultRangeResponse = {
  min_price: 2800,
  max_price: 3200,
  min_tick: 0,
  max_tick: 0,
  tick_spacing: 10,
}

const allocateResponse: AllocateResponse = {
  amount_token0: '0.1',
  amount_token1: '300',
  price_token0_usd: '3000',
  price_token1_usd: '1',
  token0_symbol: 'WETH',
  token1_symbol: 'USDC',
}

const simulateAprResponse: SimulateAprResponse = {
  fee_apr: '12.34',
}

const favoriteStatusResponse: PoolFavoriteResponse = {
  isFavorited: false,
}

const renderPoolDetailPage = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/simulate/pools/0xpool-1${search}`]}>
      <Routes>
        <Route path="/simulate/pools/:poolAddress" element={<PoolDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('PoolDetailPage create position', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    })

    mockGetPoolByAddress.mockResolvedValue(basePoolDetail)
    mockGetPoolFavoriteStatus.mockResolvedValue(favoriteStatusResponse)
    mockGetPoolPrice.mockResolvedValue(poolPriceResponse)
    mockPostAllocate.mockResolvedValue(allocateResponse)
    mockPostLiquidityDistribution.mockResolvedValue(distributionResponse)
    mockPostLiquidityDistributionDefaultRange.mockResolvedValue(defaultRangeResponse)
    mockPostMatchTicks.mockResolvedValue({
      min_price_matched: 2800,
      max_price_matched: 3200,
    })
    mockPostPoolRecentView.mockResolvedValue(undefined)
    mockPostSimulateApr.mockResolvedValue(simulateAprResponse)
    mockFavoritePool.mockResolvedValue({ isFavorited: true })
    mockUnfavoritePool.mockResolvedValue({ isFavorited: false })
  })

  it('opens the external create-position URL using the current inverted UI state', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    renderPoolDetailPage(
      '?network_id=1&exchange_id=1&token0_symbol=WETH&token1_symbol=USDC&swapped_pair=true',
    )

    const button = await screen.findByRole('button', { name: 'Create Position' })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(openSpy).toHaveBeenCalledTimes(1)

    const [openedUrl, target, features] = openSpy.mock.calls[0]
    expect(target).toBe('_blank')
    expect(features).toBe('noopener,noreferrer')

    const parsed = new URL(String(openedUrl))
    expect(parsed.origin).toBe('https://app.uniswap.org')
    expect(parsed.pathname).toBe('/positions/create/v3')
    expect(parsed.searchParams.get('currencyA')).toBe('0xToken1')
    expect(parsed.searchParams.get('currencyB')).toBe('0xToken0')
    expect(parsed.searchParams.get('hook')).toBe('undefined')
    expect(JSON.parse(parsed.searchParams.get('priceRangeState') ?? '')).toMatchObject({
      priceInverted: true,
    })
    expect(JSON.parse(parsed.searchParams.get('depositState') ?? '')).toMatchObject({
      exactField: 'TOKEN1',
    })
  })

  it('keeps the button disabled when external create-position is unavailable', async () => {
    mockGetPoolByAddress.mockResolvedValue({
      ...basePoolDetail,
      external_position_action: {
        available: false,
        reason: 'unsupported_dex_or_version',
      },
    } satisfies PoolDetail)

    renderPoolDetailPage('?network_id=1&exchange_id=1')

    const button = await screen.findByRole('button', { name: 'Create Position' })

    await waitFor(() => {
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', 'Create position unavailable for this pool')
    })
  })
})
