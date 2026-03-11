import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import '../../admin/admin.css'
import { useAuth } from '../../auth/AuthContext'
import { getAdminBillingPlans } from '../services/adminBillingApi'
import type { AdminBillingPlan } from '../types/adminBilling'
import { ADMIN_BILLING_CATALOG_WRITE } from '../permissions'
import './AdminPlansPage.css'

type LoadStatus = 'loading' | 'success' | 'error'
type ActivityFilter = 'all' | 'active' | 'inactive'
type VisibilityFilter = 'all' | 'public' | 'private'

const formatPricesSummary = (plan: AdminBillingPlan) => {
  if (!plan.prices.length) {
    return 'No prices'
  }

  const activePrices = plan.prices.filter((price) => price.is_active).length
  return `${plan.prices.length} price${plan.prices.length === 1 ? '' : 's'} · ${activePrices} active`
}

function AdminPlansPage() {
  const { hasAdminPermission } = useAuth()
  const canWrite = hasAdminPermission(ADMIN_BILLING_CATALOG_WRITE)
  const [plans, setPlans] = useState<AdminBillingPlan[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all')

  useEffect(() => {
    let cancelled = false

    const loadPlans = async () => {
      setStatus('loading')
      setError('')

      try {
        const response = await getAdminBillingPlans()
        if (cancelled) {
          return
        }
        setPlans(response)
        setStatus('success')
      } catch (loadError) {
        if (cancelled) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to load plans.')
        setStatus('error')
      }
    }

    void loadPlans()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredPlans = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return plans.filter((plan) => {
      if (
        normalizedQuery &&
        !plan.name.toLowerCase().includes(normalizedQuery) &&
        !plan.code.toLowerCase().includes(normalizedQuery)
      ) {
        return false
      }

      if (activityFilter === 'active' && !plan.is_active) {
        return false
      }
      if (activityFilter === 'inactive' && plan.is_active) {
        return false
      }

      if (visibilityFilter === 'public' && !plan.is_public) {
        return false
      }
      if (visibilityFilter === 'private' && plan.is_public) {
        return false
      }

      return true
    })
  }, [activityFilter, plans, query, visibilityFilter])

  return (
    <section className="admin-page admin-plans-page">
      <div className="admin-shell">
        <header className="admin-page__header">
          <div>
            <div className="admin-page__eyebrow">Billing Admin</div>
            <h1 className="admin-page__title">Plan management</h1>
            <p className="admin-page__subtitle">
              Browse the current billing catalog, filter plans and jump into plan-level editing for
              grants and prices.
            </p>
          </div>

          {canWrite ? (
            <Link className="btn btn-accent" to="/admin/billing/plans/new">
              New plan
            </Link>
          ) : null}
        </header>

        <section className="admin-card admin-plans-page__filters">
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title">Catalog filters</h2>
              <p className="admin-section-copy">Search by plan name or code and filter by visibility or status.</p>
            </div>
          </div>

          <form
            className="admin-plans-page__filter-grid"
            onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
          >
            <label>
              <span className="inp-label">Search</span>
              <input
                className="inp"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or code"
              />
            </label>

            <label>
              <span className="inp-label">Status</span>
              <select
                className="inp admin-plans-page__select"
                value={activityFilter}
                onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </label>

            <label>
              <span className="inp-label">Visibility</span>
              <select
                className="inp admin-plans-page__select"
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}
              >
                <option value="all">All visibility states</option>
                <option value="public">Public only</option>
                <option value="private">Private only</option>
              </select>
            </label>
          </form>
        </section>

        <section className="admin-card">
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title">Plans</h2>
              <p className="admin-section-copy">
                Review public status, activation state, Stripe linkage and pricing footprint for each plan.
              </p>
            </div>
          </div>

          {status === 'loading' ? <div className="admin-state">Loading plans...</div> : null}
          {status === 'error' ? <div className="admin-state error">{error}</div> : null}
          {status === 'success' && !plans.length ? (
            <div className="admin-empty">No plans have been created yet.</div>
          ) : null}
          {status === 'success' && plans.length > 0 && !filteredPlans.length ? (
            <div className="admin-empty">No plans match the current filters.</div>
          ) : null}

          {status === 'success' && filteredPlans.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Visibility</th>
                    <th>Status</th>
                    <th>Prices</th>
                    <th>Stripe</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <strong>{plan.name}</strong>
                        <code>{plan.code}</code>
                      </td>
                      <td>
                        <span className={`admin-badge ${plan.is_public ? 'public' : 'private'}`}>
                          {plan.is_public ? 'Public' : 'Private'}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-badge ${plan.is_active ? 'active' : 'inactive'}`}>
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{formatPricesSummary(plan)}</td>
                      <td>
                        <span
                          className={`admin-badge ${plan.external_product_id ? 'connected' : 'disconnected'}`}
                        >
                          {plan.external_product_id ? 'Connected' : 'Not connected'}
                        </span>
                      </td>
                      <td>
                        <Link className="admin-link" to={`/admin/billing/plans/${plan.id}`}>
                          Open plan
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  )
}

export default AdminPlansPage
