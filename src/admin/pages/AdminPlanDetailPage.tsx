import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import '../../admin/admin.css'
import { useAuth } from '../../auth/AuthContext'
import { PlanFeaturesEditor } from '../components/PlanFeaturesEditor'
import { PlanForm } from '../components/PlanForm'
import type { PlanFormValues } from '../components/PlanForm'
import { PlanPricesPanel } from '../components/PlanPricesPanel'
import { ADMIN_BILLING_CATALOG_WRITE } from '../permissions'
import {
  getAdminBillingFeatures,
  getAdminBillingPlan,
  getAdminBillingPlanFeatures,
  getAdminBillingPlanPrices,
  updateAdminBillingPlan,
  updateAdminBillingPlanFeatures,
  createAdminBillingPlanPrice,
  updateAdminBillingPrice,
} from '../services/adminBillingApi'
import type {
  AdminBillingFeature,
  AdminBillingPlan,
  AdminBillingPlanFeatureGrant,
  AdminBillingPrice,
  CreateAdminBillingPricePayload,
  UpdateAdminBillingPricePayload,
  UpdateAdminBillingPlanPayload,
} from '../types/adminBilling'
import './AdminPlanDetailPage.css'

type LoadStatus = 'loading' | 'success' | 'error'

const buildPlanFormValues = (plan: AdminBillingPlan): PlanFormValues => ({
  name: plan.name,
  code: plan.code,
  description: plan.description ?? '',
  sort_order: String(plan.sort_order),
  is_active: plan.is_active,
  is_public: plan.is_public,
})

function AdminPlanDetailPage() {
  const { planId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { hasAdminPermission } = useAuth()
  const canWrite = hasAdminPermission(ADMIN_BILLING_CATALOG_WRITE)

  const [plan, setPlan] = useState<AdminBillingPlan | null>(null)
  const [prices, setPrices] = useState<AdminBillingPrice[]>([])
  const [catalog, setCatalog] = useState<AdminBillingFeature[]>([])
  const [grants, setGrants] = useState<AdminBillingPlanFeatureGrant[]>([])

  const [planStatus, setPlanStatus] = useState<LoadStatus>('loading')
  const [planError, setPlanError] = useState('')
  const [planSubmitError, setPlanSubmitError] = useState('')
  const [planSubmitSuccess, setPlanSubmitSuccess] = useState('')
  const [isSavingPlan, setIsSavingPlan] = useState(false)

  const [featuresStatus, setFeaturesStatus] = useState<LoadStatus>('loading')
  const [featuresError, setFeaturesError] = useState('')
  const [featuresSubmitError, setFeaturesSubmitError] = useState('')
  const [featuresSubmitSuccess, setFeaturesSubmitSuccess] = useState('')
  const [isSavingFeatures, setIsSavingFeatures] = useState(false)

  const [pricesStatus, setPricesStatus] = useState<LoadStatus>('loading')
  const [pricesError, setPricesError] = useState('')

  useEffect(() => {
    const state = location.state as { adminNotice?: string } | null
    if (!state?.adminNotice) {
      return
    }

    setPlanSubmitSuccess(state.adminNotice)
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      { replace: true, state: null },
    )
  }, [location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    let cancelled = false

    const loadPlan = async () => {
      setPlanStatus('loading')
      setPlanError('')

      try {
        const response = await getAdminBillingPlan(planId)
        if (cancelled) {
          return
        }
        setPlan(response)
        setPlanStatus('success')
      } catch (loadError) {
        if (cancelled) {
          return
        }
        setPlanError(loadError instanceof Error ? loadError.message : 'Unable to load plan.')
        setPlanStatus('error')
      }
    }

    const loadFeatures = async () => {
      setFeaturesStatus('loading')
      setFeaturesError('')

      try {
        const [catalogResponse, grantsResponse] = await Promise.all([
          getAdminBillingFeatures(),
          getAdminBillingPlanFeatures(planId),
        ])
        if (cancelled) {
          return
        }
        setCatalog(catalogResponse)
        setGrants(grantsResponse)
        setFeaturesStatus('success')
      } catch (loadError) {
        if (cancelled) {
          return
        }
        setFeaturesError(loadError instanceof Error ? loadError.message : 'Unable to load plan grants.')
        setFeaturesStatus('error')
      }
    }

    const loadPrices = async () => {
      setPricesStatus('loading')
      setPricesError('')

      try {
        const response = await getAdminBillingPlanPrices(planId)
        if (cancelled) {
          return
        }
        setPrices(response)
        setPricesStatus('success')
      } catch (loadError) {
        if (cancelled) {
          return
        }
        setPricesError(loadError instanceof Error ? loadError.message : 'Unable to load prices.')
        setPricesStatus('error')
      }
    }

    void loadPlan()
    void loadFeatures()
    void loadPrices()

    return () => {
      cancelled = true
    }
  }, [planId])

  const planFormValues = useMemo(() => (plan ? buildPlanFormValues(plan) : null), [plan])

  const reloadPrices = async () => {
    setPricesStatus('loading')
    setPricesError('')

    try {
      const response = await getAdminBillingPlanPrices(planId)
      setPrices(response)
      setPricesStatus('success')
    } catch (loadError) {
      setPricesError(loadError instanceof Error ? loadError.message : 'Unable to load prices.')
      setPricesStatus('error')
      throw loadError
    }
  }

  const handleSavePlan = async (values: PlanFormValues) => {
    const payload: UpdateAdminBillingPlanPayload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      sort_order: Number.parseInt(values.sort_order, 10),
      is_active: values.is_active,
      is_public: values.is_public,
    }

    setPlanSubmitError('')
    setPlanSubmitSuccess('')
    setIsSavingPlan(true)

    try {
      const response = await updateAdminBillingPlan(planId, payload)
      setPlan(response)
      setPlanSubmitSuccess('Plan details saved successfully.')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save plan.'
      setPlanSubmitError(message)
      throw saveError
    } finally {
      setIsSavingPlan(false)
    }
  }

  const handleSaveFeatures = async (
    items: Array<{ feature_code: string; is_enabled: boolean; limit_value: number | null }>,
  ) => {
    setFeaturesSubmitError('')
    setFeaturesSubmitSuccess('')
    setIsSavingFeatures(true)

    try {
      const response = await updateAdminBillingPlanFeatures(planId, { items })
      setGrants(response)
      setFeaturesSubmitSuccess('Plan grants saved successfully.')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save grants.'
      setFeaturesSubmitError(message)
      throw saveError
    } finally {
      setIsSavingFeatures(false)
    }
  }

  const handleCreatePrice = async (payload: CreateAdminBillingPricePayload) => {
    await createAdminBillingPlanPrice(planId, payload)
    await reloadPrices()
  }

  const handleUpdatePrice = async (priceId: string, payload: UpdateAdminBillingPricePayload) => {
    await updateAdminBillingPrice(priceId, payload)
    await reloadPrices()
  }

  if (planStatus === 'loading') {
    return (
      <section className="admin-page admin-plan-detail-page">
        <div className="admin-shell">
          <div className="admin-state">Loading plan details...</div>
        </div>
      </section>
    )
  }

  if (planStatus === 'error' || !plan || !planFormValues) {
    return (
      <section className="admin-page admin-plan-detail-page">
        <div className="admin-shell">
          <Link className="admin-plan-detail-page__back" to="/admin/billing/plans">
            ← Back to plans
          </Link>
          <div className="admin-state error">{planError || 'Unable to load the selected plan.'}</div>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-page admin-plan-detail-page">
      <div className="admin-shell admin-plan-detail-page__shell">
        <header className="admin-page__header">
          <div>
            <Link className="admin-plan-detail-page__back" to="/admin/billing/plans">
              ← Back to plans
            </Link>
            <div className="admin-page__eyebrow">Billing Admin</div>
            <h1 className="admin-page__title">{plan.name}</h1>
            <p className="admin-page__subtitle">
              Update plan metadata, manage grants and maintain the list of immutable billing prices.
            </p>
          </div>

          <div className="admin-plan-detail-page__meta">
            <span className={`admin-badge ${plan.is_active ? 'active' : 'inactive'}`}>
              {plan.is_active ? 'Active' : 'Inactive'}
            </span>
            <span className={`admin-badge ${plan.is_public ? 'public' : 'private'}`}>
              {plan.is_public ? 'Public' : 'Private'}
            </span>
            <span className={`admin-badge ${plan.external_product_id ? 'connected' : 'disconnected'}`}>
              {plan.external_product_id ? 'Stripe connected' : 'Stripe pending'}
            </span>
          </div>
        </header>

        <section className="admin-card">
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title">General data</h2>
              <p className="admin-section-copy">
                The plan code is read only after creation. The Stripe product identifier is shown for
                reference when available.
              </p>
            </div>
          </div>

          <div className="admin-plan-detail-page__external-id">
            <span className="inp-label">External product ID</span>
            <div className={`inp admin-readonly admin-plan-detail-page__readonly-line${plan.external_product_id ? '' : ' is-empty'}`}>
              {plan.external_product_id || 'Not generated yet'}
            </div>
          </div>

          <PlanForm
            canWrite={canWrite}
            initialValues={planFormValues}
            isSubmitting={isSavingPlan}
            mode="edit"
            submitError={planSubmitError}
            submitLabel="Save changes"
            submitSuccess={planSubmitSuccess}
            onSubmit={handleSavePlan}
          />
        </section>

        <section className="admin-card">
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title">Features and grants</h2>
              <p className="admin-section-copy">
                Manage boolean features and numeric limits. The backend expects the full feature catalog
                on every save.
              </p>
            </div>
          </div>

          {featuresStatus === 'loading' ? <div className="admin-state">Loading grants...</div> : null}
          {featuresStatus === 'error' ? <div className="admin-state error">{featuresError}</div> : null}
          {featuresStatus === 'success' ? (
            <PlanFeaturesEditor
              canWrite={canWrite}
              catalog={catalog}
              grants={grants}
              isSubmitting={isSavingFeatures}
              submitError={featuresSubmitError}
              submitSuccess={featuresSubmitSuccess}
              onSubmit={handleSaveFeatures}
            />
          ) : null}
        </section>

        <section className="admin-card">
          <PlanPricesPanel
            canWrite={canWrite}
            error={pricesError}
            isLoading={pricesStatus === 'loading'}
            prices={prices}
            onCreatePrice={handleCreatePrice}
            onUpdatePrice={handleUpdatePrice}
          />
        </section>
      </div>
    </section>
  )
}

export default AdminPlanDetailPage
