import type { ExternalPositionAction } from '../../services/api'

type BuildExternalPositionUrlOptions = {
  isPairInverted: boolean
}

type SerializableValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | null
  | undefined

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isUniswapAction = (action: ExternalPositionAction) =>
  normalizeString(action.provider).toLowerCase() === 'uniswap'

const serializeQueryValue = (
  key: string,
  value: SerializableValue,
  action: ExternalPositionAction,
): string | null => {
  if (value === undefined) {
    return null
  }

  if (value === null) {
    if (key === 'hook' && isUniswapAction(action)) {
      return 'undefined'
    }
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value)
}

export const buildExternalPositionUrl = (
  action: ExternalPositionAction | null | undefined,
  options: BuildExternalPositionUrlOptions,
): string | null => {
  if (!action?.available) {
    return null
  }

  const version = normalizeString(action.version)
  const urlTemplate = normalizeString(action.url_template)
  const token0Address = normalizeString(action.pool_tokens?.token0_address)
  const token1Address = normalizeString(action.pool_tokens?.token1_address)

  if (!version || !urlTemplate || !token0Address || !token1Address) {
    return null
  }

  const resolvedUrl = urlTemplate.replace('{version}', encodeURIComponent(version))
  let url: URL

  try {
    url = new URL(resolvedUrl)
  } catch {
    return null
  }

  const currencyA = options.isPairInverted ? token1Address : token0Address
  const currencyB = options.isPairInverted ? token0Address : token1Address
  const deeplinkPayload = isRecord(action.deeplink_payload) ? action.deeplink_payload : {}

  const payload: Record<string, SerializableValue> = {
    ...deeplinkPayload,
    currencyA,
    currencyB,
  }

  if (payload.chain === undefined && action.chain?.key) {
    payload.chain = action.chain.key
  }
  if (payload.fee === undefined && action.fee) {
    payload.fee = action.fee
  }
  if (payload.hook === undefined && Object.prototype.hasOwnProperty.call(action, 'hook')) {
    payload.hook = action.hook
  }

  if (isUniswapAction(action)) {
    const priceRangeState = isRecord(payload.priceRangeState) ? payload.priceRangeState : {}
    const depositState = isRecord(payload.depositState) ? payload.depositState : {}

    payload.priceRangeState = {
      priceInverted: options.isPairInverted,
      fullRange: false,
      initialPrice: '',
      inputMode: 'price',
      ...priceRangeState,
    }

    payload.depositState = {
      exactField: options.isPairInverted ? 'TOKEN1' : 'TOKEN0',
      exactAmounts: {},
      ...depositState,
    }
  }

  Object.entries(payload).forEach(([key, value]) => {
    const serialized = serializeQueryValue(key, value, action)
    if (serialized === null) {
      return
    }
    url.searchParams.set(key, serialized)
  })

  return url.toString()
}
