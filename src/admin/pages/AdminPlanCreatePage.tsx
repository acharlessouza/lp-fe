import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../../admin/admin.css'
import { PlanForm } from '../components/PlanForm'
import type { PlanFormValues } from '../components/PlanForm'
import { createAdminBillingPlan } from '../services/adminBillingApi'
import type { CreateAdminBillingPlanPayload } from '../types/adminBilling'
import './AdminPlanCreatePage.css'

const DEFAULT_FORM_VALUES: PlanFormValues = {
  name: '',
  code: '',
  description: '',
  sort_order: '0',
  is_active: true,
  is_public: true,
}

function AdminPlanCreatePage() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreatePlan = async (values: PlanFormValues) => {
    const payload: CreateAdminBillingPlanPayload = {
      name: values.name.trim(),
      code: values.code.trim(),
      description: values.description.trim() || null,
      sort_order: Number.parseInt(values.sort_order, 10),
      is_active: values.is_active,
      is_public: values.is_public,
    }

    setSubmitError('')
    setIsSubmitting(true)

    try {
      const createdPlan = await createAdminBillingPlan(payload)
      navigate(`/admin/billing/plans/${createdPlan.id}`, {
        replace: true,
        state: {
          adminNotice: 'Plan created successfully.',
        },
      })
    } catch (createPlanError) {
      const message = createPlanError instanceof Error ? createPlanError.message : 'Unable to create plan.'
      setSubmitError(message)
      throw createPlanError
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="admin-page admin-plan-create-page">
      <div className="admin-shell admin-plan-create-page__shell">
        <header className="admin-page__header">
          <div>
            <Link className="admin-plan-create-page__back" to="/admin/billing/plans">
              ← Back to plans
            </Link>
            <div className="admin-page__eyebrow">Billing Admin</div>
            <h1 className="admin-page__title">New plan</h1>
            <p className="admin-page__subtitle">
              Create a new billing plan. After saving, you can configure features, grants and prices
              on the detail page.
            </p>
          </div>
        </header>

        <section className="admin-card">
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title">General data</h2>
              <p className="admin-section-copy">
                Define the initial plan identity and catalog visibility. Plan code becomes read only
                after creation.
              </p>
            </div>
          </div>

          <PlanForm
            canWrite
            initialValues={DEFAULT_FORM_VALUES}
            isSubmitting={isSubmitting}
            mode="create"
            submitError={submitError}
            submitLabel="Create plan"
            onCancel={() => navigate('/admin/billing/plans')}
            onSubmit={handleCreatePlan}
          />
        </section>
      </div>
    </section>
  )
}

export default AdminPlanCreatePage
