import { useMemo, useState } from 'react'
import { NewPriceModal } from './NewPriceModal'
import type {
  AdminBillingPrice,
  CreateAdminBillingPricePayload,
  UpdateAdminBillingPricePayload,
} from '../types/adminBilling'
import './PlanPricesPanel.css'

type PlanPricesPanelProps = {
  canWrite: boolean
  error: string
  isLoading: boolean
  prices: AdminBillingPrice[]
  onCreatePrice: (payload: CreateAdminBillingPricePayload) => Promise<void>
  onUpdatePrice: (priceId: string, payload: UpdateAdminBillingPricePayload) => Promise<void>
}

const formatInterval = (interval: string) => {
  if (interval === 'month') {
    return 'Monthly'
  }
  if (interval === 'year') {
    return 'Yearly'
  }
  return interval
}

const formatMoney = (amountCents: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100)
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

export function PlanPricesPanel({
  canWrite,
  error,
  isLoading,
  prices,
  onCreatePrice,
  onUpdatePrice,
}: PlanPricesPanelProps) {
  const [createError, setCreateError] = useState('')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [pendingPriceId, setPendingPriceId] = useState<string | null>(null)

  const sortedPrices = useMemo(
    () =>
      [...prices].sort((left, right) => {
        if (left.interval !== right.interval) {
          return left.interval.localeCompare(right.interval)
        }
        return left.currency.localeCompare(right.currency)
      }),
    [prices],
  )

  const handleCreatePrice = async (payload: CreateAdminBillingPricePayload) => {
    setCreateError('')
    setFeedback(null)
    setIsCreating(true)

    try {
      await onCreatePrice(payload)
      setFeedback({ tone: 'success', message: 'Price created successfully.' })
      setIsCreateOpen(false)
    } catch (createPriceError) {
      const message =
        createPriceError instanceof Error ? createPriceError.message : 'Unable to create price.'
      setCreateError(message)
      throw createPriceError
    } finally {
      setIsCreating(false)
    }
  }

  const handleTogglePrice = async (price: AdminBillingPrice) => {
    setFeedback(null)
    setPendingPriceId(price.id)

    try {
      await onUpdatePrice(price.id, { is_active: !price.is_active })
      setFeedback({ tone: 'success', message: 'Price status updated successfully.' })
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update price.'
      setFeedback({ tone: 'error', message })
    } finally {
      setPendingPriceId(null)
    }
  }

  return (
    <div className="admin-prices">
      <div className="admin-section-head">
        <div>
          <h2 className="admin-section-title">Prices</h2>
          <p className="admin-section-copy">
            Interval, currency, amount and Stripe identifiers are immutable after creation. To change
            them, create a new price and deactivate the old one.
          </p>
        </div>

        {canWrite ? (
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => {
              setCreateError('')
              setFeedback(null)
              setIsCreateOpen(true)
            }}
          >
            New price
          </button>
        ) : null}
      </div>

      {feedback ? <div className={`admin-feedback ${feedback.tone}`}>{feedback.message}</div> : null}

      <p className="admin-help admin-prices__help">
        The backend creates Stripe prices automatically, fixes new admin prices to USD and enforces
        only one active price for the same plan, interval and currency combination.
      </p>

      {isLoading ? <div className="admin-state">Loading prices...</div> : null}
      {!isLoading && error ? <div className="admin-state error">{error}</div> : null}
      {!isLoading && !error && !sortedPrices.length ? (
        <div className="admin-empty">This plan does not have any prices yet.</div>
      ) : null}

      {!isLoading && !error && sortedPrices.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Interval</th>
                <th>Currency</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Stripe price</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedPrices.map((price) => (
                <tr key={price.id}>
                  <td>{formatInterval(price.interval)}</td>
                  <td>
                    <code>{price.currency}</code>
                  </td>
                  <td>
                    <strong>{formatMoney(price.amount_cents, price.currency)}</strong>
                    <span className="admin-help">{price.amount_cents} cents</span>
                  </td>
                  <td>
                    <span className={`admin-badge ${price.is_active ? 'active' : 'inactive'}`}>
                      {price.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {price.external_price_id ? (
                      <code>{price.external_price_id}</code>
                    ) : (
                      <span className="admin-help">Generated by backend</span>
                    )}
                  </td>
                  <td>
                    {canWrite ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          void handleTogglePrice(price)
                        }}
                        disabled={pendingPriceId === price.id}
                      >
                        {pendingPriceId === price.id
                          ? 'Saving...'
                          : price.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    ) : (
                      <span className="admin-help">Read only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <NewPriceModal
        isSubmitting={isCreating}
        open={isCreateOpen}
        submitError={createError}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreatePrice}
      />
    </div>
  )
}
