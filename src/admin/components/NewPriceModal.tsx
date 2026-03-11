import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { CreateAdminBillingPricePayload } from '../types/adminBilling'
import './NewPriceModal.css'

type NewPriceModalProps = {
  isSubmitting: boolean
  open: boolean
  submitError?: string
  onClose: () => void
  onSubmit: (payload: CreateAdminBillingPricePayload) => Promise<void>
}

const parseAmountToCents = (value: string) => {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return Math.round(parsed * 100)
}

export function NewPriceModal({
  isSubmitting,
  open,
  submitError = '',
  onClose,
  onSubmit,
}: NewPriceModalProps) {
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [amount, setAmount] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }
    setInterval('month')
    setAmount('')
    setIsActive(true)
    setLocalError('')
  }, [open])

  const amountPreview = useMemo(() => {
    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      return '--'
    }
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amountCents / 100)
    } catch {
      return `${(amountCents / 100).toFixed(2)} USD`
    }
  }, [amount])

  const handleClose = () => {
    if (isSubmitting) {
      return
    }
    onClose()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      setLocalError('Amount must be a valid non-negative number.')
      return
    }

    setLocalError('')

    try {
      await onSubmit({
        interval,
        amount_cents: amountCents,
        is_active: isActive,
      })
      handleClose()
    } catch {
      // parent handles the API error message
    }
  }

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      onClick={handleClose}
      aria-hidden={!open}
    >
      <div
        className="modal-box admin-price-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create price"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={handleClose} disabled={isSubmitting}>
          ✕
        </button>
        <div className="modal-brand">
          <span className="modal-brand-logo brand-logo" aria-hidden="true">
            PA
          </span>
          <span className="modal-brand-name">Billing Admin</span>
        </div>
        <h2 className="modal-title">New price</h2>
        <p className="modal-sub">
          Stripe price creation is handled automatically by the backend. Currency is fixed to USD
          for admin-created prices.
        </p>

        <form className="admin-price-modal__form" onSubmit={(event) => void handleSubmit(event)}>
          {submitError ? <div className="admin-feedback error">{submitError}</div> : null}
          {localError ? <div className="admin-feedback error">{localError}</div> : null}

          <label className="modal-field">
            <span className="inp-label">Billing interval</span>
            <div className="admin-price-modal__select-wrap">
              <select
                className="inp admin-price-modal__select"
                value={interval}
                onChange={(event) => setInterval(event.target.value as 'month' | 'year')}
                disabled={isSubmitting}
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
          </label>

          <div className="modal-field">
            <span className="inp-label">Currency</span>
            <div className="inp admin-readonly">USD</div>
          </div>

          <label className="modal-field">
            <span className="inp-label">Amount</span>
            <input
              className="inp"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isSubmitting}
              placeholder="29.00"
            />
            <span className="admin-field-hint">Preview: {amountPreview}</span>
          </label>

          <label className="admin-price-modal__toggle">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={isSubmitting}
            />
            <span>
              <strong>Active price</strong>
              <small>Only one active price per plan, interval and currency is allowed.</small>
            </span>
          </label>

          <div className="admin-price-modal__actions">
            <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-accent" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create price'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
