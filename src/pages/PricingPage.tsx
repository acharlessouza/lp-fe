import { useState } from 'react'
import './PricingPage.css'

type BillingMode = 'monthly' | 'annual'

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

function PricingPage() {
  const [billingMode, setBillingMode] = useState<BillingMode>('monthly')
  const isMonthly = billingMode === 'monthly'

  const proPrice = isMonthly ? 29 : 23
  const proPeriod = isMonthly ? 'per month · billed monthly' : 'per month · billed annually'
  const teamPrice = isMonthly ? 79 : 63
  const teamPeriod = isMonthly ? 'per month · up to 5 seats' : 'per month · billed annually'

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
              Annual <span className="pricing-discount">−20%</span>
            </button>
          </div>
        </div>

        <div className="price-grid">
          <article className="price-card">
            <div className="price-name">Free</div>
            <div className="price-amount">
              <sup>$</sup>0
            </div>
            <div className="price-period">forever</div>
            <p className="price-description">
              Explore top pools and run basic simulations.
            </p>
            <button type="button" className="btn btn-ghost btn-full price-action-btn">
              Get started
            </button>
            <ul className="price-feats">
              <li>Radar top pools</li>
              <li>Basic simulation</li>
              <li>Price range modeling</li>
              <li>Volume history (7 days)</li>
              <li className="no">Price volatility data</li>
              <li className="no">Position breakdown</li>
              <li className="no">Recently viewed pools</li>
              <li className="no">Portfolio tracking</li>
            </ul>
          </article>

          <article className="price-card feat-p">
            <div className="price-badge">Most Popular</div>
            <div className="price-name accent">Pro</div>
            <div className="price-amount">
              <sup>$</sup>
              {proPrice}
            </div>
            <div className="price-period">{proPeriod}</div>
            <p className="price-description">
              Full access for serious liquidity providers.
            </p>
            <button type="button" className="btn btn-cta btn-full price-action-btn">
              Start 7-day free trial
            </button>
            <ul className="price-feats">
              <li>Everything in Free</li>
              <li>Price volatility data</li>
              <li>Position breakdown charts</li>
              <li>Recently viewed pools</li>
              <li>Extended history (90d)</li>
              <li>Portfolio tracking</li>
              <li>CSV export</li>
              <li>Priority support</li>
            </ul>
          </article>

          <article className="price-card">
            <div className="price-name">Team</div>
            <div className="price-amount">
              <sup>$</sup>
              {teamPrice}
            </div>
            <div className="price-period">{teamPeriod}</div>
            <p className="price-description">For funds and research teams.</p>
            <button type="button" className="btn btn-outline btn-full price-action-btn">
              Contact sales
            </button>
            <ul className="price-feats">
              <li>Everything in Pro</li>
              <li>5 team seats</li>
              <li>API access</li>
              <li>Custom alerts and webhooks</li>
              <li>Dedicated onboarding</li>
              <li>SLA support</li>
            </ul>
          </article>
        </div>

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
