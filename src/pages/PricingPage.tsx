import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  createCheckoutSession,
  getPricingPlans,
  type PricingPlan,
  type PricingPlanFeature,
  type PricingPlanPrice,
} from '../services/api'
import './PricingPage.css'

type BillingMode = 'monthly' | 'annual'
type LoadStatus = 'loading' | 'success' | 'error'

const FAQ_ITEMS = [
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Cancel from settings. Access stays until end of billing period.',
  },
  {
    question: 'Which DEXs are supported?',
    answer:
      'Uniswap V3, PancakeSwap V3, SushiSwap V3, QuickSwap, Thena, and more coming.',
  },
  {
    question: 'Is there a free trial for Pro?',
    answer: 'Yes, 7 days free, no credit card needed.',
  },
]

const formatPrice = (price: PricingPlanPrice) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price.amount_cents / 100)
  } catch {
    return `${(price.amount_cents / 100).toFixed(2)} ${price.currency.toUpperCase()}`
  }
}

const formatLimitValue = (value: number) => new Intl.NumberFormat('en-US').format(value)

const getFeatureLabel = (feature: PricingPlanFeature) => {
  const baseLabel = feature.description?.trim() || feature.name.trim() || feature.code.replace(/_/g, ' ')

  if (feature.type === 'limit' && feature.is_enabled && feature.limit_value !== null) {
    return `${baseLabel}: ${formatLimitValue(feature.limit_value)}`
  }

  return baseLabel
}

const hasPaidPrice = (plan: PricingPlan) =>
  [plan.monthly_price, plan.yearly_price].some((price) => (price?.amount_cents ?? 0) > 0)

const isFreePlan = (plan: PricingPlan) =>
  plan.code === 'free' || [plan.monthly_price, plan.yearly_price].some((price) => price?.amount_cents === 0)

const getSelectedPrice = (plan: PricingPlan, billingMode: BillingMode) =>
  billingMode === 'monthly' ? plan.monthly_price : plan.yearly_price

const getFallbackPrice = (plan: PricingPlan, billingMode: BillingMode) =>
  billingMode === 'monthly' ? plan.yearly_price : plan.monthly_price

const getPopularPlanId = (plans: PricingPlan[]) => {
  const proPlan = plans.find((plan) => plan.code === 'pro')
  if (proPlan) {
    return proPlan.id
  }

  // Highlight the first paid plan when the backend does not provide an explicit flag.
  return plans.find((plan) => hasPaidPrice(plan))?.id ?? null
}

function PricingPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [billingMode, setBillingMode] = useState<BillingMode>('monthly')
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const isMonthly = billingMode === 'monthly'

  useEffect(() => {
    const controller = new AbortController()

    const loadPlans = async () => {
      setStatus('loading')
      setError('')

      try {
        const response = await getPricingPlans(controller.signal)
        setPlans([...response.plans].sort((left, right) => left.sort_order - right.sort_order))
        setStatus('success')
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to load pricing plans.')
        setStatus('error')
      }
    }

    void loadPlans()

    return () => controller.abort()
  }, [reloadKey])

  const popularPlanId = useMemo(() => getPopularPlanId(plans), [plans])

  const openAuthFlow = (mode: 'login' | 'signup') => {
    const from = `${location.pathname}${location.search}`
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      {
        state: {
          openAuth: mode,
          from,
        },
      },
    )
  }

  const handlePlanAction = async (plan: PricingPlan) => {
    setCheckoutError('')

    const selectedPrice = getSelectedPrice(plan, billingMode)
    const freePlan = isFreePlan(plan)

    if (freePlan) {
      if (isAuthenticated) {
        navigate('/simulate')
        return
      }
      openAuthFlow('signup')
      return
    }

    if (!selectedPrice) {
      return
    }

    if (!isAuthenticated) {
      openAuthFlow('login')
      return
    }

    setPendingPlanId(plan.id)
    try {
      const response = await createCheckoutSession(selectedPrice.id)
      window.location.assign(response.checkout_url)
    } catch (checkoutRequestError) {
      setCheckoutError(
        checkoutRequestError instanceof Error
          ? checkoutRequestError.message
          : 'Unable to start checkout.',
      )
      setPendingPlanId(null)
    }
  }

  return (
    <section className="pricing-page">
      <div className="pricing-wrap">
        <div className="pricing-head">
          <div className="pricing-pill">Flexible Plans</div>
          <h1>Simple, honest pricing</h1>
          <p>
            Start free, upgrade when you need more. No tricks, no lock-ins.
          </p>
          <div className="pricing-billing-toggle" role="tablist" aria-label="Billing period">
            <button
              type="button"
              className={`pricing-billing-btn${isMonthly ? ' is-active' : ''}`}
              onClick={() => setBillingMode('monthly')}
              aria-selected={isMonthly}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`pricing-billing-btn${!isMonthly ? ' is-active' : ''}`}
              onClick={() => setBillingMode('annual')}
              aria-selected={!isMonthly}
            >
              Annual
            </button>
          </div>
        </div>

        {checkoutError ? <div className="pricing-feedback pricing-feedback-error">{checkoutError}</div> : null}

        {status === 'loading' ? <div className="pricing-state">Loading pricing plans...</div> : null}
        {status === 'error' ? (
          <div className="pricing-state pricing-state-error">
            <p>{error || 'Pricing is temporarily unavailable.'}</p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Try again
            </button>
          </div>
        ) : null}
        {status === 'success' && !plans.length ? (
          <div className="pricing-state">Pricing is currently unavailable.</div>
        ) : null}

        {status === 'success' && plans.length ? (
          <div className="price-grid">
            {plans.map((plan) => {
              const selectedPrice = getSelectedPrice(plan, billingMode)
              const fallbackPrice = getFallbackPrice(plan, billingMode)
              const displayPrice = selectedPrice ?? fallbackPrice
              const freePlan = isFreePlan(plan)
              const unavailableForSelectedMode = !selectedPrice && !freePlan
              const isPopular = plan.id === popularPlanId

              let actionLabel = 'Get started'
              if (freePlan) {
                actionLabel = isAuthenticated ? 'Go to simulator' : 'Get started'
              } else if (unavailableForSelectedMode) {
                actionLabel = `Unavailable for ${billingMode === 'monthly' ? 'monthly' : 'annual'} billing`
              } else if (pendingPlanId === plan.id) {
                actionLabel = 'Redirecting...'
              } else {
                actionLabel = 'Start checkout'
              }

              let periodLabel = 'Contact support'
              if (freePlan) {
                periodLabel = 'forever'
              } else if (selectedPrice) {
                periodLabel =
                  billingMode === 'monthly'
                    ? 'per month · billed monthly'
                    : 'per year · billed annually'
              } else if (fallbackPrice) {
                periodLabel =
                  billingMode === 'monthly'
                    ? 'Monthly billing unavailable · showing annual price'
                    : 'Annual billing unavailable · showing monthly price'
              }

              return (
                <article className={`price-card${isPopular ? ' feat-p' : ''}`} key={plan.id}>
                  {isPopular ? <div className="price-badge">Most Popular</div> : null}
                  <div className={`price-name${isPopular ? ' accent' : ''}`}>{plan.name}</div>
                  <div className="price-amount">
                    {displayPrice ? formatPrice(displayPrice) : '—'}
                  </div>
                  <div className="price-period">{periodLabel}</div>
                  <p className="price-description">
                    {plan.description?.trim() || 'Flexible access to the Pool Atlas workspace.'}
                  </p>
                  <button
                    type="button"
                    className={`btn btn-full price-action-btn${
                      freePlan ? ' btn-ghost' : isPopular ? ' btn-cta' : ' btn-outline'
                    }`}
                    onClick={() => {
                      void handlePlanAction(plan)
                    }}
                    disabled={pendingPlanId === plan.id || unavailableForSelectedMode}
                  >
                    {actionLabel}
                  </button>
                  <ul className="price-feats">
                    {plan.features.map((feature) => (
                      <li className={feature.is_enabled ? '' : 'no'} key={`${plan.id}-${feature.code}`}>
                        {getFeatureLabel(feature)}
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        ) : null}

        <section className="pricing-faq">
          <h2>FAQ</h2>
          <div className="pricing-faq-list">
            {FAQ_ITEMS.map((item) => (
              <article className="pricing-faq-item" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

export default PricingPage
