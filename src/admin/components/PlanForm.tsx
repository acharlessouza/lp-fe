import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './PlanForm.css'

export type PlanFormValues = {
  name: string
  code: string
  description: string
  sort_order: string
  is_active: boolean
  is_public: boolean
}

type PlanFormProps = {
  canWrite: boolean
  initialValues: PlanFormValues
  isSubmitting: boolean
  mode: 'create' | 'edit'
  submitError?: string
  submitLabel: string
  submitSuccess?: string
  onCancel?: () => void
  onSubmit: (values: PlanFormValues) => Promise<void>
}

const createEmptyValidation = () => ({
  localError: '',
})

export function PlanForm({
  canWrite,
  initialValues,
  isSubmitting,
  mode,
  submitError = '',
  submitLabel,
  submitSuccess = '',
  onCancel,
  onSubmit,
}: PlanFormProps) {
  const [values, setValues] = useState<PlanFormValues>(initialValues)
  const [{ localError }, setValidation] = useState(createEmptyValidation)

  useEffect(() => {
    setValues(initialValues)
    setValidation(createEmptyValidation())
  }, [initialValues])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = values.name.trim()
    const code = values.code.trim()
    if (!name) {
      setValidation({ localError: 'Plan name is required.' })
      return
    }
    if (mode === 'create' && !code) {
      setValidation({ localError: 'Plan code is required.' })
      return
    }

    const parsedSortOrder = Number.parseInt(values.sort_order, 10)
    if (!Number.isInteger(parsedSortOrder)) {
      setValidation({ localError: 'Sort order must be an integer.' })
      return
    }

    setValidation(createEmptyValidation())

    await onSubmit({
      ...values,
      name,
      code,
      sort_order: String(parsedSortOrder),
    })
  }

  const isDisabled = isSubmitting || !canWrite

  return (
    <form className="admin-plan-form" onSubmit={(event) => void handleSubmit(event)}>
      {submitSuccess ? <div className="admin-feedback success">{submitSuccess}</div> : null}
      {submitError ? <div className="admin-feedback error">{submitError}</div> : null}
      {localError ? <div className="admin-feedback error">{localError}</div> : null}

      <div className="admin-plan-form__grid">
        <label className="admin-plan-form__field">
          <span className="inp-label">Plan name</span>
          <input
            className="inp"
            type="text"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            disabled={isDisabled}
            placeholder="Pro"
          />
        </label>

        <label className="admin-plan-form__field">
          <span className="inp-label">Plan code</span>
          <input
            className={`inp${mode === 'edit' ? ' admin-readonly' : ''}`}
            type="text"
            value={values.code}
            onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
            disabled={mode === 'edit' || isDisabled}
            readOnly={mode === 'edit'}
            placeholder="pro"
          />
          <span className="admin-field-hint">
            {mode === 'edit'
              ? 'Plan code is immutable after creation.'
              : 'Used by the backend as the unique catalog identifier.'}
          </span>
        </label>

        <label className="admin-plan-form__field admin-plan-form__field--sort-order">
          <span className="inp-label">Sort order</span>
          <input
            className="inp"
            type="number"
            step="1"
            value={values.sort_order}
            onChange={(event) => setValues((current) => ({ ...current, sort_order: event.target.value }))}
            disabled={isDisabled}
            placeholder="10"
          />
        </label>

        <label className="admin-plan-form__field admin-plan-form__field--full">
          <span className="inp-label">Description</span>
          <textarea
            className="inp admin-plan-form__textarea"
            value={values.description}
            onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
            disabled={isDisabled}
            placeholder="Professional plan for advanced users."
            rows={3}
          />
        </label>

        <div className="admin-plan-form__field admin-plan-form__field--full admin-plan-form__toggles">
          <label className={`admin-plan-form__toggle${isDisabled ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={(event) =>
                setValues((current) => ({ ...current, is_active: event.target.checked }))
              }
              disabled={isDisabled}
            />
            <span>
              <strong>Active</strong>
              <small>Inactive plans stay in the catalog but cannot be sold.</small>
            </span>
          </label>

          <label className={`admin-plan-form__toggle${isDisabled ? ' is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={values.is_public}
              onChange={(event) =>
                setValues((current) => ({ ...current, is_public: event.target.checked }))
              }
              disabled={isDisabled}
            />
            <span>
              <strong>Public</strong>
              <small>Public plans can be surfaced in the product catalog.</small>
            </span>
          </label>
        </div>
      </div>

      {canWrite ? (
        <div className="admin-plan-form__actions">
          {onCancel ? (
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="btn btn-accent" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      ) : null}
    </form>
  )
}
