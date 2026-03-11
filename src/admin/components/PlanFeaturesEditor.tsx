import { useEffect, useMemo, useState } from 'react'
import type { AdminBillingFeature, AdminBillingPlanFeatureGrant } from '../types/adminBilling'
import './PlanFeaturesEditor.css'

type LocalFeatureItem = {
  feature_code: string
  feature_name: string
  feature_description: string
  feature_type: string
  is_enabled: boolean
  limit_value: string
}

type PlanFeaturesEditorProps = {
  canWrite: boolean
  catalog: AdminBillingFeature[]
  grants: AdminBillingPlanFeatureGrant[]
  isSubmitting: boolean
  submitError?: string
  submitSuccess?: string
  onSubmit: (
    items: Array<{ feature_code: string; is_enabled: boolean; limit_value: number | null }>,
  ) => Promise<void>
}

const buildDraftItems = (
  catalog: AdminBillingFeature[],
  grants: AdminBillingPlanFeatureGrant[],
): LocalFeatureItem[] => {
  const grantsByCode = new Map(grants.map((item) => [item.feature_code, item]))

  return catalog.map((feature) => {
    const grant = grantsByCode.get(feature.code)
    return {
      feature_code: feature.code,
      feature_name: grant?.feature_name ?? feature.name,
      feature_description: grant?.feature_description ?? feature.description ?? '',
      feature_type: grant?.feature_type ?? feature.type,
      is_enabled: grant?.is_enabled ?? false,
      limit_value:
        grant?.feature_type === 'limit' || feature.type === 'limit'
          ? String(grant?.limit_value ?? 0)
          : '',
    }
  })
}

export function PlanFeaturesEditor({
  canWrite,
  catalog,
  grants,
  isSubmitting,
  submitError = '',
  submitSuccess = '',
  onSubmit,
}: PlanFeaturesEditorProps) {
  const initialItems = useMemo(() => buildDraftItems(catalog, grants), [catalog, grants])
  const [items, setItems] = useState<LocalFeatureItem[]>(initialItems)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setItems(initialItems)
    setLocalError('')
  }, [initialItems])

  if (!catalog.length) {
    return <div className="admin-empty">No billing features are available in the catalog.</div>
  }

  const handleSubmit = async () => {
    const payload = items.map((item) => {
      if (item.feature_type === 'limit') {
        const parsedLimitValue = Number.parseInt(item.limit_value, 10)
        if (!Number.isInteger(parsedLimitValue) || parsedLimitValue < 0) {
          throw new Error(`Feature "${item.feature_name}" requires a limit value greater than or equal to zero.`)
        }
        return {
          feature_code: item.feature_code,
          is_enabled: item.is_enabled,
          limit_value: parsedLimitValue,
        }
      }

      return {
        feature_code: item.feature_code,
        is_enabled: item.is_enabled,
        limit_value: null,
      }
    })

    setLocalError('')
    await onSubmit(payload)
  }

  return (
    <div className="admin-features">
      {submitSuccess ? <div className="admin-feedback success">{submitSuccess}</div> : null}
      {submitError ? <div className="admin-feedback error">{submitError}</div> : null}
      {localError ? <div className="admin-feedback error">{localError}</div> : null}

      <div className="admin-features__list">
        {items.map((item) => {
          const isLimitFeature = item.feature_type === 'limit'
          return (
            <article className="admin-features__item" key={item.feature_code}>
              <div className="admin-features__item-head">
                <div>
                  <div className="admin-features__item-title-row">
                    <h3>{item.feature_name}</h3>
                    <span className={`admin-badge${isLimitFeature ? ' warning' : ''}`}>
                      {isLimitFeature ? 'Limit' : 'Boolean'}
                    </span>
                  </div>
                  <p>{item.feature_description || 'No description provided for this feature.'}</p>
                  <code>{item.feature_code}</code>
                </div>

                <label className={`admin-features__toggle${!canWrite ? ' is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={item.is_enabled}
                    disabled={!canWrite || isSubmitting}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row) =>
                          row.feature_code === item.feature_code
                            ? { ...row, is_enabled: event.target.checked }
                            : row,
                        ),
                      )
                    }
                  />
                  <span>Enabled</span>
                </label>
              </div>

              {isLimitFeature ? (
                <label className="admin-features__limit">
                  <span className="inp-label">Limit value</span>
                  <input
                    className="inp"
                    type="number"
                    min="0"
                    step="1"
                    value={item.limit_value}
                    disabled={!canWrite || isSubmitting}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row) =>
                          row.feature_code === item.feature_code
                            ? { ...row, limit_value: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  <span className="admin-field-hint">
                    Limit features require a non-negative integer value.
                  </span>
                </label>
              ) : (
                <p className="admin-help">Boolean features are persisted with a null limit value.</p>
              )}
            </article>
          )
        })}
      </div>

      {canWrite ? (
        <div className="admin-features__actions">
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => {
              void handleSubmit()
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save grants'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
