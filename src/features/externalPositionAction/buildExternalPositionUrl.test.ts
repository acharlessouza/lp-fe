import { describe, expect, it } from 'vitest'
import type { ExternalPositionAction } from '../../services/api'
import { buildExternalPositionUrl } from './buildExternalPositionUrl'

const baseAction: ExternalPositionAction = {
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
}

describe('buildExternalPositionUrl', () => {
  it('returns a valid Uniswap v3 create-position URL', () => {
    const url = buildExternalPositionUrl(baseAction, { isPairInverted: false })

    expect(url).toBeTruthy()

    const parsed = new URL(url as string)
    expect(parsed.origin).toBe('https://app.uniswap.org')
    expect(parsed.pathname).toBe('/positions/create/v3')
  })

  it('keeps currencyA and currencyB in canonical order when the pair is not inverted', () => {
    const url = new URL(buildExternalPositionUrl(baseAction, { isPairInverted: false }) as string)

    expect(url.searchParams.get('currencyA')).toBe('0xToken0')
    expect(url.searchParams.get('currencyB')).toBe('0xToken1')
  })

  it('inverts currencyA and currencyB when the UI pair is inverted', () => {
    const url = new URL(buildExternalPositionUrl(baseAction, { isPairInverted: true }) as string)

    expect(url.searchParams.get('currencyA')).toBe('0xToken1')
    expect(url.searchParams.get('currencyB')).toBe('0xToken0')
  })

  it('serializes the fee object as JSON', () => {
    const url = new URL(buildExternalPositionUrl(baseAction, { isPairInverted: false }) as string)

    expect(JSON.parse(url.searchParams.get('fee') ?? '')).toEqual({
      is_dynamic: false,
      fee_amount: 500,
      tick_spacing: 10,
    })
  })

  it('includes priceRangeState with the current UI inversion', () => {
    const url = new URL(buildExternalPositionUrl(baseAction, { isPairInverted: true }) as string)

    expect(JSON.parse(url.searchParams.get('priceRangeState') ?? '')).toEqual({
      priceInverted: true,
      fullRange: false,
      initialPrice: '',
      inputMode: 'price',
    })
  })

  it('includes depositState with the correct exact field for the current UI inversion', () => {
    const url = new URL(buildExternalPositionUrl(baseAction, { isPairInverted: true }) as string)

    expect(JSON.parse(url.searchParams.get('depositState') ?? '')).toEqual({
      exactField: 'TOKEN1',
      exactAmounts: {},
    })
  })

  it('serializes hook=null as hook=undefined for Uniswap actions', () => {
    const url = new URL(buildExternalPositionUrl(baseAction, { isPairInverted: false }) as string)

    expect(url.searchParams.get('hook')).toBe('undefined')
  })

  it('returns null when the action is unavailable', () => {
    expect(
      buildExternalPositionUrl(
        {
          ...baseAction,
          available: false,
        },
        { isPairInverted: false },
      ),
    ).toBeNull()
  })
})
